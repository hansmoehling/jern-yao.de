import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{tokenFor} from '../worker.js';
import {PUBLIC_KNOWLEDGE_VERSION} from '../knowledge-publication.js';
import I18N from '../../i18n.js';

const id='11111111-2222-4333-8444-555555555555';
const OLD='SYNTHETIC_RETIRED_PROJECT';
function environment(origin,language='de'){
 const data=new Map([['regeln','R1 General rule.'],['wissenskarten','K31 General forming knowledge.']]);
 data.set('anfrage:'+id,JSON.stringify({id,kind:'preview',createdAt:new Date().toISOString(),siteOrigin:origin,language}));
 return {data,SPEICHER:{get:async k=>data.get(k)||null,put:async(k,v)=>data.set(k,v)},ZUGRIFF_SCHLUESSEL:'test-secret-at-least-32-characters-long',ANTHROPIC_API_KEY:'mock'};
}
async function status(e,origin){return (await worker.fetch(new Request('https://worker.test/status?id='+id+'&token='+await tokenFor(e,id),{headers:{Origin:origin}}),e)).json();}

test('status withholds every field of older results on both sites without deleting the private record',async()=>{
 for(const origin of ['https://jern-yao.de','https://jernyao.de'])for(const language of I18N.supported){
  const e=environment(origin,language),saved=JSON.stringify({status:'ready',result:{answer:OLD,questions:[OLD],sources:[{label:OLD}],proposal:{assumptions:[OLD],machines:[{model:OLD}]},geometry:{detail:OLD},materialContext:{detail:OLD},language}});
  e.data.set('analyse:'+id,saved);
  const r=await status(e,origin);
  assert.equal(r.status,'failed');assert.equal(r.resultSuperseded,true);assert.equal(r.language,language);
  assert.equal(r.knowledgePublicationVersion,PUBLIC_KNOWLEDGE_VERSION);assert.doesNotMatch(JSON.stringify(r),/SYNTHETIC_RETIRED_PROJECT/);
  assert.equal(r.proposal,null);assert.deepEqual(r.sources,[]);assert.deepEqual(r.questions,[]);
  if(language!=='de')assert.doesNotMatch(r.answer,/frühere Auswertung/);
  assert.equal(e.data.get('analyse:'+id),saved);
  e.data.set('analyse:'+id,JSON.stringify({status:'ready',result:{answer:'A current engineering answer.',questions:[],sources:[],language,knowledgePublicationVersion:PUBLIC_KNOWLEDGE_VERSION}}));
  assert.equal((await status(e,origin)).answer,'A current engineering answer.');
 }
});

test('chat removes old assistant history, preserves current conversation and stamps stored replies',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original;});
 for(const linked of [false,true]){
  const origin='https://jernyao.de',e=environment(origin),history=[{role:'user',content:'My material is C15C.'},{role:'assistant',content:OLD},{role:'assistant',content:'Current public explanation.',knowledgePublicationVersion:PUBLIC_KNOWLEDGE_VERSION}];
  if(linked)e.data.set('chat:'+id,JSON.stringify(history));
  let calls=0;globalThis.fetch=async(_url,request)=>{
   const body=JSON.parse(request.body),customer=JSON.parse(body.messages[0].content[0].text);
   assert.equal(customer.message,'Please continue.');assert.deepEqual(customer.history,[history[0],history[2]]);
   assert.doesNotMatch(JSON.stringify(body.messages),/SYNTHETIC_RETIRED_PROJECT/);
   return Response.json({content:++calls===1?[{type:'tool_use',name:'projektwissen',id:'knowledge',input:{}}]:[{type:'text',text:JSON.stringify({answer:'A current explanation.',questions:[],sourceIds:['konzept']})}]});
  };
  const body={message:'Please continue.',history,...(linked?{requestId:id,token:await tokenFor(e,id)}:{})};
  const response=await worker.fetch(new Request('https://worker.test/chat',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}),e);
  assert.equal(response.status,200);assert.equal((await response.json()).knowledgePublicationVersion,PUBLIC_KNOWLEDGE_VERSION);
  if(linked){const saved=JSON.parse(e.data.get('chat:'+id));assert.equal(saved.at(-1).knowledgePublicationVersion,PUBLIC_KNOWLEDGE_VERSION);assert.doesNotMatch(JSON.stringify(saved),/SYNTHETIC_RETIRED_PROJECT/);}
 }
});
