'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library.js'),R=require('../normen/resolver.js');
const ids=['ISO8676','ISO8765','DIN961','ISO4762','ISO14579','ISO14580','ISO14583','ISO14584','ISO4026'];
const data={schemaVersion:1,version:'p7-missing-rolling-blank',families:ids.map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json')};
const cases=[['ISO8676','M18',35],['ISO8765','M18',80],['ISO8765','M20',80],['ISO8765','M22',90],['DIN961','M18',35],['DIN961','M22',35],['ISO4762','M36',80],...['ISO14579','ISO14580','ISO14583','ISO14584','ISO4026'].flatMap(id=>[[id,'M2',6],[id,'M2.5',6]])];
function doc(id,size,length,policy='shaft-v2'){return R.resolveStandard(data,{id,groesse:size,laenge:length},{partSnapshot:{sD:5.27}},policy?{shaftPolicy:policy}:{});}

test('missing 6g records clear an inherited automatic blank for screws and headless threaded parts',()=>{
 for(const [id,size,length]of cases){
  const d=doc(id,size,length),p=N.adapt(data,d),tag=id+' '+size;
  assert.equal(p.threadModel,null,tag);assert.equal(p.sD,null,tag);assert.ok(p.clearFields.includes('sD'),tag);
  assert.ok(p.normMissingFields.includes('rollingBlankDiameter'),tag);assert.equal(p.normRequiresGeometryReview,true,tag);
  assert.equal(p.sL,N.adapt(data,R.setOverride(d,'sD',Number(size.slice(1))-0.5)).sL,tag+' preserves the sourced length reference');
  const legacy=N.adapt(data,doc(id,size,length,null));assert.equal(legacy.sD,undefined,tag);assert.ok(!legacy.clearFields?.includes('sD'),tag);
  for(const field of ['kD','kH','kSW','iSW'])if(d.effective[field]!=null)assert.equal(p[field],d.effective[field],tag+'/'+field);
 }
});

test('explicit customer rolling diameters survive the guard and rebuild documented partial shafts',()=>{
 for(const [id,size,length]of cases){
  const d=R.setOverride(doc(id,size,length),'sD',Number(size.slice(1))-0.5),p=N.adapt(data,d);
  assert.equal(p.sD,Number(size.slice(1))-0.5);assert.ok(!p.clearFields?.includes('sD'));assert.ok(!p.normMissingFields.includes('rollingBlankDiameter'));
 }
 const p=N.adapt(data,R.setOverride(doc('ISO8765','M18',80),'sD',16.6));
 assert.ok(p.shaftSegments?.length>1);assert.equal(p.shaftSegments.at(-1).diameter,16.6);assert.equal(p.shaftSegments.reduce((sum,s)=>sum+s.length,0),80);
 const invalid=N.adapt(data,R.setOverride(doc('ISO8676','M18',35),'sD',0));assert.equal(invalid.normRequiresGeometryReview,true);assert.ok(invalid.normMissingFields.includes('rollingBlankDiameter'));
});

test('known 6g rows and all five missing-diameter translations remain available',()=>{
 const p=N.adapt(data,doc('ISO4762','M6',30));assert.equal(p.sD,5.27);assert.ok(!p.clearFields?.includes('sD'));assert.ok(!p.normMissingFields.includes('rollingBlankDiameter'));
 const texts=require('../i18n-preview.json')['Durchmesser des Walzrohlings'];assert.equal(texts.length,4);
 assert.equal(N.missingLabel('rollingBlankDiameter',key=>key),'Durchmesser des Walzrohlings');
 for(const text of texts){assert.ok(text.length>3);assert.notEqual(text,'Durchmesser des Walzrohlings');assert.equal(N.missingLabel('rollingBlankDiameter',()=>text),text);}
});
