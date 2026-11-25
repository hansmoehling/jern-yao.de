/* Boolean part geometry, dimensions in mm. Material = union(add) minus
   union(subtract, trimming); element order does not change the solid.
   z=0 is the tool parting plane, punch z<0, die z>0. This module does not
   equate either tool side with a head and never approves forces or machines.
   Analytic volumes are exact for the ideal sharp-edged geometry to floating
   point precision. Other volumes use enclosing spatial cells: cells proved
   inside contribute to both bounds, uncertain cells only to the upper bound.
   No mesh/point sampling estimate is presented as an exact volume. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JYGeometry = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SYSTEM = 'tool-parting-plane';
  const LIMIT = 1000, MAX_ELEMENTS = 32;
  const SQRT3 = Math.sqrt(3);
  const NORMALS = [[1, 0], [.5, SQRT3 / 2], [-.5, SQRT3 / 2], [-1, 0], [-.5, -SQRT3 / 2], [.5, -SQRT3 / 2]];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const issue = (path, code, message) => ({ path, code, message });

  function validateGeometrySpec(raw) {
    const errors = [], ids = new Set();
    const fail = (path, code, message) => errors.push(issue(path, code, message));
    const unknown = (value, allowed, path) => Object.keys(value).forEach(key => {
      if (!allowed.includes(key)) fail(path + '.' + key, 'unknown-field', 'Nicht unterstütztes Geometriefeld.');
    });
    const dimension = (value, path, zero = false, signed = false) => {
      if (!finite(value) || (signed ? Math.abs(value) > LIMIT : value > LIMIT || (zero ? value < 0 : value <= 0))) {
        fail(path, 'dimension-range', 'Geometriemaße müssen endlich sein und im zulässigen Bereich bis 1000 mm liegen.');
        return false;
      }
      return true;
    };
    const common = (item, path) => {
      if (typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(item.id) || ids.has(item.id)) fail(path + '.id', 'element-id', 'Jedes Geometrieelement benötigt eine eindeutige Kennung.');
      else ids.add(item.id);
      if (!['punch', 'die'].includes(item.side)) fail(path + '.side', 'tool-side', 'Stempel- oder Matrizenseite auswählen.');
      dimension(item.start, path + '.start', true);
      dimension(item.length, path + '.length');
      if (finite(item.start) && finite(item.length) && item.start + item.length > LIMIT) fail(path, 'axial-range', 'Der Abstand von der Trennkante darf einschließlich Länge 1000 mm nicht überschreiten.');
    };
    if (!object(raw)) return { ok: false, valid: false, spec: null, errors: [issue('', 'geometry-object', 'Ein Geometriemodell ist erforderlich.')], warnings: [] };
    unknown(raw, ['version', 'coordinateSystem', 'elements', 'trimming'], 'geometry');
    if (raw.version !== 1) fail('version', 'schema-version', 'Nicht unterstützte Geometrieversion.');
    if (raw.coordinateSystem !== SYSTEM) fail('coordinateSystem', 'coordinate-system', 'Die Werkzeugtrennkante muss als Koordinatenursprung festgelegt sein.');
    if (!Array.isArray(raw.elements) || !raw.elements.length) fail('elements', 'elements-required', 'Mindestens ein additiver Grundkörper ist erforderlich.');
    if (raw.trimming !== undefined && !Array.isArray(raw.trimming)) fail('trimming', 'trimming-array', 'Beschnitt muss als Liste von Schnittebenen angegeben werden.');
    const elements = [], trimming = [];
    const sourceElements = Array.isArray(raw.elements) ? raw.elements : [];
    const sourceTrimming = Array.isArray(raw.trimming) ? raw.trimming : [];
    if (sourceElements.length + sourceTrimming.length > MAX_ELEMENTS) fail('elements', 'element-limit', 'Höchstens 32 Geometrie- und Beschnittelemente sind zulässig.');
    sourceElements.slice(0, MAX_ELEMENTS).forEach((item, index) => {
      const path = 'elements[' + index + ']';
      if (!object(item)) { fail(path, 'element-object', 'Ein gültiges Geometrieelement ist erforderlich.'); return; }
      const shapeKeys = item.shape === 'hex' ? ['acrossFlats'] : item.shape === 'cone' ? ['diameter', 'diameterEnd'] : ['diameter'];
      unknown(item, ['id', 'operation', 'shape', 'side', 'start', 'length', 'offsetX', 'offsetY'].concat(shapeKeys), path);
      common(item, path);
      if (!['add', 'subtract'].includes(item.operation)) fail(path + '.operation', 'boolean-operation', 'Vereinigung oder Abzug auswählen.');
      if (!['cylinder', 'cone', 'hex'].includes(item.shape)) fail(path + '.shape', 'shape-type', 'Zylinder, Kegelstumpf oder Sechskant auswählen.');
      shapeKeys.forEach(key => dimension(item[key], path + '.' + key, item.shape === 'cone'));
      if (item.shape === 'cone' && item.diameter === 0 && item.diameterEnd === 0) fail(path, 'empty-cone', 'Mindestens ein Kegeldurchmesser muss größer als null sein.');
      const offsetX = item.offsetX === undefined ? 0 : item.offsetX, offsetY = item.offsetY === undefined ? 0 : item.offsetY;
      dimension(offsetX, path + '.offsetX', true, true); dimension(offsetY, path + '.offsetY', true, true);
      const normalized = { id: item.id, operation: item.operation, shape: item.shape, side: item.side, start: item.start, length: item.length, offsetX, offsetY };
      shapeKeys.forEach(key => { normalized[key] = item[key]; });
      elements.push(normalized);
    });
    sourceTrimming.slice(0, MAX_ELEMENTS).forEach((item, index) => {
      const path = 'trimming[' + index + ']';
      if (!object(item)) { fail(path, 'trim-object', 'Eine gültige Schnittebene ist erforderlich.'); return; }
      unknown(item, ['id', 'side', 'start', 'length', 'angleDeg', 'distance'], path);
      common(item, path);
      if (!finite(item.angleDeg) || Math.abs(item.angleDeg) > 360) fail(path + '.angleDeg', 'trim-angle', 'Der Schnittwinkel muss zwischen −360° und 360° liegen.');
      dimension(item.distance, path + '.distance', true, true);
      trimming.push({ id: item.id, side: item.side, start: item.start, length: item.length, angleDeg: item.angleDeg, distance: item.distance });
    });
    if (!sourceElements.some(item => object(item) && item.operation === 'add')) fail('elements', 'add-required', 'Mindestens ein additiver Grundkörper ist erforderlich.');
    const valid = errors.length === 0;
    return { ok: valid, valid, spec: valid ? { version: 1, coordinateSystem: SYSTEM, elements, trimming } : null, errors, warnings: [] };
  }

  function internal(item, trim) {
    const e = Object.assign({}, item);
    e.z0 = e.side === 'die' ? e.start : -e.start - e.length;
    e.z1 = e.side === 'die' ? e.start + e.length : -e.start;
    if (trim) {
      e.shape = 'plane'; e.operation = 'subtract';
      e.nx = Math.cos(e.angleDeg * Math.PI / 180); e.ny = Math.sin(e.angleDeg * Math.PI / 180);
      e.prism = true;
    } else {
      e.prism = e.shape !== 'cone' || e.diameter === e.diameterEnd;
      const r = e.shape === 'hex' ? e.acrossFlats / 2 : Math.max(e.diameter, e.diameterEnd || 0) / 2;
      e.box = { x0: e.offsetX - r, x1: e.offsetX + r, y0: e.offsetY - (e.shape === 'hex' ? r * 2 / SQRT3 : r), y1: e.offsetY + (e.shape === 'hex' ? r * 2 / SQRT3 : r) };
    }
    return e;
  }
  function radius(e, z) {
    if (e.shape === 'hex') return e.acrossFlats / 2;
    if (e.shape !== 'cone') return e.diameter / 2;
    const u = Math.max(0, Math.min(1, ((e.side === 'die' ? z : -z) - e.start) / e.length));
    return (e.diameter * (1 - u) + e.diameterEnd * u) / 2;
  }
  function vertices(e) {
    const a = e.acrossFlats / 2, b = a / SQRT3;
    return [[a, b], [0, 2 * b], [-a, b], [-a, -b], [0, -2 * b], [a, -b]].map(([x, y]) => [x + e.offsetX, y + e.offsetY]);
  }
  function area(e) { return e.shape === 'hex' ? SQRT3 * e.acrossFlats * e.acrossFlats / 2 : Math.PI * e.diameter * e.diameter / 4; }
  function contains(outer, inner) {
    if (!outer.prism || !inner.prism) return false;
    const dx = inner.offsetX - outer.offsetX, dy = inner.offsetY - outer.offsetY;
    if (outer.shape !== 'hex') {
      const r = outer.diameter / 2;
      if (inner.shape !== 'hex') return Math.hypot(dx, dy) + inner.diameter / 2 <= r;
      return vertices(inner).every(([x, y]) => Math.hypot(x - outer.offsetX, y - outer.offsetY) <= r);
    }
    const a = outer.acrossFlats / 2;
    if (inner.shape !== 'hex') return NORMALS.every(([nx, ny]) => nx * dx + ny * dy + inner.diameter / 2 <= a);
    return vertices(inner).every(([x, y]) => NORMALS.every(([nx, ny]) => nx * (x - outer.offsetX) + ny * (y - outer.offsetY) <= a));
  }
  function xyBounds(elements) {
    return { x0: Math.min(...elements.map(e => e.box.x0)), x1: Math.max(...elements.map(e => e.box.x1)), y0: Math.min(...elements.map(e => e.box.y0)), y1: Math.max(...elements.map(e => e.box.y1)) };
  }
  function boxesOverlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
  function constantOuter(elements) { return elements.find(candidate => elements.every(e => e === candidate || contains(candidate, e))); }

  // Exact union/difference of coaxial circular profiles. Every radius is linear
  // on a slab. Pairwise radius crossings split it into quadratic area pieces.
  function circularVolume(adds, subtracts, z0, z1) {
    const all = adds.concat(subtracts), cuts = [z0, z1];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = radius(all[i], z0) - radius(all[j], z0), b = radius(all[i], z1) - radius(all[j], z1);
      if (a * b < 0) cuts.push(z0 + (z1 - z0) * a / (a - b));
    }
    cuts.sort((a, b) => a - b);
    let volume = 0;
    for (let i = 1; i < cuts.length; i++) {
      const lo = cuts[i - 1], hi = cuts[i]; if (!(hi > lo)) continue;
      const mid = (lo + hi) / 2;
      const largest = list => list.reduce((best, e) => !best || radius(e, mid) > radius(best, mid) ? e : best, null);
      const outer = largest(adds), hole = largest(subtracts);
      if (hole && radius(hole, mid) >= radius(outer, mid)) continue;
      // Simpson integrates this quadratic exactly. Factoring the difference
      // of squares preserves thin walls better than subtracting two volumes.
      const section = z => { const a = radius(outer, z), b = hole ? radius(hole, z) : 0; return Math.PI * Math.max(0, a - b) * (a + b); };
      volume += (hi - lo) * (section(lo) + 4 * section(mid) + section(hi)) / 6;
    }
    return volume;
  }

  // -1 outside, +1 wholly inside, 0 unresolved. Tolerance widens uncertain
  // cells and cannot deliberately turn a boundary cell into certain material.
  function classify(e, b) {
    const eps = 1e-10 * Math.max(1, Math.abs(b.x0), Math.abs(b.x1), Math.abs(b.y0), Math.abs(b.y1));
    if (e.shape === 'plane') {
      const values = [e.nx * b.x0 + e.ny * b.y0, e.nx * b.x0 + e.ny * b.y1, e.nx * b.x1 + e.ny * b.y0, e.nx * b.x1 + e.ny * b.y1];
      return Math.min(...values) > e.distance + eps ? 1 : Math.max(...values) < e.distance - eps ? -1 : 0;
    }
    const x0 = b.x0 - e.offsetX, x1 = b.x1 - e.offsetX, y0 = b.y0 - e.offsetY, y1 = b.y1 - e.offsetY;
    if (e.shape === 'hex') {
      const a = e.acrossFlats / 2; let inside = true;
      for (const [nx, ny] of NORMALS) {
        const values = [nx * x0 + ny * y0, nx * x0 + ny * y1, nx * x1 + ny * y0, nx * x1 + ny * y1];
        if (Math.min(...values) > a + eps) return -1;
        if (Math.max(...values) > a - eps) inside = false;
      }
      return inside ? 1 : 0;
    }
    const r0 = radius(e, b.z0), r1 = radius(e, b.z1), minR = Math.min(r0, r1), maxR = Math.max(r0, r1);
    const nearX = x0 > 0 ? x0 : x1 < 0 ? -x1 : 0, nearY = y0 > 0 ? y0 : y1 < 0 ? -y1 : 0;
    if (Math.hypot(nearX, nearY) > maxR + eps) return -1;
    if (Math.hypot(Math.max(Math.abs(x0), Math.abs(x1)), Math.max(Math.abs(y0), Math.abs(y1))) < minR - eps) return 1;
    return 0;
  }
  function materialCell(cell) {
    const addStates = cell.adds.map(e => classify(e, cell));
    if (addStates.every(state => state === -1)) return -1;
    const cutStates = cell.cuts.map(e => classify(e, cell));
    if (cutStates.some(state => state === 1)) return -1;
    return addStates.some(state => state === 1) && cutStates.every(state => state === -1) ? 1 : 0;
  }
  const cellVolume = b => (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0);
  function heapPush(heap, cell) {
    let at = heap.length; heap.push(cell);
    while (at) { const parent = (at - 1) >> 1; if (heap[parent].volume >= cell.volume) break; heap[at] = heap[parent]; at = parent; }
    heap[at] = cell;
  }
  function heapPop(heap) {
    const result = heap[0], last = heap.pop(); if (!heap.length) return result;
    let at = 0;
    while (at * 2 + 1 < heap.length) {
      let child = at * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1].volume > heap[child].volume) child++;
      if (heap[child].volume <= last.volume) break;
      heap[at] = heap[child]; at = child;
    }
    heap[at] = last; return result;
  }

  function volumeOf(elements, trimming, options) {
    const adds = elements.filter(e => e.operation === 'add'), all = elements.concat(trimming);
    const levels = [...new Set(all.flatMap(e => [e.z0, e.z1]))].sort((a, b) => a - b);
    let exact = 0, lower = 0, uncertain = 0, cells = 0;
    const heap = [];
    const put = cell => {
      cell.volume = cellVolume(cell); cells++;
      const state = materialCell(cell);
      if (state === 1) lower += cell.volume;
      else if (state === 0 && cell.volume > 0) { uncertain += cell.volume; heapPush(heap, cell); }
    };
    for (let i = 1; i < levels.length; i++) {
      const z0 = levels[i - 1], z1 = levels[i], mid = (z0 + z1) / 2;
      const activeAdds = adds.filter(e => e.z0 < mid && e.z1 > mid);
      if (!activeAdds.length) continue;
      const box = xyBounds(activeAdds);
      const activeCuts = all.filter(e => e.operation === 'subtract' && e.z0 < mid && e.z1 > mid && (e.shape === 'plane' || boxesOverlap(e.box, box)));
      const active = activeAdds.concat(activeCuts);
      if (active.every(e => e.shape !== 'hex' && e.shape !== 'plane' && e.offsetX === active[0].offsetX && e.offsetY === active[0].offsetY)) {
        exact += circularVolume(activeAdds, activeCuts, z0, z1); continue;
      }
      if (active.every(e => e.prism && e.shape !== 'plane')) {
        const outer = constantOuter(activeAdds), hole = constantOuter(activeCuts);
        if (outer && !activeCuts.length) { exact += area(outer) * (z1 - z0); continue; }
        if (outer && hole && contains(outer, hole)) { exact += Math.max(0, area(outer) - area(hole)) * (z1 - z0); continue; }
        if (outer && hole && contains(hole, outer)) continue;
      }
      put(Object.assign(box, { z0, z1, adds: activeAdds, cuts: activeCuts, prism: active.every(e => e.prism) }));
    }
    if (!heap.length) return { status: 'exact', volume: exact + lower, bounds: [exact + lower, exact + lower], cells, method: 'analytic-segments' };
    while (heap.length && cells + 2 <= options.maxCells && uncertain > Math.max(options.absoluteToleranceMm3, options.relativeTolerance * (exact + lower + uncertain / 2))) {
      const cell = heapPop(heap); uncertain -= cell.volume;
      const lengths = [cell.x1 - cell.x0, cell.y1 - cell.y0, cell.prism ? -1 : cell.z1 - cell.z0];
      const axis = lengths.indexOf(Math.max(...lengths)), a = ['x0', 'y0', 'z0'][axis], b = ['x1', 'y1', 'z1'][axis], mid = (cell[a] + cell[b]) / 2;
      if (!(mid > cell[a] && mid < cell[b])) { uncertain += cell.volume; heapPush(heap, cell); break; }
      put(Object.assign({}, cell, { [b]: mid })); put(Object.assign({}, cell, { [a]: mid }));
    }
    // Once every cell is proved outside, the empty solid is exact. A positive
    // rounding pad would otherwise disguise complete removal as a valid part.
    if (!heap.length && exact === 0 && lower === 0) return { status: 'exact', volume: 0, bounds: [0, 0], cells, method: 'enclosing-cells' };
    // Outward padding for accumulated floating point additions.
    const padding = Number.EPSILON * 128 * Math.max(1, exact + lower + Math.max(0, uncertain)) * Math.max(1, cells);
    const lo = Math.max(0, exact + lower - padding), hi = exact + lower + Math.max(0, uncertain) + padding;
    return { status: 'bounded', volume: null, bounds: [lo, hi], cells, method: 'enclosing-cells', toleranceMet: hi - lo <= Math.max(options.absoluteToleranceMm3, options.relativeTolerance * (lo + hi) / 2) };
  }

  function topologyOf(elements, trimming) {
    const adds = elements.filter(e => e.operation === 'add');
    const coaxial = elements.every(e => e.offsetX === elements[0].offsetX && e.offsetY === elements[0].offsetY);
    let singleSolid = 'unverified';
    if (elements.length === adds.length && !trimming.length) {
      const graph = adds.map(() => []), broad = adds.map(() => []);
      for (let i = 0; i < adds.length; i++) for (let j = i + 1; j < adds.length; j++) {
        const a = adds[i], b = adds[j], lo = Math.max(a.z0, b.z0), hi = Math.min(a.z1, b.z1);
        if (hi < lo || !boxesOverlap(a.box, b.box)) continue;
        broad[i].push(j); broad[j].push(i);
        const distance = Math.hypot(a.offsetX - b.offsetX, a.offsetY - b.offsetY);
        // Inscribed circles prove a positive connecting section for hexagons;
        // circles/cones use their actual linear radii. Point contact is excluded.
        if (Math.max(radius(a, lo) + radius(b, lo), radius(a, hi) + radius(b, hi)) > distance && Math.max(radius(a, lo), radius(a, hi)) > 0 && Math.max(radius(b, lo), radius(b, hi)) > 0) { graph[i].push(j); graph[j].push(i); }
      }
      const connected = edges => { const seen = new Set([0]), queue = [0]; while (queue.length) for (const next of edges[queue.pop()]) if (!seen.has(next)) { seen.add(next); queue.push(next); } return seen.size === adds.length; };
      singleSolid = connected(graph) ? 'confirmed' : connected(broad) ? 'unverified' : 'disconnected';
    }
    return { singleSolid, coaxial, axisymmetric: coaxial && !trimming.length && elements.every(e => e.shape !== 'hex'), hasEccentricity: !coaxial, hasInternalCuts: elements.some(e => e.operation === 'subtract'), hasTrimming: !!trimming.length };
  }
  function operationsOf(spec, topology) {
    const operations = [{ code: 'cut-off', side: null, elementIds: [], label: 'Abschnitt vorbereiten' }];
    for (const e of spec.elements) operations.push({ code: e.operation === 'subtract' ? 'internal-contour' : 'external-contour', side: e.side, elementIds: [e.id], shape: e.shape, label: e.operation === 'subtract' ? 'Innenkontur formen; Werkzeugzugang und Austritt prüfen' : 'Außenkontur formen; Vorform und Materialverteilung festlegen' });
    if (topology.hasEccentricity) operations.push({ code: 'eccentric-forming', side: null, elementIds: spec.elements.map(e => e.id), label: 'Exzentrische Kontur; Querkräfte, Werkzeugführung und Transfer prüfen' });
    if (spec.trimming.length) operations.push({ code: 'trimming', side: null, elementIds: spec.trimming.map(e => e.id), label: 'Kontur beschneiden; Schneidspalt und Abfallabfuhr auslegen' });
    return operations;
  }

  function evaluate(raw, suppliedOptions) {
    const validated = validateGeometrySpec(raw), options = Object.assign({ maxCells: 16000, relativeTolerance: .01, absoluteToleranceMm3: 1e-6 }, suppliedOptions || {});
    const result = Object.assign({}, validated, { volumeStatus: 'unavailable', volumeMm3: null, volumeBoundsMm3: null, massG: null, massBoundsG: null, blankLengthMm: null, blankLengthBoundsMm: null, envelope: null, topology: null, operations: [], numericEligibility: { forces: false, machines: false, reason: 'process-model-required' } });
    if (!validated.valid) return result;
    for (const [key, maximum] of [['wireDiameterMm', LIMIT], ['densityGcm3', 100]]) if (options[key] !== undefined && options[key] !== null && (!finite(options[key]) || options[key] <= 0 || options[key] > maximum)) result.errors.push(issue(key, 'calculation-option', 'Drahtdurchmesser und Dichte müssen als positive Werte mit korrekten Einheiten angegeben werden.'));
    if (!Number.isInteger(options.maxCells) || options.maxCells < 128 || options.maxCells > 200000 || !finite(options.relativeTolerance) || options.relativeTolerance <= 0 || options.relativeTolerance > .1 || !finite(options.absoluteToleranceMm3) || options.absoluteToleranceMm3 < 0) result.errors.push(issue('options', 'calculation-budget', 'Ungültige Genauigkeits- oder Rechenbudgetvorgabe.'));
    if (result.errors.length) { result.valid = result.ok = false; return result; }
    const elements = validated.spec.elements.map(e => internal(e, false)), trims = validated.spec.trimming.map(e => internal(e, true)), adds = elements.filter(e => e.operation === 'add');
    const box = xyBounds(adds);
    result.envelope = { minX: box.x0, maxX: box.x1, minY: box.y0, maxY: box.y1, minZ: Math.min(...adds.map(e => e.z0)), maxZ: Math.max(...adds.map(e => e.z1)), conservative: true };
    const volume = volumeOf(elements, trims, options);
    const stock = trims.length ? volumeOf(elements, [], options) : volume;
    result.volumeStatus = volume.status; result.volumeMm3 = volume.volume; result.volumeBoundsMm3 = volume.bounds;
    result.volumeErrorMm3 = (volume.bounds[1] - volume.bounds[0]) / 2;
    result.stockVolumeMm3 = stock.volume; result.stockVolumeBoundsMm3 = stock.bounds;
    result.trimVolumeMm3 = volume.volume !== null && stock.volume !== null ? Math.max(0, stock.volume - volume.volume) : null;
    result.trimVolumeBoundsMm3 = [Math.max(0, stock.bounds[0] - volume.bounds[1]), Math.max(0, stock.bounds[1] - volume.bounds[0])];
    result.blankBasis = trims.length ? 'before-trimming' : 'net-part-volume';
    result.calculation = { method: volume.method, cells: volume.cells, toleranceMet: volume.status === 'exact' || !!volume.toleranceMet, relativeTolerance: options.relativeTolerance };
    if (options.densityGcm3) { result.massBoundsG = volume.bounds.map(v => v * options.densityGcm3 / 1000); if (volume.volume !== null) result.massG = volume.volume * options.densityGcm3 / 1000; }
    if (options.wireDiameterMm) { const section = Math.PI * options.wireDiameterMm * options.wireDiameterMm / 4; result.blankLengthBoundsMm = stock.bounds.map(v => v / section); if (stock.volume !== null) result.blankLengthMm = stock.volume / section; }
    result.topology = topologyOf(elements, trims); result.operations = operationsOf(validated.spec, result.topology);
    result.warnings.push(issue('geometry', 'idealized-edges', 'Volumen des geometrischen Modells ohne nicht angegebene Radien, Fasen und Fertigungszugaben.'));
    if (trims.length) result.warnings.push(issue('blank', 'modeled-trim-stock', 'Die Abschnittslänge enthält den modellierten Beschnitt; weitere Fertigungszugaben und Materialverluste sind noch festzulegen.'));
    if (volume.status === 'bounded') result.warnings.push(issue('volume', 'volume-bounds', 'Das Volumen ist als geprüftes Intervall angegeben; ein exakter Einzelwert ist nicht freigegeben.'));
    if (result.topology.singleSolid !== 'confirmed') result.warnings.push(issue('topology', result.topology.singleSolid === 'disconnected' ? 'disconnected-solid' : 'connectivity-unverified', result.topology.singleSolid === 'disconnected' ? 'Die Grundkörper bilden kein zusammenhängendes Teil.' : 'Der zusammenhängende Materialverbund ist noch zu prüfen.'));
    if (volume.bounds[1] === 0) { result.valid = result.ok = false; result.errors.push(issue('geometry', 'empty-solid', 'Die Abzüge entfernen das gesamte Bauteilvolumen.')); }
    return result;
  }
  return { version: 1, coordinateSystem: SYSTEM, limits: { maxElements: MAX_ELEMENTS, maxDimensionMm: LIMIT }, validateGeometrySpec, validate: validateGeometrySpec, normalize: raw => validateGeometrySpec(raw).spec, evaluate };
});
