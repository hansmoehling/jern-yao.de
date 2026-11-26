'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const R=require('../machine-ranking.js');
const E=require('../engine.js');
const catalogue=require('../maschinen.json');
const practice=require('../praxis.json');
const row=m=>catalogue.find(o=>o.m===m);
const checked=(status='ok',ausl=0.6)=>({k:[{krit:'Technical fixture',status}],gesamt:status,ausl});
const machine=(m,rp,extra={})=>({m,f:m.split('-')[0],st:3,cd:8,cl:[10,70],ko:60,ml:50,sz:'M6',pw:40,out:300,rp,...extra});
const requirements={forceTonnes:24,stations:2,blankDiameter:5.6,blankLength:36,partLength:30,knockoutLength:30,partSize:6};

test('all 329 actual catalogue rows are checked, with no product/family gate',()=>{
  const wst=E.WERKSTOFFE.findIndex(w=>w.id==='C4C'),curveId=E.WERKSTOFFE[wst].flowCurves[0].id;
  const input={typ:'formteil',wst,curveId,materialState:'soft-annealed',d0:10,sD:10,sL:30,nD:5,nT:20,rm:350};
  const analysis=E.auslegen(input);assert.equal(analysis.fehlt.length,0);
  const visited=[];
  const result=R.rankMachines(catalogue,{checkMachine:o=>{visited.push(o.m);return E.pruefe(o,analysis,input,practice);},requirements:{
    forceTonnes:analysis.werte.Fmax_t,stations:analysis.werte.stationen,blankDiameter:analysis.werte.d0,blankLength:analysis.werte.L0,partLength:analysis.werte.Lteil,knockoutLength:analysis.werte.ko
  },practice});
  assert.equal(visited.length,329);
  assert.equal(new Set(visited).size,329);
  assert.equal(result.checkedCount,329);
  assert.deepEqual(new Set(result.all.map(r=>r.o.f)),new Set(catalogue.map(o=>o.f)));
  assert.ok(result.all.some(r=>r.gesamt==='nein'));
  assert.ok(result.candidates.length>0);
  assert.ok(result.candidates.every(r=>r.gesamt!=='nein'&&r.k.every(k=>k.status!=='nein')));
  assert.ok(result.alternatives.length<=2);
  assert.equal(result.candidates.length,result.additional.length+result.alternatives.length+1);
});

test('cheapest technically admissible machine wins even at 95% capacity; hard failures never do',()=>{
  const c=[machine('JBF-10B3S',100),machine('JPF-10B3S',80),machine('JNF-10B3S',1),machine('JNP-10B3S',2)];
  const r=R.rankMachines(c,{checkMachine:o=>o.f==='JPF'?checked('knapp',0.95):o.f==='JNF'?checked('nein',1.3):o.f==='JNP'?checked('offen',null):checked(),requirements,practice});
  assert.equal(r.recommendation.o.m,'JPF-10B3S');
  assert.equal(r.recommendation.ranking.classification,'B');
  assert.equal(r.alternatives[0].o.m,'JBF-10B3S');
  assert.ok(!r.candidates.some(x=>x.o.f==='JNF'));
  assert.equal(r.alternatives[1].gesamt,'offen');
  assert.equal(r.priceRankingComplete,true);
});

test('missing prices use a consistent technical fallback and never claim cheapest',()=>{
  const c=[machine('JBF-10B3S',100),machine('JPF-10B3S',undefined,{st:2}),machine('JNF-10B3S',1,{st:5})];
  const r=R.rankMachines(c,{checkMachine:()=>checked(),requirements,practice});
  assert.equal(r.recommendation.o.m,'JBF-10B3S');
  assert.equal(r.rankingBasis,'technical-fallback');
  assert.equal(r.priceRankingComplete,false);
  assert.ok(r.uncertainties.some(x=>x.code==='complete-price-order-unavailable'));
  const noPrices=R.rankMachines(c,{checkMachine:()=>checked(),requirements,practice,priceMode:'none'});
  assert.equal(noPrices.rankingBasis,'technical-fallback');
});

test('only evidenced rotary transfer excludes; family names and unsupported knife claims cannot',()=>{
  const c=[machine('JBF-10B3S',1),machine('JNF-10B3S',2),machine('JNP-10B3S',3),machine('JPF-10B3S',4),machine('JBP-10B3S',5)];
  const profiles={
    'JBF-10B3S':{transfer:{value:'universal',status:'verified',sourceRefs:['fixture']}},
    'JNF-10B3S':{transfer:'rotativ'},
    'JNP-10B3S':{transfer:{value:'rotativ',status:'verified',sourceRefs:['fixture']}},
    'JPF-10B3S':{messer:{value:'offen',status:'verified',sourceRefs:['fixture']}}
  };
  const r=R.rankMachines(c,{checkMachine:()=>checked(),requirements,profiles,practice});
  assert.equal(r.recommendation.o.f,'JBF');
  assert.equal(r.recommendation.execution.transfer,'universal');
  assert.ok(r.candidates.some(x=>x.o.f==='JNF'),'an unproved family-based rotary claim must not exclude');
  assert.equal(r.all.find(x=>x.o.f==='JNP').gesamt,'nein');
  assert.ok(r.all.find(x=>x.o.f==='JNP').k.some(x=>x.code==='rotative-transfer-not-offered'));
  assert.ok(r.alternatives.find(x=>x.o.f==='JPF').requestPoints.some(x=>x.code==='closed-knife-variant-required'));
  assert.ok(r.additional.every(x=>x.requestPoints.length===0),'execution enquiries only for displayed cards');
});

test('oversizing and missing catalogue data remain explicit without synthetic values',()=>{
  const c=[machine('JBF-10B3S',100,{pw:500,cd:30,cl:undefined,sz:undefined})];
  const r=R.rankMachines(c,{checkMachine:()=>checked('offen',0.01),requirements,practice}).recommendation;
  assert.equal(r.ranking.oversized,true);
  assert.equal(r.ranking.classification,'C');
  assert.ok(r.ranking.uncertainties.some(x=>x.code==='catalogue-size-missing'));
  assert.ok(r.ranking.uncertainties.some(x=>x.code==='length-capacity-missing'&&x.dimension==='blank'));
  assert.equal(r.o.cl,undefined);
});

test('AE comparison uses the same basis for both: one practice value cannot bias the pair',()=>{
  const r=R.compareVariants(row('JBF-10B3S'),row('JBF-10B2S'),{practice});
  assert.deepEqual(r.price,{direction:'cheaper',percent:20});
  assert.deepEqual(r.efficiency,{direction:'higher',percent:30});
  assert.equal(r.connector,'and');
  assert.equal(r.basis.source,'catalog-factor');
  assert.equal(r.basis.factor,0.35);
  assert.equal(r.basis.toolCostsIncluded,false);
});

test('demand cap removes the amortization benefit of unusable excess output',()=>{
  const a=machine('JBF-10B3S',100,{out:100}),b=machine('JBF-10B2S',100,{out:200});
  assert.deepEqual(R.compareVariants(a,b,{practice:{quote:0.5}}).efficiency,{direction:'higher',percent:100});
  const capped=R.compareVariants(a,b,{practice:{quote:0.5},demandPerMinute:30});
  assert.deepEqual(capped.efficiency,{direction:'same',percent:0});
  assert.equal(capped.basis.demandCap,30);
  const empirical=R.compareVariants(a,b,{practice:{quote:0.5,modelle:{[a.m]:40,[b.m]:60}}});
  assert.equal(empirical.basis.source,'practice-pair');
  assert.deepEqual(empirical.efficiency,{direction:'higher',percent:50});
});

test('comparison rounds at 5%, uses the 3% equality threshold and cannot invent missing inputs',()=>{
  const a=machine('JBF-10B3S',100),b=machine('JBF-10B2S',102.9);
  assert.deepEqual(R.compareVariants(a,b,{practice}).price,{direction:'same',percent:0});
  const cheaperSlower=R.compareVariants(a,{...b,rp:80,out:100},{practice});
  assert.equal(cheaperSlower.connector,'but');
  assert.equal(R.compareVariants(a,{...b,rp:null},{practice}).price,null);
  assert.equal(R.compareVariants(a,b,{practice:{}}).efficiency,null);
  assert.equal(R.compareVariants(a,b,{priceMode:'none',practice}).price,null);
  const serialized=JSON.stringify(R.compareVariants(a,b,{practice}));
  assert.doesNotMatch(serialized,/"(?:rp|lo|hi|rawPercent|absolutePrice)"/);
});

test('raster parses all 329 names and uses real neighbours and their failure reasons',()=>{
  for(const o of catalogue){const p=R.parseModel(o.m);assert.ok(p,o.m);assert.equal(p.stations,o.st,o.m);}
  assert.equal(R.parseModel('unrecognised model'),null);
  const result=R.rankMachines(catalogue,{checkMachine:o=>checked(o.cd<5.6?'nein':'ok'),requirements,practice});
  const grid=R.gridFor(result,'JBF-10B3S');
  assert.equal(grid.neighbours.find(x=>x.direction==='smaller').model,'JBF-7B3S');
  assert.equal(grid.neighbours.find(x=>x.direction==='smaller').status,'nein');
  assert.equal(grid.neighbours.find(x=>x.direction==='fewer-stations').model,'JBF-10B2S');
  assert.equal(grid.neighbours.find(x=>x.direction==='more-stations').model,'JBF-10B4S');
  assert.equal(grid.neighbours.find(x=>x.direction==='longer').model,'JBF-10B3SL');
  assert.equal(grid.cells.filter(x=>x.selected).length,1);
  assert.ok(grid.cells.every(x=>row(x.model)));
  assert.equal(R.gridFor(result,'invented'),null);
});

test('ranking does not mutate the catalogue, checks, or private Hans profiles',()=>{
  const c=[machine('JBF-10B3S',100),machine('JPF-10B3S',100)],check=checked(),profiles={
    [c[1].m]:{gepflegt_von:'Hans',universalitaet:{stufe:4,begruendung:'private-fixture'},praezision:{stufe:3}}
  },before=JSON.stringify({c,check,profiles});
  const r=R.rankMachines(c,{checkMachine:()=>check,profiles,requirements,practice});
  assert.equal(r.recommendation.o.m,c[1].m);
  assert.equal(JSON.stringify({c,check,profiles}),before);
  assert.doesNotMatch(JSON.stringify(r),/private-fixture|gepflegt_von|universalitaet|praezision/);
  const proxy=R.toolCostProxy({...c[0],die:[50,65]});
  assert.equal(proxy.isCost,false);
  assert.equal(proxy.status,'uncalibrated-proxy');
  assert.equal(R.toolCostProxy(c[0]),null);
});

test('browser and CommonJS exports agree without external libraries',()=>{
  const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../machine-ranking.js'),'utf8'),ctx);
  assert.equal(ctx.JYMachineRanking.VERSION,R.VERSION);
  assert.equal(JSON.stringify(ctx.JYMachineRanking.parseModel('JBF-10B3S')),JSON.stringify(R.parseModel('JBF-10B3S')));
});
