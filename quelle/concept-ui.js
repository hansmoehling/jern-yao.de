(function(root){
'use strict';
const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
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
  out+='<li><strong>'+esc(tr('Stadium'))+' '+esc(stage.number)+': '+esc(tr(stage.operation||''))+'</strong>';
  if(stage.location)out+='<div>'+esc(tr(stage.location))+'</div>';
  if(Array.isArray(stage.operations)&&stage.operations.length>1)out+='<ul>'+stage.operations.map(op=>'<li>'+esc(tr(op.name||''))+(op.location?' · '+esc(tr(op.location)):'')+'</li>').join('')+'</ul>';
  out+='</li>';
 }out+='</ol>';}
 if(concept.rationale)out+='<p>'+esc(tr(concept.rationale))+'</p>';
 return out+'</section>';
}
root.JYConcept={html,preparationText};
if(typeof module==='object'&&module.exports)module.exports={html,preparationText};
})(typeof window==='object'?window:globalThis);
