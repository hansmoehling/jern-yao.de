import Ranking from '../machine-ranking.js';
import catalog from '../maschinen.json' with {type:'json'};
import practice from '../praxis.json' with {type:'json'};

const only=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const tier=row=>row.gesamt==='offen'?1:0;
const transferOf=model=>{
  const record=model.ausfuehrung||{},raw=record.transfer,entry=raw&&typeof raw==='object'?raw:null;
  const verified=entry?(entry.verified===true||entry.status==='verified'||entry.verification==='verified'):(record.verified===true||record.status==='verified'||record.verification==='verified');
  const value=entry?entry.value:raw;return verified&&['universal','quer','rotativ'].includes(value)?value:'unbekannt';
};

// Only normalized technical assessments cross this boundary. Prices, output
// comparisons and verified execution details come from the server catalogue.
export function rankV2(body){
  const invalid=()=>{throw Error('invalid_ranking_request');};
  if(!only(body,['featureVersion','rankingVersion','candidates','demandPerMinute'])||body.featureVersion!=='kvp-v1'||body.rankingVersion!=='ranking-v2'||!Array.isArray(body.candidates)||!body.candidates.length||body.candidates.length>24)invalid();
  if(body.demandPerMinute!==undefined&&(!positive(body.demandPerMinute)||body.demandPerMinute>10000))invalid();
  const seen=new Set(),primary=[],reserve=[];
  for(const candidate of body.candidates){
    if(!only(candidate,['model','status','classification','score','role','stationReserve'])||!['ok','knapp','offen','nein'].includes(candidate.status)||!['A','B','C'].includes(candidate.classification)||!['primary','reserve'].includes(candidate.role)||typeof candidate.score!=='number'||!Number.isFinite(candidate.score)||candidate.score<0||candidate.score>1.01||!(candidate.stationReserve===null||Number.isInteger(candidate.stationReserve)&&candidate.stationReserve>=-20&&candidate.stationReserve<=20))invalid();
    const model=catalog.find(row=>row.m===candidate.model);if(!model||seen.has(model.m))invalid();seen.add(model.m);
    const row={o:model,gesamt:candidate.status,ranking:{classification:candidate.classification,score:candidate.score,components:{stations:{value:candidate.stationReserve}}},execution:{transfer:transferOf(model)}};
    (candidate.role==='primary'?primary:reserve).push(row);
  }
  if(!primary.length||primary.length>12||reserve.length>12)invalid();
  const bestClass=primary[0].ranking.classification,bestTier=tier(primary[0]);
  if(primary.some(row=>row.ranking.classification!==bestClass||tier(row)!==bestTier)||reserve.some(row=>bestClass!=='A'||row.ranking.classification!=='B'||row.ranking.components.stations.value!==0||tier(row)!==bestTier))invalid();
  const eligible=rows=>rows.filter(row=>row.gesamt!=='nein'&&row.execution.transfer!=='rotativ');
  const primaryEligible=eligible(primary),reserveEligible=eligible(reserve);
  const complete=rows=>rows.length>0&&rows.every(row=>positive(row.o.rp));
  const sort=rows=>{const priced=complete(rows);return rows.sort((a,b)=>(priced?a.o.rp-b.o.rp:0)||b.ranking.score-a.ranking.score||a.o.m.localeCompare(b.o.m,'en'));};
  const displayed=Ranking.displayCandidates(sort(primaryEligible),sort(reserveEligible),{priceFor:model=>model.rp});
  const models=displayed.map((row,index)=>{
    if(!index)return {model:row.o.m,comparison:null};
    const comparison=Ranking.compareVariants(displayed[0].o,row.o,{practice,...(body.demandPerMinute?{demandPerMinute:body.demandPerMinute}:{})});
    return {model:row.o.m,comparison:{price:comparison.price,efficiency:comparison.efficiency,connector:comparison.connector,basis:comparison.basis?{source:comparison.basis.source,factor:comparison.basis.factor,demandCap:comparison.basis.demandCap,toolCostsIncluded:false}:null,uncertainties:comparison.uncertainties.map(item=>({code:item.code}))}};
  });
  return {version:'ranking-v2',basis:'submitted-technical-status',priceRankingComplete:complete(primaryEligible),models};
}
