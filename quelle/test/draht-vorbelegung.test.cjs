const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const W = require('../vorbelegung/draht.js');
const data = require('../vorbelegung/draht.json');
const source = fs.readFileSync(path.join(__dirname, '../vorbelegung/draht.js'), 'utf8');
const values = list => list.map(item => item.value);
const browser = config => { const context = { window: {} }; vm.runInNewContext(source.replace('/*WIRE_PRESETS_BEGIN*/null/*WIRE_PRESETS_END*/', JSON.stringify(config)), context); return context.window.JYWireDefaults; };

test('full-thread wire proposals use explicit reduction, include the thinner route, and never overwrite customer input', () => {
  const input = Object.freeze({ typ: 'bolzen', standardKind: 'screw', sD: 5.27, d0: 8 });
  const result = W.candidates(input);
  assert.deepEqual(values(result), [5.6, 5.3, 5.7]); assert.equal(input.d0, 8);
  assert(result.every(item => item.origin === 'assumption' && item.provisional === true && item.params.step === .1));
  assert.equal(result[0].params.reduction, 10); assert.equal(result[1].reason, 'Dünnerer Draht: mehr Staucharbeit prüfen');
  assert.deepEqual(result.map(item=>item.route.upsetting), ['baseline','increased','reduced']);
  assert.equal(result[1].route.wireConditionAdvice, 'Mehr Aufstauchen: geglühten Draht vorsehen.');
  assert.equal(result[2].route.wireConditionAdvice, 'Mehr Reduzieren: Glühen ist weniger bestimmend; Lieferzustand mitführen.');
  assert(!JSON.stringify(result).includes('station'), 'no extra station count is invented');
});

test('catalogue cutoff steps target a thinner alternative without claiming machine suitability', () => {
  const input = { typ: 'bolzen', sD: 5.27 };
  assert.deepEqual(values(W.candidates(input, null, [{ cd: 5 }, { cd: 8 }])), [5.6, 5.3, 5.7]);
  const result = W.candidates(input, null, [{ cd: 5.5 }, { cd: 5.4 }, { cd: '5.55' }, { cd: Infinity }]);
  assert.deepEqual(values(result), [5.6, 5.5, 5.7]); assert.equal(result[1].params.catalogueCutoff, 5.5);
  assert(result.every(item => item.value >= input.sD));
});

test('partial-thread and plain shafts use their own diameter; shaft upsetting is outside this bolt-model proposal', () => {
  for (const extra of [{ shaftType: 'partial' }, { standardReference:'ISO4014' }, { b: 20, sL: 30, ds: 8 }, { standardKind: 'rivet' }, { standardKind: 'pin' }, { threadFamily: 'none' }]) {
    const result = W.candidates({ typ: 'bolzen', sD: 8, ...extra }, null, [{ cd: 7 }]);
    assert.deepEqual(values(result), [8, 8.1]);
  }
  assert.equal(W.candidates({ typ: 'bolzen', sD: 8, b: 30, sL: 30, ds: 8 })[0].value, 8.5);
  assert.deepEqual(W.candidates({ typ: 'bolzen', shaftType: 'partial', ds: 8 }), []);
});

test('nut choices stay inside the stated band and actual half-millimetre grid', () => {
  assert.deepEqual(values(W.candidates({ typ: 'mutter', mSW: 16 })), [13, 12.5, 13.5]);
  assert.deepEqual(values(W.candidates({ typ: 'mutter', mSW: 16 }, null, [{ cd: 12 }, { cd: 10 }])), [13, 12, 13.5]);
  for (const acrossFlats of [1, 2, 5.5, 8, 16, 30]) {
    const result = W.candidates({ typ: 'mutter', mSW: acrossFlats });
    assert(result.every(item => item.value >= .75 * acrossFlats && item.value <= .85 * acrossFlats && Number.isInteger(item.value * 2)));
    assert.equal(new Set(values(result)).size, result.length);
  }
});

test('formed parts use the longest additive cylinder and return no invented diameter for other shapes', () => {
  const elements = [
    { operation: 'add', shape: 'cylinder', length: 5, diameter: 12 },
    { operation: 'add', shape: 'cylinder', length: 30, diameter: 8 },
    { operation: 'subtract', shape: 'cylinder', length: 100, diameter: 3 },
    { operation: 'add', shape: 'cone', length: 200, diameter: 20 }
  ];
  assert.deepEqual(values(W.candidates({ typ: 'formteil' }, { elements })), [8, 7.9, 8.1]);
  assert.deepEqual(values(W.candidates({ typ: 'formteil' }, { elements }, [{ cd: 7 }])), [8, 7, 8.1]);
  assert.deepEqual(W.candidates({ typ: 'formteil', sD: 8 }, { elements: [elements[2], elements[3]] }), []);
});

test('missing, nonfinite and coerced inputs fail closed; browser and Node share the supplied policy', () => {
  for (const bad of [undefined, null, '', '5.27', -1, 0, NaN, Infinity]) {
    assert.deepEqual(W.candidates({ typ: 'bolzen', sD: bad }), []);
    assert.deepEqual(W.candidates({ typ: 'mutter', mSW: bad }), []);
  }
  assert.deepEqual(W.candidates({}), []); assert.deepEqual(W.candidates(null), []);
  assert.equal(JSON.stringify(browser(data).candidates({ typ: 'bolzen', sD: 5.27 })), JSON.stringify(W.candidates({ typ: 'bolzen', sD: 5.27 })));
  for (const invalid of [null, { ...data, wireStepMm: 0 }, { ...data, fullThreadAreaReduction: 1 }, { ...data, nut: { ...data.nut, targetAcrossFlatsRatio: .9 } }, { ...data, nut: { ...data.nut, targetAcrossFlatsRatio: '.8' } }]) {
    assert.equal(browser(invalid).candidates({ typ: 'bolzen', sD: 5.27 }).length, 0);
  }
  assert.equal(data.status, 'provisional'); assert.equal(data.wireStepSource.confirmedStockSeries, false);
});

test('every reason has four translations with the same numeric placeholders', () => {
  const translations = require('../i18n-wire-defaults.json');
  const samples = [W.candidates({ typ: 'bolzen', sD: 5.27 }), W.candidates({ typ: 'bolzen', sD: 8, shaftType: 'partial' }), W.candidates({ typ: 'bolzen', sD: 4, standardKind: 'rivet' }), W.candidates({ typ: 'mutter', mSW: 16 }), W.candidates({ typ: 'formteil' }, { elements: [{ operation: 'add', shape: 'cylinder', length: 30, diameter: 8 }] })].flat();
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const item of samples) {
    assert.equal(translations[item.reason]?.length, 4, item.reason);
    assert.equal(translations[item.route.wireConditionAdvice]?.length, 4, item.route.wireConditionAdvice);
    for (const text of translations[item.reason]) assert.deepEqual(placeholders(text), placeholders(item.reason));
    for (const key of placeholders(item.reason)) assert(Object.hasOwn(item.params, key));
  }
});
