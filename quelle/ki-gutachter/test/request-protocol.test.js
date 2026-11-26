import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{tokenFor} from '../worker.js';

const id='11111111-2222-4333-8444-555555555555';
function environment(origin='https://jern-yao.de'){
 const values=new Map([['regeln','Volumen prüfen.'],['wissenskarten','Stadien bestimmen.']]),writes=[];
 values.set('anfrage:'+id,JSON.stringify({id,kind:'preview',siteOrigin:origin,createdAt:new Date().toISOString(),note:'PRIVATE_CUSTOMER',language:'de'}));
 return {SPEICHER:{get:async k=>values.get(k)||null,put:async(k,v,options)=>{values.set(k,v);writes.push({k,options});}},values,writes,ANTHROPIC_API_KEY:'PRIVATE_KEY',ZUGRIFF_SCHLUESSEL:'test-secret-at-least-32-characters-long'};
}
const saved=e=>JSON.parse(e.values.get('analyse:'+id));
const job=attempts=>({body:{id,kind:'preview_analysis'},attempts,ack(){},retry(){}});
async function status(e,token=undefined){return worker.fetch(new Request('https://worker.test/status?id='+id+'&token='+(token||await tokenFor(e,id)),{headers:{Origin:'https://jern-yao.de'}}),e);}
function mock(t,fn){const original=globalThis.fetch;globalThis.fetch=fn;t.after(()=>{globalThis.fetch=original;});}

test('testfield retains bounded private attempt diagnostics and exposes only safe status categories',async t=>{
 const e=environment();mock(t,async()=>Response.json({stop_reason:'max_tokens',content:[{type:'text',text:'PRIVATE_OUTPUT'}]}));
 await worker.queue({messages:[job(1)]},e);
 assert.equal(saved(e).status,'queued');assert.equal(saved(e).diagnostics[0].code,'model_output_limit');assert.equal(saved(e).attempt,1);
 let response=await status(e),body=await response.json();assert.equal(body.processingInfo.retrying,true);assert.equal(body.processingInfo.failureCode,'model_output_limit');
 await worker.queue({messages:[job(2)]},e);
 assert.equal(saved(e).status,'failed');assert.equal(saved(e).diagnostics.length,2);
 response=await status(e);body=await response.json();assert.equal(body.processingInfo.attempt,2);assert.equal(body.processingInfo.retrying,false);
 for(const raw of [JSON.stringify(saved(e).diagnostics),JSON.stringify(body)])for(const forbidden of ['PRIVATE_OUTPUT','PRIVATE_CUSTOMER','PRIVATE_KEY','vendorRequestID','https://api'])assert.ok(!raw.includes(forbidden)||forbidden==='vendorRequestID'&&raw===JSON.stringify(saved(e).diagnostics));
 assert.equal(e.writes.filter(x=>x.k==='analyse:'+id).at(-1).options.expirationTtl,30*86400);
 assert.equal((await status(e,'wrong-token')).status,403);
});

test('successful retry retains its private failure history and publishes completed status',async t=>{
 const e=environment();let calls=0;mock(t,async()=>{
  if(calls++===0)throw new TypeError('PRIVATE_NETWORK');
  return Response.json({content:calls===2?[{type:'tool_use',name:'projektwissen',id:'knowledge',input:{}}]:[{type:'text',text:JSON.stringify({answer:'Welche Abmessungen hat das Teil?',questions:[],sourceIds:['konzept']})}]});
 });
 await worker.queue({messages:[job(1)]},e);await worker.queue({messages:[job(2)]},e);
 assert.equal(saved(e).status,'ready');assert.equal(saved(e).diagnostics.length,1);
 const body=await(await status(e)).json();assert.equal(body.processingInfo.attempt,2);assert.equal(body.processingInfo.retrying,false);assert.ok(!('diagnostics' in body));
});

test('released main-site requests expose safe retry status while unknown saved origins remain unchanged',async t=>{
 mock(t,async()=>{throw new TypeError('PRIVATE_NETWORK');});
 for(const origin of ['https://jernyao.de','https://www.jernyao.de',null]){
  const e=environment(origin);await worker.queue({messages:[job(2)]},e);const body=await(await status(e)).json();
  if(origin){assert.equal(saved(e).diagnostics.length,1);assert.equal(body.processingInfo.attempt,2);assert.equal(body.processingInfo.failureCode,'model_transport');assert.ok(!JSON.stringify(body).includes('PRIVATE_NETWORK'));}
  else{assert.equal(saved(e).diagnostics,undefined);assert.equal(body.processingInfo,undefined);}
 }
});
