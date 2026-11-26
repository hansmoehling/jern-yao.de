import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import catalog from '../../maschinen.json' with {type:'json'};
import practice from '../../praxis.json' with {type:'json'};
import R from '../../machine-ranking.js';
import Service from '../../ranking-service.js';
import Engine from '../../engine.js';
import Library from '../../normen/library.js';
import Standards from '../../normen/resolver.js';
import Wire from '../../vorbelegung/draht.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const names=['JBF-10B2S','JBF-10B2SL','JBF-10B2SXL','JBF-10B3S','JBF-13B2S'];
const candidate=model=>({model,status:'ok',suitability:{force:0.8,stations:1,size:0.9,length:0.8,output:1}});
const input=()=>({featureVersion:'kvp-v1',candidates:names.map(candidate)});
function env(){const map=new Map();return {SPEICHER:{map,async get(k){return map.get(k)??null;},async put(k,v){map.set(k,v);}}};}
const request=(body,origin='https://jern-yao.de')=>new Request('https://worker.test/rangfolge',{method:'POST',headers:{...(origin?{Origin:origin}:{}),'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.74'},body:typeof body==='string'?body:JSON.stringify(body)});
async function post(body,environment=env(),origin){const response=await worker.fetch(request(body,origin),environment);return {response,body:await response.json()};}

test('ranking endpoint uses server prices and returns the same recommendation and diverse alternatives',async()=>{
 const {response,body}=await post(input());assert.equal(response.status,200);assert.equal(body.version,'ranking-v1');assert.equal(body.basis,'submitted-technical-status');
 const ranked=R.rankMachines(catalog.filter(m=>names.includes(m.m)),{checkMachine:()=>({gesamt:'ok',k:[]}),practice});
 const expected=[ranked.recommendation,...ranked.alternatives].map(r=>r.o.m);assert.deepEqual(body.models.map(x=>x.model),expected);assert.equal(body.models.length,3);assert.equal(body.models[0].comparison,null);
 assert.ok(body.models.slice(1).some(x=>catalog.find(m=>m.m===x.model).st!==2));
});

test('response contains only the displayed model names and rounded relative comparisons',async()=>{
 const {body}=await post({...input(),demandPerMinute:30});assert.deepEqual(Object.keys(body).sort(),['basis','models','priceRankingComplete','version']);assert.equal(body.priceRankingComplete,true);
 const prohibited=new Set(['rp','lo','hi','priceEUR','priceRangeEUR','candidates','ranking','score','suitability','catalog','all','referenceOutput','alternativeOutput']);
 function visit(v){if(!v||typeof v!=='object')return;for(const [k,value]of Object.entries(v)){assert.ok(!prohibited.has(k),k);visit(value);}}
 visit(body);
 for(const row of body.models){assert.deepEqual(Object.keys(row).sort(),['comparison','model']);if(!row.comparison)continue;for(const metric of ['price','efficiency']){const change=row.comparison[metric];if(change){assert.equal(change.percent%5,0);assert.ok(Number.isFinite(change.percent));assert.deepEqual(Object.keys(change).sort(),['direction','percent']);}}}
 const serialized=JSON.stringify(body);for(const m of catalog.filter(m=>names.includes(m.m)))assert.ok(!serialized.includes(String(m.rp)),m.m);
});

test('strict schema rejects unknown models, duplicates, extra fields and invalid scores',async()=>{
 const wrong=[{...input(),pricePolicy:'with-prices'},{...input(),featureVersion:'ranking-v1'},{candidates:names.map(candidate)},{...input(),demandPerMinute:0},{...input(),candidates:[candidate('JBF-999B9S')]},{...input(),candidates:[candidate(names[0]),candidate(names[0])]},{...input(),candidates:[{...candidate(names[0]),priceEUR:1}]},{...input(),candidates:[{...candidate(names[0]),reason:'PRIVATE_TEXT'}]}];
 for(const suitability of [{},{force:1.01},{force:-1},{force:'1'},{force:null},{force:1,private:'SECRET'}])wrong.push({...input(),candidates:[{...candidate(names[0]),suitability}]});
 for(const payload of wrong){const {response,body}=await post(payload);assert.equal(response.status,400,JSON.stringify(payload));assert.equal(body.models,undefined);assert.ok(!JSON.stringify(body).includes('PRIVATE_TEXT'));}
});

test('candidate count and body bounds are enforced before evaluation',async()=>{
 assert.equal((await post({...input(),candidates:[]})).response.status,400);
 assert.equal((await post({...input(),candidates:catalog.slice(0,13).map(m=>candidate(m.m))})).response.status,400);
 assert.equal((await post({...input(),candidates:catalog.slice(0,12).map(m=>candidate(m.m))})).response.status,200);
 assert.equal((await post(' '.repeat(8193))).response.status,413);
});

test('released price-free sites share the server recommendation without receiving absolute prices',async()=>{
 const expected=(await post(input())).body;
 for(const origin of ['https://jernyao.de','https://www.jernyao.de']){
  const {response,body}=await post(input(),env(),origin);assert.equal(response.status,200);assert.deepEqual(body,expected);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.ok(!/"(?:rp|lo|hi|priceEUR|priceRangeEUR)"/.test(JSON.stringify(body)));
 }
});

test('additional CORS origins and missing origins cannot enable the comparison route',async()=>{
 for(const origin of ['https://www.jern-yao.de',null]){
  const environment=env();environment.ALLOWED_ORIGINS='https://www.jern-yao.de';
  const {response}=await post(input(),environment,origin);assert.equal(response.status,404);assert.equal(environment.SPEICHER.map.size,0);
 }
});

test('submitted exclusions and verified rotative transfer stay excluded',async t=>{
 const no=input();no.candidates=no.candidates.map(c=>({...c,status:'nein'}));assert.deepEqual((await post(no)).body.models,[]);
 const row=catalog.find(m=>m.m===names[0]),old=row.ausfuehrung;row.ausfuehrung={transfer:{value:'rotativ',status:'verified'}};t.after(()=>{if(old===undefined)delete row.ausfuehrung;else row.ausfuehrung=old;});
 const {body}=await post(input());assert.ok(!body.models.some(x=>x.model===row.m));
});

test('fully assessed candidates precede cheaper candidates with open technical points',async()=>{
 const body=input();body.candidates=body.candidates.map(c=>({...c,status:c.model==='JBF-13B2S'?'ok':'offen'}));
 assert.equal((await post(body)).body.models[0].model,'JBF-13B2S');
});

test('ranking requests use the bounded existing storage throttle',async()=>{
 const environment=env();for(let i=0;i<60;i++)assert.equal((await post(input(),environment)).response.status,200);
 assert.equal((await post(input(),environment)).response.status,429);
 assert.ok([...environment.SPEICHER.map.keys()].every(k=>k.startsWith('rate:ranking-v1:')));
});

const v2Candidate=(model,role='primary',score=.9)=>({model,status:'ok',classification:role==='primary'?'A':'B',score,role,stationReserve:role==='primary'?1:0});
const v2Input=()=>({featureVersion:'kvp-v1',rankingVersion:'ranking-v2',candidates:[v2Candidate('JBF-13B3S'),v2Candidate('JBF-10B3S'),v2Candidate('JBF-10B2S','reserve')]});

test('v2 recommends the best class and places the cheaper no-reserve B first among alternatives',async()=>{
 const {response,body}=await post(v2Input());assert.equal(response.status,200);assert.equal(body.version,'ranking-v2');
 assert.deepEqual(body.models.map(row=>row.model),['JBF-10B3S','JBF-10B2S','JBF-13B3S']);assert.equal(body.models[1].comparison.price.direction,'cheaper');
 assert.equal(body.priceRankingComplete,true);assert(!/"(?:rp|lo|hi|priceEUR|classification|score|role|stationReserve)"/.test(JSON.stringify(body)));
 // The shared deployment retains the released client behaviour without v2.
 const old={featureVersion:'kvp-v1',candidates:v2Input().candidates.map(row=>candidate(row.model))};
 const legacy=await post(old);assert.equal(legacy.body.version,'ranking-v1');assert.equal(legacy.body.models[0].model,'JBF-10B2S');
});

test('v2 pools reject mixed classes, invalid reserve candidates and unbounded metadata',async()=>{
 const wrong=[{...v2Input(),rankingVersion:'ranking-v3'}, {...v2Input(),private:'SECRET'}];
 for(const change of [{classification:'C'},{stationReserve:1},{role:'primary'},{score:1.02},{score:null},{reason:'SECRET'}]){
  const body=v2Input();body.candidates[2]={...body.candidates[2],...change};wrong.push(body);
 }
 const duplicate=v2Input();duplicate.candidates.push(duplicate.candidates[0]);wrong.push(duplicate);
 const noPrimary=v2Input();noPrimary.candidates=noPrimary.candidates.filter(row=>row.role==='reserve');wrong.push(noPrimary);
 const tierMismatch=v2Input();tierMismatch.candidates[0].status='offen';wrong.push(tierMismatch);
 const tooManyPrimary=v2Input();tooManyPrimary.candidates=catalog.slice(0,13).map(row=>v2Candidate(row.m));wrong.push(tooManyPrimary);
 const tooManyTotal=v2Input();tooManyTotal.candidates=catalog.slice(0,25).map((row,i)=>v2Candidate(row.m,i<12?'primary':'reserve'));wrong.push(tooManyTotal);
 for(const body of wrong){const result=await post(body);assert.equal(result.response.status,400,JSON.stringify(body));assert(!JSON.stringify(result.body).includes('SECRET'));}
 const bounded=v2Input();bounded.candidates=catalog.slice(0,24).map((row,i)=>v2Candidate(row.m,i<12?'primary':'reserve'));
 assert.equal((await post(bounded)).response.status,200);
});

test('v2 retains catalogue hard exclusions and never promotes a reserve when primary is rejected',async t=>{
 const model=catalog.find(row=>row.m==='JBF-10B3S'),before=model.ausfuehrung;model.ausfuehrung={transfer:{value:'rotativ',status:'verified'}};
 t.after(()=>{if(before===undefined)delete model.ausfuehrung;else model.ausfuehrung=before;});
 const result=await post(v2Input());assert.equal(result.response.status,200);assert.equal(result.body.models[0].model,'JBF-13B3S');assert(!result.body.models.some(row=>row.model===model.m));
 const body=v2Input();body.candidates=body.candidates.filter(row=>row.model!=='JBF-13B3S');assert.deepEqual((await post(body)).body.models,[]);
});

test('four standard examples send identical v2 pools and display the same three models locally and on both origins',async()=>{
 const data={schemaVersion:1,version:'ranking-parity-test',families:['ISO4762','ISO4017','DIN6791','ISO4032'].map(id=>require('../../normen/'+id+'.json')),threads:require('../../normen/gewinde.json'),materials:require('../../vorbelegung/werkstoff.json')};
 const selections=[{id:'ISO4762',groesse:'M6',laenge:30,festigkeitsklasse:'8.8'},{id:'ISO4017',groesse:'M8',laenge:40,festigkeitsklasse:'8.8'},{id:'DIN6791',groesse:'4',laenge:12,festigkeitsklasse:'Stahl'},{id:'ISO4032',groesse:'M10',festigkeitsklasse:'8'}];
 for(const selected of selections){
  const family=data.families.find(row=>row.id===selected.id),kind=Library.familyKind(family),document=Standards.resolveStandard(data,selected),preset=Library.adapt(data,document),materialRule=data.materials.rules.find(row=>row.kind===kind&&row.classes.includes(selected.festigkeitsklasse));
  const wst=Engine.WERKSTOFFE.findIndex(row=>row.id===materialRule.materialId),curve=Engine.WERKSTOFFE[wst].flowCurves.find(row=>row.state===materialRule.state)||Engine.WERKSTOFFE[wst].flowCurves[0];
  const input={...preset,typ:kind==='nut'?'mutter':'bolzen',wst,curveId:curve.id,materialState:materialRule.state,rmPolicy:'rm-v1',machinePolicy:'ranking-v2',kopfTyp:preset.kopfForm==='rund'?'zylinder':preset.kopfForm};
  input.d0=Wire.candidates(input,null,catalog)[0].value;
  const analysis=Engine.auslegen(input);assert.equal(analysis.fehlt.length,0,selected.id);
  const priced=Engine.waehle(catalog,analysis,input,practice),unpriced=Engine.waehle(catalog.map(({rp,lo,hi,...row})=>row),analysis,input,practice);
  const payload=Service.payloadFor(priced),withoutPrices=Service.payloadFor(unpriced);assert.deepEqual(payload,withoutPrices,selected.id);assert.equal(payload.rankingVersion,'ranking-v2');
  const expected=[priced.ranking.recommendation,...priced.ranking.alternatives].map(row=>row.o.m);assert.equal(expected.length,3,selected.id);
  for(const origin of ['https://jern-yao.de','https://jernyao.de']){
   const {response,body}=await post(payload,env(),origin);assert.equal(response.status,200,selected.id);assert.deepEqual(body.models.map(row=>row.model),expected,selected.id+' '+origin);
   const applied=Service.applyResponse(unpriced,withoutPrices,body);assert.deepEqual([applied.ranking.recommendation,...applied.ranking.alternatives].map(row=>row.o.m),expected);
   assert(!/"(?:rp|lo|hi|priceEUR|priceRangeEUR)"/.test(JSON.stringify(body)));
  }
 }
});
