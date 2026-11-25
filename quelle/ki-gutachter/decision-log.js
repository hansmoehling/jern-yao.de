import Engine from '../engine.js';
import machines from '../maschinen.json' with {type:'json'};
import praxis from '../praxis.json' with {type:'json'};

const NUMBERS=['d0','rodDiameter','rm','sD','sL','kD','kSW','kH','sArea','tipArea','tipLength','tipDiameter','kVol','iSW','iT','iVol','nD','nT','mM','mSW','mH','mLoch','mFlansch','mFlanschH','masse','lStempel'];
const ENUMS={typ:['bolzen','mutter'],standardKind:['screw','rivet','pin','headless'],threadFamily:['none','metric','trilobular','duo-taptite','self-tapping','thermoplastic'],kopfForm:['none','rund','sechskant','abgratet','krallen'],materialState:['soft-annealed','cold-drawn','normalized-rolled','unknown'],wirePreparation:['as-supplied','inline-drawing'],iTyp:['none','hex','torx','ph','pz']};
const model=name=>machines.find(item=>item.m===name);
const numeric=(object,keys,max=100000)=>{
 const result={};
 for(const key of keys)if(object?.[key]!==undefined&&object[key]!==null){const value=object[key];if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw new Error('invalid_decision_input');result[key]=value;}
 return result;
};
function technicalInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const input={...numeric(raw,NUMBERS),rmPolicy:'rm-v1'};
 for(const[key,values]of Object.entries(ENUMS))if(raw[key]!==undefined){if(!values.includes(raw[key]))return null;input[key]=raw[key];}
 if(!ENUMS.typ.includes(input.typ)||!Number.isInteger(raw.wst))return null;
 const material=Engine.WERKSTOFFE[raw.wst],curve=material?.flowCurves?.find(item=>item.id===raw.curveId&&item.state===input.materialState&&item.eligible===true);
 if(!material?.manualEligible||!curve)return null;
 input.wst=raw.wst;input.curveId=curve.id;
 for(const key of ['wenden','nDurch'])if(typeof raw[key]==='boolean')input[key]=raw[key];
 if(raw.iSize!==undefined){if(typeof raw.iSize!=='string'||! /^(?:T[1-9]\d{0,2}|PH[0-4]|PZ[0-4]|custom|\d{1,2}(?:\.\d{1,2})?)$/.test(raw.iSize))return null;input.iSize=raw.iSize;}
 input.vorgaben=numeric(raw.vorgaben,['ko','pko','matD','matL','stD','stL']);
 Object.assign(input.vorgaben,numeric(raw.vorgaben,['stationen','zusatz'],20));
 input.soll=numeric(raw.soll,['ausbringung'],10000);
 if(input.d0<0.1||input.d0>100||Math.max(input.kH||0,input.sL||0,input.mH||0)>2000)return null;
 return input;
}

// Intake metadata is never evidence for a material or a confirmed production
// case. Only manual, file-free requests are eligible at this initial stage.
export function prepareDecision(raw,{hasFile=false}={}){
 if(hasFile||typeof raw!=='string'||raw.length>16000)return null;
 try{
  const body=JSON.parse(raw);
  if(body?.kind!=='manual'||!Array.isArray(body.candidates)||body.candidates.length>12)return null;
  const input=technicalInput(body.input);if(!input)return null;
  const calculation=Engine.auslegen(input);
  if(calculation.fehlt?.length||!calculation.stufen?.length)return null;
  const found=Engine.waehle(machines,calculation,input,praxis),ranked=[...found.passend,...found.bedingt,...found.fast];
  const reported=[];
  for(const item of body.candidates){
   if(!model(item?.model)||!Number.isInteger(item.rank)||item.rank<1||item.rank>machines.length||reported.some(row=>row.model===item.model))return null;
   const rank=ranked.findIndex(row=>row.o.m===item.model),row=ranked[rank];if(!row)return null;
   reported.push({model:row.o.m,rankSubmitted:item.rank,rankCalculated:rank+1,status:row.gesamt,features:{stations:row.o.st,cutoffDiameterMm:row.o.cd,cutoffLengthMm:row.o.cl,utilization:Number.isFinite(row.ausl)?row.ausl:null}});
  }
  if(!reported.length)return null;
  const selected=body.selectedModel??null;
  if(selected!==null&&!reported.some(row=>row.model===selected))return null;
  const material=Engine.WERKSTOFFE[input.wst];
  const values=Object.fromEntries(['d0','L0','stationen','Fmax','Fsum'].filter(key=>Number.isFinite(calculation.werte[key])).map(key=>[key,calculation.werte[key]]));
  // No free text, original evidence, contact, file, request ID or IP survives.
  delete input.wst;
  return {schemaVersion:1,recordType:'manual-customer-decision',status:'ungeprueft',knowledgeEligible:false,source:{kind:'manual-customer-enquiry'},input,material:{id:material.id,state:input.materialState,curveId:input.curveId,origin:'user_selection'},calculation:{values,stages:calculation.stufen.length,rmPolicy:'rm-v1'},candidates:reported,customerSelectedModel:selected,offeredByHans:null,reasonCodes:[],outcome:{status:'nur_konzept'},approval:null};
 }catch{return null;}
}
export async function recordDecision(env,decision){
 if(!decision)return;
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(machines)));
 const catalogSha256=Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');
 await env.SPEICHER.put('entscheidung:'+crypto.randomUUID(),JSON.stringify({...decision,recordedOn:new Date().toISOString().slice(0,10),dataVersion:{catalogSha256,rmPolicy:'rm-v1',schema:1}}));
}
