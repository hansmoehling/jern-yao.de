'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../normen/library.js'),R=require('../normen/resolver.js'),T=require('../normen/to-chain.js'),E=require('../engine.js');
const f=require('../normen/DIN7500.json'),data={schemaVersion:1,version:'p7-duo',families:[f,require('../normen/ISO14583.json'),require('../normen/ISO14584.json')],threads:require('../normen/gewinde.json')};
function doc(form,size='M3',length=10,prior={}){const s={id:f.id,form,groesse:size,laenge:length};return R.resolveStandard(L.selectionLibrary(data,s),s,prior,{shaftPolicy:'shaft-v2'});}
const variant=id=>f.variants.find(v=>v.id===id);

test('Duo hexalobular variants have their own manufacturer dimensions and 53 actual length cells',()=>{
 assert.equal(variant('C').antrieb.art,'pz');assert.equal(variant('M').antrieb.art,'pz');
 assert.equal(variant('C').sizeData.M3.vorbelegung.kD,5.6);assert.equal(variant('C').sizeData.M3.vorbelegung.kH,2.4);
 assert.equal(variant('M').sizeData.M3.vorbelegung.kD,5.5);
 for(const [id,count]of [['C-DUO-TX',28],['M-DUO-TX',25]]){
  const v=variant(id);assert.equal(v.antrieb.art,'torx');assert.equal(v.threadFamily,'trilobular');assert.equal(v.formingThreadDesignation,'Duo');assert.equal(v.catalogueEdition,'2013-01');
  assert.deepEqual(Object.keys(v.sizeData),['M2.5','M3','M4','M5','M6']);
  assert.equal(Object.values(v.sizeData).reduce((n,row)=>n+Object.keys(row.nachLaenge).length,0),count);
  for(const [size,row]of Object.entries(v.sizeData)){
   assert.equal(row.geometryStatus,'partial');assert.equal(row.roh.P,undefined,'do not attach an unprinted pitch to this source');
   for(const key of Object.keys(row.roh)){const m=v.fields[size][key];assert.equal(m.status,'single-source');assert.equal(m.verification,false);assert.deepEqual(m.sourceRefs,['boellhoff-duo-torx-2013']);assert.equal(f.sourceMeta[m.sourceRefs[0]].type,'manufacturer');}
   assert.equal(v.fields[size].iT.status,'missing');assert.equal(v.fields[size].sArea.status,'missing');
   for(const cell of Object.values(row.nachLaenge)){assert.equal(cell.lengthEvidence.kind,'manufacturer-range');assert.equal(cell.lengthEvidence.verification,false);assert.equal(cell.lengthEvidence.edition,'2013-01');}
  }
 }
 assert.deepEqual(variant('C-DUO-TX').sizeData.M3.laengen,[5,6,8,10,12,16]);
 assert.equal(variant('C-DUO-TX').sizeData.M3.nachLaenge[20],undefined);
 assert.equal(variant('M-DUO-TX').sizeData['M2.5'].nachLaenge[5],undefined);
 assert.equal(variant('C-DUO-TX').sizeData['M2.5'].vorbelegung.iSize,8);
});

test('the adapter distinguishes Duo heads and drive sizes without inventing blank diameter, depth or net volume',()=>{
 const c=L.adapt(data,doc('C-DUO-TX')),m=L.adapt(data,doc('M-DUO-TX'));
 assert.equal(c.kopfForm,'linse');assert.equal(c.kD,6);assert.equal(c.kH,2.52);assert.equal(c.iTyp,'torx');assert.equal(c.iSize,'T10');assert.equal(c.sL,10);
 assert.equal(m.kopfForm,'kegelstumpf');assert.equal(m.kD,5.6);assert.equal(m.kH,1.65);assert.equal(m.totalLength,10);assert.equal(m.sL,null);
 for(const e of [c,m]){assert.equal(e.sD,undefined);assert.equal(e.iT,undefined);assert.equal(e.iVol,undefined);assert.equal(e.normRequiresGeometryReview,true);assert.ok(e.normMissingFields.includes('rollingBlankDiameter'));assert.ok(e.normMissingFields.includes('iT'));}
 assert.ok(c.normMissingFields.includes('headProfileDefinition'));assert.equal(c.capHeight,undefined);
 assert.throws(()=>T.fromBolt(c,E.boltGeometry(c)),/Schaft|Kopf|Bauteil/);
});

test('switching from a known Torx norm cannot silently reuse its automatic drive depth or head crown',()=>{
 let previous=R.resolveStandard(data,{id:'ISO14584',groesse:'M6',laenge:20},{},{shaftPolicy:'shaft-v2'});
 assert.ok(previous.effective.iT>0);assert.ok(previous.effective.capHeight>0);
 const next=doc('C-DUO-TX','M6',20,previous),e=L.adapt(data,next);
 assert.equal(e.iSize,'T30');assert.equal(e.iT,undefined);assert.equal(e.capHeight,undefined);
 for(const field of ['iT','capHeight','sD','sArea','iVol','kC','kVol'])assert.ok(e.clearFields.includes(field),field);
 previous=R.setOverride(previous,'iT',1.4);previous=R.setOverride(previous,'sD',5.2);previous=R.setOverride(previous,'capHeight',2);previous=R.setOverride(previous,'iVol',3);
 const custom=L.adapt(data,doc('C-DUO-TX','M6',20,previous));
 assert.equal(custom.iT,1.4);assert.equal(custom.sD,5.2);assert.equal(custom.capHeight,2);assert.equal(custom.iVol,3);
 for(const field of ['iT','capHeight','sD','iVol'])assert.ok(!custom.clearFields.includes(field),field);
});

test('both new variant names have distinct five-language labels',()=>{
 const catalog=Object.assign({},...fs.readdirSync(path.join(__dirname,'..')).filter(name=>/^i18n-.*\.json$/.test(name)).sort().map(name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8'))));
 const mod={exports:{}};new Function('module',fs.readFileSync(path.join(__dirname,'../i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalog)))(mod);
 for(const lang of ['de','it','sl','en','zh']){
  const names=['C-DUO-TX','M-DUO-TX'].map(id=>mod.exports.t(variant(id).label,lang));assert.notEqual(names[0],names[1]);
  for(const name of names){assert.match(name,/Duo/);if(lang!=='de')assert.doesNotMatch(name,/Linsenkopf|Senkkopf|Innensechsrund/);}
 }
});
