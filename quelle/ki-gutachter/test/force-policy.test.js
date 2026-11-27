import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{tokenFor,digest} from '../worker.js';
import {screen,publicResult} from '../analysis.js';
import {PUBLIC_KNOWLEDGE_VERSION} from '../knowledge-publication.js';
import E from '../../engine.js';
import machines from '../../maschinen.json' with {type:'json'};

const HY='https://jern-yao.de',MAIN='https://jernyao.de',V2='force-v2';
function environment(){
 const map=new Map([['regeln','Historische Kraftregel R-F4: keine Extrapolation.'],['wissenskarten','Geometrie und Stadien prüfen.']]),files=new Map(),jobs=[];
 return {SPEICHER:{map,async get(k){return map.get(k)??null;},async put(k,v){map.set(k,v);}},DATEIEN:{async put(k,v){files.set(k,new Uint8Array(v));},async get(k){const b=files.get(k);return b?{arrayBuffer:async()=>b.buffer}:null;}},ANFRAGEN:{async sendBatch(batch){jobs.push(...batch);}},ANTHROPIC_API_KEY:'mock',ZUGRIFF_SCHLUESSEL:'test-access-key-more-than-32-characters',_jobs:jobs};
}
const get=(env,key)=>env.SPEICHER.get(key).then(value=>value?JSON.parse(value):null);
const put=(env,key,value)=>env.SPEICHER.put(key,JSON.stringify(value));
const jsonRequest=(path,body,origin)=>new Request('https://worker.test'+path,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
const post=async(env,path,body,origin)=>{const response=await worker.fetch(jsonRequest(path,body,origin),env);return {httpStatus:response.status,...await response.json()};};
const finalResult=(extra={})=>({answer:'Gespeichertes Konzept.',questions:[],language:'de',sources:[],knowledgePublicationVersion:PUBLIC_KNOWLEDGE_VERSION,...extra});
const spec=()=>({version:1,coordinateSystem:'tool-parting-plane',elements:[{id:'body',operation:'add',shape:'cylinder',side:'die',start:0,length:12,diameter:8,offsetX:0,offsetY:0}],trimming:[]});
const job=(id)=>({body:{id,kind:'preview_analysis',siteOrigin:HY,forcePolicy:V2},attempts:1,acks:0,retries:0,ack(){this.acks++;},retry(){this.retries++;}});
function modelMock(t,inspect=()=>{}){
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');const body=JSON.parse(options.body);calls++;inspect(body);
  const read=body.messages.some(m=>Array.isArray(m.content)&&m.content.some(c=>c.type==='tool_result'&&c.tool_use_id==='knowledge'));
  return Response.json({content:read?[{type:'text',text:JSON.stringify({answer:'Vorformen und Fertigformen getrennt betrachten.',questions:[],sourceIds:['konzept']})}]:[{type:'tool_use',id:'knowledge',name:'projektwissen',input:{}}]});
 };t.after(()=>{globalThis.fetch=previous;});return ()=>calls;
}
async function savedRecord(env,extra={}){
 const id=crypto.randomUUID(),record={id,kind:'preview',siteOrigin:HY,createdAt:new Date().toISOString(),note:'Bitte die Stadien erklären.',language:'de',...extra};
 await put(env,'anfrage:'+id,record);return {...record,token:await tokenFor(env,id)};
}
async function state(env,record,origin=HY){return (await worker.fetch(new Request('https://worker.test/status?id='+record.id+'&token='+record.token,{headers:{Origin:origin}}),env)).json();}
function nut(){
 const values={mM:10,mSW:16,mH:8.4,mLoch:8.53,d0:13,rm:350},unit=key=>key==='rm'?'N/mm²':'mm';
 const evidence=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{origin:'user_text',quote:`${key} ${value} ${unit(key)}`,reference:key,originalValue:value,originalUnit:unit(key)}]));
 return {input:{typ:'mutter',material:'C10C',materialEvidence:{origin:'user_text',quote:'C10C'},materialState:'soft-annealed',materialStateEvidence:{origin:'user_text',quote:'weichgeglüht'},curveId:'onder2004-c10c-soft',values,evidence},context:{note:'C10C weichgeglüht; '+Object.values(evidence).map(e=>e.quote).join('; '),packageSix:true}};
}

test('the numerical service selects force v2 only from trusted context and isolates all derived catalog sizes',()=>{
 const {input,context}=nut(),original=E.waehle,captured=[];
 E.waehle=(catalog,...args)=>{captured.push(catalog);return original(catalog,...args);};
 let legacy,updated;
 try{legacy=screen({...input,forcePolicy:V2,machinePolicy:'ranking-v2'},context);updated=screen(input,{...context,forcePolicy:V2});}finally{E.waehle=original;}
 assert.equal(legacy.ok,true,JSON.stringify(legacy.questions));assert.equal(updated.ok,true,JSON.stringify(updated.questions));
 assert.equal(legacy.proposal.calculation.input.machinePolicy,'ranking-v1');assert.equal(legacy.forcePolicy,undefined);assert.equal(legacy.proposal.calculation.input.forcePolicy,undefined);
 assert.equal(updated.forcePolicy,V2);assert.equal(updated.proposal.calculation.input.machinePolicy,'ranking-v2');assert.equal(updated.proposal.calculation.forcePolicy,V2);
 const derived=machines.filter(m=>m.szMeta?.origin==='abgeleitet aus Abschnitt-Ø');assert.equal(derived.length,65);
 for(const machine of derived){const before=captured[0].find(m=>m.m===machine.m),after=captured[1].find(m=>m.m===machine.m);assert.equal(before.sz,undefined);assert.equal(before.szMeta,undefined);assert.deepEqual(after,machine);assert.ok(machine.sz,'catalog import was not mutated');}
 for(const machine of machines.filter(m=>!m.szMeta))assert.deepEqual(captured[0].find(m=>m.m===machine.m),machine);
 assert.ok(legacy.proposal.stages.every(s=>s.forceBand===undefined&&s.forceStatus===undefined));
 const calculated=E.auslegen(updated.proposal.calculation.input),keys=['forceStatus','forceBand','forceExtrapolation','forceBasis','pStempel','pStempelBand','pBand'];
 calculated.stufen.forEach((stage,index)=>{for(const key of keys)assert.deepEqual(updated.proposal.stages[index][key],stage[key],key);});
 assert.ok(updated.proposal.stages.some(s=>s.forceStatus==='extrapoliert'&&s.forceBand));assert.ok(updated.proposal.stages.some(s=>s.forceBasis?.rule==='R-LOCH-RM'));
 assert.match(updated.limitations[0],/Extrapolation/);assert.ok(updated.proposal.machines.length>0);
 const forceCriteria=updated.proposal.machines.flatMap(m=>m.criteria).filter(k=>k.forceSensitivity);assert.ok(forceCriteria.length>0);
 const sizeCriteria=updated.proposal.machines.flatMap(m=>m.criteria).filter(k=>k.sourceStatus==='derived-unconfirmed');assert.ok(sizeCriteria.length>0);assert.ok(sizeCriteria.every(k=>k.sourceOwner==='Jern Yao'&&k.confirmationRequired&&k.detail));
 const publicView=publicResult({...updated,answer:'Konzept'},{pricePolicy:'technical-only'});assert.equal(publicView.forcePolicy,V2);assert.deepEqual(publicView.proposal.stages,updated.proposal.stages);assert.ok(publicView.proposal.machines.every(m=>m.priceEUR===undefined));
});

test('unlinked chat enables force v2 only on the exact testfield origin and retains prior dialog',async t=>{
 const seen=[];modelMock(t,body=>seen.push(body));
 const history=[{role:'assistant',content:'Früherer Konzeptstand zur Diskussion.',knowledgePublicationVersion:PUBLIC_KNOWLEDGE_VERSION},{role:'user',content:'Bitte diesen Stand vergleichen.'}];
 for(const origin of [HY,MAIN,'https://www.jernyao.de',null,'https://www.jern-yao.de']){
  const env=environment();env.ALLOWED_ORIGINS='https://www.jern-yao.de';seen.length=0;
  const response=await post(env,'/chat',{message:'Bitte weiter erklären.',forcePolicy:V2,siteOrigin:HY,history},origin);assert.equal(response.httpStatus,200);assert.equal(response.forcePolicy,origin===HY?V2:undefined);
  for(const body of seen){assert.equal(body.system.includes('Aktiver Programmstand force-v2:'),origin===HY);assert.ok(JSON.stringify(body.messages).includes(history[0].content),'dialog history remains available');}
  if(origin===HY){assert.match(seen[0].system,/Vorrang vor historischen Kraftregeln/);assert.match(seen[0].system,/einschließlich Vorverfestigung/);assert.match(seen[0].system,/R-LOCH-RM/);}
 }
});

test('drawing and structured previews store server force policy and version their idempotency namespace',async()=>{
 for(const kind of ['drawing','geometry'])for(const origin of [HY,MAIN]){
  const env=environment(),key='same-client-key-123456789',old=await savedRecord(env,{siteOrigin:origin}),namespace=kind==='drawing'?'vorschau-idempotenz:':'geometrie-idempotenz:';
  // This represents a pre-P2 cache entry. A testfield request must not consume it.
  const oldKey=namespace+await digest(origin+':'+key);await put(env,oldKey,{id:old.id,fingerprint:'old-version'});
  const submit=async()=>{
   if(kind==='geometry')return post(env,'/geometry-preview',{geometrySpec:spec(),d0:8,material:'C10C',idempotency_key:key,forcePolicy:V2,siteOrigin:HY},origin);
   const form=new FormData();form.set('datei',new File(['%PDF-1.7 drawing'],'part.pdf',{type:'application/pdf'}));form.set('idempotency_key',key);form.set('forcePolicy',V2);form.set('siteOrigin',HY);
   const response=await worker.fetch(new Request('https://worker.test/preview',{method:'POST',headers:{Origin:origin},body:form}),env);return {httpStatus:response.status,...await response.json()};
  };
  if(origin===MAIN){assert.equal((await submit()).httpStatus,409,'legacy namespace and fingerprint validation remain unchanged');env.SPEICHER.map.delete(oldKey);}
  const first=await submit();assert.equal(first.httpStatus,202);assert.notEqual(first.id,old.id);const record=await get(env,'anfrage:'+first.id);assert.equal(record.forcePolicy,origin===HY?V2:undefined);
  const repeat=await submit();assert.equal(repeat.httpStatus,200);assert.equal(repeat.id,first.id);assert.equal(env._jobs.length,1);
  assert.equal((await get(env,'anfrage:'+old.id)).forcePolicy,undefined,'old records remain legacy');
 }
});

test('queue policy requires the stored version and origin, never queue flags',async t=>{
 modelMock(t);
 for(const [siteOrigin,forcePolicy,expected]of [[HY,V2,V2],[HY,undefined,undefined],[MAIN,V2,undefined],[null,V2,undefined]]){
  const env=environment(),record=await savedRecord(env,{siteOrigin,...(forcePolicy?{forcePolicy}:{})}),message=job(record.id);
  await worker.queue({messages:[message]},env);assert.equal(message.acks,1);assert.equal(message.retries,0);
  const result=await get(env,'analyse:'+record.id);assert.equal(result.status,'ready');assert.equal(result.result.forcePolicy,expected);
 }
});

test('a stale force-v1 result cannot masquerade as v2; legacy ready records remain replayable',async t=>{
 const calls=modelMock(t),env=environment(),current=await savedRecord(env,{forcePolicy:V2}),legacy=await savedRecord(env);
 for(const record of [current,legacy])await put(env,'analyse:'+record.id,{status:'ready',result:finalResult()});
 const stale=await state(env,current);assert.equal(stale.resultSuperseded,true);assert.equal(stale.proposal,null);
 assert.equal((await state(env,legacy)).answer,'Gespeichertes Konzept.');
 await worker.queue({messages:[job(legacy.id)]},env);assert.equal(calls(),0);
 await worker.queue({messages:[job(current.id)]},env);assert.equal(calls(),2);assert.equal((await state(env,current)).forcePolicy,V2);
 const before=calls();await worker.queue({messages:[job(current.id)]},env);assert.equal(calls(),before);
 const main=await state(env,current,MAIN);assert.equal(main.resultSuperseded,true);assert.equal(main.forcePolicy,undefined);
});

test('linked chat requires both trusted origin and record version and cannot overwrite a v2 result from main',async t=>{
 modelMock(t);
 for(const [savedOrigin,forcePolicy,currentOrigin,expected]of [[HY,V2,HY,V2],[HY,undefined,HY,undefined],[HY,V2,MAIN,undefined],[MAIN,V2,HY,undefined],[MAIN,undefined,MAIN,undefined]]){
  const env=environment(),record=await savedRecord(env,{siteOrigin:savedOrigin,...(forcePolicy?{forcePolicy}:{})}),canonical={status:'ready',result:finalResult({...(savedOrigin===HY&&forcePolicy===V2?{forcePolicy:V2}:{})})};
  await put(env,'analyse:'+record.id,canonical);
  const response=await post(env,'/chat',{requestId:record.id,token:record.token,message:'Bitte den Stand erläutern.',forcePolicy:V2,siteOrigin:HY},currentOrigin);assert.equal(response.httpStatus,200);assert.equal(response.forcePolicy,expected);
  if(savedOrigin===HY&&forcePolicy===V2&&currentOrigin===MAIN)assert.deepEqual(await get(env,'analyse:'+record.id),canonical,'legacy follow-up must not replace the stored testfield result');
 }
});

test('terminal v2 failures keep their policy so duplicate queue delivery does not retry the model',async t=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'unavailable'},{status:503});};t.after(()=>{globalThis.fetch=previous;});
 const env=environment(),record=await savedRecord(env,{forcePolicy:V2}),message=job(record.id);message.attempts=2;
 await worker.queue({messages:[message]},env);const failed=await get(env,'analyse:'+record.id);assert.equal(failed.status,'failed');assert.equal(failed.result.forcePolicy,V2);const before=calls;
 await worker.queue({messages:[job(record.id)]},env);assert.equal(calls,before);assert.equal((await state(env,record)).resultSuperseded,undefined);
});

test('Rm policy is independent of the P2 force marker and cannot be enabled by client fields',async t=>{
 const systems=[];modelMock(t,body=>systems.push(body.system));
 for(const origin of [HY,MAIN,'https://www.jernyao.de',null]){
  systems.length=0;const response=await post(environment(),'/chat',{message:'Bitte die Werkstoffbasis erläutern.',rmPolicy:'rm-v2',forcePolicy:V2,siteOrigin:HY},origin);
  assert.equal(response.httpStatus,200);assert.equal(response.rmPolicy,origin===HY?'rm-v2':undefined);
  assert.ok(systems.every(system=>system.includes('Aktiver Programmstand rm-v2:')===(origin===HY)));
 }
 for(const [siteOrigin,forcePolicy,rmPolicy,currentOrigin,expected]of [[HY,V2,undefined,HY,undefined],[HY,V2,'rm-v2',HY,'rm-v2'],[HY,V2,'rm-v2',MAIN,undefined],[MAIN,V2,'rm-v2',HY,undefined],[HY,undefined,'rm-v2',HY,undefined]]){
  const env=environment(),record=await savedRecord(env,{siteOrigin,forcePolicy,rmPolicy});systems.length=0;
  const response=await post(env,'/chat',{requestId:record.id,token:record.token,message:'Bitte Rm prüfen.',rmPolicy:'rm-v2'},currentOrigin);
  assert.equal(response.httpStatus,200);assert.equal(response.rmPolicy,expected);assert.ok(systems.every(system=>system.includes('Aktiver Programmstand rm-v2:')===(expected==='rm-v2')));
 }
});

test('P2 ready results stay P2 while a P3 record rejects a cached P2 result and recomputes once',async t=>{
 const calls=modelMock(t),env=environment(),p2=await savedRecord(env,{forcePolicy:V2}),p3=await savedRecord(env,{forcePolicy:V2,rmPolicy:'rm-v2'});
 for(const record of [p2,p3])await put(env,'analyse:'+record.id,{status:'ready',result:finalResult({forcePolicy:V2})});
 assert.equal((await state(env,p2)).forcePolicy,V2);assert.equal((await state(env,p2)).rmPolicy,undefined);assert.equal((await state(env,p3)).resultSuperseded,true);
 await worker.queue({messages:[job(p2.id)]},env);assert.equal(calls(),0,'P2 record must not silently upgrade');
 await worker.queue({messages:[job(p3.id)]},env);assert.equal(calls(),2);const updated=await state(env,p3);assert.equal(updated.forcePolicy,V2);assert.equal(updated.rmPolicy,'rm-v2');
 await worker.queue({messages:[job(p3.id)]},env);assert.equal(calls(),2);
 const canonical=await get(env,'analyse:'+p3.id);
 const chat=await post(env,'/chat',{requestId:p3.id,token:p3.token,message:'Bitte erläutern.'},MAIN);assert.equal(chat.rmPolicy,undefined);assert.deepEqual(await get(env,'analyse:'+p3.id),canonical);
});

test('new P3 preview keys do not replay cached P2 records and main never stores an Rm marker',async()=>{
 for(const kind of ['drawing','geometry'])for(const origin of [HY,MAIN]){
  const env=environment(),key='rm-policy-preview-123456',p2=await savedRecord(env,{siteOrigin:origin,...(origin===HY?{forcePolicy:V2}:{})}),namespace=kind==='drawing'?'vorschau-idempotenz:':'geometrie-idempotenz:';
  const oldKey=namespace+await digest(origin+':'+(origin===HY?V2+':':'')+key);await put(env,oldKey,{id:p2.id,fingerprint:'P2-cache'});
  if(origin===MAIN)env.SPEICHER.map.delete(oldKey);
  const submit=async()=>{
   if(kind==='geometry')return post(env,'/geometry-preview',{geometrySpec:spec(),d0:8,material:'C10C',idempotency_key:key,rmPolicy:'rm-v2'},origin);
   const form=new FormData();form.set('datei',new File(['%PDF-1.7 drawing'],'part.pdf'));form.set('idempotency_key',key);form.set('rmPolicy','rm-v2');
   const response=await worker.fetch(new Request('https://worker.test/preview',{method:'POST',headers:{Origin:origin},body:form}),env);return {httpStatus:response.status,...await response.json()};
  };
  const first=await submit();assert.equal(first.httpStatus,202);assert.notEqual(first.id,p2.id);const record=await get(env,'anfrage:'+first.id);assert.equal(record.rmPolicy,origin===HY?'rm-v2':undefined);
  assert.equal((await submit()).id,first.id);assert.equal(env._jobs.length,1);assert.equal((await get(env,'anfrage:'+p2.id)).rmPolicy,undefined);
 }
});

test('a terminal P3 failure preserves both policy versions across retries and public projection',async t=>{
 const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({error:'unavailable'},{status:503});};t.after(()=>{globalThis.fetch=previous;});
 const env=environment(),record=await savedRecord(env,{forcePolicy:V2,rmPolicy:'rm-v2'}),message=job(record.id);message.attempts=2;
 await worker.queue({messages:[message]},env);const result=await state(env,record);assert.equal(result.status,'failed');assert.equal(result.forcePolicy,V2);assert.equal(result.rmPolicy,'rm-v2');assert.equal(result.resultSuperseded,undefined);
 const before=calls;await worker.queue({messages:[job(record.id)]},env);assert.equal(calls,before);
});

test('the real Rm v2 service keeps norm bounds and condition provenance, while P2 stays unchanged',()=>{
 const values={sD:4.4,sL:12,kD:9.5,kH:2.75,d0:4.7};
 const evidence=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{origin:'user_text',quote:`${key} ${value} mm`,originalValue:value,originalUnit:'mm',reference:key}]));
 const material=E.findMaterial('34CrMo4'),input={typ:'bolzen',material:material.id,materialEvidence:{origin:'user_text',quote:material.id},materialState:'soft-annealed',materialStateEvidence:{origin:'user_text',quote:'weichgeglüht'},curveId:material.flowCurves[0].id,values,evidence};
 const context={note:'34CrMo4 weichgeglüht; '+Object.values(evidence).map(item=>item.quote).join('; '),packageSix:true,forcePolicy:V2};
 const p2=screen({...input,rmPolicy:'rm-v2'},context),p3=screen(input,{...context,rmPolicy:'rm-v2'});
 assert.equal(p2.ok,true);assert.equal(p3.ok,true);assert.equal(p2.rmPolicy,undefined);assert.equal(p2.proposal.calculation.input.rmPolicy,undefined);
 assert.equal(p3.rmPolicy,'rm-v2');assert.equal(p3.proposal.calculation.rmPolicy,'rm-v2');assert.equal(p3.proposal.calculation.input.rmPolicy,'rm-v2');
 const preset=p3.proposal.calculation.materialModel.rmVorbelegung;
 assert.equal(preset.version,'rm-v2');assert.equal(preset.origin,'standard');assert.equal(preset.status,'band');assert.equal(preset.value,null);assert.ok(preset.band.max>0);
 assert.equal(preset.conditionBasis,'provisional-spheroidized-delivery-assumption');assert.ok(preset.deliveryCondition);assert.ok(preset.diameterRange.minExclusive<values.d0&&preset.diameterRange.maxInclusive>=values.d0);assert.ok(preset.sourceRefs.length>=2);
 assert.ok(preset.sourceRefs.every(source=>source.url.startsWith('https://')&&!/drive\.google|mail\.google/.test(source.url)));
 assert.ok(p3.proposal.assumptions.some(line=>line.includes('Normobergrenze')&&line.includes('Rechenannahme')));assert.ok(!p3.proposal.assumptions.some(line=>line.includes('Das Band ist eine Annahme')));
 assert.ok(p3.proposal.machines.length);const criteria=p3.proposal.machines.flatMap(machine=>machine.criteria).filter(c=>c.criterion==='Abschnitt-Ø');assert.ok(criteria.length);assert.ok(criteria.every(c=>c.rmVorbelegung?.version==='rm-v2'&&c.rmSensitivity));
 for(const pricePolicy of ['with-prices','technical-only']){const result=publicResult({...p3,answer:'Konzept'},{pricePolicy});assert.equal(result.rmPolicy,'rm-v2');assert.deepEqual(result.proposal.calculation.materialModel.rmVorbelegung,preset);}
 const supplied=screen({...input,values:{...values,rm:520},evidence:{...evidence,rm:{origin:'user_text',quote:'Rm 520 N/mm²',originalValue:520,originalUnit:'N/mm²',reference:'Zeugnis'}}},{...context,rmPolicy:'rm-v2',note:context.note+'; Rm 520 N/mm²'});
 assert.equal(supplied.proposal.calculation.materialModel.rmVorbelegung.origin,'customer');assert.equal(supplied.proposal.calculation.materialModel.rmVorbelegung.value,520);
});

test('sourced delivery codes retain the entire sequence and never turn a negation into confirmation',()=>{
 const values={sD:4.4,sL:12,kD:9.5,kH:2.75,d0:4.7},evidence=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{origin:'user_text',quote:`${key} ${value} mm`,originalValue:value,originalUnit:'mm',reference:key}]));
 const material=E.findMaterial('34CrMo4'),base={typ:'bolzen',material:material.id,materialEvidence:{origin:'user_text',quote:material.id},materialState:'soft-annealed',curveId:material.flowCurves[0].id,values,evidence};
 const note='34CrMo4; '+Object.values(evidence).map(item=>item.quote).join('; '),context={note,packageSix:true,forcePolicy:V2,rmPolicy:'rm-v2'};
 const run=(quote,source=quote,extra={})=>screen({...base,materialStateEvidence:{origin:'user_text',quote}}, {...context,note:note+'; '+source,...extra});
 const ac=run('+AC');assert.equal(ac.ok,true);assert.equal(ac.proposal.calculation.input.rmDeliveryCondition,'+AC');assert.equal(ac.proposal.calculation.materialModel.rmVorbelegung.status,'diameter-outside-range');
 for(const code of ['+AC+C+AC']){
  const r=run(code);assert.equal(r.ok,true);const preset=r.proposal.calculation.materialModel.rmVorbelegung;
  assert.equal(r.proposal.calculation.input.rmDeliveryCondition,code);assert.equal(preset.status,'band');assert.equal(preset.deliveryCondition,code);assert.equal(preset.conditionBasis,'selected-delivery-condition');assert.equal(r.proposal.calculation.input.materialState,'soft-annealed');
  assert.ok(r.proposal.assumptions.some(line=>line.includes('Normobergrenze')&&!line.includes('Rechenannahme')));
 }
 for(const [quote,source]of [['+AC','weichgeglüht, nicht +AC'],['+AC+C+AC','not +AC+C+AC'],['+AC+C+AC','+AC+C+AC wird nicht geliefert'],['weichgeglüht +A','weichgeglüht +A'],['+U+C+AC','+U+C+AC'],['+AC oder +AC+C+AC','+AC oder +AC+C+AC'],['+AC+C+AC+X','+AC+C+AC+X']]){
  const r=run(quote,source);assert.equal(r.ok,true);assert.equal(r.proposal.calculation.materialModel.rmVorbelegung.status,'delivery-condition-mismatch',source);assert.equal(r.proposal.calculation.materialModel.rmVorbelegung.band,null);
 }
 const fake=run('+AC+C+AC','weichgeglüht');assert.equal(fake.proposal.calculation.input.rmDeliveryCondition,undefined);assert.equal(fake.proposal.calculation.materialModel.rmVorbelegung.band,null);
 const p2=run('+AC+C+AC','+AC+C+AC',{rmPolicy:undefined});assert.equal(p2.proposal.calculation.input.rmDeliveryCondition,undefined);assert.equal(p2.proposal.calculation.input.materialState,'unknown','legacy parsing is unchanged');
});
