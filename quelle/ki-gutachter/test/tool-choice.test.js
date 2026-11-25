import test from 'node:test';
import assert from 'node:assert/strict';
import {analyse} from '../analysis.js';
import {coaxialDrawingTopology} from './topology-fixture.js';

const env=()=>({ANTHROPIC_API_KEY:'test-only',SPEICHER:{async get(key){return {regeln:'R-ST1: Geometrie prüfen.',wissenskarten:'K23: Erfahrung ersetzt keinen Nachweis.'}[key]||null;}}});
const tool=(name,id=name)=>({type:'tool_use',name,id,input:{}});
const final=answer=>({type:'text',text:JSON.stringify({answer,questions:[],sourceIds:['konzept']})});
function fetchMock(t,handler){const original=globalThis.fetch;globalThis.fetch=handler;t.after(()=>{globalThis.fetch=original;});}

test('Opus-compatible auto choice withholds answers until knowledge was read and preserves thinking blocks',async t=>{
 let calls=0;
 let firstRequest;
 const knowledgeReply=[{type:'thinking',thinking:'',signature:'test-signature'},tool('projektwissen')];
 fetchMock(t,async(url,request)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');
  const body=JSON.parse(request.body);
  assert.deepEqual(body.tool_choice,{type:'auto'});
  if(!firstRequest)firstRequest=body;
  assert.deepEqual(body.tools,firstRequest.tools);
  assert.equal(body.system,firstRequest.system);
  assert.deepEqual(body.tools.map(x=>x.name),['projektwissen','grobauslegung','recherche']);
  if(calls++===0){
   return Response.json({content:[final('Diese vorschnelle Antwort darf nicht erscheinen.')]});
  }
  if(calls===2){
   assert.match(body.messages.at(-1).content,/Rufe jetzt zuerst das Werkzeug projektwissen auf/);
   return Response.json({content:knowledgeReply});
  }
  assert.deepEqual(body.tools.map(x=>x.name),['projektwissen','grobauslegung','recherche']);
  assert.deepEqual(body.messages.at(-2).content,knowledgeReply);
  const knowledge=JSON.parse(body.messages.at(-1).content[0].content);
  assert.equal(knowledge.status,'legacy');
  assert.match(knowledge.rules,/Geometrie prüfen/);
  return Response.json({content:[final('Bitte nennen Sie den Werkstoff und die Abmessungen.')]});
 });
 const result=await analyse({message:'Wie legen wir das Teil aus?'},env());
 assert.equal(calls,3);
 assert.equal(result.answer,'Bitte nennen Sie den Werkstoff und die Abmessungen.');
 assert.ok(result.sources.some(x=>x.id==='konzept'));
});

test('a model that never reads project knowledge cannot return a customer-facing answer',async t=>{
 let calls=0;
 fetchMock(t,async(url,request)=>{
  calls++;const body=JSON.parse(request.body);
  assert.deepEqual(body.tool_choice,{type:'auto'});
  assert.deepEqual(body.tools.map(x=>x.name),['projektwissen','grobauslegung','recherche']);
  return Response.json({content:[final('Eine Antwort ohne Projektwissen.')]});
 });
 await assert.rejects(analyse({message:'Eine Fachfrage'},env(),{maxRounds:3}),/model_round_limit/);
 assert.equal(calls,3);
});

test('calculation and research are gated until the model receives the knowledge result',async t=>{
 let calls=0;
 fetchMock(t,async(url,request)=>{
  const body=JSON.parse(request.body);
  assert.deepEqual(body.tool_choice,{type:'auto'});
  if(calls++===0)return Response.json({content:[tool('recherche','before'),tool('projektwissen'),tool('grobauslegung','after')]});
  const results=body.messages.at(-1).content.map(x=>({id:x.tool_use_id,value:JSON.parse(x.content)}));
  assert.match(results.find(x=>x.id==='before').value.error,/nicht freigegeben/);
  assert.match(results.find(x=>x.id==='after').value.error,/nicht freigegeben/);
  assert.ok(results.find(x=>x.id==='projektwissen').value.rules);
  assert.ok(body.tools.some(x=>x.name==='grobauslegung'));
  return Response.json({content:[final('Welche Abmessungen hat Ihr Teil?')]});
 });
 const result=await analyse({message:'Bitte ein Konzept entwickeln.'},env());
 assert.equal(calls,2);assert.equal(result.proposal,null);
 assert.equal(result.answer,'Welche Abmessungen hat Ihr Teil?');
});

test('truncated model output cannot become a tool execution or customer result',async t=>{
 fetchMock(t,async()=>Response.json({stop_reason:'max_tokens',content:[tool('projektwissen'),tool('grobauslegung')]}));
 await assert.rejects(analyse({message:'Eine Fachfrage'},env()),error=>error.message==='model_output_limit'&&error.diagnostic.type==='output_limit');
});

test('a single JSON code fence is accepted without accepting arbitrary prose or a model-invented proposal',async t=>{
 let calls=0;
 fetchMock(t,async()=>Response.json({content:calls++===0?[tool('projektwissen')]:[{type:'text',text:'```json\n'+JSON.stringify({answer:'Bitte bestätigen Sie den Werkstoff.',questions:['Welcher Werkstoff ist vorgesehen?'],proposal:{machines:[{model:'INVENTED'}]},sourceIds:['konzept']})+'\n```'}]}));
 const r=await analyse({message:'Zeichnung prüfen.'},env());assert.equal(calls,2);assert.equal(r.proposal,null);assert.deepEqual(r.questions,['Welcher Werkstoff ist vorgesehen?']);
});

test('closing phase preserves Opus prefix and auto choice, stops repeated knowledge tools, and stays within seven rounds',async t=>{
 let calls=0,prefix;const signed={type:'thinking',thinking:'',signature:'test-signature'};
 fetchMock(t,async(url,request)=>{
  const b=JSON.parse(request.body);calls++;assert.deepEqual(b.tool_choice,{type:'auto'});
  const current=JSON.stringify({system:b.system,tools:b.tools});if(!prefix)prefix=current;assert.equal(current,prefix);
  for(const m of b.messages.filter(m=>m.role==='assistant'))assert.deepEqual(m.content[0],signed);
  if(calls>=6)assert.match(JSON.stringify(b.messages.at(-1)),/Schließe diese Auswertung jetzt ab/);
  if(calls===7){const denied=JSON.parse(b.messages.at(-1).content[0].content);assert.match(denied.error,/Schlussantwort/);assert.equal(denied.materials,undefined);}
  return Response.json({content:[signed,tool('projektwissen','knowledge-'+calls)]});
 });
 const r=await analyse({file:{type:'image/png',bytes:new Uint8Array([137,80,78,71])},pricePolicy:'technical-only'},env(),{maxRounds:7});
 assert.equal(calls,7);assert.equal(r.proposal,null);assert.equal(r.completionReason,'round_limit');assert.ok(r.questions.length);assert.match(r.answer,/noch nicht abgeschlossen/);assert.ok(!r.sources.some(x=>x.id==='engine'));
});

test('closing nudge obtains a targeted question from the drawing without another calculation or research',async t=>{
 let calls=0;
 fetchMock(t,async(url,request)=>{
  const b=JSON.parse(request.body);calls++;
  if(calls<6)return Response.json({content:[tool('projektwissen','knowledge-'+calls)]});
  assert.match(JSON.stringify(b.messages.at(-1)),/höchstens drei konkrete Rückfragen/);
  return Response.json({content:[{type:'text',text:JSON.stringify({answer:'Die Zuordnung der Bundhöhe ist offen.',questions:['Bezieht sich das Höhenmaß auf den Bund oder die gesamte Kopfzone?'],sourceIds:['konzept']})}]});
 });
 const r=await analyse({file:{type:'image/png',bytes:new Uint8Array([137,80,78,71])}},env(),{maxRounds:7});
 assert.equal(calls,6);assert.equal(r.proposal,null);assert.deepEqual(r.questions,['Bezieht sich das Höhenmaß auf den Bund oder die gesamte Kopfzone?']);assert.equal(r.completionReason,undefined);
});

test('a later invalid variant cannot erase the last successfully checked engine calculation',async t=>{
 let calls=0;
 const values={sD:8,sL:30,kD:13,kH:5},input={typ:'bolzen',topology:coaxialDrawingTopology(),material:'C15C',materialEvidence:{origin:'drawing',quote:'C15C',page:1,reference:'Werkstoffangabe'},values,evidence:Object.fromEntries(Object.entries(values).map(([field,value])=>[field,{origin:'drawing',quote:value+' mm',originalValue:value,originalUnit:'mm',page:1,reference:'Maßlinie'}]))};
 fetchMock(t,async(url,request)=>{
  const b=JSON.parse(request.body);calls++;
  if(calls===1)return Response.json({content:[tool('projektwissen')]});
  if(calls===2)return Response.json({content:[{...tool('grobauslegung'),input}]});
  if(calls===3){assert.equal(JSON.parse(b.messages.at(-1).content[0].content).ok,true);return Response.json({content:[{...tool('grobauslegung','bad-variant'),input:{topology:coaxialDrawingTopology()}}]});}
  if(calls===4){const failed=JSON.parse(b.messages.at(-1).content[0].content);assert.equal(failed.ok,false);assert.equal(failed.lastSuccessfulCalculationRetained,true);}
  return Response.json({content:[]});
 });
 const r=await analyse({file:{type:'application/pdf',bytes:new Uint8Array()}},env(),{maxRounds:5});
 assert.equal(calls,5);assert.ok(r.proposal.machines.length);assert.equal(r.proposal.calculation.input.sD,8);assert.equal(r.proposal.calculation.input.sL,30);assert.ok(r.questions.length);assert.ok(r.sources.some(x=>x.id==='engine'));
});

test('safe concrete questions survive rejected private prose without exposing the rejected answer',async t=>{
 let calls=0;
 fetchMock(t,async()=>Response.json({content:calls++===0?[tool('projektwissen')]:[{type:'text',text:JSON.stringify({answer:'Private buyer@example.test must never be shown.',questions:['Welcher Werkstoff ist vorgesehen?'],sourceIds:[]})}]}));
 const r=await analyse({file:{type:'image/png',bytes:new Uint8Array()}},env(),{maxRounds:3});
 assert.equal(r.proposal,null);assert.deepEqual(r.questions,['Welcher Werkstoff ist vorgesehen?']);assert.ok(!JSON.stringify(r).includes('buyer@example'));
});
