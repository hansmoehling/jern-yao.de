'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../engine.js');
const policy = require('../vorbelegung/rm.json');
const machines = require('../maschinen.json');
const machine = machines.find(m => m.m === 'JBF-13B3S');
const base = {typ:'bolzen',standardKind:'rivet',threadFamily:'none',d0:8,kopfForm:'rund',kD:13,kH:5,sD:8,sL:30,iTyp:'none',rmPolicy:E.RM_POLICY_VERSION};
const input = (id, patch = {}) => {
  const material = E.findMaterial(id);
  return {...base,wst:E.WERKSTOFFE.indexOf(material),materialState:material.flowCurves?.[0]?.state || 'unknown',curveId:material.flowCurves?.[0]?.id,...patch};
};
const checked = (e, m = machine) => {
  const a = E.auslegen(e), result = E.pruefe(m,a,e);
  assert.deepEqual(a.fehlt,[]);
  return {a,result,cutoff:result.k.find(c=>c.krit==='Abschnitt-Ø')};
};
const wireGap = r => r.openPoints.some(p=>p.id==='wire-tensile-strength');

test('Rm policy is explicit, versioned and absent from legacy results unless enabled',()=>{
  assert.equal(policy.defaultEnabled,false);
  assert.equal(policy.policyVersion,E.RM_POLICY_VERSION);
  for(const rmPolicy of [undefined,'rm-v0','true',true]) {
    const {a,result,cutoff}=checked(input('C4C',{rmPolicy}));
    assert.equal(a.werkstoff.Rm,null);
    assert.equal(a.werkstoff.rmVorbelegung,undefined);
    assert.equal(cutoff.status,'offen');assert.equal(cutoff.detail,undefined);assert.ok(wireGap(result));
  }
  const suggestion=E.rmVorbelegung(input('C15C',{rmPolicy:undefined}));
  assert.equal(suggestion.policyEnabled,false);assert.equal(suggestion.value,390);
});

test('five legacy guidelines retain their exact source and provisional state assumption',()=>{
  for(const [id,expected] of [['C10C',350],['C15C',390],['20MnB4',430],['CuZn37',320],['AlMgSi1',300]]) {
    const e=input(id),{a,cutoff,result}=checked(e),rm=E.rmVorbelegung(e);
    assert.equal(rm.value,expected,id);assert.equal(rm.value,E.findMaterial(id).legacyParameters.Rm);
    assert.equal(rm.status,'guideline');assert.equal(rm.origin,'practice');assert.equal(rm.band,null);
    assert.equal(rm.source.kind,'legacyParameters');assert.equal(rm.source.reference,id+'.legacyParameters.Rm');
    assert.equal(rm.source.verification,'unverified-guideline');assert.equal(rm.conditionBasis,'provisional-process-assumption');
    assert.equal(rm.eligibleForForceCalculation,false);assert.equal(rm.appliesTo,'cutoff-diameter');
    assert.equal(a.werkstoff.Rm,expected);assert.deepEqual(a.werkstoff.rmVorbelegung,rm);
    assert.deepEqual(cutoff.rmVorbelegung,rm);assert.match(cutoff.detail,/Bestandsdaten/);assert.equal(wireGap(result),false);
  }
  assert.match(E.rmVorbelegung(input('AlMgSi1')).note,/kein Herstellerwert/);
});

test('customer Rm supersedes guideline and band with customer provenance',()=>{
  for(const id of ['C15C','C4C','42CrMo4']) {
    const e=input(id,{rm:850}),{a,cutoff}=checked(e),rm=a.werkstoff.rmVorbelegung;
    assert.equal(a.werkstoff.Rm,850);assert.equal(rm.band,null);assert.equal(rm.origin,'customer');
    assert.equal(rm.status,'customer-value');assert.equal(rm.source.kind,'customer-input');
    assert.equal(cutoff.status,'knapp');assert.match(cutoff.detail,/Kundenangabe/);
  }
});

test('soft-annealed C4C uses an upper band without inventing a point Rm',()=>{
  const {a,cutoff,result}=checked(input('C4C'));
  assert.equal(a.werkstoff.Rm,null);assert.equal(a.werkstoff.rmVorbelegung.value,null);
  assert.deepEqual(a.werkstoff.rmVorbelegung.band,{min:null,max:400});
  assert.equal(a.werkstoff.rmVorbelegung.origin,'assumption');
  assert.equal(a.werkstoff.rmVorbelegung.conditionBasis,'selected-soft-annealed-state');
  assert.equal(cutoff.status,'ok');assert.equal(cutoff.rmSensitivity.sensitive,false);
  assert.deepEqual(cutoff.rmSensitivity.endpoints.map(x=>x.status),['ok','ok']);
  assert.equal(cutoff.rmSensitivity.endpoints[0].rm,null);
  assert.equal(cutoff.rmSensitivity.endpoints[0].evaluationRm,400);
  assert.equal(wireGap(result),false);assert.doesNotMatch(cutoff.ist,/offen/);
  assert.match(cutoff.detail,/beiden Bandgrenzen denselben Prüfstatus/);
  const edge=checked(input('C4C'),{...machine,cd:8});
  assert.equal(edge.cutoff.status,'knapp');assert.equal(wireGap(edge.result),false);
});

test('42CrMo4 without an applicable value or band retains its wire-strength question',()=>{
  for(const materialState of ['soft-annealed','unknown']) {
    const {a,cutoff,result}=checked(input('42CrMo4',{materialState}));
    assert.equal(a.werkstoff.Rm,null);assert.equal(a.werkstoff.rmVorbelegung.band,null);
    assert.equal(cutoff.status,'offen');assert.equal(wireGap(result),true);
  }
});

test('unknown or incompatible wire state cannot inherit a guideline or the C4C band',()=>{
  for(const id of ['C4C','C15C','20MnB4']) for(const materialState of ['unknown','cold-drawn']) {
    const {a,cutoff,result}=checked(input(id,{materialState}));
    assert.equal(a.werkstoff.Rm,null);assert.equal(a.werkstoff.rmVorbelegung.band,null);
    assert.equal(cutoff.status,'offen');assert.equal(wireGap(result),true);
  }
  assert.equal(E.rmVorbelegung(input('20MnB4',{materialState:'soft-annealed'})).status,'state-mismatch');
});

test('inline drawing requires post-drawing Rm instead of an undeformed-state preset',()=>{
  for(const id of ['C4C','C15C']) {
    const e=input(id,{wirePreparation:'inline-drawing',rodDiameter:8.5}),{a,cutoff,result}=checked(e);
    assert.equal(a.werkstoff.rmVorbelegung.status,'post-drawing-missing');
    assert.equal(a.werkstoff.Rm,null);assert.equal(cutoff.status,'offen');
    assert.match(result.openPoints.find(p=>p.id==='wire-tensile-strength').detail,/nach dem Inline/);
    const supplied=checked({...e,rm:650});assert.equal(supplied.a.werkstoff.Rm,650);
    assert.equal(supplied.a.werkstoff.rmVorbelegung.wireStage,'after-inline-drawing');assert.equal(wireGap(supplied.result),false);
  }
});

test('band endpoints distinguish resolved sensitivity from a status-changing missing value',()=>{
  assert.equal(E.rmSensitivitaet(8,10,{min:300,max:450}).status,'ok');
  assert.deepEqual(E.rmSensitivitaet(8,10,{min:300,max:800}).endpoints.map(x=>x.status),['ok','knapp']);
  assert.equal(E.rmSensitivitaet(8,10,{min:300,max:800}).status,'offen');
  assert.equal(E.rmSensitivitaet(8,10,null).status,'offen');
  // Deliberately synthetic bounds exercise the consumer; no extra material band is published.
  const e=input('C4C'),a=E.auslegen(e);
  a.werkstoff.rmVorbelegung={...a.werkstoff.rmVorbelegung,band:{min:300,max:800},source:{kind:'test-fixture'}};
  const r=E.pruefe(machine,a,e),cutoff=r.k.find(c=>c.krit==='Abschnitt-Ø');
  assert.equal(cutoff.status,'offen');assert.equal(cutoff.rmUncertaintyRelevant,true);assert.equal(wireGap(r),true);
  assert.match(cutoff.detail,/genaue Wert kann/);
});

test('missing catalogue capacity remains a machine-data gap without inventing a C4C Rm question',()=>{
  const {cutoff,result}=checked(input('C4C'),{...machine,cd:null});
  assert.equal(cutoff.status,'offen');assert.equal(wireGap(result),false);
  assert.ok(result.openPoints.some(p=>p.id==='machine-cutoff-diameter'));
});

test('Rm policy never relaxes nominal catalogue dimensions or makes a force curve',()=>{
  const hard=checked(input('C4C'),{...machine,cd:7.9});
  assert.equal(hard.cutoff.status,'nein');assert.equal(hard.result.gesamt,'nein');
  for(const id of ['C4C','C15C']) {
    const e=input(id),legacy=E.auslegen({...e,rmPolicy:undefined}),opted=E.auslegen(e);
    assert.equal(opted.werte.Fmax_t,legacy.werte.Fmax_t);assert.equal(opted.werte.Fsum_t,legacy.werte.Fsum_t);
    assert.deepEqual(opted.stufen,legacy.stufen);
    const missing=checked({...e,curveId:undefined});assert.equal(missing.a.werte.Fmax_t,null);
    assert.ok(missing.result.openPoints.some(p=>p.id==='flow-curve'));
  }
});

test('browser source stays loadable without require and builds consume canonical policy data',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../engine.js'),'utf8');
  const context={};vm.runInNewContext(source,context);
  assert.equal(context.JYK.RM_POLICY_VERSION,E.RM_POLICY_VERSION);
  assert.equal(context.JYK.rmVorbelegung({material:'C4C',materialState:'soft-annealed'}).band,null);
  const embedded=source.replace(/\/\*RM_PRESETS_BEGIN\*\/null\/\*RM_PRESETS_END\*\//,JSON.stringify(policy));
  const browser={};vm.runInNewContext(embedded,browser);
  const rm=browser.JYK.rmVorbelegung({material:'C4C',materialState:'soft-annealed',rmPolicy:E.RM_POLICY_VERSION});
  assert.equal(rm.band.max,400);assert.equal(rm.value,null);
});

test('Rm provenance and check details are translated in all four additional languages',()=>{
  const catalog=require('../i18n-rm.json'),runtime=fs.readFileSync(path.join(__dirname,'../i18n-runtime.js'),'utf8');
  const context={};vm.runInNewContext(runtime.replace('/*CATALOG*/',JSON.stringify(catalog)),context);
  const details=[
    checked(input('C15C')).cutoff.detail,checked(input('C15C',{rm:850})).cutoff.detail,
    checked(input('C4C')).cutoff.detail,checked(input('C4C'),{...machine,cd:null}).cutoff.detail,
    checked(input('C4C'),{...machine,cd:7}).cutoff.detail,checked(input('42CrMo4')).cutoff.detail,
    checked(input('C4C',{wirePreparation:'inline-drawing',rodDiameter:8.5})).cutoff.detail,
    E.rmVorbelegung(input('AlMgSi1')).note
  ];
  for(const detail of details)for(const lang of ['it','sl','en','zh']) {
    const translated=context.JYI18N.t(detail,lang);
    assert.notEqual(translated,detail,lang+': '+detail);assert.doesNotMatch(translated,/\{(?:rm|min|max)\}/);
  }
});
