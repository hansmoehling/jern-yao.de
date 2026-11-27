(function (root, factory) {
  let data = /*WIRE_PRESETS_BEGIN*/null/*WIRE_PRESETS_END*/;
  if (!data && typeof module === 'object' && module.exports) {
    try { data = require('./draht.json'); } catch (_) { /* No unverified fallback values. */ }
  }
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JYWireDefaults = api;
})(typeof window === 'object' ? window : globalThis, function (data) {
  'use strict';
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const valid = data?.schemaVersion === 1 && data.status === 'provisional' && data.unit === 'mm'
    && positive(data.wireStepMm) && positive(data.fullThreadAreaReduction) && data.fullThreadAreaReduction < 1
    && positive(data.nut?.stepMm) && positive(data.nut?.minimumAcrossFlatsRatio)
    && positive(data.nut?.targetAcrossFlatsRatio) && positive(data.nut?.maximumAcrossFlatsRatio)
    && data.nut.minimumAcrossFlatsRatio < data.nut.targetAcrossFlatsRatio
    && data.nut.targetAcrossFlatsRatio < data.nut.maximumAcrossFlatsRatio && data.nut.maximumAcrossFlatsRatio <= 1;
  const clean = value => Number(value.toPrecision(12));
  const tolerance = value => Number.EPSILON * 8 * Math.max(1, Math.abs(value));
  function grid(value, step, direction) {
    const quotient = value / step;
    if (!Number.isFinite(quotient)) return NaN;
    return clean((direction > 0 ? Math.ceil(quotient - tolerance(quotient)) : Math.floor(quotient + tolerance(quotient))) * step);
  }
  function neighbour(value, step, direction) {
    const aligned = grid(value, step, direction);
    return Math.abs(aligned - value) <= tolerance(value) ? clean(aligned + direction * step) : aligned;
  }
  function candidates(e, geometrySpec, machines = [], options = {}) {
    if (!valid || !e || typeof e !== 'object') return [];
    let base, minimum = 0, maximum = Infinity, lowerFallback, reason, params = {}, step = data.wireStepMm;
    if (e.typ === 'mutter') {
      if (!positive(e.mSW)) return [];
      const nut = data.nut;
      step = nut.stepMm; minimum = e.mSW * nut.minimumAcrossFlatsRatio; maximum = e.mSW * nut.maximumAcrossFlatsRatio;
      const lo = grid(minimum, step, 1), hi = grid(maximum, step, -1);
      if (!(lo <= hi)) return [];
      base = clean(Math.max(lo, Math.min(hi, Math.round(e.mSW * nut.targetAcrossFlatsRatio / step) * step)));
      reason = 'Mutter: Drahtvorschlag aus {ratio} % der Schlüsselweite {acrossFlats} mm.';
      params = { ratio: nut.targetAcrossFlatsRatio * 100, acrossFlats: e.mSW };
    } else if (e.typ === 'formteil') {
      const cylinders = (Array.isArray(geometrySpec?.elements) ? geometrySpec.elements : [])
        .filter(item => item && item.operation === 'add' && item.shape === 'cylinder' && positive(item.length) && positive(item.diameter));
      const longest = cylinders.reduce((best, item) => !best || item.length > best.length ? item : best, null);
      if (!longest) return [];
      base = longest.diameter;
      reason = 'Formteil: Ø {diameter} mm des längsten zylindrischen Segments.';
      params = { diameter: base };
    } else if (e.typ === 'bolzen') {
      if (!positive(e.sD)) return [];
      minimum = e.sD;
      const plain = ['rivet', 'pin'].includes(e.standardKind) || e.threadFamily === 'none';
      const partial = e.shaftType === 'partial' || e.standardReference === 'ISO4014' || positive(e.b) && positive(e.sL) && e.sL > e.b && positive(e.ds);
      if (plain || partial) {
        base = e.sD;
        reason = plain ? 'Niet oder Stift: Draht-Ø entspricht dem Schaft-Ø {shaft} mm.' : 'Teilgewinde: Draht-Ø entspricht dem Schaft-Ø {shaft} mm.';
        params = { shaft: e.sD };
      } else {
        base = grid(e.sD / Math.sqrt(1 - data.fullThreadAreaReduction), step, 1);
        lowerFallback = grid(e.sD, step, 1);
        reason = 'Vollgewinde: aus Rollrohling Ø {shaft} mm mit {reduction} % Reduktionsansatz.';
        params = { shaft: e.sD, reduction: data.fullThreadAreaReduction * 100 };
      }
    } else return [];
    if (!positive(base)) return [];
    params.step = step;
    const advice = {
      baseline: 'Stauchdraht will geglüht sein, Reduzierdraht braucht das weniger',
      increased: 'Mehr Aufstauchen: geglühten Draht vorsehen.',
      reduced: 'Mehr Reduzieren: Glühen ist weniger bestimmend; Lieferzustand mitführen.'
    };
    const result = [], push = (value, text, detail = {}, upsetting = 'baseline') => {
      if (!positive(value) || value < minimum - tolerance(minimum) || value > maximum + tolerance(maximum)
        || result.some(item => Math.abs(item.value - value) <= tolerance(value))) return;
      result.push({ value, reason: text, params: { ...params, ...detail }, origin: 'assumption', provisional: true,
        route: { upsetting, wireConditionAdvice: advice[upsetting] } });
    };
    push(base, reason);
    // Smaller wire is a process alternative. For the current bolt model it
    // must still supply the unchanged shaft; shaft upsetting is a later route.
    const limits = (Array.isArray(machines) ? machines : []).map(machine => machine?.cd).filter(positive)
      .map(limit => ({ limit, value: grid(limit, step, -1) }))
      .filter(item => item.value >= minimum - tolerance(minimum) && item.value < base - tolerance(base))
      .sort((a, b) => b.value - a.value);
    const thinner = limits[0];
    push(thinner ? thinner.value : lowerFallback ?? neighbour(base, step, -1), 'Dünnerer Draht: mehr Staucharbeit prüfen', thinner ? { catalogueCutoff: thinner.limit } : {}, 'increased');
    push(neighbour(base, step, 1), 'Dickerer Draht: Materialverteilung und Umformweg prüfen', {}, 'reduced');
    // A thicker starting wire can reduce heading strain while adding a real
    // shaft-reduction operation. Preserve the original routes for comparison.
    // This bounded search changes no component dimension or material state.
    if(e.rmPolicy==='rm-v2'&&e.forcePolicy==='force-v2'&&e.typ==='bolzen'&&typeof options.evaluate==='function'){
      const baseline=options.evaluate({...e,d0:base});
      if(!baseline.fehlt?.length&&!baseline.qualitative&&baseline.stufen?.length&&baseline.materialStatus?.flow==='strain-outside-range'){
        const headDiameter=positive(e.kD)?e.kD:positive(e.kSW)?2*e.kSW/Math.sqrt(3):null;
        const catalogueLimit=Math.max(0,...(Array.isArray(machines)?machines:[]).map(machine=>machine?.cd).filter(positive));
        const upper=Math.min(maximum,headDiameter||base,catalogueLimit||Infinity);
        for(let i=1;i<=100;i++){
          const diameter=clean(base+i*step);if(diameter>upper+tolerance(upper))break;
          const calculation=options.evaluate({...e,d0:diameter});
          if(calculation.fehlt?.length||calculation.qualitative||calculation.materialStatus?.flow!=='ready'||!calculation.stufen?.length||!calculation.stufen.every(stage=>positive(stage.F)))continue;
          const route={value:diameter,reason:'Prozessalternative: Draht Ø {diameter} mm reduziert den Stauchanteil; {stations} Stadien mit vollständigem Kraftansatz.',params:{diameter,stations:calculation.stufen.length},origin:'assumption',provisional:true,route:{upsetting:'reduced',wireConditionAdvice:advice.reduced},forceRoute:{policy:'rm-v2',baselineDiameter:base,stations:calculation.stufen.length,reason:'strain-range',extrapolated:calculation.stufen.some(stage=>stage.forceStatus==='extrapoliert')}};
          result.unshift(route);return result.filter((item,index)=>result.findIndex(other=>Math.abs(other.value-item.value)<=tolerance(item.value))===index);
        }
      }
    }
    return result;
  }
  return Object.freeze({ candidates });
});
