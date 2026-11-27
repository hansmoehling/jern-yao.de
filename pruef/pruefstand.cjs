// Prüfstand für den Konfigurator ohne Browser.
// Aufruf: node pruefstand.cjs <Pfad zum jern-yao.de-Checkout>
// Baut je Fall dieselbe Eingabe, die archiv-ui.js nach Normwahl erzeugt
// (kvp-v1, ranking-v2, force-v2, rm-v2), rechnet E.auslegen und E.waehle
// und druckt Empfehlung, Alternativen, Klassen und offene Prüfungen.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const Q = path.join(ROOT, 'quelle');
const E = require(path.join(Q, 'engine.js'));
const N = require(path.join(Q, 'normen', 'library.js'));
const R = require(path.join(Q, 'normen', 'resolver.js'));
const W = require(path.join(Q, 'vorbelegung', 'draht.js'));
const MR = require(path.join(Q, 'machine-ranking.js'));
const index = JSON.parse(fs.readFileSync(path.join(Q, 'normen', 'index.json'), 'utf8'));
const families = index.families.map(f => JSON.parse(fs.readFileSync(path.join(Q, 'normen', f.file), 'utf8')));
const data = { schemaVersion: 1, version: index.version, families,
  threads: JSON.parse(fs.readFileSync(path.join(Q, 'normen', 'gewinde.json'), 'utf8')),
  materials: JSON.parse(fs.readFileSync(path.join(Q, 'vorbelegung', 'werkstoff.json'), 'utf8')) };
const MASCHINEN = JSON.parse(fs.readFileSync(path.join(Q, 'maschinen.json'), 'utf8'));
const PRAXIS = JSON.parse(fs.readFileSync(path.join(Q, 'praxis.json'), 'utf8'));
const variants = E.WERKSTOFFE.flatMap((material, index) => (material.manualEligible ? material.flowCurves || [] : [])
  .filter(c => c.eligible === true && ['literature', 'proxy'].includes(c.approval))
  .map(curve => ({ index, material, curve })));

function build(selection, opts = {}) {
  const fam = data.families.find(f => f.id === selection.id);
  const doc = R.resolveStandard(N.selectionLibrary(data, selection), selection, {});
  const p = N.adapt(data, doc);
  const kind = N.familyKind(fam) === 'nut' ? 'nut' : p.standardKind;
  const rule = data.materials.rules.find(r => r.kind === kind && r.classes.includes(p.propertyClass));
  const v = rule && variants.find(v => v.material.id === rule.materialId && v.curve.state === rule.state)
    || variants.find(v => v.material.id === 'C4C' && v.curve.state === 'soft-annealed');
  const isNut = kind === 'nut';
  const e = { typ: isNut ? 'mutter' : 'bolzen', wst: v.index, curveId: v.curve.id, materialState: v.curve.state, rm: opts.rm,
    machinePolicy: 'ranking-v2', forcePolicy: 'force-v2', rmPolicy: E.RM_POLICY_VERSION_V2, inputOrigins: { d0: { origin: 'assumption', provisional: true } },
    standardKind: isNut ? undefined : p.standardKind || 'screw',
    threadFamily: isNut ? undefined : (['rivet', 'pin'].includes(p.standardKind) ? 'none' : 'metric'),
    wirePreparation: 'as-supplied',
    kopfForm: p.kopfForm, kopfTyp: p.kopfTyp || (p.kopfForm === 'rund' ? 'zylinder' : p.kopfForm),
    kD: p.kD, kSW: p.kSW, kH: p.kH, kC: p.kC, capHeight: p.capHeight, flangeDiameter: p.flangeDiameter, flangeHeight: p.flangeHeight,
    sD: p.sD, sL: opts.sL ?? p.sL, schaftende: p.schaftende || 'voll', d_b: p.d_b, t_b: p.t_b, bottomShape: 'cone', bottomAngle: 120, boreDepthMode: 'total',
    iTyp: p.iTyp || 'none', iSize: p.iSize, iSW: p.iSW, iT: p.iT, iVol: p.iVol,
    mM: p.mM, mSW: p.mSW, mH: p.mH, mLoch: p.mLoch, nutModelVersion: 'nut-model-v1', nutShape: p.nutShape || 'hex', mFlansch: p.mFlansch, mFlanschH: p.mFlanschH,
    masse: undefined, wenden: false, vorgaben: {}, soll: { ausbringung: opts.ausbringung },
    standardReference: p.standardReference, standardDocument: p.standardDocument, threadModel: p.threadModel, propertyClass: p.propertyClass,
    normGeometryStatus: p.normGeometryStatus, normMissingFields: p.normMissingFields, normRequiresGeometryReview: p.normRequiresGeometryReview };
  if (e.iTyp !== 'hex') e.iSW = undefined;
  if (e.iTyp === 'hex' || e.iTyp === 'none') e.iVol = undefined;
  if (e.iTyp === 'hex') e.iSize = undefined;
  if (e.typ !== 'bolzen' || e.iTyp === 'none') { e.iTyp = 'none'; e.iSize = e.iSW = e.iT = e.iVol = undefined; }
  const cands = W.candidates(e, null, MASCHINEN, { evaluate: E.auslegen }) || [];
  e.d0 = opts.d0 ?? cands[0]?.value;
  return { e, p, cands, material: v, rule };
}

function run(label, selection, opts = {}) {
  const { e, p, cands, material, rule } = build(selection, opts);
  const aus = E.auslegen(e);
  console.log('\n######## ' + label);
  console.log('Vorbelegung:', Object.keys(p).filter(k => p[k] != null && typeof p[k] !== 'object').map(k => k + '=' + p[k]).join(' '));
  console.log('offene Normfelder:', p.normMissingFields, '| Werkstoff:', material.material.id, material.curve.state, '| Regel:', rule && rule.materialId,
    '| Drahtkandidaten:', cands.map(c => c.value).join(', '));
  console.log('fehlt:', aus.fehlt, '| Stufen:', aus.stufen.length, '| d0:', e.d0, '| L0:', aus.werte.L0 && aus.werte.L0.toFixed(2),
    '| Fmax_t:', aus.werte.Fmax_t && aus.werte.Fmax_t.toFixed(1), '| Rm:', aus.werkstoff?.Rm, '| Rm-Vorbelegung:', aus.werkstoff?.rmVorbelegung?.status,
    '| materialStatus:', JSON.stringify(aus.materialStatus));
  console.log('Stadien:', aus.stufen.map(s => s.v + (s.F == null ? ' [Kraft offen]' : ' [' + s.t.toFixed(2) + ' t; ' + (s.forceStatus || 'calculated') + (s.forceBand?.t ? '; Band ' + s.forceBand.t.min.toFixed(2) + '–' + s.forceBand.t.max.toFixed(2) + ' t' : '') + ']')).join(' | '));
  if (aus.fehlt.length || !aus.stufen.length) return;
  const wahl = E.waehle(MASCHINEN, aus, e, PRAXIS), rk = wahl.ranking;
  console.log('geprüft:', rk.checkedCount, '| fähig:', rk.candidates.length, '| ok:', wahl.passend.length, '| bedingt:', wahl.bedingt.length, '| Basis:', rk.rankingBasis);
  const show = r => r.o.m + ' [' + r.gesamt + ' Klasse ' + (r.ranking.classification || '-') + ' sz ' + (r.o.sz || '-') + ' rp ' + r.o.rp + ']'
    + ' knapp: ' + r.k.filter(c => c.status === 'knapp').map(c => c.krit).join(', ') + ' | offen: ' + r.k.filter(c => c.status === 'offen').map(c => c.krit).join(', ');
  console.log('EMPFEHLUNG:', rk.recommendation && show(rk.recommendation));
  rk.alternatives.forEach((r, i) => {
    const c = MR.compareVariants(rk.recommendation.o, r.o, { practice: PRAXIS, demandPerMinute: e.soll.ausbringung });
    console.log('ALT' + (i + 1) + ':', show(r), '| Preis', c.price && (c.price.direction + ' ' + c.price.percent + ' %'), '| Effizienz', c.efficiency && (c.efficiency.direction + ' ' + c.efficiency.percent + ' %'));
  });
  const byClass = { A: [], B: [], C: [] };
  for (const r of rk.candidates) if (byClass[r.ranking.classification]) byClass[r.ranking.classification].push(r.o.m + '/' + r.o.rp);
  console.log('Klasse A nach Preis:', byClass.A.slice(0, 6).join(' '));
  console.log('Klasse B nach Preis:', byClass.B.slice(0, 6).join(' '));
  return { e, aus, wahl };
}

const FAELLE = [
  ['K1 ISO 4762 M6 x 30 8.8', { id: 'ISO4762', groesse: 'M6', laenge: 30, festigkeitsklasse: '8.8' }],
  ['ISO 4017 M8 x 40 8.8', { id: 'ISO4017', groesse: 'M8', laenge: 40, festigkeitsklasse: '8.8' }],
  ['ISO 4014 M12 x 80 8.8', { id: 'ISO4014', groesse: 'M12', laenge: 80, festigkeitsklasse: '8.8' }],
  ['ISO 10642 M6 x 20 10.9', { id: 'ISO10642', groesse: 'M6', laenge: 20, festigkeitsklasse: '10.9' }],
  ['ISO 7380-1 M5 x 12 10.9', { id: 'ISO7380-1', groesse: 'M5', laenge: 12, festigkeitsklasse: '10.9' }],
  ['K2 DIN 6791 4 x 12 Stahl', { id: 'DIN6791', groesse: '4', laenge: 12, festigkeitsklasse: 'Stahl' }],
  ['K3 DIN 660 4 x 10 Stahl', { id: 'DIN660', groesse: '4', laenge: 10, festigkeitsklasse: 'Stahl' }],
  ['K4 ISO 4032 M10 Kl. 8', { id: 'ISO4032', groesse: 'M10', festigkeitsklasse: '8' }],
  ['K5 ISO 4032 M20 Kl. 8', { id: 'ISO4032', groesse: 'M20', festigkeitsklasse: '8' }],
  ['K6 ISO 4161 M8 Kl. 8', { id: 'ISO4161', groesse: 'M8', festigkeitsklasse: '8' }]
];
if (require.main === module) for (const [label, selection] of FAELLE) run(label, selection);
module.exports = { run, build, FAELLE, E, N, R, W, MR, data, MASCHINEN, PRAXIS };
