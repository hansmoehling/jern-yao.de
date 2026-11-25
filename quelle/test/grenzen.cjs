const assert = require('node:assert/strict');
const E = require('../engine.js');
const base = { typ: 'formteil', wst: 0, d0: 10, sD: 10, sL: 20, nD: 5, nT: 10 };
// Degenerate walls used to make the drawing agent hang in an unbounded loop.
for (const bad of [
  { ...base, nD: 10 }, { ...base, nD: 11 }, { ...base, nT: 20 },
  { ...base, nT: 30 }, { ...base, d0: Infinity }, { ...base, wst: 99 },
  { ...base, sD: 1e-200, nD: 0, nT: 0 },
  { typ: 'bolzen', wst: 0, d0: 10, sD: 10, sL: 20 },
  { typ: 'mutter', wst: 0, d0: 10, mSW: 16, mH: 8, mLoch: 16 }
]) {
  const result = E.auslegen(bad);
  assert.ok(result.fehlt.length, JSON.stringify(bad));
  assert.equal(result.stufen.length, 0);
}
const valid = E.auslegen(base);
assert.equal(valid.fehlt.length, 0);
assert.ok(valid.stufen.every(s => Number.isFinite(s.t)));
const under = E.auslegen({ ...base, vorgaben: { stationen: 1 } });
assert.ok(under.werte.stationen >= valid.werte.stationen);
console.log('9 ungueltige Geometrien abgefangen; gueltiger Napf und Stations-Untersteuerung geprueft.');
