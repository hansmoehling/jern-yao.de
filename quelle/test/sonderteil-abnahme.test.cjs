const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../geometry-model.js'),W=require('../vorbelegung/draht.js');

// Synthetic acceptance part: six axial steps, punch-side centre recess in
// the rivet pin, blind semi-tubular end on the opposite (die) side.
const outer=[['head','punch',0,3,12],['shoulder-a','punch',3,3,8],['rivet-pin','punch',6,3,4],
 ['shoulder-b','die',0,6,8],['shank','die',6,12,6],['end','die',18,8,5]]
 .map(([id,side,start,length,diameter])=>({id,side,start,length,diameter,shape:'cylinder',operation:'add'}));
const centre={id:'centre',side:'punch',start:8.5,length:.5,diameter:0,diameterEnd:1,shape:'cone',operation:'subtract'};
const hollow={id:'semi-tubular',side:'die',start:21,length:5,diameter:3,shape:'cylinder',operation:'subtract'};
const spec=elements=>({version:1,coordinateSystem:'tool-parting-plane',elements,trimming:[]});
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('six-step special part keeps its centre recess and opposite blind end distinct',()=>{
 const full=spec([...outer,centre,hollow]);
 const result=G.evaluate(full,{densityGcm3:7.85,wireDiameterMm:6});
 assert.equal(result.valid,true);assert.equal(result.volumeStatus,'exact');
 assert.equal(result.envelope.minZ,-9);assert.equal(result.envelope.maxZ,26);
 assert.equal(result.topology.hasEccentricity,false);
 assert.notEqual(result.topology.singleSolid,'disconnected');
 close(G.evaluate(spec(outer)).volumeMm3,1325.7520998148925);
 close(result.volumeMm3,1290.2782827681076);
 close(result.blankLengthMm,45.63425925925926);
 // Omitting either feature has its own measurable consequence. A cone at
 // the wrong end can preserve total volume, so compare each half separately.
 const punch=G.evaluate(spec([...outer.filter(e=>e.side==='punch'),centre]));
 const die=G.evaluate(spec([...outer.filter(e=>e.side==='die'),hollow]));
 close(punch.volumeMm3,Math.PI/4*(12**2*3+8**2*3+4**2*3)-Math.PI/24);
 close(die.volumeMm3,Math.PI/4*(8**2*6+6**2*12+5**2*8-3**2*5));
 const baseline=W.candidates({typ:'formteil'},full)[0];
 assert.equal(baseline.value,6);assert.equal(baseline.origin,'assumption');
 assert.equal(result.numericEligibility.forces,false);assert.equal(result.numericEligibility.machines,false);
});

test('120-degree centre and flow-pin bottom preserve total blind depth and material volume',()=>{
 const centreHeight=1/Math.tan(Math.PI/3),bottomHeight=1.5/Math.tan(Math.PI/3);
 const recess={...centre,start:9-centreHeight,length:centreHeight,diameterEnd:2};
 const bottom={...hollow,id:'flow-pin-bottom',shape:'cone',start:21,length:bottomHeight,diameter:0,diameterEnd:3};
 const bore={...hollow,start:21+bottomHeight,length:5-bottomHeight};
 const r=G.evaluate(spec([...outer,recess,bottom,bore]),{wireDiameterMm:6});
 assert.equal(r.valid,true);assert.equal(r.volumeStatus,'exact');
 const expected=1325.7520998148925-Math.PI*centreHeight/3-Math.PI*2.25*(5-bottomHeight+bottomHeight/3);
 close(r.volumeMm3,expected);close(bore.start+bore.length,26);close(bottom.start,21);
 assert(r.volumeMm3>1290.2782827681076,'the shaped blind bottom changes volume instead of becoming a flat-bottom hole');
 assert.equal(r.numericEligibility.forces,false);
});
