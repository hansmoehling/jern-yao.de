const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
const circle=d=>Math.PI*d*d/4,close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const base={typ:'bolzen',wst:0,d0:4,sD:4,sL:10,kD:7,kH:2.4,kopfTyp:'kugelabschnitt',iTyp:'none',threadFamily:'none'};
const run=changes=>E.auslegen({...base,...changes});
test('DIN660 4x10 cap gives net volume and 14.251 mm cutoff',()=>{
 const r=run();assert.deepEqual(r.fehlt,[]);close(r.werte.L0,14.251);close(r.werte.V,Math.PI*2.4*(3*3.5**2+2.4**2)/6+circle(4)*10);
 assert.equal(r.werte.Dmax,7);assert.equal(r.werte.ko,10);assert.equal(r.werte.pko,2.4);
 assert.equal(run({kopfTyp:undefined,kopfForm:'rund'}).werte.V,circle(7)*2.4+circle(4)*10);
});
test('independent analytic head models preserve real volume and total head height',()=>{
 const cylinder=run({kopfTyp:'zylinder'});close(cylinder.geometry.headVolumeMm3,circle(7)*2.4);
 const lens=run({kopfTyp:'linse',kC:1.4,capHeight:1});close(lens.geometry.headVolumeMm3,circle(7)*1.4+Math.PI*(3*3.5**2+1)/6);
 const cone=run({kopfTyp:'kegelstumpf',kD:8,kH:2});close(cone.geometry.headVolumeMm3,Math.PI*2*(64+32+16)/12);
 const derived=run({kopfTyp:'kegelstumpf',kD:8,kH:0,alpha:90});close(derived.werte.Lteil,12);
 const raised=run({kopfTyp:'linsensenk',kD:8,kH:2,capHeight:1});close(raised.werte.Lteil,13);
 close(raised.geometry.headVolumeMm3,cone.geometry.headVolumeMm3+Math.PI*(3*16+1)/6);
 const hex=run({kopfTyp:'sechskant_bund',kD:12,kSW:8,kH:5,flangeDiameter:12,flangeHeight:1});close(hex.geometry.headVolumeMm3,Math.sqrt(3)/2*64*4+circle(12));assert.equal(hex.werte.Dmax,12);
 assert.ok(run({kopfTyp:'linse'}).fehlt.length);assert.ok(run({kopfTyp:'sechskant_bund',kSW:8,flangeDiameter:6,flangeHeight:1}).fehlt.length);
});
test('half hollow rivet has an explicit 120 degree total-depth process assumption',()=>{
 const r=run({sL:12,schaftende:'halbhohl',d_b:2.7,t_b:4,bottomShape:'cone',bottomAngle:120,boreDepthMode:'total'});
 assert.deepEqual(r.fehlt,[]);const tip=1.35/Math.tan(Math.PI/3),hole=circle(2.7)*(4-tip)+circle(2.7)*tip/3;
 close(r.geometry.shaftEnd.volume,hole);close(r.werte.V,run({sL:12}).werte.V-hole);close(r.geometry.shaftEnd.restBottom,10.4);
 assert.ok(r.stufen.some(s=>s.operations.some(o=>/Schaftende/.test(o.name)&&/Matrizenseitiges/.test(o.location))));
 assert.equal(r.werte.wenden,false);assert.ok(r.hinweise.some(s=>s.includes('120°')&&s.includes('Prozessannahme')));
 const cylindrical=run({schaftende:'halbhohl',d_b:2.7,t_b:4,bottomShape:'cone',bottomAngle:120,boreDepthMode:'cylindrical'});
 close(cylindrical.geometry.shaftEnd.depth,4+tip);
});
test('head drive and die-side bore coexist but overlapping cavities fail',()=>{
 const input={kopfTyp:'zylinder',kD:10,kH:6,sD:6,d0:6,sL:20,iTyp:'hex',iSW:5,iT:3,schaftende:'halbhohl',d_b:3,t_b:5,bottomShape:'flat'};
 const r=run(input);assert.deepEqual(r.fehlt,[]);close(r.werte.V,circle(10)*6+circle(6)*20-Math.sqrt(3)/2*25*3-circle(3)*5);
 assert.ok(r.stufen.some(s=>s.operations.some(o=>/Innenantrieb/.test(o.name))));
 assert.ok(run({...input,t_b:23}).fehlt.some(s=>/Restboden/.test(s)));
 assert.ok(run({...input,d_b:6}).fehlt.some(s=>/Restwand/.test(s)));
 assert.ok(run({...input,shaftSegments:[{diameter:6,length:15},{diameter:2.5,length:5}]}).fehlt.some(s=>/Restwand/.test(s)));
});
test('segmented shanks sum volume and do not infer a plain shaft from reference b',()=>{
 const r=run({sD:4,sL:20,shaftSegments:[{diameter:4,length:12},{diameter:3,length:8}]});assert.deepEqual(r.fehlt,[]);
 close(r.geometry.shaftVolumeMm3,circle(4)*12+circle(3)*8);assert.ok(r.stufen.some(s=>s.segmentIndex===1));
 const b=run({b:6});close(b.werte.V,run().werte.V);
 assert.ok(run({shaftSegments:[{diameter:4,length:9}]}).fehlt.some(s=>/Summe/.test(s)));
 for(const shaftSegments of [[],[{diameter:4,length:-1}],[{diameter:'4',length:10}]])assert.ok(run({shaftSegments}).fehlt.length);
});
test('shaft end round bottom, tube, point and dog have independent volume semantics',()=>{
 const round=run({schaftende:'halbhohl',d_b:2,t_b:3,bottomShape:'round'});close(round.geometry.shaftEnd.volume,circle(2)*2+2*Math.PI/3);
 const tube=run({kopfTyp:'zylinder',schaftende:'rohr',d_b:2});assert.deepEqual(tube.fehlt,[]);close(tube.werte.V,run({kopfTyp:'zylinder'}).werte.V-circle(2)*12.4);assert.ok(tube.werte.Vabgang>0);
 const point=run({schaftende:'spitze',endLength:2,endDiameter:0});assert.deepEqual(point.fehlt,[]);close(point.geometry.shaftVolumeMm3,circle(4)*8+circle(4)*2/3);assert.equal(point.werte.Fmax_t,null);
 const dog=run({schaftende:'zapfen',endLength:2,endDiameter:2});assert.deepEqual(dog.fehlt,[]);close(dog.geometry.shaftVolumeMm3,circle(4)*8+circle(2)*2);
});
test('new KopfForm aliases work while unknown profile volumes remain uncomputed',()=>{
 const r=run({kopfTyp:undefined,kopfForm:'kugelabschnitt'});assert.deepEqual(r.fehlt,[]);close(r.werte.L0,14.251);
 const tx=run({kopfTyp:'zylinder',kD:10,kH:6,iTyp:'torx',iSize:'T30',iT:2});assert.deepEqual(tx.fehlt,[]);assert.equal(tx.werte.V,null);assert.equal(tx.werte.L0,null);assert.equal(tx.werte.Fmax_t,null);
});

test('hex standard dimensions need no redundant head diameter and KopfTyp controls the shape',()=>{
 const r=run({kopfTyp:'sechskant',kopfForm:'rund',kD:undefined,kSW:13,kH:5.3,sD:8,sL:40,d0:8});
 assert.deepEqual(r.fehlt,[]);close(r.geometry.headVolumeMm3,Math.sqrt(3)/2*13**2*5.3);close(r.werte.Dmax,13/Math.cos(Math.PI/6));
 const flange=run({kopfTyp:'sechskant_bund',kD:undefined,kSW:8,kH:5,flangeDiameter:12,flangeHeight:1});assert.deepEqual(flange.fehlt,[]);
 const headless=run({kopfTyp:'kopflos',kD:7,kH:2.4,d0:5});assert.deepEqual(headless.fehlt,[]);close(headless.werte.V,circle(4)*10);
});

test('profile combinations cannot silently discard a shaft cavity or a curved head',()=>{
 const input={threadFamily:'trilobular',sArea:10,kopfTyp:'zylinder'};
 assert.equal(run(input).qualitative,true);
 assert.ok(run({...input,schaftende:'halbhohl',d_b:2,t_b:3}).fehlt.some(s=>/gemeinsam/.test(s)));
 assert.ok(run({...input,kopfTyp:'kugelabschnitt'}).fehlt.some(s=>/gemeinsam/.test(s)));
});
