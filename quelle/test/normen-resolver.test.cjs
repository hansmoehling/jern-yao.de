'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const R=require('../normen/resolver.js');
const verified=(nominal)=>({nominal,status:'verified',verification:'two-independent-primary-sources',sourceRefs:['fixture-A','fixture-B']});
// Synthetic data tests the state contract; these are not published norm values.
const library={schemaVersion:1,version:'fixture-v1',families:[{
  id:'TEST-HEAD',edition:1,funktion:'schraube',klasse:'bolzen',kopfTyp:'zylinder',antrieb:{art:'hex'},schaftende:'kuppe',
  feldzuordnung:{kD:'dk',kH:'k',iSW:'s',iT:'t',sL:'l'},
  groessen:{M6:{vorbelegung:{kD:10,kH:6,iSW:5,iT:3},roh:{dk:10,k:6,s:5,t:3},nachLaenge:{30:{vorbelegung:{sL:30},roh:{l:30},fields:{l:verified(30)}}}}},
  fields:{M6:{dk:verified(10),k:verified(6),s:verified(5),t:verified(3)}}
}]};
const selection={id:'TEST-HEAD',edition:1,groesse:'M6',laenge:30,steigung:1,festigkeitsklasse:'8.8'};
const geometry={version:1,coordinateSystem:'tool-parting-plane',elements:[
  {id:'S1',operation:'add',shape:'cylinder',side:'punch',start:0,length:3,diameter:4,offsetX:0,offsetY:0},
  {id:'S2',operation:'add',shape:'cylinder',side:'die',start:0,length:8,diameter:5,offsetX:0,offsetY:0},
  {id:'I1',operation:'subtract',shape:'cone',side:'punch',start:3-1/Math.sqrt(3),length:1/Math.sqrt(3),diameter:0,diameterEnd:2,offsetX:0,offsetY:0},
  {id:'I2',operation:'subtract',shape:'cylinder',side:'die',start:3+Math.sqrt(3)/2,length:5-Math.sqrt(3)/2,diameter:3,offsetX:0,offsetY:0},
  {id:'I3',operation:'subtract',shape:'cone',side:'die',start:3,length:Math.sqrt(3)/2,diameter:0,diameterEnd:3,offsetX:0,offsetY:0}
],trimming:[{id:'trim1',side:'punch',start:0,length:1,angleDeg:0,distance:1.9}]};
const partSnapshot={
  chain:{segments:[{id:'S1',shape:'cylinder',diameter:4,length:3},{id:'S2',shape:'cylinder',diameter:5,length:8}],partingPlane:3,
    innerContours:[{id:'I1',from:'A',shape:'cone',angleDeg:120,openingDiameter:2,depth:1/Math.sqrt(3)},
      {id:'B1',from:'B',kind:'blind-hole',diameter:3,totalDepth:5,bottom:{shape:'cone',angleDeg:120}}]},
  geometrySpec:geometry,geometryFeatures:[{id:'B1',side:'die',type:'shaft-end-blind-hole',complete:true}],
  material:{id:'C4C',state:'soft-annealed',origin:'assumption'},wire:{d0:6,origin:'customer'},
  process:{wirePreparation:'inline-drawing',rodDiameter:6.5,curveId:'fixture-curve',rm:null},
  notes:{customer:'Keep both recesses and all dimensions.',nested:{values:[0,false,null]}}
};
const seed=()=>R.resolveStandard(library,selection,{partSnapshot});

test('resolves draft names and attaches source provenance to each mapped value',()=>{
  const original=JSON.stringify(library),doc=seed();
  assert.deepEqual(doc.normBaseline.values,{kD:10,kH:6,iSW:5,iT:3,sL:30});
  assert.deepEqual(doc.effective,doc.normBaseline.values);
  assert.equal(doc.normBaseline.provenance.kH.rawKey,'k');
  assert.deepEqual(doc.normBaseline.provenance.kH.sourceRefs,['fixture-A','fixture-B']);
  assert.equal(doc.normBaseline.sourceStatus.kH,'verified');
  assert.equal(doc.standardReference.libraryVersion,'fixture-v1');
  assert.equal(doc.standardReference.laenge,30);
  assert.equal(doc.issues.length,0);
  assert.equal(JSON.stringify(library),original);
  assert.deepEqual(doc.partSnapshot,partSnapshot);
  const alias={...library,familien:library.families};delete alias.families;
  assert.deepEqual(R.resolveStandard(alias,selection,{partSnapshot}),doc);
});

test('single-field edits and resets preserve the baseline, other edits and the full part',()=>{
  const original=seed(),edited=R.setOverride(R.setOverride(original,'kH',7),'iT',2.5);
  assert.equal(original.effective.kH,6);
  assert.equal(edited.normBaseline.values.kH,6);
  assert.equal(edited.effective.kH,7);
  assert.equal(edited.overrides.kH.origin,'customer');
  const reset=R.resetOverride(edited,'kH');
  assert.equal(reset.effective.kH,6);
  assert.equal(reset.effective.iT,2.5);
  assert.deepEqual(Object.keys(reset.overrides),['iT']);
  assert.deepEqual(reset.partSnapshot,partSnapshot);
  assert.deepEqual(reset.normBaseline,original.normBaseline);
});

test('serialization and reedit keep 120-degree centre, shaft-end blind hole, trimming and process',()=>{
  const edited=R.setOverride(seed(),'kH',7),serialized=JSON.stringify(R.snapshot(edited));
  const restored=R.restore(serialized);
  assert.deepEqual(restored,edited);
  assert.deepEqual(restored.partSnapshot,partSnapshot);
  assert.equal(restored.partSnapshot.chain.innerContours[0].angleDeg,120);
  assert.equal(restored.partSnapshot.chain.innerContours[1].bottom.angleDeg,120);
  assert.equal(restored.partSnapshot.geometrySpec.elements.length,5);
  assert.equal(restored.partSnapshot.geometryFeatures[0].side,'die');
  const detached=R.snapshot(restored);detached.partSnapshot.process.rodDiameter=99;
  assert.equal(restored.partSnapshot.process.rodDiameter,6.5);
});

test('new norm retains customer overrides and missing dimensions without claiming them as norm values',()=>{
  const initial=R.setOverride(R.setOverride(seed(),'kH',7),'iT',2.5);
  const other={schemaVersion:1,version:'fixture-v2',families:[{id:'TEST-PLAIN',edition:2,kopfTyp:'sechskant',feldzuordnung:{kH:'k'},groessen:{M6:{vorbelegung:{kH:4,kD:null},roh:{k:4}}},fields:{M6:{k:verified(4)}}}]};
  const changed=R.resolveStandard(other,{id:'TEST-PLAIN',groesse:'M6'},initial);
  assert.deepEqual(changed.normBaseline.values,{kH:4});
  assert.equal(changed.effective.kH,7);
  assert.equal(changed.effective.kD,10);
  assert.equal(changed.effective.iT,2.5);
  assert.deepEqual(changed.overrides,initial.overrides);
  assert.ok(changed.issues.some(i=>i.code==='override-not-in-standard'&&i.path==='iT'));
  assert.ok(changed.issues.some(i=>i.code==='value-retained-without-standard'&&i.path==='kD'));
  assert.deepEqual(changed.partSnapshot,partSnapshot);
  assert.equal(R.resetOverride(changed,'kH').effective.kH,4);
  const resetDrive=R.resetOverride(changed,'iT');
  assert.equal(resetDrive.effective.iT,3);
  assert.equal(resetDrive.effectiveStatus.iT,'retained-without-standard');
  assert.equal(resetDrive.overrides.iT,undefined);
});

test('length-dependent defaults stay unresolved without a researched length branch',()=>{
  const partial=JSON.parse(JSON.stringify(library)),family=partial.families[0];
  family.feldzuordnung.b='b_ref';family.groessen.M6.vorbelegung.b=24;family.fields.M6.b_ref=verified(24);
  family.feldzuordnung.iT='t_min_lang';family.fields.M6.t_min_lang=verified(3);
  const initial=R.resolveStandard(partial,selection,{partSnapshot});
  assert.equal(initial.effective.b,24);
  const unknownLength=R.resolveStandard(partial,{...selection,laenge:150},initial);
  for(const field of ['b','iT']){
    assert.equal(unknownLength.normBaseline.applicability[field],'unresolved');
    assert.equal(unknownLength.effectiveStatus[field],'unresolved');
    assert.ok(unknownLength.issues.some(i=>i.code==='length-dependent-value-unresolved'&&i.path===field));
  }
  assert.equal(unknownLength.effective.b,24);
  assert.deepEqual(unknownLength.partSnapshot,partSnapshot);
  const withoutPrevious=R.resolveStandard(partial,{...selection,laenge:150});
  assert.equal(withoutPrevious.effective.b,undefined);
  assert.equal(withoutPrevious.normBaseline.values.b,24);
  assert.equal(withoutPrevious.effectiveStatus.b,'unresolved');
});

test('a customer-only field survives reset when no baseline exists and is explicitly marked',()=>{
  const custom=R.setOverride(seed(),'customFeature',12),reset=R.resetOverride(custom,'customFeature');
  assert.equal(reset.effective.customFeature,12);
  assert.equal(reset.effectiveStatus.customFeature,'customer');
  assert.ok(reset.issues.some(i=>i.code==='reset-baseline-unavailable'&&i.path==='customFeature'));
  assert.equal(reset.normBaseline.values.customFeature,undefined);
});

test('rebase flags an override outside new bounds while preserving the customer value',()=>{
  const edited=R.setOverride(seed(),'kH',7),nextLibrary=JSON.parse(JSON.stringify(library));
  nextLibrary.version='fixture-v2';nextLibrary.families[0].fields.M6.k={...verified(6),min:5.5,max:6.5};
  const changed=R.resolveStandard(nextLibrary,selection,edited);
  assert.equal(changed.effective.kH,7);
  assert.ok(changed.issues.some(i=>i.code==='override-outside-standard'&&i.path==='kH'));
  assert.deepEqual(changed.partSnapshot,partSnapshot);
});

test('source gaps are per field and family prose or multiple generic links do not verify values',()=>{
  const partial=JSON.parse(JSON.stringify(library));
  partial.families[0].status='belegt';partial.families[0].quellen=['site-A','site-B'];
  delete partial.families[0].fields.M6.t;
  partial.families[0].fields.M6.k={sourceRefs:['fixture-A'],verification:'single-source',status:'single-source'};
  const doc=R.resolveStandard(partial,selection,{partSnapshot});
  assert.equal(doc.normBaseline.sourceStatus.iT,'missing');
  assert.equal(doc.normBaseline.sourceStatus.kH,'single-source');
  assert.ok(doc.issues.some(i=>i.code==='source-missing'&&i.path==='iT'));
  assert.ok(doc.issues.some(i=>i.code==='source-not-verified'&&i.path==='kH'));
  assert.equal(doc.effective.iT,3);
  assert.deepEqual(doc.partSnapshot,partSnapshot);
});

test('missing family, size or length never clears the part or invents a normative exclusion',()=>{
  const original=seed();
  for(const choice of [{id:'MISSING',groesse:'M6'},{id:'TEST-HEAD',groesse:'M7'}]){
    const doc=R.resolveStandard(library,choice,original);
    assert.deepEqual(doc.effective,original.effective);
    assert.deepEqual(doc.partSnapshot,original.partSnapshot);
    assert.deepEqual(doc.normBaseline.values,{});
    assert.ok(doc.issues.some(i=>['standard-not-found','standard-size-unavailable'].includes(i.code)));
    assert.ok(!doc.issues.some(i=>i.code==='not-in-standard'));
  }
  const length=R.resolveStandard(library,{...selection,laenge:40},original);
  assert.equal(length.effective.sL,30);
  assert.equal(length.standardReference.laenge,40);
  assert.ok(length.issues.some(i=>i.code==='length-not-resolved'));
});

test('restoring a saved baseline does not re-resolve against a newer library',()=>{
  const before=seed(),saved=JSON.stringify(R.snapshot(before));
  const newer=JSON.parse(JSON.stringify(library));newer.version='fixture-v2';newer.families[0].groessen.M6.vorbelegung.kH=8;
  assert.equal(R.resolveStandard(newer,selection).effective.kH,8);
  assert.equal(R.restore(saved).effective.kH,6);
  assert.equal(R.restore(saved).standardReference.libraryVersion,'fixture-v1');
});

test('multiple editions require an explicit choice and do not silently take the first',()=>{
  const multiple=JSON.parse(JSON.stringify(library));multiple.families.push({...multiple.families[0],edition:2});
  assert.ok(R.resolveStandard(multiple,{id:'TEST-HEAD',groesse:'M6'},seed()).issues.some(i=>i.code==='standard-edition-ambiguous'));
  assert.equal(R.resolveStandard(multiple,selection).standardReference.edition,1);
});

test('rejects null resets, nonfinite values, unsafe paths and unsupported snapshots',()=>{
  for(const value of [null,undefined,NaN,Infinity])assert.throws(()=>R.setOverride(seed(),'kH',value),TypeError);
  for(const path of ['__proto__.polluted','constructor.prototype.polluted','x.__proto__.polluted',''])assert.throws(()=>R.setOverride(seed(),path,1),TypeError);
  assert.equal({}.polluted,undefined);
  assert.throws(()=>R.restore({schemaVersion:2}),TypeError);
  assert.throws(()=>R.resolveStandard({...library,schemaVersion:2},selection),TypeError);
});

test('browser export uses the same resolver without runtime dependencies',()=>{
  const context={window:{}};vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../normen/resolver.js'),'utf8'),context);
  assert.equal(typeof context.window.JYStandards.resolveStandard,'function');
  assert.equal(context.window.JYStandards.resolveStandard(library,selection).effective.kD,10);
});
