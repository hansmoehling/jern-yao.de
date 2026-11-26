(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYMachineRanking=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const VERSION='ranking-v1';
  const embedded=/*RANKING_DEFAULTS_BEGIN*/null/*RANKING_DEFAULTS_END*/;
  const CONFIG=embedded||(typeof require==='function'?require('./vorbelegung/rangfolge.json'):null);
  // Provisional starting weights, not learned observations or machine ratings.
  const DEFAULT_WEIGHTS=Object.freeze(CONFIG?.weights||{force:0.30,stations:0.20,size:0.20,length:0.15,output:0.15,solidRivetJBF:0.01});
  const pos=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const ratio=(a,b)=>pos(a)&&pos(b)?a/b:null;
  const model=o=>o&&o.m;
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const priceOf=(o,options)=>options.priceMode==='none'?null:typeof options.priceFor==='function'?options.priceFor(o):o.rp;
  const metric=(value,score,state,extra={})=>({value,score,state,...extra});
  const sizeOf=o=>{const m=/^M(\d+(?:\.\d+)?)$/.exec(o.sz||'');return m?+m[1]:null;};

  function parseModel(name){
    const m=/^([A-Z]+)-(\d+)B(\d+)([A-Z]+)$/.exec(name||'');
    return m?{series:m[1],sizeClass:+m[2],stations:+m[3],lengthCode:m[4]}:null;
  }
  function fact(record,key){
    const raw=record&&record[key],entry=raw&&typeof raw==='object'?raw:null;
    const verified=entry?(entry.verified===true||entry.status==='verified'||entry.verification==='verified'):
      record&&(record.verified===true||record.status==='verified'||record.verification==='verified');
    return verified&&typeof(entry?entry.value:raw)==='string'?{value:entry?entry.value:raw,sourceRefs:entry?.sourceRefs||record.sourceRefs||[]}:null;
  }
  function execution(o,profile){
    const record=o.ausfuehrung||{},transfer=fact(record,'transfer')||fact(profile,'transfer'),knife=fact(record,'messer')||fact(profile,'messer');
    return {transfer:['universal','quer','rotativ'].includes(transfer?.value)?transfer.value:'unbekannt',messer:['geschlossen','offen'].includes(knife?.value)?knife.value:'unbekannt',transferEvidence:transfer,messerEvidence:knife};
  }
  function profileNumber(profile,key){
    // Only explicitly Hans-owned ratings are used, and never copied into output.
    if(!profile||profile.gepflegt_von!=='Hans')return 0;
    const value=profile[key]?.stufe;return finite(value)?value:0;
  }
  function plannedOutput(o,practice){
    const observed=practice?.modelle?.[model(o)];
    if(pos(observed))return {perMinute:observed,basis:'practice'};
    const factor=pos(practice?.quote)&&practice.quote<=1?practice.quote:null;
    return pos(o.out)&&factor?{perMinute:o.out*factor,basis:'catalog-factor',factor}:null;
  }
  function suitability(o,check,req,practice,weights,sizes){
    const components={},uncertainties=[],reasons=[];
    const force=finite(check.ausl)?check.ausl:ratio(req.forceTonnes,o.pw);
    if(force!==null){
      const state=force<0.15?'oversized':force>=0.45&&force<=0.70?'optimal':force<=0.80?'near':'tight';
      components.force=metric(force,state==='optimal'?1:state==='near'?0.8:state==='tight'?0.4:0.1,state);
      reasons.push({code:'force-utilization',ratio:force});
    }else uncertainties.push({code:'force-not-evaluated',affects:'technical-suitability'});
    if(pos(req.stations)&&pos(o.st)){
      const gap=o.st-req.stations,state=gap===1?'optimal':gap===2?'near':gap===0||gap>2?'tight':'insufficient';
      components.stations=metric(gap,state==='optimal'?1:state==='near'?0.8:gap===0?0.6:gap>2?Math.max(0.1,0.7-(gap-2)*0.15):0,state);
      reasons.push({code:'station-reserve',count:gap});
    }else if(pos(req.stations))uncertainties.push({code:'station-capacity-missing',affects:'technical-suitability'});
    const wireRatio=ratio(req.blankDiameter,o.cd),productSize=sizeOf(o),productRatio=ratio(req.partSize,productSize);
    if(wireRatio!==null||productRatio!==null){
      const relative=wireRatio??productRatio;
      const lowerSizes=pos(req.partSize)&&productSize? sizes.filter(s=>s>req.partSize&&s<=productSize).length:0;
      const oversized=wireRatio!==null&&wireRatio<0.4||lowerSizes>=2;
      const state=oversized?'oversized':productRatio>1||relative>0.95?'tight':relative>=0.6&&relative<=0.9?'optimal':'near';
      components.size=metric(relative,state==='optimal'?1:state==='near'?0.8:state==='tight'?0.5:0.1,state,{wireRatio,productRatio,sizeStepsAbove:lowerSizes});
      if(wireRatio!==null)reasons.push({code:'wire-capacity',diameter:req.blankDiameter,capacity:o.cd});
      if(productRatio>1)reasons.push({code:'product-size-above-catalogue',size:req.partSize,catalogueSize:productSize});
    }
    if(pos(req.blankDiameter)&&!pos(o.cd))uncertainties.push({code:'cutoff-diameter-missing',affects:'technical-suitability'});
    if(pos(req.partSize)&&!productSize)uncertainties.push({code:'catalogue-size-missing',affects:'size-score'});
    const lengths=[['blank',req.blankLength,o.cl?.[1]],['part',req.partLength,o.ml],['knockout',req.knockoutLength,o.ko]];
    const lengthRatios=lengths.filter(([,a,b])=>pos(a)&&pos(b)).map(([name,a,b])=>({name,ratio:a/b,required:a,capacity:b}));
    if(lengthRatios.length){
      const value=Math.max(...lengthRatios.map(x=>x.ratio)),state=value>0.95?'tight':value>=0.5&&value<=0.8?'optimal':'near';
      components.length=metric(value,state==='optimal'?1:state==='near'?0.8:0.5,state,{ratios:lengthRatios});
      reasons.push({code:'length-reserve',values:lengthRatios});
    }
    for(const[name,required,capacity]of lengths)if(pos(required)&&!pos(capacity))uncertainties.push({code:'length-capacity-missing',dimension:name,affects:'length-score'});
    const output=plannedOutput(o,practice);
    if(pos(req.demandPerMinute)){
      if(output){
        const available=output.perMinute/req.demandPerMinute,state=available>=1?'optimal':'tight';
        components.output=metric(available,Math.min(1,available),state,{basis:output.basis});
        reasons.push({code:'planned-output',perMinute:output.perMinute,demand:req.demandPerMinute,basis:output.basis});
      }else uncertainties.push({code:'planned-output-missing',affects:'output-score'});
    }
    let sum=0,weight=0;
    for(const[key,m]of Object.entries(components))if(pos(weights[key])){sum+=m.score*weights[key];weight+=weights[key];}
    const bonus=req.solidRivet===true&&o.f==='JBF'&&finite(weights.solidRivetJBF)?weights.solidRivetJBF:0;
    const states=Object.values(components).map(x=>x.state),tight=states.filter(x=>x==='tight'||x==='insufficient').length;
    const oversized=states.includes('oversized'),classification=oversized||tight>1?'C':tight===1?'B':'A';
    if(oversized)reasons.push({code:'oversized'});
    return {score:weight?sum/weight+bonus:null,classification:weight?classification:null,provisional:uncertainties.length>0,components,uncertainties,reasons,oversized};
  }

  /** checkMachine must run the complete technical checks (e.g. E.pruefe), not
   * E.waehle's family-filtered list. Every catalogue row is checked exactly once.
   * Price wins among sufficiently checked candidates. Reserve scores explain
   * differences and break ties; they never make a known hard failure eligible.
   */
  function rankMachines(catalogue,options={}){
    if(!Array.isArray(catalogue)||typeof options.checkMachine!=='function')throw new TypeError('A catalogue and complete technical check callback are required.');
    const names=new Set();for(const o of catalogue){if(typeof model(o)!=='string'||names.has(model(o)))throw new TypeError('Catalogue model names must be unique.');names.add(model(o));}
    const req=options.requirements||{},practice=options.practice||{},weights={...DEFAULT_WEIGHTS,...options.weights};
    const sizes=[...new Set(catalogue.map(sizeOf).filter(pos))].sort((a,b)=>a-b);
    const privateRanks=new Map();
    const all=catalogue.map(o=>{
      const result=options.checkMachine(o);
      if(!result||!Array.isArray(result.k)||!['ok','knapp','offen','nein'].includes(result.gesamt))throw new TypeError('Technical check must return k and gesamt for '+model(o));
      const k=result.k.map(x=>({...x})),profile=options.profiles?.[model(o)]||{},config=execution(o,profile);
      const rejected=result.gesamt==='nein'||k.some(c=>c.status==='nein')||config.transfer==='rotativ';
      if(config.transfer==='rotativ')k.push({krit:'Transferausführung',status:'nein',r:'R-TRANSFER',code:'rotative-transfer-not-offered'});
      const status=rejected?'nein':result.gesamt;
      const ranking=suitability(o,result,req,practice,weights,sizes);
      const price=priceOf(o,options);
      privateRanks.set(model(o),{price:pos(price)?price:null,universal:profileNumber(profile,'universalitaet'),precision:profileNumber(profile,'praezision')});
      return {...result,o,k,gesamt:status,ranking,execution:config,requestPoints:[],technicalEligible:!rejected};
    });
    const tier=r=>r.gesamt==='nein'?2:r.gesamt==='offen'?1:0;
    // An incomplete price list cannot establish a global cheapest candidate.
    const eligible=all.filter(r=>r.technicalEligible),bestTier=eligible.length?Math.min(...eligible.map(tier)):null;
    const priceCompleteByTier=new Map([0,1].map(t=>{const rows=eligible.filter(r=>tier(r)===t);return [t,rows.length>0&&rows.every(r=>privateRanks.get(model(r.o)).price!==null)];}));
    const priceRankingComplete=bestTier!==null&&priceCompleteByTier.get(bestTier)===true;
    const compare=(a,b)=>{
      let delta=tier(a)-tier(b);if(delta)return delta;
      const ap=privateRanks.get(model(a.o)),bp=privateRanks.get(model(b.o));
      // If a tier has missing prices, its fallback is consistently technical.
      const complete=priceCompleteByTier.get(tier(a));
      if(complete&&tier(a)!==2&&(delta=ap.price-bp.price))return delta;
      if((delta=bp.universal-ap.universal))return delta;
      if((delta=bp.precision-ap.precision))return delta;
      if((delta=(b.ranking.score??-1)-(a.ranking.score??-1)))return delta;
      return model(a.o).localeCompare(model(b.o),'en');
    };
    all.sort(compare);
    const candidates=all.filter(r=>r.technicalEligible),displayed=candidates.slice(0,1);
    const capabilityKey=r=>[r.o.st,r.o.cd,r.execution.transfer].join('|');
    const seen=new Set(displayed.map(capabilityKey));
    for(const row of candidates.slice(1))if(displayed.length<3&&!seen.has(capabilityKey(row))){displayed.push(row);seen.add(capabilityKey(row));}
    for(const row of candidates.slice(1))if(displayed.length<3&&!displayed.includes(row))displayed.push(row);
    for(const row of displayed){
      const c=row.execution;
      if(c.messer!=='geschlossen')row.requestPoints.push({code:c.messer==='offen'?'closed-knife-variant-required':'confirm-closed-knife',requested:'geschlossen'});
      if(c.transfer==='unbekannt')row.requestPoints.push({code:'confirm-transfer',accepted:['universal','quer']});
    }
    return {version:VERSION,all,candidates,recommendation:displayed[0]||null,alternatives:displayed.slice(1),additional:candidates.filter(r=>!displayed.includes(r)),checkedCount:all.length,
      priceRankingComplete,rankingBasis:priceRankingComplete?'technical-then-price':'technical-fallback',
      uncertainties:priceRankingComplete?[]:[{code:'complete-price-order-unavailable'}]};
  }

  function roundedChange(percent,positive,negative){
    return Math.abs(percent)<3?{direction:'same',percent:0}:{direction:percent>0?positive:negative,percent:Math.round(Math.abs(percent)/5)*5};
  }
  function pairOutput(reference,alternative,practice){
    const a=practice?.modelle?.[model(reference)],b=practice?.modelle?.[model(alternative)];
    if(pos(a)&&pos(b))return {reference:a,alternative:b,source:'practice-pair'};
    const factor=practice?.quote;
    return pos(reference.out)&&pos(alternative.out)&&pos(factor)&&factor<=1?{reference:reference.out*factor,alternative:alternative.out*factor,source:'catalog-factor',factor}:null;
  }
  function compareVariants(reference,alternative,options={}){
    const ref=priceOf(reference,options),alt=priceOf(alternative,options),output=pairOutput(reference,alternative,options.practice||{});
    const result={reference:model(reference),alternative:model(alternative),price:null,efficiency:null,connector:null,basis:null,uncertainties:[]};
    if(!pos(ref)||!pos(alt)){result.uncertainties.push({code:'price-comparison-unavailable'});return result;}
    const pricePercent=(alt/ref-1)*100;
    result.price=roundedChange(pricePercent,'dearer','cheaper');
    if(!output){result.uncertainties.push({code:'comparable-output-unavailable'});return result;}
    const cap=pos(options.demandPerMinute)?options.demandPerMinute:Infinity;
    const referenceOutput=Math.min(output.reference,cap),alternativeOutput=Math.min(output.alternative,cap);
    const efficiencyPercent=((alternativeOutput/alt)/(referenceOutput/ref)-1)*100;
    result.efficiency=roundedChange(efficiencyPercent,'higher','lower');
    result.connector=result.price.direction==='same'||result.efficiency.direction==='same'||pricePercent*efficiencyPercent<=0?'and':'but';
    result.basis={source:output.source,...(output.factor?{factor:output.factor}:{}),demandCap:finite(cap)?cap:null,toolCostsIncluded:false};
    return result;
  }
  function toolCostProxy(o){
    return pos(o.st)&&pos(o.die?.[0])&&pos(o.die?.[1])?{value:o.st*o.die[0]**2*o.die[1],unit:'relative-tool-volume',status:'uncalibrated-proxy',isCost:false}:null;
  }

  function gridFor(result,selectedModel){
    const entries=result.all||[],selected=entries.find(r=>model(r.o)===selectedModel),p=parseModel(selectedModel);
    if(!selected||!p)return null;
    const parsed=entries.map(r=>({r,p:parseModel(model(r.o))})).filter(x=>x.p);
    const sameSize=parsed.filter(x=>x.p.series===p.series&&x.p.sizeClass===p.sizeClass);
    const capacity=x=>pos(x.r.o.ml)?x.r.o.ml:pos(x.r.o.cl?.[1])?x.r.o.cl[1]:null;
    const codes=[...new Set(sameSize.map(x=>x.p.lengthCode))].sort((a,b)=>{
      const vals=code=>sameSize.filter(x=>x.p.lengthCode===code).map(capacity).filter(pos);
      const av=vals(a),bv=vals(b);return av.length&&bv.length?Math.min(...av)-Math.min(...bv)||a.localeCompare(b):a.localeCompare(b);
    });
    const stations=[...new Set(sameSize.map(x=>x.p.stations))].sort((a,b)=>a-b);
    const cells=sameSize.map(({r,p:q})=>({model:model(r.o),stations:q.stations,lengthCode:q.lengthCode,status:r.gesamt,classification:r.ranking.classification,selected:model(r.o)===selectedModel,checks:r.k}));
    function neighbour(direction,predicate,value,ascending){
      const matches=parsed.filter(x=>model(x.r.o)!==selectedModel&&x.p.series===p.series&&predicate(x));
      matches.sort((a,b)=>ascending?value(a)-value(b):value(b)-value(a));
      if(!matches.length)return null;
      const r=matches[0].r;return {direction,model:model(r.o),status:r.gesamt,checks:r.k,reasons:r.ranking.reasons};
    }
    const length=capacity({r:selected});
    const neighbours=[
      neighbour('smaller',x=>x.p.stations===p.stations&&x.p.lengthCode===p.lengthCode&&x.p.sizeClass<p.sizeClass,x=>x.p.sizeClass,false),
      neighbour('larger',x=>x.p.stations===p.stations&&x.p.lengthCode===p.lengthCode&&x.p.sizeClass>p.sizeClass,x=>x.p.sizeClass,true),
      neighbour('fewer-stations',x=>x.p.sizeClass===p.sizeClass&&x.p.lengthCode===p.lengthCode&&x.p.stations<p.stations,x=>x.p.stations,false),
      neighbour('more-stations',x=>x.p.sizeClass===p.sizeClass&&x.p.lengthCode===p.lengthCode&&x.p.stations>p.stations,x=>x.p.stations,true),
      neighbour('shorter',x=>x.p.sizeClass===p.sizeClass&&x.p.stations===p.stations&&pos(length)&&pos(capacity(x))&&capacity(x)<length,capacity,false),
      neighbour('longer',x=>x.p.sizeClass===p.sizeClass&&x.p.stations===p.stations&&pos(length)&&pos(capacity(x))&&capacity(x)>length,capacity,true)
    ].filter(Boolean);
    return {model:selectedModel,series:p.series,sizeClass:p.sizeClass,stations,lengthCodes:codes,cells,neighbours};
  }
  return {VERSION,CONFIG,DEFAULT_WEIGHTS,parseModel,rankMachines,compareVariants,toolCostProxy,gridFor};
});
