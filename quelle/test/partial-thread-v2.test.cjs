'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library'),R=require('../normen/resolver'),E=require('../engine'),W=require('../vorbelegung/draht'),P=require('../standard-preview'),C=require('../normen/to-chain');
const ids=['ISO4014','DIN931','ISO8765','DIN960','ISO4162','EN1665'];
const data={...require('../normen/index'),families:[...ids,'ISO4762','ISO4017','ISO10642','ISO14581','ISO7379'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde')};
const machines=require('../maschinen'),practice=require('../praxis');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function doc(id='ISO4014',size='M12',length=80,policy='shaft-v2'){
 const selection={id,groesse:size,festigkeitsklasse:'8.8'};if(length!==null)selection.laenge=length;
 return R.resolveStandard(data,selection,{},policy?{shaftPolicy:policy}:{});
}
const preset=(id,size,length)=>N.adapt(data,doc(id,size,length));
function input(p){const m=E.findMaterial('C15C'),c=m.flowCurves[0],e={typ:'bolzen',wst:E.WERKSTOFFE.indexOf(m),curveId:c.id,materialState:c.state,rmPolicy:'rm-v2',forcePolicy:'force-v2',machinePolicy:'ranking-v2',...p};e.d0=W.candidates(e,null,machines)[0]?.value;return e;}

test('K16 uses the real stepped blank, one shaft reduction and the JBF19 three-station model',()=>{
 const p=preset('ISO4014','M12',80);assert.equal(p.shaftPolicy,'shaft-v2');assert.equal(p.ds,12);assert.equal(p.b,30);assert.equal(p.shaftType,'partial');
 assert.deepEqual(p.shaftSegments,[{diameter:12,length:50},{diameter:10.75,length:30}]);
 const e=input(p),a=E.auslegen(e),ranking=E.waehle(machines,a,e,practice).ranking;
 assert.equal(e.d0,12);assert.deepEqual(a.fehlt,[]);assert.equal(a.stufen.length,2);assert.equal(a.stufen.filter(s=>s.segmentIndex===1).length,1);
 close(a.werte.V,10482.185765386343);assert.equal(ranking.recommendation.o.m,'JBF-19B3S');assert.equal(ranking.recommendation.ranking.classification,'A');
});

test('all six families share a reference blank but preserve their own head and thread dimensions',()=>{
 for(const id of ids){const p=preset(id,'M12',80);assert.equal(p.ds,12,id);assert.equal(p.b,30,id);assert.equal(p.shaftSegments[0].length,50,id);assert.equal(p.shaftSegments[1].diameter,p.threadModel.rollBlank,id);assert.equal(p.normRequiresGeometryReview,false,id);}
 assert.equal(preset('DIN931','M12',80).kSW,19);assert.equal(preset('ISO4014','M12',80).kSW,18);
 assert.equal(preset('ISO8765','M12',80).sD,10.92);assert.equal(preset('ISO4014','M12',80).sD,10.75);
});

test('length boundaries select their own b group without off-by-one or retained values',()=>{
 for(const [length,b]of [[125,30],[125.1,36],[200,36],[200.1,49]])for(const id of ['ISO4014','DIN931','DIN960']){
  const p=preset(id,'M12',length);assert.equal(p.b,b,`${id} ${length}`);close(p.shaftSegments[0].length,length-b);close(p.shaftSegments.reduce((n,s)=>n+s.length,0),length);
 }
 assert.equal(preset('EN1665','M20',150).b,52,'do not use the secondary transcription62');
 assert.equal(preset('DIN960','M10',80).b,26);assert.equal(preset('DIN960','M12',150).b,36);assert.equal(preset('DIN960','M20',100).b,46);
});

test('unpublished and conflicting length groups never silently acquire a formula value',()=>{
 for(const [id,size,length]of [['ISO4162','M12',250],['EN1665','M5',150],['ISO8765','M14',250]]){
  const p=preset(id,size,length);assert.equal(p.shaftSegments,undefined);assert.equal(p.b,undefined);assert.equal(p.normRequiresGeometryReview,true);assert.ok(p.normMissingFields.includes('shaftLengthDistribution'));
 }
 const altered=structuredClone(data);altered.families.find(f=>f.id==='ISO4014').groessen.M12.shaftModelV2.threadLengths[0].verification=false;
 assert.equal(N.adapt(altered,doc()).shaftSegments,undefined);
});

test('short custom lengths use one full blank without negative segments or claiming a norm length',()=>{
 for(const length of [12,29.9,30]){const p=preset('ISO4014','M12',length);assert.equal(p.b,length);assert.equal(p.shaftType,'full');assert.equal(p.shaftSegments,undefined);assert.equal(p.shaftModelAssumption.shortLengthApproximation,true);assert.equal(p.shaftModelAssumption.referenceThreadLength,30);}
 const p=preset('ISO4014','M12',30.1);close(p.shaftSegments[0].length,.1);assert.equal(p.b,30);
});

test('customer length and rolling diameter rebuild the reference blank; invalid b stays open',()=>{
 let d=R.setOverride(doc(),'sL',150);d=R.setOverride(d,'sD',10.8);const p=N.adapt(data,d);
 assert.equal(p.sL,150);assert.equal(p.b,36);assert.deepEqual(p.shaftSegments,[{diameter:12,length:114},{diameter:10.8,length:36}]);
 const custom=N.adapt(data,R.setOverride(R.setOverride(doc(),'b',40),'ds',11.9));assert.equal(custom.b,40);assert.deepEqual(custom.shaftSegments,[{diameter:11.9,length:40},{diameter:10.75,length:40}]);
 for(const b of [0,-1,81]){const bad=N.adapt(data,R.setOverride(doc(),'b',b));assert.equal(bad.shaftSegments,undefined);assert.equal(bad.normRequiresGeometryReview,true);}
});

test('explicit customer segments win over every generated split and survive restore',()=>{
 const segments=[{diameter:13,length:20},{diameter:12,length:30},{diameter:9,length:30}];
 const d=R.setOverride(doc(),'shaftSegments',segments),p=N.adapt(data,R.restore(JSON.stringify(d)));
 assert.deepEqual(p.shaftSegments,segments);assert.equal(p.shaftModelStatus,'customer');assert.equal(p.shaftModelAssumption.origin,'customer');assert.equal(p.ds,undefined);assert.equal(p.b,undefined);assert.equal(input(p).d0,13);
 const bad=N.adapt(data,R.setOverride(doc(),'shaftSegments',[{diameter:12,length:79}]));assert.equal(bad.shaftSegments,undefined);assert.equal(bad.normRequiresGeometryReview,true);
});

test('missing current length clears the old field and blocks a calculation until entered',()=>{
 const d=doc('ISO4014','M12',null);d.effective.sL=30;d.retainedValues.sL=30;
 const p=N.adapt(data,d);assert.equal(p.sL,null);assert.deepEqual(p.clearFields,['sL']);assert.equal(p.shaftSegments,undefined);assert.equal(p.normRequiresGeometryReview,true);assert.ok(p.normMissingFields.includes('length'));
 const fixed=N.adapt(data,R.setOverride(d,'sL',80));assert.equal(fixed.sL,80);assert.equal(fixed.shaftSegments[0].length,50);
});

test('flange defaults identify the published lower bound as an explicit simplified model',()=>{
 for(const [id,diameter]of [['ISO4162',24.7],['EN1665',26.6]]){
  const p=preset(id,'M12',80);assert.equal(p.flangeDiameter,diameter);assert.equal(p.flangeHeight,1.8);assert.equal(p.flangeModelAssumption.heightBasis,'published-minimum-c');assert.equal(p.flangeModelAssumption.provisional,true);
  assert.deepEqual(E.auslegen(input(p)).fehlt,[]);
  const edited=N.adapt(data,R.setOverride(doc(id),'flangeHeight',2.2));assert.equal(edited.flangeHeight,2.2);assert.equal(edited.flangeModelAssumption,undefined);
 }
});

test('versioned ds, b and flange facts cite two observed sources; minimum bounds are never nominal values',()=>{
 for(const f of data.families.filter(f=>ids.includes(f.id)))for(const row of Object.values(f.groessen)){
  const model=row.shaftModelV2;
  for(const v of [model.ds,...model.threadLengths,...(model.flange?[model.flange.height,model.flange.diameter]:[])]){
   assert.ok(v.sourceRefs.length>=2);assert.ok(v.sourceRefs.every(id=>f.quellen.some(s=>s.id===id&&s.url)));
   if(v.verification)assert.ok(v.value>0);else assert.equal(v.value,null);
  }
  if(model.flange){assert.equal(model.flange.height.bound,'minimum');assert.equal(model.flange.height.nominal,null);}
 }
});

test('preview and transfer use exactly the same two shaft segments and retain the editable template',()=>{
 const e=input(preset('ISO4014','M12',80)),a=E.auslegen(e),g=E.boltGeometry(e),chain=C.fromBolt(e,g),html=P.render({input:e,analysis:a,format:n=>n.toFixed(2)});
 assert.deepEqual(g.segments,e.shaftSegments);assert.deepEqual(chain.segments.slice(1).map(s=>({diameter:s.diameter,length:s.length})),e.shaftSegments);
 close(g.shaftVolume,Math.PI/4*(144*50+10.75**2*30));assert.ok(html.includes('Ø12.00 × 50.00 mm'));assert.ok(html.includes('Ø10.75 × 30.00 mm'));assert.equal(chain.standardDocument.shaftPolicy,'shaft-v2');
 assert.deepEqual(chain.modelAssumptions.shaft,e.shaftModelAssumption);assert.notEqual(chain.modelAssumptions.shaft,e.shaftModelAssumption);
 const flange=input(preset('EN1665','M12',80)),flangeChain=C.fromBolt(flange,E.boltGeometry(flange));assert.deepEqual(flangeChain.modelAssumptions.flange,flange.flangeModelAssumption);assert.notEqual(flangeChain.modelAssumptions.flange,flange.flangeModelAssumption);
});

test('unresolved special shaft lengths clear an earlier ordinary shaft without changing legacy semantics',()=>{
 for(const [id,size,length]of [['ISO14581','M4',5],['ISO7379','M6',30]]){
  const d=doc(id,size,length);d.effective.sL=80;
  const p=N.adapt(data,d);assert.equal(p.sL,null);assert.deepEqual(p.clearFields,['sL']);assert.equal(p.normRequiresGeometryReview,true);
  assert.equal(N.adapt(data,R.setOverride(d,'sL',20)).sL,20);
  assert.equal(N.adapt(data,doc(id,size,length,null)).sL,undefined);
 }
});

test('legacy documents and short ISO4762 cases keep their existing numerical model',()=>{
 const old=N.adapt(data,doc('ISO4014','M12',80,null));assert.equal(old.shaftPolicy,undefined);assert.equal(old.shaftSegments,undefined);assert.equal(old.b,undefined);assert.equal(old.sD,10.75);
 const legacy=doc('ISO4762','M6',30,null),current=doc('ISO4762','M6',30),a=N.adapt(data,legacy),b=N.adapt(data,current);
 assert.equal(a.shaftSegments,undefined);assert.equal(b.shaftSegments,undefined);assert.deepEqual(E.auslegen(input(a)).werte,E.auslegen(input(b)).werte);
 const flange=N.adapt(data,doc('ISO4162','M12',80,null));assert.equal(flange.flangeHeight,undefined);assert.ok(flange.normMissingFields.includes('flangeHeight'));
});
