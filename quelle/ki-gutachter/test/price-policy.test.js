import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {analyse,publicResult,screen} from '../analysis.js';
import Engine from '../../engine.js';

const LEGACY='https://jern-yao.de',PUBLIC='https://jernyao.de',WWW='https://www.jernyao.de';
const TECH='technical-only',FULL='with-prices';
class KV{
 constructor(){this.map=new Map([['regeln','R-ST1: Stauchverhältnis prüfen.\nMaschinenpreis: 987654 EUR.\n| Maschine | Preis EUR |\n| JBF-7B4S | 876543 |\n\nR-F1: Umformkraft prüfen.'],['wissenskarten','Kraft und Stadien prüfen.\nMachine price: 765432 EUR.']]);}
 async get(k){return this.map.get(k)??null;}
 async put(k,v){this.map.set(k,v);}
}
function env(){return {SPEICHER:new KV(),DATEIEN:{async put(){},async get(){return {arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7 test').buffer};}},ANFRAGEN:{async sendBatch(){}},ANTHROPIC_API_KEY:'test-only',RESEND_API_KEY:'test-only',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test',ZUGRIFF_SCHLUESSEL:'test-only-secret-32-characters-minimum'};}
const note='C15C. Schaftdurchmesser 8 mm. Schaftlänge 30 mm. Kopfdurchmesser 13 mm. Kopfhöhe 5 mm.';
function input(){
 const values={sD:8,sL:30,kD:13,kH:5},quotes={sD:'Schaftdurchmesser 8 mm',sL:'Schaftlänge 30 mm',kD:'Kopfdurchmesser 13 mm',kH:'Kopfhöhe 5 mm'};
 return {typ:'bolzen',material:'C15C',materialEvidence:{origin:'user_text',quote:'C15C',reference:'Nutzertext'},curveId:Engine.findMaterial('C15C').flowCurves[0].id,materialState:'soft-annealed',materialStateEvidence:{origin:'assumption',quote:'Prozessvorschlag: weichgeglühten Draht verwenden',reference:'Prozessvorschlag'},values,evidence:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{origin:'user_text',quote:quotes[k],reference:quotes[k],originalValue:v,originalUnit:'mm'}]))};
}
function mockFetch(t,fn){const old=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=old;});}
const tool=(name,input={})=>({type:'tool_use',id:name,name,input});
const reply=(...content)=>Response.json({content});
const final=answer=>({type:'text',text:JSON.stringify({answer,questions:[],sourceIds:['engine','konzept']})});
const pricedKeys=value=>{
 if(Array.isArray(value))return value.flatMap(pricedKeys);
 if(!value||typeof value!=='object')return [];
 return Object.entries(value).flatMap(([k,v])=>[/^(?:priceEUR|priceRangeEUR|rp|lo|hi)$/.test(k)?k:[],pricedKeys(v)]).flat();
};
function assertNoPrices(value){
 assert.deepEqual(pricedKeys(value),[]);
 assert.ok(!/(?<![\d.])(?:987654|876543|765432|654321|543210|432109|321098|210987|999999)(?![\d.])/.test(JSON.stringify(value)),'A planted monetary value escaped filtering');
}
async function postIntake(e,origin,extra={}){
 const f=new FormData();for(const[k,v]of Object.entries({email:'buyer@example.test',notiz:note,idempotency_key:'same-intake-key',...extra}))f.set(k,v);
 const response=await worker.fetch(new Request('https://worker.test/anfrage',{method:'POST',headers:origin?{Origin:origin}:{},body:f}),e);
 return {httpStatus:response.status,...await response.json()};
}
async function legacyIntake(e,origin,extra={}){
 const r=await postIntake(e,origin,extra),record=JSON.parse(await e.SPEICHER.get('anfrage:'+r.id));
 delete record.kind;await e.SPEICHER.put('anfrage:'+r.id,JSON.stringify(record));return r;
}
const status=(e,r,origin,policy=FULL)=>worker.fetch(new Request('https://worker.test/status?id='+r.id+'&token='+r.token+'&pricePolicy='+policy,{headers:origin?{Origin:origin}:{}}),e).then(r=>r.json());
const chat=(e,origin,body)=>worker.fetch(new Request('https://worker.test/chat',{method:'POST',headers:origin?{Origin:origin}:{},body:JSON.stringify(body)}),e);
function sizingMock(t,technical){
 let n=0;
 mockFetch(t,async(url,req)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');const body=JSON.parse(req.body);
  if(technical){assertNoPrices(body.messages);assert.match(body.system,/keinerlei Maschinenpreise/);}
  if(n++===0)return reply(tool('projektwissen',{material:'C15C'}));
  const result=JSON.parse(body.messages.at(-1).content[0].content);
  if(n===2){if(technical)assertNoPrices(result);else assert.match(result.rules,/987654/);return reply(tool('grobauslegung',input()));}
  assert.equal(result.ok,true);assert.ok(result.proposal.stages.length>0);assert.ok(result.proposal.machines.length>0);
  if(technical)assertNoPrices(result);else assert.ok(result.proposal.machines.some(m=>m.priceEUR>0));
  return reply(final('Die Stadienfolge und die technischen Maschinenkandidaten sind berechnet.'));
 });
}

test('screen omits monetary fields before tool delivery without changing technical calculations',()=>{
 const full=screen(input(),{note}),free=screen(input(),{note,pricePolicy:TECH});
 assert.ok(full.proposal.machines.some(m=>m.priceEUR>0));assertNoPrices(free);
 assert.deepEqual(free.proposal.stages,full.proposal.stages);
 assert.deepEqual(free.proposal.calculation.values,full.proposal.calculation.values);
 assert.deepEqual(free.proposal.machines.map(x=>x.model),full.proposal.machines.map(x=>x.model));
 assert.ok(!free.proposal.calculationBasis.some(x=>/Preise/.test(x)));
});

test('both no-hyphen origins persist technical policy and reject payload re-enabling',async()=>{
 for(const origin of [PUBLIC,WWW]){
  const e=env(),r=await postIntake(e,origin,{pricePolicy:FULL,showPrices:'true',origin:LEGACY});
  assert.equal(r.httpStatus,202);assert.equal(r.pricePolicy,TECH);
  const saved=JSON.parse(await e.SPEICHER.get('anfrage:'+r.id));
  assert.equal(saved.pricePolicy,TECH);assert.equal(saved.siteOrigin,origin);
 }
});

test('explicit technical restriction works on previews and legacy origin; idempotency never upgrades an intake',async()=>{
 const e=env();e.ALLOWED_ORIGINS='https://preview.example.test';
 const preview=await postIntake(e,'https://preview.example.test',{pricePolicy:TECH});assert.equal(preview.pricePolicy,TECH);
 const free=await postIntake(e,LEGACY,{pricePolicy:TECH});assert.equal(free.pricePolicy,TECH);
 const upgraded=await postIntake(e,LEGACY,{pricePolicy:FULL});assert.equal(upgraded.httpStatus,409);
 const replay=await postIntake(e,LEGACY,{pricePolicy:TECH});assert.equal(replay.id,free.id);assert.equal(replay.pricePolicy,TECH);
 const other=await postIntake(e,PUBLIC,{pricePolicy:FULL});assert.notEqual(other.id,free.id);assert.equal(other.pricePolicy,TECH);
});

test('legacy queued upload analysis uses saved policy, not forged queue payload; status cannot re-enable prices',async t=>{
 const e=env(),r=await legacyIntake(e,PUBLIC,{datei:new File(['%PDF-1.7 test'],'drawing.pdf',{type:'application/pdf'}),pricePolicy:FULL});
 sizingMock(t,true);
 const message={body:{kind:'analysis',id:r.id,pricePolicy:FULL,siteOrigin:LEGACY},acks:0,ack(){this.acks++;},retry(){throw Error('unexpected retry');}};
 await worker.queue({messages:[message]},e);assert.equal(message.acks,1);
 const saved=JSON.parse(await e.SPEICHER.get('analyse:'+r.id));assert.equal(saved.result.pricePolicy,TECH);assertNoPrices(saved.result);
 for(const origin of [PUBLIC,WWW,LEGACY,null]){const result=await status(e,r,origin);assert.equal(result.pricePolicy,TECH);assertNoPrices(result);assert.ok(result.proposal.machines.length>0);}
});

test('legacy origin preserves catalogue prices in its model tools and public result',async t=>{
 const e=env(),r=await legacyIntake(e,LEGACY);assert.equal(r.pricePolicy,FULL);sizingMock(t,false);
 await worker.queue({messages:[{body:{kind:'analysis',id:r.id},ack(){},retry(){throw Error('unexpected retry');}}]},e);
 const full=await status(e,r,LEGACY);assert.equal(full.pricePolicy,FULL);assert.ok(full.proposal.machines.some(x=>x.priceEUR>0));
 const free=await status(e,r,PUBLIC);assert.equal(free.pricePolicy,TECH);assertNoPrices(free);
});

test('linked follow-up retains saved technical policy and strips older monetary history',async t=>{
 const e=env(),r=await postIntake(e,WWW);
 await e.SPEICHER.put('chat:'+r.id,JSON.stringify([{role:'assistant',content:'Maschinenpreis 654321 EUR. Technisch sind fünf Stationen vorgesehen.'}]));
 let round=0;mockFetch(t,async(url,req)=>{
  const b=JSON.parse(req.body);assertNoPrices(b.messages);assert.match(b.system,/keinerlei Maschinenpreise/);
  return round++===0?reply(tool('projektwissen')):reply(final('Die zusätzliche Station bleibt als Reserve vorgesehen.'));
 });
 const response=await chat(e,LEGACY,{requestId:r.id,token:r.token,message:'Weitere technische Erläuterung.',pricePolicy:FULL,showPrices:true,origin:LEGACY,history:[{role:'assistant',content:'Preis 999999 EUR.'}]});
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.pricePolicy,TECH);assertNoPrices(result);
 assert.equal(JSON.parse(await e.SPEICHER.get('analyse:'+r.id)).result.pricePolicy,TECH);
});

test('status sanitizes stale monetary prose and fields using intake policy, including nested results',async()=>{
 const e=env(),r=await legacyIntake(e,PUBLIC);
 await e.SPEICHER.put('analyse:'+r.id,JSON.stringify({status:'ready',result:{pricePolicy:FULL,answer:'Preis: 543210 EUR. Die Maschine hat fünf Stationen.',questions:['Passt das Budget von 432109 EUR?'],proposal:{machines:[{model:'JBF-7B4S',priceEUR:543210,priceRangeEUR:[432109,654321],concept:{rp:543210,lo:432109,hi:654321,stages:[{number:1,operation:'Vorstauchen'}]}}]},sources:[],language:'de'}}));
 const result=await status(e,r,LEGACY);assertNoPrices(result);assert.equal(result.answer,'Die Maschine hat fünf Stationen.');assert.deepEqual(result.questions,[]);assert.equal(result.proposal.machines[0].concept.stages.length,1);
});

test('free chat ignores forged policy and origin fields; a priced model answer is rejected without feeding it back',async t=>{
 const e=env();let round=0;
 mockFetch(t,async(url,req)=>{
  const b=JSON.parse(req.body);assertNoPrices(b.messages);assert.match(b.system,/keinerlei Maschinenpreise/);
  if(round++===0)return reply(tool('projektwissen'));
  if(round===2)return reply(final('Die Maschine kostet 321098 EUR.'));
  return reply(final('Hans erstellt Ihnen ein individuelles Angebot.'));
 });
 const response=await chat(e,PUBLIC,{message:'Bitte technische Maschinenwahl erklären.',pricePolicy:FULL,origin:LEGACY,siteOrigin:LEGACY,history:[{role:'assistant',content:'The machine price is 210987 EUR.'}]});
 assert.equal(response.status,200);const result=await response.json();assert.equal(round,3);assert.equal(result.pricePolicy,TECH);assertNoPrices(result);
});

test('client technical-only restriction also applies to fresh legacy chat and missing-origin requests',async t=>{
 let count=0;mockFetch(t,async(url,req)=>{const b=JSON.parse(req.body);assert.match(b.system,/keinerlei Maschinenpreise/);return count++%2===0?reply(tool('projektwissen')):reply(final('Wir betrachten zunächst die Stadienfolge.'));});
 for(const origin of [LEGACY,null]){
  const response=await chat(env(),origin,{message:'Erkläre die Stadienfolge.',pricePolicy:TECH});assert.equal(response.status,200);assert.equal((await response.json()).pricePolicy,TECH);
 }
});

test('price-free research tool results cannot return prices obtained from an external source',async t=>{
 const e=env();e.RESEARCH_DOMAINS='jernyao.com';e.RECHERCHE={fetch:async()=>Response.json({results:[{title:'Technical machine data',url:'https://jernyao.com/specification',excerpt:'Five forming stations. Price 987654 EUR.'}]})};
 let n=0;mockFetch(t,async(url,req)=>{
  const b=JSON.parse(req.body);assertNoPrices(b.messages);
  if(n++===0)return reply(tool('projektwissen'));
  if(n===2)return reply(tool('recherche',{topic:'Maschinenkatalog'}));
  const result=JSON.parse(b.messages.at(-1).content[0].content);assert.equal(result.available,true);assert.equal(result.results[0].excerpt,'Five forming stations.');
  return reply(final('Die technische Quelle beschreibt fünf Umformstationen.'));
 });
 const result=await analyse({message:'Welche Stationsfolge?',pricePolicy:TECH},e);assertNoPrices(result);
});

test('publication fallback remains price-free in all supported languages',()=>{
 for(const language of ['de','it','sl','en','zh']){
  const r=publicResult({answer:'Price 987654 EUR.',language,proposal:{priceEUR:987654}},{pricePolicy:TECH});
  assertNoPrices(r);assert.ok(r.answer);assert.equal(r.language,language);assert.equal(r.pricePolicy,TECH);
 }
});
