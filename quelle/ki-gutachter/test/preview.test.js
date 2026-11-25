import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import Engine from '../../engine.js';

const PUBLIC='https://jernyao.de',LEGACY='https://jern-yao.de';
class KV {
 constructor(){this.map=new Map([['regeln','Stauchgrenzen prüfen. Maschinenpreis: 987654 EUR.'],['wissenskarten','Kraft und Stadienfolge prüfen.']]);}
 async get(key){return this.map.get(key)??null;}
 async put(key,value){this.map.set(key,value);}
}
function environment(){
 const files=new Map(),jobs=[];
 return {SPEICHER:new KV(),DATEIEN:{async put(k,v){files.set(k,new Uint8Array(v));},async get(k){const b=files.get(k);return b?{arrayBuffer:async()=>b.buffer}:null;}},ANFRAGEN:{async sendBatch(batch){jobs.push(...batch);}},ANTHROPIC_API_KEY:'mock',ZUGRIFF_SCHLUESSEL:'mock-key-at-least-32-characters-long',_files:files,_jobs:jobs};
}
const drawing=(name='drawing.pdf',content='%PDF-1.7 drawing')=>new File([content],name,{type:'application/pdf'});
function request(path='/preview',{file=drawing(),origin=PUBLIC,ip='192.0.2.8',key='preview-key-123456789',...extra}={}){
 const form=new FormData();if(file)form.set('datei',file);if(key!==null)form.set('idempotency_key',key);
 for(const[k,v]of Object.entries(extra))form.set(k,v);
 return new Request('https://worker.test'+path,{method:'POST',headers:{...(origin?{Origin:origin}:{}),'CF-Connecting-IP':ip},body:form});
}
async function post(env,opts,path){const response=await worker.fetch(request(path,opts),env);return {httpStatus:response.status,...await response.json()};}
const record=(env,id)=>env.SPEICHER.get('anfrage:'+id).then(JSON.parse);
const state=(env,r,origin=PUBLIC,token=r.token)=>worker.fetch(new Request('https://worker.test/status?id='+r.id+'&token='+token,{headers:{Origin:origin}}),env);
const job=(kind,id,attempts=1)=>({body:{kind,id},attempts,acks:0,retries:0,ack(){this.acks++;},retry(){this.retries++;}});
function fetchMock(t,fn){const previous=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=previous;});}
const tool=(name,input={})=>({type:'tool_use',id:name,name,input});
const reply=(...content)=>Response.json({content});
const final=(answer='Die Zeichnung ist ausgewertet.',questions=[])=>({type:'text',text:JSON.stringify({answer,questions,sourceIds:['engine','konzept']})});
function drawingInput(){
 const values={sD:8,sL:30,kD:13,kH:5};
 return {typ:'bolzen',material:'C15C',materialEvidence:{origin:'drawing',quote:'C15C',page:1,reference:'Zeichnung'},curveId:Engine.findMaterial('C15C').flowCurves[0].id,materialState:'soft-annealed',materialStateEvidence:{origin:'assumption',quote:'Weichgeglühten Draht einsetzen.'},values,evidence:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{origin:'drawing',quote:value+' mm',page:1,reference:'Maßlinie',originalValue:value,originalUnit:'mm'}]))};
}

test('preview requires no contact or mail service, stores a private file, and queues only analysis',async t=>{
 fetchMock(t,async()=>{throw Error('No synchronous provider call');});
 const e=environment(),r=await post(e,{email:'ignored@example.test',consent:'false',kind:'enquiry',pricePolicy:'with-prices'});
 assert.equal(r.httpStatus,202);assert.equal(r.kind,'preview');assert.equal(r.status,'queued');assert.equal(r.notificationStatus,'not_requested');assert.equal(r.pricePolicy,'technical-only');
 assert.deepEqual(e._jobs,[{body:{kind:'preview_analysis',id:r.id}}]);assert.equal(e._files.size,1);
 const saved=await record(e,r.id);assert.equal(saved.kind,'preview');assert.equal(saved.email,undefined);assert.equal(saved.file.readable,true);assert.equal(saved.pricePolicy,'technical-only');
 assert.equal(await e.SPEICHER.get('versandauftrag:'+r.id),null);
 const response=await state(e,r);assert.equal(response.status,200);const s=await response.json();assert.equal(s.kind,'preview');assert.equal(s.notificationStatus,'not_requested');assert.equal(s.status,'queued');
 assert.equal((await state(e,r,PUBLIC,'invalid-token')).status,403);
 assert.ok(!JSON.stringify(s).includes('ignored@example'));
});

test('same preview retries reuse job and result; changed input or price policy cannot reuse its key',async()=>{
 const e=environment(),first=await post(e),again=await post(e);
 assert.equal(again.httpStatus,200);assert.equal(again.id,first.id);assert.equal(again.token,first.token);assert.equal(e._jobs.length,1);assert.equal(e._files.size,1);
 for(const opts of [{notiz:'Changed geometry'},{language:'en'},{file:drawing('changed.pdf')},{file:drawing('drawing.pdf','%PDF-1.7 another part')}])assert.equal((await post(e,opts)).httpStatus,409);
 const old=await post(e,{origin:LEGACY,pricePolicy:'technical-only'});assert.notEqual(old.id,first.id);
 assert.equal((await post(e,{origin:LEGACY,pricePolicy:'with-prices'})).httpStatus,409);
 await e.SPEICHER.put('analyse:'+first.id,JSON.stringify({status:'ready',result:{answer:'Vorstauchen, dann Fertigstauchen.',questions:[],language:'de',sources:[]}}));
 const ready=await post(e);assert.equal(ready.status,'ready');assert.equal(ready.answer,'Vorstauchen, dann Fertigstauchen.');assert.equal(e._jobs.length,2);
});

test('interrupted preview queue submission resumes the saved file and identity',async()=>{
 const e=environment();let calls=0;e.ANFRAGEN.sendBatch=async batch=>{if(++calls===1)throw Error('temporary queue outage');e._jobs.push(...batch);};
 const first=await post(e);assert.equal(first.httpStatus,503);assert.equal(e._files.size,1);
 const again=await post(e);assert.equal(again.httpStatus,200);assert.equal(e._files.size,1);assert.deepEqual(e._jobs,[{body:{kind:'preview_analysis',id:again.id}}]);
 await post(e);assert.equal(calls,2);
});

test('preview validates formats, signature, size and opaque repeat key before storing anything',async()=>{
 for(const opts of [{file:null},{key:null},{key:'short'},{file:drawing('fake.png')},{file:drawing('part.step','ISO-10303-21;')},{file:drawing('part.tiff','II*\0')},{file:drawing('part.iges','CAD original')}]){
  const e=environment(),r=await post(e,opts);assert.ok([400,415].includes(r.httpStatus));assert.equal(e._files.size,0);assert.equal(e._jobs.length,0);
  if(opts.file?.name==='part.step')assert.match(r.error,/PDF-Ansicht/);
 }
 const e=environment(),r=await post(e,{file:new File([new Uint8Array(15*1024*1024+1)],'big.pdf')});assert.equal(r.httpStatus,413);assert.equal(e._files.size,0);
 const bounded=await worker.fetch(new Request('https://worker.test/preview',{method:'POST',body:'x',headers:{'Content-Length':String(16*1024*1024)}}),e);assert.equal(bounded.status,413);
});

test('supported images and PDF retain media type and language without requiring email',async()=>{
 const cases=[['drawing.pdf','%PDF-1.7','application/pdf'],['drawing.png',new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'],['drawing.jpg',new Uint8Array([255,216,255,224]),'image/jpeg'],['drawing.webp','RIFF1234WEBP','image/webp']];
 for(const [name,content,type]of cases){const e=environment(),r=await post(e,{file:drawing(name,content),language:'it'});assert.equal(r.httpStatus,202);assert.equal((await record(e,r.id)).file.type,type);assert.equal((await(await state(e,r)).json()).language,'it');}
});

test('preview requires analysis dependencies and knowledge but not mail; origins and daily budget are enforced',async()=>{
 for(const field of ['ANTHROPIC_API_KEY','ANFRAGEN','DATEIEN','ZUGRIFF_SCHLUESSEL']){const e=environment();delete e[field];assert.equal((await post(e)).httpStatus,503);}
 const bad=environment();bad.SPEICHER.map.delete('regeln');assert.equal((await post(bad)).httpStatus,503);
 const e=environment();assert.equal((await post(e,{origin:'https://foreign.invalid'})).httpStatus,403);assert.equal(e._jobs.length,0);
 for(let i=0;i<10;i++)assert.equal((await post(e,{key:'preview-budget-key-'+i})).httpStatus,202);
 assert.equal((await post(e,{key:'preview-budget-key-10'})).httpStatus,429);assert.equal(e._jobs.length,10);
 assert.equal((await post(e,{key:'preview-budget-key-0'})).httpStatus,200,'cached replay does not consume another job');
});

test('preview uses the existing multimodal engine flow with saved price policy and no mail',async t=>{
 const e=environment(),r=await post(e,{notiz:'Bitte die Zeichnung auswerten.',pricePolicy:'with-prices'});let rounds=0;
 fetchMock(t,async(url,req)=>{
  assert.equal(url,'https://api.anthropic.com/v1/messages');const b=JSON.parse(req.body);
  assert.match(b.system,/keinerlei Maschinenpreise/);assert.ok(!JSON.stringify(b.messages).includes('987654'));
  assert.equal(b.messages[0].content[1].type,'document');assert.equal(b.messages[0].content[1].source.media_type,'application/pdf');
  if(rounds++===0)return reply(tool('projektwissen',{material:'C15C'}));
  if(rounds===2)return reply(tool('grobauslegung',drawingInput()));
  const result=JSON.parse(b.messages.at(-1).content[0].content);assert.equal(result.ok,true);assert.ok(result.proposal.machines.length);assert.ok(result.proposal.machines.every(m=>!Object.hasOwn(m,'priceEUR')));
  return reply(final('Stadienfolge und Maschinenkandidaten stehen bereit.'));
 });
 const m=job('preview_analysis',r.id);m.body.pricePolicy='with-prices';await worker.queue({messages:[m]},e);assert.equal(m.acks,1);assert.equal(rounds,3);
 const s=await(await state(e,r,LEGACY)).json();assert.equal(s.status,'ready');assert.equal(s.kind,'preview');assert.equal(s.pricePolicy,'technical-only');assert.equal(s.notificationStatus,'not_requested');assert.ok(s.proposal.machines.length);
 await worker.queue({messages:[job('preview_analysis',r.id),job('intake_mail',r.id),job('analysis',r.id)]},e);assert.equal(rounds,3,'duplicate or wrong queue kind cannot create a second analysis or mail');
});

test('ambiguous drawing returns needs_info; linked preview chat remains private and preserves policy',async t=>{
 const e=environment(),r=await post(e);let n=0;
 fetchMock(t,async(url,req)=>{assert.equal(url,'https://api.anthropic.com/v1/messages');assert.match(JSON.parse(req.body).system,/keinerlei Maschinenpreise/);return n++%2===0?reply(tool('projektwissen')):reply(final('Die Werkstoffangabe fehlt.',['Welcher Werkstoff ist vorgesehen?']));});
 await worker.queue({messages:[job('preview_analysis',r.id)]},e);assert.equal((await(await state(e,r)).json()).status,'needs_info');
 const response=await worker.fetch(new Request('https://worker.test/chat',{method:'POST',headers:{Origin:LEGACY},body:JSON.stringify({requestId:r.id,token:r.token,message:'C15C',pricePolicy:'with-prices'})}),e);
 assert.equal(response.status,200);assert.equal((await response.json()).pricePolicy,'technical-only');assert.equal(e._jobs.length,1);
});

test('preview failures stop after two deliveries and replay never restarts a failed model job',async t=>{
 const e=environment(),r=await post(e);let calls=0;fetchMock(t,async()=>{calls++;throw Error('Provider unavailable');});
 const first=job('preview_analysis',r.id);await worker.queue({messages:[first]},e);assert.equal(first.retries,1);assert.equal((await(await state(e,r)).json()).status,'queued');
 const last=job('preview_analysis',r.id,2);await worker.queue({messages:[last]},e);assert.equal(last.acks,1);assert.equal(last.retries,0);
 const failed=await(await state(e,r)).json();assert.equal(failed.status,'failed');assert.equal(failed.notificationStatus,'not_requested');assert.match(failed.answer,/Zeichnung/);
 await worker.queue({messages:[job('preview_analysis',r.id,3)]},e);assert.equal(calls,2);assert.equal((await post(e)).status,'failed');assert.equal(e._jobs.length,1);
});

test('new enquiries send only original attachment and note to fixed recipient, with no analysis dependency or call',async t=>{
 const e=environment();delete e.ANTHROPIC_API_KEY;e.SPEICHER.map.delete('regeln');Object.assign(e,{RESEND_API_KEY:'mock',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test'});
 const r=await post(e,{email:'buyer@example.test',notiz:'Anfrage für JBF-10B2S\nMeine Zeichnung',consent:'true'},'/anfrage');
 assert.equal(r.httpStatus,202);assert.equal(r.kind,'enquiry');assert.equal(r.status,'received');assert.equal(r.analysisStatus,'not_requested');assert.deepEqual(e._jobs,[{body:{kind:'intake_mail',id:r.id}}]);assert.equal(await e.SPEICHER.get('analyse:'+r.id),null);
 let mails=0;fetchMock(t,async(url,req)=>{assert.equal(url,'https://api.resend.com/emails');mails++;const b=JSON.parse(req.body);assert.deepEqual(b.to,['hans@example.test']);assert.equal(b.reply_to,'buyer@example.test');assert.match(b.text,/Anfrage für JBF-10B2S/);assert.ok(!b.text.includes('Analyse läuft'));assert.equal(b.attachments[0].filename,'drawing.pdf');assert.equal(atob(b.attachments[0].content),'%PDF-1.7 drawing');return Response.json({id:'accepted'});});
 await worker.queue({messages:[job('intake_mail',r.id),job('analysis',r.id),job('preview_analysis',r.id)]},e);assert.equal(mails,1);
 const s=await(await state(e,r)).json();assert.equal(s.kind,'enquiry');assert.equal(s.status,'received');assert.equal(s.analysisStatus,'not_requested');assert.equal(s.notificationStatus,'sent');assert.equal(s.proposal,null);
});

test('enquiry consent rejects explicit denial while published legacy clients remain compatible',async()=>{
 for(const consent of [undefined,'true','false']){
  const e=environment();Object.assign(e,{RESEND_API_KEY:'mock',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test'});
  const opts={email:'buyer@example.test',...(consent===undefined?{}:{consent})},r=await post(e,opts,'/anfrage');
  assert.equal(r.httpStatus,consent==='false'?400:202);
  if(consent!=='false'){const saved=await record(e,r.id);assert.equal(saved.consent,consent==='true');assert.equal(saved.consentSource,consent===undefined?'legacy-ui':'submitted');}
 }
});

test('legacy manual TIFF and IGES files remain mail attachments, never preview inputs',async()=>{
 for(const[name,content]of [['scan.tiff',new Uint8Array([73,73,42,0,0,0,0,0])],['scan.tif',new Uint8Array([77,77,0,42,0,0,0,0])],['part.igs','IGES original'],['part.iges','IGES original']]){
  const e=environment();Object.assign(e,{RESEND_API_KEY:'mock',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test'});
  const r=await post(e,{email:'buyer@example.test',file:drawing(name,content)},'/anfrage');assert.equal(r.httpStatus,202);assert.equal((await record(e,r.id)).file.readable,false);assert.equal((await post(e,{file:drawing(name,content)})).httpStatus,415);
 }
});

test('optional enquiry subject is bounded and single-line, reaches the mail provider, and changes idempotency',async t=>{
 const e=environment();Object.assign(e,{RESEND_API_KEY:'mock',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test'});
 const raw='Maschinenanfrage\r\nJBF-10B2S\0\t '+ 'x'.repeat(200),clean=('Maschinenanfrage JBF-10B2S '+ 'x'.repeat(200)).slice(0,160);
 const r=await post(e,{email:'buyer@example.test',betreff:raw},'/anfrage');assert.equal(r.httpStatus,202);assert.equal((await record(e,r.id)).subject,clean);
 fetchMock(t,async(url,req)=>{assert.equal(url,'https://api.resend.com/emails');const body=JSON.parse(req.body);assert.equal(body.subject,clean+' · '+r.id);assert.ok(!/[\r\n\0]/.test(body.subject));assert.deepEqual(body.to,['hans@example.test']);return Response.json({id:'accepted'});});
 await worker.queue({messages:[job('intake_mail',r.id)]},e);
 assert.equal((await post(e,{email:'buyer@example.test',betreff:raw},'/anfrage')).id,r.id);
 assert.equal((await post(e,{email:'buyer@example.test',betreff:'Maschinenanfrage JBF-13B4S'},'/anfrage')).httpStatus,409);
 assert.equal((await post(e,{email:'buyer@example.test'},'/anfrage')).httpStatus,409);
});

test('empty or absent subject preserves old request fingerprints and default mail subject; preview ignores it',async t=>{
 const e=environment();Object.assign(e,{RESEND_API_KEY:'mock',EMPFAENGER:'hans@example.test',ABSENDER:'site@example.test'});
 const r=await post(e,{email:'buyer@example.test'},'/anfrage');assert.equal((await record(e,r.id)).subject,undefined);
 const again=await post(e,{email:'buyer@example.test',betreff:'\r\n\t\0 '},'/anfrage');assert.equal(again.httpStatus,200);assert.equal(again.id,r.id);
 fetchMock(t,async(url,req)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(JSON.parse(req.body).subject,'Neue Umformanfrage · '+r.id);return Response.json({id:'accepted'});});
 await worker.queue({messages:[job('intake_mail',r.id)]},e);
 const p=await post(e,{betreff:'Do not send this'});assert.equal((await record(e,p.id)).subject,undefined);assert.equal((await post(e,{betreff:'Still not a mail'})).id,p.id);
});

test('a bounded preview loop with project knowledge ends as an honest follow-up, not a full-cost queue retry',async t=>{
 const e=environment(),r=await post(e);let calls=0;
 fetchMock(t,async()=>{calls++;return reply(tool('projektwissen'));});
 const m=job('preview_analysis',r.id);await worker.queue({messages:[m]},e);
 assert.equal(calls,7);assert.equal(m.acks,1);assert.equal(m.retries,0);
 const s=await(await state(e,r)).json();assert.equal(s.status,'needs_info');assert.equal(s.proposal,null);assert.ok(s.questions.length);assert.equal(s.notificationStatus,'not_requested');
 await worker.queue({messages:[job('preview_analysis',r.id,2)]},e);assert.equal(calls,7);
});
