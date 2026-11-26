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

test('drive size, nut shape and explicit flange opt-out survive adaptation and reedit',()=>{
 const nut={id:'NUT',klasse:'mutter',groessen:{M8:{vorbelegung:{mSW:13,mH:8,mFlansch:17,mFlanschH:1.5}}}},bolt={id:'BOLT',funktion:'schraube',kopfTyp:'zylinder',antrieb:{art:'hex'},groessen:{M6:{vorbelegung:{kD:10,kH:6,iSW:5,iT:3},nachLaenge:{30:{vorbelegung:{sL:30}}}}}};
 const data={schemaVersion:1,version:'test',families:[nut,bolt],threads};
 let n=R.resolveStandard(data,{id:'NUT',groesse:'M8'});n=R.setOverride(n,'nutShape','square');n=R.setOverride(n,'nutFlange',false);n=R.setOverride(n,'mFlansch',18);let a=N.adapt(data,R.restore(JSON.stringify(n)));assert.equal(a.nutShape,'square');assert.equal(a.nutFlange,false);assert.equal(a.mFlansch,0);assert.equal(n.effective.mFlansch,18);
 n=R.setOverride(n,'nutFlange',true);a=N.adapt(data,n);assert.equal(a.mFlansch,18);assert.equal(a.mFlanschH,1.5);
 let b=R.resolveStandard(data,{id:'BOLT',groesse:'M6',laenge:30});b=R.setOverride(b,'iSize','4');a=N.adapt(data,b);assert.equal(a.iSize,'4');assert.equal(a.iSW,4);
 b=R.setOverride(b,'iSize','custom');b=R.setOverride(b,'iSW',4.7);a=N.adapt(data,R.restore(JSON.stringify(b)));assert.equal(a.iSize,'custom');assert.equal(a.iSW,4.7);
});

test('length edits select their own shaft distribution and never reuse an old total length',()=>{
 const f={id:'PARTIAL',funktion:'schraube',kopfTyp:'zylinder',groessen:{M6:{vorbelegung:{kD:10,kH:6},nachLaenge:{35:{vorbelegung:{sL:35},plainLength:8.5},40:{vorbelegung:{sL:40},plainLength:13.5}}}}};const data={schemaVersion:1,version:'test',families:[f],threads};
 const doc=R.resolveStandard(data,{id:f.id,groesse:'M6',laenge:35});let a=N.adapt(data,doc);assert.equal(a.shaftSegments[0].length,8.5);
 a=N.adapt(data,R.setOverride(doc,'sL',40));assert.equal(a.shaftSegments[0].length,13.5);assert.equal(a.shaftSegments.reduce((n,s)=>n+s.length,0),40);
 a=N.adapt(data,R.setOverride(doc,'sL',41));assert.equal(a.shaftSegments,undefined);assert.equal(a.normRequiresGeometryReview,true);assert(a.normMissingFields.includes('shaftLengthDistribution'));
 a=N.adapt(data,R.setOverride(doc,'sD',5.4));assert.equal(a.shaftSegments[0].diameter,6);assert.equal(a.shaftSegments[1].diameter,5.4);
});

test('DIN7338 and ISO13918 variants resolve only their own documented fields',()=>{
 const data={schemaVersion:1,version:'test',families:['DIN7338','ISO13918'].map(id=>require('../normen/'+id+'.json')),threads};
 for(const f of data.families)for(const variant of N.variants(f)){const groesse=N.sizes(N.variantFamily(f,variant.id))[0],selection={id:f.id,form:variant.id,groesse};const doc=R.resolveStandard(N.selectionLibrary(data,selection),selection),a=N.adapt(data,doc);assert.equal(a.standardVariant,variant.id);assert.equal(doc.standardReference.id,f.id);assert.equal(doc.standardReference.form,variant.id);assert.equal(a.normRequiresGeometryReview,true);assert(!doc.issues.some(i=>i.code==='standard-size-unavailable'));}
 const selection={id:'ISO13918',form:'PT',groesse:'M3',laenge:12},doc=R.resolveStandard(N.selectionLibrary(data,selection),selection),a=N.adapt(data,doc);assert.equal(a.l1,12);assert.equal(a.sL,undefined,'pre-weld l1 is not silently a finished cylindrical shaft');assert.equal(a.kD,undefined,'weld-collar diameter is not a head');
 const bsel={id:'DIN7338',form:'B',groesse:'3'},b=N.adapt(data,R.resolveStandard(N.selectionLibrary(data,bsel),bsel));assert.equal(b.schaftende,'halbhohl');assert.equal(b.d_b,1.7);
 assert.equal(N.sizes(N.variantFamily(data.families[0],'unknown')).length,0);
});

test('undated edition tokens stay internal while the displayed reference is readable',()=>{
 const f={id:'DIN933',edition:'catalog-undated'};assert.equal(N.familyLabel(f),'DIN 933 · Ausgabe nicht zugeordnet');assert(!N.familyLabel(f).includes('catalog-undated'));
 const doc={standardReference:{id:'DIN933',edition:'catalogue-unassigned',groesse:'M8'}};assert.equal(N.reference(doc,x=>x==='Ausgabe nicht zugeordnet'?'edition not assigned':x),'DIN933:edition not assigned M8');assert.equal(N.familyLabel({id:'ISO4762',edition:'2004'}),'ISO 4762 · 2004');
});
