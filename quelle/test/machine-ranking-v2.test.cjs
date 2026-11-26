'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../machine-ranking.js'),E=require('../engine.js');
const N=require('../normen/library.js'),S=require('../normen/resolver.js'),W=require('../vorbelegung/draht.js');
const catalogue=require('../maschinen.json'),practice=require('../praxis.json');
const machine=(m,rp,extra={})=>({m,f:m.split('-')[0],st:3,cd:8,cl:[10,70],ko:60,ml:50,sz:'M6',pw:40,out:300,rp,...extra});
const checked=(gesamt='ok',ausl=.6)=>({k:[{krit:'Fixture',status:gesamt}],gesamt,ausl});
const requirements={partType:'bolzen',threadNominalDiameter:6,stations:2,blankDiameter:5.6,blankLength:36,partLength:30,knockoutLength:30};
const rank=(rows,extra={})=>R.rankMachines(rows,{version:'ranking-v2',checkMachine:()=>checked(),requirements,practice,...extra});

test('v2 puts class before price but keeps the explicitly versioned v1 result',()=>{
  const rows=[machine('JBF-10B3S',100),machine('JBF-10B2S',60,{st:2}),machine('JPF-10B3S',1)];
  const checkMachine=o=>checked('ok',o.f==='JPF'?.05:.6);
  const current=rank(rows,{checkMachine});
  assert.equal(current.recommendation.o.m,'JBF-10B3S');
  assert.deepEqual(current.candidates.map(r=>r.ranking.classification),['A','B','C']);
  assert.equal(current.alternatives[0].o.m,'JBF-10B2S');
  assert.equal(R.rankMachines(rows,{checkMachine,requirements,practice}).recommendation.o.m,'JPF-10B3S');
  assert.equal(R.VERSION,'ranking-v1');assert.equal(current.version,'ranking-v2');
});

test('checked candidates precede open candidates even when their class is lower',()=>{
  const rows=[machine('JBF-10B3S',1),machine('JBF-10B2S',60,{st:2})];
  const result=rank(rows,{checkMachine:o=>checked(o.st===3?'offen':'knapp')});
  assert.equal(result.recommendation.o.st,2);assert.equal(result.recommendation.ranking.classification,'B');
  assert.equal(result.alternatives.length,0);assert.equal(R.candidatePools(result).bestTier,0);
});

test('price wins within class, then confirmed private ratings, score and name break ties',()=>{
  const rows=[machine('JBF-10B3S',100),machine('JPF-10B3S',90),machine('JBP-10B3S',90)];
  const profiles={'JPF-10B3S':{gepflegt_von:'Hans',universalitaet:{stufe:4},praezision:{stufe:2}}};
  const result=rank(rows,{profiles});assert.equal(result.recommendation.o.m,'JPF-10B3S');
  assert.equal(result.priceRankingComplete,true);assert.equal(result.rankingBasis,'class-then-price');
  assert.doesNotMatch(JSON.stringify(result),/gepflegt_von|universalitaet|praezision/);
});

test('nominal thread uses its family grid and excludes two smaller steps explicitly',()=>{
  const rows=catalogue.filter(o=>o.f==='JBF'||o.m==='JNF-8B5SL');
  const result=rank(rows,{requirements:{...requirements,threadNominalDiameter:8,blankDiameter:4}});
  const byName=name=>result.all.find(r=>r.o.m===name);
  assert.equal(byName('JBF-10B3S').ranking.components.size.gridSizeDifference,-1);
  assert.equal(byName('JBF-10B3S').ranking.components.size.state,'tight');
  assert.equal(byName('JBF-10B3S').technicalEligible,true);
  assert.equal(byName('JBF-7B3S').ranking.components.size.gridSizeDifference,-2);
  assert.equal(byName('JBF-7B3S').technicalEligible,false);
  assert.ok(byName('JBF-7B3S').k.some(k=>k.code==='below-size-grid'&&k.status==='nein'));
  assert.equal(byName('JBF-13B3S').ranking.components.size.gridSizeDifference,0);
  const m6=rank(rows,{requirements:{...requirements,blankDiameter:6}});
  assert.equal(m6.all.find(r=>r.o.m==='JBF-7B3S').ranking.components.size.gridSizeDifference,-1,'M5 in JNF must not add a JBF grid step');
  assert.equal(m6.all.find(r=>r.o.m==='JBF-13B3S').ranking.components.size.state,'near');
  assert.equal(m6.all.find(r=>r.o.m==='JBF-17B3S').ranking.components.size.state,'oversized');
});

test('two tight components become C; five-stage nut occupancy is optimal only with optimal remaining components',()=>{
  const c=rank([machine('JBF-10B2S',1,{st:2})],{checkMachine:()=>checked('knapp',.95)}).recommendation;
  assert.equal(c.ranking.classification,'C');assert.equal(c.ranking.reserveAlternativeEligible,false);
  const rows=[machine('JNF-10B5S',1,{st:5}),machine('JBP-10B5S',2,{st:5})];
  const req={...requirements,partType:'mutter',threadNominalDiameter:undefined,partSize:6,stations:5};
  const result=rank(rows,{requirements:req});
  const nut=result.all.find(r=>r.o.f==='JNF'),parts=result.all.find(r=>r.o.f==='JBP');
  assert.equal(nut.ranking.components.stations.state,'optimal');assert.equal(nut.ranking.classification,'A');
  assert.equal(parts.ranking.components.stations.state,'tight');assert.equal(parts.ranking.classification,'B');
  const near=rank([rows[0]],{requirements:req,checkMachine:()=>checked('ok',.3)}).recommendation;
  assert.equal(near.ranking.components.stations.state,'tight');assert.equal(near.ranking.classification,'B');
  const six=rank([{...rows[0],st:6}],{requirements:{...req,stations:6}}).recommendation;
  assert.equal(six.ranking.components.stations.state,'tight');
});

test('only cheaper B with the reserve station as its sole limit is the first alternative',()=>{
  const rows=[machine('JBF-10B3S',100),machine('JBF-10B2S',60,{st:2}),machine('JNF-10B2S',1,{st:2}),machine('JPF-10B3S',110,{cd:9})];
  const result=rank(rows),pools=R.candidatePools(result);
  assert.deepEqual(pools.reserveAlternatives.map(r=>r.o.m),['JBF-10B2S']);
  assert.deepEqual([result.recommendation,...result.alternatives].map(r=>r.o.m),['JBF-10B3S','JBF-10B2S','JPF-10B3S']);
  const dearer=rank(rows.map(o=>o.m==='JBF-10B2S'?{...o,rp:150}:o));
  assert.deepEqual(dearer.alternatives.map(r=>r.o.m),['JPF-10B3S']);
  const part=rank(rows,{requirements:{...requirements,partType:'formteil',threadNominalDiameter:undefined}});
  assert.ok(R.candidatePools(part).reserveAlternatives.some(r=>r.o.f==='JNF'),'no family gate for special parts');
});

test('both pools have deterministic price-independent bounds of twelve, twenty-four total',()=>{
  const rows=Array.from({length:30},(_,i)=>machine('JBF-'+(10+i)+'B'+(i<15?3:2)+'S',1000-i,{st:i<15?3:2}));
  const priced=rank(rows),unpriced=rank([...rows].reverse().map(({rp,...o})=>o),{priceMode:'none'});
  const names=r=>{const p=R.candidatePools(r);return {primary:p.primary.map(r=>r.o.m),reserve:p.reserveAlternatives.map(r=>r.o.m)};};
  assert.deepEqual(names(priced),names(unpriced));
  assert.equal(names(priced).primary.length,12);assert.equal(names(priced).reserve.length,12);
  assert.equal(R.candidatePools(priced,100).primary.length,12);
  const p=R.candidatePools(priced),economic=rows=>[...rows].sort((a,b)=>a.o.rp-b.o.rp||b.ranking.score-a.ranking.score||a.o.m.localeCompare(b.o.m,'en'));
  assert.deepEqual(R.displayCandidates(economic(p.primary),economic(p.reserveAlternatives)).map(r=>r.o.m),[priced.recommendation,...priced.alternatives].map(r=>r.o.m));
  assert.equal(unpriced.priceRankingComplete,false);
});

test('a freely dimensioned screw without a nominal thread still excludes lower-class nut alternatives',()=>{
  const rows=[machine('JBF-10B6S',100,{st:6}),machine('JNF-10B5S',50,{st:5})];
  const req={...requirements,stations:5,threadNominalDiameter:null,isThreadedBolt:true};
  const screw=rank(rows,{requirements:req});
  assert.equal(screw.recommendation.ranking.classification,'A');
  assert.equal(screw.all.find(r=>r.o.f==='JNF').ranking.classification,'B');
  assert.equal(screw.alternatives.length,0);
  for(const other of [{...req,isThreadedBolt:false},{...req,partType:'formteil',isThreadedBolt:false}]){
    const unrestricted=rank(rows,{requirements:other});
    assert.equal(unrestricted.alternatives[0].o.f,'JNF','rivets and special parts keep the no-reserve process alternative');
  }
});

test('hard failures and evidenced rotary transfer never enter either v2 pool',()=>{
  const rows=[machine('JBF-10B3S',100),machine('JPF-10B3S',1),machine('JBP-10B2S',1,{st:2})];
  const result=rank(rows,{checkMachine:o=>checked(o.f==='JPF'?'nein':'ok'),profiles:{'JBP-10B2S':{transfer:{value:'rotativ',verified:true}}}});
  assert.deepEqual(R.candidatePools(result).primary.map(r=>r.o.m),['JBF-10B3S']);assert.equal(R.candidatePools(result).reserveAlternatives.length,0);
});

const data={...require('../normen/index.json'),families:['ISO4762','ISO4017','ISO4014'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json')};
for(const [id,groesse,laenge,expected,alternative]of [['ISO4762','M6',30,'JBF-10B3S','JBF-10B2S'],['ISO4017','M8',40,'JBF-13B3S','JBF-13B2S'],['ISO4014','M12',80,'JBF-19B2S',null]]){
  test('norm selection '+id+' '+groesse+' x '+laenge+' recommends the matching class A grid size',()=>{
    const wst=E.WERKSTOFFE.findIndex(w=>w.id==='20MnB4'),curve=E.WERKSTOFFE[wst].flowCurves[0];
    const e={...N.adapt(data,S.resolveStandard(data,{id,groesse,laenge,festigkeitsklasse:'8.8'})),typ:'bolzen',wst,curveId:curve.id,materialState:curve.state,rmPolicy:'rm-v1',machinePolicy:'ranking-v2'};
    e.d0=W.candidates(e,null,catalogue)[0].value;
    const a=E.auslegen(e),result=E.waehle(catalogue,a,e,practice).ranking;
    assert.ok(a.werte.Fmax_t>0);assert.equal(result.recommendation.o.m,expected);assert.equal(result.recommendation.ranking.classification,'A');assert.equal(result.recommendation.gesamt,'ok');
    assert.equal(result.checkedCount,catalogue.length);
    if(alternative){assert.equal(result.alternatives[0].o.m,alternative);assert.equal(result.alternatives[0].ranking.classification,'B');}
  });
}
