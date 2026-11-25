import test from 'node:test';
import assert from 'node:assert/strict';
import Engine from '../../engine.js';
import machines from '../../maschinen.json' with {type:'json'};
import praxis from '../../praxis.json' with {type:'json'};
import translations from '../i18n-material-choice.json' with {type:'json'};
import worker from '../worker.js';
import {screen,analyse,publicResult} from '../analysis.js';
import {DRAWING_DEFAULTS_VERSION,defaultMaterialChoice,validateMaterialChoice,resolveDrawingMaterial} from '../material-choice.js';
import {prepareDecision,recordDecision} from '../decision-log.js';
import {coaxialDrawingTopology} from './topology-fixture.js';

const drawing={type:'application/pdf',bytes:new TextEncoder().encode('%PDF-1.7 example')};
const context={file:drawing,featureVersion:DRAWING_DEFAULTS_VERSION,language:'de'};
const choice=(grade='C10C')=>{const material=Engine.findMaterial(grade),curve=material.flowCurves.find(row=>row.eligible);return {materialId:material.id,curveId:curve.id,materialState:curve.state,origin:'user_selection'};};
function input(){
 const values={sD:8,sL:30,kD:13,kH:5};
 return {typ:'bolzen',topology:coaxialDrawingTopology(),values,evidence:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{origin:'drawing',page:1,reference:'dimension',quote:value+' mm',originalValue:value,originalUnit:'mm'}]))};
}
function sourcedMaterial(grade='C15C'){
 return {material:grade,materialEvidence:{origin:'drawing',page:1,quote:grade,reference:'material cell'},curveId:Engine.findMaterial(grade)?.flowCurves?.[0]?.id,materialState:'soft-annealed',materialStateEvidence:{origin:'drawing',page:1,reference:'state cell',quote:'weichgeglüht'}};
}
function environment(){
 const map=new Map([['regeln','Stauchgrenzen prüfen.'],['wissenskarten','Kraft und Stadienfolge prüfen.']]),files=new Map(),jobs=[];
 return {SPEICHER:{map,async get(key){return map.get(key)??null;},async put(key,value){map.set(key,value);}},DATEIEN:{async put(key,value){files.set(key,new Uint8Array(value));},async get(key){const bytes=files.get(key);return bytes?{arrayBuffer:async()=>bytes.buffer}:null;}},ANFRAGEN:{async sendBatch(batch){jobs.push(...batch);}},ANTHROPIC_API_KEY:'test',RESEND_API_KEY:'test',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test',ZUGRIFF_SCHLUESSEL:'test-key-more-than-32-characters-long',jobs,files};
}
const tool=(name,input={})=>({type:'tool_use',id:name,name,input});
const final=(answer='JBF-13B5S ist ein geometrischer Anfragekandidat.',extra={})=>({type:'text',text:JSON.stringify({answer,questions:[],sourceIds:[],...extra})});
const reply=(...content)=>Response.json({content});
function mock(t,fn){const old=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=old;});}
async function post(env,{path='/preview',origin='https://jern-yao.de',file=path==='/preview',key='package-one-key-123456',...fields}={}){
 const body=new FormData();body.set('idempotency_key',key);
 if(file)body.set('datei',new File([drawing.bytes],'neutral.pdf',{type:drawing.type}));
 for(const[key,value]of Object.entries(fields))body.set(key,typeof value==='string'?value:JSON.stringify(value));
 const response=await worker.fetch(new Request('https://worker.test'+path,{method:'POST',headers:{Origin:origin},body}),env);
 return {httpStatus:response.status,...await response.json()};
}
const queueMessage=id=>({body:{kind:'preview_analysis',id},attempts:1,ack(){},retry(){throw new Error('unexpected retry');}});
const stored=(env,key)=>JSON.parse(env.SPEICHER.map.get(key)||'null');

test('missing drawing material is assumed and marked; legacy contexts still require material',()=>{
 const result=screen(input(),context);
 assert.equal(result.ok,true);assert.equal(result.proposal.calculation.input.rmPolicy,'rm-v1');
 assert.equal(result.proposal.calculation.materialStatus.flow,'ready');assert.ok(result.proposal.stages.some(stage=>stage.force_t>0));
 const entry=result.proposal.input.find(row=>row.field==='material');
 assert.equal(entry.value,'C4C');assert.equal(entry.origin,'assumption');assert.equal(entry.assumption,true);assert.ok(entry.reason);
 assert.equal(result.proposal.calculation.materialEvidence.origin,'assumption');assert.match(result.proposal.assumptions[0],/Werkstoffannahme C4C weichgeglüht/);
 assert.ok(result.proposal.machines.length);assert.equal(screen(input(),{file:drawing}).ok,false);
});

test('explicit material assumptions require a reason and cannot invent another default grade',()=>{
 for(const extra of [{material:'C4C',materialEvidence:{origin:'assumption',reference:'default'}},{material:'C15C',materialEvidence:{origin:'assumption',reference:'default',reason:'use another grade'}}])assert.equal(screen({...input(),...extra},context).ok,false);
 const result=screen({...input(),material:'C4C',materialEvidence:{origin:'assumption',reference:'private file',reason:'secret@example.test'}},context);
 assert.equal(result.ok,true);assert.ok(!JSON.stringify(result).includes('secret@example'));assert.ok(!JSON.stringify(result).includes('private file'));
});

test('verified drawing material wins over customer selection and remains the calculation source',()=>{
 const result=screen({...input(),...sourcedMaterial()}, {...context,materialChoice:choice()});
 assert.equal(result.ok,true);assert.equal(result.materialContext.materialId,'C15C');assert.equal(result.materialContext.origin,'drawing');assert.ok(result.materialContext.conflict);
 assert.equal(result.proposal.calculation.input.wst,Engine.WERKSTOFFE.indexOf(Engine.findMaterial('C15C')));
 assert.equal(result.proposal.input[0].origin,'drawing');assert.ok(!result.proposal.assumptions.some(text=>text.includes('Werkstoffannahme C4C')));
 const unsupported=screen({...input(),...sourcedMaterial('C35')},{...context,materialChoice:choice()});
 assert.equal(unsupported.ok,false);assert.equal(unsupported.materialContext.materialId,'C35');assert.ok(!unsupported.questions.some(text=>text.includes('C4C')));
});

test('structured selection uses approved identity and state and cannot be fabricated by the model',()=>{
 const result=screen(input(),{...context,materialChoice:choice()});
 assert.equal(result.ok,true);assert.equal(result.proposal.input[0].origin,'user_selection');assert.equal(result.proposal.calculation.materialStatus.flow,'ready');
 assert.equal(result.proposal.input.find(row=>row.field==='materialState').origin,'user_selection');
 assert.throws(()=>validateMaterialChoice({...choice(),curveId:defaultMaterialChoice().curveId}));
 assert.throws(()=>validateMaterialChoice({...choice(),materialId:'C35'}));
 const forged={...input(),material:'C10C',materialEvidence:{origin:'user_selection',quote:'C10C',reference:'model'}};
 assert.equal(screen(forged,context).ok,false);
 const sameGrade={material:'C10C',materialEvidence:{origin:'drawing',page:1,reference:'material',quote:'C10C'}};
 const mixed=screen({...input(),...sameGrade},{...context,materialChoice:choice()});
 assert.equal(mixed.ok,true);assert.equal(mixed.materialContext.origin,'drawing');assert.equal(mixed.materialContext.stateOrigin,'user_selection');assert.equal(mixed.proposal.calculation.materialStatus.flow,'ready');
});

test('an assumed grade does not erase an explicit cold-drawn or heat-treated supply state',()=>{
 for(const extra of [{note:'Material unbekannt, kaltgezogen.'},{note:'Material unbekannt, vergütet.'}]){
  const result=screen(input(),{...context,...extra});assert.equal(result.ok,true);assert.equal(result.materialContext.materialState,'unknown');assert.ok(result.proposal.stages.every(stage=>stage.force_t===null));assert.ok(!result.materialContext.notice.includes('C4C weichgeglüht'));
 }
 const result=screen({...input(),materialState:'cold-drawn',materialStateEvidence:{origin:'drawing',page:1,quote:'cold-drawn',reference:'state'}},context);
 assert.equal(result.ok,true);assert.equal(result.materialContext.materialState,'cold-drawn');assert.ok(result.proposal.stages.every(stage=>stage.force_t===null));
});

test('an annealed C10C dropdown choice cannot overwrite conflicting text or a sourced drawing state',()=>{
 for(const note of ['C10C kaltgezogen','C10C cold-drawn','C10C trafilato','C10C hladno vlečen','C10C 冷拉']){
  const result=screen(input(),{...context,materialChoice:choice(),note});
  assert.equal(result.ok,true);assert.equal(result.materialContext.materialId,'C10C');assert.equal(result.materialContext.materialState,'unknown');assert.equal(result.materialContext.curveId,null);assert.ok(result.materialContext.conflict);
  assert.equal(result.proposal.calculation.input.materialState,'unknown');assert.equal(result.proposal.calculation.input.curveId,'');assert.ok(result.proposal.stages.every(stage=>stage.force_t===null));
 }
 for(const origin of ['drawing','user_text']){
  const evidence={origin,page:origin==='drawing'?1:undefined,quote:'C10C kaltgezogen',reference:'Lieferzustand'};
  const result=screen({...input(),materialState:'cold-drawn',materialStateEvidence:evidence},{...context,materialChoice:choice(),note:origin==='user_text'?evidence.quote:''});
  assert.equal(result.ok,true);assert.equal(result.materialContext.materialState,'cold-drawn');assert.equal(result.materialContext.stateOrigin,origin);assert.equal(result.materialContext.curveId,null);assert.ok(result.proposal.stages.every(stage=>stage.force_t===null));
 }
 for(const[grade,note]of [['20MnB4','20MnB4 weichgeglüht'],['AISI 1010','AISI 1010 weichgeglüht']]){
  const result=screen(input(),{...context,materialChoice:choice(grade),note});
  assert.equal(result.ok,true);assert.equal(result.materialContext.materialState,'unknown');assert.equal(result.materialContext.curveId,null);assert.ok(result.proposal.stages.every(stage=>stage.force_t===null));
 }
});

test('subsequent numerical results retain a drawing state observed before the grade was supplied',async t=>{
 let calls=0;
 const stateEvidence={origin:'drawing',page:1,reference:'Lieferzustand',quote:'kaltgezogen'};
 mock(t,async()=>++calls===1?reply(tool('projektwissen',{materialState:'cold-drawn',materialStateEvidence:stateEvidence})):calls===2?reply(tool('grobauslegung',input())):reply(final()));
 const result=await analyse({...context,materialChoice:choice()},environment());
 assert.equal(result.materialContext.materialState,'cold-drawn');assert.equal(result.materialContext.stateOrigin,'drawing');assert.equal(result.materialContext.curveId,null);assert.ok(result.proposal.stages.every(stage=>stage.force_t===null));assert.notEqual(result.proposal.calculation.materialStatus.flow,'ready');
});

test('a qualitative answer also exposes a state conflict without an annealed curve',async t=>{
 let calls=0;mock(t,async()=>++calls===1?reply(tool('projektwissen')):reply(final()));
 const result=await analyse({...context,materialChoice:choice(),note:'C10C kaltgezogen'},environment());
 assert.equal(result.proposal.calculation,null);assert.equal(result.materialContext.materialState,'unknown');assert.equal(result.materialContext.curveId,null);assert.ok(result.materialContext.conflict);assert.ok(result.questions.includes(result.materialContext.conflict));
});

test('explicit user grade and retained drawing evidence cannot become a default substitute',()=>{
 const result=screen(input(),{...context,note:'Werkstoff C35 ist vorgesehen.'});
 assert.equal(result.ok,false);assert.equal(result.materialContext,undefined);assert.ok(result.questions.some(question=>question.includes('C35')));
 const negated=screen(input(),{...context,note:'C4C darf nicht verwendet werden.'});assert.equal(negated.ok,false);assert.equal(negated.materialContext,undefined);
 const retained=resolveDrawingMaterial({material:'C4C',materialEvidence:{origin:'assumption',reason:'missing'}},{...context,drawingMaterial:sourcedMaterial()});
 assert.equal(retained.materialContext.materialId,'C15C');assert.equal(retained.materialContext.origin,'drawing');
 assert.equal(resolveDrawingMaterial({material:'secret@example.test',materialEvidence:{origin:'drawing',page:1,quote:'secret@example.test'}},context).materialContext,undefined);
});

test('a different text grade blocks automatic dropdown substitution without fabricating affirmative evidence',()=>{
 for(const note of ['42CrMo4','C80','C80 ist ausgeschlossen.','42CrMo4 im Vergleich zu C4C.']){
  const resolution=resolveDrawingMaterial({}, {...context,materialChoice:choice('C4C'),note});
  assert.equal(resolution.materialContext,undefined);assert.notEqual(resolution.input.material,'C4C');assert.equal(resolution.input.materialEvidence,undefined);assert.equal(resolution.input.curveId,'');
  const result=screen(input(),{...context,materialChoice:choice('C4C'),note});assert.equal(result.ok,false);assert.equal(result.proposal,null);assert.equal(result.materialContext,undefined);
 }
 for(const note of ['C4C weichgeglüht','Werkstoff 1.0303']){
  const result=screen(input(),{...context,materialChoice:choice('C4C'),note});assert.equal(result.ok,true);assert.equal(result.materialContext.materialId,'C4C');assert.equal(result.materialContext.origin,'user_selection');assert.equal(result.proposal.calculation.materialStatus.flow,'ready');
 }
});

test('qualitative candidates remain possible without adopting a dropdown grade that conflicts with text',async t=>{
 let calls=0;mock(t,async()=>++calls%2===1?reply(tool('projektwissen')):reply(final()));
 for(const note of ['42CrMo4','C80','C80 ist ausgeschlossen.']){
  const result=await analyse({...context,materialChoice:choice('C4C'),note},environment());
  assert.ok(result.proposal.machines.length);assert.equal(result.proposal.calculation,null);assert.equal(result.materialContext,undefined);assert.ok(!result.proposal.input.some(row=>row.field==='material'));assert.ok(!result.sources.some(source=>source.id.startsWith('material:')));assert.ok(!result.answer.includes('Werkstoffannahme C4C'));
 }
});

test('first qualitative answer has real candidates and a visible material assumption in all five languages',async t=>{
 let round=0;
 mock(t,async(url,request)=>{
  const body=JSON.parse(request.body);
  assert.match(body.system,/Stauchdraht will geglüht sein/);assert.match(body.system,/mindestens einen alternativen Stadienweg/);assert.match(body.system,/20MnB4-Kurve/);
  if(round++%2===0)return reply(tool('projektwissen'));
  const knowledge=JSON.parse(body.messages.at(-1).content[0].content);
  assert.equal(knowledge.selectedMaterial.id,'C4C');assert.equal(knowledge.materialContext.origin,'assumption');
  return reply(final());
 });
 for(const language of ['de','it','sl','en','zh']){
  const result=await analyse({...context,language,note:'Drahtschnitt 8 mm, geometrisches Konzept fünf Stationen.'},environment());
  assert.ok(result.proposal.machines.length);assert.equal(result.proposal.calculation,null);assert.equal(result.materialContext.origin,'assumption');
  assert.equal(result.proposal.input[0].origin,'assumption');assert.ok(result.answer.includes(result.materialContext.notice));assert.ok(result.sources.some(source=>source.id==='material:assumption'&&source.assumption));assert.ok(!result.sources.some(source=>source.id==='engine'));
  if(language!=='de')assert.ok(!result.materialContext.notice.startsWith('Werkstoffannahme'));
  const restricted=publicResult(result,{pricePolicy:'technical-only'});assert.equal(restricted.materialContext.origin,'assumption');assert.ok(!('priceEUR' in restricted.proposal.machines[0]));
 }
});

test('a material-only first draft is prompted once for an immediate machine preselection',async t=>{
 let calls=0;mock(t,async()=>++calls===1?reply(tool('projektwissen')):calls===2?reply(final('Der Werkstoff fehlt.',{questions:['Welcher Werkstoff?']})):reply(final()));
 const result=await analyse(context,environment());assert.equal(calls,3);assert.ok(result.proposal.machines.length);assert.ok(result.questions.length<=3);
});

test('a later verified material or state cannot retain forces from an earlier assumption',async t=>{
 let calls=0;
 mock(t,async()=>++calls===1?reply(tool('projektwissen')):calls===2?reply(tool('grobauslegung',input())):reply(final(undefined,{materialAssessment:{material:'C4C',materialEvidence:{origin:'drawing',page:1,reference:'material',quote:'C4C'},materialState:'cold-drawn',materialStateEvidence:{origin:'drawing',page:1,reference:'state',quote:'cold-drawn'}}})));
 const result=await analyse(context,environment());assert.equal(result.materialContext.origin,'drawing');assert.equal(result.materialContext.materialState,'cold-drawn');assert.equal(result.proposal.calculation,null);assert.ok(!result.sources.some(source=>source.id==='engine'));
});

test('preview stores the material selection and feature gate; changes require a new repeat key',async()=>{
 const env=environment(),first=await post(env,{materialChoice:choice()});assert.equal(first.httpStatus,202);
 const record=stored(env,'anfrage:'+first.id);assert.equal(record.featureVersion,DRAWING_DEFAULTS_VERSION);assert.deepEqual(record.materialChoice,choice());
 assert.equal((await post(env,{materialChoice:choice()})).id,first.id);assert.equal((await post(env,{materialChoice:choice('C15C')})).httpStatus,409);
 assert.equal((await post(environment(),{materialChoice:{...choice(),curveId:'fake'}})).httpStatus,400);
 for(const origin of ['https://jernyao.de','https://www.jernyao.de']){
  const legacy=environment(),r=await post(legacy,{origin,materialChoice:choice(),featureVersion:DRAWING_DEFAULTS_VERSION});
  assert.equal(r.httpStatus,202);const record=stored(legacy,'anfrage:'+r.id);assert.equal(record.featureVersion,undefined);assert.equal(record.materialChoice,undefined);
 }
});

test('queue and linked chat preserve selected material, while main-site previews retain legacy behaviour',async t=>{
 let calls=0;mock(t,async(url,request)=>{const body=JSON.parse(request.body);if(calls++%2===0)return reply(tool('projektwissen'));return reply(final());});
 const env=environment(),r=await post(env,{materialChoice:choice()});await worker.queue({messages:[queueMessage(r.id)]},env);
 const result=stored(env,'analyse:'+r.id).result;assert.equal(result.materialContext.materialId,'C10C');assert.equal(result.materialContext.origin,'user_selection');
 const response=await worker.fetch(new Request('https://worker.test/chat',{method:'POST',headers:{Origin:'https://jernyao.de'},body:JSON.stringify({requestId:r.id,token:r.token,message:'Bitte weiter prüfen.'})}),env);
 assert.equal(response.status,200);assert.equal((await response.json()).materialContext.materialId,'C10C');
 const old=environment(),legacy=await post(old,{origin:'https://jernyao.de'});await worker.queue({messages:[queueMessage(legacy.id)]},old);assert.equal(stored(old,'analyse:'+legacy.id).result.materialContext,undefined);
});

function decisionBody(){
 const selected=choice('C4C'),material=Engine.findMaterial(selected.materialId);
 const input={typ:'bolzen',wst:Engine.WERKSTOFFE.indexOf(material),curveId:selected.curveId,materialState:selected.materialState,rmPolicy:'rm-v1',d0:8,sD:8,sL:30,kD:13,kH:5,kopfForm:'rund',iTyp:'none',standardKind:'screw',threadFamily:'metric',vorgaben:{},soll:{}};
 const a=Engine.auslegen(input),found=Engine.waehle(machines,a,input,praxis),rows=[...found.passend,...found.bedingt,...found.fast].slice(0,3);
 return {kind:'manual',input,candidates:rows.map((row,index)=>({model:row.o.m,status:'forged-approval',rank:index+1})),selectedModel:rows[0].o.m};
}

test('pending manual decision recomputes status and stores only anonymous technical fields',async()=>{
 const body=decisionBody();body.customer='secret@example.test';body.input.customer='Private company';body.input.originMeta={source:'C:\\private\\drawing.pdf'};body.candidates[0].reason='private free text';body.input.calculation={force:1};
 const decision=prepareDecision(JSON.stringify(body));assert.ok(decision);assert.equal(decision.status,'ungeprueft');assert.equal(decision.knowledgeEligible,false);assert.equal(decision.offeredByHans,null);assert.equal(decision.approval,null);assert.equal(decision.customerSelectedModel,body.selectedModel);
 assert.notEqual(decision.candidates[0].status,'forged-approval');assert.ok(decision.calculation.values.L0>0);
 const text=JSON.stringify(decision);for(const secret of ['secret@','Private company','private','originMeta','calculation":{"force'])assert.ok(!text.includes(secret),secret);
 const env=environment();let writeOptions='not-called';const save=env.SPEICHER.put;env.SPEICHER.put=async(key,value,options)=>{writeOptions=options;await save(key,value);};
 await recordDecision(env,decision);assert.equal(writeOptions,undefined,'anonymous KVP records have no automatic expiration');const entries=[...env.SPEICHER.map].filter(([key])=>key.startsWith('entscheidung:'));assert.equal(entries.length,1);
 const storedRecord=JSON.parse(entries[0][1]);assert.match(storedRecord.dataVersion.catalogSha256,/^[a-f0-9]{64}$/);assert.equal(storedRecord.dataVersion.rmPolicy,'rm-v1');assert.equal(storedRecord.outcome.status,'nur_konzept');
});

test('drawings, invalid models, invalid numerical inputs and non-manual concepts never enter decision cases',()=>{
 const body=decisionBody();assert.equal(prepareDecision(JSON.stringify(body),{hasFile:true}),null);
 for(const changed of [{...body,kind:'drawing'},{...body,selectedModel:'JBF-999B9S'},{...body,candidates:[{model:'JBF-999B9S',rank:1}]},{...body,input:{...body.input,sD:'8'}},{...body,input:{...body.input,curveId:'fake'}},{...body,input:{...body.input,typ:'formteil'}},{...body,input:{...body.input,vorgaben:{zusatz:100000}}}])assert.equal(prepareDecision(JSON.stringify(changed)),null);
});

test('only a new manual hyphen-site enquiry records a decision; replay, main origin and attachments do not',async()=>{
 const body=decisionBody(),env=environment(),fields={path:'/anfrage',file:false,email:'buyer@example.test',notiz:'Manual enquiry',consent:'true',decisionContext:body};
 const result=await post(env,fields);assert.equal(result.httpStatus,202);assert.equal([...env.SPEICHER.map.keys()].filter(key=>key.startsWith('entscheidung:')).length,1);
 assert.equal((await post(env,fields)).id,result.id);assert.equal([...env.SPEICHER.map.keys()].filter(key=>key.startsWith('entscheidung:')).length,1);
 assert.equal(stored(env,'anfrage:'+result.id).decisionContext,undefined);assert.ok(!JSON.stringify(result).includes('entscheidung'));
 for(const extra of [{origin:'https://jernyao.de'},{file:true}]){const other=environment();assert.equal((await post(other,{...fields,...extra})).httpStatus,202);assert.equal([...other.SPEICHER.map.keys()].filter(key=>key.startsWith('entscheidung:')).length,0);}
});

test('all new visible material messages have the four required translations',()=>{
 for(const[key,values]of Object.entries(translations)){assert.ok(key);assert.equal(values.length,4);for(const value of values)assert.ok(typeof value==='string'&&value.trim());}
});
