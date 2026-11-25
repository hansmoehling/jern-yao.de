'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),M=require('../maschinen.json');
const material=E.findMaterial('C15C');
const base={typ:'bolzen',wst:E.WERKSTOFFE.indexOf(material),curveId:material.flowCurves[0].id,materialState:'soft-annealed',d0:8,sD:8,sL:30,kopfForm:'rund',kD:13,kH:5,rm:400};
const circle=d=>Math.PI*d*d/4,close=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-8,`${a} != ${b}`);
function safe(a){assert.deepEqual(a.fehlt,[]);assert.equal(a.qualitative,true);assert.equal(a.numericEligibility.forces,false);for(const key of ['Fmax_t','Fsum_t','FN_muss_t','FN_wunsch_t','stationen','stationenReserve'])assert.equal(a.werte[key],null,key);for(const s of a.stufen)for(const key of ['F','t','p','pStempel','arm'])assert.equal(s[key],null,key);const walk=x=>{if(typeof x==='number')assert.ok(Number.isFinite(x));else if(x&&typeof x==='object')Object.values(x).forEach(walk);};walk(a);}

test('standard metric headed geometry, forces and stages are unchanged',()=>{
 const old=E.auslegen(base),explicit=E.auslegen({...base,threadFamily:'metric'});assert.deepEqual(explicit,old);assert.ok(old.werte.Fmax_t>0);
});

test('headless hex drive uses real recess volume, shaft wall and remaining bottom without inventing a head',()=>{
 const e={...base,standardKind:'headless',kD:0,kH:0,iTyp:'hex',iSW:4,iT:5};const a=E.auslegen(e);safe(a);
 const volume=circle(8)*30-Math.sqrt(3)/2*16*5;close(a.werte.V,volume);close(a.werte.L0,volume/circle(8));close(a.antrieb.restBottom,25);close(a.antrieb.restWall,(8-4/Math.cos(Math.PI/6))/2);
 assert.equal(a.werte.kopfD,0);assert.equal(a.werte.lStempel,0);assert.ok(!a.stufen.some(s=>/Kopf fertigstauchen|Kopf \/ Bund formen/.test(s.v)));assert.ok(a.stufen.some(s=>s.operations.some(o=>o.location==='Kopflose Stirnseite')));
});

test('headless profile drives require actual volume and do not infer a Torx recess from its size',()=>{
 const e={...base,standardKind:'headless',kD:0,kH:0,iTyp:'torx',iSize:'T20',iT:5};const a=E.auslegen(e);safe(a);assert.equal(a.werte.V,null);assert.equal(a.werte.L0,null);
 const measured=E.auslegen({...e,iVol:40});safe(measured);close(measured.werte.V,circle(8)*30-40);assert.equal(measured.antrieb.restWall,null);
});

test('trilobular shaft uses true profile area; envelope diameter is neither area nor wire nomination',()=>{
 const e={...base,threadFamily:'trilobular',sArea:40,d0:7};const a=E.auslegen(e);safe(a);close(a.werte.V,circle(13)*5+40*30);close(a.werte.L0,a.werte.V/circle(7));assert.equal(a.werte.d0,7);assert.ok(a.stufen.some(s=>s.v==='Profilschaft vorformen und fertigformen'));
 const missing=E.auslegen({...e,sArea:undefined});safe(missing);assert.equal(missing.werte.V,null);assert.equal(missing.werte.L0,null);assert.match(missing.werte.volumeReason,/Profilquerschnitt/);
 const fromMass=E.auslegen({...e,sArea:undefined,masse:10});safe(fromMass);close(fromMass.werte.V,10/7.85*1000);close(fromMass.werte.L0,10/7.85*1000/circle(7));assert.equal(fromMass.geometry.bodyAreaMm2,null);
});

test('Duo-Taptite has a separate measured tip section with no circular or conical proxy',()=>{
 const e={...base,threadFamily:'duo-taptite',sArea:40,tipArea:25,tipLength:5};const a=E.auslegen(e);safe(a);close(a.geometry.shaftVolumeMm3,40*25+25*5);close(a.werte.V,circle(13)*5+1125);assert.equal(a.geometry.tipDiameterMm,null);
 const missing=E.auslegen({...e,tipArea:undefined});safe(missing);assert.equal(missing.werte.V,null);assert.equal(missing.werte.L0,null);assert.ok(missing.stufen.some(s=>s.v==='Duo-Spitzenprofil formen'));
});

for(const family of ['self-tapping','thermoplastic'])test(family+' conical tip is subtracted from the full shaft length, not added to it',()=>{
 const e={...base,threadFamily:family,tipLength:6,tipDiameter:2};const a=E.auslegen(e);safe(a);close(a.geometry.shaftVolumeMm3,circle(8)*24+Math.PI*6*(64+16+4)/12);close(a.werte.Lteil,35);assert.equal(a.geometry.bodyLengthMm,24);assert.ok(a.stufen.some(s=>s.v==='Konusspitze formen'));assert.ok(!JSON.stringify(a).includes('Doppeldruck'));
});

test('claw head is an exterior drive; its net outside volume is required and an inner recess remains separate',()=>{
 const e={...base,kopfForm:'krallen',kVol:400,iTyp:'none',iSW:4,iT:3};const a=E.auslegen(e);safe(a);assert.equal(a.antrieb,null);close(a.werte.V,400+circle(8)*30);assert.ok(a.stufen.some(s=>s.v==='Krallenkopf als äußeren Mitnahmekopf formen'));
 const missing=E.auslegen({...e,kVol:undefined});safe(missing);assert.equal(missing.werte.V,null);assert.equal(missing.werte.masse,null);assert.equal(missing.werte.L0,null);
 const inner=E.auslegen({...e,iTyp:'hex',iSW:4,iT:3});safe(inner);close(inner.werte.V,400+circle(8)*30-Math.sqrt(3)/2*16*3);assert.equal(inner.antrieb.restWall,null,'head envelope does not prove wall through claws');
});

test('unsupported profile operations remain owned engineering checks with no fabricated station allocation',()=>{
 const e={...base,threadFamily:'trilobular',sArea:40};const a=E.auslegen(e),found=E.waehle(M,a,e);assert.equal(found.passend.length,0);const candidate=found.bedingt[0];assert.ok(candidate);assert.equal(candidate.k.find(k=>k.krit==='Stationen').status,'offen');
 for(const id of ['profile-stage-concept','profile-force-model'])assert.equal(candidate.openPoints.find(p=>p.id===id)?.owner,'Unsere Auslegung');
 assert.ok(!candidate.openPoints.some(p=>p.id==='machine-stations'),'catalogue station count exists');
 const concept=E.maschinenKonzept(a,e,candidate.o);assert.equal(concept.status,'incomplete');assert.equal(concept.requiredStations,null);assert.equal(concept.reserveStations,null);assert.ok(concept.stages.length);assert.ok(concept.stages.every(s=>s.kind==='unassigned'));
 const unknown=E.auslegen({...e,sArea:undefined}),check=E.pruefe(candidate.o,unknown,e);assert.ok(check.openPoints.some(p=>p.id==='part-profile-volume'));assert.ok(!check.openPoints.some(p=>p.id==='part-recess-volume'));
});

test('impossible walls, tips, profile areas and declared mass fail instead of yielding NaN or nominal-shaft estimates',()=>{
 const headless={...base,standardKind:'headless',kD:0,kH:0,iTyp:'hex',iSW:4,iT:5};
 const cases=[{...headless,iSW:8},{...headless,iT:30},{...headless,kD:13,kH:5},{...headless,iVol:400},{...base,threadFamily:'trilobular',sArea:60},{...base,threadFamily:'trilobular',sArea:'40'},{...base,threadFamily:'duo-taptite',sArea:40,tipArea:25},{...base,threadFamily:'duo-taptite',sArea:40,tipArea:60,tipLength:5},{...base,threadFamily:'thermoplastic',tipLength:31,tipDiameter:0},{...base,threadFamily:'thermoplastic',tipLength:3,tipDiameter:9},{...base,kopfForm:'krallen',kVol:1000},{...headless,masse:1000},{...headless,tipLength:10,tipDiameter:0,iT:29},{...headless,lStempel:31}];
 for(const e of cases){const a=E.auslegen(e);assert.ok(a.fehlt.length,JSON.stringify(e));assert.deepEqual(a.werte,{});assert.deepEqual(a.stufen,[]);}
});

test('mass cannot make a missing profile smaller than the already known solid regions',()=>{
 for(const e of [{...base,threadFamily:'trilobular',masse:1},{...base,kopfForm:'krallen',masse:1},{...base,standardKind:'headless',kD:0,kH:0,iTyp:'torx',iSize:'T20',iT:5,masse:1},{...base,threadFamily:'trilobular',d0:1e-200,sArea:40},{...base,threadFamily:'trilobular',sD:1e200}]){
  const a=E.auslegen(e);assert.ok(a.fehlt.length);assert.deepEqual(a.werte,{});assert.deepEqual(a.stufen,[]);
 }
});
