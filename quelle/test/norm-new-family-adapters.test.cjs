'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library.js'),R=require('../normen/resolver.js');
const data={version:'adapter-regression',families:['DIN7500','ISO7049','ISO7050','ISO7051','ISO14581','DIN835','DIN938','DIN939','DIN940','ISO7379'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json')};
function resolve(selection){return R.resolveStandard(N.selectionLibrary(data,selection),selection);}

test('DIN7500 forms C and M retain their own geometry and never inherit a metric circular roll blank',()=>{
 for(const form of ['C','M']){
  const doc=resolve({id:'DIN7500',form,groesse:'M5',laenge:10}),a=N.adapt(data,doc);
  assert.equal(a.threadFamily,'trilobular');assert.equal(a.iTyp,'pz');assert.equal(a.sD,undefined);assert(a.normRequiresGeometryReview);assert(a.normMissingFields.includes('sArea'));
  if(form==='C')assert.equal(a.sL,10);else{assert.equal(a.totalLength,10);assert.equal(a.sL,undefined);assert(a.normMissingFields.includes('headToShaftLength'));}
 }
});

test('ST screw families retain ST sizing, rolling-tip semantics and the documented length reference',()=>{
 for(const [id,field]of [['ISO7049','sL'],['ISO7050','totalLength'],['ISO7051','countersunkLength']]){
  const doc=resolve({id,groesse:'ST3.5',laenge:13}),a=N.adapt(data,doc);
  assert.equal(a.threadFamily,'self-tapping');assert.equal(a.threadModel,null);assert.equal(a.sD,undefined);assert.equal(a[field],13);assert(a.normRequiresGeometryReview);assert(a.normMissingFields.includes('rollingBlankDiameter'));
  if(field!=='sL'){assert.equal(a.sL,undefined);assert(a.normMissingFields.includes('headToShaftLength'));}
  if(id==='ISO7051')assert.equal(a.capHeight,.8);
 }
 const doc=resolve({id:'ISO7050',groesse:'ST3.5',laenge:13});let changed=R.setOverride(doc,'sD',3);changed=R.setOverride(changed,'sL',10.65);const a=N.adapt(data,changed);
 assert.equal(a.totalLength,13);assert.equal(a.sL,10.65);assert.equal(a.sD,3);assert(!a.normRequiresGeometryReview);assert(a.normMissingFields.includes('recessVolumeModel'),'drive volume remains visibly unresolved and is handled by the engine');
});

test('countersunk metric length includes the head and is never directly treated as shaft length',()=>{
 const a=N.adapt(data,resolve({id:'ISO14581',groesse:'M4',laenge:5}));assert.equal(a.totalLength,5);assert.equal(a.sL,undefined);assert(a.normRequiresGeometryReview);assert.equal(a.iSize,'T20');
});

test('stud nominal lengths exclude the separate metal end and require the real shaft distribution',()=>{
 for(const id of ['DIN835','DIN938','DIN939','DIN940']){
  const a=N.adapt(data,resolve({id,groesse:'M6',laenge:30}));assert(a.metalEndLength>0);assert.equal(a.sL,undefined);assert.equal(a.sD,undefined);assert(a.normRequiresGeometryReview);assert(a.normMissingFields.includes('shaftLengthDistribution'));
 }
});

test('ISO7379 shoulder lengths are not whole shafts and thread roll diameter is not the shoulder',()=>{
 const f=data.families.find(f=>f.id==='ISO7379'),length=Number(Object.keys(f.groessen.M6.nachLaenge)[0]);
 let doc=resolve({id:'ISO7379',groesse:'M6',laenge:length}),a=N.adapt(data,doc);
 assert(a.kD>0);assert.equal(a.sD,undefined);assert.equal(a.sL,undefined);assert(a.normRequiresGeometryReview);assert(a.normMissingFields.includes('shaftLengthDistribution'));
 doc=R.setOverride(doc,'sL',30);doc=R.setOverride(doc,'sD',8);doc=R.setOverride(doc,'shaftSegments',[{diameter:8,length:20},{diameter:5.27,length:10}]);a=N.adapt(data,doc);
 assert(!a.normRequiresGeometryReview);assert.equal(a.shaftSegments.length,2);assert.equal(a.sL,30);assert.equal(a.standardDocument.overrides.shaftSegments.origin,'customer');
});
