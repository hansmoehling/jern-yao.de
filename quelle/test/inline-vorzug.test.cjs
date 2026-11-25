'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),M=require('../maschinen.json');
const m=E.findMaterial('C4C'),curve=m.flowCurves[0];
const e={typ:'bolzen',wst:E.WERKSTOFFE.indexOf(m),curveId:curve.id,materialState:curve.state,d0:8,kD:13,kH:5,sD:8,sL:30};
const close=(a,b)=>assert(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
test('inline drawing accumulates geometric prestrain and raises force without changing blank or stages',()=>{
 const direct=E.auslegen(e),drawn=E.auslegen({...e,wirePreparation:'inline-drawing',rodDiameter:8.5});
 close(drawn.vorzug.prestrain,2*Math.log(8.5/8));
 close(drawn.vorzug.areaReduction,1-64/72.25);
 close(drawn.werte.L0,direct.werte.L0);assert.equal(drawn.stufen.length,direct.stufen.length);
 const totalPhi=2*Math.log(8.5/8)+Math.log(169/64);
 const expected=E.kf({...m,flowCurve:curve},totalPhi)*Math.PI*169/4/.6/1000/E.G;
 close(drawn.werte.Fmax_t,expected);assert(drawn.werte.Fmax_t>direct.werte.Fmax_t);
 const model=M.find(m=>m.m==='JBF-10B2S');
 const checks=E.pruefe(model,drawn,e),concept=E.maschinenKonzept(drawn,e,model);
 assert(!checks.openPoints.some(p=>p.id==='machine-inline-drawing'));
 assert(!checks.k.some(k=>k.krit==='Inline-Vorzug'),'customer-owned preparation is not a press selection criterion');
 const supplied={...e,wirePreparation:'inline-drawing',rodDiameter:8.5,rm:400};
 const complete=E.pruefe(model,E.auslegen(supplied),supplied);
 assert.notEqual(complete.gesamt,'offen','inline drawing alone must not block a fully supplied press comparison');
 assert.deepEqual(concept.preparation,drawn.vorzug);assert.equal(concept.stages.length,direct.stufen.length);
});
test('prestrained mean stress integrates the shifted curve interval exactly',()=>{
 const p=.1,base={...m,flowCurve:curve},shifted={...base,flowPrestrain:p};
 close(E.kfm(shifted,0,.2),E.kfm(base,.1,.3));
 close(E.kf(shifted,0),E.kf(base,.1));
 close(E.kfm(shifted,0,0),E.kf(base,.1));
 assert(Number.isNaN(E.kf(shifted,-.01)));
});
test('the valid strain range includes drawing; no extrapolation or double-counted drawn source',()=>{
 const outside=E.auslegen({...e,wirePreparation:'inline-drawing',rodDiameter:12});
 assert.equal(outside.materialStatus.flow,'strain-outside-range');assert.equal(outside.werte.Fmax_t,null);assert(outside.werte.L0>0);
 const aisi=E.findMaterial('AISI 1010');
 const wrong=E.auslegen({...e,wst:E.WERKSTOFFE.indexOf(aisi),curveId:aisi.flowCurves[0].id,materialState:'cold-drawn',wirePreparation:'inline-drawing',rodDiameter:8.5});
 assert.equal(wrong.materialStatus.flow,'preparation-mismatch');assert.equal(wrong.werte.Fmax_t,null);
});
test('diameters must define a reduction; stale rod fields do not affect direct wire',()=>{
 for(const rodDiameter of [undefined,0,7,8,NaN])assert(E.auslegen({...e,wirePreparation:'inline-drawing',rodDiameter}).fehlt.length);
 close(E.auslegen({...e,wirePreparation:'as-supplied',rodDiameter:12}).werte.Fmax_t,E.auslegen(e).werte.Fmax_t);
 assert(E.auslegen({...e,wirePreparation:'unverified'}).fehlt.length);
});
