'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const machines=require('../maschinen.json');
const material=E.findMaterial('C15C');
const base={typ:'bolzen',standardKind:'rivet',threadFamily:'none',wst:E.WERKSTOFFE.indexOf(material),d0:8,kopfForm:'rund',kD:13,kH:5,sD:8,sL:30,iTyp:'none',rm:400};
const jbf=machines.find(m=>m.m==='JBF-10B2S');
const emptySelection={passend:[],bedingt:[],fast:[],alle:[]};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('bolts, pins and rivets require their own positive shaft diameter and length',()=>{
 for(const standardKind of ['screw','pin','rivet'])for(const patch of [{sD:undefined,sL:undefined},{sD:undefined},{sL:undefined},{sD:null},{sL:null},{sD:0},{sL:0}]){
  const e={...base,standardKind,...patch},a=E.auslegen(e);
  assert.ok(a.fehlt.some(text=>/Schaftdurchmesser und Schaftlänge/.test(text)),JSON.stringify({standardKind,patch}));
  assert.deepEqual(a.werte,{});assert.deepEqual(a.stufen,[]);
  assert.deepEqual(E.waehle(machines,a,e),emptySelection);
  const concept=E.maschinenKonzept(a,e,jbf);assert.equal(concept.status,'incomplete');assert.deepEqual(concept.stages,[]);assert.equal(concept.blank,null);
 }
});

test('clearing a shaft cannot reuse an earlier complete calculation for machine selection',()=>{
 const complete=E.auslegen(base);assert.deepEqual(complete.fehlt,[]);
 for(const e of [{...base,sD:undefined},{...base,sL:0}]){
  assert.deepEqual(E.waehle(machines,complete,e),emptySelection);
  const concept=E.maschinenKonzept(complete,e,jbf);assert.equal(concept.status,'incomplete');assert.equal(concept.blank,null);assert.equal(concept.requiredStations,null);assert.deepEqual(concept.stages,[]);
 }
 assert.deepEqual(E.waehle(machines,null,base),emptySelection);
});

test('a complete solid rivet uses its actual shaft volume and prioritises the JBF bolt former',()=>{
 const a=E.auslegen(base);assert.deepEqual(a.fehlt,[]);assert.equal(a.qualitative,undefined);
 const volume=Math.PI/4*(13*13*5+8*8*30);close(a.werte.V,volume);close(a.werte.L0,volume/(Math.PI*64/4));
 const selected=E.waehle(machines,a,base);
 assert.equal(selected.bedingt[0].o.m,'JBF-10B2S');
 assert.ok(!selected.alle.some(row=>['JNF','JNFP','JNFR'].includes(row.o.f)));
 assert.ok(selected.bedingt.some(row=>row.o.f==='JPF'),'suitable parts formers remain candidates');
 const parts=selected.bedingt.find(row=>row.o.f==='JPF');assert.equal(E.maschinenKonzept(a,base,parts.o).status,'candidate');
 assert.equal(E.maschinenKonzept(a,base,jbf).status,'candidate');
 assert.equal(a.werte.Fmax_t,null,'no material-state assumption releases a force calculation');
});

test('JBF preference never overrides a known nominal cutoff limit',()=>{
 const e={...base,d0:9,sD:9},a=E.auslegen(e),found=E.waehle(machines,a,e);
 const row=found.alle.find(row=>row.o.m===jbf.m);
 assert.equal(row.gesamt,'nein');assert.equal(row.k.find(k=>k.krit==='Abschnitt-Ø').status,'nein');
 assert.ok(![...found.passend,...found.bedingt].some(row=>row.o.m===jbf.m));
 assert.equal(E.maschinenKonzept(a,e,jbf).status,'unsuitable');
});

test('threadless pins and rivets ignore deselected profile and tip data without inventing a shaft profile',()=>{
 for(const standardKind of ['rivet','pin']){
  const input={...base,standardKind},plain=E.auslegen(input);
  const stale={...input,sArea:NaN,tipArea:-1,tipLength:50,tipDiameter:'old profile'};
  assert.deepEqual(E.auslegen(stale),plain);
  assert.equal(plain.qualitative,undefined);assert.ok(!plain.stufen.some(stage=>/Spitze|Profil/.test(stage.v)));
 }
});

test('hidden rivet or pin selections cannot change a nut calculation or its catalogue family',()=>{
 const nut={typ:'mutter',wst:base.wst,d0:13,mSW:16,mH:8,mLoch:8.4};
 const plain=E.auslegen(nut),selected=E.waehle(machines,plain,nut);
 for(const standardKind of ['rivet','pin']){
  const e={...nut,standardKind,threadFamily:'none'},a=E.auslegen(e);
  assert.deepEqual(a,plain);assert.deepEqual(E.waehle(machines,a,e),selected);
 }
 assert.ok(selected.alle.some(row=>row.o.f==='JNFP'));
});

test('a deliberately shaftless general form part remains valid',()=>{
 const e={...base,typ:'formteil',standardKind:undefined,sD:undefined,sL:undefined},a=E.auslegen(e);
 assert.deepEqual(a.fehlt,[]);assert.ok(a.werte.V>0);
});
