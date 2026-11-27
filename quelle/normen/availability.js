(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.JYNormAvailability=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
  const rows=catalogue=>Array.isArray(catalogue)?catalogue.filter(row=>row&&typeof row==='object'):[];
  function confinedShaftDiameter(part={}){
    if(!part||typeof part!=='object')return null;
    // A headed part may upset freely in front of its die. The head/flange or
    // a nut's outer envelope alone therefore cannot prove holder exclusion.
    // Explicit shaft segments replace, rather than augment, old scalar fields.
    if(part.shaftSegments!==undefined){
      const segments=part.shaftSegments;
      if(!Array.isArray(segments)||!segments.length||!segments.every(segment=>positive(segment?.diameter)&&positive(segment?.length)))return null;
      if(positive(part.sL)&&Math.abs(segments.reduce((sum,segment)=>sum+segment.length,0)-part.sL)>1e-7)return null;
      return Math.max(...segments.map(segment=>segment.diameter));
    }
    const values=['sD','ds'].map(key=>part[key]).filter(positive);
    return values.length?Math.max(...values):null;
  }
  function assess(machine,diameter){
    const die=machine.die?.[0],punch=machine.pun?.[0];
    // Missing holder data cannot establish a hard exclusion. Neither a wire
    // proposal nor a machine-family label proves that no forming route exists.
    if(!positive(diameter)||!positive(die)||!positive(punch))return 'unknown';
    return diameter>Math.max(die,punch)?'excluded':'within-catalogue-envelope';
  }
  function sizeAvailability({part={},catalogue=[]}={}){
    const machines=rows(catalogue),diameter=confinedShaftDiameter(part),states=machines.map(machine=>assess(machine,diameter));
    const excludedCount=states.filter(state=>state==='excluded').length,unknownCount=states.filter(state=>state==='unknown').length;
    const disabled=machines.length>0&&excludedCount===machines.length;
    const capacities=machines.flatMap(machine=>[machine.die?.[0],machine.pun?.[0]]).filter(positive),maximum=capacities.length?Math.max(...capacities):null;
    return {disabled,reason:disabled?'Schaftkontur Ø {diameter} mm liegt außerhalb der dokumentierten Werkzeugaufnahmen im Maschinenkatalog (bis Ø {maximum} mm).':null,params:disabled?{diameter,maximum}:{},diameter,maximum,candidateCount:machines.length-excludedCount,unknownCount,excludedCount,basis:'catalogue-confined-shaft-envelope'};
  }
  function lengthAvailability({part={},catalogue=[]}={}){
    const diameter=confinedShaftDiameter(part),machines=rows(catalogue).filter(machine=>assess(machine,diameter)!=='excluded');
    const product=machines.map(machine=>machine.ml).filter(positive),lower=machines.map(machine=>machine.cl?.[0]).filter(positive),upper=machines.map(machine=>machine.cl?.[1]).filter(positive);
    const cutoffKnown=machines.filter(machine=>positive(machine.cl?.[0])||positive(machine.cl?.[1])).length;
    // ml describes a product; cl describes its cut-off blank. These separate
    // catalogue observations are hints, never HTML limits on finished length.
    return {productLength:{max:product.length?Math.max(...product):null,knownCount:product.length,unknownCount:machines.length-product.length},cutoffLength:{min:lower.length?Math.min(...lower):null,max:upper.length?Math.max(...upper):null,knownCount:cutoffKnown,unknownCount:machines.length-cutoffKnown,minimumKnownCount:lower.length,maximumKnownCount:upper.length},candidateCount:machines.length,hardMin:null,hardMax:null,basis:'machine-catalogue-not-standard-lengths'};
  }
  return Object.freeze({sizeAvailability,lengthAvailability});
});
