'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library.js'),R=require('../normen/resolver.js'),E=require('../engine.js'),P=require('../standard-preview.js'),T=require('../normen/to-chain.js'),C=require('../axial-chain.js'),G=require('../geometry-model.js');
const ids=['DIN124','DIN302','DIN660','DIN661','DIN662','DIN674','DIN6791','DIN6792','DIN7338'];
const families=ids.map(id=>require('../normen/'+id+'.json')),data={schemaVersion:1,version:'p7',families};
const f=id=>families.find(x=>x.id===id),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const circle=d=>Math.PI*d*d/4,cone=(D,d,h)=>Math.PI*h*(D*D+D*d+d*d)/12,cap=(D,h)=>Math.PI*h*(3*D*D/4+h*h)/6;
function doc(id,d,l,form){const selection={id,groesse:String(d),laenge:l,...(form?{form}:{})};return R.resolveStandard(N.selectionLibrary(data,selection),selection,{}, {shaftPolicy:'shaft-v2'});}
function input(document){const e=N.adapt(data,document);return {...e,typ:'bolzen',wst:0,d0:e.sD,forcePolicy:'force-v2',rmPolicy:'rm-v2'};}
function checkGeometry(e,total,volume){
 const g=E.boltGeometry(e);assert.ok(!g.error,g.error);close(g.totalLength,total);close(g.headVolume+g.shaftVolume-g.cavity.volume,volume);
 const calculated=E.auslegen(e);close(calculated.werte.V,volume);
 const html=P.render({input:e,analysis:calculated,format:n=>n.toFixed(3)});assert.ok(html.includes('data-preview="outer"'));assert.ok(html.includes(volume.toFixed(3)+' mm³'));assert.ok(!/NaN|Infinity/.test(html));
 const chain=T.fromBolt(e,g),p=C.project(chain);assert.equal(p.ok,true,JSON.stringify(p.errors));const v=G.evaluate(p.spec);assert.equal(v.valid,true,JSON.stringify(v.errors));close(v.volumeMm3,volume);close(chain.parting,g.headHeight);close(chain.segments.reduce((sum,s)=>sum+s.length,0),total);
 assert.deepEqual(chain.standardDocument,e.standardDocument);return {g,chain};
}

test('DIN662 separates the total k into cone k−w and crown w without a cylindrical head',()=>{
 const d=doc('DIN662',4,12),before=JSON.stringify(d),e=input(d);
 assert.equal(e.kopfForm,'linsensenk');close(e.kH,.7);close(e.capHeight,1.4);close(e.sL,12);assert.equal(e.alpha,140);assert.equal(e.normRequiresGeometryReview,false);
 const {chain}=checkGeometry(e,14.1,cone(8,4,.7)+cap(8,1.4)+circle(4)*12);
 assert.deepEqual(chain.segments.map(s=>s.shape),['cone','cone','cylinder']);assert.equal(chain.modelAssumptions.rivetReference.headHeightReference,'total');assert.equal(chain.modelAssumptions.head.exactNormContour,false);
 assert.equal(JSON.stringify(d),before);assert.equal(d.normBaseline.values.kH,2.1);assert.equal(d.normBaseline.provenance.capHeight.nominal,1.4);
});

test('DIN302 has a crown before the nominal-length plane; l includes cone k',()=>{
 const e=input(doc('DIN302',10,20));assert.equal(e.kopfForm,'linsensenk');close(e.kH,3);close(e.capHeight,1);close(e.sL,17);assert.equal(e.alpha,75);
 checkGeometry(e,21,cone(14.5,10,3)+cap(14.5,1)+circle(10)*17);
 assert.equal(e.rivetGeometryReference.length.kind,'includes-cone-excludes-crown');
});

test('DIN661 nominal length includes its 75-degree countersunk head',()=>{
 const e=input(doc('DIN661',4,12));close(e.sL,10);assert.equal(e.alpha,75);assert.equal(e.iTyp,'none');
 checkGeometry(e,12,cone(7,4,2)+circle(4)*10);
});

test('DIN6792 head angle and length differ from the unmeasured blind-bore bottom assumption',()=>{
 const e=input(doc('DIN6792',4,12));close(e.sL,10.8);close(e.kH,1.2);assert.equal(e.alpha,120);assert.equal(e.boreBottomAssumption.origin,'assumption');
 const h=2.7/(2*Math.tan(Math.PI/3)),bore=circle(2.7)*(4-h)+circle(2.7)*h/3;
 const {chain}=checkGeometry(e,12,cone(8,4,1.2)+circle(4)*10.8-bore);
 assert.equal(chain.recesses[0].from,'B');assert.equal(chain.modelAssumptions.bore.angleOrigin,'assumption');
 assert.equal(f('DIN6792').dimensionEditionEvidence.currentTableVerified,false);assert.equal(f('DIN6792').fields['4'].senkwinkel_grad.dimensionEdition,'1993-05');
});

test('customer head, cap and shaft edits survive reedit and reset without repeated conversion',()=>{
 for(const id of ['DIN662','DIN302','DIN661','DIN6792']){
  let d=doc(id,id==='DIN302'?10:id==='DIN662'?6:4,20),e=input(d),original=JSON.stringify(d.normBaseline);
  d=R.setOverride(d,'sL',27);d=R.setOverride(d,'kH',1.7);if(['DIN662','DIN302'].includes(id))d=R.setOverride(d,'capHeight',.8);
  e=input(R.restore(JSON.stringify(R.snapshot(d))));close(e.sL,27);close(e.kH,1.7);if(['DIN662','DIN302'].includes(id))close(e.capHeight,.8);
  assert.equal(JSON.stringify(d.normBaseline),original);assert.equal(e.rivetGeometryReference.shaftLengthOrigin,'customer');
  const restored=R.resetOverride(R.resetOverride(d,'sL'),'kH'),reset=input(restored);assert.notEqual(reset.kH,1.7);
  if(d.normBaseline.values.sL!==undefined)assert.notEqual(reset.sL,27);else{assert.equal(reset.sL,27);assert.ok(restored.issues.some(i=>i.code==='reset-baseline-unavailable'&&i.path==='sL'),'no fabricated unverified length baseline');}
 }
 const changed=input(R.setOverride(doc('DIN662',4,12),'kopfForm','rund'));close(changed.kH,2.1);assert.equal(changed.headModelAssumption,undefined);
});

test('missing or shorter-than-head nominal lengths cannot create negative or invented shafts',()=>{
 for(const id of ['DIN302','DIN661','DIN6792'])for(const length of [undefined,.1]){
  const e=input(doc(id,id==='DIN302'?10:4,length));assert.equal(e.sL,null);assert.equal(e.normRequiresGeometryReview,true);assert.ok(e.normMissingFields.includes('headToShaftLength'));
 }
});

test('DIN674 corrected height and DIN124 transition radius retain source correction evidence',()=>{
 const e=input(doc('DIN674',4,12));close(e.kH,2);checkGeometry(e,14,cap(9,2)+circle(4)*12);
 assert.equal(f('DIN674').fields['4'].k_js14.status,'verified');assert.equal(f('DIN674').fields['4'].k_js14.superseded.value,2.12);
 const r=f('DIN124').fields['10'];assert.equal(r.r_max.max,.5);assert.equal(r.r1_ca.nominal,8);assert.equal(r.r_max.superseded.value,8);
 checkGeometry(input(doc('DIN124',10,20)),26.5,cap(16,6.5)+circle(10)*20);
});

test('DIN660 sourced head is retained and actual combinations are not a fabricated Cartesian matrix',()=>{
 checkGeometry(input(doc('DIN660',4,12)),14.4,cap(7,2.4)+circle(4)*12);
 assert.equal(f('DIN660').fields['4'].r1_ca.nominal,3.8);
 assert.ok(f('DIN660').groessen['4'].nachLaenge['12']);assert.equal(f('DIN660').groessen['4'].nachLaenge['38'],undefined);
 assert.ok(f('DIN661').groessen['4'].nachLaenge['12']);assert.equal(f('DIN661').groessen['3'].nachLaenge['30'],undefined,'available only in one consulted current assortment');
 assert.equal(f('DIN662').groessen['4'].nachLaenge['12'],undefined,'one supplier is not a crosschecked combination');
 for(const id of ['DIN660','DIN661','DIN662','DIN674'])for(const row of Object.values(f(id).groessen))for(const r of Object.values(row.nachLaenge))assert.ok(r.fields.l_nominal.kind.includes('combination'));
});

test('DIN6791 shifted-radius profile is not mislabelled as a cap height or invented bore angle',()=>{
 const row=f('DIN6791').groessen['4'],fields=f('DIN6791').fields['4'];assert.equal(fields.f_offset.nominal,1);assert.equal(fields.r1_ca.nominal,3.5);
 assert.equal(row.vorbelegung.capHeight,undefined);assert.ok(row.missingGeometryFields.includes('headProfileRadius'));
 assert.equal(fields.r1_ca.currentEditionTableVerified,false);assert.equal(row.vorbelegung.bottomAngle,undefined);
});

test('DIN7338 A/B use flat disk heads and B keeps the bore at the shaft end',()=>{
 const a=input(doc('DIN7338',4,12,'A'));assert.equal(a.kopfForm,'rund');assert.equal(a.iTyp,'none');checkGeometry(a,13,circle(7.5)+circle(4)*12);
 const b=input(doc('DIN7338',4,8,'B'));assert.equal(b.t_b,4);assert.equal(b.boreBottomAssumption.origin,'assumption');
 const h=2.7/(2*Math.tan(Math.PI/3)),bore=circle(2.7)*(4-h)+circle(2.7)*h/3;
 const {chain}=checkGeometry(b,9,circle(7.5)+circle(4)*8-bore);assert.equal(chain.recesses[0].from,'B');
 assert.equal(f('DIN7338').variants.find(v=>v.id==='B').fields['4'].t_max.status,'conflict');
 assert.ok(f('DIN7338').variants.find(v=>v.id==='C1').sizeData['4'].missingGeometryFields.includes('tubeProfile'));
});

test('rivet standards never produce a drive question or a threaded blank on reedit',()=>{
 for(const id of ids){let d=doc(id,id==='DIN124'||id==='DIN302'?10:4,20,id==='DIN7338'?'B':undefined);d=R.setOverride(d,'iTyp','hex');d=R.setOverride(d,'threadFamily','metric');const e=input(d);assert.equal(e.iTyp,'none',id);assert.equal(e.threadFamily,'none',id);assert.equal(e.threadModel,null,id);}
});
