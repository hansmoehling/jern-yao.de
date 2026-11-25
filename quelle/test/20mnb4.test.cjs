'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js');
const m=E.findMaterial('20MnB4');
const c=m.flowCurves.find(c=>c.id==='komischke2019-20mnb4-normalized-rolled');
const mat={...m,flowCurve:c};
const close=(a,b,tol=1e-8)=>assert(Math.abs(a-b)<tol*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const hs=phi=>1146.6*Math.max(phi,.01)**.0944*Math.exp(-.0055/Math.max(phi,.01)-.001*298.15)*.1**.013;
test('20MnB4 has its own normalized-rolled source fit, with explicitly regularized start',()=>{
 assert(m.manualEligible);assert.equal(m.number,'1.5525');assert.equal(c.state,'normalized-rolled');assert.equal(c.points.length,462);
 for(const phi of [0,.01,.1,.4,1,1.5])close(E.kf(mat,phi),hs(phi));
 for(let i=0;i<=10000;i++){const phi=1.5*i/10000;close(E.kf(mat,phi),hs(phi),.0005);}
 close(E.kfm(mat,0,.4),657.1508448186938);close(E.kfm(mat,0,1.5),770.8823437265233);
 assert.equal(E.selectFlow(m,{curveId:c.id,materialState:'soft-annealed'}).status,'state-mismatch');
 assert.equal(E.selectFlow(E.findMaterial('23MnB4'),{curveId:c.id,materialState:c.state}).status,'missing');
});
test('20MnB4 inline force uses the accumulated source strain, including the upper boundary',()=>{
 const pre=2*Math.log(6/5.5),drawn={...mat,flowPrestrain:pre};
 close(E.kf(drawn,.3),760.8219525300085);close(E.kfm(drawn,0,.3),726.7708278839432);
 assert(Number.isNaN(E.kf(drawn,1.5-pre+.0001)));
 const e={typ:'bolzen',wst:E.WERKSTOFFE.indexOf(m),curveId:c.id,materialState:c.state,wirePreparation:'inline-drawing',rodDiameter:8.5,d0:8,kD:13,kH:5,sD:8,sL:30};
 const a=E.auslegen(e);assert.equal(a.fehlt.length,0);assert.equal(a.materialStatus.flow,'ready');
 close(a.werte.L0,43.203125);assert.equal(a.stufen.length,1);
 const expected=E.kf(mat,2*Math.log(8.5/8)+Math.log(169/64))*Math.PI*169/4/.6/1000/E.G;
 close(a.werte.Fmax_t,expected);
});
