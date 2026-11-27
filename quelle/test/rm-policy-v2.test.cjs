'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('../engine'),N=require('../normen/library'),S=require('../normen/resolver'),W=require('../vorbelegung/draht');
const policy=require('../vorbelegung/rm.json'),v2=policy.policies['rm-v2'],machines=require('../maschinen'),practice=require('../praxis');
const data={...require('../normen/index'),families:['ISO7380-1','ISO10642','ISO4161'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde')};
function input(material='34CrMo4',patch={}){
  const m=E.findMaterial(material),c=m.flowCurves[0];
  return {typ:'bolzen',standardKind:'screw',threadFamily:'metric',d0:4.7,kopfForm:'rund',kD:9.5,kH:2.75,sD:4.41,sL:12,iTyp:'none',wst:E.WERKSTOFFE.indexOf(m),curveId:c.id,materialState:c.state,rmPolicy:'rm-v2',machinePolicy:'ranking-v2',forcePolicy:'force-v2',...patch};
}
function norm(id,size,length,material='34CrMo4'){
  const e=input(material,{...N.adapt(data,S.resolveStandard(data,{id,groesse:size,laenge:length,festigkeitsklasse:id==='ISO4161'?'8':'10.9'})),typ:id==='ISO4161'?'mutter':'bolzen',nutModelVersion:'nut-model-v1'});
  e.d0=W.candidates(e,null,machines)[0].value;return e;
}

test('rm-v2 is separate and preserves the complete rm-v1 preset contract',()=>{
  assert.equal(E.RM_POLICY_VERSION,'rm-v1');assert.equal(E.RM_POLICY_VERSION_V2,'rm-v2');
  assert.equal(policy.policyVersion,'rm-v1');assert.equal(policy.defaultEnabled,false);
  assert.deepEqual(policy.presets.map(p=>[p.materialId,p.value]),[['C10C',350],['C15C',390],['20MnB4',430],['CuZn37',320],['AlMgSi1',300]]);
  assert.deepEqual(policy.bands.map(p=>[p.materialId,p.band]),[['C4C',{min:null,max:400}]]);
  for(const [material,value]of [['C10C',350],['C15C',390],['20MnB4',430],['CuZn37',320],['AlMgSi1',300]])assert.equal(E.rmVorbelegung(input(material,{rmPolicy:'rm-v1'})).value,value);
  assert.equal(E.rmVorbelegung(input('34CrMo4',{rmPolicy:'rm-v1'})).band,null);
  assert.equal(E.auslegen(input('34CrMo4',{rmPolicy:undefined})).werkstoff.rmVorbelegung,undefined);
});

test('all norm bounds have exact conditions, dimensions and two independent publications',()=>{
  assert.equal(v2.eligibleForForceCalculation,false);assert.equal(v2.eligibleForShearCalculation,true);
  for(const entry of v2.bands){
    assert.equal(entry.band.min,null);assert.ok(entry.band.max>0);assert.ok(entry.diameterRange.minExclusive<entry.diameterRange.maxInclusive);
    assert.ok(entry.deliveryConditions.length>0);assert.ok(entry.sourceRefs.length>=2);
    const sources=entry.sourceRefs.map(id=>v2.sources[id]);assert.ok(sources.every(s=>s?.url&&s.locator&&s.publisher));
    assert.ok(new Set(sources.map(s=>s.publisher)).size>=2,entry.id);
  }
  const c15=v2.bands.filter(b=>b.materialId==='C15C');assert.ok(c15.every(b=>/iso-corroboration/.test(b.verification)));
  assert.ok(c15.every(b=>b.sourceRefs.includes('creation-c15c-iso')));
});

test('small wires use the actual drawn-and-spheroidized rows rather than extending simple AC below 5 mm',()=>{
  for(const [material,max,condition]of [['C4C',320,'+U+C+AC'],['C10C',370,'+U+C+AC'],['C15C',390,'+U+C+AC'],['C35EC',550,'+U+C+AC'],['34CrMo4',590,'+AC+C+AC'],['42CrMo4',620,'+AC+C+AC']]){
    for(const d0 of [2.01,4.7,5]){
      const r=E.rmVorbelegung(input(material,{d0}));assert.deepEqual(r.band,{min:null,max});assert.equal(r.value,null);assert.equal(r.deliveryCondition,condition);
      assert.equal(r.conditionBasis,'provisional-spheroidized-delivery-assumption');assert.equal(r.source.kind,'normative-band');assert.equal(r.sourceRefs.length,2);
    }
    assert.equal(E.rmVorbelegung(input(material,{d0:2})).band,null);
    assert.equal(E.rmVorbelegung(input(material,{d0:4.7,rmDeliveryCondition:'+AC'})).band,null);
  }
});

test('simple AC bounds apply only within their published diameter intervals',()=>{
  for(const [material,max,limit]of [['C4C',330,100],['C10C',380,100],['C15C',400,100],['C35EC',560,40],['34CrMo4',600,40],['42CrMo4',630,40]]){
    for(const d0 of [5.01,limit]){const r=E.rmVorbelegung(input(material,{d0}));assert.deepEqual(r.band,{min:null,max});assert.equal(r.deliveryCondition,'+AC');}
    assert.equal(E.rmVorbelegung(input(material,{d0:limit+.01})).band,null);
    assert.equal(E.rmVorbelegung(input(material,{d0:undefined})).status,'diameter-missing');
  }
  for(const [material,max]of [['34CrMo4',580],['42CrMo4',610]]){
    const r=E.rmVorbelegung(input(material,{d0:5.1,rmDeliveryCondition:'+AC+C+AC'}));assert.equal(r.band.max,max);assert.equal(r.conditionBasis,'selected-delivery-condition');
  }
});

test('normalized 20MnB4 cannot inherit AC, and generic annealing cannot silently create its AC model',()=>{
  const rolled=E.rmVorbelegung(input('20MnB4'));assert.equal(rolled.value,430);assert.equal(rolled.band,null);assert.equal(rolled.origin,'practice');
  assert.equal(rolled.source.verification,'unverified-guideline');
  assert.equal(E.rmVorbelegung(input('20MnB4',{rmDeliveryCondition:'+AC'})).band,null);
  assert.equal(E.rmVorbelegung(input('20MnB4',{materialState:'soft-annealed',d0:8})).band,null);
  const explicit=E.rmVorbelegung(input('20MnB4',{materialState:'soft-annealed',rmDeliveryCondition:'+AC',d0:8}));assert.equal(explicit.band.max,500);assert.equal(explicit.value,null);
  assert.equal(E.rmVorbelegung(input('20MnB4',{materialState:'soft-annealed',rmDeliveryCondition:'+U+C+AC',d0:4})).band.max,490);
});

test('unknown, incompatible and post-drawing conditions stay open; customer values retain precedence',()=>{
  for(const patch of [{materialState:'unknown'},{materialState:'cold-drawn'},{rmDeliveryCondition:'+A'},{rmDeliveryCondition:'+U+C+AC'},{wirePreparation:'inline-drawing',rodDiameter:5}]){
    assert.equal(E.rmVorbelegung(input('34CrMo4',patch)).band,null);
    const r=E.rmVorbelegung(input('34CrMo4',{...patch,rm:710}));assert.equal(r.value,710);assert.equal(r.origin,'customer');assert.equal(r.band,null);
  }
});

test('Rm sensitivity resolves both constant-region endpoints without inventing a material minimum',()=>{
  const e=input(),a=E.auslegen(e),base=machines.find(m=>m.m==='JBF-10B3S');
  const sufficient=E.pruefe(base,a,e,practice).k.find(k=>k.krit==='Abschnitt-Ø');
  assert.equal(sufficient.status,'ok');assert.equal(sufficient.rmSensitivity.endpoints[0].rm,null);assert.equal(sufficient.rmSensitivity.endpoints[0].evaluationRm,400);
  assert.match(sufficient.detail,/Normbasiertes Rm-Band bis 590/);assert.match(sufficient.detail,/Lieferzustand angenommen, 2 < d ≤ 5 mm/);
  const sensitive=E.pruefe({...base,cd:5},a,e,practice);assert.equal(sensitive.k.find(k=>k.krit==='Abschnitt-Ø').status,'offen');assert.ok(sensitive.openPoints.some(p=>p.id==='wire-tensile-strength'));
});

test('K19 has complete forces and a documented small-wire band; catalogue exclusions remain honest',()=>{
  const e=norm('ISO7380-1','M5',12),a=E.auslegen(e),r=E.waehle(machines,a,e,practice);
  assert.equal(e.d0,4.7);assert.equal(a.werkstoff.rmVorbelegung.band.max,590);assert.ok(a.stufen.every(s=>Number.isFinite(s.F)&&s.F>0));
  assert.ok(['ok','knapp'].includes(r.ranking.recommendation.gesamt));
  const jbf10=E.pruefe(machines.find(m=>m.m==='JBF-10B3S'),a,e,practice);
  assert.equal(jbf10.k.find(k=>k.krit==='Abschnittlänge').status,'nein','16.2 mm must not override the 20 mm catalogue minimum to force a preferred family');
});

test('ISO10642 needs an actual thicker-wire process route, not a fictitious reset of accumulated strain',()=>{
  const e=norm('ISO10642','M6',20),thin=E.auslegen(e),thicker=E.auslegen({...e,d0:6.4});
  assert.equal(thin.materialStatus.flow,'strain-outside-range');assert.ok(thin.stufen.some(s=>s.F===null));
  assert.equal(thicker.materialStatus.flow,'ready');assert.equal(thicker.stufen.length,3);assert.ok(thicker.stufen.every(s=>Number.isFinite(s.F)&&s.F>0));
  assert.equal(thicker.werkstoff.rmVorbelegung.band.max,600);assert.equal(thicker.werkstoff.selectedFlowCurve.id,thin.werkstoff.selectedFlowCurve.id);
});

test('P2 K18 stays numerically identical under rm-v1, while v2 piercing carries its upper-bound basis',()=>{
  const e=norm('ISO4161','M8',undefined,'C10C'),legacy=E.auslegen({...e,rmPolicy:'rm-v1'}),updated=E.auslegen(e);
  assert.deepEqual(legacy.stufen.map(s=>s.F),[59449.552449752635,118203.88742589302,151474.39574953297,32102.693803598988,271380.64108073025,20217.958283218788]);
  assert.deepEqual(updated.stufen.slice(0,-1),legacy.stufen.slice(0,-1));
  const punch=updated.stufen.at(-1);assert.equal(punch.forceBasis.rm.status,'band-upper-bound');assert.equal(punch.forceBasis.rm.value,380);
  assert.equal(punch.forceBasis.rm.source.kind,'normative-band');assert.equal(updated.werkstoff.Rm,null);
});

test('embedded browser policy resolves the same normative bounds as Node',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../engine.js'),'utf8').replace(/\/\*RM_PRESETS_BEGIN\*\/null\/\*RM_PRESETS_END\*\//,JSON.stringify(policy));
  const context={};vm.runInNewContext(source,context);
  for(const e of [input(),input('42CrMo4',{d0:6}),input('20MnB4')])assert.deepEqual(JSON.parse(JSON.stringify(context.JYK.rmVorbelegung(e))),E.rmVorbelegung(e));
});
