'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const material = E.findMaterial('C15C');
const base = {typ:'bolzen',wst:E.WERKSTOFFE.indexOf(material),curveId:material.flowCurves[0].id,materialState:'soft-annealed',d0:8,kopfForm:'rund',kD:13,kH:5,sD:8,sL:30};
const circle = d => Math.PI*d*d/4;
const close = (a,b) => assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${a} != ${b}`);
function rejected(input, reason) {
  const a = E.auslegen(input);
  assert.ok(a.fehlt.length,JSON.stringify(input));
  if (reason) assert.match(a.fehlt.join('; '),reason);
  assert.deepEqual(a.werte,{});
  assert.deepEqual(a.stufen,[]);
}

test('active numeric fields reject strings, nonfinite and negative values instead of silently using defaults',()=>{
  for (const patch of [{sD:'5'},{kH:'5'},{nD:'4',nT:2},{sD:0},{sD:NaN},{sL:Infinity},{kH:-1},{d0:1e-200},{typ:'unknown'},{kopfForm:'unknown'},{vorgaben:{pko:NaN}},{vorgaben:{ko:-1}},{vorgaben:{stationen:'4'}},{soll:{ausbringung:Infinity}}]) rejected({...base,...patch});
});

test('incomplete head, hex, cavity and flange dimensions cannot silently disappear',()=>{
  for (const patch of [{kH:0},{kD:0},{kopfForm:'sechskant',kSW:0},{kopfForm:'abgratet',kSW:undefined},{nD:4},{nT:3},{nD:4,nT:0}]) rejected({...base,...patch});
  const nut={typ:'mutter',wst:base.wst,d0:13,mSW:16,mH:8,mLoch:8};
  for (const patch of [{mFlansch:20},{mFlanschH:2},{mFlansch:7,mFlanschH:2}]) rejected({...nut,...patch});
  assert.deepEqual(E.auslegen({...nut,mFlansch:20,mFlanschH:2}).fehlt,[]);
});

test('CAD recess volume must fit its own depth through the actual head and shaft sections',()=>{
  rejected({...base,iTyp:'torx',iSize:'T20',iT:1,iVol:200},/Hüllraum/);
  const stepped={...base,kH:1,kD:13,sD:4,iTyp:'torx',iSize:'T20',iT:3};
  const available=circle(13)+2*circle(4);
  rejected({...stepped,iVol:available+1},/Hüllraum/);
  const valid=E.auslegen({...stepped,iVol:40});
  assert.deepEqual(valid.fehlt,[]);
  assert.ok(valid.werte.V>0);
  assert.equal(valid.werte.Fmax_t,null,'unknown Torx forming model remains open');
});

test('a round cavity in a hex head is bounded by its across-flats dimension',()=>{
  for (const kopfForm of ['sechskant','abgratet']) {
    const hex={...base,kopfForm,kD:12,kSW:10,nD:10.5,nT:3};
    rejected(hex,/Restwand/);
    assert.deepEqual(E.auslegen({...hex,nD:9}).fehlt,[]);
  }
});

test('an explicitly pressed cone bounds the recess and preserves a valid positive rest bottom',()=>{
  const cone={...base,standardKind:'headless',kopfTyp:'kopflos',kD:0,kH:0,threadFamily:'self-tapping',schaftende:'spitze',endLength:20,endDiameter:0,tipLength:3,tipDiameter:0,iTyp:'torx',iSize:'T20',iT:29};
  const available=circle(8)*10+Math.PI*19*(64+8*.4+.4*.4)/12;
  rejected({...cone,iVol:available+1},/Hüllraum/);
  assert.deepEqual(E.auslegen({...cone,iVol:40}).fehlt,[]);
  rejected({...cone,iT:30,iVol:40},/Restboden/);
  rejected({...cone,endLength:31,iVol:40},/Spitzenlänge/);
  rejected({...cone,endDiameter:9,iVol:40},/Enddurchmesser/);
});

test('tool split is bounded by the whole part and an explicit zero stays zero',()=>{
  rejected({...base,lStempel:36},/Werkzeugtrennkante/);
  const zero=E.auslegen({...base,lStempel:0});
  assert.deepEqual(zero.fehlt,[]);
  close(zero.werte.lStempel,0);close(zero.werte.lMatrize,35);
  const end=E.auslegen({...base,lStempel:35});
  assert.deepEqual(end.fehlt,[]);close(end.werte.lMatrize,0);
});

test('explicitly inactive drive, round-head and supplied-wire fields cannot block or alter the calculation',()=>{
  const input={...base,iTyp:'none',iSW:NaN,iT:-1,iVol:Infinity,kSW:NaN,wirePreparation:'as-supplied',rodDiameter:-1};
  const before={...input};
  assert.deepEqual(E.auslegen(input),E.auslegen({...base,iTyp:'none',wirePreparation:'as-supplied'}));
  assert.deepEqual(input,before,'caller data remains unchanged');
  const tip={...input,tipLength:2,tipDiameter:0};
  assert.deepEqual(E.auslegen(tip).fehlt,[],'profile branch ignores the same deselected fields');
  const torx={...base,iTyp:'torx',iSize:'T20',iT:3,iSW:NaN};
  assert.deepEqual(E.auslegen(torx).fehlt,[]);
});

test('headless UI selection accepts no-head form and ignores its hidden head dimensions',()=>{
  const headless={...base,standardKind:'headless',kopfForm:'none',kD:0,kH:0,iTyp:'hex',iSW:4,iT:5};
  const a=E.auslegen(headless);
  assert.deepEqual(a.fehlt,[]);
  close(a.werte.V,circle(8)*30-Math.sqrt(3)/2*16*5);
  close(a.werte.kopfD,0);
  assert.deepEqual(E.auslegen({...headless,kD:NaN,kH:Infinity,kSW:-1,kVol:'stale'}),a);
});

test('mass override consistently determines reported mass, net volume and blank; approximations remain allowed',()=>{
  const geometric=E.auslegen(base);
  for (const masse of [10,18]) {
    const a=E.auslegen({...base,masse});
    assert.deepEqual(a.fehlt,[]);
    close(a.werte.masse,masse);
    close(a.werte.V,masse/material.rho*1000);
    close(a.werte.L0,(a.werte.V+a.werte.Vabgang)/circle(base.d0));
    close(a.werte.Vgeometrie,geometric.werte.V);
    assert.ok(a.hinweise.some(h=>/Umformkräfte beruhen weiterhin auf den geometrischen Maßen/.test(h)));
    if (masse===18) assert.ok(a.hinweise.some(h=>/Masse übersteigt das geometrische Außenvolumen/.test(h)));
  }
  rejected({...base,iTyp:'torx',iSize:'T20',iT:1,masse:1},/Hüllvolumen/);
});

test('inline drawing still requires actual reduction and does not block a valid drawing relation',()=>{
  for (const rodDiameter of [0,7,8,NaN,Infinity,'9']) rejected({...base,wirePreparation:'inline-drawing',rodDiameter});
  assert.deepEqual(E.auslegen({...base,wirePreparation:'inline-drawing',rodDiameter:8.5}).fehlt,[]);
});
