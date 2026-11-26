import test from 'node:test';
import assert from 'node:assert/strict';
import {analyse,recordServiceDiagnostic} from '../analysis.js';
import Chain from '../../axial-chain.js';
import steppedPin from '../../vorlagen/stufenbolzen.json' with {type:'json'};

const geometrySpec=Chain.project(Chain.fromTemplate(steppedPin)).spec;
const geometryProcess={material:'C10C',d0:6};
function environment(){
 const map=new Map();
 for(const [manifest,version,sha]of [['konzept:manifest','main','aaaa'],['konzept:manifest:kvp-v1','testfield','bbbb']]){
  const keys={regeln:`konzept:${sha}:regeln`,wissenskarten:`konzept:${sha}:wissenskarten`};
  map.set(manifest,JSON.stringify({version,keys}));map.set(keys.regeln,version+' Fachregeln');map.set(keys.wissenskarten,version+' Normalien');
 }
 return {SPEICHER:{async get(k){return map.get(k)??null;},async put(k,v){map.set(k,v);}},ANTHROPIC_API_KEY:'mock'};
}
const tool=()=>Response.json({content:[{type:'tool_use',id:'knowledge',name:'projektwissen',input:{}}]});
const final=()=>Response.json({content:[{type:'text',text:JSON.stringify({answer:'Stufen vorformen, Körner und Halbhohlende ausarbeiten. JBP-13B5S ist ein qualitativer Anfragekandidat.',questions:[],sourceIds:['konzept','structured_geometry']})}]});
function fetchMock(t,fn){const old=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=old;});}

test('testfield stepped-pin geometry gets completion budget and current knowledge without a drawing material assumption',async t=>{
 let round=0,signal;
 fetchMock(t,async(_url,request)=>{
  const body=JSON.parse(request.body),customer=JSON.parse(body.messages[0].content[0].text);
  assert.equal(body.max_tokens,16000);assert.match(body.system,/höchstens drei begründete Maschinenkandidaten/);assert.match(body.system,/höchstens 9000 Zeichen/);
  assert.ok(!body.system.includes('Aktivierte Zeichnungsvorbelegung:'));assert.equal(customer.drawingMaterialPolicy,undefined);
  assert.equal(customer.structuredGeometry.process.material,'C10C');assert.equal(customer.structuredGeometry.spec.elements.length,9);
  assert.ok(Math.abs(customer.structuredGeometry.analysis.volumeMm3-1293.885631186845)<1e-7);
  if(round++===0){signal=request.signal;return tool();}
  assert.equal(request.signal,signal);const knowledge=JSON.parse(body.messages.at(-1).content[0].content);
  assert.equal(knowledge.version,'testfield');assert.equal(knowledge.cards,'testfield Normalien');return final();
 });
 const result=await analyse({geometrySpec,geometryProcess,packageSix:true},environment());
 assert.equal(round,2);assert.equal(result.geometry.origin,'structured_geometry');assert.ok(result.proposal.machines.length>0);
 assert.equal(result.materialContext,undefined,'completion policy must not invent drawing provenance or a replacement material');
});

test('legacy and nonboolean flags keep their geometry budget and knowledge unchanged',async t=>{
 let round=0;
 fetchMock(t,async(_url,request)=>{
  const body=JSON.parse(request.body);assert.equal(body.max_tokens,6000);assert.ok(!body.system.includes('Abschlussumfang:'));
  if(round++%2===0)return tool();
  assert.equal(JSON.parse(body.messages.at(-1).content[0].content).version,'main');return final();
 });
 for(const packageSix of [undefined,false,'true'])await analyse({geometrySpec,geometryProcess,packageSix},environment());
 assert.equal(round,6);
});

test('testfield geometry and chat reserve the final minute without changing signed prefixes or the overall deadline',async t=>{
 const originalNow=Date.now;let now=originalNow(),round=0,prefix,signal;
 Date.now=()=>now;t.after(()=>{Date.now=originalNow;});
 fetchMock(t,async(_url,request)=>{
  const body=JSON.parse(request.body);assert.equal(body.max_tokens,16000);
  if(round++===0){prefix={system:body.system,tools:body.tools};signal=request.signal;now+=190000;return tool();}
  assert.equal(request.signal,signal);assert.equal(body.system,prefix.system);assert.deepEqual(body.tools,prefix.tools);
  assert.match(JSON.stringify(body.messages.at(-1)),/Die verbleibende Laufzeit für die vollständige Schlussantwort nutzen/);return final();
 });
 for(const data of [{geometrySpec,geometryProcess},{message:'Bitte einen Stadienweg nennen.'}]){
  now=originalNow();round=0;await analyse({...data,packageSix:true},environment(),{timeoutMs:240000,maxRounds:7});assert.equal(round,2);
 }
});

test('the larger testfield budget never accepts truncated tool calls or final JSON as a result',async t=>{
 let phase='tool';
 fetchMock(t,async(_url,request)=>{
  assert.equal(JSON.parse(request.body).max_tokens,16000);
  const response=await(phase==='tool'?tool():final()).json();return Response.json({...response,stop_reason:'max_tokens'});
 });
 for(phase of ['tool','final'])await assert.rejects(analyse({geometrySpec,geometryProcess,packageSix:true},environment()),error=>error.message==='model_output_limit');
});

test('sanitized diagnostics are returned even without diagnostic storage and after write failure',async()=>{
 for(const env of [{},{SPEICHER:{async put(){throw Error('PRIVATE_STORAGE_ERROR');}}}]){
  const event=await recordServiceDiagnostic(env,new Error('PRIVATE_CUSTOMER_INPUT'),'queue');
  assert.equal(event.code,'service_failure');assert.ok(Number.isFinite(Date.parse(event.timestamp)));assert.ok(!JSON.stringify(event).includes('PRIVATE_'));
 }
});
