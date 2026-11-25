import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {providerFailure,recordServiceDiagnostic} from '../analysis.js';

class KV{
 constructor(){this.values=new Map([['regeln','R-ST1: Fachregel'],['wissenskarten','K1: Fachwissen']]);this.writes=[];}
 async get(k){return this.values.get(k)||null;}
 async put(k,v,options){this.values.set(k,v);this.writes.push({k,v,options});}
}
const env=()=>({SPEICHER:new KV(),ANTHROPIC_API_KEY:'sk-ant-private-secret-never-record',RESEND_API_KEY:'re_private_mail_secret'});
const fetchMock=(t,fn)=>{const original=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=original;});};
const chat=body=>new Request('https://worker.test/chat',{method:'POST',body:JSON.stringify(body)});
const event=e=>JSON.parse(e.SPEICHER.values.get('diagnose:last:chat'));

test('provider diagnostics retain safe type/status/request ID, never secrets, customer data or URL tokens',async t=>{
 const e=env();
 const privateText='CUSTOMER_WIDGET_789; Alice Buyer; buyer@example.test; +38640123456; https://files.example.test/drawing?token=PRIVATE_TOKEN';
 fetchMock(t,async()=>Response.json({error:{type:'invalid_request_error',message:'tool_choice: forced tool use is incompatible with thinking. '+e.ANTHROPIC_API_KEY+' '+e.RESEND_API_KEY+' '+privateText}},{status:400,headers:{'request-id':'req_0123456789abcdef'}}));
 const response=await worker.fetch(chat({message:privateText,history:[{role:'user',content:'PRIVATE_HISTORY'}]}),e);
 assert.equal(response.status,503);assert.deepEqual(Object.keys(await response.json()).sort(),['error','language']);
 const d=event(e),saved=JSON.stringify(d);
 assert.equal(d.code,'model_provider_400');assert.equal(d.type,'invalid_request_error');assert.equal(d.status,400);assert.equal(d.vendorRequestID,'req_0123456789abcdef');assert.equal(d.classification,'forced_tool_thinking_conflict');
 assert.ok(d.message.length<=400);assert.ok(Number.isFinite(Date.parse(d.timestamp)));
 for(const forbidden of [e.ANTHROPIC_API_KEY,e.RESEND_API_KEY,'CUSTOMER_WIDGET_789','Alice','buyer@','38640123456','PRIVATE_TOKEN','PRIVATE_HISTORY','https://','tool_choice:'])assert.ok(!saved.includes(forbidden),forbidden);
 assert.equal(e.SPEICHER.writes.find(x=>x.k==='diagnose:last:chat').options.expirationTtl,3600);
});

test('known provider failures distinguish model, schema, token, credit and access categories without raw text',async()=>{
 const fixtures=[['model: sample-model not found','model_unavailable'],['input_schema: additionalProperties must be false','schema_invalid'],['max_tokens exceeds allowed output','max_tokens_invalid'],['Your credit balance is too low','insufficient_credit'],['Permission denied for this account','access_denied'],['tool_choice must be auto','tool_choice_invalid'],['Thinking block is bound to a different conversation because tools changed','thinking_prefix_mismatch']];
 for(const [message,classification]of fixtures){const e=env();const error=await providerFailure(Response.json({error:{type:'invalid_request_error',message}},{status:400,headers:{'request-id':'https://private.test/?token=SECRET'}}));await recordServiceDiagnostic(e,error,'chat');assert.equal(event(e).classification,classification);assert.equal(event(e).vendorRequestID,null);}
});

test('chat transport, timeout and exhausted rounds receive distinct private codes',async t=>{
 const e=env();let mode='transport',round=0;
 fetchMock(t,async()=>{if(mode==='transport')throw new TypeError('network failure with sk-ant-secret and buyer@example.test');if(mode==='timeout')throw new DOMException('private timeout text','TimeoutError');return Response.json({content:round++===0?[{type:'tool_use',name:'projektwissen',id:'knowledge',input:{}}]:[]});});
 for(const [value,code]of [['transport','model_transport'],['timeout','model_timeout'],['rounds','model_round_limit']]){mode=value;const response=await worker.fetch(chat({message:'Neutral test'}),e);assert.equal(response.status,503);assert.equal(event(e).code,code);assert.ok(!JSON.stringify(event(e)).includes('buyer@'));}
});

test('queued model failure records a diagnostic without intake fields or queue identifiers',async t=>{
 const e=env(),id='11111111-2222-4333-8444-555555555555';
 e.SPEICHER.values.set('anfrage:'+id,JSON.stringify({id,createdAt:new Date().toISOString(),email:'PRIVATE_EMAIL@example.test',name:'PRIVATE_NAME',note:'PRIVATE_DRAWING_DIMENSIONS',language:'de'}));
 fetchMock(t,async()=>Response.json({error:{type:'authentication_error',message:'Invalid x-api-key sk-ant-PRIVATE_SECRET'}},{status:401}));
 let retried=false;await worker.queue({messages:[{body:{id,kind:'analysis'},attempts:1,ack(){},retry(){retried=true;}}]},e);
 assert.equal(retried,true);const raw=e.SPEICHER.values.get('diagnose:last:queue'),d=JSON.parse(raw);assert.equal(d.code,'model_provider_401');assert.equal(d.classification,'authentication_failed');
 for(const value of [id,'PRIVATE_EMAIL','PRIVATE_NAME','PRIVATE_DRAWING','PRIVATE_SECRET'])assert.ok(!raw.includes(value));
});

test('validation and successful chat create no diagnostic; a failed diagnostic write is nonfatal',async t=>{
 const e=env();let calls=0;
 fetchMock(t,async()=>Response.json({content:calls++===0?[{type:'tool_use',name:'projektwissen',id:'knowledge',input:{}}]:[{type:'text',text:JSON.stringify({answer:'Welche Abmessungen hat das Teil?',questions:[],sourceIds:[]})}]}));
 assert.equal((await worker.fetch(chat({message:''}),e)).status,400);
 assert.equal((await worker.fetch(chat({message:'Neutral test'}),e)).status,200);
 assert.equal(e.SPEICHER.writes.some(x=>x.k.startsWith('diagnose:')),false);
 await recordServiceDiagnostic({SPEICHER:{put:async()=>{throw Error('storage unavailable');}}},new Error('model_round_limit'),'chat');
});
