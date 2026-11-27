'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),N=require('../normen/library.js'),S=require('../normen/resolver.js'),W=require('../vorbelegung/draht.js');
const machines=require('../maschinen.json'),practice=require('../praxis.json');
const data={...require('../normen/index.json'),families:['ISO4032','ISO4161','ISO4762'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json')};
const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
function input(id='ISO4032',groesse='M10',material='C10C'){
  const wst=E.WERKSTOFFE.findIndex(w=>w.id===material),curve=E.WERKSTOFFE[wst].flowCurves[0];
  const e={...N.adapt(data,S.resolveStandard(data,{id,groesse,festigkeitsklasse:id==='ISO4762'?'8.8':'8',...(id==='ISO4762'?{laenge:30}:{})})),typ:id==='ISO4762'?'bolzen':'mutter',nutModelVersion:'nut-model-v1',wst,curveId:curve.id,materialState:curve.state,rmPolicy:'rm-v1',machinePolicy:'ranking-v2',forcePolicy:'force-v2'};
  e.d0=W.candidates(e,null,machines)[0].value;return e;
}
const synthetic={id:'synthetic-hollomon',eligible:true,approval:'literature',sourceIds:['synthetic-test'],model:'hollomon',C:600,n:.2,phiMin:0,phiMax:1,kf0:100};

test('force v2 is explicit; the prior nut calculation and unversioned curve remain bounded',()=>{
  const e=input(),a=E.auslegen(e),legacy=E.auslegen({...e,forcePolicy:undefined});
  assert.equal(a.forcePolicy,'force-v2');assert.equal(legacy.forcePolicy,undefined);
  assert.equal(legacy.werte.Fmax_t,null);assert.equal(legacy.materialStatus.flow,'strain-outside-range');
  assert.ok(legacy.stufen.every(s=>s.forceStatus===undefined&&s.forceBand===undefined));
  assert.ok(Number.isNaN(E.kf({flowCurve:synthetic},1.2)));
  assert.ok(E.kf({flowCurve:synthetic,forcePolicy:'force-v2'},1.2)>0);
});

test('upper-third fit is endpoint-continuous and recovers an exact Hollomon curve',()=>{
  const c={...synthetic},fit=E.flowExtrapolationFit(c);close(fit.C,c.C);close(fit.n,c.n);
  close(fit.phiMin,2/3);assert.equal(fit.endpointAnchored,true);assert.equal(fit.sampleCount,13);
  const m={flowCurve:c,forcePolicy:'force-v2'};close(E.kf(m,1+1e-8),600*(1+1e-8)**.2);
  close(E.kf(m,1.6),600*1.6**.2);assert.ok(Number.isNaN(E.kf(m,1.600001)));
});

test('tabulated and Swift fits use only the documented upper third and join it continuously',()=>{
  const table={...synthetic,model:'tabulated',points:[[0,100],[.25,200],[.5,300],[.75,400],[1,500]]};
  const changed={...table,points:table.points.map((p,i)=>i===0?[0,50]:p)};
  assert.deepEqual(E.flowExtrapolationFit(table),E.flowExtrapolationFit(changed));
  for(const c of [table,{...synthetic,model:'swift',epsilon0:.15}]){
    const m={flowCurve:c,forcePolicy:'force-v2'},end=E.kf(m,c.phiMax),next=E.kf(m,c.phiMax+1e-8);
    close(next,end,1e-7);assert.ok(E.kf(m,1.6)>end);
  }
});

test('mean flow stress integrates the source and both extrapolation branches exactly',()=>{
  const m={flowCurve:synthetic,forcePolicy:'force-v2'};
  const expected=600*(1.4**1.2-.8**1.2)/(1.2*(1.4-.8));
  close(E.kfm(m,.8,1.4),expected);
  const constant=(600*(1-.8**1.2)/1.2+600*.4)/.6;
  close(E.kfm({...m,_forceBandMode:'constant'},.8,1.4),constant);
  close(E.kfm({...m,_forceBandMode:'constant'},1.2,1.5),600);
  assert.ok(Number.isNaN(E.kfm(m,.8,1.61)));
});

test('inline prestrain counts toward the absolute extrapolation limit and cannot bypass it',()=>{
  const m={flowCurve:synthetic,forcePolicy:'force-v2',flowPrestrain:.2};
  close(E.kf(m,1.4),600*1.6**.2);
  assert.ok(Number.isNaN(E.kf(m,1.401)));
  close(E.kfm(m,.6,1.2),E.kfm({...m,flowPrestrain:0},.8,1.4));
  assert.ok(Number.isNaN(E.kfm(m,.5,1.401)));
});

test('nut piercing uses 0.8 Rm with provenance, independently of flow extrapolation',()=>{
  const e=input(),a=E.auslegen(e),stage=a.stufen.at(-1),diameter=a.werte.loch;
  close(stage.F,Math.PI*diameter*(.5*diameter)*.8*a.werkstoff.Rm);
  assert.equal(stage.r,'R-LOCH-RM');assert.equal(stage.forceStatus,'calculated');assert.equal(stage.forceExtrapolation,undefined);
  assert.equal(stage.forceBasis.rm.status,'guideline');assert.ok(a.regelListe.includes('R-LOCH-RM'));
  const customer=E.auslegen({...e,rm:500}).stufen.at(-1);assert.equal(customer.forceBasis.rm.origin,'customer');close(customer.F,Math.PI*diameter*(.5*diameter)*.8*500);
  const band=E.auslegen(input('ISO4032','M10','C4C')).stufen.at(-1);assert.equal(band.forceBasis.rm.status,'band-upper-bound');assert.equal(band.forceBasis.rm.value,band.forceBasis.rm.band.max);
});

test('missing curve and missing post-drawing Rm remain separate missing inputs',()=>{
  const e=input(),noCurve=E.auslegen({...e,curveId:'not-a-curve',rm:400});
  assert.equal(noCurve.werte.Fmax_t,null);assert.equal(noCurve.materialStatus.flow,'selection-missing');
  assert.ok(noCurve.stufen.at(-1).F>0,'known Rm can still calculate the distinct shear operation');
  assert.ok(noCurve.stufen.slice(0,-1).every(s=>s.F===null));
  const postDraw=E.auslegen({...e,wirePreparation:'inline-drawing',rodDiameter:e.d0*1.05});
  assert.equal(postDraw.stufen.at(-1).F,null);assert.equal(postDraw.stufen.at(-1).forceStatus,'missing');
  assert.equal(postDraw.stufen.at(-1).forceBasis.rm.status,'missing');
  assert.equal(postDraw.werte.Fmax_t,null);
});

test('cup pressure, flange mean stress, and combined operation bands stay consistent',()=>{
  const e=input('ISO4161','M8'),a=E.auslegen(e),cup=a.stufen.find(s=>s.r==='R-F3'),flange=a.stufen.find(s=>s.v==='Flansch fertigformen');
  close(cup.pStempel,cup.F/cup.A);close(cup.pStempelBand.min,cup.forceBand.min/cup.A);assert.equal(cup.forceStatus,'extrapoliert');
  const phi=Math.log((Math.sqrt(3)/2*e.mSW**2)/(Math.PI/4*e.d0**2))+.3;
  const material={flowCurve:a.werkstoff.selectedFlowCurve,forcePolicy:'force-v2'};
  close(flange.F,(Math.PI/4*e.mFlansch**2)*E.kfm(material,phi,phi+.5)/.6);assert.equal(flange.forceStatus,'extrapoliert');
  const bolt=E.auslegen(input('ISO4762','M6','20MnB4'));
  for(const stage of bolt.stufen){assert.ok(stage.F>0);close(stage.forceBand.t.max,stage.F/1000/E.G);assert.ok(stage.forceBand.min<=stage.F);}
  assert.ok(bolt.stufen.some(s=>s.operationParts?.length>1),'reduction plus upsetting is still one combined station');
});

test('force sensitivity opens only a machine whose status differs at band endpoints',()=>{
  const e=input('ISO4161','M8'),a=E.auslegen(e),band=a.werte.forceBand.Fmax_t,base=machines.find(m=>m.m==='JNF-13B6SL');
  assert.ok(band.max>band.min);
  const cases=[[(band.min+band.max)/2,'offen',true],[band.max/.6,'ok',false],[band.min*.9,'nein',false]];
  for(const [pw,status,sensitive]of cases){const checked=E.pruefe({...base,pw},a,e,practice),row=checked.k.find(k=>k.krit==='Presskraft');assert.equal(row.status,status);assert.equal(row.forceSensitivity.sensitive,sensitive);assert.equal(checked.openPoints.some(p=>p.id==='forming-force-band'),sensitive);}
  assert.equal(E.forceSensitivitaet({min:6,max:7},10).status,'offen');assert.equal(E.forceSensitivitaet({min:7,max:9},10).status,'knapp');
});

test('uncertainty only in the ancillary force sum creates no machine-selection question',()=>{
  const e=input(),a=E.auslegen(e),sum=a.werte.forceBand.Fsum_t,base=machines.find(m=>m.m==='JNF-14B6SL');
  const checked=E.pruefe({...base,pw:(sum.min+sum.max)/2},a,e,practice);
  assert.equal(checked.k.find(k=>k.krit==='Presskraft').status,'ok');
  assert.equal(checked.k.find(k=>k.krit==='Summe der Stationskräfte').forceSensitivity.sensitive,true);
  assert.ok(!checked.openPoints.some(p=>p.id==='forming-force-band'));
});

test('every available target nut size has a complete force chain and an admissible recommendation',()=>{
  let count=0;
  for(const id of ['ISO4032','ISO4161'])for(const size of N.sizes(data.families.find(f=>f.id===id)).filter(s=>+s.slice(1)>=5&&+s.slice(1)<=(id==='ISO4032'?30:20))){
    const e=input(id,size),a=E.auslegen(e),selection=E.waehle(machines,a,e,practice),first=selection.ranking?.recommendation;
    assert.deepEqual(a.fehlt,[],id+size);assert.equal(a.stufen.length,id==='ISO4032'?5:6);assert.ok(a.stufen.every(s=>s.F>0&&s.forceBand?.min>0),id+size);
    assert.ok(['ok','knapp'].includes(first?.gesamt),id+size);assert.ok(a.werte.Fmax_t>0&&a.werte.Fsum_t>0);
    assert.ok(a.stufen.filter(s=>s.forceStatus==='extrapoliert').every(s=>s.forceExtrapolation.phiEnd<=1.6));
    const concept=E.maschinenKonzept(a,e,first.o,practice);assert.equal(concept.stages.length,a.stufen.length);assert.ok(concept.stages.some(s=>s.forceStatus==='extrapoliert'&&s.forceBand));count++;
  }
  assert.equal(count,22);
});
