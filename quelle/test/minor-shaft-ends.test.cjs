'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),N=require('../normen/library.js'),R=require('../normen/resolver.js'),M=require('../maschinen.json');
const material=E.findMaterial('20MnB4');
const data={schemaVersion:1,version:'test',families:['ISO4762','ISO4017','ISO4014'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json')};
function input(id,size,length){const a=N.adapt(data,R.resolveStandard(data,{id,groesse:size,laenge:length}));return {...a,typ:'bolzen',kopfTyp:a.kopfForm==='rund'?'zylinder':a.kopfForm,wst:E.WERKSTOFFE.indexOf(material),curveId:material.flowCurves[0].id,materialState:material.flowCurves[0].state,rm:400,d0:id==='ISO4762'?5.6:7.2};}

for(const [id,size,length] of [['ISO4762','M6',30],['ISO4017','M8',40]])test(id+' '+size+' × '+length+' remains calculable with a small rounded end and yields machine candidates',()=>{
 const e=input(id,size,length),a=E.auslegen(e),reference=E.auslegen({...e,schaftende:'voll'}),found=E.waehle(M,a,e);
 assert.equal(e.schaftende,'kuppe');assert(!e.normRequiresGeometryReview);assert.deepEqual(e.normMissingFields,[]);assert.equal(e.shaftEndAssumption.volumeModel,'full-envelope');assert.deepEqual(a.fehlt,[]);assert(a.werte.Fmax_t>0);assert.deepEqual(a.werte,reference.werte);assert.deepEqual(a.stufen,reference.stufen);assert(a.hinweise.some(s=>/Kleine Endkuppe/.test(s)));assert(found.passend.length+found.bedingt.length>0);
});

test('ISO4014 minor end does not invent a geometry blocker or conceal an unresolved length distribution',()=>{
 const e=input('ISO4014','M8',41);assert(!e.normRequiresGeometryReview);assert(!e.normMissingFields.includes('shaftEndProfile'));assert.equal(e.shaftEndAssumption.volumeModel,'full-envelope');assert(e.standardDocument.issues.some(x=>x.code==='length-not-resolved'));assert.equal(e.shaftSegments,undefined);
});

test('a usual screw thread-entry chamfer uses the full envelope without an extra pressing operation',()=>{
 const e={...input('ISO4017','M8',40),schaftende:'kegelstumpf_flach'},a=E.auslegen(e),reference=E.auslegen({...e,schaftende:'voll'});assert.deepEqual(a.fehlt,[]);assert.deepEqual(a.werte,reference.werte);assert.deepEqual(a.stufen,reference.stufen);assert.equal(a.geometry.tip,null);assert.equal(a.geometry.shaftEnd.assumption.volumeModel,'full-envelope');
});
