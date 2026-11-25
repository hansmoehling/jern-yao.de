import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {screen, analyse} from '../analysis.js';
import {geometryContext} from '../geometry-context.js';
import Engine from '../../engine.js';

const PUBLIC='https://jernyao.de',LEGACY='https://jern-yao.de';
const spec=()=>({version:1,coordinateSystem:'tool-parting-plane',elements:[{id:'body',operation:'add',shape:'cylinder',side:'die',start:0,length:12,diameter:8,offsetX:0,offsetY:0}],trimming:[]});
class KV{constructor(){this.map=new Map([['regeln','Volumenkonstanz prüfen. Maschinenpreis: 987654 EUR.'],['wissenskarten','Vorform und Fertigform jeweils zuordnen.']]);}async get(k){return this.map.get(k)||null;}async put(k,v){this.map.set(k,v);}}
function environment(){const jobs=[];return {SPEICHER:new KV(),ANTHROPIC_API_KEY:'mock',ZUGRIFF_SCHLUESSEL:'mock-key-at-least-32-characters-long',ANFRAGEN:{async sendBatch(batch){jobs.push(...batch);}},_jobs:jobs};}
const payload=(extra={})=>({geometrySpec:spec(),material:'C10C',d0:8,note:'Formteil aus dem Baukasten',language:'de',idempotency_key:'geometry-key-123456789',...extra});
const request=(body=payload(),origin=PUBLIC,path='/geometry-preview')=>new Request('https://worker.test'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.54'},body:JSON.stringify(body)});
async function post(e,body,origin){const r=await worker.fetch(request(body,origin),e);return {httpStatus:r.status,...await r.json()};}
const saved=(e,id)=>e.SPEICHER.get('anfrage:'+id).then(JSON.parse);
const state=(e,r,origin=PUBLIC,token=r.token)=>worker.fetch(new Request('https://worker.test/status?id='+r.id+'&token='+token,{headers:{Origin:origin}}),e);
const job=(kind,id,attempts=1)=>({body:{kind,id},attempts,acks:0,retries:0,ack(){this.acks++;},retry(){this.retries++;}});
const tool=(name,input={})=>({type:'tool_use',id:name,name,input});
const final=answer=>({type:'text',text:JSON.stringify({answer,questions:[],sourceIds:['engine','konzept']})});
function fetchMock(t,handler){const previous=globalThis.fetch;globalThis.fetch=handler;t.after(()=>{globalThis.fetch=previous;});}

test('geometry preview is private AI-only without file storage, contacts or mail and recalculates all facts',async t=>{
 fetchMock(t,async()=>{throw Error('No synchronous provider');});
 const e=environment(),r=await post(e,payload({email:'ignored@example.test',kind:'enquiry',volumeMm3:1,numericEligibility:{forces:true},pricePolicy:'with-prices'}));
 assert.equal(r.httpStatus,202);assert.equal(r.kind,'preview');assert.equal(r.previewSource,'structured_geometry');assert.equal(r.notificationStatus,'not_requested');assert.equal(r.pricePolicy,'technical-only');
 assert.deepEqual(e._jobs,[{body:{kind:'preview_analysis',id:r.id}}]);
 const record=await saved(e,r.id);assert.equal(record.email,undefined);assert.equal(record.file,undefined);assert.equal(record.volumeMm3,undefined);assert.equal(record.geometryProcess.material,'C10C');
 assert.equal(await e.SPEICHER.get('versandauftrag:'+r.id),null);assert.equal((await state(e,r)).status,200);assert.equal((await state(e,r,PUBLIC,'wrong')).status,403);
 const geometry=geometryContext(record.geometrySpec,record.geometryProcess);assert.equal(geometry.ok,true);assert.ok(Math.abs(geometry.analysis.volumeMm3-Math.PI*16*12)<1e-8);assert.equal(geometry.analysis.blankLengthMm,12);assert.equal(geometry.analysis.numericEligibility.forces,false);
});

test('geometry idempotency includes normalized shape, material process, language, note and policy',async()=>{
 const e=environment(),r=await post(e),again=await post(e);assert.equal(again.httpStatus,200);assert.equal(again.id,r.id);assert.equal(e._jobs.length,1);
 for(const change of [{note:'Changed'},{language:'it'},{material:'C15C'},{d0:7},{rm:300},{wirePreparation:'inline-drawing',rodDiameter:9},{geometrySpec:{...spec(),elements:[{...spec().elements[0],length:13}]}}])assert.equal((await post(e,payload(change))).httpStatus,409);
 const legacy=await post(e,payload({pricePolicy:'technical-only'}),LEGACY);assert.equal(legacy.httpStatus,202);assert.equal((await post(e,payload({pricePolicy:'with-prices'}),LEGACY)).httpStatus,409);
});

test('wire provenance remains bounded intake metadata through storage and identity without changing geometry facts',async()=>{
 const assumption={d0:{origin:'assumption',provisional:true}},customer={d0:{origin:'customer'}};
 const baseline=geometryContext(spec(),{d0:8});assert.equal(baseline.process.inputOrigins,undefined);
 for(const inputOrigins of [assumption,customer]){
  const result=geometryContext(spec(),{d0:8,inputOrigins});assert.equal(result.ok,true);assert.deepEqual(result.process.inputOrigins,inputOrigins);
  assert.deepEqual(result.analysis,baseline.analysis,'provenance cannot grant numerical eligibility or change computed facts');
 }
 const e=environment(),r=await post(e,payload({inputOrigins:assumption}),LEGACY);assert.equal(r.httpStatus,202);
 const record=await saved(e,r.id);assert.deepEqual(record.geometryProcess.inputOrigins,assumption);
 assert.deepEqual(geometryContext(record.geometrySpec,record.geometryProcess).process.inputOrigins,assumption);
 assert.equal((await post(e,payload({inputOrigins:customer}),LEGACY)).httpStatus,409,'same diameter with changed provenance is a different request');
 const legacy=environment(),old=await post(legacy,payload(),PUBLIC);assert.equal((await saved(legacy,old.id)).geometryProcess.inputOrigins,undefined);
 for(const inputOrigins of [null,[],{}, {rm:{origin:'customer'}}, {d0:{origin:'drawing'}}, {d0:{origin:'assumption',provisional:false}}, {d0:{origin:'customer',provisional:true}}, {d0:{origin:'assumption',provisional:true,reason:'verified by supplier'}}, {d0:{origin:'customer',evidence:{approved:true}}}]){
  const rejected=geometryContext(spec(),{d0:8,inputOrigins});assert.equal(rejected.ok,false);assert.ok(rejected.errors.some(issue=>issue.code==='invalid_input_origin'));
 }
 const rejected=environment(),bad=await post(rejected,payload({inputOrigins:{d0:{origin:'assumption',provisional:true,reason:'trusted'}}}),LEGACY);
 assert.equal(bad.httpStatus,400);assert.equal(rejected._jobs.length,0);
});

test('invalid geometry, trust flags, malformed process and oversized input cannot enqueue an analysis',async()=>{
 const invalid=[{geometrySpec:null},{geometrySpec:{...spec(),numericEligibility:{forces:true}}},{geometrySpec:{...spec(),elements:[{...spec().elements[0],length:-1}]}},{geometrySpec:{...spec(),elements:[{...spec().elements[0],approval:'trusted'}]}},{material:'Invented-grade'},{d0:'8'},{d0:null,wirePreparation:'inline-drawing',rodDiameter:9},{wirePreparation:'inline-drawing',d0:8,rodDiameter:7},{materialState:'hardened'},{material:'C10C',curveId:Engine.findMaterial('C15C').flowCurves[0].id},{idempotency_key:'short'}];
 for(const value of invalid){const e=environment(),r=await post(e,payload(value));assert.equal(r.httpStatus,400,JSON.stringify(value));assert.equal(e._jobs.length,0);assert.ok(![...e.SPEICHER.map.keys()].some(k=>k.startsWith('anfrage:')));}
 const e=environment(),r=await post(e,payload({note:'x'.repeat(65000)}));assert.equal(r.httpStatus,413);assert.equal(e._jobs.length,0);
 assert.equal((await worker.fetch(request([],PUBLIC),e)).status,400);
 assert.equal((await post(e,payload(),'https://untrusted.invalid')).httpStatus,403);
});

test('geometry and drawing previews share the new-job daily budget and repeat calls do not consume it',async()=>{
 const e=environment();for(let i=0;i<10;i++)assert.equal((await post(e,payload({idempotency_key:'geometry-budget-key-'+i}))).httpStatus,202);
 assert.equal((await post(e,payload({idempotency_key:'geometry-budget-key-10'}))).httpStatus,429);
 assert.equal((await post(e,payload({idempotency_key:'geometry-budget-key-0'}))).httpStatus,200);
 e.DATEIEN={put(){throw Error('Budget must be checked first');}};
 const f=new FormData();f.set('datei',new File(['%PDF-1.7'],'part.pdf'));f.set('idempotency_key','drawing-budget-key-11');
 const r=await worker.fetch(new Request('https://worker.test/preview',{method:'POST',headers:{Origin:PUBLIC,'CF-Connecting-IP':'192.0.2.54'},body:f}),e);assert.equal(r.status,429);assert.equal(e._jobs.length,10);
});

test('queue and linked chat use saved geometry as its own source and cannot promote it into a drawing or force calculation',async t=>{
 const e=environment(),r=await post(e,payload({pricePolicy:'with-prices',wirePreparation:'inline-drawing',rodDiameter:9,rm:320}));let calls=0;
 fetchMock(t,async(url,req)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');const body=JSON.parse(req.body),customer=JSON.parse(body.messages[0].content[0].text);assert.equal(body.messages[0].content.length,1,'no fake image/document');
  assert.equal(customer.structuredGeometry.origin,'structured_geometry');assert.equal(customer.structuredGeometry.process.rm,320);assert.equal(customer.structuredGeometry.process.rodDiameter,9);assert.ok(Math.abs(customer.structuredGeometry.analysis.volumeMm3-Math.PI*192)<1e-8);assert.equal(customer.structuredGeometry.analysis.numericEligibility.forces,false);assert.match(body.system,/keinerlei Maschinenpreise/);assert.ok(!JSON.stringify(body.messages).includes('987654'));
  const phase=++calls%4;if(phase===1)return Response.json({content:[tool('projektwissen')]});
  if(phase===2)return Response.json({content:[tool('grobauslegung',{typ:'bolzen',values:{sD:8,sL:12}})]});
  if(phase===3){const gate=JSON.parse(body.messages.at(-1).content[0].content);assert.equal(gate.topology.status,'structured_geometry');assert.equal(gate.proposal,null);assert.deepEqual(gate.questions,[]);return Response.json({content:[final('Die Kraft beträgt 35 kN; JBP-13B5S ist geeignet.')]});}
  return Response.json({content:[final('Strukturierte Geometrie: Abschnitt vorbereiten, Volumen auf Matrizenseite vorformen, Körper fertigformen. Die Baureihe JBP ist qualitativ zu prüfen.')]});
 });
 await worker.queue({messages:[job('preview_analysis',r.id)]},e);assert.equal(calls,4);
 const result=await(await state(e,r,LEGACY)).json();assert.equal(result.status,'ready');assert.equal(result.proposal,null);assert.equal(result.geometry.origin,'structured_geometry');assert.equal(result.geometry.blankLengthMm,12);assert.ok(result.sources.some(x=>x.id==='structured_geometry'));assert.ok(!result.sources.some(x=>x.id==='engine'));assert.ok(!result.answer.includes('35 kN'));assert.equal(result.notificationStatus,'not_requested');
 await worker.queue({messages:[job('intake_mail',r.id),job('analysis',r.id),job('preview_analysis',r.id)]},e);assert.equal(calls,4);
 const response=await worker.fetch(request({requestId:r.id,token:r.token,message:'Bitte die Vorform genauer erklären.',geometrySpec:{volumeMm3:999},pricePolicy:'with-prices'},LEGACY,'/chat'),e);assert.equal(response.status,200);const chat=await response.json();assert.equal(chat.geometry.volumeMm3,result.geometry.volumeMm3);assert.equal(chat.pricePolicy,'technical-only');assert.equal(calls,8);
});

test('form builder geometry permits qualitative concepts without a drawing, but is never force-eligible',()=>{
 const r=screen({typ:'formteil'},{geometrySpec:spec(),geometryProcess:{d0:8},note:'Formteil'});assert.equal(r.topology.status,'structured_geometry');assert.deepEqual(r.questions,[]);assert.equal(r.proposal,null);assert.equal(r.geometry.numericEligibility.forces,false);
 const invalid=screen({typ:'formteil'},{geometrySpec:{...spec(),trusted:true}});assert.equal(invalid.topology.status,'geometry_invalid');assert.ok(invalid.questions.length);
 const freeText=screen({typ:'formteil'},{note:'Formteil aus Hüllmaßen'});assert.equal(freeText.topology.status,'drawing_required');
});

test('bounded geometry preserves the proven interval and disjoint pieces are not a single form part',()=>{
 const eccentric=spec();eccentric.elements.push({...eccentric.elements[0],id:'offset-body',offsetX:2});
 const result=geometryContext(eccentric,{d0:8});assert.equal(result.ok,true);assert.equal(result.analysis.volumeStatus,'bounded');assert.equal(result.analysis.volumeMm3,null);assert.equal(result.analysis.blankLengthMm,null);
 const overlap=32*Math.acos(.25)-Math.sqrt(60),truth=(32*Math.PI-overlap)*12;
 const [lo,hi]=result.analysis.volumeBoundsMm3;assert.ok(lo<=truth&&hi>=truth);assert.ok(hi>lo);assert.equal(result.analysis.numericEligibility.forces,false);assert.equal(typeof result.analysis.calculation.toleranceMet,'boolean');
 const disjoint=spec();disjoint.elements.push({...disjoint.elements[0],id:'disjoint',start:20});assert.equal(geometryContext(disjoint).ok,false);
});

test('weight uses the selected server material density and keeps its evidence status, never client density',()=>{
 const r=geometryContext(spec(),{material:'C10C',densityGcm3:1,rho:1});assert.equal(r.analysis.densityGcm3,7.85);assert.equal(r.analysis.densityStatus,'legacy-estimate');assert.ok(Math.abs(r.analysis.massG-Math.PI*192*7.85/1000)<1e-9);
 const unknown=geometryContext(spec(),{material:'NiFe 47',densityGcm3:7.85});assert.equal(unknown.analysis.densityGcm3,null);assert.equal(unknown.analysis.massG,null);assert.equal(unknown.analysis.massBoundsG,null);
 const reference=geometryContext(spec(),{material:'C4C',densityGcm3:1});assert.equal(reference.analysis.densityGcm3,7.85);assert.equal(reference.analysis.densityStatus,'reference-steel-density');assert.ok(reference.analysis.massG>0);assert.match(reference.analysis.densitySource.url,/arcelormittal/);
});

test('blank length includes modeled trimming stock while weight describes the finished part',()=>{
 const trimmed=spec();trimmed.trimming=[{id:'flat',side:'die',start:0,length:12,angleDeg:0,distance:2}];
 const r=geometryContext(trimmed,{material:'C10C',d0:8});assert.equal(r.ok,true);assert.equal(r.analysis.blankBasis,'before-trimming');assert.ok(Math.abs(r.analysis.stockVolumeMm3-Math.PI*192)<1e-8);assert.equal(r.analysis.blankLengthMm,12);
 assert.ok(r.analysis.volumeBoundsMm3[1]<r.analysis.stockVolumeMm3);assert.ok(r.analysis.trimVolumeBoundsMm3[0]>0);assert.ok(r.analysis.massBoundsG[1]<r.analysis.stockVolumeMm3*7.85/1000);
});

test('incomplete claw contours are persisted explicitly and suppress finished weight and blank metrics',async()=>{
 const features=[{side:'punch',type:'claw-head',contourComplete:false}],e=environment(),r=await post(e,payload({geometryFeatures:features}));assert.equal(r.httpStatus,202);
 const record=await saved(e,r.id);assert.deepEqual(record.geometryProcess.geometryFeatures,features);
 const analysis=geometryContext(record.geometrySpec,record.geometryProcess).analysis;assert.equal(analysis.basis,'partial-geometry');assert.equal(analysis.blankBasis,'partial-geometry');assert.ok(analysis.volumeMm3>0);
 for(const key of ['massG','massBoundsG','blankLengthMm','blankLengthBoundsMm'])assert.equal(analysis[key],null,key);
 assert.ok(analysis.operations.some(op=>op.code==='claw-head'&&op.side==='punch'));
 assert.equal((await post(e,payload({geometryFeatures:[{...features[0],contourComplete:true}]}))).httpStatus,409);
 for(const features of [[{side:'punch',type:'claw-head',contourComplete:'true'}],[{side:'punch',type:'claw-head',contourComplete:false},{side:'punch',type:'claw-head',contourComplete:true}],[{side:'punch',type:'hole',contourComplete:true}]])assert.equal(geometryContext(spec(),{geometryFeatures:features}).ok,false);
});

test('a die-side claw head is rejected before storing or queueing regardless of contour completeness',async t=>{
 fetchMock(t,async()=>{throw Error('Invalid geometry cannot reach a provider');});
 for(const contourComplete of [false,true]){
  const e=environment(),features=[{side:'die',type:'claw-head',contourComplete}];
  const validated=geometryContext(spec(),{geometryFeatures:features});assert.equal(validated.ok,false);assert.ok(validated.errors.some(issue=>issue.code==='claw_head_punch_only'));
  const r=await post(e,payload({geometryFeatures:features}));assert.equal(r.httpStatus,400);assert.ok(r.issues.some(issue=>issue.code==='claw_head_punch_only'));assert.equal(e._jobs.length,0);
  assert.ok(![...e.SPEICHER.map.keys()].some(key=>/^(?:anfrage|analyse|vorschauauftrag|geometrie-idempotenz):/.test(key)));
 }
 const mixed=geometryContext(spec(),{geometryFeatures:[{side:'punch',type:'claw-head',contourComplete:true},{side:'die',type:'claw-head',contourComplete:true}]});assert.equal(mixed.ok,false);
});

test('saved geometry is revalidated so a former die-side claw cannot enter follow-up analysis',async t=>{
 const e=environment(),r=await post(e,payload({geometryFeatures:[{side:'punch',type:'claw-head',contourComplete:true}]}));assert.equal(r.httpStatus,202);
 const record=await saved(e,r.id);record.geometryProcess.geometryFeatures[0].side='die';await e.SPEICHER.put('anfrage:'+r.id,JSON.stringify(record));
 let calls=0;fetchMock(t,async()=>{calls++;throw Error('No provider call for invalid saved geometry');});
 const response=await worker.fetch(request({requestId:r.id,token:r.token,message:'Bitte das Konzept fortsetzen.'},PUBLIC,'/chat'),e);assert.equal(response.status,503);assert.equal(calls,0);assert.equal(e._jobs.length,1,'no additional job was created');
});

test('geometry remains knowledge-first and invalid stored geometry is rejected before any model call',async t=>{
 let calls=0;fetchMock(t,async()=>{calls++;return Response.json({content:[final('Ein Konzept ohne Projektwissen.')]});});
 await assert.rejects(analyse({geometrySpec:{...spec(),trusted:true}},environment()),/geometry_invalid/);assert.equal(calls,0);
 await assert.rejects(analyse({geometrySpec:spec()},environment(),{maxRounds:2}),/model_round_limit/);assert.equal(calls,2);
});

test('interrupted geometry submission reuses its saved job and terminal failures do not re-run',async t=>{
 const e=environment();let sends=0;e.ANFRAGEN.sendBatch=async batch=>{if(++sends===1)throw Error('queue unavailable');e._jobs.push(...batch);};
 assert.equal((await post(e)).httpStatus,503);const r=await post(e);assert.equal(r.httpStatus,200);assert.equal(e._jobs.length,1);
 let calls=0;fetchMock(t,async()=>{calls++;throw Error('model unavailable');});
 const first=job('preview_analysis',r.id);await worker.queue({messages:[first]},e);assert.equal(first.retries,1);
 const last=job('preview_analysis',r.id,2);await worker.queue({messages:[last]},e);assert.equal(last.acks,1);const result=await(await state(e,r)).json();assert.equal(result.status,'failed');assert.match(result.answer,/strukturierte Geometrie/);assert.ok(!result.answer.includes('Zeichnung'));
 await worker.queue({messages:[job('preview_analysis',r.id,3)]},e);assert.equal(calls,2);assert.equal((await post(e)).status,'failed');
});
