'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library'),R=require('../normen/resolver');
const ids=['DIN603','DIN6921','DIN7984','DIN933','EN1662','ISO10642','ISO15071','ISO1580','ISO2009','ISO7045','ISO7046','ISO7380-1','ISO7380-2','ISO8676','ISO8677'];
const families=ids.map(id=>require('../normen/'+id+'.json'));
const data={...require('../normen/index'),families,threads:require('../normen/gewinde')};
const f=id=>families.find(f=>f.id===id),row=(id,size)=>f(id).groessen[size];
const doc=(id,size,l,legacy=false)=>R.resolveStandard(data,{id,groesse:size,laenge:l},{},legacy?{}:{shaftPolicy:'shaft-v2'});
const preset=(id,size,l)=>N.adapt(data,doc(id,size,l));
const lengths=(id,size)=>N.lengths(f(id),size).map(Number);

test('new nominal cells preserve their real reference, source and edition status',()=>{
 for(const family of families){
  const sources=new Map(family.quellen.map(s=>[s.id,s]));
  assert.equal(sources.size,family.quellen.length,family.id);
  assert.equal(family.lengthMatrixPolicy.complete,false,family.id);
  for(const[size,r]of Object.entries(family.groessen))for(const[l,c]of Object.entries(r.nachLaenge)){
   assert.equal(c.vorbelegung.sL,+l);assert.equal(c.fields.nominalLength.nominal,+l);
   assert.equal(c.shaftPolicy,'shaft-v2');assert.ok(c.lengthEvidence.kind);
   for(const[k,v]of Object.entries(c.roh)){
    assert.ok(c.fields[k],family.id+'/'+size+'/'+l+'/'+k);
    assert.ok([c.fields[k].nominal,c.fields[k].min,c.fields[k].max].includes(v));
    for(const ref of c.fields[k].sourceRefs)assert.ok(sources.has(ref),family.id+'/'+ref);
   }
   for(const ref of c.lengthEvidence.sourceRefs)assert.ok(sources.has(ref),family.id+'/'+ref);
   assert.equal(c.lengthEvidence.verification,c.lengthEvidence.sourceRefs.length>1);
   if(c.lengthEvidence.kind==='catalogue-matrix')assert.equal(c.lengthEvidence.edition,null);
  }
 }
});

test('small screw full-thread boundary is specific to the actual original table',()=>{
 assert.equal(row('ISO1580','M3').nachLaenge['30'].roh.threadMode,'full');
 assert.equal(row('ISO7045','M3').nachLaenge['25'].roh.threadMode,'full');
 assert.equal(row('ISO7045','M3').nachLaenge['30'].roh.threadMode,undefined);
 const long=row('ISO1580','M5').nachLaenge['50'];
 assert.equal(long.fields.b_min.min,38);assert.equal(long.fields.b_min.nominal,null);
 assert.equal(long.roh.b_actual,undefined);assert.ok(long.missingGeometryFields.includes('shaftLengthDistribution'));
 assert.ok(preset('ISO1580','M5',50).normMissingFields.includes('shaftLengthDistribution'));
 assert.ok(!N.adapt(data,doc('ISO1580','M5',50,true)).normMissingFields.includes('shaftLengthDistribution'),'new length-cell checks are gated for legacy documents');
 assert.equal(row('ISO7045','M3.5').vorbelegung.kD,7);
 assert.equal(row('ISO7045','M3.5').vorbelegung.iT,1.4);
 assert.ok(row('ISO7045','M3.5').missingGeometryFields.includes('recessVolumeModel'));
});

test('countersunk nominal length includes the head exactly once and respects customer edits',()=>{
 for(const[id,size,l,k]of [['ISO10642','M6',20,3.72],['ISO2009','M5',20,2.7],['ISO7046','M5',20,2.7]]){
  const d=doc(id,size,l),p=N.adapt(data,d);
  assert.equal(p.sL,l-k,id);assert.equal(p.nominalLength,l);assert.equal(p.shaftLengthReference.headHeight,k);
  assert.equal(N.adapt(data,doc(id,size,l,true)).sL,l,'legacy '+id);
  assert.equal(N.adapt(data,R.setOverride(d,'sL',21)).sL,21,'customer '+id);
  assert.ok(Math.abs(N.adapt(data,R.setOverride(d,'kH',k+1)).sL-(l-k-1))<1e-8,'changed head '+id);
 }
 const tooShort=preset('ISO10642','M6',3);assert.equal(tooShort.sL,null);assert.ok(tooShort.normMissingFields.includes('headToShaftLength'));
 const missing=N.adapt(data,doc('ISO2009','M6',undefined));assert.equal(missing.sL,null);
});

test('a real customer segmentation resolves the minimum-only thread boundary without changing the norm',()=>{
 const d=doc('ISO7045','M3',30),parts=[{diameter:3,length:4},{diameter:2.67,length:26}];
 const p=N.adapt(data,R.setOverride(d,'shaftSegments',parts));
 assert.deepEqual(p.shaftSegments,parts);assert.ok(!p.normMissingFields.includes('shaftLengthDistribution'));
 assert.equal(row('ISO7045','M3').nachLaenge['30'].fields.b_min.min,25);
});

test('current ISO8676 matrix uses its actual stepped lower and upper boundaries',()=>{
 assert.deepEqual(lengths('ISO8676','M8'),[16,20,25,30,35,40,45,50,55,60,65,70,80]);
 assert.equal(lengths('ISO8676','M30')[0],60);assert.equal(lengths('ISO8676','M33')[0],65);
 assert.equal(row('ISO8676','M33').nachLaenge['60'],undefined);assert.equal(row('ISO8676','M24').nachLaenge['220'],undefined);
 assert.equal(row('ISO8676','M24').nachLaenge['200'].lengthEvidence.edition,'2022');
});

test('supplier matrices retain gaps and separate nominal cross-checks from normative completeness',()=>{
 assert.deepEqual(lengths('DIN7984','M3'),[5,6,8,10,14,16,20]);assert.equal(row('DIN7984','M3').nachLaenge['12'],undefined);
 assert.equal(row('DIN933','M3').nachLaenge['35'],undefined,'red Spinelli size is not an offered cell');
 assert.equal(row('DIN933','M6').nachLaenge['100'],undefined,'red Spinelli cell and blank Böllhoff cell');
 assert.ok(row('DIN933','M6').nachLaenge['110'],'explicit Böllhoff product can exist beyond Spinelli black cells');
 assert.equal(row('DIN933','M4').nachLaenge['20'].lengthEvidence.verification,true);
 assert.equal(row('DIN933','M33').nachLaenge['75'].lengthEvidence.verification,false);
 assert.equal(row('DIN603','M8').nachLaenge['35'].lengthEvidence.verification,true);
 assert.equal(row('DIN603','M8').nachLaenge['40'].lengthEvidence.verification,false);
 assert.equal(row('DIN603','M8').nachLaenge['40'].lengthEvidence.edition,null);
});

test('small flange standards keep their different M12 key while lengths stay separately evidenced',()=>{
 assert.equal(preset('EN1662','M12',40).kSW,16);assert.equal(preset('ISO15071','M12',40).kSW,15);
 for(const id of ['EN1662','ISO15071']){
  assert.equal(row(id,'M12').nachLaenge['40'].roh.threadMode,'full');
  assert.equal(row(id,'M12').nachLaenge['45'].roh.lg_max,15);
  assert.equal(row(id,'M12').nachLaenge['45'].roh.ls_min,6.25);
  assert.equal(row(id,'M12').nachLaenge['45'].lengthEvidence.verification,false);
 }
 assert.equal(f('ISO10642').currentEdition,'2026');
 assert.equal(row('ISO10642','M6').nachLaenge['20'].lengthEvidence.edition,'1997');
 assert.equal(row('ISO10642','M3').nachLaenge['6'].lengthEvidence.kind,'catalogue-matrix');
});
