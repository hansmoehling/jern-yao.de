'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../normen/resolver.js'),N=require('../normen/library.js');
const ids=['ISO4026','ISO4027','ISO4028','ISO4029','ISO4766','ISO7434','ISO7435','ISO7436','DIN835','DIN938','DIN939','DIN940','ISO2338','ISO2340','ISO2341','ISO8734','ISO8735',...Array.from({length:8},(_,i)=>'ISO'+(8740+i))];
const families=ids.map(id=>require('../normen/'+id+'.json')),data={schemaVersion:1,version:'p7-headless-pins',families,threads:require('../normen/gewinde.json')},f=id=>families.find(x=>x.id===id);
const resolve=(id,size,length)=>R.resolveStandard(data,{id,groesse:size,laenge:length},{},{shaftPolicy:'shaft-v2',lengthOrigin:'standard'});
test('P7 length cells retain exact edition, source locator and nominal-only scope',()=>{
 let count=0;
 for(const family of families)for(const [size,row]of Object.entries(family.groessen))for(const [length,cell]of Object.entries(row.nachLaenge||{})){
  count++;assert.equal(cell.lengthEvidence.kind,'standard-commercial-matrix');assert.ok(cell.lengthEvidence.edition);assert.ok(cell.lengthEvidence.locator);assert.equal(cell.lengthEvidence.nominalOnly,true);
  for(const field of Object.values(cell.fields)){assert.ok(field.note);assert.equal(typeof field.verification,'boolean');for(const ref of field.sourceRefs)assert.ok(family.sourceMeta[ref],family.id+'/'+size+'/'+length+'/'+ref);}
  const field=cell.fields[family.feldzuordnung[family.id.startsWith('DIN')?'nominalLength':'sL']||'sL'];assert.equal(field.nominal,Number(length));
 }
 assert.ok(count>3000);
});
test('ISO socket sizes and depth branches follow the 2003 original, not DIN comparison sizes',()=>{
 for(const id of ['ISO4026','ISO4027','ISO4028','ISO4029']){
  const a=f(id);assert.equal(a.edition,'2003');assert.equal(a.currentEdition.edition,'2026');assert.equal(a.currentEdition.dimensionCoverage,'unresearched');
  assert.ok(a.groessen['M1.6']);assert.ok(a.groessen.M24);for(const size of ['M14','M18','M22']){assert.equal(a.groessen[size],undefined);assert.equal(a.sizeCoverage[size].status,'not-in-standard');}
  assert.equal(a.groessen.M3.roh.s_max,1.58);assert.equal(resolve(id,'M3',null).effective.iT,undefined);
 }
 assert.equal(resolve('ISO4026','M3',3).effective.iT,1.2);assert.equal(resolve('ISO4026','M3',4).effective.iT,2);
 assert.equal(resolve('ISO4027','M3',4).effective.iT,1.2);assert.equal(resolve('ISO4027','M3',5).effective.iT,2);
 assert.equal(resolve('ISO4028','M3',6).effective.iT,1.2);assert.equal(resolve('ISO4028','M3',8).effective.iT,2);
 assert.equal(f('ISO4028').groessen.M3.nachLaenge[6].roh.z_min,.75);assert.equal(f('ISO4028').groessen.M3.nachLaenge[8].roh.z_min,1.5);
});
test('slotted set-screw old length matrices never masquerade as 2024 length evidence',()=>{
 for(const id of ['ISO4766','ISO7434','ISO7435','ISO7436']){assert.equal(f(id).lengthEdition,'1983');assert.equal(f(id).currentLengthMatrixVerified,false);assert.ok(f(id).groessen['M3.5']);}
 assert.equal(f('ISO4766').groessen.M8.nachLaenge[6],undefined);assert.ok(f('ISO4766').groessen.M8.nachLaenge[8]);
 assert.ok(f('ISO7435').groessen['M1.6'].nachLaenge['2.5']);assert.equal(f('ISO7435').groessen.M3.nachLaenge[4],undefined);
 assert.equal(f('ISO7436').groessen.M8.nachLaenge[6],undefined);assert.ok(f('ISO7436').groessen.M8.nachLaenge[8]);
 assert.equal(f('ISO7434').groessen['M1.6'].nachLaenge['2.5'].roh.tipAngle,120);assert.equal(f('ISO7434').groessen['M1.6'].nachLaenge[3].roh.tipAngle,90);
 assert.equal(f('ISO7434').groessen['M2.5'].nachLaenge[3].endGeometryEvidence.blankTreatment,'cylinder-before-thread-rolling');
});
test('commercial pin matrix limits are not extrapolated or treated as machine restrictions',()=>{
 assert.deepEqual(N.lengths(f('ISO2338'),'0.6'),['2','3','4','5','6']);
 assert.equal(f('ISO2338').groessen['6'].nachLaenge[10],undefined);assert.ok(f('ISO2338').groessen['6'].nachLaenge[12]);assert.ok(f('ISO2338').groessen['50'].nachLaenge[100]);
 assert.equal(f('ISO8734').groessen['8'].nachLaenge[18],undefined);assert.ok(f('ISO8734').groessen['8'].nachLaenge[20]);
 assert.equal(f('ISO8735').groessen['6'].nachLaenge[80],undefined);assert.ok(f('ISO8735').groessen['6'].nachLaenge[75]);
 for(const id of ['ISO2340','ISO2341']){assert.ok(f(id).groessen['100'].nachLaenge[200]);assert.equal(f(id).groessen['100'].nachLaenge[180],undefined);}
 const custom=resolve('ISO2338','2',200);assert.ok(custom.issues.some(x=>x.code==='length-not-resolved'));assert.ok(!custom.issues.some(x=>/excluded|not-in-standard/.test(x.code)));
});
test('stud length is separate from the insertion end and custom-length exceptions stay open',()=>{
 for(const id of ['DIN835','DIN938','DIN939','DIN940']){
  const doc=resolve(id,'M10',75);assert.equal(doc.effective.nominalLength,75);assert.equal(doc.effective.nutEndThreadLength,26);assert.equal(doc.effective.sL,undefined);
  const part=N.adapt(data,doc);assert.equal(part.sL,null);assert.ok(part.normMissingFields.includes('shaftLengthDistribution'));
 }
 assert.equal(f('DIN938').edition,'2012-12');assert.equal(f('DIN938').groessen.M27.vorbelegung.metalEndLength,25);
 assert.equal(f('DIN938').normstatus.status,'withdrawn');assert.equal(f('DIN938').currentEdition.edition,'2025-08');
 assert.equal(f('DIN939').groessen.M52.vorbelegung.metalEndLength,65);assert.ok(f('DIN939').groessen.M52.nachLaenge[400]);
 assert.equal(f('DIN938').groessen.M10.nachLaenge[20],undefined);assert.equal(resolve('DIN938','M10',20).effective.nutEndThreadLength,undefined);
});
test('supplier matrices add exact independent witnesses without replacing normative coverage',()=>{
 const a=f('ISO4026'),c=a.groessen.M3.nachLaenge[4];assert.equal(c.fields.sL.verification,true);assert.equal(c.fields.sL.sourceRefs.length,2);
 assert.ok(a.supplierLengthPrograms.some(p=>p.sizes.M3.includes(14)));assert.equal(a.groessen.M3.nachLaenge[14],undefined,'supplier stock outside the original ISO commercial matrix stays separate');
 assert.equal(f('ISO2338').groessen['3'].nachLaenge[10].fields.l_nominal.verification,true);
 for(const k of ['c','t1'])assert.equal(f('ISO8735').fields['10'][k].status,'conflict','disagreeing supplier geometry does not become a verified original dimension');
});
test('historical groove and headed-pin ranges keep material-dependent expansion unresolved',()=>{
 for(let n=8740;n<=8747;n++){
  const a=f('ISO'+n);assert.equal(a.edition,'1997');assert.equal(a.currentEdition.dimensionCoverage,'unresearched');
  for(const row of Object.values(a.groessen))for(const cell of Object.values(row.nachLaenge)){assert.ok(cell.missingGeometryFields.includes('expandedDiameterAtSelectedLength'));assert.equal(cell.vorbelegung.d0,undefined);}
 }
 assert.equal(f('ISO8740').groessen['6'].roh.a,.8);assert.ok(f('ISO8740').groessen['25'].nachLaenge[26]);
 assert.equal(f('ISO8746').groessen['2'].vorbelegung.kH,1.3);assert.equal(f('ISO8746').groessen['2'].roh.k_min,1.1);
});
