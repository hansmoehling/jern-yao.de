import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {projectCase} from '../ki-gutachter/src/kvp.js';

export const CASE_COLUMNS=Object.freeze(['fall_id','synthetisch','klasse','topologie','werkstoffgruppe','draht_mm','abschnitt_mm','rm_MPa','kopfvolumenanteil','stauch_h0_d0_max','napf_t_d','reduktion_max','restwand_d','stempelpressung_MPa','maschine','ergebnis','plan_stadien','hubzahl_min','ausbringung_plan','ausbringung_ist','ausbringung_einheit','quelle_art']);
export const STAGE_COLUMNS=Object.freeze(['fall_id','station','operation','h0_d0','reduktion','napf_t_d','restwand_d','stempelpressung_MPa','kraft_gerechnet_kN','kraft_gemessen_kN']);
const SOURCE_KINDS=['stadienplan','tkg-aggregat','drahtzeugnis','jern-yao-referenz','kunden-ergebnis','expertenfeedback','fachchat','synthetisch'];
const fail=code=>{throw new Error(code);};

// Semicolon-separated UTF-8; decimal comma is accepted in numeric cells.
// Unknown columns and malformed quotes fail instead of silently losing data.
export function parseCsv(text,allowed,required){
  if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>2_000_000)fail('csv_size');
  text=text.replace(/^\uFEFF/,'');
  const matrix=[];let row=[],cell='',quoted=false,closed=false;
  const finishCell=()=>{row.push(cell.trim());cell='';closed=false;};
  const finishRow=()=>{finishCell();if(row.some(Boolean))matrix.push(row);row=[];};
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"'){quoted=false;closed=true;}
      else cell+=ch;
      continue;
    }
    if(ch==='"'){if(cell||closed)fail('csv_quote');quoted=true;continue;}
    if(ch===';'){finishCell();continue;}
    if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;finishRow();continue;}
    if(closed)fail('csv_quote');
    cell+=ch;
  }
  if(quoted)fail('csv_quote');
  if(cell||row.length||closed)finishRow();
  const headers=matrix.shift();
  if(!headers||new Set(headers).size!==headers.length||headers.some(x=>!allowed.includes(x))||required.some(x=>!headers.includes(x)))fail('csv_headers');
  if(matrix.length>40000)fail('csv_rows');
  return matrix.map((values,index)=>{
    if(values.length!==headers.length)fail('csv_width_row_'+(index+2));
    return Object.fromEntries(headers.map((key,i)=>[key,values[i]]));
  });
}
function number(raw,key,{required=false,integer=false,positive=false}={}){
  const text=raw[key]??'';
  if(text===''){if(required)fail('missing_'+key);return undefined;}
  if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text))fail('number_'+key);
  const value=Number(text.replace(',','.'));
  if(!Number.isFinite(value)||integer&&!Number.isInteger(value)||positive&&value<=0)fail('number_'+key);
  return value;
}
function numbers(row,mapping){
  return Object.fromEntries(Object.entries(mapping).flatMap(([column,key])=>{const value=number(row,column);return value===undefined?[]:[[key,value]];}));
}

/** Produces a review draft only. No filesystem writes, upload or approval. */
export function importKvp({casesCsv,stagesCsv,version}){
  if(typeof version!=='string'||!/^kvp-[a-zA-Z0-9][a-zA-Z0-9._-]{0,59}$/.test(version))fail('version');
  const rows=parseCsv(casesCsv,CASE_COLUMNS,['fall_id','synthetisch','klasse','topologie','werkstoffgruppe','draht_mm','abschnitt_mm','ergebnis','quelle_art']);
  const stages=parseCsv(stagesCsv,STAGE_COLUMNS,['fall_id','station','operation']);
  if(!rows.length||rows.length>2000)fail('case_count');
  const ids=new Set(rows.map(row=>row.fall_id));if(ids.size!==rows.length)fail('duplicate_case');
  const stageMap=new Map();
  for(const row of stages){
    if(!ids.has(row.fall_id))fail('orphan_stage');
    const nr=number(row,'station',{required:true,integer:true,positive:true});
    const list=stageMap.get(row.fall_id)||[];
    if(list.some(stage=>stage.nr===nr))fail('duplicate_stage');
    list.push({nr,operation:row.operation,kennzahlen:numbers(row,{h0_d0:'h0_d0',reduktion:'reduktion',napf_t_d:'napf_t_d',restwand_d:'restwand_d',stempelpressung_MPa:'stempelpressung',kraft_gerechnet_kN:'kraft_gerechnet_kN',kraft_gemessen_kN:'kraft_gemessen_kN'})});
    stageMap.set(row.fall_id,list);
  }
  const cases=rows.map(row=>{
    if(!['ja','nein'].includes(row.synthetisch))fail('synthetic_flag');
    const synthetic=row.synthetisch==='ja';
    if(!(synthetic?/^SYN-\d{4,8}$/:/^F-\d{4,8}$/).test(row.fall_id))fail('case_id');
    if(!SOURCE_KINDS.includes(row.quelle_art)||(row.quelle_art==='synthetisch')!==synthetic)fail('source_kind');
    if(synthetic&&row.ergebnis!=='nur_konzept')fail('synthetic_outcome');
    const d0=number(row,'draht_mm',{required:true,positive:true}),L0=number(row,'abschnitt_mm',{required:true,positive:true});
    const raw={id:synthetic?'F-0000':row.fall_id,klasse:row.klasse,topologie:row.topologie,
      merkmale:{d0,L0_d0:L0/d0,werkstoffgruppe:row.werkstoffgruppe,...numbers(row,{rm_MPa:'rm',kopfvolumenanteil:'kopfvolumenanteil',stauch_h0_d0_max:'stauch_h0_d0_max',napf_t_d:'napf_t_d',reduktion_max:'reduktion_max',restwand_d:'restwand_d',stempelpressung_MPa:'stempelpressung'})},
      stadien:(stageMap.get(row.fall_id)||[]).sort((a,b)=>a.nr-b.nr),ergebnis:{status:row.ergebnis}};
    if(row.maschine)raw.maschine={modell:row.maschine};
    const predicted=number(row,'plan_stadien',{integer:true,positive:true}),strokes=number(row,'hubzahl_min');
    if(predicted!==undefined)raw.predictedStages=predicted;
    if(strokes!==undefined)raw.ergebnis.hubzahl_min=strokes;
    const throughput=[row.ausbringung_plan,row.ausbringung_ist,row.ausbringung_einheit].map(value=>Boolean(value));
    if(throughput.some(Boolean)){
      if(!throughput.every(Boolean))fail('throughput_incomplete');
      raw.throughput={planned:number(row,'ausbringung_plan',{required:true,positive:true}),measured:number(row,'ausbringung_ist',{required:true}),plannedBasis:row.ausbringung_einheit,measuredBasis:row.ausbringung_einheit};
    }
    const checked=projectCase(raw);
    return {...checked,id:row.fall_id,synthetic,recordType:synthetic?'synthetic-example':'imported-case',status:'ungeprueft',knowledgeEligible:false,freigegeben:false,freigabe:null,
      quelle:{art:row.quelle_art,ref:row.fall_id},importEvidence:{units:{draht_mm:'mm',abschnitt_mm:'mm',rm_MPa:'N/mm²',kraft:'kN',hubzahl_min:'min⁻¹'},blank:{diameter_mm:d0,length_mm:L0},featureDerivation:{L0_d0:'abschnitt_mm / draht_mm'}}};
  }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  return {schemaVersion:1,version,recordType:'import-review-manifest',synthetic:cases.every(c=>c.synthetic),status:'ungeprueft',knowledgeEligible:false,freigegeben:false,freigabe:null,approvalRequired:'Hans',cases};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const [casesFile,stagesFile,version,...extra]=process.argv.slice(2);
    if(!casesFile||!stagesFile||!version||extra.length)fail('usage: node quelle/wissen/import_kvp.mjs faelle.csv stadien.csv kvp-version');
    const result=importKvp({casesCsv:readFileSync(casesFile,'utf8'),stagesCsv:readFileSync(stagesFile,'utf8'),version});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch(error){process.stderr.write('KVP-Import abgebrochen: '+(error.code||error.message)+'\n');process.exitCode=1;}
}
