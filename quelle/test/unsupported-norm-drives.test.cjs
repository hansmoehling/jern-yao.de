'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library.js'),R=require('../normen/resolver.js');
const data={version:'slot-regression',families:['ISO4766','ISO7434','ISO7435','ISO7436','ISO7050'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json')};

test('unsupported slotted set-screw drives remain open after all end dimensions are supplied',()=>{
 for(const id of ['ISO4766','ISO7434','ISO7435','ISO7436']){
  let doc=R.resolveStandard(data,{id,groesse:'M6',laenge:20});
  if(id==='ISO7436')doc=R.setOverride(doc,'schaftende','voll');else doc=R.setOverride(doc,'endLength',2);
  let a=N.adapt(data,doc);assert.equal(a.iTyp,'slot');assert(a.normRequiresGeometryReview);assert.deepEqual(a.normMissingFields,['unsupportedDriveContour']);
  doc=R.setOverride(doc,'iVol',12);a=N.adapt(data,doc);assert(a.normRequiresGeometryReview,'a volume alone cannot silently turn an unrepresented slot into no drive');
  doc=R.setOverride(doc,'iTyp','hex');doc=R.setOverride(doc,'iSW',3);a=N.adapt(data,R.restore(JSON.stringify(doc)));
  assert.equal(a.iTyp,'hex');assert(!a.normMissingFields.includes('unsupportedDriveContour'));assert(!a.normRequiresGeometryReview);assert.equal(a.standardDocument.overrides.iTyp.origin,'customer');
 }
});

test('a drive edit never clears an unrelated countersunk shaft-length gap',()=>{
 let doc=R.resolveStandard(data,{id:'ISO7050',groesse:'ST3.5',laenge:13});doc=R.setOverride(doc,'iTyp','none');doc=R.setOverride(doc,'sD',3);const a=N.adapt(data,doc);
 assert.equal(a.sL,undefined);assert.equal(a.totalLength,13);assert(a.normRequiresGeometryReview);assert(a.normMissingFields.includes('headToShaftLength'));
});
