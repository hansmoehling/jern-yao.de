(function(root){
'use strict';
const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Keep complete engine operations separate: translating a German sentence
// assembled with "und" must not fall back to replacing individual words.
function stageText(stage,language='de'){
 const operation=typeof stage==='string'?stage:stage?.operation||stage?.v||'';
 const legacy=/^(Reduzieren [\d,.]+ → [\d,.]+ \([\d,.]+ %\)) und ((?:Vorstauchen|Zwischenstauchen|Kopf fertigstauchen|Sechskantkopf fertigstauchen).*)$/.exec(operation);
 const parts=Array.isArray(stage?.operationParts)&&stage.operationParts.length?stage.operationParts:legacy?legacy.slice(1):[operation];
 return parts.map(part=>root.JYI18N.t(part,language)).join(' · ');
}
function forceText(stage,language='de'){
 const I=root.JYI18N,finite=value=>typeof value==='number'&&Number.isFinite(value),num=(value,digits=1)=>value.toLocaleString(I.numberLocale(language),{maximumFractionDigits:digits,minimumFractionDigits:digits});
 const message=(key,values)=>I.t(key,language).replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?values[key]:match);
 const validBand=band=>band&&finite(band.min)&&finite(band.max)&&band.min>0&&band.max>=band.min;
 const result={status:'',band:'',pressure:'',pressureBand:''};
 if(!['extrapoliert','calculated','missing'].includes(stage?.forceStatus))return result;
 if(stage.forceStatus==='extrapoliert'&&finite(stage.forceExtrapolation?.phiMax))result.status=message('extrapoliert über φ {value}',{value:num(stage.forceExtrapolation.phiMax)});
 if(validBand(stage.forceBand?.t)&&stage.forceBand.t.max>stage.forceBand.t.min)result.band=message('Kraftband {min}–{max} t',{min:num(stage.forceBand.t.min),max:num(stage.forceBand.t.max)});
 if(finite(stage.pStempel)&&stage.pStempel>0)result.pressure=message('Stempelpressung {value} N/mm²',{value:num(stage.pStempel,0)});
 if(validBand(stage.pStempelBand)&&stage.pStempelBand.max>stage.pStempelBand.min)result.pressureBand=message('Stempelpressung im Band {min}–{max} N/mm²',{min:num(stage.pStempelBand.min,0),max:num(stage.pStempelBand.max,0)});
 return result;
}
function rationaleText(concept,language='de'){
 if(Array.isArray(concept?.failedCriteria)&&concept.failedCriteria.length)return root.JYI18N.t('Kein Stadienkonzept zugeordnet. Nicht erfüllt: {criteria}.',language).replace('{criteria}',concept.failedCriteria.map(key=>root.JYI18N.t(key,language)).join(', '));
 const text=concept?.rationale||'';
 const parts=Array.isArray(concept?.rationaleParts)&&concept.rationaleParts.length?concept.rationaleParts:text.startsWith('Gleiche berechnete Basisfolge: ')?text.split(/(?<=\.) (?=[A-ZÄÖÜ])/u):[text];
 return parts.map(part=>root.JYI18N.t(part,language)).join(' ');
}
function locationText(stage,language='de'){
 const locations=Array.isArray(stage?.operations)&&stage.operations.length?[...new Set(stage.operations.map(op=>op.location).filter(Boolean))]:[stage?.location].filter(Boolean);
 return locations.map(value=>root.JYI18N.t(value,language)).join('; ');
}
function preparationText(preparation,language='de'){
 if(preparation?.type!=='inline-drawing')return '';
 const I=root.JYI18N,num=value=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString(I.numberLocale(language),{maximumFractionDigits:3}):I.t('nicht belegt',language);
 const values={rod:num(preparation.rodDiameter),wire:num(preparation.wireDiameter),reduction:num(typeof preparation.areaReduction==='number'?preparation.areaReduction*100:null),strain:num(preparation.prestrain)};
 return I.t('Inline-Vorzug: Ø {rod} → Ø {wire} mm; Querschnittsabnahme {reduction} %; Vorverformung φ = {strain}.',language).replace(/\{(\w+)\}/g,(match,key)=>Object.hasOwn(values,key)?values[key]:match);
}
function html(concept,language='de'){
 if(!concept||typeof concept!=='object')return '';
 const I=root.JYI18N,tr=s=>I.t(s,language),num=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString(I.numberLocale(language),{maximumFractionDigits:3}):tr('nicht belegt');
 const status={candidate:'Konzeptkandidat',unsuitable:'Nicht geeignet',incomplete:'Konzept noch unvollständig'};
 let out='<section class="concept"><h4>'+esc(tr('Stadienkonzept für diese Maschine'))+'</h4><p>'+esc(tr(status[concept.status]||'Konzept noch unvollständig'))+'</p>';
 if(concept.blank)out+='<p><strong>'+esc(tr('Abschnitt Ø × Länge'))+':</strong> '+esc(num(concept.blank.diameter))+' × '+esc(num(concept.blank.length))+' '+esc(concept.blank.unit||'mm')+'</p>';
 if(concept.drive)out+='<p><strong>'+esc(tr('Innenantrieb'))+':</strong> '+esc(tr(concept.drive.label))+' · '+esc(tr('Tiefe'))+' '+esc(num(concept.drive.depth))+' mm</p>';
 out+='<p>'+esc(tr('Benötigte Stationen'))+': '+esc(num(concept.requiredStations))+' · '+esc(tr('Verfügbare Stationen'))+': '+esc(num(concept.availableStations))+' · '+esc(tr('Reserve'))+': '+esc(num(concept.reserveStations))+'</p>';
 const preparation=preparationText(concept.preparation,language);
 if(preparation){out+='<p>'+esc(preparation)+'</p>';if(typeof concept.preparation.assumption==='string')out+='<p class="small">'+esc(tr(concept.preparation.assumption))+'</p>';}
 if(Array.isArray(concept.stages)&&concept.stages.length){out+='<ol>';for(const stage of concept.stages){
  out+='<li><strong>'+esc(tr(concept.status==='incomplete'||stage.kind==='unassigned'?'Arbeitsschritt':'Stadium'))+' '+esc(stage.number)+': '+esc(stageText(stage,language))+'</strong>';
  const force=forceText(stage,language);
  if(force.status)out+='<div class="stage-force-status">'+esc(force.status)+'</div>';
  const forceDetails=[force.band,force.pressure,force.pressureBand].filter(Boolean);
  if(forceDetails.length)out+='<div class="small">'+forceDetails.map(esc).join(' · ')+'</div>';
  const location=locationText(stage,language);
  if(location)out+='<div>'+esc(location)+'</div>';
  if(Array.isArray(stage.operations)&&stage.operations.length>1)out+='<ul>'+stage.operations.map(op=>'<li>'+esc(tr(op.name||''))+(op.location?' · '+esc(tr(op.location)):'')+'</li>').join('')+'</ul>';
  out+='</li>';
 }out+='</ol>';}
 if(concept.rationale||concept.rationaleParts)out+='<p>'+esc(rationaleText(concept,language))+'</p>';
 return out+'</section>';
}
root.JYConcept={html,preparationText,stageText,forceText,rationaleText,locationText};
if(typeof module==='object'&&module.exports)module.exports={html,preparationText,stageText,forceText,rationaleText,locationText};
})(typeof window==='object'?window:globalThis);
