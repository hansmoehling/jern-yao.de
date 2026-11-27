import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import Engine from '../../engine.js';
import machines from '../../maschinen.json' with {type:'json'};
import praxis from '../../praxis.json' with {type:'json'};
import worker from '../worker.js';
import {prepareDecision,recordDecision} from '../decision-log.js';

const require=createRequire(import.meta.url),N=require('../../normen/library.js'),R=require('../../normen/resolver.js'),W=require('../../vorbelegung/draht.js');
const policies={machinePolicy:'ranking-v2',forcePolicy:'force-v2',rmPolicy:'rm-v2',shaftPolicy:'shaft-v2'};
const version={version:'manual-v2'};
function materialInput(grade='C10C'){
 const material=Engine.findMaterial(grade),curve=material.flowCurves.find(row=>row.eligible);
 return {wst:Engine.WERKSTOFFE.indexOf(material),curveId:curve.id,materialState:curve.state};
}
function normInput(id,groesse,laenge,grade){
 const data={...require('../../normen/index.json'),families:[require('../../normen/'+id+'.json')],threads:require('../../normen/gewinde.json')};
 const document=R.resolveStandard(data,{id,groesse,laenge,festigkeitsklasse:'8.8'},{},{shaftPolicy:'shaft-v2',lengthOrigin:'customer'});
 const input={...N.adapt(data,document),typ:'bolzen',...materialInput(grade),...policies,vorgaben:{},soll:{}};
 input.d0=W.candidates(input,null,machines)[0].value;
 return input;
}
function simpleInput(){return {typ:'bolzen',...materialInput('C4C'),d0:8,sD:8,sL:30,kD:13,kH:5,kopfForm:'rund',iTyp:'none',standardKind:'screw',threadFamily:'metric',vorgaben:{},soll:{}};}
function bodyFor(input){
 const calculation=Engine.auslegen(input);assert.deepEqual(calculation.fehlt,[]);
 const found=Engine.waehle(machines,calculation,input,praxis),ranked=[...found.passend,...found.bedingt,...found.fast];
 assert.ok(ranked.length,'the real fixture must have enquiry candidates');
 return {kind:'manual',input,candidates:ranked.slice(0,3).map((row,index)=>({model:row.o.m,rank:index+1,status:'client-approved'})),selectedModel:ranked[0].o.m};
}
function prepare(body,options=version){return prepareDecision(JSON.stringify(body),options);}
function restored(decision){return {...decision.input,wst:Engine.WERKSTOFFE.indexOf(Engine.findMaterial(decision.material.id))};}
function checkParity(input,decision){
 assert.ok(decision);
 const before=Engine.auslegen(input),after=Engine.auslegen(restored(decision));
 assert.deepEqual(after.fehlt,[]);assert.deepEqual(after.geometry,before.geometry);assert.deepEqual(after.werte,before.werte);assert.deepEqual(after.stufen,before.stufen);
 assert.equal(decision.calculation.stages,before.stufen.length);
 for(const field of ['d0','L0','stationen','V','Fmax_t','Fsum_t'])assert.equal(decision.calculation.values[field],Number.isFinite(before.werte[field])?before.werte[field]:undefined,field);
 const found=Engine.waehle(machines,before,input,praxis),ranked=[...found.passend,...found.bedingt,...found.fast];
 for(const candidate of decision.candidates){const index=ranked.findIndex(row=>row.o.m===candidate.model),row=ranked[index];assert.equal(candidate.rankCalculated,index+1);assert.equal(candidate.status,row.gesamt);assert.equal(candidate.features.utilization,Number.isFinite(row.ausl)?row.ausl:null);}
 return after;
}
function environment(){
 const map=new Map(),jobs=[];
 return {SPEICHER:{map,async get(key){return map.get(key)??null;},async put(key,value){map.set(key,value);}},DATEIEN:{async put(){throw new Error('No uploads expected');}},ANFRAGEN:{async sendBatch(batch){jobs.push(...batch);}},ANTHROPIC_API_KEY:'test',RESEND_API_KEY:'test',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test',ZUGRIFF_SCHLUESSEL:'test-key-more-than-32-characters-long',jobs};
}
const savedDecisions=env=>[...env.SPEICHER.map].filter(([key])=>key.startsWith('entscheidung:')).map(([,value])=>JSON.parse(value));
async function post(env,body,origin){
 const form=new FormData();
 for(const[key,value]of Object.entries({email:'private-buyer@example.test',notiz:'Private project description',consent:'true',idempotency_key:'manual-version-test-12345',decisionContext:JSON.stringify(body),version:'manual-v2',...policies}))form.set(key,value);
 const response=await worker.fetch(new Request('https://worker.test/anfrage',{method:'POST',headers:{Origin:origin},body:form}),env);
 return {httpStatus:response.status,...await response.json()};
}

test('manual-v2 preserves the real K16 ISO4014 M12x80 blank, every stage force and machine ranking',()=>{
 const input=normInput('ISO4014','M12',80,'20MnB4'),before=structuredClone(input),decision=prepare(bodyFor(input));
 assert.deepEqual(input.shaftSegments,[{diameter:12,length:50},{diameter:10.75,length:30}]);assert.equal(input.d0,12);
 const calculated=checkParity(input,decision);assert.deepEqual(input,before);
 assert.equal(decision.input.ds,12);assert.equal(decision.input.b,30);assert.equal(decision.input.shaftType,'partial');assert.deepEqual(decision.input.threadModel,{d:12});
 assert.ok(calculated.stufen.some(stage=>stage.segmentIndex===1&&stage.segment.diameter===10.75));
 assert.ok(calculated.werte.Fmax_t>0);assert.ok(calculated.werte.Fsum_t>calculated.werte.Fmax_t);
 const flattened=Engine.auslegen({...restored(decision),shaftSegments:undefined});assert.notEqual(flattened.werte.V,calculated.werte.V,'the fixture detects dropping the plain shaft');
});

test('manual-v2 retains a DIN6791 semi-tubular rivet with its die-side 120-degree blind hole',()=>{
 const input=normInput('DIN6791','4',12,'C10C'),decision=prepare(bodyFor(input)),calculated=checkParity(input,decision);
 assert.equal(decision.input.standardKind,'rivet');assert.equal(decision.input.threadFamily,'none');assert.equal(decision.input.schaftende,'halbhohl');
 assert.equal(decision.input.d_b,2.7);assert.equal(decision.input.t_b,4);assert.equal(decision.input.bottomAngle,120);assert.equal(decision.input.boreDepthMode,'total');
 assert.equal(calculated.geometry.shaftEnd.bottom,'cone');assert.ok(calculated.stufen.some(stage=>stage.v.includes('Bohrung am Schaftende')));
 assert.ok(!calculated.stufen.some(stage=>stage.v.includes('Innenantrieb')));assert.ok(calculated.werte.Fmax_t>0);
});

test('manual-v2 preserves the explicit head type and a pressed tip derived from its actual angle',()=>{
 const input={...simpleInput(),...policies,standardKind:'pin',threadFamily:'none',d0:4,sD:4,sL:12,kD:7,kH:2.4,kopfTyp:'kugelabschnitt',schaftende:'spitze',endDiameter:1,tipAngle:120};
 const decision=prepare(bodyFor(input)),calculated=checkParity(input,decision);
 assert.equal(decision.input.kopfTyp,'kugelabschnitt');assert.equal(decision.input.tipAngle,120);assert.equal(calculated.geometry.headType,'kugelabschnitt');
 assert.ok(Math.abs(calculated.geometry.tip.length-3/(2*Math.tan(Math.PI/3)))<1e-10);
});

test('manual-v2 does not replace an explicit normative delivery condition with the default band',()=>{
 const input={...simpleInput(),...materialInput('34CrMo4'),...policies,d0:6.4,sD:6,sL:20,kD:10,kH:4,rmDeliveryCondition:'+AC+C+AC'};
 const decision=prepare(bodyFor(input));checkParity(input,decision);assert.equal(decision.input.rmDeliveryCondition,'+AC+C+AC');
 const selected=Engine.rmVorbelegung(restored(decision)),assumed=Engine.rmVorbelegung({...input,rmDeliveryCondition:undefined});
 assert.equal(selected.conditionBasis,'selected-delivery-condition');assert.equal(selected.band.max,580);assert.equal(assumed.band.max,600);
 assert.equal(prepare({...bodyFor(input),input:{...input,rmDeliveryCondition:'private delivery text'}}),null);
});

test('manual-v2 retains the square-nut model and fine-pitch hole instead of the legacy hexagonal fallback',()=>{
 const base={typ:'mutter',...materialInput('C10C'),...policies,nutModelVersion:'nut-model-v1',d0:8,mM:6,mSW:10,mH:5.2,mLoch:5.04,nutShape:'square',vorgaben:{},soll:{}};
 const square=prepare(bodyFor(base)),squareResult=checkParity(base,square);
 assert.equal(square.input.nutModelVersion,'nut-model-v1');assert.equal(squareResult.nutGeometry.outerArea,100);
 const old=Engine.auslegen({...base,nutModelVersion:undefined});assert.notEqual(squareResult.werte.V,old.werte.V,'fixture detects losing square area');
 const fine={...base,d0:12,mM:10,mSW:16,mH:8.4,mLoch:undefined,threadPitch:1,nutShape:'hex'},decision=prepare(bodyFor(fine)),result=checkParity(fine,decision);
 assert.equal(decision.input.threadPitch,1);assert.equal(result.nutGeometry.thread.pitch,1);
 assert.notEqual(result.nutGeometry.holeDiameter,Engine.auslegen({...fine,threadPitch:undefined}).nutGeometry.holeDiameter,'fixture detects falling back to coarse pitch');
 const body=bodyFor(base);assert.equal(prepare({...body,input:{...base,nutShape:'cap'}}),null,'an open cap contour is not logged as an ordinary through-hole nut');
 assert.equal(prepare({...body,input:{...base,threadPitch:'1'}}),null);assert.equal(prepare({...body,input:{...base,nutModelVersion:'client-model'}}),null);
});

test('invalid or incomplete shaft geometry cannot be logged as a complete manual calculation',()=>{
 const body=bodyFor(normInput('ISO4014','M12',80,'20MnB4'));
 const invalid=[null,[],{},[{diameter:12,length:0}],[{diameter:0,length:80}],[{diameter:12,length:-1}],[{diameter:'12',length:80}],[{diameter:12}],[null],[{diameter:12,length:79}],Array.from({length:33},()=>({diameter:12,length:80/33}))];
 for(const shaftSegments of invalid)assert.equal(prepare({...body,input:{...body.input,shaftSegments}}),null,JSON.stringify(shaftSegments));
 assert.equal(prepare({...body,input:{...body.input,normRequiresGeometryReview:true}}),null);
 assert.equal(prepare(body,{...version,hasFile:true}),null);
});

test('policy selection is trusted configuration; client version and policy fields cannot enable or disable it',()=>{
 const body=bodyFor(simpleInput());body.version='manual-v2';Object.assign(body.input,policies);
 const legacy=prepare(body,{});assert.ok(legacy);assert.equal(legacy.input.rmPolicy,'rm-v1');assert.equal(legacy.calculation.version,undefined);
 for(const key of ['machinePolicy','forcePolicy','shaftPolicy'])assert.equal(legacy.input[key],undefined);
 for(const key of Object.keys(policies))body.input[key]='client-policy';
 const revised=prepare(body);assert.ok(revised);for(const[key,value]of Object.entries(policies)){assert.equal(revised.input[key],value);assert.equal(revised.calculation[key],value);}
 assert.equal(prepare(body,{version:'client-version'}).calculation.version,undefined);
});

test('manual-v2 strips customer text, segment comments, claimed evidence and thread source metadata',()=>{
 const body=bodyFor(normInput('ISO4014','M12',80,'20MnB4')),secret='PRIVATE_SENTINEL';
 Object.assign(body,{customer:secret,email:secret,source:secret});
 Object.assign(body.input,{customer:secret,originMeta:{source:secret},materialStateEvidence:{quote:secret},sourceRefs:[secret],inputOrigins:{d0:{reason:secret}},note:secret});
 body.input.standardDocument.partSnapshot={customer:secret};body.input.threadModel.sourceRefs=[secret];body.input.threadModel.name=secret;body.input.shaftSegments.forEach(row=>{row.customerNote=secret;});body.candidates.forEach(row=>{row.reason=secret;});
 const decision=prepare(body);assert.ok(decision);const text=JSON.stringify(decision);assert.ok(!text.includes(secret));
 assert.equal(decision.input.standardDocument,undefined);assert.equal(decision.input.standardReference,undefined);assert.equal(decision.input.propertyClass,undefined);
 assert.deepEqual(decision.input.threadModel,{d:12});assert.deepEqual(decision.input.shaftSegments,[{diameter:12,length:50},{diameter:10.75,length:30}]);
 assert.equal(decision.status,'ungeprueft');assert.equal(decision.knowledgeEligible,false);assert.equal(decision.approval,null);assert.equal(decision.input.wst,undefined);
});

test('stored manual-v2 audit records identify all active calculation versions without mail or a TTL',async()=>{
 const decision=prepare(bodyFor(normInput('ISO4014','M12',80,'20MnB4'))),env=environment();let options='not-called';
 const original=env.SPEICHER.put;env.SPEICHER.put=async(key,value,passed)=>{options=passed;return original(key,value);};
 await recordDecision(env,decision);const [record]=savedDecisions(env);assert.equal(options,undefined);assert.equal(env.jobs.length,0);
 assert.equal(record.dataVersion.version,'manual-v2');assert.match(record.dataVersion.catalogSha256,/^[a-f0-9]{64}$/);
 for(const[key,value]of Object.entries(policies))assert.equal(record.dataVersion[key],value);
 assert.ok(record.calculation.values.Fmax_t>0);assert.equal(record.outcome.status,'nur_konzept');
});

test('legacy calculation and audit shape stay unchanged when revised technical fields are supplied',async()=>{
 const clean=bodyFor(simpleInput()),base=prepare(clean,{});assert.ok(base);
 const extra={...clean,input:{...clean.input,...policies,shaftSegments:[{diameter:99,length:1}],shaftType:'partial',ds:99,b:1,kopfTyp:'kugelabschnitt',schaftende:'halbhohl',d_b:99,t_b:1,rmDeliveryCondition:'+AC+C+AC',threadModel:{d:99}}};
 assert.deepEqual(prepare(extra,{}),base);
 assert.deepEqual(Object.keys(base.calculation).sort(),['rmPolicy','stages','values']);assert.deepEqual(Object.keys(base.calculation.values).sort(),['L0','d0','stationen']);
 const env=environment();await recordDecision(env,base);const [stored]=savedDecisions(env);assert.deepEqual(Object.keys(stored.dataVersion).sort(),['catalogSha256','rmPolicy','schema']);assert.equal(stored.dataVersion.rmPolicy,'rm-v1');
});

test('mail intake gates manual-v2 by server Origin, logs once and never sends mail while accepting the request',async t=>{
 const fetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('No network or real mail allowed');};t.after(()=>{globalThis.fetch=fetch;});
 for(const origin of ['https://jern-yao.de','https://jernyao.de','https://www.jernyao.de']){
  const env=environment(),body=bodyFor(simpleInput());body.version='manual-v2';Object.assign(body.input,policies);
  const response=await post(env,body,origin);assert.equal(response.httpStatus,202);assert.equal(savedDecisions(env).length,1);
  const record=savedDecisions(env)[0],revised=origin==='https://jern-yao.de';assert.equal(record.calculation.version,revised?'manual-v2':undefined);assert.equal(record.dataVersion.rmPolicy,revised?'rm-v2':'rm-v1');assert.equal(record.input.forcePolicy,revised?'force-v2':undefined);
  assert.ok(!JSON.stringify(record).includes('private-buyer'));assert.ok(!JSON.stringify(record).includes('Private project'));
  assert.equal((await post(env,body,origin)).id,response.id);assert.equal(savedDecisions(env).length,1);assert.ok(env.jobs.length>0,'only a queue job is prepared');
 }
 const extra=environment();extra.ALLOWED_ORIGINS='https://extra.example.test';const receipt=await post(extra,bodyFor(simpleInput()),'https://extra.example.test');assert.equal(receipt.httpStatus,202);assert.equal(savedDecisions(extra).length,0,'additional CORS origin cannot opt into manual calculation logging');
});
