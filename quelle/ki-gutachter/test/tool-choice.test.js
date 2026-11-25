import test from 'node:test';
import assert from 'node:assert/strict';
import {analyse} from '../analysis.js';

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
