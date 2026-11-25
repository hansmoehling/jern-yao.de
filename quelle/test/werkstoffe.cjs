'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const machines = require('../maschinen.json');
const q = path.join(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(q, 'werkstoffe-recherche.json'), 'utf8'));
assert.equal(source.materials.length, 58);
for (const item of source.materials) {
  assert.ok(E.WERKSTOFFE.some(m => m.sourceName === item.name && m.number === item.number), item.name + ' missing');
}
assert.equal(E.findMaterial('C35'), null, 'C35 is not C35EC');
assert.equal(E.findMaterial('not-a-grade'), null);
assert.equal(E.findMaterial('1.4301').id, '1.4301 (A2)');
assert.equal(E.findMaterial('C10C').id, 'C10C');
const uncurved = E.WERKSTOFFE.findIndex(m => m.curveStatus === 'missing');
assert.ok(uncurved >= 0);
const e = { typ: 'bolzen', wst: uncurved, d0: 7.6, kD: 17, kH: 6, sD: 7.2, sL: 40 };
const a = E.auslegen(e);
assert.equal(a.fehlt.length, 0);
assert.ok(a.stufen.length > 0 && a.werte.L0 > 0);
for (const field of ['Fmax_t', 'Fsum_t', 'FN_muss_t', 'FN_wunsch_t']) assert.equal(a.werte[field], null, field);
for (const s of a.stufen) for (const field of ['F', 't', 'p', 'pStempel', 'arm']) assert.equal(s[field], null, field);
const candidates = E.waehle(machines, a, e);
assert.equal(candidates.passend.length, 0, 'No unqualified machine suitability without force evidence');
assert.ok(candidates.bedingt.length > 0, 'Geometric candidates remain useful');
for (const row of candidates.bedingt) {
  assert.equal(row.ausl, null);
  assert.equal(row.k.find(k => k.krit === 'Presskraft').status, 'offen');
}
const changedRm = E.auslegen({ ...e, rm: 600 });
assert.equal(changedRm.werte.Fmax_t, null, 'Rm must not fabricate a flow curve');
assert.equal(changedRm.werte.L0, a.werte.L0);
const noDensity = E.WERKSTOFFE.findIndex(m => m.rho === null);
if (noDensity >= 0) {
  const geometric = E.auslegen({ ...e, wst: noDensity });
  assert.equal(geometric.werte.masse, null);
  assert.ok(geometric.werte.L0 > 0);
  assert.ok(E.auslegen({ ...e, wst: noDensity, masse: 10 }).fehlt.length);
}
for (const m of E.WERKSTOFFE) {
  assert.equal(m.C, null, 'legacy C is never an active flow model');assert.equal(m.n, null, 'legacy n is never an active flow model');assert.equal(m.Rm,null,'unverified legacy wire Rm is not reused');
  assert.equal(m.manualEligible,!!m.flowCurves.length);
  for(const curve of m.flowCurves){assert.equal(curve.eligible,true);assert(curve.materialNumbers.includes(m.number),'exact material identity');assert(curve.sourceIds.length>0);assert(curve.sourceRefs.length===curve.sourceIds.length);assert(curve.state);assert(curve.phiMax>curve.phiMin);}
  if (m.densityStatus === 'sourced') assert.ok(m.densitySource.sourceUrl);
}
console.log('PASS: 58 source identities, exact grade/curve lookup, approved Manual conditions, nullable forces, Rm isolation, geometric candidates and density restrictions');
