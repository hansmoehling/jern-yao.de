import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{tokenFor} from '../worker.js';
import {screen,analyse,publicResult} from '../analysis.js';
import {catalogModel,qualitativeMachineCards,withQualitativeMachines} from '../qualitative-machines.js';
import E from '../../engine.js';
import machines from '../../maschinen.json' with {type:'json'};
import praxis from '../../praxis.json' with {type:'json'};

const HY='https://jern-yao.de',MAIN='https://jernyao.de';
const models=['JPF-45B6S','JBP-13B5S','JPF-10B5S','JBF-7B2S','JBF-10B2S','JBF-13B2S'];
const answer=models.map(m=>`${m} ist ein qualitativer Anfragekandidat.`).join('\n');
const cheapest=[...models].sort((a,b)=>catalogModel(a).rp-catalogModel(b).rp).slice(0,3);
const context={note:'C15C. Schaftdurchmesser 8 mm. Schaftlänge 30 mm. Kopfdurchmesser 13 mm. Kopfhöhe 5 mm.'};
function input(){const values={sD:8,sL:30,kD:13,kH:5},labels={sD:'Schaftdurchmesser',sL:'Schaftlänge',kD:'Kopfdurchmesser',kH:'Kopfhöhe'};return {typ:'bolzen',material:'C15C',materialEvidence:{origin:'user_text',quote:'C15C',reference:'Nutzertext'},values,evidence:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{origin:'user_text',quote:`${labels[k]} ${v} mm`,originalValue:v,originalUnit:'mm',reference:'Maß'}]))};}
function environment(){const map=new Map([['regeln','Stadien und Katalogkriterien prüfen.'],['wissenskarten','Qualitative Kandidaten als Anfrage kennzeichnen.']]);return {SPEICHER:{map,async get(k){return map.get(k)??null;},async put(k,v){map.set(k,v);}},ANTHROPIC_API_KEY:'mock',ZUGRIFF_SCHLUESSEL:'test-access-key-more-than-32-characters',DATEIEN:{async get(){return {arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7 test').buffer};}}};}
function mock(t,finalAnswer=answer){const previous=globalThis.fetch;globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body),read=body.messages.some(m=>Array.isArray(m.content)&&m.content.some(c=>c.type==='tool_result'&&c.tool_use_id==='knowledge'));return Response.json({content:read?[{type:'text',text:JSON.stringify({answer:finalAnswer,questions:[],sourceIds:['konzept']})}]:[{type:'tool_use',id:'knowledge',name:'projektwissen',input:{}}]});};t.after(()=>{globalThis.fetch=previous;});}
const request=(origin,body={})=>new Request('https://worker.test/chat',{method:'POST',headers:{...(origin?{Origin:origin}:{}),'Content-Type':'application/json'},body:JSON.stringify({message:'Bitte qualitative Anfragekandidaten nennen.',...body})});

test('numerical package-six screen preserves the recommendation and deliberately different alternatives',()=>{
 const r=screen(input(),{...context,packageSix:true});assert.equal(r.ok,true);assert.equal(r.proposal.calculation.input.machinePolicy,'ranking-v1');
 const e=r.proposal.calculation.input,a=E.auslegen(e),found=E.waehle(machines,a,e,praxis);
 const expected=[found.ranking.recommendation,...found.ranking.alternatives].filter(Boolean).map(m=>m.o.m);
 assert.deepEqual(r.proposal.machines.map(m=>m.model),expected);assert.ok(r.proposal.machines.length<=3);
 assert.deepEqual(withQualitativeMachines(r.proposal,[],'v',{packageSix:true}).machines.map(m=>m.model),expected);
 assert.deepEqual(new Set(r.excludedModels),new Set(found.ranking.all.filter(m=>m.gesamt==='nein'||m.k.some(c=>c.status==='nein')).map(m=>m.o.m)));
});

test('legacy screen ignores client policy fields and nonboolean package flags',()=>{
 const raw={...input(),machinePolicy:'ranking-v1',packageSix:true};
 for(const value of [undefined,false,'true']){const r=screen(raw,{...context,packageSix:value});assert.equal(r.proposal.calculation.input.machinePolicy,undefined);assert.equal(r.proposal.machines.length,5);assert.equal(r.excludedModels,undefined);}
});

test('thread-rolled tips use a cylindrical press blank only under the server package-six flag',async t=>{
 const previous=globalThis.fetch,seen=[];
 globalThis.fetch=async(_url,options)=>{
  const body=JSON.parse(options.body);seen.push(body.system);
  const read=body.messages.some(m=>Array.isArray(m.content)&&m.content.some(c=>c.type==='tool_result'&&c.tool_use_id==='knowledge'));
  return Response.json({content:read?[{type:'text',text:JSON.stringify({answer:'Gewindewalzen nach dem Pressen prüfen.',questions:[],sourceIds:['konzept']})}]:[{type:'tool_use',id:'knowledge',name:'projektwissen',input:{}}]});
 };
 t.after(()=>{globalThis.fetch=previous;});
 for(const flag of [true,false,'true']){
  seen.length=0;await analyse({message:'Gewindespitze wird abgewalzt.',packageSix:flag},environment());assert(seen.length>0);
  for(const system of seen){
   assert.equal(system.includes('Prozessvorgabe für gewalzte Gewindespitzen:'),flag===true);
   if(flag===true){assert(system.includes('Pressrohling an diesem Ende zylindrisch'));assert(system.includes('weder vom Pressrohling noch vom Abschnittvolumen ab'));assert(system.includes('keine Pressstufe'));assert(system.includes('nachgelagerte Operation'));assert(system.includes('ausdrücklichen Prozessangabe'));}
  }
 }
});

test('qualitative package-six selection considers all explicitly named candidates before its three-card cap',()=>{
 const legacy=qualitativeMachineCards(answer),updated=qualitativeMachineCards(answer,[],null,[],{packageSix:true});
 assert.deepEqual(legacy.map(c=>c.model),models.slice(0,5));assert.deepEqual(updated.map(c=>c.model),cheapest);
 for(const c of updated)assert.equal(c.reason,`${c.model} ist ein qualitativer Anfragekandidat.`);
 assert.deepEqual(qualitativeMachineCards('Werkstoff und Maße fehlen.',[],null,[],{packageSix:true}),[]);
 const excluded=qualitativeMachineCards(answer,[],null,[cheapest[0]],{packageSix:true});assert.ok(!excluded.some(c=>c.model===cheapest[0]));
});

test('qualitative merge prioritizes technical status, uses server prices and preserves literal reasons',()=>{
 const cards=qualitativeMachineCards(answer),good={...cards[0],status:'ok',reason:'Original literal reason'},excluded={...cards[1],status:'nein'};
 const proposal={machines:[good,excluded],calculation:{input:{}}};
 const merged=withQualitativeMachines(proposal,[...cards.slice(2),{...cards[1],model:'UNKNOWN'}],'v',{packageSix:true});
 assert.equal(merged.machines.length,3);assert.equal(merged.machines[0].model,good.model);assert.equal(merged.machines[0].reason,good.reason);assert.ok(!merged.machines.some(c=>c.model===excluded.model));
 const spoof=cards.map(c=>({...c,priceEUR:c.model===models[0]?1:99999999}));
 const sorted=withQualitativeMachines({machines:spoof},[],'v',{packageSix:true});assert.equal(sorted.machines[0].model,[...cards].sort((a,b)=>catalogModel(a.model).rp-catalogModel(b.model).rp)[0].model);
 const revival=withQualitativeMachines(proposal,[{...excluded,status:'offen'}],'v',{packageSix:true});assert.ok(!revival.machines.some(c=>c.model===excluded.model));
});

test('price-free and priced analysis preserve the same package-six candidate order',async t=>{
 mock(t);
 const priced=await analyse({message:'Kandidaten?',packageSix:true,pricePolicy:'with-prices'},environment());
 const technical=await analyse({message:'Kandidaten?',packageSix:true,pricePolicy:'technical-only'},environment());
 assert.deepEqual(priced.proposal.machines.map(c=>c.model),cheapest);assert.deepEqual(technical.proposal.machines.map(c=>c.model),cheapest);assert.equal(priced.answer,answer);assert.equal(technical.answer,answer);
 for(const c of publicResult(priced,{pricePolicy:'technical-only'}).proposal.machines){assert.equal(c.priceEUR,undefined);assert.equal(c.priceRangeEUR,undefined);}
});

test('only released exact chat origins enable package six, without exposing main-site prices',async t=>{
 mock(t);
 for(const [origin,n]of [[HY,3],[MAIN,3],['https://www.jernyao.de',3],[null,5]]){
  const response=await worker.fetch(request(origin,{packageSix:true,siteOrigin:HY,featureVersion:'kvp-v1'}),environment());assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.proposal.machines.length,n);assert.deepEqual(body.proposal.machines.map(c=>c.model),n===3?cheapest:models.slice(0,5));if(origin!==HY){assert.equal(body.pricePolicy,'technical-only');assert.ok(body.proposal.machines.every(m=>m.priceEUR===undefined&&m.priceRangeEUR===undefined));}
 }
});

test('linked requests from either released site share current selection, without upgrading their price policy',async t=>{
 mock(t);
 for(const [savedOrigin,currentOrigin,n]of [[MAIN,HY,3],[HY,MAIN,3],[HY,HY,3],[null,HY,5]]){
  const env=environment(),id='12345678-1234-1234-1234-123456789abc';await env.SPEICHER.put('anfrage:'+id,JSON.stringify({id,kind:'preview',siteOrigin:savedOrigin,createdAt:new Date().toISOString(),note:'Bitte Anfragekandidaten nennen.',language:'de'}));
  const response=await worker.fetch(request(currentOrigin,{requestId:id,token:await tokenFor(env,id),packageSix:true}),env);assert.equal(response.status,200);assert.equal((await response.json()).proposal.machines.length,n);
 }
});

test('queue uses stored origin for both drawing and structured geometry and ignores forged queue flags',async t=>{
 mock(t);
 for(const shape of ['drawing','structured'])for(const [siteOrigin,n]of [[HY,3],[MAIN,3],['https://www.jernyao.de',3],[null,5]]){
  const env=environment(),id='12345678-1234-1234-1234-123456789abc',record={id,kind:'preview',siteOrigin,createdAt:new Date().toISOString(),note:'Qualitatives Stadienkonzept; Anfragekandidaten nennen.',language:'de'};
  if(shape==='drawing')record.file={key:'fixture',type:'application/pdf',name:'fixture.pdf',readable:true};
  else{record.geometrySpec={version:1,coordinateSystem:'tool-parting-plane',elements:[{id:'body',operation:'add',shape:'cylinder',side:'die',start:0,length:12,diameter:8,offsetX:0,offsetY:0}],trimming:[]};record.geometryProcess={material:'C10C',d0:4};}
  await env.SPEICHER.put('anfrage:'+id,JSON.stringify(record));
  const job={body:{id,kind:'preview_analysis',packageSix:siteOrigin!==HY,siteOrigin:siteOrigin===HY?MAIN:HY},attempts:1,acks:0,retries:0,ack(){this.acks++;},retry(){this.retries++;}};
  await worker.queue({messages:[job]},env);assert.equal(job.acks,1,shape);assert.equal(job.retries,0);
  const result=JSON.parse(await env.SPEICHER.get('analyse:'+id));assert.equal(result.result.proposal.machines.length,n,shape+' '+siteOrigin);
 }
});
