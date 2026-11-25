const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../geometry-model.js');
const spec = (elements, trimming = []) => ({ version: 1, coordinateSystem: 'tool-parting-plane', elements, trimming });
const cyl = (id, diameter = 8, length = 12, extra = {}) => ({ id, operation: 'add', shape: 'cylinder', side: 'die', start: 0, length, diameter, ...extra });
const hex = (id, acrossFlats = 6, length = 12, extra = {}) => ({ id, operation: 'add', shape: 'hex', side: 'die', start: 0, length, acrossFlats, ...extra });
const cone = (id, diameter, diameterEnd, length, extra = {}) => ({ ...cyl(id, diameter, length), shape: 'cone', diameterEnd, ...extra });
const trim = (id, angleDeg, distance, length = 12, extra = {}) => ({ id, side: 'die', start: 0, length, angleDeg, distance, ...extra });
const close = (actual, expected, relative = 1e-12) => assert(Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
const bounded = (result, expected) => { assert.equal(result.valid, true); assert.equal(result.volumeStatus, 'bounded'); assert.equal(result.volumeMm3, null); assert(result.volumeBoundsMm3[0] <= expected && result.volumeBoundsMm3[1] >= expected, `${result.volumeBoundsMm3} excludes ${expected}`); };
const circleOverlap = (r, distance) => 2 * r * r * Math.acos(distance / (2 * r)) - distance * Math.sqrt(4 * r * r - distance * distance) / 2;

test('strict schema: limits, enums, IDs, field allowlist, no coercion or trust flags', () => {
  const good = spec([cyl('body')]); assert.equal(G.validateGeometrySpec(good).valid, true);
  for (const bad of [null, {}, { ...good, version: 2 }, { ...good, approval: true }, spec([]), spec([cyl('x'), cyl('x')]), spec([cyl('x', '8')]), spec([cyl('x', Infinity)]), spec([cyl('x', 8, 0)]), spec([cyl('x', 8, 2, { side: 'head' })]), spec([cyl('x', 8, 2, { start: -1 })]), spec([cyl('x', 8, 2, { start: 999 })]), spec([cyl('x', 8, 2, { offsetY: 1001 })]), spec([cyl('x', 8, 2, { forceApproved: true })]), spec([cyl('x', 8, 2, { operation: 'intersection' })]), spec([cyl('x', 8, 2, { diameterEnd: 5 })]), spec([cyl('h', 4, 2, { operation: 'subtract' })]), spec(Array.from({ length: 33 }, (_, i) => cyl('b' + i)))]) {
    const r = G.validateGeometrySpec(bad); assert.equal(r.ok, false); assert.equal(r.spec, null); assert(r.errors.length);
  }
  const normalized = G.normalize(good); assert.equal(normalized.elements[0].offsetX, 0); assert.equal(normalized.elements[0].offsetY, 0); assert.equal(good.elements[0].offsetX, undefined);
});

test('cylinder: exact mm3, correct g/cm3 conversion and equal-diameter cutoff length', () => {
  const r = G.evaluate(spec([cyl('body')]), { densityGcm3: 7.85, wireDiameterMm: 8 });
  close(r.volumeMm3, 192 * Math.PI); close(r.massG, 192 * Math.PI * .00785); close(r.blankLengthMm, 12);
  assert.equal(r.volumeStatus, 'exact'); assert.deepEqual(r.volumeBoundsMm3, [r.volumeMm3, r.volumeMm3]);
  assert.deepEqual(r.numericEligibility, { forces: false, machines: false, reason: 'process-model-required' });
  assert.equal(r.topology.singleSolid, 'confirmed'); assert.equal(r.calculation.cells, 0);
});

test('punch and die share the parting plane; offset stepped shank is not forced into a head schema', () => {
  const r = G.evaluate(spec([cyl('p', 8, 5, { side: 'punch' }), cyl('d', 6, 9, { offsetX: .5 })]));
  close(r.volumeMm3, Math.PI * (16 * 5 + 9 * 9)); assert.equal(r.envelope.minZ, -5); assert.equal(r.envelope.maxZ, 9);
  assert.equal(r.topology.hasEccentricity, true); assert.equal(r.topology.singleSolid, 'confirmed');
  assert(r.operations.some(op => op.code === 'eccentric-forming')); assert(!JSON.stringify(r.operations).includes('head'));
});

test('regular hex area and contained head/socket booleans are analytic', () => {
  close(G.evaluate(spec([hex('solid')])).volumeMm3, Math.sqrt(3) / 2 * 36 * 12);
  const insideHex = G.evaluate(spec([cyl('body'), hex('socket', 4, 4, { operation: 'subtract' })]));
  close(insideHex.volumeMm3, 192 * Math.PI - Math.sqrt(3) / 2 * 16 * 4);
  const insideCircle = G.evaluate(spec([hex('body'), cyl('hole', 4, 8, { operation: 'subtract' })]));
  close(insideCircle.volumeMm3, Math.sqrt(3) / 2 * 36 * 12 - 4 * Math.PI * 8);
});

test('overlapping additions are united, repeated holes subtracted once, outside cuts ignored', () => {
  const elements = [cyl('outer'), cyl('duplicate'), cyl('overlap', 6, 8, { start: 6 }), cyl('hole', 2, 20, { operation: 'subtract' }), cyl('same-hole', 2, 20, { operation: 'subtract' }), cyl('remote', 4, 12, { operation: 'subtract', offsetX: 20 })];
  const r = G.evaluate(spec(elements)); close(r.volumeMm3, Math.PI * (16 * 12 + 9 * 2 - 14));
  close(G.evaluate(spec(elements.slice().reverse())).volumeMm3, r.volumeMm3);
});

test('cone, frustum and crossing radial envelopes integrate their true Boolean sections', () => {
  close(G.evaluate(spec([cone('tip', 6, 0, 9)])).volumeMm3, 27 * Math.PI);
  close(G.evaluate(spec([cone('frustum', 2, 6, 2, { side: 'punch' })])).volumeMm3, 26 * Math.PI / 3);
  close(G.evaluate(spec([cone('up', 2, 6, 2), cone('down', 6, 2, 2)])).volumeMm3, 38 * Math.PI / 3);
  close(G.evaluate(spec([cyl('outer', 6, 2), cone('hole', 2, 6, 2, { operation: 'subtract' })])).volumeMm3, 28 * Math.PI / 3);
});

test('an inward punch-side centre recess opens at z=-4 and reaches its zero-diameter tip at z=-2', () => {
  const recess=cone('centre',0,4,2,{side:'punch',start:2,operation:'subtract'});
  const r=G.evaluate(spec([cyl('head',8,4,{side:'punch'}),recess]));
  assert.equal(r.valid,true);assert.equal(r.volumeStatus,'exact');assert.equal(r.envelope.minZ,-4);close(r.envelope.maxZ,0);
  close(r.volumeMm3,64*Math.PI-8*Math.PI/3);
  // The two axial halves distinguish opening direction even though reversing
  // a complete cone would leave its total volume unchanged.
  const outer=G.evaluate(spec([cyl('outer-half',8,1,{side:'punch',start:3}),recess]));
  const inner=G.evaluate(spec([cyl('inner-half',8,1,{side:'punch',start:2}),recess]));
  close(outer.volumeMm3,16*Math.PI-7*Math.PI/3);
  close(inner.volumeMm3,16*Math.PI-Math.PI/3);
  assert(outer.volumeMm3<inner.volumeMm3,'the wider opening removes more material at the outer face');
});

test('either cone end may be zero, but two zero ends and zero-diameter cylinders are invalid',()=>{
  for(const [a,b]of [[0,4],[4,0]]){
    const result=G.evaluate(spec([cone('point',a,b,2,{side:'punch',start:2})]));assert.equal(result.valid,true);close(result.volumeMm3,8*Math.PI/3);
  }
  const empty=G.validate(spec([cone('empty',0,0,2)]));assert.equal(empty.valid,false);assert.equal(empty.spec,null);assert(empty.errors.some(error=>error.code==='empty-cone'));
  assert.equal(G.validate(spec([cyl('zero',0,2)])).valid,false);
});

test('thin annular wall is not lost through subtracting two large near-equal volumes', () => {
  const outer = 100, inner = 100 - 1e-8, r = G.evaluate(spec([cyl('a', outer, 20), cyl('b', inner, 20, { operation: 'subtract' })]));
  close(r.volumeMm3, Math.PI * 20 / 4 * (outer - inner) * (outer + inner), 1e-15);
});

test('eccentric overlapping cylinders enclose the known circle-lens union instead of adding both volumes', () => {
  const expected = (2 * Math.PI * 16 - circleOverlap(4, 3)) * 12;
  const r = G.evaluate(spec([cyl('a'), cyl('b', 8, 12, { offsetX: 3 })]), { densityGcm3: 7.85, wireDiameterMm: 8 });
  bounded(r, expected); assert(r.volumeBoundsMm3[1] < 2 * 192 * Math.PI); assert.equal(r.massG, null); assert.equal(r.blankLengthMm, null);
  assert(r.massBoundsG[0] <= expected * .00785 && r.massBoundsG[1] >= expected * .00785); assert.equal(r.calculation.toleranceMet, true);
});

test('eccentric contained hole is exact; partially escaping hole removes only its intersection', () => {
  close(G.evaluate(spec([cyl('body'), cyl('hole', 2, 6, { operation: 'subtract', offsetX: 2 })])).volumeMm3, 192 * Math.PI - 6 * Math.PI);
  const expected = (16 * Math.PI - circleOverlap(4, 3)) * 12;
  bounded(G.evaluate(spec([cyl('body'), cyl('hole', 8, 12, { operation: 'subtract', offsetX: 3 })])), expected);
});

test('half-plane trimming uses final volume for weight but pre-trim stock for the cutoff', () => {
  const r = G.evaluate(spec([cyl('body')], [trim('cut', 0, 0)]), { densityGcm3: 7.85, wireDiameterMm: 8 });
  bounded(r, 96 * Math.PI); close(r.stockVolumeMm3, 192 * Math.PI); close(r.blankLengthMm, 12);
  assert.equal(r.blankBasis, 'before-trimming'); assert(r.trimVolumeBoundsMm3[0] <= 96 * Math.PI && r.trimVolumeBoundsMm3[1] >= 96 * Math.PI);
  assert(r.operations.some(op => op.code === 'trimming')); assert.equal(r.numericEligibility.forces, false);
});

test('six trimming planes produce a hexagon inside a circular stock; rotation preserves the cylinder cut volume', () => {
  const planes = Array.from({ length: 6 }, (_, i) => trim('plane' + i, i * 60, 3));
  bounded(G.evaluate(spec([cyl('body')], planes)), Math.sqrt(3) / 2 * 36 * 12);
  bounded(G.evaluate(spec([cyl('body')], [trim('cut', 37, 0)])), 96 * Math.PI);
});

test('a trimming plane acts only over its axial interval and selected tool side', () => {
  for (const side of ['punch', 'die']) {
    const r = G.evaluate(spec([cyl('body', 8, 12, { side })], [trim('window', 0, 0, 4, { side, start: 3 })]));
    bounded(r, 160 * Math.PI); close(r.stockVolumeMm3, 192 * Math.PI);
  }
  close(G.evaluate(spec([cyl('body', 8, 12, { side: 'punch' })], [trim('other-side', 0, 0)])).volumeMm3, 192 * Math.PI);
});

test('3D cone clipping and exhausted budgets still give enclosing bounds, not false nominal values', () => {
  const model = spec([cone('tip', 8, 0, 12)], [trim('cut', 0, 0)]);
  const r = G.evaluate(model, { maxCells: 128, relativeTolerance: .0001 }); bounded(r, 32 * Math.PI);
  assert.equal(r.calculation.toleranceMet, false); assert(r.calculation.cells <= 128);
  const finer = G.evaluate(model, { maxCells: 10000, relativeTolerance: .0001 }); bounded(finer, 32 * Math.PI);
  assert(finer.volumeBoundsMm3[1] - finer.volumeBoundsMm3[0] < r.volumeBoundsMm3[1] - r.volumeBoundsMm3[0]);
});

test('disconnected bodies, unspecified density and total subtraction are explicit', () => {
  const r = G.evaluate(spec([cyl('a', 8, 2), cyl('b', 8, 2, { start: 5 })]));
  assert.equal(r.topology.singleSolid, 'disconnected'); assert(r.warnings.some(w => w.code === 'disconnected-solid'));
  assert.equal(r.massG, null); assert.equal(r.massBoundsG, null); assert.equal(r.blankLengthMm, null);
  const empty = G.evaluate(spec([cyl('a'), cyl('hole', 8, 12, { operation: 'subtract' })]));
  assert.equal(empty.valid, false); assert.equal(empty.volumeMm3, 0); assert(empty.errors.some(e => e.code === 'empty-solid'));
});

test('opposing trims that remove the whole part cannot become valid through a rounding pad', () => {
  const empty = G.evaluate(spec([cyl('body')], [trim('right', 0, -1), trim('left', 180, -1)]));
  assert.equal(empty.valid, false); assert.equal(empty.volumeStatus, 'exact');
  assert.equal(empty.volumeMm3, 0); assert.deepEqual(empty.volumeBoundsMm3, [0, 0]);
  assert(empty.calculation.cells > 1, 'the proof must exercise subdivision rather than initial-cell rejection');
  assert(empty.errors.some(e => e.code === 'empty-solid'));
});

test('invalid evaluation options cannot trigger excessive work or silently substitute density', () => {
  for (const options of [{ densityGcm3: -1 }, { wireDiameterMm: NaN }, { maxCells: 1e9 }, { relativeTolerance: 0 }]) {
    const r = G.evaluate(spec([cyl('a')]), options); assert.equal(r.valid, false); assert.equal(r.volumeMm3, null);
  }
});
