const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../ranking-service.js'),U=require('../ranking-ui.js');
function fixture(count=15){const candidates=Array.from({length:count},(_,i)=>({o:{m:'JBF-'+(7+i)+'B3S',st:3,cd:7+i,pw:40},gesamt:i<4?'ok':'offen',technicalEligible:true,k:[],ranking:{components:{force:{score:0.8},stations:{score:1}}},execution:{messer:'unbekannt',transfer:'unbekannt'}}));return {alle:candidates,ranking:{all:candidates,candidates,recommendation:candidates[0],alternatives:candidates.slice(1,3),additional:candidates.slice(3),checkedCount:count,priceRankingComplete:false}};}
const response=payload=>({version:'ranking-v1',basis:'submitted-technical-status',priceRankingComplete:true,models:[...payload.candidates.slice(0,3)].reverse().map((row,index,all)=>({model:row.model,comparison:index?{price:{direction:'dearer',percent:25},efficiency:{direction:'lower',percent:20},connector:'and',basis:{source:'catalog-factor',factor:.35,demandCap:30,toolCostsIncluded:false}}:null}))});
function service(request){const timers=new Map();let id=0;const api=S.create({request,schedule:fn=>{timers.set(++id,fn);return id;},cancel:key=>timers.delete(key)});return {api,timers,async run(){const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);await entry[1]();}}};}

test('only a bounded technical shortlist is sent, without part details or price data',()=>{
 const selection=fixture();selection.ranking.candidates[0].o.rp=987654;selection.ranking.candidates[0].private='customer';
 const payload=S.payloadFor(selection,30);assert.equal(payload.candidates.length,12);assert.equal(payload.demandPerMinute,30);assert.deepEqual(Object.keys(payload.candidates[0]).sort(),['model','status','suitability']);assert(!JSON.stringify(payload).includes('987654'));assert(!JSON.stringify(payload).includes('customer'));
 const result=S.applyResponse(selection,payload,response(payload));assert.equal(result.ranking.recommendation.o.m,payload.candidates[2].model);assert.equal(result.ranking.priceRankingComplete,false);assert.deepEqual(result.ranking.comparisonCoverage,{compared:12,eligible:15,priceComplete:true});
 const html=U.summaryHtml(result.ranking,{showPrices:false});assert(!U.detailsHtml(result.ranking.recommendation,result.ranking,{showPrices:false}).includes('12 von 15'));assert(!html.includes('Niedrigster Richtpreis'));assert(!html.includes('Preisrang nicht vollständig verfügbar'));
 assert(U.cardHtml(result.ranking.alternatives[0],result.ranking,{showPrices:false}).includes('25 % teurer'));
 assert(U.cardHtml(result.ranking.alternatives[0],result.ranking,{showPrices:false}).includes('20 % weniger'));
});

test('complete small candidate sets may claim complete server ranking; unknown and duplicate models cannot enter',()=>{
 const selection=fixture(3),payload=S.payloadFor(selection),data=response(payload),result=S.applyResponse(selection,payload,data);assert.equal(result.ranking.priceRankingComplete,true);
 for(const models of [[{model:'not-submitted'}],[data.models[0],data.models[0]]])assert.throws(()=>S.applyResponse(selection,payload,{...data,models}));
 assert.throws(()=>S.applyResponse(selection,payload,{...data,priceRankingComplete:undefined}));
});

test('late ranking replies never restore an old calculation and cached responses avoid duplicate requests',async()=>{
 let resolve,calls=0;const p=service(()=>{calls++;return new Promise(r=>{resolve=r;});}),selection=fixture(),old=[];
 p.api.update(selection,{onResult:value=>old.push(value)});const wait=p.run();await Promise.resolve();await Promise.resolve();
 p.api.reset();resolve(response(S.payloadFor(selection)));await wait;assert.equal(old.length,0);
 const newer=[];p.api.update(selection,{onResult:value=>newer.push(value)});assert.equal(newer.length,1);assert.equal(calls,1);assert.equal(p.timers.size,0);
});

test('service failure leaves the technical recommendation intact and rapid edits debounce to the current request',async()=>{
 let calls=0;const p=service(async()=>{calls++;throw Error('network unavailable');}),selection=fixture(),original=selection.ranking.recommendation.o.m;
 p.api.update(selection,{onResult(){throw Error('must not render');}});p.api.update(selection,{demandPerMinute:40,onResult(){throw Error('must not render');}});assert.equal(p.timers.size,1);await p.run();assert.equal(calls,1);assert.equal(selection.ranking.recommendation.o.m,original);assert.equal(selection.ranking.priceRankingComplete,false);
});

function v2fixture(){
 const selection=fixture(30);selection.ranking.version='ranking-v2';
 selection.ranking.candidates.forEach((row,i)=>{
  row.gesamt='ok';row.o.rp=10000-i*100;row.ranking={classification:i<15?'A':'B',score:.9-(i%15)*.01,reserveAlternativeEligible:i>=15,components:{force:{score:.8,state:'near'},stations:{score:i<15?1:.6,state:i<15?'optimal':'tight',value:i<15?1:0}}};
 });
 return selection;
}
test('v2 sends two bounded deterministic pools independent of prices and incoming order',()=>{
 const priced=v2fixture(),unpriced=structuredClone(priced);unpriced.ranking.candidates.reverse().forEach(row=>{delete row.o.rp;});
 const a=S.payloadFor(priced,30),b=S.payloadFor(unpriced,30);
 assert.deepEqual(a,b);assert.equal(a.rankingVersion,'ranking-v2');assert.equal(a.candidates.length,24);
 assert.equal(a.candidates.filter(row=>row.role==='primary').length,12);assert.equal(a.candidates.filter(row=>row.role==='reserve').length,12);
 assert(a.candidates.filter(row=>row.role==='primary').every(row=>row.classification==='A'));
 assert(a.candidates.filter(row=>row.role==='reserve').every(row=>row.classification==='B'&&row.stationReserve===0));
 assert(!/"(?:rp|lo|hi|priceEUR|geometry|private)"/.test(JSON.stringify(a)));
});
test('v2 accepts a cheaper reserve alternative but never promotes it to recommendation',()=>{
 const selection=v2fixture(),payload=S.payloadFor(selection),primary=payload.candidates.filter(row=>row.role==='primary'),reserve=payload.candidates.find(row=>row.role==='reserve');
 const data={version:'ranking-v2',basis:'submitted-technical-status',priceRankingComplete:true,models:[{model:primary[0].model,comparison:null},{model:reserve.model,comparison:{price:{direction:'cheaper',percent:20},efficiency:null}},{model:primary[1].model,comparison:null}]};
 const result=S.applyResponse(selection,payload,data);assert.equal(result.ranking.recommendation.ranking.classification,'A');assert.equal(result.ranking.alternatives[0].o.m,reserve.model);assert.equal(result.ranking.priceRankingComplete,true);
 assert.throws(()=>S.applyResponse(selection,payload,{...data,version:'ranking-v1'}));
 assert.throws(()=>S.applyResponse(selection,payload,{...data,models:[data.models[1],data.models[0]]}));
 assert.throws(()=>S.applyResponse(selection,payload,{...data,models:[data.models[0],data.models[2],data.models[1]]}));
 assert.throws(()=>S.applyResponse(selection,payload,{...data,models:[data.models[0],{...data.models[1],comparison:{price:{direction:'dearer',percent:20}}}]}));
});
