const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library.js'),R=require('../normen/resolver.js');
const threads=require('../normen/gewinde.json');
test('thread stock dimensions use the tolerance midpoint, not nominal diameter',()=>{
  const m6=N.thread({threads},'M6');assert.equal(m6.rollBlank,5.27);assert.equal(m6.nutHole,5.04);
  const m20=N.thread({threads},'M20');assert.equal(m20.nutHole,17.52);assert.ok(m20.nutHole>=17.294);
});
test('fine-pitch hole uses its pitch-specific grade-6 minor tolerance',()=>{
  const fine=N.thread({threads},'M10',1);assert.equal(fine?.nutHole,9.04);
  assert.equal(N.thread({threads},'M10',0.123),null);
});
test('reference b does not invent an unthreaded portion on a short screw',()=>{
  const f={id:'TEST',funktion:'schraube',kopfTyp:'zylinder',groessen:{M6:{vorbelegung:{kD:10,kH:6,b:24},nachLaenge:{30:{vorbelegung:{sL:30}}}}}};
  const data={schemaVersion:1,version:'test',families:[f],threads};
  const doc=R.resolveStandard(data,{id:'TEST',groesse:'M6',laenge:30});
  const e=N.adapt(data,doc);assert.equal(e.sD,5.27);assert.equal(e.sL,30);assert.equal(e.shaftSegments,undefined);
  const changed=N.adapt(data,R.setOverride(doc,'sD',5.4));assert.equal(changed.sD,5.4);assert.match(changed.standardReference,/TEST M6/);
});
test('fine nut sizes remain unambiguous and do not become NaN',()=>{
  const data={schemaVersion:1,version:'test',families:[{id:'NUT',klasse:'mutter',groessen:{'M10x1':{vorbelegung:{mSW:16,mH:8.4}}}}],threads};
  const e=N.adapt(data,R.resolveStandard(data,{id:'NUT',groesse:'M10x1'}));assert.equal(e.mM,10);assert.equal(e.threadModel.P,1);
});
