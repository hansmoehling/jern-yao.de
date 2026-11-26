import catalog from '../../maschinen.json' with {type:'json'};

// Public code only. Cases are supplied by the private, reviewed snapshot.
// This module has no path that publishes a manifest or activates a proposal.
export const KVP_SCHEMA_VERSION=1;
const CLASSES=['schraube','niet','bolzen','mutter','formteil'];
const TOPOLOGIES=['kopf-schaft','kopf-schaft-napf','stufenkoerper','huelse','ring','mutter-durchgang','mutter-sackloch','massiv','unbekannt'];
const MATERIALS=['unlegiert-weich','borstahl','legiert-weich','rostfrei','kupfer','messing','aluminium','unbekannt'];
const OUTCOMES=['laeuft','laeuft_mit_muehe','nicht_machbar','nur_konzept'];
const OPERATIONS=['Abscheren','Planstauchen','Vorstauchen Kopf','Vorstauchen rund','Fertigstauchen','Kopf formen','Sechskant formen','Vierkant formen','Bund formen','Bund fertigformen','Vorwärtsfließpressen','Rückwärtsfließpressen','Reduzieren','Vorlochen','Beidseitig vorlochen','Napf vertiefen','Napf vertiefen bis Butzen','Butzen auslochen','Lochen','Kalibrieren','Beschnitt','Wenden','Antrieb prägen','Innengewinde nacharbeiten'];
const FEEDBACK=['passt','zu_viele_stadien','zu_wenige_stadien','andere_reihenfolge'];
const LIMITS={d0:[0.1,100],L0_d0:[0,100],kopfvolumenanteil:[0,1],stauch_h0_d0_max:[0,100],napf_t_d:[0,100],reduktion_max:[0,1],rm:[1,5000],restwand_d:[0,10],stempelpressung:[0,100000]};
// Explicit initial distance scales, not learned facts or manufacturing limits.
export const DISTANCE_SCALES=Object.freeze({d0:10,L0_d0:2,kopfvolumenanteil:1,stauch_h0_d0_max:2,napf_t_d:1,reduktion_max:0.25,rm:400,restwand_d:1,stempelpressung:1000});
const BAND_METRICS=['stauch_h0_d0_max','reduktion_max','napf_t_d','restwand_d','stempelpressung'];
const STAGE_LIMITS={h0_d0:[0,100],reduktion:[0,1],napf_t_d:[0,100],restwand_d:[0,10],stempelpressung:[0,100000],kraft_gerechnet_kN:[0,100000],kraft_gemessen_kN:[0,100000]};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const has=(x,k)=>Object.hasOwn(x,k);
const own=(raw,key)=>object(raw)&&has(raw,key)?raw[key]:undefined;
const error=code=>{throw new Error(code);};
const checked=(value,[min,max],code='invalid_learning_number')=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)error(code);
  return value;
};
const enumValue=(value,values)=>{if(!values.includes(value))error('invalid_learning_enum');return value;};
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const approved=raw=>raw?.freigegeben===true&&raw?.freigabe?.von==='Hans'&&date(raw.freigabe.am);
const manifestReady=manifest=>manifest?.schemaVersion===1&&approved(manifest)&&typeof manifest.version==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(manifest.version);
function rejectUnknown(raw,keys){if(!object(raw)||Object.keys(raw).some(key=>!keys.includes(key)))error('invalid_learning_fields');}
function numbers(raw,limits){
  const out={};
  if(raw!==undefined&&!object(raw))error('invalid_learning_features');
  for(const [key,range]of Object.entries(limits))if(own(raw,key)!==undefined)out[key]=checked(raw[key],range);
  return out;
}

/** Whitelist projection. Unknown/private keys are never copied. */
export function projectFeatures(raw){
  if(!object(raw))error('invalid_learning_features');
  const values=numbers(raw.merkmale,LIMITS);
  if(own(raw.merkmale,'werkstoffgruppe')!==undefined)values.werkstoffgruppe=enumValue(raw.merkmale.werkstoffgruppe,MATERIALS);
  return {klasse:enumValue(raw.klasse,CLASSES),topologie:enumValue(raw.topologie,TOPOLOGIES),merkmale:values};
}

/** Deliberately excludes source refs, approval identities, notes and raw geometry. */
export function projectCase(raw){
  if(!object(raw)||typeof raw.id!=='string'||!/^F-\d{4,8}$/.test(raw.id))error('invalid_learning_case');
  const projected={schemaVersion:1,id:raw.id,...projectFeatures(raw),stadien:[]};
  if(!Array.isArray(raw.stadien)||raw.stadien.length<1||raw.stadien.length>20)error('invalid_learning_stages');
  for(const [index,stage]of raw.stadien.entries()){
    if(!object(stage)||stage.nr!==index+1||typeof stage.operation!=='string')error('invalid_learning_stage');
    const operations=stage.operation.split(',').map(x=>x.trim());
    if(!operations.length||operations.length>5||operations.some(op=>!OPERATIONS.includes(op)))error('invalid_learning_operation');
    projected.stadien.push({nr:stage.nr,operation:operations.join(', '),kennzahlen:numbers(stage.kennzahlen,STAGE_LIMITS)});
  }
  if(raw.maschine!=null){
    const known=catalog.find(m=>m.m===raw.maschine.modell);
    if(!known||(raw.maschine.stationen!==undefined&&raw.maschine.stationen!==known.st))error('invalid_learning_machine');
    projected.maschine={modell:known.m,stationen:known.st,familie:known.f};
  }
  projected.ergebnis={status:enumValue(raw.ergebnis?.status,OUTCOMES)};
  if(own(raw.ergebnis,'hubzahl_min')!==undefined)projected.ergebnis.hubzahl_min=checked(raw.ergebnis.hubzahl_min,[0,10000]);
  if(own(raw,'predictedStages')!==undefined){checked(raw.predictedStages,[1,20]);if(!Number.isInteger(raw.predictedStages))error('invalid_learning_stage_count');projected.predictedStages=raw.predictedStages;}
  if(own(raw,'throughput')!==undefined){
    const p=raw.throughput,bases=['strokes-per-minute','pieces-per-minute'];
    if(!object(p))error('invalid_learning_throughput');
    projected.throughput={planned:checked(p.planned,[Number.MIN_VALUE,10000]),measured:checked(p.measured,[0,10000]),plannedBasis:enumValue(p.plannedBasis,bases),measuredBasis:enumValue(p.measuredBasis,bases)};
  }
  return projected;
}

function approvedCases(cases,manifest){
  if(!manifestReady(manifest)||!Array.isArray(cases))return [];
  const counts=new Map();
  for(const c of cases)counts.set(c?.id,(counts.get(c?.id)||0)+1);
  const out=[];
  for(const c of cases){
    if(!approved(c)||counts.get(c.id)!==1)continue;
    try{out.push(projectCase(c));}catch{/* Invalid private records cannot become retrieved evidence. */}
  }
  return out.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
const sameContext=(a,b)=>a.klasse===b.klasse&&a.topologie===b.topologie;

/** Only reviewed cases from a reviewed snapshot can enter a comparison. */
export function similarCases(query,cases,{manifest,k=3,weights={},scales=DISTANCE_SCALES}={}){
  const q=projectFeatures(query),keys=Object.keys(q.merkmale).filter(key=>has(LIMITS,key));
  if(!Number.isInteger(k)||k<1||k>20)error('invalid_learning_k');
  if(!keys.length)return [];
  for(const key of keys){checked(scales[key],[1e-9,1e6]);if(has(weights,key))checked(weights[key],[0,100]);}
  const results=[];
  for(const c of approvedCases(cases,manifest).filter(c=>sameContext(q,c))){
    let sum=0,total=0,matched=0;const matchedFeatures=[],missingFeatures=[];
    for(const key of keys){
      const weight=weights[key]??1;if(!weight)continue;
      total+=weight;
      if(c.merkmale[key]===undefined){sum+=weight;missingFeatures.push(key);}
      else{sum+=weight*((q.merkmale[key]-c.merkmale[key])/scales[key])**2;matched++;matchedFeatures.push(key);}
    }
    if(q.merkmale.werkstoffgruppe){total++;sum+=q.merkmale.werkstoffgruppe===c.merkmale.werkstoffgruppe?0:1;}
    if(matched<Math.min(2,keys.length)||!total)continue;
    results.push({...c,distance:Math.sqrt(sum/total),matchedFeatures,missingFeatures,distanceBasis:'initial-engineering-scales-v1'});
  }
  return results.sort((a,b)=>a.distance-b.distance||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,k);
}

const quantile=(sorted,p)=>{const at=(sorted.length-1)*p,low=Math.floor(at),high=Math.ceil(at);return sorted[low]+(sorted[high]-sorted[low])*(at-low);};
const zone=values=>values.length?{n:values.length,min:Math.min(...values),max:Math.max(...values)}:null;

/** An experience band is a proposal. It never changes the active rule limit. */
export function experienceBand(query,cases,{manifest,metric,literatureValue,priorWeight=5}={}){
  const q=projectFeatures(query);
  if(!BAND_METRICS.includes(metric))error('invalid_learning_metric');
  checked(literatureValue,LIMITS[metric]);checked(priorWeight,[1,1000]);
  if(!q.merkmale.werkstoffgruppe||q.merkmale.werkstoffgruppe==='unbekannt')error('learning_material_context_required');
  const eligible=approvedCases(cases,manifest).filter(c=>sameContext(q,c)&&c.merkmale.werkstoffgruppe===q.merkmale.werkstoffgruppe&&c.merkmale[metric]!==undefined);
  const values=status=>eligible.filter(c=>c.ergebnis.status===status).map(c=>c.merkmale[metric]).sort((a,b)=>a-b);
  const success=values('laeuft'),failed=values('nicht_machbar'),caution=values('laeuft_mit_muehe'),n=success.length;
  const common={schemaVersion:1,status:'proposal',freigegeben:false,active:false,metric,direction:metric==='restwand_d'?'minimum':'maximum',literatureValue,n,priorWeight,failed:zone(failed),caution:zone(caution),caseIds:eligible.map(c=>c.id),approvalRequired:'Hans',successfulOutcome:'laeuft'};
  if(n<5)return {...common,basis:'literature',lower:literatureValue,upper:literatureValue,largestSuccessful:n?success[n-1]:null};
  const raw={min:success[0],p90:quantile(success,0.9),max:success[n-1]},weight=n/(n+priorWeight);
  return {...common,basis:'experience-proposal',raw,shrinkageWeight:weight,lower:weight*raw.min+(1-weight)*literatureValue,upper:weight*raw.p90+(1-weight)*literatureValue,largestSuccessful:raw.max};
}

/** Public intake rejects unknown attributes at every accepted object level. */
export function prepareFeedback(raw){
  rejectUnknown(raw,['optIn','source','features','feedback','predictedStages','actualStages']);
  if(raw.optIn!==true)error('learning_opt_in_required');
  const source=enumValue(raw.source,['manual','drawing','structured_geometry']);
  rejectUnknown(raw.features,['klasse','topologie','merkmale']);
  rejectUnknown(raw.features.merkmale,[...Object.keys(LIMITS),'werkstoffgruppe']);
  const features=projectFeatures(raw.features);
  if(!Object.keys(features.merkmale).some(key=>has(LIMITS,key)))error('learning_numeric_feature_required');
  const record={schemaVersion:1,recordType:'technical-feedback',status:'ungeprueft',knowledgeEligible:false,approval:null,source,optIn:true,features,feedback:enumValue(raw.feedback,FEEDBACK)};
  for(const key of ['predictedStages','actualStages'])if(own(raw,key)!==undefined){checked(raw[key],[1,20]);if(!Number.isInteger(raw[key]))error('invalid_learning_stage_count');record[key]=raw[key];}
  return record;
}

/** The sole write path stores an unreviewed intake, without TTL or request linkage. */
export async function storeFeedback(env,raw,{now=new Date(),uuid=()=>crypto.randomUUID()}={}){
  const record=prepareFeedback(raw);
  if(!env?.SPEICHER||typeof env.SPEICHER.put!=='function')error('learning_storage_unavailable');
  const id=uuid();if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))error('invalid_learning_record_id');
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))error('invalid_learning_date');
  const saved={...record,id,recordedOn:now.toISOString().slice(0,10)};
  await env.SPEICHER.put('rueckmeldung:'+id,JSON.stringify(saved));
  return {accepted:true,id,status:'ungeprueft',knowledgeEligible:false};
}

export function validateExperienceRequest(raw){
  rejectUnknown(raw,['features','k']);rejectUnknown(raw.features,['klasse','topologie','merkmale']);
  rejectUnknown(raw.features.merkmale,[...Object.keys(LIMITS),'werkstoffgruppe']);
  const features=projectFeatures(raw.features),k=raw.k??3;
  if(!Number.isInteger(k)||k<1||k>5)error('invalid_learning_k');
  if(!Object.keys(features.merkmale).some(key=>has(LIMITS,key)))error('learning_numeric_feature_required');
  return {features,k};
}

function parseSnapshot(raw){
  if(typeof raw!=='string'||raw.length>512000)error('invalid_learning_snapshot');
  try{return JSON.parse(raw);}catch{error('invalid_learning_snapshot');}
}

/** Fixed staging key. It never reads an intake or the main knowledge manifest. */
export async function loadLearning(env){
  if(!env?.SPEICHER?.get)error('learning_storage_unavailable');
  const raw=await env.SPEICHER.get('kvp:manifest:kvp-v1');
  if(raw===null||raw===undefined)return {status:'missing',manifest:null,cases:[]};
  const manifest=parseSnapshot(raw);
  if(!object(manifest)||manifest.schemaVersion!==1)error('invalid_learning_snapshot');
  if(!manifestReady(manifest))return {status:'pending-approval',manifest:null,cases:[]};
  let cases=manifest.cases;
  if(manifest.casesKey!==undefined){
    if(cases!==undefined||manifest.casesKey!=='kvp:cases:'+manifest.version)error('invalid_learning_snapshot');
    const saved=parseSnapshot(await env.SPEICHER.get(manifest.casesKey));
    if(saved?.schemaVersion!==1||saved.version!==manifest.version)error('invalid_learning_snapshot');
    cases=saved.cases;
  }
  if(!Array.isArray(cases)||cases.length>2000)error('invalid_learning_snapshot');
  return {status:'ready',manifest,cases};
}

export async function experience(env,raw){
  const q=validateExperienceRequest(raw),snapshot=await loadLearning(env);
  if(snapshot.status!=='ready')return {status:snapshot.status,cases:[],experience:{n:0,stadien:null,faelle:[]},bands:[]};
  const found=similarCases(q.features,snapshot.cases,{manifest:snapshot.manifest,k:q.k});
  const successful=found.filter(c=>c.ergebnis.status==='laeuft'),stages=successful.map(c=>c.stadien.length);
  // A calculated proposal is not an active band. Only separately reviewed bands
  // in the reviewed manifest are exposed as approved experience limits.
  const bands=[];
  for(const rawBand of Array.isArray(snapshot.manifest.bands)?snapshot.manifest.bands:[]){
    if(!approved(rawBand)||!BAND_METRICS.includes(rawBand.metric))continue;
    try{
      const context=projectFeatures(rawBand.context);
      if(!sameContext(context,q.features)||context.merkmale.werkstoffgruppe!==q.features.merkmale.werkstoffgruppe)continue;
      const range=LIMITS[rawBand.metric],lower=checked(rawBand.lower,range),upper=checked(rawBand.upper,range),literatureValue=checked(rawBand.literatureValue,range),n=checked(rawBand.n,[5,2000]);
      if(lower>upper||!Number.isInteger(n))continue;
      bands.push({metric:rawBand.metric,lower,upper,literatureValue,n,status:'approved',direction:rawBand.metric==='restwand_d'?'minimum':'maximum'});
    }catch{/* Invalid or incomplete reviewed limits remain inactive. */}
  }
  return {status:'ready',knowledgeVersion:snapshot.manifest.version,cases:found,experience:{n:found.length,stadien:stages.length?[Math.min(...stages),Math.max(...stages)]:null,faelle:found.map(c=>c.id)},bands};
}

const median=values=>quantile([...values].sort((a,b)=>a-b),0.5);
const distribution=values=>{const s=[...values].sort((a,b)=>a-b);return {n:s.length,median:median(s),p10:quantile(s,0.1),p90:quantile(s,0.9),min:s[0],max:s[s.length-1]};};

/** Ratios preserve operation/material context and throughput units. */
export function calibrationProposal(cases,{manifest,diameterClassWidth=5}={}){
  checked(diameterClassWidth,[0.1,100]);
  const force=new Map(),throughput=new Map(),issues=[];
  for(const c of approvedCases(cases,manifest)){
    if(!['laeuft','laeuft_mit_muehe'].includes(c.ergebnis.status))continue;
    const material=c.merkmale.werkstoffgruppe;
    if(material&&material!=='unbekannt')for(const stage of c.stadien){
      const calc=stage.kennzahlen.kraft_gerechnet_kN,measured=stage.kennzahlen.kraft_gemessen_kN;
      if(!(calc>0&&measured>0))continue;
      if(!Number.isFinite(measured/calc)){issues.push({code:'force-ratio-out-of-range',caseId:c.id});continue;}
      const key=stage.operation+'|'+material;
      if(!force.has(key))force.set(key,{operation:stage.operation,materialGroup:material,ratios:[]});
      force.get(key).ratios.push(measured/calc);
    }
    if(c.throughput&&c.maschine&&c.merkmale.d0){
      const p=c.throughput;
      if(p.plannedBasis!==p.measuredBasis){issues.push({code:'throughput-basis-mismatch',caseId:c.id});continue;}
      if(!Number.isFinite(p.measured/p.planned)){issues.push({code:'throughput-ratio-out-of-range',caseId:c.id});continue;}
      const lower=Math.floor(c.merkmale.d0/diameterClassWidth)*diameterClassWidth,key=[c.maschine.modell,lower,p.plannedBasis].join('|');
      if(!throughput.has(key))throughput.set(key,{model:c.maschine.modell,wireDiameterClass:{minInclusive:lower,maxExclusive:lower+diameterClassWidth,unit:'mm'},basis:p.plannedBasis,ratios:[],measured:[]});
      throughput.get(key).ratios.push(p.measured/p.planned);throughput.get(key).measured.push(p.measured);
    }
  }
  return {schemaVersion:1,status:'proposal',active:false,freigegeben:false,approvalRequired:'Hans',force:[...force.values()].map(({ratios,...group})=>({...group,factor:distribution(ratios)})),throughput:[...throughput.values()].map(({ratios,measured,...group})=>({...group,factor:distribution(ratios),measured:distribution(measured)})),issues};
}

const REASONS=['precision','price','universality','tool-space','station-reserve','force-reserve','transfer-turning','ko-pko','throughput','delivery','installed-base','other'];
export const BASE_WEIGHTS=Object.freeze({forceFit:0.30,stationFit:0.20,sizeFit:0.20,lengthFit:0.15,throughputFit:0.15});
const FIT_KEYS=Object.keys(BASE_WEIGHTS);
function reviewedDecisions(decisions,manifest){
  if(!manifestReady(manifest)||!Array.isArray(decisions))return [];
  const counts=new Map();for(const d of decisions)counts.set(d?.id,(counts.get(d?.id)||0)+1);
  const output=[];
  for(const d of decisions){
    if(!approved(d)||typeof d.id!=='string'||!(/^(?:D-\d{4,8}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/).test(d.id)||counts.get(d.id)!==1)continue;
    try{
      if(!Array.isArray(d.candidates)||d.candidates.length<2||d.candidates.length>50)continue;
      const candidates=d.candidates.map(c=>{
        if(!catalog.some(m=>m.m===c.model)||c.eligible!==true)error('invalid_learning_candidate');
        const fit=Object.fromEntries(FIT_KEYS.map(key=>[key,checked(c.features?.[key],[0,1])]));
        return {model:c.model,features:fit};
      });
      if(new Set(candidates.map(c=>c.model)).size!==candidates.length||!candidates.some(c=>c.model===d.offeredByHans))continue;
      const reasons=[...new Set(Array.isArray(d.reasonCodes)?d.reasonCodes.filter(r=>REASONS.includes(r)):[])];
      output.push({id:d.id,candidates,selected:d.offeredByHans,reasons,approvedOn:d.freigabe.am});
    }catch{/* Only complete, reviewed comparisons are fitting observations. */}
  }
  return output.sort((a,b)=>a.id<b.id?-1:1);
}
function reasonPareto(decisions){const counts={};for(const d of decisions)for(const reason of d.reasons)counts[reason]=(counts[reason]||0)+1;return Object.entries(counts).map(([reason,n])=>({reason,n})).sort((a,b)=>b.n-a.n||a.reason.localeCompare(b.reason));}
function replay(decisions,weights){
  let top1=0,top3=0;
  for(const d of decisions){
    const ranked=d.candidates.map(c=>({model:c.model,score:FIT_KEYS.reduce((s,k)=>s+weights[k]*c.features[k],0)})).sort((a,b)=>b.score-a.score||(a.model<b.model?-1:1));
    const rank=ranked.findIndex(c=>c.model===d.selected)+1;if(rank===1)top1++;if(rank<=3)top3++;
  }
  return {n:decisions.length,top1,top3,top1Rate:decisions.length?top1/decisions.length:null,top3Rate:decisions.length?top3/decisions.length:null};
}

/** Regularized pairwise logistic suggestion over bounded, higher-is-better fit scores.
 * Financial ordering and hard feasibility constraints are outside this learner.
 */
export function weightProposal(decisions,{manifest,baseline=BASE_WEIGHTS,regularization=0.25,iterations=250}={}){
  const base=Object.fromEntries(FIT_KEYS.map(k=>[k,checked(baseline[k],[0,1])])),sum=FIT_KEYS.reduce((s,k)=>s+base[k],0);
  if(Math.abs(sum-1)>1e-9)error('invalid_learning_weights');checked(regularization,[0.01,100]);
  if(!Number.isInteger(iterations)||iterations<1||iterations>1000)error('invalid_learning_iterations');
  const data=reviewedDecisions(decisions,manifest),common={schemaVersion:1,status:'proposal',active:false,freigegeben:false,approvalRequired:'Hans',n:data.length,reasonPareto:reasonPareto(data),baseline:{...base},evaluation:'in-sample-replay',financialRankingChanged:false};
  if(data.length<30)return {...common,method:'reason-pareto-only',weights:null,reason:'fewer-than-30-approved-decisions'};
  const pairs=[];
  for(const d of data){const chosen=d.candidates.find(c=>c.model===d.selected);for(const c of d.candidates)if(c!==chosen)pairs.push(FIT_KEYS.map(k=>chosen.features[k]-c.features[k]));}
  let w=FIT_KEYS.map(k=>base[k]);
  for(let i=0;i<iterations;i++){
    const gradient=w.map((v,j)=>regularization*(v-base[FIT_KEYS[j]]));
    for(const x of pairs){const score=w.reduce((s,v,j)=>s+v*x[j],0),p=1/(1+Math.exp(score));for(let j=0;j<w.length;j++)gradient[j]-=p*x[j]/pairs.length;}
    w=w.map((v,j)=>Math.max(0,v-0.2*gradient[j]));const norm=w.reduce((a,b)=>a+b,0);
    if(!norm){w=FIT_KEYS.map(k=>base[k]);break;}w=w.map(v=>v/norm);
  }
  const weights=Object.fromEntries(FIT_KEYS.map((k,i)=>[k,w[i]])),before=replay(data,base),after=replay(data,weights),nonDegrading=after.top1>=before.top1&&after.top3>=before.top3;
  return {...common,method:'regularized-pairwise-logistic',weights,regularization,iterations,signConstraints:'all-fit-weights-nonnegative',backtest:{before,after,nonDegrading},reviewStatus:nonDegrading?'awaiting-human-review':'rejected-replay-regression'};
}

const SOURCE_KINDS=['stadienplan','tkg-aggregat','drahtzeugnis','jern-yao-referenz','kunden-ergebnis','expertenfeedback','fachchat'];
export function monthlyReport(cases,decisions,feedbackRecords,{manifest,month}={}){
  if(typeof month!=='string'||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month))error('invalid_learning_month');
  const allApproved=approvedCases(cases,manifest),ids=new Set(allApproved.map(c=>c.id));
  const monthIds=new Set((Array.isArray(cases)?cases:[]).filter(c=>ids.has(c?.id)&&c.freigabe.am.startsWith(month)).map(c=>c.id));
  const selected=allApproved.filter(c=>monthIds.has(c.id)),outcomes={},sources={},deviations=[];
  for(const c of selected){outcomes[c.ergebnis.status]=(outcomes[c.ergebnis.status]||0)+1;if(c.predictedStages!==undefined)deviations.push(c.predictedStages-c.stadien.length);}
  for(const c of Array.isArray(cases)?cases:[])if(monthIds.has(c?.id)){const kind=SOURCE_KINDS.includes(c.quelle?.art)?c.quelle.art:'unspecified';sources[kind]=(sources[kind]||0)+1;}
  const feedback=[],feedbackCounts={};
  for(const f of Array.isArray(feedbackRecords)?feedbackRecords:[]){
    if(!date(f?.recordedOn)||!f.recordedOn.startsWith(month))continue;
    try{
      const clean=prepareFeedback({optIn:f.optIn,source:f.source,features:f.features,feedback:f.feedback,...(f.predictedStages!==undefined?{predictedStages:f.predictedStages}:{}),...(f.actualStages!==undefined?{actualStages:f.actualStages}:{})});
      feedback.push(clean);feedbackCounts[clean.feedback]=(feedbackCounts[clean.feedback]||0)+1;
    }catch{/* No raw text enters the report. */}
  }
  const reviewed=reviewedDecisions(decisions,manifest).filter(d=>d.approvedOn.startsWith(month));
  const decisionsAtCutoff=(Array.isArray(decisions)?decisions:[]).filter(d=>date(d?.freigabe?.am)&&d.freigabe.am.slice(0,7)<=month);
  return {schemaVersion:1,month,approvedCases:selected.length,caseOutcomes:outcomes,sourceCounts:sources,stageDeviation:{n:deviations.length,exact:deviations.filter(x=>x===0).length,withinOne:deviations.filter(x=>Math.abs(x)<=1).length,medianAbsolute:deviations.length?median(deviations.map(Math.abs)):null},feedback:{n:feedback.length,counts:feedbackCounts},decisions:{n:reviewed.length,reasonPareto:reasonPareto(reviewed)},weightProposal:weightProposal(decisionsAtCutoff,{manifest}),automaticActivation:false};
}
