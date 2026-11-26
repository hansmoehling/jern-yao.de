(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./machine-ranking.js'):root.JYMachineRanking);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.JYWireOptimization=api;
})(typeof globalThis==='object'?globalThis:this,function(R){
  'use strict';
  const DEFAULT_THRESHOLD_PERCENT=10;
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const pos=v=>finite(v)&&v>0;
  const clone=v=>Array.isArray(v)?v.map(clone):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)])):v;
  const hardFailure=row=>!row||row.technicalEligible===false||row.gesamt==='nein'||row.k?.some(k=>k.status==='nein');
  // ok and knapp intentionally share the economic comparison tier.
  const tier=row=>hardFailure(row)?2:row.gesamt==='offen'||row.k?.some(k=>k.status==='offen')?1:0;
  const knownForce=a=>!a?.qualitative&&pos(a?.werte?.Fmax_t)&&pos(a?.werte?.Fsum_t)&&!a?.werte?.forceReason;
  function flowReady(engine,e){
    const material=engine.WERKSTOFFE?.[e.wst];
    if(!material||typeof engine.selectFlow!=='function')return false;
    const flow=engine.selectFlow(material,e);
    return flow?.status==='ready'&&flow.curve?.state==='soft-annealed'&&e.materialState==='soft-annealed';
  }
  function describeChanges(baseline,variant){
    const changes=[],before=baseline.row,after=variant.row;
    if(!before||!after)return changes;
    if(before.gesamt==='ok'&&after.gesamt==='knapp')changes.push({code:'near-limit',reason:'Die Variante liegt bei einzelnen Prüfungen im Grenzbereich.'});
    const b=baseline.aus?.werte,a=variant.aus?.werte;
    const oldReserve=pos(b?.stationen)&&pos(before.o?.st)?before.o.st-b.stationen:null;
    const newReserve=pos(a?.stationen)&&pos(after.o?.st)?after.o.st-a.stationen:null;
    if(newReserve===0)changes.push({code:'no-spare-station',reason:'Die Variante hat keine Reservestation.',from:oldReserve,to:0});
    else if(finite(oldReserve)&&finite(newReserve)&&newReserve<oldReserve)changes.push({code:'less-station-reserve',reason:'Stationsreserve sinkt von {before} auf {after}.',params:{before:oldReserve,after:newReserve},from:oldReserve,to:newReserve});
    if(pos(a?.stationen)&&pos(b?.stationen)&&a.stationen>b.stationen)changes.push({code:'more-forming-stages',reason:'Die Variante benötigt {after} statt {before} Umformstadien.',params:{before:b.stationen,after:a.stationen},from:b.stationen,to:a.stationen});
    const previous=new Map((before.k||[]).map(k=>[k.krit,k]));
    for(const check of after.k||[])if(check.status==='knapp'&&previous.get(check.krit)?.status==='ok')changes.push({code:'check-near-limit',reason:'{criterion}: Die Variante liegt im Grenzbereich.',params:{criterion:check.krit},criterion:check.krit,from:'ok',to:'knapp',check:clone(check)});
    return changes;
  }
  function rawGain(reference,alternative,comparison,practice){
    const b=comparison?.basis;if(!b||!pos(reference?.rp)||!pos(alternative?.rp))return null;
    let a,z;
    if(b.source==='practice-pair'){a=practice?.modelle?.[reference.m];z=practice?.modelle?.[alternative.m];}
    else if(b.source==='catalog-factor'&&pos(b.factor)){a=reference.out*b.factor;z=alternative.out*b.factor;}
    if(!pos(a)||!pos(z))return null;
    if(pos(b.demandCap)){a=Math.min(a,b.demandCap);z=Math.min(z,b.demandCap);}
    return ((z/alternative.rp)/(a/reference.rp)-1)*100;
  }
  function evaluateVariants({engine,catalogue,practice={},input,analysis,selection,candidates=[],thresholdPercent=DEFAULT_THRESHOLD_PERCENT}={}){
    if(!engine||typeof engine.auslegen!=='function'||typeof engine.waehle!=='function'||!R||!Array.isArray(catalogue)||!input||typeof input!=='object')throw new TypeError('Engine, catalogue and input are required.');
    const threshold=pos(thresholdPercent)?thresholdPercent:DEFAULT_THRESHOLD_PERCENT;
    const policy=input.machinePolicy==='ranking-v2'?'ranking-v2':'ranking-v1';
    const baselineInput=clone(input);baselineInput.machinePolicy=policy;
    const baseAnalysis=analysis&&analysis.werte?.d0===input.d0?clone(analysis):engine.auslegen(clone(baselineInput));
    const baseSelection=selection?.ranking&&analysis&&analysis.werte?.d0===input.d0?clone(selection):engine.waehle(catalogue,baseAnalysis,baselineInput,practice);
    const baseline={value:input.d0,e:baselineInput,aus:baseAnalysis,selection:baseSelection,row:baseSelection.ranking?.recommendation||null,rows:baseSelection.alle||[]};
    const evaluated=[],concepts=[],eligible=[],seen=new Set();
    const currentDiameter=pos(baseAnalysis?.werte?.d0)?baseAnalysis.werte.d0:input.d0;
    const reason=(record,status,code,text)=>{record.status=status;record.reasonCode=code;record.reason=text;return record;};
    for(const candidate of candidates){
      const value=candidate?.value;if(!pos(value)||seen.has(value))continue;seen.add(value);
      const e=clone(input);e.d0=value;e.machinePolicy=policy;
      const record={value,candidate:clone(candidate),e,aus:null,selection:null,row:null,rows:[],compare:null,needsAnneal:false,technicalChanges:[],reasonParams:{threshold}};
      evaluated.push(record);
      if(value===currentDiameter){Object.assign(record,{aus:baseAnalysis,selection:baseSelection,row:baseline.row,rows:baseline.rows});reason(record,'unchanged','same-wire','Dieser Drahtdurchmesser ist bereits ausgewählt.');continue;}
      try{
        record.aus=engine.auslegen(clone(e));
        record.selection=engine.waehle(catalogue,record.aus,clone(e),practice);
        record.rows=record.selection.alle||[];record.row=record.selection.ranking?.recommendation||null;
      }catch{
        reason(record,'unavailable','calculation-failed','Die Drahtvariante konnte technisch nicht vollständig berechnet werden.');continue;
      }
      record.needsAnneal=value<currentDiameter&&!flowReady(engine,e);
      record.technicalChanges=describeChanges(baseline,record);
      if(record.aus?.fehlt?.length){reason(record,'unavailable','incomplete-input','Für diese Drahtvariante fehlen vollständige Eingaben oder ein gültiges Prozessmodell.');continue;}
      if(record.needsAnneal){
        reason(record,'concept','annealed-curve-required','Dünnerer Draht bedeutet mehr Staucharbeit: passenden weichgeglühten Lieferzustand und belegte Fließkurve prüfen.');concepts.push(record);continue;
      }
      if(hardFailure(record.row)){reason(record,'rejected','no-admissible-machine','Für diese Drahtvariante wurde keine technisch zulässige Maschine gefunden.');continue;}
      if(!knownForce(baseAnalysis)||!knownForce(record.aus)){
        reason(record,'concept',knownForce(baseAnalysis)?'force-became-open':'force-pending','Kraftprüfung offen; die Variante bleibt ein Konzept und wird nicht als Einsparung empfohlen.');concepts.push(record);continue;
      }
      if(hardFailure(baseline.row)){reason(record,'concept','baseline-unavailable','Ohne belastbare Ausgangsempfehlung ist kein wirtschaftlicher Variantenvergleich möglich.');concepts.push(record);continue;}
      if(tier(record.row)>tier(baseline.row)){reason(record,'rejected','technical-tier-worse','Der technische Prüfstatus verschlechtert sich; kein Einsparungsvorschlag.');continue;}
      record.compare=R.compareVariants(baseline.row.o,record.row.o,{practice,demandPerMinute:input.soll?.ausbringung});
      const gain=rawGain(baseline.row.o,record.row.o,record.compare,practice);
      if(gain===null){reason(record,'concept','economic-basis-pending','Gemeinsame Ausbringungs- oder Preisgrundlage fehlt; keine belegte Einsparung.');concepts.push(record);continue;}
      if(gain+1e-9<threshold){reason(record,'insignificant','below-threshold','Verbesserung unter der vorläufigen Schwelle von {threshold} %.');continue;}
      reason(record,'improvement','efficiency-improved','Bei vergleichbarem technischem Prüfstatus steigt die nutzbare Ausbringung pro Investition um mindestens {threshold} %.');
      eligible.push({record,gain});
    }
    eligible.sort((a,b)=>b.gain-a.gain||tier(a.record.row)-tier(b.record.row)||Math.abs(a.record.value-currentDiameter)-Math.abs(b.record.value-currentDiameter));
    return {version:'wire-optimization-v1',thresholdPercent:threshold,thresholdStatus:'provisional',baseline,evaluated,concepts,suggestions:eligible.slice(0,2).map(x=>x.record)};
  }
  return {DEFAULT_THRESHOLD_PERCENT,evaluateVariants};
});
