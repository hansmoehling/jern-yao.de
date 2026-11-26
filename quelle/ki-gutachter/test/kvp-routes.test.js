import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import translations from '../../i18n-p7.json' with {type:'json'};

const features={klasse:'formteil',topologie:'kopf-schaft-napf',merkmale:{d0:8,L0_d0:2,werkstoffgruppe:'unlegiert-weich'}};
const feedback=()=>({featureVersion:'kvp-v1',optIn:true,source:'drawing',features,feedback:'passt',predictedStages:2});
const manifest={schemaVersion:1,version:'fixture-v1',freigegeben:true,freigabe:{von:'Hans',am:'2026-11-26'}};
const sample={id:'F-0001',...features,freigegeben:true,freigabe:manifest.freigabe,stadien:[{nr:1,operation:'Planstauchen'}],ergebnis:{status:'laeuft'},kunde:'PRIVATE_CUSTOMER',quelle:{ref:'PRIVATE_DRAWING'}};
function environment(){const values=new Map(),writes=[];return {SPEICHER:{values,writes,async get(k){return values.get(k)??null;},async put(k,v,options){values.set(k,v);writes.push({k,v,options});}}};}
function request(path,body,origin='https://jern-yao.de',headers={}){return new Request('https://worker.test'+path,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),'CF-Connecting-IP':'192.0.2.60',...headers},body:typeof body==='string'?body:JSON.stringify(body)});}
const saved=env=>env.SPEICHER.writes.filter(w=>w.k.startsWith('rueckmeldung:'));

test('feedback route uses existing storage without AI or email credentials',async()=>{
  const env=environment(),response=await worker.fetch(request('/rueckmeldung',feedback()),env),body=await response.json();
  assert.equal(response.status,202);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://jern-yao.de');assert.equal(body.knowledgeEligible,false);
  assert.equal(saved(env).length,1);const stored=JSON.parse(saved(env)[0].v);assert.equal(stored.approval,null);assert.equal(stored.source,'drawing');assert.equal(saved(env)[0].options,undefined);
  assert.ok(!JSON.stringify(stored).includes('192.0.2.60'));assert.equal(stored.featureVersion,undefined);
});

test('both KVP routes remain unavailable on the main domain and without exact origin',async()=>{
  for(const origin of ['https://jernyao.de','https://www.jernyao.de',null,'https://www.jern-yao.de'])for(const path of ['/rueckmeldung','/erfahrung']){
    const env=environment();env.ALLOWED_ORIGINS='https://www.jern-yao.de';
    const response=await worker.fetch(request(path,path==='/rueckmeldung'?feedback():{features},origin),env);
    assert.equal(response.status,404,`${path} ${origin}`);assert.equal(env.SPEICHER.writes.length,0);
  }
});

test('route requires opt-in, rejects private text and wrong version, and translates consent error',async()=>{
  const env=environment();
  for(const body of [{...feedback(),optIn:false},{...feedback(),customer:'PRIVATE_PERSON'},{...feedback(),text:'PRIVATE_DRAWING'},{...feedback(),featureVersion:'future'}]){
    const response=await worker.fetch(request('/rueckmeldung',body),env);assert.equal(response.status,400);
  }
  const response=await worker.fetch(request('/rueckmeldung',{...feedback(),optIn:false,language:'en'}),env);const result=await response.json();assert.match(result.error,/explicitly consent/);assert.equal(saved(env).length,0);
  for(const variants of Object.values(translations)){assert.equal(variants.length,4);assert.ok(variants.every(v=>typeof v==='string'&&v.length));}
});

test('bounded JSON and daily feedback throttle apply before intake writes',async()=>{
  const largeEnv=environment(),large=await worker.fetch(request('/rueckmeldung',' '.repeat(8193)),largeEnv);assert.equal(large.status,413);assert.equal(saved(largeEnv).length,0);
  const bad=await worker.fetch(request('/rueckmeldung','{'),largeEnv);assert.equal(bad.status,400);
  const env=environment();for(let i=0;i<30;i++)assert.equal((await worker.fetch(request('/rueckmeldung',feedback()),env)).status,202);
  const last=await worker.fetch(request('/rueckmeldung',feedback()),env);assert.equal(last.status,429);assert.equal(saved(env).length,30);
});

test('experience route has no fallback and no client-supplied approval path',async()=>{
  const env=environment();env.SPEICHER.values.set('konzept:manifest',JSON.stringify({...manifest,cases:[sample]}));
  let response=await worker.fetch(request('/erfahrung',{features}),env);let body=await response.json();assert.equal(response.status,200);assert.equal(body.status,'missing');assert.deepEqual(body.cases,[]);
  response=await worker.fetch(request('/erfahrung',{features,cases:[sample],manifest}),env);assert.equal(response.status,400);
  env.SPEICHER.values.set('kvp:manifest:kvp-v1',JSON.stringify({...manifest,freigegeben:false,cases:[sample]}));
  response=await worker.fetch(request('/erfahrung',{features}),env);body=await response.json();assert.equal(body.status,'pending-approval');assert.equal(body.cases.length,0);
});

test('experience returns only anonymous approved cases and never promotes proposals',async()=>{
  const env=environment();env.SPEICHER.values.set('kvp:manifest:kvp-v1',JSON.stringify({...manifest,cases:[sample,{...sample,id:'F-0002',freigegeben:false}],bands:[{active:false,status:'proposal',metric:'napf_t_d',lower:0.5,upper:2,n:10}]}));
  const response=await worker.fetch(request('/erfahrung',{features,k:3}),env),body=await response.json();assert.equal(response.status,200);assert.equal(body.cases.length,1);assert.deepEqual(body.experience.faelle,['F-0001']);assert.deepEqual(body.bands,[]);assert.ok(!JSON.stringify(body).includes('PRIVATE_'));assert.equal(saved(env).length,0);
});

test('a malformed approved snapshot fails closed rather than returning manufactured experience',async()=>{
  const env=environment();env.SPEICHER.values.set('kvp:manifest:kvp-v1',JSON.stringify({...manifest,casesKey:'anfrage:PRIVATE'}));
  const response=await worker.fetch(request('/erfahrung',{features}),env);assert.equal(response.status,503);const body=await response.json();assert.equal(body.cases,undefined);assert.ok(!JSON.stringify(body).includes('PRIVATE'));
});
