import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import catalog from '../../maschinen.json' with {type:'json'};
import practice from '../../praxis.json' with {type:'json'};
import R from '../../machine-ranking.js';

const names=['JBF-10B2S','JBF-10B2SL','JBF-10B2SXL','JBF-10B3S','JBF-13B2S'];
const candidate=model=>({model,status:'ok',suitability:{force:0.8,stations:1,size:0.9,length:0.8,output:1}});
const input=()=>({featureVersion:'kvp-v1',candidates:names.map(candidate)});
function env(){const map=new Map();return {SPEICHER:{map,async get(k){return map.get(k)??null;},async put(k,v){map.set(k,v);}}};}
const request=(body,origin='https://jern-yao.de')=>new Request('https://worker.test/rangfolge',{method:'POST',headers:{...(origin?{Origin:origin}:{}),'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.74'},body:typeof body==='string'?body:JSON.stringify(body)});
async function post(body,environment=env(),origin){const response=await worker.fetch(request(body,origin),environment);return {response,body:await response.json()};}

test('ranking endpoint uses server prices and returns the same recommendation and diverse alternatives',async()=>{
 const {response,body}=await post(input());assert.equal(response.status,200);assert.equal(body.version,'ranking-v1');assert.equal(body.basis,'submitted-technical-status');
 const ranked=R.rankMachines(catalog.filter(m=>names.includes(m.m)),{checkMachine:()=>({gesamt:'ok',k:[]}),practice});
 const expected=[ranked.recommendation,...ranked.alternatives].map(r=>r.o.m);assert.deepEqual(body.models.map(x=>x.model),expected);assert.equal(body.models.length,3);assert.equal(body.models[0].comparison,null);
 assert.ok(body.models.slice(1).some(x=>catalog.find(m=>m.m===x.model).st!==2));
});

test('response contains only the displayed model names and rounded relative comparisons',async()=>{
 const {body}=await post({...input(),demandPerMinute:30});assert.deepEqual(Object.keys(body).sort(),['basis','models','priceRankingComplete','version']);assert.equal(body.priceRankingComplete,true);
 const prohibited=new Set(['rp','lo','hi','priceEUR','priceRangeEUR','candidates','ranking','score','suitability','catalog','all','referenceOutput','alternativeOutput']);
 function visit(v){if(!v||typeof v!=='object')return;for(const [k,value]of Object.entries(v)){assert.ok(!prohibited.has(k),k);visit(value);}}
 visit(body);
 for(const row of body.models){assert.deepEqual(Object.keys(row).sort(),['comparison','model']);if(!row.comparison)continue;for(const metric of ['price','efficiency']){const change=row.comparison[metric];if(change){assert.equal(change.percent%5,0);assert.ok(Number.isFinite(change.percent));assert.deepEqual(Object.keys(change).sort(),['direction','percent']);}}}
 const serialized=JSON.stringify(body);for(const m of catalog.filter(m=>names.includes(m.m)))assert.ok(!serialized.includes(String(m.rp)),m.m);
});

test('strict schema rejects unknown models, duplicates, extra fields and invalid scores',async()=>{
 const wrong=[{...input(),pricePolicy:'with-prices'},{...input(),featureVersion:'ranking-v1'},{candidates:names.map(candidate)},{...input(),demandPerMinute:0},{...input(),candidates:[candidate('JBF-999B9S')]},{...input(),candidates:[candidate(names[0]),candidate(names[0])]},{...input(),candidates:[{...candidate(names[0]),priceEUR:1}]},{...input(),candidates:[{...candidate(names[0]),reason:'PRIVATE_TEXT'}]}];
 for(const suitability of [{},{force:1.01},{force:-1},{force:'1'},{force:null},{force:1,private:'SECRET'}])wrong.push({...input(),candidates:[{...candidate(names[0]),suitability}]});
 for(const payload of wrong){const {response,body}=await post(payload);assert.equal(response.status,400,JSON.stringify(payload));assert.equal(body.models,undefined);assert.ok(!JSON.stringify(body).includes('PRIVATE_TEXT'));}
});

test('candidate count and body bounds are enforced before evaluation',async()=>{
 assert.equal((await post({...input(),candidates:[]})).response.status,400);
 assert.equal((await post({...input(),candidates:catalog.slice(0,13).map(m=>candidate(m.m))})).response.status,400);
 assert.equal((await post({...input(),candidates:catalog.slice(0,12).map(m=>candidate(m.m))})).response.status,200);
 assert.equal((await post(' '.repeat(8193))).response.status,413);
});

test('released price-free sites share the server recommendation without receiving absolute prices',async()=>{
 const expected=(await post(input())).body;
 for(const origin of ['https://jernyao.de','https://www.jernyao.de']){
  const {response,body}=await post(input(),env(),origin);assert.equal(response.status,200);assert.deepEqual(body,expected);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.ok(!/"(?:rp|lo|hi|priceEUR|priceRangeEUR)"/.test(JSON.stringify(body)));
 }
});

test('additional CORS origins and missing origins cannot enable the comparison route',async()=>{
 for(const origin of ['https://www.jern-yao.de',null]){
  const environment=env();environment.ALLOWED_ORIGINS='https://www.jern-yao.de';
  const {response}=await post(input(),environment,origin);assert.equal(response.status,404);assert.equal(environment.SPEICHER.map.size,0);
 }
});

test('submitted exclusions and verified rotative transfer stay excluded',async t=>{
 const no=input();no.candidates=no.candidates.map(c=>({...c,status:'nein'}));assert.deepEqual((await post(no)).body.models,[]);
 const row=catalog.find(m=>m.m===names[0]),old=row.ausfuehrung;row.ausfuehrung={transfer:{value:'rotativ',status:'verified'}};t.after(()=>{if(old===undefined)delete row.ausfuehrung;else row.ausfuehrung=old;});
 const {body}=await post(input());assert.ok(!body.models.some(x=>x.model===row.m));
});

test('fully assessed candidates precede cheaper candidates with open technical points',async()=>{
 const body=input();body.candidates=body.candidates.map(c=>({...c,status:c.model==='JBF-13B2S'?'ok':'offen'}));
 assert.equal((await post(body)).body.models[0].model,'JBF-13B2S');
});

test('ranking requests use the bounded existing storage throttle',async()=>{
 const environment=env();for(let i=0;i<60;i++)assert.equal((await post(input(),environment)).response.status,200);
 assert.equal((await post(input(),environment)).response.status,429);
 assert.ok([...environment.SPEICHER.map.keys()].every(k=>k.startsWith('rate:ranking-v1:')));
});
