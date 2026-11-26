import machines from '../maschinen.json' with {type:'json'};

const normalize=value=>String(value||'').toUpperCase().replace(/[\s‐‑–—-]/g,'');
const catalog=new Map(machines.map(machine=>[normalize(machine.m),machine]));
const modelPattern=()=>/\bJ(?:NFP|NFR|BF|BP|NP|PF|NF)[\s‐‑–—-]*\d+[A-Z0-9‐‑–—-]*/gi;
export const catalogModel=value=>catalog.get(normalize(value))||null;
export const modelMentions=text=>[...String(text||'').matchAll(modelPattern())].map(match=>match[0]);
export const qualitativeCatalog=()=>({
 columns:['model','stations','nominalCutoffDiameterMm','cutoffLengthMm','nominalForceT','dieKnockoutMm','punchKnockoutMm','turningLengthMm','gripperOpeningMm','productEnvelopeMm'],
 rows:machines.map(m=>[m.m,m.st??null,m.cd??null,m.cl??null,m.pw??null,m.ko??null,m.pko??null,m.kor??null,m.q??null,m.ps??null])
});

// A named model is not by itself a recommendation. Only affirmative candidate
// language in the final assistant answer can produce an enquiry card. Negative
// mentions, comparisons and unanswered questions remain ordinary prose.
const negative=/(?:ungeeignet|nicht\s+(?:[\p{L}]+\s+){0,3}(?:geeignet|empfehlenswert|machbar|passend|in\s+(?:Frage|Betracht))|nicht\s+(?:zu\s+)?empfehl|nicht\s+(?:anfragen|auswählen|wählen)|passt\s+(?:[\p{L}]+\s+){0,2}nicht|kein(?:e[nsr]?)?\s+(?:[\p{L}]+\s+){0,2}(?:Kandidat|Option|Empfehlung)|ausgeschloss|ausschlie[ßs]|scheidet\s+aus|passt\s+nicht|zu\s+(?:klein|groß|gross|wenig|schwach)|nicht\s+ausreichend|(?:not|never)\s+(?:[\p{L}]+\s+){0,3}(?:suitable|feasible|recommend|viable|candidate|option)|unsuitable|excluded|rule(?:d)?\s+out|too\s+(?:small|large|weak)|insufficient|non\s+(?:[\p{L}]+\s+){0,2}(?:adatt|idone|consigli|fattibil)|esclus|troppo\s+(?:piccol|grand)|ni\s+(?:[\p{L}]+\s+){0,2}(?:primer|izvedljiv)|neprimern|izklju[čc]|premal|prevelik|不适合|不合适|不推荐|不建议|不建議|不宜|不可行|排除|不应|太小|不足)/iu;
const affirmative=/(?:Kandidat|geeignet|machbar|Machbarkeit|plausibel|in\s+(?:Frage|Betracht)|anfrag|prüf|empfehl|vorzugs|erste\s+Wahl|näher|nahe\s+an|möglich|m[oö]gliche\s+Option|candidate|suitable|feasib|consider|recommend|enquir|inquir|shortlist|viable|plausible|promising|potential|closer|prefer|candidat|adatt|idone|valut|propor|consigli|fattibil|richied|kandidat|primeren|prever|predlag|izvedljiv|možnost|候选|可行|适合|考虑|推荐|询价|询问|接近|建议)/iu;
const quotedOrComparison=/(?:[“”„«»"「」『』]|\b(?:Beispiel|example|esempio|primerjava|Vergleichsmodell|comparison\s+only|Kunde\s+(?:nennt|fragt|sagt)|Nutzer\s+(?:nennt|fragt|sagt)|customer\s+(?:asks|said|mentions))\b)/iu;
const hardExcluded=row=>row?.status==='nein'||row?.concept?.status==='excluded'||row?.criteria?.some(criterion=>criterion.status==='nein');
function packageSixOrder(rows){
 const tier=row=>['ok','knapp'].includes(row.status)?0:row.status==='offen'?1:2;
 const price=row=>{const n=catalogModel(row.model)?.rp;return Number.isFinite(n)&&n>0?n:Infinity;};
 const seen=new Set(),excluded=new Set(rows.filter(hardExcluded).map(row=>normalize(row.model)));
 return rows.filter(row=>{const m=catalogModel(row?.model);if(!m||excluded.has(normalize(m.m))||seen.has(m.m))return false;seen.add(m.m);return true;}).sort((a,b)=>tier(a)-tier(b)||price(a)-price(b)||a.model.localeCompare(b.model,'en')).slice(0,3);
}
function knownMechanicalExclusion(machine,proposal){
 if(!proposal?.calculation)return false;
 const values=proposal.calculation.values||{},input=proposal.calculation.input||{};
 const positive=value=>Number.isFinite(value)&&value>0;
 const exceeds=(required,available)=>positive(required)&&positive(available)&&required>available;
 const diameter=values.d0??input.d0,stations=values.stationen??(proposal.stages?.length||null);
 const ko=values.koVorgabe?values.ko:input.vorgaben?.ko,pko=values.pkoVorgabe?values.pko:input.vorgaben?.pko;
 if(exceeds(diameter,machine.cd)||exceeds(stations,machine.st)||exceeds(ko,machine.ko)||exceeds(pko,machine.pko))return true;
 if(positive(values.L0)&&Array.isArray(machine.cl)&&(positive(machine.cl[0])&&values.L0<machine.cl[0]||exceeds(values.L0,machine.cl[1])))return true;
 return !!values.wenden&&exceeds(values.Lteil,machine.kor);
}

export function qualitativeMachineCards(answer,suggestions=[],proposal=null,excludedModels=[],options={}){
 const excluded=new Set([...excludedModels,...(proposal?.machines||[]).filter(hardExcluded).map(row=>row.model)].map(normalize));
 const existing=new Set((proposal?.machines||[]).map(row=>normalize(row.model)));
 const declared=new Map((Array.isArray(suggestions)?suggestions:[]).filter(item=>item&&typeof item.model==='string'&&typeof item.reason==='string'&&item.reason.trim()).map(item=>[normalize(item.model),item.reason.trim()]));
 const positive=new Map(),contexts=new Map();let headingModels=[];
 // Keep question marks to avoid turning a question into a candidate. Split
 // contrast clauses so an excluded small model does not hide its alternative.
 const clauses=String(answer||'').split(/(?<=[.!?。！？;；])\s+|\r?\n|[;；]|,?\s+(?:aber|but|however|invece|tuttavia|vendar)\s+/iu);
 for(const clause of clauses){
  const mentions=modelMentions(clause).map(catalogModel).filter(Boolean);
  if(mentions.length){
   const headingOnly=clause.replace(modelPattern(),'').replace(/[\s#*_:–—-]/gu,'')==='';
   headingModels=headingOnly?mentions:[];
  }else if(/^\s*#/u.test(clause))headingModels=[];
  else if(headingModels.length&&negative.test(clause)&&/^\s*(?:[-*]\s*)?(?:nicht|ungeeignet|ausgeschlossen|ist\s+nicht|not|unsuitable|excluded|non|ni\s|不|排除)/iu.test(clause))headingModels.forEach(model=>excluded.add(normalize(model.m)));
  for(const model of mentions){const key=normalize(model.m);if(!contexts.has(key))contexts.set(key,[]);contexts.get(key).push(clause);}
  if(negative.test(clause)){mentions.forEach(model=>excluded.add(normalize(model.m)));continue;}
  if(/[?？]/u.test(clause)||quotedOrComparison.test(clause))continue;
  for(const model of mentions){
   const key=normalize(model.m);
   if(!affirmative.test(clause))continue;
   if(!positive.has(key))positive.set(key,{model,reason:clause.trim().slice(0,800)});
  }
 }
 // Explicit suggestions may use a model heading and a separate explanation.
 // Both must be in this accepted answer; declarations never revive exclusions.
 for(const [key,reason] of declared){
  const model=catalog.get(key),places=contexts.get(key)||[];
  if(model&&answer.includes(reason)&&!negative.test(reason)&&places.some(clause=>!/[?？]/u.test(clause)&&!quotedOrComparison.test(clause)))positive.set(key,{model,reason:reason.slice(0,800)});
 }
 const order=[...new Set([...declared.keys(),...positive.keys()])];
 const eligible=order.filter(key=>positive.has(key)&&!excluded.has(key)&&!existing.has(key)&&!knownMechanicalExclusion(positive.get(key).model,proposal));
 const cards=(options.packageSix===true?eligible:eligible.slice(0,5)).map(key=>{
  const entry=positive.get(key);
  const m=entry.model;
  return {model:m.m,status:'offen',selectionBasis:'qualitative',reason:entry.reason,catalog:{id:m.kat,page:m.s},
   catalogSpecs:{stations:m.st??null,nominalCutoffDiameterMm:m.cd??null,cutoffLengthMm:m.cl??null,dieKnockoutMm:m.ko??null,punchKnockoutMm:m.pko??null,turningLengthMm:m.kor??null,gripperOpeningMm:m.q??null,productEnvelopeMm:m.ps??null},
   utilization:null,planningOutput:null,criteria:[],openPoints:[],concept:null,
   priceEUR:m.rp||null,priceRangeEUR:m.lo&&m.hi?[m.lo,m.hi]:null};
 });
 return options.packageSix===true?packageSixOrder(cards):cards;
}

export function withQualitativeMachines(proposal,cards,knowledgeVersion,options={}){
 if(options.packageSix===true&&proposal?.calculation){
  // Preserve the numerical ranker's deliberately different alternatives. Text
  // candidates can only fill free places, never replace checked recommendations.
  const known=(proposal.machines||[]).filter(row=>!hardExcluded(row)),excluded=new Set((proposal.machines||[]).filter(hardExcluded).map(row=>normalize(row.model)));
  const extra=packageSixOrder(cards.filter(row=>!excluded.has(normalize(row.model))&&!known.some(item=>normalize(item.model)===normalize(row.model))));
  return {...proposal,machines:[...known,...extra].slice(0,3)};
 }
 if(!cards.length)return options.packageSix===true&&proposal?{...proposal,machines:packageSixOrder(proposal.machines||[])}:proposal;
 const rows=[...(proposal?.machines||[]),...cards],selected=options.packageSix===true?packageSixOrder(rows):rows;
 if(proposal)return {...proposal,machines:selected};
 return {classification:'qualitative',selectionBasis:'qualitative',machines:selected,input:[],stages:[],assumptions:[],calculationBasis:[],limits:[],rules:[],calculation:null,knowledgeVersion};
}
