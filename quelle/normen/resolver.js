(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYStandards=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const SCHEMA_VERSION=1;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const reserved=new Set(['__proto__','prototype','constructor']);
  function copy(value){
    if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(Array.isArray(value))return value.map(copy);
    if(record(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copy(item)]));
    throw new TypeError('Standard state must contain finite JSON values.');
  }
  const present=value=>value!==undefined&&value!==null;
  const valuesFrom=value=>record(value)?Object.fromEntries(Object.entries(value).filter(([,item])=>present(item)).map(([key,item])=>[key,copy(item)])):{};
  function pathParts(path){
    if(typeof path!=='string'||!path.length)throw new TypeError('Override path is required.');
    const parts=path.split('.');
    if(parts.some(part=>reserved.has(part)||!/^([A-Za-z_][A-Za-z0-9_-]*|\d+)$/.test(part)))throw new TypeError('Invalid override path.');
    return parts;
  }
  function hasPath(value,path){
    for(const part of pathParts(path)){if(!record(value)&&!Array.isArray(value)||!own(value,part))return false;value=value[part];}
    return true;
  }
  function putPath(value,path,next){
    const parts=pathParts(path);let target=value;
    parts.forEach((part,index)=>{if(index===parts.length-1)target[part]=copy(next);else{if(!record(target[part])&&!Array.isArray(target[part]))target[part]=/^\d+$/.test(parts[index+1])?[]:{};target=target[part];}});
  }
  function validateOverrides(value){
    if(!record(value))throw new TypeError('Overrides must be an object.');
    for(const [path,override]of Object.entries(value)){
      pathParts(path);
      if(!record(override)||override.origin!=='customer'||!present(override.value))throw new TypeError('An override needs an explicit customer value.');
      copy(override.value);
    }
  }
  function materialize(document){
    const next=copy(document);
    next.effective=copy(next.retainedValues);
    next.effectiveStatus=Object.fromEntries(Object.keys(next.retainedValues).map(field=>[field,'retained-without-standard']));
    for(const [field,value]of Object.entries(next.normBaseline.values)){
      if(next.normBaseline.applicability?.[field]==='unresolved'){next.effectiveStatus[field]='unresolved';continue;}
      next.effective[field]=copy(value);next.effectiveStatus[field]='standard';
    }
    next.issues=next.issues.filter(issue=>!String(issue.code).startsWith('override-'));
    for(const [path,override]of Object.entries(next.overrides)){
      if(!hasPath(next.normBaseline.values,path))next.issues.push({code:'override-not-in-standard',path,reference:copy(next.standardReference)});
      const metadata=next.normBaseline.provenance[path];
      if(next.normBaseline.applicability?.[path]==='unresolved')next.issues.push({code:'override-standard-unresolved',path});
      if(metadata&&typeof override.value==='number'&&((typeof metadata.min==='number'&&override.value<metadata.min)||(typeof metadata.max==='number'&&override.value>metadata.max)))next.issues.push({code:'override-outside-standard',path});
      if(own(next.normBaseline.values,path)&&typeof override.value!==typeof next.normBaseline.values[path])next.issues.push({code:'override-value-type',path});
      putPath(next.effective,path,override.value);
      next.effectiveStatus[path]='customer';
    }
    return next;
  }
  function validDocument(value){
    if(!record(value)||value.schemaVersion!==SCHEMA_VERSION||!Number.isSafeInteger(value.revision)||value.revision<1||!record(value.normBaseline)||!record(value.normBaseline.values)||!record(value.retainedValues)||!record(value.partSnapshot)||!Array.isArray(value.issues))throw new TypeError('Unsupported standard snapshot.');
    validateOverrides(value.overrides);
    return copy(value);
  }
  /**
   * Pure data adapter. The library uses families (or the draft alias familien),
   * groessen[size].vorbelegung/roh and fields[size][rawKey]. Source status belongs
   * to each value; a family's prose status never verifies all of its dimensions.
   *
   * partSnapshot is the complete caller-owned part document (chain, geometrySpec,
   * features, material, wire and process). It is carried losslessly, never rebuilt
   * from a few norm dimensions. The UI/geometry adapter consumes effective and
   * updates its geometry explicitly. No machine family is selected or excluded.
   */
  function resolveStandard(library,selection,previous={}){
    if(!record(library)||!present(library.version)||library.schemaVersion!==undefined&&library.schemaVersion!==SCHEMA_VERSION)throw new TypeError('Unsupported standards library.');
    const families=library.families||library.familien;
    if(!Array.isArray(families)||!record(selection)||typeof selection.id!=='string'||!present(selection.groesse))throw new TypeError('A standard and size are required.');
    const prior=previous.schemaVersion===SCHEMA_VERSION?validDocument(previous):copy(previous);
    const overrides=copy(prior.overrides||{});validateOverrides(overrides);
    const matches=families.filter(f=>f.id===selection.id&&(selection.edition===undefined||String(f.edition)===String(selection.edition)));
    const family=matches.length===1?matches[0]:null;
    const size=String(selection.groesse),row=family?.groessen?.[size];
    const reference={id:selection.id,edition:family?.edition??selection.edition??null,libraryVersion:library.version,groesse:size};
    for(const key of ['laenge','steigung','form','festigkeitsklasse'])if(present(selection[key]))reference[key]=copy(selection[key]);
    const issues=[];
    if(!family)issues.push({code:matches.length>1?'standard-edition-ambiguous':'standard-not-found',path:'selection.id'});
    else if(!record(row))issues.push({code:'standard-size-unavailable',path:'selection.groesse'});
    const lengthRow=present(selection.laenge)?row?.nachLaenge?.[String(selection.laenge)]:null;
    if(present(selection.laenge)&&!record(lengthRow))issues.push({code:'length-not-resolved',path:'selection.laenge'});
    const values={...valuesFrom(row?.vorbelegung),...valuesFrom(lengthRow?.vorbelegung)};
    const raw={...copy(row?.roh||{}),...copy(lengthRow?.roh||{})};
    const mapping=family?.feldzuordnung||{},fields={...(family?.fields?.[size]||{}),...(row?.fields||{}),...(lengthRow?.fields||{})};
    const lengthDependent=new Set([...(family?.lengthDependentFields||[]),...(row?.lengthDependentFields||[])]);
    const provenance={},sourceStatus={},applicability={};
    for(const field of Object.keys(values)){
      pathParts(field);
      const rawKey=mapping[field]||field,metadata=fields[rawKey];
      const refs=Array.isArray(metadata?.sourceRefs)?copy(metadata.sourceRefs):[];
      const status=refs.length&&typeof metadata?.status==='string'?metadata.status:'missing';
      provenance[field]={origin:'standard',rawKey,sourceRefs:refs,verification:metadata?.verification??null,status};
      if(present(metadata?.note))provenance[field].note=copy(metadata.note);
      if(present(metadata?.unit))provenance[field].unit=copy(metadata.unit);
      for(const bound of ['nominal','min','max'])if(present(metadata?.[bound]))provenance[field][bound]=copy(metadata[bound]);
      sourceStatus[field]=status;
      if(status!=='verified'||metadata?.verification===false)issues.push({code:refs.length?'source-not-verified':'source-missing',path:field,status});
      // b and the limiting plain/threaded shaft lengths depend on l. The legacy
      // draft also selects short/long drive depths; neither may become a valid
      // norm value for an unresearched length merely because a base row exists.
      const dependsOnLength=lengthDependent.has(field)||lengthDependent.has(rawKey)||metadata?.dependsOn?.includes('laenge')||['b','lg','ls','sL'].includes(field)||/^b_ref(?:_|$)|^t_min_(?:kurz|lang)$/.test(rawKey);
      applicability[field]=!record(lengthRow)&&dependsOnLength?'unresolved':'resolved';
      if(applicability[field]==='unresolved')issues.push({code:'length-dependent-value-unresolved',path:field});
    }
    const definition={};
    for(const key of ['funktion','klasse','kopfTyp','antrieb','schaftende','schaftform'])if(present(family?.[key]))definition[key]=copy(family[key]);
    const retainedValues={};
    const previousBaseline={...valuesFrom(prior.retainedValues),...valuesFrom(prior.normBaseline?.values)};
    for(const [field,value]of Object.entries(previousBaseline))if((!own(values,field)||applicability[field]==='unresolved')&&present(value)){
      retainedValues[field]=copy(value);
      issues.push({code:'value-retained-without-standard',path:field,from:copy(prior.standardReference||null)});
    }
    // Absence of a row is a coverage gap, not evidence that a norm forbids it.
    const next={schemaVersion:SCHEMA_VERSION,revision:(prior.revision||0)+1,standardReference:reference,
      normBaseline:{id:JSON.stringify(reference),values,raw,definition,provenance,sourceStatus,applicability},
      overrides,retainedValues,partSnapshot:copy(prior.partSnapshot||{}),effective:{},issues};
    return materialize(next);
  }
  function setOverride(document,path,value){
    pathParts(path);if(!present(value))throw new TypeError('Use resetOverride to restore one norm value.');
    const next=validDocument(document);next.overrides[path]={value:copy(value),origin:'customer'};next.revision++;
    return materialize(next);
  }
  function resetOverride(document,path){
    pathParts(path);const next=validDocument(document);
    if(own(next.overrides,path)&&!hasPath(next.normBaseline.values,path)&&!hasPath(next.retainedValues,path)){
      next.issues.push({code:'reset-baseline-unavailable',path});next.revision++;
      return materialize(next);
    }
    delete next.overrides[path];next.revision++;
    return materialize(next);
  }
  function snapshot(document){return validDocument(document);}
  function restore(value){return materialize(validDocument(typeof value==='string'?JSON.parse(value):value));}
  return Object.freeze({SCHEMA_VERSION,resolveStandard,setOverride,resetOverride,snapshot,restore});
});
