'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {nutModel}=require('../nut-model.js');
const threads=require('../normen/gewinde.json');
const circle=d=>Math.PI*d*d/4;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('M20 uses the sourced 6H interval instead of the old 0.84 multiplier',()=>{
  const r=nutModel({mM:20,mSW:30,mH:18});
  assert.equal(r.valid,true);assert.equal(r.holeDiameter,17.52);assert.ok(r.holeDiameter>=17.294);
  assert.equal(r.thread.D1min,17.294);assert.ok(r.thread.sourceRefs.length);
  close(r.volume,(Math.sqrt(3)/2*30**2-circle(17.52))*18);
  assert.ok(r.issues.some(x=>x.code==='hole-midpoint-assumption'));
  assert.equal(r.thread.pitch,2.5);
});

test('square body uses square area and diagonal, with a qualitative corner-fill review',()=>{
  const r=nutModel({nutShape:'square',mSW:10,mH:5,mLoch:5});
  assert.equal(r.valid,true);assert.equal(r.outerArea,100);close(r.maxDiameter,10*Math.SQRT2);
  close(r.volume,(100-circle(5))*5);assert.equal(r.blankArea,100);
  assert.ok(r.operations.includes('Vierkant formen'));assert.ok(!r.operations.includes('Sechskant formen'));
  assert.ok(r.issues.some(x=>x.code==='square-corner-fill-review'));
});

test('flange replaces the corresponding body slice and carries an explicit contour assumption',()=>{
  const e={nutShape:'hex',mSW:13,mH:8,mLoch:6.8,mFlansch:17.9,mFlanschH:1.2};
  const r=nutModel(e),body=Math.sqrt(3)/2*13**2;
  assert.equal(r.valid,true);close(r.volume,body*6.8+circle(17.9)*1.2-circle(6.8)*8);
  close(r.grossVolume,body*6.8+circle(17.9)*1.2);close(r.blankArea,circle(17.9));
  assert.equal(r.maxDiameter,17.9);assert.equal(r.totalHeight,8);
  assert.ok(r.issues.some(x=>x.code==='flange-cylinder-assumption'));
  assert.ok(r.assumptions.some(x=>x.includes('Messkreis')));
});

test('closed cap geometry never becomes a through-drilled ordinary nut',()=>{
  const r=nutModel({nutShape:'cap',mSW:13,mH:15,mLoch:6.8,mM:8});
  assert.equal(r.valid,false);assert.equal(r.status,'partial');assert.equal(r.volume,null);
  assert.ok(r.issues.some(x=>x.code==='cap-geometry-unresolved'));
  assert.ok(r.operations.some(x=>x.includes('Geschlossenen Napf')));
  assert.ok(!r.operations.some(x=>/auslochen|Butzen|beidseitig/i.test(x)));
});

test('unverified fine-pitch hole is not filled with the coarse-pitch value',()=>{
  const missing=nutModel({mM:10,threadPitch:0.9,mSW:16,mH:8.4});
  assert.equal(missing.status,'partial');assert.equal(missing.holeDiameter,null);assert.equal(missing.volume,null);
  const explicit=nutModel({mM:10,threadPitch:0.9,mSW:16,mH:8.4,mLoch:9});
  assert.equal(explicit.valid,true);assert.equal(explicit.holeDiameter,9);
  assert.ok(explicit.issues.some(x=>x.code==='thread-limits-unresolved'));
  assert.equal(nutModel({mSW:16,mH:8.4}).valid,false,'M is not inferred from ambiguous key width');
});

test('customer hole changes survive with an explicit tolerance check rather than an invented process ban',()=>{
  const r=nutModel({mM:20,mSW:30,mH:18,mLoch:16.8});
  assert.equal(r.valid,true);assert.equal(r.holeDiameter,16.8);
  assert.ok(r.issues.some(x=>x.code==='hole-outside-thread-tolerance'));
});

test('incomplete flanges and nonpositive remaining walls do not produce a volume',()=>{
  for(const change of [{mFlansch:17.9},{mFlanschH:1.2},{mFlansch:17.9,mFlanschH:8},{mFlansch:17.9,mFlanschH:9},{mLoch:13},{mFlansch:6,mFlanschH:1}]){
    const r=nutModel({mSW:13,mH:8,mLoch:6.8,...change});
    assert.equal(r.valid,false,JSON.stringify(change));assert.equal(r.volume,null);
  }
  assert.equal(nutModel({mSW:13,mH:8,mLoch:6.8,mFlansch:0,mFlanschH:0}).valid,true);
});

test('invalid numeric values and numeric overflow fail without NaN output',()=>{
  for(const value of ['13',NaN,Infinity,-1])assert.equal(nutModel({mSW:value,mH:8,mLoch:6.8}).valid,false);
  const huge=nutModel({mSW:1e308,mH:8,mLoch:6.8});assert.equal(huge.valid,false);assert.equal(huge.volume,null);
  assert.equal(nutModel({nutShape:'unknown',mSW:13,mH:8,mLoch:6.8}).valid,false);
  assert.equal(nutModel({mM:8,mSW:13,mH:8,threadPitch:0}).valid,false,'zero pitch is not silently replaced by coarse pitch');
});

test('data options are immutable and an explicit missing dataset does not trigger a hidden fallback',()=>{
  const e={mM:6,mSW:10,mH:5.2},before=JSON.stringify({e,threads});
  const r=nutModel(e,{threads});assert.equal(r.holeDiameter,5.04);
  assert.equal(JSON.stringify({e,threads}),before);
  r.thread.sourceRefs.push('customer');assert.equal(JSON.stringify({e,threads}),before);
  assert.equal(nutModel(e,{threads:null}).status,'partial');
});

test('browser module supports inline data and produces the same dimensional result',()=>{
  const source=fs.readFileSync(require.resolve('../nut-model.js'),'utf8');
  const context={window:{}};vm.createContext(context);
  vm.runInContext(source.replace('/*NUT_THREADS_BEGIN*/null/*NUT_THREADS_END*/',JSON.stringify(threads)),context);
  const browser=context.window.JYNutModel.nutModel({mM:20,mSW:30,mH:18});
  assert.equal(browser.holeDiameter,17.52);assert.equal(browser.volume,nutModel({mM:20,mSW:30,mH:18}).volume);
});
