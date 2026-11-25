'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),research=require('../werkstoffe-recherche.json'),built=require('../werkstoffe.json');

test('steel reference density is explicit, source-bound and confined to the approved identities',()=>{
 const reference=research.densityReferences.find(r=>r.id==='reference-steel-density');assert.equal(reference.value,7.85);assert.match(reference.sourceUrl,/arcelormittal/);assert.equal(reference.eligibleForForceCalculation,false);assert.equal(reference.eligibleForFlowCurve,false);
 const approximate=built.filter(m=>m.densityStatus==='reference-steel-density');assert.equal(approximate.length,21);
 for(const material of approximate){assert.ok(reference.materialNumbers.includes(material.number)||reference.materialIds.includes(material.id));assert.equal(material.rho,7.85);assert.equal(material.densitySource.status,'group-reference-approximation');assert.equal(material.densitySource.eligibleForFlowCurve,false);assert.deepEqual(E.findMaterial(material.id),material);}
 for(const id of ['C4C','C35EC','34Cr4','42CrMo4','16MnCr5','AISI 1010'])assert.equal(E.findMaterial(id).densityStatus,'reference-steel-density');
 assert.equal(E.findMaterial('NiFe 47').rho,null);assert.equal(E.findMaterial('CuNi20Fe').rho,null);assert.equal(E.findMaterial('C15C').densityStatus,'legacy-estimate');assert.equal(E.findMaterial('1.4301').densityStatus,'sourced');assert.equal(E.findMaterial('1.4301').rho,7.9);
});

test('reference density enables C4C mass while force inputs remain the sourced curve',()=>{
 const m=E.findMaterial('C4C'),curve=m.flowCurves[0];const e={typ:'bolzen',wst:E.WERKSTOFFE.indexOf(m),curveId:curve.id,materialState:curve.state,d0:8,sD:8,sL:30,kD:13,kH:5};const a=E.auslegen(e);
 assert.deepEqual(a.fehlt,[]);assert.ok(a.werte.masse>0);assert.ok(Math.abs(a.werte.masse-a.werte.V*7.85/1000)<1e-9);assert.equal(a.materialStatus.density,'reference-steel-density');assert.equal(a.werkstoff.selectedFlowCurve.id,curve.id);assert.ok(a.werte.Fmax_t>0);
});
