'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const machines = require('../maschinen.json');
const close = (a,b,tol=1e-9) => assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol, `${a} != ${b}`);
const material = id => E.findMaterial(id);
const curveMaterial = id => ({...material(id),flowCurve:material(id).flowCurves[0]});
const selection = id => ({wst:E.WERKSTOFFE.indexOf(material(id)),curveId:material(id).flowCurves[0].id,materialState:'soft-annealed'});
const bolt = {typ:'bolzen',d0:8,kopfForm:'rund',kD:13,kH:5,sD:8,sL:30};

test('source table points, linear interpolation and integral mean are independent of legacy C/n',()=>{
 const m=curveMaterial('C4C');
 close(E.kf(m,0),250);close(E.kf(m,.1),420);close(E.kf(m,.2),496);
 close(E.kf(m,.15),458);
 // Areas of the two trapezoids: (250+420)*.1/2 + (420+496)*.1/2.
 close(E.kfm(m,0,.2),396.5);assert.notEqual(E.kfm(m,0,.2),(250+496)/2);
 close(E.kfm(m,.1,.1),420);
 assert.ok(Number.isNaN(E.kf(m,1.60001)));
 assert.ok(Number.isNaN(E.kfm(m,0,1.60001)));
});

test('Hollomon uses documented kf0, explicit start segment and exact power integral without offset',()=>{
 const m=curveMaterial('C15C');
 const k01=760*Math.pow(.1,.165);
 close(E.kf(m,0),280);close(E.kf(m,.05),(280+k01)/2);
 close(E.kf(m,.1),k01);close(E.kf(m,1),760);
 const startArea=(280+k01)*.1/2;
 const powerArea=760/1.165*(Math.pow(.5,1.165)-Math.pow(.1,1.165));
 close(E.kfm(m,0,.5),(startArea+powerArea)/.5);
 assert.ok(Number.isNaN(E.kf(m,1.001)));
 assert.ok(Number.isNaN(E.kfm(m,0,1.001)));
});

test('independent one-stage C15C upsetting fixture checks force, pressure, blank and unit conversion',()=>{
 const e={...bolt,...selection('C15C')};const a=E.auslegen(e);
 assert.equal(a.fehlt.length,0);assert.equal(a.stufen.length,1);
 const phi=Math.log(13**2/8**2),area=Math.PI*13**2/4;
 const expectedKf=760*Math.pow(phi,.165),expectedN=area*expectedKf/.6;
 close(a.werte.L0,43.203125);close(a.stufen[0].F,expectedN,1e-7);
 close(a.stufen[0].t,expectedN/9806.65);close(a.stufen[0].p,expectedKf/.6);
 close(a.werte.Fmax_t,a.stufen[0].t);close(a.werte.Fsum_t,a.stufen[0].t);
 const override=E.auslegen({...e,rm:800});close(override.stufen[0].F,expectedN,1e-7);
 assert.equal(override.werkstoff.Rm,800);
});

test('state and exact curve selection gate forces but retain geometry and candidates',()=>{
 const s=selection('C15C');
 for(const patch of [{materialState:'unknown'},{materialState:'cold-drawn'},{curveId:'dietrich2018-c4c-soft'},{temperature:'hot'}]){
  const e={...bolt,...s,...patch},a=E.auslegen(e);
  assert.equal(a.fehlt.length,0);close(a.werte.L0,43.203125);
  assert.equal(a.werte.Fmax_t,null);assert.ok(a.stufen.every(x=>x.F===null&&x.p===null));
  const selected=E.waehle(machines,a,e);assert.equal(selected.passend.length,0);assert.ok(selected.bedingt.length>0);
 }
});

test('C10C legacy estimates and tensile override cannot produce a force curve',()=>{
 for(const curveId of [undefined,'dietrich2018-c15c-soft']){
  const e={...bolt,wst:E.WERKSTOFFE.indexOf(material('C10C')),materialState:'soft-annealed',curveId,rm:800};
  const a=E.auslegen(e);assert.equal(a.fehlt.length,0);assert.equal(a.materialStatus.flow,'selection-missing');
  assert.equal(a.werte.Fmax_t,null);assert.equal(a.werte.Fsum_t,null);
  assert.ok(a.stufen.every(x=>x.F===null&&x.t===null&&x.p===null&&x.arm===null));
  close(a.werte.L0,43.203125);
 }
});

test('C10C compression-literature fixture independently checks flow stress, force, start and upper range',()=>{
 const e={...bolt,...selection('C10C')},m=curveMaterial('C10C'),a=E.auslegen(e);
 assert.equal(a.fehlt.length,0);assert.equal(a.materialStatus.flow,'ready');assert.equal(a.stufen.length,1);
 // Onder 2004, section 4.1: friction-corrected upsetting fit K=640.4 MPa, n=.16.
 // This fixture deliberately computes from the source constants, not the model's fields.
 const phi=Math.log(169/64),expectedKf=640.4*Math.pow(phi,.16),expectedN=Math.PI*169/4*expectedKf/.6;
 close(E.kf(m,.1),640.4*Math.pow(.1,.16));close(E.kf(m,1),640.4);
 close(a.werte.L0,43.203125);close(a.stufen[0].F,expectedN,1e-7);
 close(a.werte.Fmax_t,expectedN/9806.65);close(a.stufen[0].p,expectedKf/.6);
 // The start interpolation is an explicitly selected calculation model. The
 // measured offset value 346.8 differs from the thesis summary table's 336.
 close(E.kf(m,0),346.8);close(E.kf(m,.05),(346.8+640.4*Math.pow(.1,.16))/2);
 assert.ok(Number.isNaN(E.kf(m,1.001)));
 const outside=E.auslegen({...e,kD:14});assert.equal(outside.fehlt.length,0);
 assert.equal(outside.materialStatus.flow,'strain-outside-range');assert.equal(outside.werte.Fmax_t,null);
});

test('range exceedance preserves known stations and geometry while total force and die checks remain open',()=>{
 const e={...bolt,...selection('C15C'),kD:17,kH:6,sL:40};const a=E.auslegen(e);
 assert.equal(a.fehlt.length,0);assert.equal(a.materialStatus.flow,'strain-outside-range');
 assert.ok(a.stufen.some(x=>Number.isFinite(x.F)&&x.F>0));assert.ok(a.stufen.some(x=>x.F===null));
 assert.ok(a.werte.L0>0);assert.equal(a.werte.Fmax_t,null);assert.equal(a.werte.Fsum_t,null);
 assert.match(a.werte.forceReason,/Fließkurvenbereich/);
 for(const s of a.stufen.filter(x=>x.F===null))for(const k of ['t','p','pStempel','arm'])assert.equal(s[k],null);
 assert.ok(!JSON.stringify(a).includes('NaN'));
});

test('invalid or unsupported proxy curve cannot be activated',()=>{
 const m=material('C15C'),c=m.flowCurves[0],input={curveId:c.id,materialState:c.state};
 for(const bad of [{...c,eligible:false},{...c,sourceIds:[]},{...c,C:NaN},{...c,approval:'proxy'}]){
  assert.equal(E.selectFlow({...m,flowCurves:[bad]},input).status,'missing');
 }
});

test('deep cavity uses reduced shaft exterior and regional prestrain, never original wire wall',()=>{
 const e={typ:'bolzen',...selection('C4C'),d0:10,kopfForm:'rund',kD:11,kH:2,sD:5,sL:30,nD:4.8,nT:10};
 const a=E.auslegen(e);assert.equal(a.fehlt.length,0);
 // The shaft was reduced 10->5; its remaining wall is (5-4.8)/2.
 // Even the new wall strain alone is -ln(1-(4.8/5)^2)>2.5, above phiMax=1.6.
 assert.ok(-Math.log(1-(4.8/5)**2)>2.5);
 assert.equal(a.materialStatus.flow,'strain-outside-range');assert.equal(a.werte.Fmax_t,null);
 const cavities=a.stufen.filter(s=>/Napf|Abstrecken/.test(s.v));assert.ok(cavities.length>0);
 assert.ok(cavities.every(s=>s.bohr===5&&s.F===null));
 const bad=E.auslegen({...e,nD:5.1});assert.ok(bad.fehlt.length);assert.equal(bad.stufen.length,0);
});

test('deep hex cavity also uses the shaft area for wall strain and its larger prestrain',()=>{
 const e={typ:'bolzen',...selection('C4C'),d0:10,kopfForm:'rund',kD:11,kH:2,sD:5,sL:30,iTyp:'hex',iSW:4,iT:10};
 const a=E.auslegen(e);assert.equal(a.fehlt.length,0);
 const shaftArea=Math.PI*25/4,hexArea=Math.sqrt(3)/2*16;
 assert.ok(Math.log(4)-Math.log(1-hexArea/shaftArea)>2.6);
 assert.equal(a.materialStatus.flow,'strain-outside-range');assert.equal(a.werte.Fmax_t,null);
 const head=a.stufen.find(s=>s.v.includes('Innensechskant'));assert.ok(head);assert.equal(head.F,null);assert.equal(head.pStempel,null);
});
