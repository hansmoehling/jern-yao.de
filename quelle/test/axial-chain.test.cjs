const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../axial-chain.js'),G=require('../geometry-model.js');
const E=require('../engine.js'),N=require('../normen/to-chain.js'),fs=require('node:fs'),path=require('node:path');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const volume=c=>{const p=C.project(c);assert.equal(p.ok,true,p.errors.join(','));const r=G.evaluate(p.spec);assert.equal(r.valid,true,JSON.stringify(r.errors));return r.volumeMm3;};
test('axial chain recreates the original three cylinders without offset input',()=>{
  const c=C.parse('12×6, 8×30, 6×5'),p=C.project(c);assert.equal(c.parting,6);
  assert.deepEqual(p.spec.elements.map(({side,start,length,diameter})=>({side,start,length,diameter})),[{side:'punch',start:0,length:6,diameter:12},{side:'die',start:0,length:30,diameter:8},{side:'die',start:30,length:5,diameter:6}]);close(volume(c),Math.PI/4*(144*6+64*30+36*5));
});
test('moving parting plane and reversing preserve volume across split cones',()=>{
  const c=C.parse('12×6, K12/6×10, 6×5'),v=volume(c);c.parting=11;
  const split=C.project(c).spec.elements.filter(x=>x.id.startsWith('S2'));assert.equal(split.length,2);close(split[0].diameter,9);close(split[1].diameter,9);
  close(volume(c),v);c.flipped=true;close(volume(c),v);
});
test('centres at A and 120-degree flow-pin bottom at B keep their locations',()=>{
  const c=C.parse('4×3,8×3,12×3,8×6,6×12,5×8');c.parting=9;
  const t=1/Math.sqrt(3),bottom=Math.sqrt(3)/2;
  c.recesses=[{id:'I1',from:'A',shape:'cone',diameter:2,diameterEnd:0,length:t},{id:'I2',from:'B',shape:'cylinder',diameter:3,length:5-bottom}];
  const cuts=C.project(c).spec.elements.filter(x=>x.operation==='subtract');assert.equal(cuts[0].side,'punch');assert.equal(cuts[0].diameter,0);assert.equal(cuts[0].diameterEnd,2);assert.equal(cuts[1].side,'die');
  const v=volume(c);c.flipped=true;close(volume(c),v);
});
test('edits use stable IDs, inherited cone diameter and coupled end position',()=>{
  let c=C.parse('12×6,K12/8×2');c=C.addSegment(c);assert.equal(c.segments[2].id,'S3');assert.equal(c.segments[2].diameter,8);
  c=C.setEnd(c,'S2',10);assert.equal(c.segments[1].length,4);assert.equal(c.segments[2].id,'S3');
  assert.throws(()=>C.setEnd(c,'S2',5));assert.throws(()=>C.parse('12×0'));assert.throws(()=>C.parse('K8×2'));
});
test('blind-hole total depth includes the 120-degree flow-pin tip at B',()=>{
  const c=C.parse('4×3,8×3,12×3,8×6,6×12,5×8');c.parting=9;
  c.recesses=[{id:'I1',from:'A',shape:'cone',diameter:2,diameterEnd:0,length:1/Math.sqrt(3)},{id:'I2',from:'B',shape:'cylinder',diameter:3,length:5,bottomShape:'cone',bottomAngle:120}];
  close(volume(c),1293.885631186845);const projected=C.project(c).spec.elements.filter(x=>x.id.startsWith('I2'));close(projected.reduce((n,x)=>n+x.length,0),5);assert.equal(projected.find(x=>x.shape==='cone').diameter,0);
  c.flipped=true;close(volume(c),1293.885631186845);
});

test('deleted IDs are retained across deletion, undo and a new insertion',()=>{
 let c=C.parse('12×6,8×30');c=C.addSegment(c);assert.equal(c.segments.at(-1).id,'S3');
 const before=C.clone(c);c=C.remove(c,'S3');c=C.addSegment(c);assert.equal(c.segments.at(-1).id,'S4');
 c=C.retainIds(before,c);c=C.addSegment(c);assert.equal(c.segments.at(-1).id,'S5');
 c.recesses.push({id:C.allocateId(c,'I'),from:'boundary',after:'S2',shape:'cylinder',diameter:2,length:1});
 assert.throws(()=>C.remove(c,'S2'),/zuordnen/);c=C.remove(c,'I1');assert.equal(C.allocateId(c,'I'),'I2');
});

test('malformed chains and invalid shorthand fail without throwing from projection',()=>{
 for(const input of [null,{}, {...C.parse('4×10'),segments:[null]}, {...C.parse('4×10'),trimming:{}}, {...C.parse('4×10'),flipped:'false'}, {...C.parse('4×10'),recesses:[{id:'I1',from:'wrong',shape:'cylinder',length:2,diameter:1}]}])assert.equal(C.project(input).ok,false);
 for(const text of [null,'','4×-1','-4×1','K4×2','SW4/2×3','1001×1','4×Infinity','4×1e3'])assert.throws(()=>C.parse(text));
 const decimals=C.parse('12,5×6; K12,5/8,5×2');assert.equal(decimals.segments[0].diameter,12.5);assert.equal(decimals.segments[1].diameterEnd,8.5);
 assert.equal(C.parse('12,5×6,5').segments[0].length,6.5);
 assert.throws(()=>C.addSegment(C.parse('4×10'),-1));assert.throws(()=>C.scale(C.parse('4×10'),0));
});

test('internal contours retain positive radial walls across steps, offsets and cone bottoms',()=>{
 const c=C.parse('8×5,4×10');c.recesses=[{id:'I1',from:'B',shape:'cylinder',diameter:4,length:4}];assert.equal(C.project(c).ok,false);
 c.recesses[0].diameter=3;assert.equal(C.project(c).ok,true);c.recesses[0].offsetX=.5;assert.equal(C.project(c).ok,false);
 c.recesses[0].offsetX=0;c.recesses[0].bottomShape='cone';c.recesses[0].bottomAngle=120;assert.equal(C.project(c).ok,true);
 c.recesses[0]={id:'I1',from:'A',shape:'cylinder',diameter:6,length:8};assert.equal(C.project(c).ok,false);
 const hex=C.parse('SW8×10');hex.recesses=[{id:'I1',from:'A',shape:'hex',acrossFlats:7,length:3}];assert.equal(C.project(hex).ok,true);hex.recesses[0].acrossFlats=8;assert.equal(C.project(hex).ok,false);
});

test('all ten templates scale their declared lead dimension, recesses and volume cubically',()=>{
 const dir=path.join(__dirname,'../vorlagen'),files=fs.readdirSync(dir).filter(x=>x.endsWith('.json'));assert.equal(files.length,10);
 for(const file of files){const t=JSON.parse(fs.readFileSync(path.join(dir,file))),a=C.fromTemplate(t),b=C.fromTemplate(t,t.leadDiameterMm*2);assert.equal(t.chain.segments.find(s=>s.id===t.leadDimension.segmentId)[t.leadDimension.field],t.leadDiameterMm);close(volume(b),8*volume(a));close(b.parting,a.parting*2);assert.deepEqual(b.modelNotes,t.notes);assert.equal(b.leadDiameterMm,t.leadDiameterMm*2);}
});

test('bolt import preserves real volumes, derived countersinks and opposite cavities',()=>{
 const input={sD:4,sL:12,kopfTyp:'kugelabschnitt',kD:7,kH:2.4,schaftende:'halbhohl',d_b:2.7,t_b:4,bottomShape:'cone',bottomAngle:120};
 const geometry=E.boltGeometry(input),chain=N.fromBolt(input,geometry);close(volume(chain),geometry.headVolume+geometry.shaftVolume-geometry.cavity.volume);assert(chain.modelNotes.some(x=>/Kegelstumpf/.test(x)));assert.equal(chain.recesses[0].from,'B');
 const coneInput={sD:4,sL:12,kopfTyp:'kegelstumpf',kD:8,kH:0,alpha:90},cone=E.boltGeometry(coneInput),imported=N.fromBolt(coneInput,cone);close(volume(imported),cone.headVolume+cone.shaftVolume);close(imported.segments[0].length,2);
 const driven={...input,iTyp:'hex',iSW:2,iT:1};const driveChain=N.fromBolt(driven,E.boltGeometry(driven));assert(driveChain.modelNotes.some(x=>/Netto-Innenvolumen/.test(x)));assert.equal(driveChain.recesses[0].from,'A');assert.equal(driveChain.recesses[1].from,'B');
 assert.throws(()=>N.fromBolt({...driven,iVol:3},E.boltGeometry(driven)),/Profilkontur/);
});

test('trimmed hex import retains six cutting planes and the pre-trimming blank volume',()=>{
 const input={sD:4,sL:12,kopfTyp:'abgratet',kD:12,kH:4,kSW:8},geometry=E.boltGeometry(input),chain=N.fromBolt(input,geometry),p=C.project(chain),r=G.evaluate(p.spec,{wireDiameterMm:4});
 assert.equal(chain.trimming.length,6);assert.equal(chain.segments[0].shape,'cylinder');assert.equal(r.blankBasis,'before-trimming');close(r.stockVolumeMm3,Math.PI/4*(12**2*4+4**2*12));
 assert(r.trimVolumeBoundsMm3[0]>0);const flipped=C.clone(chain);flipped.flipped=true;const fr=G.evaluate(C.project(flipped).spec,{wireDiameterMm:4});close(fr.stockVolumeMm3,r.stockVolumeMm3);
});
