'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const W=require('../wire-optimization.js');
const R=require('../machine-ranking.js');
const E=require('../engine.js');
const translations=require('../i18n-p6-wire.json');
const machine=(m,rp,st=3,out=300)=>({m,f:'JBF',rp,st,out,cd:10,cl:[5,100],ml:80,ko:80,pw:100,sz:'M6'});
const baseInput={d0:6,wst:0,curveId:'soft-fixture',materialState:'soft-annealed',rm:350,soll:{ausbringung:30},geometrySpec:{elements:[{shape:'cylinder',diameter:10,length:12}],partingPlane:3},notes:{unchanged:'keep'}};
function setup(config={}){
  const catalogue=[machine('JBF-10B3S',100),machine('JBF-10B2S',80,2),machine('JBF-7B2S',70,2),machine('JBF-13B3S',90),machine('JBF-17B3S',50)];
  const target={6:0,5:1,4:2,7:3,8:4},calls={auslegen:[],waehle:[]};
  const engine={WERKSTOFFE:[{flowCurves:[{id:'soft-fixture',state:config.curveState||'soft-annealed'}]}],
    selectFlow(material,e){const curve=material.flowCurves.find(x=>x.id===e.curveId);return {status:curve&&e.materialState===curve.state?'ready':'state-mismatch',curve};},
    auslegen(e){calls.auslegen.push(structuredClone(e));return {werte:{d0:e.d0,Fmax_t:10,Fsum_t:20,forceReason:null,stationen:2,L0:25,...config.values?.[e.d0]},stufen:[{},{}],werkstoff:{id:'fixture'},fehlt:config.missing?.[e.d0]||[],qualitative:config.qualitative===true};},
    waehle(catalogue,a,e,practice){
      calls.waehle.push(structuredClone(e));
      const ranking=R.rankMachines(catalogue,{practice,requirements:{stations:a.werte.stationen},checkMachine:o=>({gesamt:o===catalogue[target[e.d0]]?(config.status?.[e.d0]||'ok'):'nein',k:[{krit:'Presskraft',status:o===catalogue[target[e.d0]]?(config.status?.[e.d0]||'ok'):'nein'}]})});
      return {ranking,alle:ranking.all};
    }};
  return {engine,catalogue,practice:{quote:0.35},input:structuredClone(baseInput),calls};
}
function run(config={},candidates=[{value:5},{value:4},{value:7},{value:8}]){const env=setup(config);return {env,result:W.evaluateVariants({...env,candidates})};}
const byValue=(result,d)=>result.evaluated.find(v=>v.value===d);

test('each unique positive candidate is recomputed with ranking policy; original part and state stay unchanged',()=>{
  const env=setup(),original=structuredClone(env.input),candidates=[{value:5},{value:5},{value:6},{value:-1},{value:0},{value:NaN},{value:'4'},{value:4}],saved=structuredClone(candidates);
  const result=W.evaluateVariants({...env,candidates});
  assert.deepEqual(env.input,original);assert.deepEqual(candidates,saved);
  assert.deepEqual(env.calls.auslegen.map(e=>e.d0),[6,5,4]);assert.deepEqual(env.calls.waehle.map(e=>e.d0),[6,5,4]);
  assert.deepEqual(result.evaluated.map(v=>v.value),[5,6,4]);
  for(const record of result.evaluated){assert.deepEqual(record.e,{...original,d0:record.value,machinePolicy:'ranking-v1'});assert.ok(record.rows.length);}
  assert.equal(byValue(result,6).status,'unchanged');
  assert.equal(result.thresholdPercent,10);assert.equal(result.thresholdStatus,'provisional');
  assert.ok(result.suggestions.length<=2);
});

test('wire comparisons retain the versioned ranking policy for baseline and every alternative',()=>{
  const env=setup();env.input.machinePolicy='ranking-v2';
  const original=structuredClone(env.input);
  const result=W.evaluateVariants({...env,candidates:[{value:5},{value:7}]});
  assert.deepEqual(env.input,original);
  assert.equal(result.baseline.e.machinePolicy,'ranking-v2');
  for(const input of [...env.calls.auslegen,...env.calls.waehle])assert.equal(input.machinePolicy,'ranking-v2');
  for(const variant of result.evaluated)assert.equal(variant.e.machinePolicy,'ranking-v2');
});

test('two best significant improvements use unrounded gain for ranking but only rounded public comparisons',()=>{
  const {result}=run();
  assert.deepEqual(result.suggestions.map(v=>v.value),[8,4]);
  assert.equal(byValue(result,5).status,'improvement');
  assert.deepEqual(byValue(result,5).compare.efficiency,{direction:'higher',percent:25});
  assert.equal(result.suggestions[0].compare.basis.demandCap,30);
  assert.equal(result.suggestions[0].compare.basis.factor,0.35);
  assert.ok(!Object.hasOwn(result.suggestions[0],'gain'));
});

test('ok and knapp remain economically comparable while lost reserve and marginal checks are explicit',()=>{
  const {result}=run({status:{5:'knapp'}},[{value:5}]),variant=byValue(result,5);
  assert.equal(variant.status,'improvement');assert.equal(result.suggestions.length,1);
  assert.ok(variant.technicalChanges.some(x=>x.code==='near-limit'));
  assert.ok(variant.technicalChanges.some(x=>x.code==='no-spare-station'&&x.from===1&&x.to===0));
  assert.ok(variant.technicalChanges.some(x=>x.code==='check-near-limit'&&x.criterion==='Presskraft'));
});

test('known force becoming open and all-force-missing inputs never become economic suggestions',()=>{
  const changed=run({values:{5:{Fmax_t:null,Fsum_t:null,forceReason:'outside curve'}}},[{value:5}]).result;
  assert.equal(byValue(changed,5).reasonCode,'force-became-open');assert.equal(byValue(changed,5).compare,null);assert.equal(changed.suggestions.length,0);
  const missing=run({values:{6:{Fmax_t:null,Fsum_t:null}}},[{value:5}]).result;
  assert.equal(byValue(missing,5).reasonCode,'force-pending');assert.equal(missing.suggestions.length,0);
  const qualitative=run({qualitative:true},[{value:5}]).result;
  assert.equal(qualitative.suggestions.length,0);assert.equal(byValue(qualitative,5).status,'concept');
});

test('thinner wire needs the actual matching soft-annealed curve; the material is never relabelled',()=>{
  for(const state of ['normalized-rolled','cold-drawn']){
    const env=setup({curveState:state});env.input.materialState=state;
    const result=W.evaluateVariants({...env,candidates:[{value:5},{value:7}]});
    const thin=byValue(result,5);assert.equal(thin.status,'concept');assert.equal(thin.needsAnneal,true);assert.equal(thin.compare,null);
    assert.equal(thin.e.materialState,state);assert.equal(env.calls.auslegen[1].materialState,state);
    assert.equal(byValue(result,7).needsAnneal,false);
  }
  const mismatch=setup({curveState:'normalized-rolled'});
  assert.equal(byValue(W.evaluateVariants({...mismatch,candidates:[{value:5}]}),5).needsAnneal,true);
  const matched=run({},[{value:5}]).result;
  assert.equal(byValue(matched,5).needsAnneal,false);assert.equal(byValue(matched,5).status,'improvement');
});

test('hard failures and deterioration to open technical status are not savings',()=>{
  const rejected=run({status:{5:'nein',7:'offen'}},[{value:5},{value:7}]).result;
  assert.equal(rejected.suggestions.length,0);
  assert.equal(byValue(rejected,5).reasonCode,'no-admissible-machine');
  assert.equal(byValue(rejected,7).reasonCode,'technical-tier-worse');
});

test('a rounded 10 percent display does not turn an actual 9 percent improvement into a suggestion',()=>{
  const env=setup();env.catalogue[1].rp=100/1.09;
  const result=W.evaluateVariants({...env,candidates:[{value:5}]});
  assert.equal(byValue(result,5).compare.efficiency.percent,10);
  assert.equal(byValue(result,5).status,'insignificant');assert.equal(result.suggestions.length,0);
  const configured=W.evaluateVariants({...env,candidates:[{value:5}],thresholdPercent:8});
  assert.equal(configured.suggestions.length,1);assert.equal(configured.thresholdPercent,8);
});

test('demand cap prevents surplus capacity from generating a fabricated investment benefit',()=>{
  const env=setup();env.catalogue[1].rp=105;env.catalogue[1].out=600;
  const capped=W.evaluateVariants({...env,candidates:[{value:5}]});
  assert.equal(capped.suggestions.length,0);assert.equal(byValue(capped,5).compare.efficiency.direction,'lower');
  delete env.input.soll.ausbringung;
  const uncapped=W.evaluateVariants({...env,candidates:[{value:5}]});assert.equal(uncapped.suggestions.length,1);
  assert.equal(byValue(uncapped,5).compare.basis.demandCap,null);
});

test('missing price or common output basis stays a concept and incomplete routes remain unavailable',()=>{
  const env=setup();delete env.catalogue[1].rp;
  const noPrice=W.evaluateVariants({...env,candidates:[{value:5}]});assert.equal(byValue(noPrice,5).reasonCode,'economic-basis-pending');
  const noOutput=setup();delete noOutput.practice.quote;
  assert.equal(byValue(W.evaluateVariants({...noOutput,candidates:[{value:5}]}),5).reasonCode,'economic-basis-pending');
  const invalid=run({missing:{5:['rod diameter must exceed wire']}},[{value:5}]).result;
  assert.equal(byValue(invalid,5).status,'unavailable');assert.equal(invalid.suggestions.length,0);
});

test('real engine recomputes all catalogue checks without changing the supplied component',()=>{
  const catalogue=require('../maschinen.json'),practice=require('../praxis.json'),wst=E.WERKSTOFFE.findIndex(m=>m.id==='C4C');
  const input={typ:'formteil',wst,curveId:E.WERKSTOFFE[wst].flowCurves[0].id,materialState:'soft-annealed',d0:10,sD:10,sL:30,nD:5,nT:20,rm:350,machinePolicy:'ranking-v1'};
  const original=structuredClone(input),analysis=E.auslegen(input),selection=E.waehle(catalogue,analysis,input,practice);
  const result=W.evaluateVariants({engine:E,catalogue,practice,input,analysis,selection,candidates:[{value:9},{value:11}]});
  assert.deepEqual(input,original);assert.equal(result.evaluated.length,2);
  for(const variant of result.evaluated){assert.equal(variant.selection.ranking.checkedCount,329);assert.deepEqual(variant.e,{...input,d0:variant.value});assert.equal(variant.aus.werte.V,analysis.werte.V);}
});

test('reason translations preserve placeholders in all four languages and browser API is independent of DOM',()=>{
  const placeholders=s=>[...s.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort();
  for(const[key,values]of Object.entries(translations)){assert.equal(values.length,4);for(const value of values)assert.deepEqual(placeholders(value),placeholders(key));}
  const context={};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../machine-ranking.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../wire-optimization.js'),'utf8'),context);
  assert.equal(context.JYWireOptimization.DEFAULT_THRESHOLD_PERCENT,10);
  const env=setup(),result=context.JYWireOptimization.evaluateVariants({...env,candidates:[{value:5}]});
  assert.equal(result.suggestions.length,1);
  for(const record of result.evaluated){assert.ok(translations[record.reason]);for(const change of record.technicalChanges)assert.ok(translations[change.reason]);}
});
