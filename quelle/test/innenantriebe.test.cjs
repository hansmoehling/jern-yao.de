'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const machines = require('../maschinen.json');
const base = {typ:'bolzen',wst:E.WERKSTOFFE.findIndex(w=>w.id==='33B2'),d0:5.6,kopfForm:'rund',kD:10,kH:6,sD:5.4,sL:30};
const gross = Math.PI/4*(base.kD**2*base.kH+base.sD**2*base.sL);
const A0 = Math.PI/4*base.d0**2;
const close = (actual, expected) => assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
const totalsUnknown = a => {
  for(const key of ['Fmax_t','Fsum_t','FN_muss_t','FN_wunsch_t']) assert.equal(a.werte[key],null,key);
};

test('explicit hex uses across-flats geometry and preserves legacy force and stage results',()=>{
  const legacy=E.auslegen({...base,iSW:5,iT:3});
  const explicit=E.auslegen({...base,iTyp:'hex',iSW:5,iT:3});
  const volume=Math.sqrt(3)/2*5**2*3;
  assert.equal(explicit.fehlt.length,0);
  close(explicit.antrieb.area,Math.sqrt(3)/2*25);
  close(explicit.antrieb.volume,volume);
  close(explicit.werte.V,gross-volume);
  close(explicit.werte.L0,(gross-volume)/A0);
  assert.deepEqual(explicit,legacy);
  close(explicit.werte.Fmax_t,16.822828284690583);
  assert.match(explicit.stufen.at(-1).v,/Innensechskant SW 5 mm, Tiefe 3 mm/);
});

test('none ignores stale hidden drive fields without cutting a phantom cavity',()=>{
  const a=E.auslegen({...base,iTyp:'none',iSize:'T20',iSW:5,iT:3,iVol:50});
  const plain=E.auslegen(base);
  assert.deepEqual(a,plain);
  assert.equal(a.antrieb,null);
  close(a.werte.V,gross);
});

for(const [family,size] of [['torx','T20'],['ph','PH2'],['pz','PZ2']]) {
  test(`${size}: size and stale hex SW never manufacture volume or force`,()=>{
    const e={...base,iTyp:family,iSize:size,iT:3,iSW:20};
    const before=JSON.stringify(e),a=E.auslegen(e);
    assert.equal(JSON.stringify(e),before);
    assert.equal(a.fehlt.length,0);
    assert.equal(a.antrieb.area,null);
    assert.equal(a.antrieb.volume,null);
    assert.equal(a.antrieb.volumeStatus,'missing');
    for(const key of ['V','L0','masse']) assert.equal(a.werte[key],null,key);
    totalsUnknown(a);
    assert.ok(a.stufen.length>=2);
    for(const stage of a.stufen) for(const key of ['F','t','p','pStempel','arm']) assert.equal(stage[key],null,key);
    const selection=E.waehle(machines,a,e);
    assert.equal(selection.passend.length,0);
    const candidate=selection.bedingt[0];
    assert.ok(candidate);
    assert.equal(candidate.k.find(x=>x.krit==='Abschnittlänge').status,'offen');
    const force=candidate.k.find(x=>x.krit==='Presskraft');
    assert.equal(force.status,'offen');
    assert.match(force.soll,/Innenantrieb/);
    assert.doesNotMatch(force.soll,/Fließkurve/,'known material curve is not falsely reported missing');
    const concept=E.maschinenKonzept(a,e,candidate.o);
    assert.equal(concept.status,'candidate');
    assert.equal(concept.blank,null);
    assert.equal(concept.drive.size,size);
    assert.ok(concept.stages.some(s=>s.operation.includes(size)));
    assert.match(concept.rationale,/Abschnittlänge offen/);
  });

  test(`${size}: supplied CAD volume determines blank but never a fabricated hex force`,()=>{
    const e={...base,iTyp:family,iSize:size,iT:3,iVol:42};
    const a=E.auslegen(e);
    assert.equal(a.fehlt.length,0);
    close(a.werte.V,gross-42);
    close(a.werte.L0,(gross-42)/A0);
    assert.equal(a.antrieb.area,null);
    assert.equal(a.antrieb.volumeStatus,'drawing-value');
    totalsUnknown(a);
    assert.ok(a.stufen[0].F>0,'earlier known operation remains useful');
    for(const key of ['F','t','p','pStempel','arm']) assert.equal(a.stufen.at(-1)[key],null,key);
    const machine=E.waehle(machines,a,e).bedingt[0].o;
    const concept=E.maschinenKonzept(a,e,machine);
    assert.equal(concept.status,'candidate');
    close(concept.blank.length,(gross-42)/A0);
  });
}

test('measured part mass resolves blank length without pretending to resolve drive forming force',()=>{
  const rho=E.WERKSTOFFE[base.wst].rho,partVolume=gross-42;
  const e={...base,iTyp:'ph',iSize:'PH2',iT:3,masse:partVolume*rho/1000};
  const a=E.auslegen(e);
  assert.equal(a.fehlt.length,0);
  close(a.werte.V,partVolume);
  close(a.werte.L0,partVolume/A0);
  close(a.werte.masse,e.masse);
  assert.equal(a.antrieb.volume,null,'profile remains unmeasured');
  totalsUnknown(a);
});

test('a hex drive extending through the head into the shaft stays representable',()=>{
  const a=E.auslegen({...base,kD:9,kH:1.45,sD:4.9,sL:7.65,d0:4.64,iTyp:'hex',iSW:4,iT:2.5});
  assert.equal(a.fehlt.length,0);
  assert.ok(a.werte.L0>0);
  assert.match(a.stufen.find(s=>s.v.includes('Innensechskant')).operations.at(-1).location,/in den Schaft/);
});

test('missing or contradictory drive geometry yields no usable calculation',()=>{
  for(const patch of [
    {iTyp:'unknown'}, {iTyp:'torx',iSize:'PH2',iT:3}, {iTyp:'ph',iSize:'PH5',iT:3},
    {iTyp:'pz',iSize:'PZ2'}, {iTyp:'hex',iT:3}, {iTyp:'hex',iSW:5},
    {iTyp:'hex',iSW:10,iT:3}, {iTyp:'hex',iSW:5,iT:36},
    {iTyp:'hex',iSW:5,iT:3,nD:3,nT:3},
    {iTyp:'ph',iSize:'PH2',iT:3,iVol:gross+1},
    {iTyp:'torx',iSize:'T20',iT:3,iVol:-1},
    {iTyp:'ph',iSize:'PH2',iT:3,masse:gross*E.WERKSTOFFE[base.wst].rho/1000+1}
  ]) {
    const a=E.auslegen({...base,...patch});
    assert.ok(a.fehlt.length,JSON.stringify(patch));
    assert.deepEqual(a.stufen,[]);
    assert.deepEqual(a.werte,{});
  }
});
