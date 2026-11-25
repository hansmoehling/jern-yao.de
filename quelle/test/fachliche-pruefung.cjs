'use strict';

// Deterministische Regression; KEINE Evaluation einer KI-Antwort.
// Aufruf vom Repo: node quelle/test/fachliche-pruefung.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const enginePath = path.join(__dirname, '..', 'engine.js');
const engineSource = fs.readFileSync(enginePath, 'utf8');
const machines = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'maschinen.json'), 'utf8'));
const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'agentische-prueffaelle.json'), 'utf8'));
const context = vm.createContext({ module: { exports: {} }, input: null });
vm.runInContext(engineSource, context, { timeout: 1500 });
const E = context.module.exports;
const W = id => {
  const index = E.WERKSTOFFE.findIndex(w => w.id === id);
  assert.ok(index >= 0, 'Werkstoff muss ausdrücklich im Kern vorhanden sein: ' + id);
  return index;
};
const calculate = input => {
  context.input = input;
  // Auch bei einer Regression zu einer Endlosschleife muss der Test abbrechen.
  return vm.runInContext('module.exports.auslegen(input)', context, { timeout: 1500 });
};
const close = (actual, expected, label, tolerance = 1e-8) => {
  assert.ok(Number.isFinite(actual), label + ' muss endlich sein');
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} statt ${expected}`);
};
let passed = 0;
const test = (name, action) => {
  try { action(); passed++; console.log('PASS ' + name); }
  catch (error) { console.error('FAIL ' + name + ': ' + error.message); process.exitCode = 1; }
};
const assertRejected = input => {
  const result = calculate(input);
  assert.ok(result.fehlt.length > 0, 'Ungültige Eingabe muss als unvollständig/ungültig zurückkommen');
  assert.equal(result.stufen.length, 0, 'Keine nutzbare Folge bei ungültiger Eingabe');
  assert.equal(Object.keys(result.werte).length, 0, 'Keine scheinbar gültigen Ergebniswerte');
};
const cup = { typ: 'formteil', wst: W('C10C'), d0: 10, sD: 10, sL: 30, nD: 5, nT: 20 };

for (const [name, input] of [
  ['P0: Beschreibung fehlt', null],
  ['P0: Drahtdurchmesser fehlt', { ...cup, d0: undefined }],
  ['P0: Napf ohne Restwand', { ...cup, nD: 10 }],
  ['P0: Napf größer als Außenkontur', { ...cup, nD: 11 }],
  ['P0: Sackloch ohne Restboden', { ...cup, nT: 30 }],
  ['P0: Napf tiefer als Teil', { ...cup, nT: 31 }],
  ['P0: Nicht endlicher Durchmesser', { ...cup, d0: Infinity }],
  ['P0: NaN im Maß', { ...cup, sL: NaN }],
  ['P0: Negatives Maß', { ...cup, nT: -1 }],
  ['P0: Extreme Reduktion numerisch begrenzen', { typ: 'bolzen', wst: W('C10C'), d0: 10, kD: 15, kH: 5, sD: 1e-200, sL: 20 }],
  ['P0: Extrem viele Napfhübe begrenzen', { ...cup, sL: 10000, nD: 0.01, nT: 9000 }],
  ['P0: Mutterloch außerhalb der Kontur', { typ: 'mutter', wst: W('C10C'), d0: 13, mSW: 16, mH: 8, mLoch: 16 }],
  ['P0: Widersprüchliche Flanschhöhe', { typ: 'mutter', wst: W('C10C'), d0: 13, mSW: 16, mH: 8, mLoch: 8.4, mFlansch: 20, mFlanschH: 9 }],
  ['P1: Kein stiller Ersatz für unbekannten Werkstoff', { ...cup, wst: 999 }],
  ['P1: Fehlender Werkstoff ist kein C10C', { ...cup, wst: undefined }],
  ['P1: Bruchindex ist kein gültiger Werkstoff', { ...cup, wst: 0.5 }],
  ['P1: Bloßer Abschnitt ist keine Umformfolge', { typ: 'bolzen', wst: W('C10C'), d0: 10, sD: 10, sL: 30 }]
]) test(name, () => assertRejected(input));

test('P0: Gültiger Napf bleibt berechenbar', () => {
  const a = calculate(cup);
  assert.equal(a.fehlt.length, 0);
  assert.ok(a.stufen.length > 0 && a.stufen.length < 100);
  for (const s of a.stufen) {
    assert.ok(Number.isFinite(s.F) && s.F > 0);
    close(s.t, s.F / 1000 / 9.80665, 'N nach tf');
  }
  for (const key of ['L0', 'V', 'Fmax_t', 'Fsum_t']) assert.ok(Number.isFinite(a.werte[key]) && a.werte[key] > 0, key);
});

test('P1: Vier Stufen lassen sich nicht auf eine heruntersetzen', () => {
  const input = { typ: 'bolzen', wst: W('20MnB4'), d0: 8, kopfForm: 'rund', kD: 24, kH: 10, sD: 8, sL: 40 };
  const reference = calculate(input);
  const under = calculate({ ...input, vorgaben: { stationen: 1 } });
  assert.equal(reference.stufen.length, 4);
  assert.equal(under.stufen.length, 4);
  assert.equal(under.werte.stationen, 4);
  assert.equal(under.werte.stationenReserve, 5);
  close(under.werte.Fmax_t, reference.werte.Fmax_t, 'Stationsvorgabe verändert die Kraft nicht');
  assert.ok(under.hinweise.some(x => /Stationsvorgabe/i.test(x)));
  assert.equal(calculate({ ...input, vorgaben: { stationen: 4.2 } }).werte.stationen, 5);
});

// Präzise Baselines der ursprünglichen neutralen Kernreferenzen aus faelle.js.
// Nur Geometrien, numerische Ergebnisse und Modellnamen, keine Kundendaten.
const references = [
  { id: 'REF-M8', e: { typ: 'bolzen', wst: W('23MnB4'), d0: 7.6, kopfForm: 'rund', kD: 17, kH: 6, sD: 7.2, sL: 40 }, stages: 2, L0: 65.92105263157896, mass: 23.475284068574176, Fmax: 38.300230226060435, Fsum: 51.27174665655478, stageForces: [127207.12160310739, 375596.95274639555], model: 'JBF-17B3S' },
  { id: 'REF-M6', e: { typ: 'bolzen', wst: W('33B2'), d0: 5.6, kopfForm: 'rund', kD: 10, kH: 6, sD: 5.4, sL: 30, iSW: 5, iT: 3 }, stages: 2, L0: 44.39096510480647, mass: 8.58282345284358, Fmax: 16.822828284690583, Fsum: 22.720364120176477, stageForces: [57835.06980106775, 164975.58899806088], model: 'JBF-10B3S' },
  { id: 'REF-NUT', e: { typ: 'mutter', wst: W('C10C'), d0: 13, mSW: 16, mH: 8, mLoch: 8.4 }, stages: 5, L0: 11.775829323358934, mass: 10.442686002656117, Fmax: 26.58590709122195, Fsum: 69.19563325408474, stageForces: [92206.91259422291, 199019.02469570655, 260718.68577613172, 56777.13690038812, 69855.59688472078], model: 'JNF-17B6S' }
];
for (const r of references) test(r.id + ': ursprüngliche Kräfte, Volumen und Katalogauswahl', () => {
  const a = calculate(r.e);
  assert.equal(a.fehlt.length, 0);
  assert.equal(a.stufen.length, r.stages);
  assert.equal(a.werte.stationen, r.stages);
  close(a.werte.L0, r.L0, 'Abschnittlänge mm');
  close(a.werte.masse, r.mass, 'Masse g');
  close(a.werte.Fmax_t, r.Fmax, 'Höchste Stationskraft tf');
  close(a.werte.Fsum_t, r.Fsum, 'Summe tf');
  a.stufen.forEach((s, i) => close(s.F, r.stageForces[i], 'Stationskraft N ' + i, 1e-6));
  const catalog = machines.find(m => m.m === r.model);
  assert.ok(catalog, 'Referenzmodell muss unverändert aus maschinen.json stammen');
  const selected = E.waehle(machines, a, r.e);
  assert.ok(selected.passend.length > 0);
  assert.equal(selected.passend[0].o.m, catalog.m);
  close(selected.passend[0].ausl, r.Fmax / catalog.pw, 'Auslastung mit echter Katalognennkraft');
});

test('Einheiten: Rohkraft ist N, Ausgabe ist metrische tf', () => {
  const a = calculate(references[0].e);
  close(E.G, 9.80665, 'kN/tf');
  close(a.stufen[1].F / 1000, 375.59695274639555, 'kN');
  close(a.stufen[1].t * E.G, a.stufen[1].F / 1000, 'tf zu kN');
});

test('Modellgrenze: Rm-Override ist keine neue Fließkurve', () => {
  const e = references[0].e;
  const a = calculate(e), b = calculate({ ...e, rm: 800 });
  assert.equal(b.werkstoff.Rm, 800);
  close(b.werte.Fmax_t, a.werte.Fmax_t, 'Dokumentierte konstante Modellkraft');
  // Kein Eignungsurteil: Lieferzustand/Fließkurve müssen im Agenten geklärt werden.
});

test('Sechs Eval-Szenarien sind vollständig und ausdrücklich nicht ausgeführt', () => {
  assert.equal(scenarios.evaluation_status, 'not_run');
  assert.equal(scenarios.scenarios.length, 6);
  assert.equal(new Set(scenarios.scenarios.map(s => s.id)).size, 6);
  for (const s of scenarios.scenarios) {
    assert.ok(s.prompt && s.required_checks.length >= 3 && s.forbidden_claims.length >= 3, s.id);
    assert.ok(s.source_ids.every(id => Object.hasOwn(scenarios.source_ids, id)), s.id);
  }
  const get = id => scenarios.scenarios.find(s => s.id === id).expected_values;
  const unit = get('AG-QA-02');
  close(unit.diameter_mm, 0.012 * 1000, 'm nach mm');
  close(unit.length_mm, 0.04 * 1000, 'm nach mm');
  close(unit.mass_g, 0.018 * 1000, 'kg nach g');
  close(unit.force_tf, unit.force_kN / 9.80665, 'kN nach tf');
  close(unit.force_N, unit.force_kN * 1000, 'kN nach N');
  const load = get('AG-QA-03');
  close(load.maximum_station_ratio, Math.max(...load.station_peak_ratios), 'Einzelmaximum');
  close(load.sum_of_station_peak_ratios, load.station_peak_ratios.reduce((x, y) => x + y, 0), 'Lastsumme');
  assert.equal(load.actual_simultaneous_peak_ratio, null);
  const intermediate = get('AG-QA-04');
  close(intermediate.intermediate_minus_blank_mm, intermediate.longest_supplied_intermediate_length_mm - intermediate.blank_length_mm, 'Zwischenlängendifferenz');
  assert.equal(intermediate.required_KO_mm, null);
  assert.equal(intermediate.required_PKO_mm, null);
});

console.log(JSON.stringify({
  deterministic_tests_passed: passed,
  success: !process.exitCode,
  engine_sha256: crypto.createHash('sha256').update(engineSource).digest('hex'),
  catalog_sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'maschinen.json'))).digest('hex'),
  model_evaluation: 'not_run',
  model_scenarios_prepared: scenarios.scenarios.length,
  limitations: ['Keine Modellantworten bewertet', 'Kein Prozessfähigkeitsnachweis', 'R-PK, K34 und K23 benötigen weiterhin fachliche Agentenprüfung']
}, null, 2));
