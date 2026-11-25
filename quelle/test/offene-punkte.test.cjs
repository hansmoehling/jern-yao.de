'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js'),M=require('../maschinen.json');
const material=E.findMaterial('C15C');
const base={typ:'bolzen',wst:E.WERKSTOFFE.indexOf(material),curveId:material.flowCurves[0].id,materialState:'soft-annealed',d0:8,kopfForm:'rund',kD:13,kH:5,sD:8,sL:30};
const machine=M.find(m=>m.m==='JBF-10B2S');
const check=(e=base,m=machine)=>E.pruefe(m,E.auslegen(e),e);

test('wire certificate gap belongs to customer/supplier and disappears with Rm',()=>{
 const r=check(),p=r.openPoints.find(p=>p.id==='wire-tensile-strength');
 assert.equal(r.gesamt,'offen');assert.equal(p.owner,'Kunde / Drahtlieferant');assert.match(p.detail,/Rm/);
 assert(!r.openPoints.some(p=>p.owner==='Jern Yao'));
 assert(!check({...base,rm:400}).openPoints.some(p=>p.id==='wire-tensile-strength'));
});
test('manufacturer gaps identify model data separately from customer inputs',()=>{
 const r=check({...base,rm:400,wenden:true},{...machine,ko:null,pko:null,kor:null,pw:null,cl:null});
 for(const id of ['machine-ko','machine-pko','machine-turning-length','machine-force','machine-cutoff-length']){
  assert.equal(r.openPoints.find(p=>p.id===id)?.owner,'Jern Yao',id);
 }
 assert(!r.openPoints.some(p=>p.owner==='Kunde / Drahtlieferant'));
 assert.equal(r.openPoints.filter(p=>p.id==='machine-force').length,1);
});
test('missing station and cutoff capacity are unknown rather than fabricated rejections',()=>{
 const r=check({...base,rm:400},{...machine,st:null,cd:null});
 assert.equal(r.k.find(k=>k.krit==='Stationen').status,'offen');
 assert.equal(r.k.find(k=>k.krit==='Abschnitt-Ø').status,'offen');
 assert(r.openPoints.some(p=>p.id==='machine-stations'));
 assert(r.openPoints.some(p=>p.id==='machine-cutoff-diameter'));
});
test('state evidence is customer input; missing curve and exhausted range belong to our engineering',()=>{
 assert.equal(check({...base,materialState:'unknown'}).openPoints.find(p=>p.id==='wire-condition').owner,'Kunde / Drahtlieferant');
 const mismatch=check({...base,materialState:'cold-drawn'});
 assert.equal(mismatch.openPoints.find(p=>p.id==='flow-curve').owner,'Unsere Auslegung');
 assert(!mismatch.openPoints.some(p=>p.id==='wire-condition'));
 const m=E.findMaterial('NiFe 47');assert(m);
 const missing=check({...base,wst:E.WERKSTOFFE.indexOf(m),curveId:undefined});
 assert.equal(missing.openPoints.find(p=>p.id==='flow-curve').owner,'Unsere Auslegung');
 const outside=check({...base,kD:24,kH:10});
 assert.equal(outside.openPoints.find(p=>p.id==='flow-curve-range').owner,'Unsere Auslegung');
 assert.equal(outside.openPoints.filter(p=>p.id==='flow-curve-range').length,1);
});
test('recess geometry and unmodelled profile force have different owners',()=>{
 const r=check({...base,iTyp:'torx',iSize:'T20',iT:2});
 assert.equal(r.openPoints.find(p=>p.id==='part-recess-volume').owner,'Kunde');
 assert.equal(r.openPoints.find(p=>p.id==='drive-force-model').owner,'Unsere Auslegung');
 const supplied=check({...base,iTyp:'torx',iSize:'T20',iT:2,iVol:12});
 assert(!supplied.openPoints.some(p=>p.id==='part-recess-volume'));
 assert(supplied.openPoints.some(p=>p.id==='drive-force-model'));
});
