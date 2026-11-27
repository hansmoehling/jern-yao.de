'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const f=require('../normen/DIN985.json'),N=require('../normen/library.js'),R=require('../normen/resolver.js');
const data={schemaVersion:1,version:'din985-fine-p7',families:[f],threads:require('../normen/gewinde.json')};
const fine=Object.entries(f.groessen).filter(([key])=>key.includes('x'));

test('DIN985 keeps all 22 coarse rows and adds only 25 documented fine combinations',()=>{
 assert.equal(Object.keys(f.groessen).length,47);assert.equal(fine.length,25);
 assert.equal(f.edition,'1987-05');assert.equal(f.threadSeries,'coarse-and-fine');
 assert.equal(f.groessen.M12.roh.P,1.75);assert.equal(f.groessen['M12x1.25'].roh.P,1.25);
 assert.equal(f.groessen['M18x2'].vorbelegung.mH,18.5);assert.equal(f.groessen['M48x3'].vorbelegung.mSW,75);
 for(const key of ['M6x0.75','M8x0.5','M16x1','M48x2'])assert.equal(f.groessen[key],undefined);
});

test('historical table rows and supplier-only fine threads have distinct membership and edition evidence',()=>{
 const extras=fine.filter(([,row])=>!row.standardMatrixMembership).map(([key])=>key).sort();
 assert.deepEqual(extras,['M12x1','M24x1.5','M30x1.5']);
 for(const [key,row]of fine){
  const historical=!extras.includes(key);
  assert.equal(row.sizeEvidence.kind,historical?'supplier-declared-standard-table':'supplier-product-program');
  assert.equal(row.sizeEvidence.edition,historical?'1987-05':null);
  assert.equal(row.thread.sourceRefs.includes('vostok985_1987'),historical);
  for(const [raw,value]of Object.entries(row.roh)){
   const meta=f.fields[key][raw];assert.ok(meta,`${key}/${raw}`);assert.equal(meta.unit,'mm');
   assert.equal(meta.nominal??meta.min??meta.max,value);assert.ok(meta.sourceRefs.length);
   assert.equal(meta.verification,new Set(meta.sourceRefs).size>=2);
   for(const ref of meta.sourceRefs)assert.ok(f.sourceMeta[ref]?.locator,ref);
  }
 }
 assert.deepEqual(f.fields['M12x1'].h_min.sourceRefs,['reyher985_fine_2020']);
 assert.equal(f.fields['M12x1'].h_min.status,'single-source');
 assert.equal(f.fields['M48x3'].h_max.status,'verified');
});

test('fine nut geometry uses the DIN columns and keeps differently defined thread heights separate',()=>{
 const m10=f.groessen['M10x1'],m12=f.groessen['M12x1.25'],m24=f.groessen['M24x1.5'];
 assert.equal(m10.vorbelegung.mSW,17);assert.equal(m10.vorbelegung.mH,10);
 assert.equal(m12.vorbelegung.mSW,19);assert.equal(m12.vorbelegung.mH,12);
 assert.equal(m10.roh.m_min,6.5);assert.equal(m10.roh.m1_catalog,7);
 assert.equal(f.fields['M10x1'].m_min.min,6.5);assert.equal(f.fields['M10x1'].m1_catalog.nominal,7);
 assert.equal(m24.roh.m_min,15);assert.equal(m24.roh.m1_catalog,16);
 assert.equal(m24.roh.e_min,39.55);assert.deepEqual(f.fields['M24x1.5'].e_min.sourceRefs,['wasi985_fine']);
 for(const [,row]of fine){assert.equal(row.geometryStatus,'partial');assert.equal(row.vorbelegung.mLoch,undefined);assert.deepEqual(row.missingGeometryFields,['insertSeatDiameter','insertSeatDepth','insertOuterProfile']);}
});

test('fine pitch selection resolves, adapts and survives re-edit without reverting to a coarse pitch',()=>{
 for(const [key,row]of fine){
  const doc=R.resolveStandard(data,{id:'DIN985',groesse:key},{},{shaftPolicy:'shaft-v2'});
  assert.equal(doc.effective.mH,row.vorbelegung.mH);
  assert.deepEqual(N.pitches(data,key),[row.roh.P]);
  const part=N.adapt(data,doc);
  assert.equal(part.threadModel.P,row.roh.P);assert.equal(part.threadModel.d,row.roh.d_nom);
  if(!N.thread(data,key)){assert.equal(part.threadModel.internalOnly,true);assert.equal(part.threadModel.internalTolerance,'6H');assert.equal(part.threadModel.rollBlank,undefined);assert.equal(part.threadModel.d2min,undefined);assert.equal(part.threadModel.d2max,undefined);assert.equal(part.threadModel.internalStatus,'primary-formula-derived');}
  assert.equal(part.mSW,row.vorbelegung.mSW);assert.ok(part.normMissingFields.includes('insertSeatDepth'));
  const edited=R.setOverride(doc,'mH',row.vorbelegung.mH+.5),restored=R.restore(JSON.stringify(R.snapshot(edited)));
  assert.equal(restored.standardReference.groesse,key);assert.equal(restored.effective.mH,row.vorbelegung.mH+.5);
 }
});

test('missing thread tolerances clear an old automatic hole, retain deliberate customer holes and keep legacy adaptation unchanged',()=>{
 const incomplete={...data,threads:{...data.threads,TD1Grade6:{...data.threads.TD1Grade6,2:undefined}}};
 const resolve=policy=>R.resolveStandard(data,{id:'DIN985',groesse:'M18x2'},{partSnapshot:{mLoch:9.04}},{shaftPolicy:policy});
 const current=resolve('shaft-v2'),legacy=N.adapt(data,resolve(undefined));
 const missing=N.adapt(incomplete,current);assert.equal(missing.mLoch,null);assert.ok(missing.clearFields.includes('mLoch'));assert.ok(missing.normMissingFields.includes('nutHoleTolerance'));assert.equal(missing.normRequiresGeometryReview,true);
 assert.equal(legacy.mLoch,undefined);assert.equal(legacy.clearFields,undefined);assert.ok(!legacy.normMissingFields.includes('nutHoleTolerance'));
 const edited=R.setOverride(current,'mLoch',16.2),part=N.adapt(incomplete,edited);
 assert.equal(part.mLoch,16.2);assert.equal(part.clearFields,undefined);assert.ok(!part.normMissingFields.includes('nutHoleTolerance'));assert.equal(part.normRequiresGeometryReview,false);
 assert.equal(N.adapt(data,R.setOverride(current,'mLoch',0)).normRequiresGeometryReview,true);
});

test('internal-only 6H derivation closes nine fine-pitch gaps without fabricating external rolling data',()=>{
 const expected={'M18x2':16.02,'M20x2':18.02,'M22x2':20.02,'M24x1.5':22.53,'M36x3':33,'M39x3':36,'M42x3':39,'M45x3':42,'M48x3':45};
 for(const [key,hole]of Object.entries(expected)){
  const doc=R.resolveStandard(data,{id:'DIN985',groesse:key},{},{shaftPolicy:'shaft-v2'}),part=N.adapt(data,doc);
  assert.equal(part.mLoch,hole,key);assert.equal(part.normRequiresGeometryReview,false);assert.equal(part.clearFields,undefined);
  assert.ok(part.threadModel.D1max>part.threadModel.D1min);assert.equal(part.threadModel.internalOnly,true);
  assert.deepEqual(part.threadModel.internalSourceRefs,['iteh724_2023','iteh965_1_2013']);assert.equal(part.threadModel.rollBlank,undefined);
 }
 const doc=R.resolveStandard(data,{id:'DIN985',groesse:'M18x2',steigung:1.234},{},{shaftPolicy:'shaft-v2'});
 assert.equal(N.adapt(data,doc).mLoch,null,'an unsupported pitch is not inferred from a neighbouring row');
});
