(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYRankingService=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
function payloadFor(selection,demand){
 const candidates=(selection?.ranking?.candidates||[]).filter(row=>row.technicalEligible!==false&&row.gesamt!=='nein'&&!row.k?.some(check=>check.status==='nein')).slice(0,12).map(row=>({model:row.o.m,status:row.gesamt,suitability:Object.fromEntries(Object.entries(row.ranking?.components||{}).filter(([key,value])=>['force','stations','size','length','output'].includes(key)&&finite(value.score)&&value.score>=0&&value.score<=1).map(([key,value])=>[key,value.score]))}));
 if(!candidates.length||candidates.some(row=>!Object.keys(row.suitability).length))return null;
 return {featureVersion:'kvp-v1',candidates,...(finite(demand)&&demand>0?{demandPerMinute:demand}:{})};
}
function applyResponse(selection,payload,data){
 if(data?.version!=='ranking-v1'||data.basis!=='submitted-technical-status'||typeof data.priceRankingComplete!=='boolean'||!Array.isArray(data.models)||!data.models.length||data.models.length>3)throw Error('invalid_ranking_response');
 const ranking=selection.ranking,allowed=new Set(payload.candidates.map(row=>row.model)),lookup=new Map(ranking.candidates.map(row=>[row.o.m,row])),seen=new Set(),reference=data.models[0].model;
 const displayed=data.models.map(item=>{
  if(!allowed.has(item.model)||seen.has(item.model)||!lookup.has(item.model))throw Error('invalid_ranking_model');seen.add(item.model);
  const row=lookup.get(item.model),source=item.comparison;
  const pair=source?{reference,alternative:item.model,price:source.price,efficiency:source.efficiency,connector:source.connector,basis:source.basis?{source:source.basis.source,factor:source.basis.factor,demandCap:source.basis.demandCap,toolCostsIncluded:false}:null,uncertainties:[]}:null;
  const requestPoints=[],execution=row.execution||{};
  if(execution.messer!=='geschlossen')requestPoints.push({code:execution.messer==='offen'?'closed-knife-variant-required':'confirm-closed-knife',requested:'geschlossen'});
  if(execution.transfer==='unbekannt')requestPoints.push({code:'confirm-transfer',accepted:['universal','quer']});
  return {...row,comparison:pair,requestPoints};
 });
 const additional=ranking.candidates.filter(row=>!seen.has(row.o.m)),compared=payload.candidates.length,eligible=ranking.candidates.length;
 return {...selection,ranking:{...ranking,recommendation:displayed[0],alternatives:displayed.slice(1),candidates:[...displayed,...additional],additional,priceRankingComplete:data.priceRankingComplete&&compared===eligible,rankingBasis:'server-shortlist',comparisonCoverage:{compared,eligible,priceComplete:data.priceRankingComplete}}};
}
function create({request,schedule=setTimeout,cancel=clearTimeout}){
 let generation=0,timer=null;const cache=new Map(),pending=new Map();
 const reset=()=>{generation++;if(timer!==null)cancel(timer);timer=null;};
 function update(selection,{demandPerMinute,onResult}={}){
  reset();const current=generation,payload=payloadFor(selection,demandPerMinute);if(!payload)return;
  const key=JSON.stringify(payload),publish=data=>{if(current===generation)onResult?.(applyResponse(selection,payload,data));};
  if(cache.has(key)){publish(cache.get(key));return;}
  timer=schedule(async()=>{
   timer=null;
   try{
    if(!pending.has(key))pending.set(key,Promise.resolve().then(()=>request(payload)).finally(()=>pending.delete(key)));
    const data=await pending.get(key);applyResponse(selection,payload,data);
    cache.set(key,data);if(cache.size>8)cache.delete(cache.keys().next().value);publish(data);
   }catch(_){/* The visible technical selection remains available on failure. */}
  },450);
 }
 return {update,reset};
}
return {create,payloadFor,applyResponse};
});
