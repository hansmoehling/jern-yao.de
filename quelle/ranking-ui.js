(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./machine-ranking.js'):root.JYMachineRanking);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.JYRankingUI=api;
})(typeof globalThis==='object'?globalThis:this,function(R){
  'use strict';
  const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const pos=v=>finite(v)&&v>0;
  const statuses={ok:'Prüfungen erfüllt',knapp:'Grenzbereich',offen:'Technische Prüfung offen',nein:'Ausgeschlossen'};
  const directions={smaller:'Größe kleiner',larger:'Größe größer','fewer-stations':'Eine Stationsstufe weniger','more-stations':'Eine Stationsstufe mehr',shorter:'Kürzere Längenstufe',longer:'Längere Längenstufe'};
  const requests={'confirm-closed-knife':'Geschlossenes Abschermesser bestätigen lassen.','closed-knife-variant-required':'Variante mit geschlossenem Abschermesser anfragen.','confirm-transfer':'Universal- oder Quertransfer bestätigen lassen.'};
  function context(options){
    const o=options||{},tr=typeof o.tr==='function'?o.tr:s=>s;
    const n=v=>finite(v)?String(typeof o.fmt==='function'?o.fmt(v):Number(v.toFixed(2))):'—';
    const text=(key,values={})=>String(tr(key)??key).replace(/\{(\w+)\}/g,(all,k)=>Object.prototype.hasOwnProperty.call(values,k)?String(values[k]):all);
    return {o,n,text,t:(key,values)=>escape(text(key,values)),req:o.requirements||{}};
  }
  function status(row,c){return c.t(statuses[row?.gesamt]||statuses.offen);}
  function facts(row,c){
    const o=row.o||{},q=c.req,parts=[];
    if(pos(q.blankDiameter)&&pos(o.cd))parts.push(c.t('Draht-Ø {wire} mm bei Abschnitt-Ø bis {capacity} mm',{wire:c.n(q.blankDiameter),capacity:c.n(o.cd)}));
    else if(pos(o.cd))parts.push(c.t('Draht-Ø noch offen; Abschnitt-Ø bis {capacity} mm',{capacity:c.n(o.cd)}));
    else parts.push(c.t('Abschnitt-Ø muss noch geprüft werden'));
    if(pos(q.stations)&&pos(o.st))parts.push(c.t('{required} Stadien bei {available} Stationen',{required:c.n(q.stations),available:c.n(o.st)}));
    else if(pos(o.st))parts.push(c.t('{available} Stationen; Stadienfolge noch offen',{available:c.n(o.st)}));
    if(pos(q.blankLength)&&pos(o.cl?.[1]))parts.push(c.t('Abschnittlänge {length} mm; Maschinenbereich {minimum} bis {maximum} mm',{length:c.n(q.blankLength),minimum:pos(o.cl[0])?c.n(o.cl[0]):'—',maximum:c.n(o.cl[1])}));
    else parts.push(c.t('Abschnittlänge muss noch geprüft werden'));
    if(pos(q.partLength)&&pos(o.ml))parts.push(c.t('Teillänge {length} mm bei Produktlänge bis {capacity} mm',{length:c.n(q.partLength),capacity:c.n(o.ml)}));
    const utilization=row.ranking?.components?.force?.value;
    if(finite(utilization))parts.push(c.t('Kraftauslastung {percent} %',{percent:c.n(100*utilization)}));
    const reserve=pos(q.stations)&&pos(o.st)?o.st-q.stations:null;
    if(reserve===0)parts.push(c.t('keine Reservestation'));
    else if(reserve>0)parts.push(c.t('{count} Reservestation(en)',{count:c.n(reserve)}));
    if(row.execution?.transfer==='universal')parts.push(c.t('Universaltransfer'));
    if(row.execution?.transfer==='quer')parts.push(c.t('Quertransfer'));
    return parts.join('; ')+'.';
  }
  function absolutePrice(row,c){
    if(c.o.showPrices!==true||!pos(row.o?.rp))return '';
    const value=typeof c.o.eur==='function'?c.o.eur(row.o.rp):c.n(row.o.rp)+' EUR';
    return c.t('Richtpreis {price}',{price:value});
  }
  function validChange(v,directions){return v&&directions.includes(v.direction)&&finite(v.percent)&&v.percent>=0&&v.percent<=10000&&v.percent%5===0&&(v.direction!=='same'||v.percent===0);}
  function comparison(row,reference,ranking,c){
    if(!R||!reference||row.o?.m===reference.o?.m)return null;
    // Price-free pages consume only explicitly supplied, rounded service results.
    // They never derive relative prices from accidental raw catalogue fields.
    const value=c.o.showPrices===true?R.compareVariants(reference.o,row.o,{practice:c.o.practice||{},demandPerMinute:c.req.demandPerMinute}):
      row.comparison||ranking.comparisons?.[row.o?.m];
    if(!value||value.reference!==reference.o?.m||value.alternative!==row.o?.m||!validChange(value.price,['same','cheaper','dearer']))return null;
    const basis=value.basis;
    const validBasis=basis&&(basis.source==='practice-pair'||basis.source==='catalog-factor'&&pos(basis.factor)&&basis.factor<=1)&&
      (basis.demandCap===null||pos(basis.demandCap))&&basis.toolCostsIncluded===false;
    const excluded=row.gesamt==='nein'||row.technicalEligible===false;
    return {...value,excluded,efficiency:!excluded&&validBasis&&validChange(value.efficiency,['same','higher','lower'])?value.efficiency:null,basis:validBasis?basis:null};
  }
  function comparisonHtml(row,reference,ranking,c){
    const v=comparison(row,reference,ranking,c);if(!v)return '<p class="ranking-comparison">'+c.t('Kein belastbarer Preisvergleich verfügbar.')+'</p>';
    const priceKeys={same:'etwa gleich teuer wie {model}',cheaper:'ca. {percent} % preiswerter als {model}',dearer:'ca. {percent} % teurer als {model}'};
    let sentence=c.t(priceKeys[v.price.direction],{percent:c.n(v.price.percent),model:v.reference});
    if(v.efficiency){
      const efficiencyKeys={same:'etwa gleiche nutzbare Ausbringung pro Investition',higher:'etwa {percent} % mehr nutzbare Ausbringung pro Investition',lower:'etwa {percent} % weniger nutzbare Ausbringung pro Investition'};
      sentence+=' '+c.t(v.connector==='but'?'aber':'und')+' '+c.t(efficiencyKeys[v.efficiency.direction],{percent:c.n(v.efficiency.percent)});
    }
    let basis='';
    if(v.efficiency){
      basis=v.basis.source==='practice-pair'?c.t('Vergleichsbasis: Praxiswerte für beide Modelle.'):c.t('Vergleichsbasis: Kataloghubzahl beider Modelle × {factor} %.',{factor:c.n(v.basis.factor*100)});
      if(pos(v.basis.demandCap))basis+=' '+c.t('Nutzbare Ausbringung auf den Bedarf von {demand} Stück/min begrenzt.',{demand:c.n(v.basis.demandCap)});
      basis+=' '+c.t('Ohne Werkzeug- und Betriebskosten; keine berechnete Amortisationszeit.');
    }else basis=c.t(v.excluded?'Kein Ausbringungsvergleich: Modell technisch ausgeschlossen.':'Für den Ausbringungsvergleich fehlt eine gemeinsame belastbare Grundlage.');
    return '<p class="ranking-comparison">'+sentence+'.</p><p class="ranking-basis"><small>'+basis+'</small></p>';
  }
  function checksHtml(checks,c,all=false){
    const selected=(Array.isArray(checks)?checks:[]).filter(k=>all||k.status!=='ok');
    if(!selected.length)return '';
    return '<ul class="ranking-checks">'+selected.map(k=>{
      const criterion=k.code==='rotative-transfer-not-offered'?'Rotativer Transfer wird nicht angeboten.':k.krit||'Technische Prüfung';
      let s=c.t(criterion)+': '+c.t(statuses[k.status]||statuses.offen);
      if(k.soll!==undefined)s+='; '+c.t('Bedarf: {value}',{value:c.text(String(k.soll))});
      if(k.ist!==undefined)s+='; '+c.t('Maschine: {value}',{value:c.text(String(k.ist))});
      if(k.detail)s+='; '+c.t(String(k.detail));
      return '<li>'+s+'</li>';
    }).join('')+'</ul>';
  }
  function requestHtml(row,c){
    const keys=[...new Set((row.requestPoints||[]).map(p=>requests[p.code]).filter(Boolean))];
    return keys.length?'<p class="ranking-request">'+keys.map(k=>c.t(k)).join(' ')+'</p>':'';
  }
  function gridHtml(ranking,selected,c){
    if(!R)return '';
    const g=R.gridFor(ranking,selected.o.m);if(!g)return '';
    const lookup=new Map((ranking.all||[]).map(r=>[r.o.m,r]));
    let html='<details class="ranking-grid"><summary>'+c.t('Warum diese? Maschinenraster')+'</summary><p>'+c.t('Baureihe {series}, Größenklasse {size}',{series:g.series,size:c.n(g.sizeClass)})+'</p>';
    if(g.neighbours.length)html+='<ul class="ranking-neighbours">'+g.neighbours.map(n=>{
      const row=lookup.get(n.model);if(!row)return '';
      return '<li><strong>'+c.t(directions[n.direction])+': '+escape(n.model)+'</strong> — '+status(row,c)+
        '<p>'+facts(row,c)+'</p>'+checksHtml(n.checks,c)+comparisonHtml(row,selected,ranking,c)+'</li>';
    }).join('')+'</ul>';
    html+='<div class="ranking-table-scroll"><table><caption>'+c.t('Stationen und vorhandene Längenstufen')+'</caption><thead><tr><th scope="col">'+c.t('Stationen')+'</th>'+g.lengthCodes.map(code=>'<th scope="col">'+escape(code)+'</th>').join('')+'</tr></thead><tbody>';
    for(const station of g.stations){
      html+='<tr><th scope="row">'+escape(c.n(station))+'</th>';
      for(const code of g.lengthCodes){
        const cells=g.cells.filter(x=>x.stations===station&&x.lengthCode===code);
        html+='<td>'+cells.map(cell=>{
          const row=lookup.get(cell.model);
          return '<details'+(cell.selected?' open':'')+'><summary>'+escape(cell.model)+' — '+status(row,c)+(cell.selected?' ('+c.t('Empfehlung')+')':'')+'</summary>'+checksHtml(cell.checks,c,true)+(cell.selected?'':comparisonHtml(row,selected,ranking,c))+'</details>';
        }).join('')+(cells.length?'':c.t('Kein Katalogmodell'))+'</td>';
      }
      html+='</tr>';
    }
    return html+'</tbody></table></div></details>';
  }
  function summaryHtml(ranking,options={}){
    const c=context(options),row=ranking?.recommendation;
    if(!row||row.gesamt==='nein'||row.technicalEligible===false)return '<p class="ranking-summary">'+c.t('Keine Empfehlung aus den geprüften Modellen.')+'</p>';
    const prefix=row.gesamt==='offen'?'Vorauswahl: {model}; technische Eignung noch offen.':'Empfehlung: {model}.';
    let html='<section class="ranking-summary"><p><strong>'+c.t(prefix,{model:row.o.m})+'</strong> '+facts(row,c)+'</p>';
    const price=absolutePrice(row,c);if(price)html+='<p>'+price+'.</p>';
    if(ranking.priceRankingComplete===true)html+='<p>'+c.t(row.gesamt==='offen'?'Niedrigster Richtpreis innerhalb der noch offenen Vorauswahl.':'Niedrigster Richtpreis unter den Kandidaten mit vergleichbarem technischem Prüfstatus.')+'</p>';
    else html+='<p>'+c.t('Preisrang nicht vollständig verfügbar; Reihenfolge nach technischer Bewertung.')+'</p>';
    if(row.gesamt==='knapp')html+='<p>'+c.t('Einzelne Prüfungen liegen im Grenzbereich.')+'</p>';
    html+=checksHtml(row.k,c)+requestHtml(row,c);
    if(Number.isInteger(ranking.checkedCount)&&ranking.checkedCount>=0)html+='<p><small>'+c.t('{count} Katalogmodelle technisch geprüft.',{count:c.n(ranking.checkedCount)})+'</small></p>';
    return html+gridHtml(ranking,row,c)+'</section>';
  }
  function cardHtml(row,ranking,options={}){
    const c=context(options),reference=ranking?.recommendation;
    const shown=[reference,...(ranking?.alternatives||[]).slice(0,2)].filter(Boolean);
    if(!row?.o||row.gesamt==='nein'||row.technicalEligible===false||!shown.some(r=>r.o.m===row.o.m))return '';
    const index=shown.findIndex(r=>r.o.m===row.o.m),role=index===0?'Empfehlung':'Alternative {number}';
    let html='<section class="ranking-card" data-ranking-model="'+escape(row.o.m)+'"><p><strong>'+c.t(role,{number:c.n(index)})+'</strong> — '+status(row,c)+'</p><p>'+facts(row,c)+'</p>';
    const price=absolutePrice(row,c);if(price)html+='<p>'+price+'.</p>';
    if(index>0)html+=comparisonHtml(row,reference,ranking,c);
    return html+checksHtml(row.k,c)+requestHtml(row,c)+'</section>';
  }
  return {summaryHtml,cardHtml};
});
