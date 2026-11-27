'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const A=require('../normen/availability');
const machine=(m,die,pun,extra={})=>({m,die:[die,100],pun:[pun,100],...extra});

test('only a documented contour outside every pair of tool holders disables a size',()=>{
 const catalogue=[machine('small',20,25),machine('large',30,40)];
 assert.equal(A.sizeAvailability({part:{sD:40},catalogue}).disabled,false);
 const outside=A.sizeAvailability({part:{sD:41},catalogue});assert.equal(outside.disabled,true);assert.equal(outside.excludedCount,2);assert.equal(outside.candidateCount,0);assert.deepEqual(outside.params,{diameter:41,maximum:40});assert.match(outside.reason,/Maschinenkatalog/);
 for(const missing of [machine('unknown',null,20),machine('unknown',20,null),{m:'unknown'}]){const r=A.sizeAvailability({part:{sD:41},catalogue:[...catalogue,missing]});assert.equal(r.disabled,false);assert.equal(r.unknownCount,1);assert.equal(r.candidateCount,1);}
});

test('there is no invented lower diameter, cutoff diameter or family gate',()=>{
 const catalogue=[machine('nut-only',50,50,{f:'JNF',sz:'M20',cd:15,cl:[25,80]})];
 for(const sD of [1,20,40]){const r=A.sizeAvailability({part:{typ:'bolzen',standardKind:'screw',sD,d0:1000},catalogue});assert.equal(r.disabled,false);assert.equal(r.candidateCount,1);}
 const otherFamily=[machine('parts-only',200,200,{f:'JPF',cd:45}),machine('bolt-only',35,35,{f:'JBF',cd:8})];
 assert.equal(A.sizeAvailability({part:{typ:'mutter',mSW:100},catalogue:otherFamily}).disabled,false);
});

test('actual enclosed shaft segments are checked while open heads, flanges and uncertain nut envelopes cannot exclude',()=>{
 const catalogue=[machine('test',50,50)];
 assert.equal(A.sizeAvailability({part:{sD:10,shaftSegments:[{diameter:60,length:2}]},catalogue}).disabled,true);
 assert.equal(A.sizeAvailability({part:{sD:10,flangeDiameter:60},catalogue}).disabled,false);
 assert.equal(A.sizeAvailability({part:{mSW:40,nutShape:'hex'},catalogue}).disabled,false);
 assert.equal(A.sizeAvailability({part:{mSW:400,nutShape:'square'},catalogue}).disabled,false);
 assert.equal(A.sizeAvailability({part:{sD:10,kSW:450,kD:500,kopfForm:'sechskant'},catalogue}).disabled,false);
 assert.equal(A.sizeAvailability({part:{sD:100,ds:100,shaftSegments:[{diameter:20,length:10}]},catalogue}).disabled,false,'actual segments replace stale scalar dimensions');
 assert.equal(A.sizeAvailability({part:{sD:100,shaftSegments:[{diameter:100,length:-1}]},catalogue}).disabled,false,'invalid geometry is unknown, not a fabricated exclusion');
});

test('product and cutoff lengths remain separate hints and missing ml never excludes a model',()=>{
 const catalogue=[machine('A',100,100,{ml:40,cl:[15,100]}),machine('B',100,100,{cl:[null,480]})];
 const result=A.lengthAvailability({part:{sD:10,sL:500},catalogue});
 assert.deepEqual(result.productLength,{max:40,knownCount:1,unknownCount:1});assert.deepEqual(result.cutoffLength,{min:15,max:480,knownCount:2,unknownCount:0,minimumKnownCount:1,maximumKnownCount:2});assert.equal(result.candidateCount,2);assert.equal(result.hardMin,null);assert.equal(result.hardMax,null);assert.match(result.basis,/not-standard/);
 const noProduct=A.lengthAvailability({catalogue:[{cl:[5,500]}]});assert.equal(noProduct.productLength.max,null);assert.equal(noProduct.productLength.unknownCount,1);assert.equal(noProduct.cutoffLength.max,500);
});

test('catalogue ranges use all possible families but omit proven physical exclusions',()=>{
 const catalogue=[machine('too-small',20,20,{ml:999,cl:[1,999]}),machine('different-family',100,100,{f:'JNF',ml:70,cl:[5,80]}),{m:'missing',ml:90,cl:[null,100]}];
 const r=A.lengthAvailability({part:{typ:'bolzen',sD:50},catalogue});assert.equal(r.productLength.max,90);assert.equal(r.cutoffLength.max,100);assert.equal(r.candidateCount,2);
});

test('empty and incomplete inputs stay selectable and browser results match Node without mutations',()=>{
 for(const catalogue of [[],null,{},[{}]]){assert.equal(A.sizeAvailability({catalogue}).disabled,false);assert.equal(A.lengthAvailability({catalogue}).hardMax,null);assert.equal(A.sizeAvailability({part:null,catalogue}).disabled,false);}
 const part={sD:10},catalogue=[machine('test',50,50,{ml:80,cl:[10,100]})],before=JSON.stringify({part,catalogue});
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../normen/availability.js'),'utf8'),context);
 for(const method of ['sizeAvailability','lengthAvailability'])assert.equal(JSON.stringify(A[method]({part,catalogue})),JSON.stringify(context.window.JYNormAvailability[method]({part,catalogue})));
 assert.equal(JSON.stringify({part,catalogue}),before);
});
