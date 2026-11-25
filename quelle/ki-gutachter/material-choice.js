import Engine from '../engine.js';
import translations from './i18n-material-choice.json' with {type:'json'};
import rmTranslations from '../i18n-rm.json' with {type:'json'};

export const DRAWING_DEFAULTS_VERSION='drawing-defaults-v1';
export const ASSUMPTION_REASON='Keine Werkstoffangabe erkannt; Vorbelegung C4C weichgeglüht.';
export const ASSUMPTION_NOTICE='Werkstoffannahme C4C weichgeglüht: keine Werkstoffangabe erkannt; vorläufige Rechenbasis, keine bestätigte Zeichnungs- oder Lieferangabe.';
export const MATERIAL_QUESTION='Welcher Werkstoff und Lieferzustand sind tatsächlich vorgesehen? Die Vorauswahl läuft bis dahin mit der gekennzeichneten Annahme weiter.';
export const CHOICE_CONFLICT='Die Werkstoffangabe der Zeichnung hat Vorrang vor der abweichenden Kundenauswahl. Bitte die Abweichung bestätigen.';
export const CHOICE_ERROR='Bitte eine freigegebene Kombination aus Werkstoff, Lieferzustand und Fließkurve auswählen.';
const STATE_LABELS={'soft-annealed':'weichgeglüht','cold-drawn':'gezogen','normalized-rolled':'normalisierend warmgewalzt'};
const SOFT_STATE_CONFLICT=/kaltgezogen|vorverfestigt|cold[ -]?drawn|work[ -]?hardened|vergütet|quenched|tempered|normalisierend|normalizacijsko|normali[sz](?:ed|ing)[ -]+(?:hot[ -]+)?roll|trafilat[oa]|vle[čc]en|冷拉|冷拔|正火|nicht\s+(?:weich)?geglüht|not\s+(?:soft[ -]?)?annealed|\+(?:LC|QT|C)\b|\bT[456789]\d?\b/i;
const STATE_CHOICE_CONFLICT='Die Lieferzustandsangabe aus Zeichnung oder Text widerspricht der Auswahl. Der Zustand wird nicht durch die Auswahl ersetzt; ohne passende Fließkurve bleiben Kräfte offen.';
export const materialText=(key,language='de')=>(translations[key]||rmTranslations[key])?.[['it','sl','en','zh'].indexOf(language)]||key;
export const drawingDefaultsEnabled=context=>context?.featureVersion===DRAWING_DEFAULTS_VERSION&&!!context.file;
const text=value=>typeof value==='string'?value.trim():'';
const original=context=>[context.note,context.message,...(context.history||[]).filter(item=>item.role==='user').map(item=>item.content)].filter(Boolean).join('\n');
const sameMaterial=(a,b)=>!!a&&!!b&&Engine.findMaterial(a)?.id===Engine.findMaterial(b)?.id;

// A selection is a catalogue identity, not arbitrary client evidence or a
// client-supplied material model. The approved state/curve pairing is checked.
export function validateMaterialChoice(value){
 if(value===undefined||value===null||value==='')return null;
 let choice=value;
 if(typeof value==='string'){if(value.length>2000)throw new Error(CHOICE_ERROR);try{choice=JSON.parse(value);}catch{throw new Error(CHOICE_ERROR);}}
 if(!choice||Array.isArray(choice)||typeof choice!=='object'||choice.origin!=='user_selection'||Object.keys(choice).some(key=>!['materialId','curveId','materialState','origin'].includes(key)))throw new Error(CHOICE_ERROR);
 const material=Engine.findMaterial(choice.materialId),curve=material?.flowCurves?.find(item=>item.id===choice.curveId&&item.state===choice.materialState&&item.eligible===true);
 if(!material?.manualEligible||!curve)throw new Error(CHOICE_ERROR);
 return {materialId:material.id,curveId:curve.id,materialState:curve.state,origin:'user_selection'};
}
export function defaultMaterialChoice(){
 const material=Engine.findMaterial('C4C'),curve=material?.flowCurves?.find(item=>item.eligible===true&&item.state==='soft-annealed');
 if(!curve)throw new Error('default_material_unavailable');
 return {materialId:material.id,curveId:curve.id,materialState:curve.state,origin:'assumption'};
}
function sourced(input,context){
 const material=text(input?.material),e=input?.materialEvidence,quote=text(e?.quote);
 if(!material||!quote||!quote.toLowerCase().includes(material.toLowerCase()))return false;
 return e.origin==='drawing'?!!context.file&&Number.isInteger(e.page)&&e.page>0:e.origin==='user_text'&&original(context).includes(quote);
}
function sourcedState(input,context){
 const evidence=input?.materialStateEvidence,quote=text(evidence?.quote);
 return !!quote&&(evidence.origin==='drawing'?!!context.file&&Number.isInteger(evidence.page)&&evidence.page>0:evidence.origin==='user_text'&&original(context).includes(quote));
}
function selectionTextConflict(state,source){
 if(state==='soft-annealed')return SOFT_STATE_CONFLICT.test(source);
 // Explicitly stating that annealing did not happen does not contradict a
 // drawn or normalizing-rolled state. Other thermal states remain conflicts.
 const thermalSource=source.replace(/\b(?:not\s+(?:soft[ -]?)?annealed|unannealed|nicht\s+(?:weich)?geglüht|non\s+ricott[oa]|ni\s+(?:mehko\s+)?[žz]arjen[ao]?)\b|未(?:经|經)?(?:软化|軟化)?退火/gi,' ');
 const thermal=/geglüht|annealed|spheroidi[sz]ed|ricott[oa]|[žz]arjen|退火|vergütet|quenched|tempered|bonificat[oa]|\+QT\b|\bT[456789]\d?\b/i.test(thermalSource);
 if(state==='cold-drawn')return thermal||/normalisierend|normalisiert|normali[sz]ed|normalizacijsko|正火|nicht\s+(?:kalt)?gezogen|not\s+(?:cold[ -]?)?drawn/i.test(source);
 if(state==='normalized-rolled')return thermal||/kaltgezogen|cold[ -]?drawn|trafilat[oa]|vle[čc]en|冷拉|冷拔|\+(?:LC|C)\b/i.test(source);
 return false;
}
function userMaterial(context,selectedMaterial){
 // Explicit grade text must never be converted to an assumed substitute just
 // because a model omitted the material in its tool call. Unsupported grades
 // remain unsupported; no lookup of equivalent grades is performed.
 const source=[context.note,...(context.history||[]).filter(item=>item.role==='user').map(item=>item.content),context.message].filter(Boolean).join('\n'),tokens=source.match(/\b(?:AISI\s*\d{4}|EN\s*AW[- ]\d{4}|1\.\d{4}|C\d{1,3}(?:C|EC|E)?|\d{1,2}(?:Mn|Cr|Ni|Mo|B)[A-Za-z0-9-]{1,20}|Cu(?:Zn|Sn)\d{1,2}(?:Pb\d)?|Al\s*99[,.]5|AlMgSi1)\b/gi)||[];
 const material=(selectedMaterial&&tokens.find(token=>!sameMaterial(token,selectedMaterial)))||tokens.at(-1);
 return material?{material}:null;
}
function selectedInput(choice){
 const assumption=choice.origin==='assumption',reason=assumption?ASSUMPTION_REASON:undefined;
 const evidence={origin:choice.origin,reference:assumption?'Werkstoffannahme':'Werkstoffauswahl des Kunden',...(reason?{reason}:{}),quote:choice.materialId};
 return {material:choice.materialId,materialEvidence:evidence,curveId:choice.curveId,materialState:choice.materialState,materialStateEvidence:{...evidence,quote:STATE_LABELS[choice.materialState]}};
}
export function resolveDrawingMaterial(input={},context={}){
 if(!drawingDefaultsEnabled(context))return {input};
 const choice=validateMaterialChoice(context.materialChoice),given=input||{};
 let resolved=given;
 if(sourced(given,context)&&given.materialEvidence.origin==='drawing')resolved=given;
 else if(context.drawingMaterial&&sourced(context.drawingMaterial,context)&&context.drawingMaterial.materialEvidence.origin==='drawing')resolved={...given,...context.drawingMaterial};
 else if(sourced(given,context))resolved=given;
 else {
  const stated=userMaterial(context,choice?.materialId);
  // A grade mention can be a rejection or comparison. It blocks an automatic
  // substitute, but only the model's attributable affirmative evidence may
  // turn it into a material input. Do not manufacture a user_text provenance.
  if(stated&&(!choice||!sameMaterial(stated.material,choice.materialId)))return {input:{...given,...stated,materialEvidence:undefined,curveId:'',materialState:'unknown',materialStateEvidence:undefined}};
  else if(choice)resolved={...given,...selectedInput(choice)};
  else if(text(given.material)&&given.materialEvidence?.origin!=='assumption')return {input:given};
  else {
   if(given.materialEvidence?.origin==='assumption'&&(!text(given.materialEvidence.reason)||text(given.material)&&!sameMaterial(given.material,'C4C')))return {input:given,error:'Eine Werkstoffannahme benötigt eine Begründung und darf keine vorhandene Werkstoffangabe ersetzen.'};
   resolved={...given,...selectedInput(defaultMaterialChoice())};
   const stateEvidence=given.materialStateEvidence,stateQuote=text(stateEvidence?.quote);
   const hasStateSource=sourcedState(given,context),stateConflict=SOFT_STATE_CONFLICT.test(original(context)+'\n'+stateQuote);
   if(hasStateSource&&given.materialState&&given.materialState!=='soft-annealed'||stateConflict){
    resolved.materialState=hasStateSource?given.materialState||'unknown':'unknown';
    resolved.materialStateEvidence=hasStateSource?stateEvidence:undefined;
    resolved.curveId='';
    resolved.materialEvidence.reason='Keine Werkstoffangabe erkannt; Vorbelegung C4C unter Beachtung des angegebenen Lieferzustands.';
   }
  }
 }
 if(choice&&sameMaterial(resolved.material,choice.materialId)&&(!resolved.materialState||resolved.materialState==='unknown')&&!resolved.materialStateEvidence){
  const selected=selectedInput(choice);
  resolved={...resolved,curveId:selected.curveId,materialState:selected.materialState,materialStateEvidence:selected.materialStateEvidence};
 }
 let selectionStateConflict=false;
 if(choice&&resolved.materialStateEvidence?.origin==='user_selection'){
  // The dropdown supplies a state only while neither the drawing nor genuine
  // user text specifies another. In particular, do not overwrite a state-only
  // drawing observation merely because its material grade was not repeated.
  const stateSource=[given,context.materialStateSource].filter(item=>sourcedState(item,context)&&(!text(item.material)||sameMaterial(item.material,resolved.material))).sort((a,b)=>(a.materialStateEvidence.origin==='drawing'?0:1)-(b.materialStateEvidence.origin==='drawing'?0:1))[0];
  if(stateSource){
   const state=stateSource.materialState||'unknown',curve=Engine.findMaterial(resolved.material)?.flowCurves?.find(item=>item.state===state&&item.eligible===true);
   resolved={...resolved,materialState:state,materialStateEvidence:stateSource.materialStateEvidence,curveId:curve?.id||''};
   selectionStateConflict=state!==choice.materialState;
  }else if(selectionTextConflict(choice.materialState,original(context))){
   // A conflicting textual mention is not a verified state assignment. Keep
   // it unresolved instead of manufacturing a user_text or drawing source.
   resolved={...resolved,materialState:'unknown',materialStateEvidence:undefined,curveId:''};
   selectionStateConflict=true;
  }
 }
 const evidence=resolved.materialEvidence;
 if(!evidence)return {input:resolved};
 const sourceLabels={drawing:'Zeichnungsangabe Werkstoff',user_text:'Nutzerangabe Werkstoff',user_selection:'Werkstoffauswahl des Kunden',assumption:'Werkstoffannahme'};
 const material=Engine.findMaterial(resolved.material),assumption=evidence.origin==='assumption';
 if(!material&&!/^(?:AISI\s*\d{4}|EN\s*AW[- ]\d{4}|1\.\d{4}|C\d{1,3}(?:C|EC|E)?|\d{1,2}(?:Mn|Cr|Ni|Mo|B)[A-Za-z0-9-]{1,20}|Cu(?:Zn|Sn)\d{1,2}(?:Pb\d)?)$/i.test(text(resolved.material)))return {input:resolved};
 const conflict=!!choice&&evidence.origin==='drawing'&&(!sameMaterial(resolved.material,choice.materialId)||resolved.materialState&&resolved.materialState!=='unknown'&&resolved.materialState!==choice.materialState);
 const materialContext={materialId:material?.id||text(resolved.material).slice(0,60),origin:evidence.origin,materialState:resolved.materialState||'unknown',stateOrigin:resolved.materialStateEvidence?.origin||null,curveId:resolved.curveId||null,assumption,sourceLabel:materialText(sourceLabels[evidence.origin]||'Nutzerangabe Werkstoff',context.language),...(assumption?{reason:materialText(resolved.materialEvidence.reason,context.language),notice:materialText(resolved.materialState==='soft-annealed'?ASSUMPTION_NOTICE:'Werkstoffannahme C4C: keine Werkstoffangabe erkannt; der angegebene Lieferzustand bleibt maßgeblich. Kräfte bleiben ohne passende Fließkurve offen.',context.language)}:{}),...(conflict||selectionStateConflict?{conflict:materialText(selectionStateConflict?STATE_CHOICE_CONFLICT:CHOICE_CONFLICT,context.language)}:{})};
 const sourceInput=Object.fromEntries(['material','materialEvidence','curveId','materialState','materialStateEvidence'].filter(key=>resolved[key]!==undefined).map(key=>[key,resolved[key]]));
 return {input:resolved,materialContext,sourceInput};
}
