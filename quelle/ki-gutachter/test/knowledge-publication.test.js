import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_KNOWLEDGE_VERSION,projectPublicKnowledge} from '../knowledge-publication.js';
import {analyse,loadKnowledge,publicResult} from '../analysis.js';
import Engine from '../../engine.js';

// Fictional sentinel data only; no original project details belong in tests.
const PRIVATE='SYNTHETIC_PROJECT_AX';
const rawCards=`## Knowledge cards
- K31 General forging rule.
- K32 ${PRIVATE}: SYNTHETIC_ALLOY at SYNTHETIC_TEMPERATURE.
  Continued confidential layout: SYNTHETIC_LAYOUT.

  - Quoted machine configuration: SYNTHETIC_MACHINE.
- K33 Keep the next general rule.
## Other principles
General source guidance.`;
const fixture=(cards=rawCards)=>({ANTHROPIC_API_KEY:'test-only',SPEICHER:{values:new Map([['regeln','R1 Generic rule.'],['wissenskarten',cards]]),async get(key){return this.values.get(key)??null;}}});
const tool=(material)=>({type:'tool_use',name:'projektwissen',id:'knowledge',input:material?{material}: {}});
const answer=text=>({type:'text',text:JSON.stringify({answer:text,questions:[],sourceIds:['konzept']})});
function mock(t,handler){const previous=globalThis.fetch;globalThis.fetch=handler;t.after(()=>{globalThis.fetch=previous;});}

test('publication replaces the entire multi-line card while preserving adjacent knowledge',()=>{
 const text=projectPublicKnowledge(rawCards);
 assert.match(text,/Titan \(Reintitan\).*700 °C/);
 assert.match(text,/konstruiertes Beispiel/);
 assert.match(text,/weder Materialfreigabe noch Kraftmodell oder belegter Referenzauftrag/);
 assert.doesNotMatch(text,/SYNTHETIC_/);
 for(const line of ['- K31 General forging rule.','- K33 Keep the next general rule.','## Other principles','General source guidance.'])assert.ok(text.includes(line));
 assert.equal(projectPublicKnowledge(text),text,'public projection is idempotent');
 assert.equal(projectPublicKnowledge('K320 is another card.\nC15C remains a material.'),'K320 is another card.\nC15C remains a material.');
});

test('card headings, emphasized keys, table rows, section boundaries and final card are projected',()=>{
 for(const start of ['- **K32**:', '### K32:', '| K32 |', 'K32 ', '* K32 ', '- K32:']){
  const text=projectPublicKnowledge('K31 Previous\n'+start+' '+PRIVATE+'\nmore '+PRIVATE+'\n## Next section\nPreserved');
  assert.doesNotMatch(text,/SYNTHETIC_/);assert.match(text,/Titan/);assert.match(text,/## Next section\nPreserved$/);
 }
 const last=projectPublicKnowledge('K32 '+PRIVATE+'\nextra '+PRIVATE);assert.doesNotMatch(last,/SYNTHETIC_/);
 const fenced=projectPublicKnowledge('K32 '+PRIVATE+'\n```\n## Not a boundary\n'+PRIVATE+'\n```\n'+PRIVATE+'\nK33 Preserved');
 assert.doesNotMatch(fenced,/SYNTHETIC_|Not a boundary/);assert.match(fenced,/K33 Preserved$/);
});

test('main, staged and legacy knowledge paths all enforce the current publication policy',async()=>{
 for(const mode of ['legacy','main','staged']){
  const env=fixture();const options=mode==='staged'?{stageManifest:'konzept:manifest:kvp-v1'}:undefined;
  if(mode!=='legacy'){
   const keys={regeln:'konzept:abc123:regeln',wissenskarten:'konzept:abc123:wissenskarten'};
   env.SPEICHER.values.set(mode==='main'?'konzept:manifest':'konzept:manifest:kvp-v1',JSON.stringify({version:'fixture',keys}));
   env.SPEICHER.values.set(keys.regeln,'R1 Preserved\nK32 '+PRIVATE+'\nK33 Preserved');
   env.SPEICHER.values.set(keys.wissenskarten,rawCards);
  }
  const k=await loadKnowledge(env,options);
  assert.equal(k.publicationVersion,PUBLIC_KNOWLEDGE_VERSION);
  assert.equal(k.status,mode==='legacy'?'legacy':'versioned');
  assert.doesNotMatch(k.rules+k.cards,/SYNTHETIC_/);
  assert.match(k.cards,/Titan.*700 °C/);
  assert.equal(env.SPEICHER.values.get('wissenskarten'),rawCards,'stored private source remains untouched');
 }
});

test('model sees only the projected card while customer text and material properties remain unchanged',async t=>{
 const env=fixture(),message='Mein Teil ist C15C. Bitte den Werkstoff beibehalten.';let calls=0;
 const before=JSON.stringify(Engine.findMaterial('C15C'));
 mock(t,async(_url,request)=>{
  const body=JSON.parse(request.body),customer=JSON.parse(body.messages[0].content[0].text);
  assert.equal(customer.message,message);
  assert.match(body.system,/konstruierte Verfahrensbeispiele, keine belegten Kundenaufträge/);
  if(calls++===0)return Response.json({content:[tool('C15C')]});
  const knowledge=JSON.parse(body.messages.at(-1).content[0].content);
  assert.doesNotMatch(knowledge.rules+knowledge.cards,/SYNTHETIC_/);
  assert.equal(knowledge.selectedMaterial.id,'C15C');
  assert.deepEqual(knowledge.selectedMaterial.flowCurves,Engine.findMaterial('C15C').flowCurves);
  assert.equal(knowledge.publicationVersion,PUBLIC_KNOWLEDGE_VERSION);
  return Response.json({content:[answer('C15C bleibt die Werkstoffvorgabe für Ihr Teil.')]});
 });
 const result=await analyse({message},env);
 assert.equal(result.answer,'C15C bleibt die Werkstoffvorgabe für Ihr Teil.');
 assert.equal(result.knowledgePublicationVersion,PUBLIC_KNOWLEDGE_VERSION);
 assert.equal(publicResult(result).knowledgePublicationVersion,PUBLIC_KNOWLEDGE_VERSION);
 assert.equal(JSON.stringify(Engine.findMaterial('C15C')),before);
});

test('analysis drops stale assistant history and preserves user data and current responses',async t=>{
 const history=[{role:'user',content:'C15C is my material.'},{role:'assistant',content:PRIVATE},{role:'assistant',content:PRIVATE,knowledgePublicationVersion:'obsolete'},{role:'assistant',content:'A current generic answer.',knowledgePublicationVersion:PUBLIC_KNOWLEDGE_VERSION}];
 let calls=0;mock(t,async(_url,request)=>{
  const body=JSON.parse(request.body),customer=JSON.parse(body.messages[0].content[0].text);
  assert.deepEqual(customer.history,[history[0],history[3]]);
  return Response.json({content:calls++===0?[tool()]:[answer('Bitte nennen Sie die Geometrie.')]});
 });
 await analyse({message:'Weiter',history},fixture());assert.equal(history.length,4,'caller history is not mutated');
});

test('internal publication card IDs cannot leave in prose or questions',async t=>{
 let calls=0;mock(t,async()=>Response.json({content:calls++===0?[tool()]:[answer(calls===2?'Das steht in K32.':'Ein konstruiertes Beispiel betrachtet Titan bei 700 °C.')] }));
 const result=await analyse({message:'Geben Sie ein Verfahrensbeispiel.'},fixture());
 assert.equal(calls,3);assert.doesNotMatch(result.answer,/K32/);assert.match(result.answer,/Beispiel/);
});

test('publication and example guidance apply in all five response languages',async t=>{
 const answers={de:'Beispiel: Reintitan bei 700 °C.',it:'Esempio: titanio puro a 700 °C.',sl:'Primer: čisti titan pri 700 °C.',en:'Example: commercially pure titanium at 700 °C.',zh:'示例：700 °C 的工业纯钛。'};
 let language,calls=0;mock(t,async(_url,request)=>{
  const body=JSON.parse(request.body);assert.match(body.system,/konstruierte Verfahrensbeispiele/);
  return Response.json({content:calls++%2===0?[tool()]:[answer(answers[language])]});
 });
 for(language of Object.keys(answers)){
  const result=await analyse({message:'Explain a generic warm forming example.',language},fixture());
  assert.equal(result.answer,answers[language]);assert.equal(result.language,language);assert.equal(result.knowledgePublicationVersion,PUBLIC_KNOWLEDGE_VERSION);
 }
});
