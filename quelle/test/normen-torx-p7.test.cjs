'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library.js'),R=require('../normen/resolver.js'),E=require('../engine.js'),P=require('../standard-preview.js'),T=require('../normen/to-chain.js'),C=require('../axial-chain.js'),G=require('../geometry-model.js');
const ids=['ISO14579','ISO14580','ISO14583','ISO14584'],families=ids.map(id=>require('../normen/'+id+'.json'));
const data={schemaVersion:1,version:'p7-torx',families,threads:require('../normen/gewinde.json')},family=id=>families.find(f=>f.id===id),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),area=d=>Math.PI*d*d/4,cap=(d,h)=>Math.PI*h*(3*d*d/4+h*h)/6,cone=(D,d,h)=>Math.PI*h*(D*D+D*d+d*d)/12;
function document(id,size='M6',length=20){return R.resolveStandard(data,{id,groesse:size,laenge:length},{},{shaftPolicy:'shaft-v2'});}
function input(doc){return {...N.adapt(data,doc),typ:'bolzen',wst:0,d0:5.27};}
test('all four current editions have direct 2011 dimension evidence, and all published defaults retain their source status',()=>{
 for(const f of families){assert.equal(f.edition,'2011');assert.equal(f.normstatus.status,'current');assert.equal(f.pruefdatum,'2026-11-27');
  for(const [size,row]of Object.entries(f.groessen))for(const [key,value]of Object.entries(row.roh)){
   const m=f.fields[size][key];assert.equal(m.nominal,value,`${f.id}/${size}/${key}`);assert.ok(m.sourceRefs.includes('iteh'+f.id.slice(3)+'_2011'));assert.ok(m.note);
   for(const ref of m.sourceRefs)assert.ok(f.sourceMeta[ref]);
   if(m.verification){assert.equal(m.status,'verified');assert.ok(new Set(m.sourceRefs.map(ref=>new URL(f.sourceMeta[ref].url).hostname)).size>=2);}
  }
 }
 assert.equal(family('ISO14579').groessen.M20.vorbelegung.iSize,90);
 for(const id of ['ISO14580','ISO14583','ISO14584'])assert.deepEqual(Object.keys(family(id).groessen),['M2','M2.5','M3','M3.5','M4','M5','M6','M8','M10']);
});
test('supplier mistakes never replace original values or become false second confirmations',()=>{
 const f=family('ISO14580');assert.equal(f.groessen.M6.roh.t_max,2.29);assert.deepEqual(f.fields.M6.t_max.sourceRefs,['iteh14580_2011','aspen14580']);assert.equal(f.sourceConflicts[0].rejected.value,2.26);
 const raised=family('ISO14584');assert.equal(raised.groessen.M6.roh.k_max,3.3);assert.ok(!raised.fields.M6.k_max.sourceRefs.includes('opm14584'));assert.equal(raised.fields.M3_5,undefined);assert.equal(raised.groessen['M3.5'].roh.k_max,2.35);
});
test('length options are individual two-source cells, not supplier diameter×length cross-products',()=>{
 assert.deepEqual(families.map(f=>Object.values(f.groessen).reduce((n,row)=>n+Object.keys(row.nachLaenge).length,0)),[91,86,91,107]);
 for(const f of families)for(const row of Object.values(f.groessen))for(const [length,child]of Object.entries(row.nachLaenge)){assert.equal(child.roh.sL,+length);assert.equal(child.lengthEvidence.kind,'standard-matrix');assert.equal(child.lengthEvidence.edition,'2011');assert.equal(child.lengthEvidence.verification,true);assert.equal(child.fields.sL.sourceRefs.length,2);}
 assert.ok(!family('ISO14580').groessen.M2.nachLaenge[25]);assert.ok(!family('ISO14584').groessen.M2.nachLaenge[30]);assert.ok(!family('ISO14583').groessen.M2.nachLaenge[18]);assert.equal(family('ISO14580').groessen['M3.5'].lengthCoverage,'unresearched');
});
test('ISO14583 uses its sourced approximate radius for a cylinder plus spherical crown and keeps the norm baseline',()=>{
 const doc=document('ISO14583'),before=JSON.stringify(doc),e=input(doc),g=E.boltGeometry(e);
 assert.ok(!g.error);close(e.capHeight,2);close(e.kC,2.6);close(g.totalLength,24.6);close(g.headVolume,area(12)*2.6+cap(12,2));
 assert.equal(e.headModelAssumption.origin,'assumption');assert.equal(e.headModelAssumption.exactNormContour,false);assert.equal(e.headModelAssumption.radius,10);assert.equal(doc.normBaseline.values.capHeight,undefined);assert.equal(JSON.stringify(doc),before);
 const html=P.render({input:e,analysis:E.auslegen(e),format:n=>n.toFixed(2)});assert.ok(html.includes('data-preview="outer"'));assert.ok(!/NaN|Infinity/.test(html));
});
test('ISO14584 nominal length includes the cone, but excludes the raised crown',()=>{
 const e=input(document('ISO14584')),g=E.boltGeometry(e);assert.ok(!g.error);close(e.sL,16.7);close(g.totalLength,21.4);close(g.headVolume,cone(11.3,5.27,3.3)+cap(11.3,1.4));
 assert.equal(e.headModelAssumption.lengthReference.kind,'includes-cone-excludes-crown');assert.equal(e.headModelAssumption.lengthReference.nominalLength,20);
 const invalid=input(document('ISO14584','M6',2));assert.equal(invalid.sL,null);assert.equal(invalid.normRequiresGeometryReview,true);assert.ok(invalid.normMissingFields.includes('headToShaftLength'));
});
test('edited crown, head height and shaft remain customer geometry; a model crown is not offered as a norm dimension',()=>{
 let doc=R.setOverride(document('ISO14583'),'capHeight',1.5),e=input(doc);close(e.capHeight,1.5);assert.equal(e.kC,undefined);
 doc=R.resetOverride(doc,'capHeight');close(input(R.restore(JSON.stringify(doc))).capHeight,1.5);assert.ok(doc.issues.some(x=>x.code==='reset-baseline-unavailable'));close(input(document('ISO14583')).capHeight,2);
 doc=R.setOverride(document('ISO14584'),'kH',4);close(input(doc).sL,16);doc=R.setOverride(doc,'sL',31);e=input(doc);close(e.sL,31);close(E.boltGeometry(e).totalLength,36.4);assert.equal(e.headModelAssumption.lengthReference.shaftLengthOrigin,'customer');
 const original=document('ISO14583');const tooWide=input(R.setOverride(original,'kD',25));assert.ok(tooWide.normMissingFields.includes('headProfileDefinition'));
});
test('a long ISO14579 uses observed l_s/l_g, while ambiguous long cheese/pan/raised shanks stay explicit',()=>{
 const e=input(document('ISO14579','M6',40));assert.deepEqual(e.shaftSegments,[{diameter:6,length:13.5},{diameter:5.27,length:26.5}]);assert.equal(e.shaftModelAssumption.origin,'assumption');assert.equal(e.shaftModelAssumption.min,11);assert.equal(e.shaftModelAssumption.max,16);
 for(const id of ['ISO14580','ISO14583','ISO14584']){const part=input(document(id,'M6',50));assert.ok(part.normMissingFields.includes('shaftLengthDistribution'));assert.equal(part.normRequiresGeometryReview,true);}
 const custom=input(R.setOverride(document('ISO14583','M6',50),'shaftSegments',[{diameter:6,length:10},{diameter:5.27,length:40}]));assert.equal(custom.normRequiresGeometryReview,false);assert.deepEqual(custom.shaftSegments,[{diameter:6,length:10},{diameter:5.27,length:40}]);
});
test('outer head contour transfers volume and provenance; unresolved Torx contour is never silently deleted',()=>{
 for(const id of ['ISO14583','ISO14584']){
  const doc=document(id),original=input(doc);assert.throws(()=>T.fromBolt(original,E.boltGeometry(original)),/Antriebsprofil/);
  const e=input(R.setOverride(doc,'iTyp','none')),g=E.boltGeometry(e),chain=T.fromBolt(e,g),project=C.project(chain),result=G.evaluate(project.spec);
  assert.equal(project.ok,true);assert.equal(result.valid,true);close(result.volumeMm3,g.headVolume+g.shaftVolume);assert.deepEqual(chain.standardDocument,e.standardDocument);assert.deepEqual(chain.modelAssumptions.head,e.headModelAssumption);
 }
});
