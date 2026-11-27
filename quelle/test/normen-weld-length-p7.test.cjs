'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const f=require('../normen/ISO13918.json'),N=require('../normen/library.js'),R=require('../normen/resolver.js');
const data={schemaVersion:1,version:'p7-weld-length',families:[f],threads:require('../normen/gewinde.json')},variant=id=>f.variants.find(v=>v.id===id);
function document(form,size,length,prior={},policy='shaft-v2'){const s={id:f.id,form,groesse:size,...(length==null?{}:{laenge:length})};return R.resolveStandard(N.selectionLibrary(data,s),s,prior,policy?{shaftPolicy:policy}:{});}
test('PD copies the 90 populated Table 5 cells including the length-dependent b/y change, not a cross product',()=>{
 const v=variant('PD');assert.deepEqual(Object.values(v.sizeData).map(r=>Object.keys(r.nachLaenge).length),[10,15,16,15,14,13,7]);
 assert.equal(v.sizeData.M6.nachLaenge[30].roh.y_plus_2P,9);assert.equal(v.sizeData.M6.nachLaenge[30].roh.b,undefined);
 assert.equal(v.sizeData.M6.nachLaenge[35].roh.b,20);assert.equal(v.sizeData.M6.nachLaenge[35].roh.y_plus_2P,undefined);
 assert.equal(v.sizeData.M20.nachLaenge[50].roh.b,35);assert.equal(v.sizeData.M20.nachLaenge[55].roh.b,40);
 assert.equal(v.sizeData.M16.nachLaenge[100].roh.b,80);assert.equal(v.sizeData.M24.nachLaenge[150].roh.b,100);
 for(const [size,length]of [['M6',65],['M8',160],['M24',55],['M24',60],['M24',65],['M12',20]])assert.equal(v.sizeData[size].nachLaenge[length],undefined);
 for(const row of Object.values(v.sizeData))for(const [length,cell]of Object.entries(row.nachLaenge)){
  assert.equal(cell.roh.l2,+length);assert.deepEqual(cell.vorbelegung,{l2:+length});assert.equal(cell.lengthEvidence.reference,'l2');
  for(const [key,meta]of Object.entries(cell.fields)){
   if(key==='l2'&&meta.verification){assert.equal(meta.status,'verified');assert.deepEqual(meta.sourceRefs,['iso-2017','hilbig']);assert.equal(cell.lengthEvidence.verificationScope,'size-length-combination-only');}
   else{assert.equal(meta.verification,false);assert.equal(meta.status,'single-source');assert.deepEqual(meta.sourceRefs,['iso-2017']);}
  }
 }
 assert.equal(Object.values(v.sizeData).flatMap(row=>Object.values(row.nachLaenge)).filter(cell=>cell.fields.l2.verification).length,44);
});
test('eleven continuous length definitions retain real minima/ranges and never add fictitious dropdown cells',()=>{
 const ids=['FD','MD','RD','UD','ND','ID','SD','US','IS','UT','IT'];
 for(const id of ids)for(const row of Object.values(variant(id).sizeData)){assert.equal(Object.keys(row.nachLaenge).length,0);assert.ok(row.lengthDefinition.min>0);assert.equal(row.lengthDefinition.otherLengths,'by-agreement');assert.deepEqual(row.lengthDefinition.sourceRefs,['iso-2017']);}
 assert.equal(variant('FD').sizeData.M12.lengthDefinition.min,25);assert.equal(variant('MD').sizeData.M12.lengthDefinition.min,20);
 assert.equal(variant('RD').sizeData.M24.lengthDefinition.max,100);assert.equal(variant('ND').sizeData['3'].lengthDefinition.max,300);assert.equal(variant('ND').sizeData['4'].lengthDefinition.max,500);
 assert.equal(variant('UD').sizeData['6'].lengthDefinition.min,20);assert.equal(variant('UD').sizeData['6'].lengthDefinition.max,undefined);
 const sd=variant('SD').sizeData['10'].lengthDefinition;assert.equal(sd.min,30);assert.equal(sd.approximate,true);assert.equal(sd.kind,'approximate-minimum');
 assert.equal(variant('US').sizeData['3'].lengthDefinition.min,8);assert.equal(variant('UT').sizeData['7.1'].lengthDefinition.min,15);
});
test('the adapter distinguishes l2, calculated l1 and actual shank length with the stated angle assumption',()=>{
 const e=N.adapt(data,document('PD','M6',35));assert.equal(e.l2,35);assert.equal(e.l1,37.1);assert.equal(e.sL,undefined);assert.equal(e.weldingLength.selectionStatus,'listed');assert.equal(e.weldingLength.angleAssumption.value,140);assert.equal(e.normRequiresGeometryReview,true);assert.ok(!e.normMissingFields.includes('lengthBeforeWelding'));
 const ps=N.adapt(data,document('PS','M3',12));assert.equal(ps.l1,12);assert.equal(ps.l2,undefined);assert.equal(ps.weldingLength.angleAssumption,undefined);
 const nd=N.adapt(data,document('ND','3',70));assert.equal(nd.l1,73);assert.equal(nd.weldingLength.angleAssumption,undefined);
 const idSize=Object.keys(variant('ID').sizeData)[0],idMin=variant('ID').sizeData[idSize].lengthDefinition.min;
 assert.equal(N.adapt(data,document('ID',idSize,idMin)).l1,idMin+2.3);
 assert.equal(N.adapt(data,document('ID',idSize,idMin+10)).l1,undefined,'minimum-only conversion is not generalized');
});
test('free lengths remain available outside reference bounds and do not retain old automatic lengths',()=>{
 let doc=document('FD','M6',100),e=N.adapt(data,doc);assert.equal(e.weldingLength.selectionStatus,'within-reference');
 for(const value of [14,101])assert.equal(N.adapt(data,document('FD','M6',value)).weldingLength.selectionStatus,'by-agreement');
 const next=document('PS','M3',null,doc);e=N.adapt(data,next);assert.equal(e.l1,undefined);assert.equal(e.l2,undefined);assert.equal(e.sL,undefined);assert.equal(e.weldingLength.selectionStatus,'missing');assert.ok(e.normMissingFields.includes('lengthBeforeWelding'));
 const outside=N.adapt(data,document('PD','M6',65));assert.equal(outside.l1,67.1);assert.equal(outside.weldingLength.selectionStatus,'by-agreement');
 doc=R.setOverride(doc,'sL',42);e=N.adapt(data,document('PS','M3',12,doc));assert.equal(e.sL,42);assert.ok(!e.clearFields.includes('sL'));
 const legacy=N.adapt(data,document('FD','M6',100,{},null));assert.equal(legacy.weldingLength,undefined);assert.equal(legacy.l1,undefined);
});
