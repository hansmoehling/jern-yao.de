'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../vorbelegung/draht');
const base={typ:'bolzen',standardKind:'screw',threadFamily:'metric',shaftPolicy:'shaft-v2',shaftType:'partial',sD:10.75,ds:12,b:30,sL:80};
const values=rows=>rows.map(row=>row.value);

test('partial-thread wire supplies the plain shaft instead of using the smaller rolling blank',()=>{
 const result=W.candidates(base,null,[{cd:11},{cd:12},{cd:16}]);assert.deepEqual(values(result),[12,12.1]);assert.equal(result[0].params.shaft,12);
 assert.ok(result.every(row=>row.value>=12));assert.equal(base.sD,10.75);assert.equal(base.ds,12);
});

test('customer shaft segments govern the largest required diameter without mutating any dimension',()=>{
 const input={...base,d0:15,shaftSegments:[{diameter:11,length:20},{diameter:14,length:25},{diameter:10.75,length:35}],inputOrigins:{d0:{origin:'customer'}}},before=structuredClone(input);
 const result=W.candidates(input,null,[{cd:12},{cd:13},{cd:16}]);assert.deepEqual(values(result),[14,14.1]);assert.match(result[0].reason,/größten Schaftsegment/);assert.equal(result[0].params.shaft,14);assert.deepEqual(input,before);
 const repeated=W.candidates({...input,ds:99},null,[{cd:16}]);assert.deepEqual(repeated,result,'stale nominal ds cannot override explicit customer segments');
});

test('full-thread v2 uses its rolling blank and ignores the old norm-name heuristic',()=>{
 const input={...base,shaftType:'full',standardReference:'ISO4014',b:80};
 const result=W.candidates(input);assert.equal(result[0].value,11.4);assert.match(result[0].reason,/Vollgewinde/);
 for(const shaftPolicy of [undefined,'shaft-v1',true])assert.equal(W.candidates({...input,shaftPolicy})[0].value,10.75);
 assert.equal(W.candidates({...base,shaftPolicy:undefined})[0].value,10.75,'the already published baseline remains unchanged');
});

test('missing or inconsistent explicit segment geometry does not become a flat-shaft proposal',()=>{
 for(const shaftSegments of [[],null,[{diameter:12,length:-1}],[{diameter:12,length:79}],[{diameter:'12',length:80}]])assert.deepEqual(W.candidates({...base,shaftSegments}),[]);
 assert.deepEqual(W.candidates({...base,ds:undefined}),[]);
 const roundoff={...base,shaftSegments:[{diameter:12,length:50.00000001},{diameter:10.75,length:30}]};assert.equal(W.candidates(roundoff)[0].value,12,'use the same length tolerance as the norm adapter');
});

test('plain pins and full-thread defaults ignore stale partial-shaft fields unless a valid profile is supplied',()=>{
 assert.equal(W.candidates({...base,standardKind:'pin',threadFamily:'none',shaftType:'full',ds:100})[0].value,10.75);
 assert.equal(W.candidates({...base,shaftType:'full',ds:100,b:20})[0].value,11.4);
 assert.equal(W.candidates({...base,ds:9})[0].value,10.75,'the largest actual shaft diameter bounds every suggestion');
});

test('ISO4014 M12x80 keeps its 12x50 plain segment, reduces only 10.75x30 and recalculates an edited length',()=>{
 const N=require('../normen/library'),R=require('../normen/resolver'),E=require('../engine'),machines=require('../maschinen');
 const data={...require('../normen/index'),families:[require('../normen/ISO4014')],threads:require('../normen/gewinde')},selection={id:'ISO4014',groesse:'M12',laenge:80,festigkeitsklasse:'8.8'};
 const material=E.findMaterial('20MnB4'),curve=material.flowCurves[0];
 const document=R.resolveStandard(data,selection,{},{shaftPolicy:'shaft-v2',lengthOrigin:'customer'}),adapt=doc=>({...N.adapt(data,doc),typ:'bolzen',wst:E.WERKSTOFFE.indexOf(material),curveId:curve.id,materialState:curve.state,rmPolicy:'rm-v2',forcePolicy:'force-v2'});
 const input=adapt(document);input.d0=W.candidates(input,null,machines)[0].value;
 assert.equal(input.d0,12);assert.equal(input.sD,10.75);assert.equal(input.ds,12);assert.equal(input.b,30);assert.deepEqual(input.shaftSegments,[{diameter:12,length:50},{diameter:10.75,length:30}]);
 const actual=E.auslegen(input),flat=E.auslegen({...input,shaftSegments:undefined,d0:11.4});assert.deepEqual(actual.fehlt,[]);assert.ok(actual.stufen.some(stage=>/Reduzieren 12/.test(stage.v)));
 const addedVolume=Math.PI/4*(12**2-10.75**2)*50;assert.ok(Math.abs(actual.werte.V-flat.werte.V-addedVolume)<1e-7);
 const longer=adapt(R.setOverride(document,'sL',100));longer.d0=W.candidates(longer,null,machines)[0].value;
 assert.equal(longer.d0,12);assert.deepEqual(longer.shaftSegments,[{diameter:12,length:70},{diameter:10.75,length:30}]);assert.ok(Math.abs(E.auslegen(longer).werte.V-actual.werte.V-Math.PI/4*12**2*20)<1e-7);
 const short=adapt(R.resolveStandard(data,{...selection,laenge:20},{},{shaftPolicy:'shaft-v2'}));assert.equal(short.shaftType,'full');assert.equal(short.b,20);assert.equal(short.shaftSegments,undefined);assert.equal(W.candidates(short)[0].value,11.4);
});
