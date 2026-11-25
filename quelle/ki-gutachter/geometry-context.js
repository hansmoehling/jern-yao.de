import Geometry from '../geometry-model.js';
import Engine from '../engine.js';

// One deterministic model is shared with the form builder. Neither submitted
// numerical results nor approval/coverage flags cross this trust boundary.
export function geometryContext(raw, supplied = {}) {
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) return { ok: false, errors: [{ path: 'process', code: 'invalid_process' }] };
  const validated = Geometry.validateGeometrySpec(raw);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  const errors = [], process = {};
  const issue = (path, code) => errors.push({ path, code });
  if (supplied.geometryFeatures !== undefined) {
    const features=supplied.geometryFeatures;
    if(!Array.isArray(features)||features.length>2)issue('geometryFeatures','invalid_features');
    else {
      const sides=new Set();process.geometryFeatures=[];
      for(const feature of features){
        if(!feature||typeof feature!=='object'||Array.isArray(feature)||Object.keys(feature).some(key=>!['side','type','contourComplete'].includes(key))||!['punch','die'].includes(feature.side)||feature.type!=='claw-head'||typeof feature.contourComplete!=='boolean'||sides.has(feature.side)){issue('geometryFeatures','invalid_feature');continue;}
        sides.add(feature.side);process.geometryFeatures.push({side:feature.side,type:'claw-head',contourComplete:feature.contourComplete});
      }
      process.geometryFeatures.sort((a,b)=>a.side.localeCompare(b.side));
    }
  }
  if (supplied.material !== undefined && supplied.material !== '') {
    const material = typeof supplied.material === 'string' && supplied.material.length <= 120 && Engine.findMaterial(supplied.material);
    if (!material) issue('material', 'unknown_material');
    else process.material = material.id;
  }
  for (const [key, allowed] of Object.entries({ materialState: ['soft-annealed', 'cold-drawn', 'normalized-rolled', 'unknown'], wirePreparation: ['as-supplied', 'inline-drawing'] })) {
    if (supplied[key] !== undefined && supplied[key] !== '') {
      if (!allowed.includes(supplied[key])) issue(key, 'invalid_selection');
      else process[key] = supplied[key];
    }
  }
  if (supplied.curveId !== undefined && supplied.curveId !== '') {
    const material = process.material && Engine.findMaterial(process.material);
    const curve = typeof supplied.curveId === 'string' && material?.flowCurves?.find(item => item.id === supplied.curveId);
    if (!curve) issue('curveId', 'curve_not_for_material');
    else if (process.materialState && process.materialState !== 'unknown' && curve.state !== process.materialState) issue('materialState', 'curve_state_mismatch');
    else process.curveId = curve.id;
  }
  for (const [key, maximum] of [['d0', 1000], ['rodDiameter', 1000], ['rm', 10000]]) {
    if (supplied[key] !== undefined && supplied[key] !== null) {
      if (typeof supplied[key] !== 'number' || !Number.isFinite(supplied[key]) || supplied[key] <= 0 || supplied[key] > maximum) issue(key, 'invalid_positive_number');
      else process[key] = supplied[key];
    }
  }
  if (process.wirePreparation === 'inline-drawing' && !(process.rodDiameter > process.d0)) issue('rodDiameter', 'inline_drawing_diameters');
  if (errors.length) return { ok: false, errors };
  const material = process.material ? Engine.findMaterial(process.material) : null;
  const densityGcm3 = Number.isFinite(material?.rho) && material.rho > 0 ? material.rho : null;
  // Clients cannot increase the numerical work budget or choose tolerances.
  // A bounded volume stays an interval, never a precise midpoint estimate.
  const evaluated = Geometry.evaluate(validated.spec, { wireDiameterMm: process.d0, densityGcm3, maxCells: 2048, relativeTolerance: 0.01 });
  if (!evaluated.valid) return { ok: false, errors: evaluated.errors };
  if (evaluated.topology?.singleSolid === 'disconnected') return { ok: false, errors: [{ path: 'geometry', code: 'disconnected_solid' }] };
  const partial=process.geometryFeatures?.some(feature=>!feature.contourComplete)===true;
  return { ok: true, spec: validated.spec, process, analysis: {
    origin: 'structured_geometry', modelVersion: validated.spec.version,
    basis:partial?'partial-geometry':'complete-model',
    geometryFeatures:process.geometryFeatures||[],
    volumeStatus: evaluated.volumeStatus,
    volumeMm3: evaluated.volumeMm3 ?? null,
    volumeBoundsMm3: evaluated.volumeBoundsMm3 ?? null,
    stockVolumeMm3: evaluated.stockVolumeMm3 ?? null,
    stockVolumeBoundsMm3: evaluated.stockVolumeBoundsMm3 ?? null,
    trimVolumeMm3: evaluated.trimVolumeMm3 ?? null,
    trimVolumeBoundsMm3: evaluated.trimVolumeBoundsMm3 ?? null,
    blankBasis: partial?'partial-geometry':evaluated.blankBasis,
    massG: partial?null:evaluated.massG ?? null,
    massBoundsG: partial?null:evaluated.massBoundsG ?? null,
    densityGcm3,
    densityStatus: material?.densityStatus || 'missing',
    densitySource:material?.densitySource?{title:material.densitySource.sourceTitle||'Werkstoffdichte',url:material.densitySource.sourceUrl,status:material.densityStatus}:null,
    blankLengthMm: partial?null:evaluated.blankLengthMm ?? null,
    blankLengthBoundsMm: partial?null:evaluated.blankLengthBoundsMm ?? null,
    envelope: evaluated.envelope,
    topology: evaluated.topology,
    operations: [...evaluated.operations,...(process.geometryFeatures||[]).map(feature=>({code:'claw-head',side:feature.side,contourComplete:feature.contourComplete,label:'Äußeren Mitnahmekopf formen; Krallenkontur und Werkzeugzugang zuordnen'}))],
    calculation: evaluated.calculation,
    warnings: evaluated.warnings,
    numericEligibility: { forces: false, machines: false }
  } };
}
