'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const R=require('../machine-ranking.js');
const U=require('../ranking-ui.js');
const translations=require('../i18n-p6.json');
const requirements={blankDiameter:5.6,blankLength:36,partLength:30,stations:2,forceTonnes:24,demandPerMinute:30};
const practice={quote:0.35,modelle:{'JBF-10B3S':90}};
const machine=(m,rp,extra={})=>({m,f:'JBF',st:3,cd:8,cl:[10,70],ml:50,ko:60,sz:'M6',pw:40,out:300,rp,...extra});
function fixture(){
  const machines=[machine('JBF-10B3S',100),machine('JBF-10B4S',125,{st:4}),machine('JBF-13B3S',140,{cd:10}),machine('JBF-10B3SL',150,{cl:[15,100],ml:75}),machine('JBF-7B3S',50,{cd:5})];
  return R.rankMachines(machines,{requirements,practice,checkMachine:o=>({gesamt:o.cd<5.6?'nein':'ok',ausl:0.6,k:[{krit:'Technische Prüfung',status:o.cd<5.6?'nein':'ok',soll:'5.6 mm',ist:o.cd+' mm'}]})});
}
const options={requirements,practice,showPrices:true,fmt:x=>Number(x.toFixed(2)).toString(),eur:x=>'EUR '+x};

test('summary explains wire, stages, lengths and real price priority without promoting reserve scores',()=>{
  const ranking=fixture(),html=U.summaryHtml(ranking,options);
  assert.match(html,/Empfehlung: JBF-10B3S/);
  assert.match(html,/Draht-Ø 5.6 mm bei Abschnitt-Ø bis 8 mm/);
  assert.match(html,/2 Stadien bei 3 Stationen/);
  assert.match(html,/Abschnittlänge 36 mm; Maschinenbereich 10 bis 70 mm/);
  assert.match(html,/Richtpreis EUR 100/);
  assert.match(html,/Niedrigster Richtpreis unter den Kandidaten mit vergleichbarem technischem Prüfstatus/);
  assert.match(html,/5 Katalogmodelle technisch geprüft/);
  assert.doesNotMatch(html,/Klasse A|Klasse B|Klasse C|Hans|gepflegt_von/);
});

test('open suitability and incomplete price order remain explicit',()=>{
  const ranking=fixture(),row=ranking.recommendation;
  row.gesamt='offen';row.k=[{krit:'Technische Prüfung',status:'offen',soll:'Kraft',ist:'offen'}];
  const open=U.summaryHtml(ranking,options);
  assert.match(open,/Vorauswahl: JBF-10B3S; technische Eignung noch offen/);
  assert.match(open,/Niedrigster Richtpreis innerhalb der noch offenen Vorauswahl/);
  ranking.priceRankingComplete=false;
  const fallback=U.summaryHtml(ranking,{...options,showPrices:false});
  assert.match(fallback,/Preisrang nicht vollständig verfügbar/);
  assert.doesNotMatch(fallback,/Niedrigster Richtpreis|Richtpreis EUR/);
  assert.match(U.summaryHtml(null,options),/Keine Empfehlung/);
});

test('alternative comparison is rounded, demand capped and states the common output basis',()=>{
  const ranking=fixture(),row=ranking.alternatives[0],html=U.cardHtml(row,ranking,options);
  assert.match(html,/Alternative 1/);
  assert.match(html,/ca. 25 % teurer als JBF-10B3S/);
  assert.match(html,/etwa 20 % weniger nutzbare Ausbringung pro Investition/);
  assert.match(html,/Kataloghubzahl beider Modelle × 35 %/);
  assert.match(html,/Bedarf von 30 Stück\/min/);
  assert.match(html,/keine berechnete Amortisationszeit/);
  assert.doesNotMatch(html,/amortisiert sich|Monate|Jahre/);
  const bothPractice={modelle:{'JBF-10B3S':100,'JBF-10B4S':110}};
  assert.match(U.cardHtml(row,ranking,{...options,practice:bothPractice}),/Praxiswerte für beide Modelle/);
});

test('price-free rendering never derives a relative table or absolute values from supplied prices',()=>{
  const ranking=fixture(),o={...options,showPrices:false};
  for(const row of ranking.all){row.o.rp=123456+row.o.st;row.o.lo=234567;row.o.hi=345678;}
  const html=U.summaryHtml(ranking,o)+ranking.candidates.map(row=>U.cardHtml(row,ranking,o)).join('');
  assert.doesNotMatch(html,/12345\d|234567|345678|EUR|€|% (teurer|preiswerter)/);
  assert.match(html,/Kein belastbarer Preisvergleich/);
});

test('price-free comparison accepts only rounded explicit service results for the matching pair',()=>{
  const ranking=fixture(),row=ranking.alternatives[0],o={...options,showPrices:false};
  row.comparison=R.compareVariants(ranking.recommendation.o,row.o,{practice,demandPerMinute:30});
  const html=U.cardHtml(row,ranking,o);
  assert.match(html,/ca. 25 % teurer/);assert.match(html,/etwa 20 % weniger nutzbare Ausbringung/);
  assert.doesNotMatch(html,/Richtpreis EUR/);
  row.comparison.reference='JBF-7B3S';
  assert.doesNotMatch(U.cardHtml(row,ranking,o),/ca. 25 % teurer/);
  row.comparison.reference=ranking.recommendation.o.m;row.comparison.price.percent=24.123;
  assert.doesNotMatch(U.cardHtml(row,ranking,o),/24.123/);
  delete row.comparison;
  ranking.comparisons={[row.o.m]:R.compareVariants(ranking.recommendation.o,row.o,{practice,demandPerMinute:30})};
  assert.match(U.cardHtml(row,ranking,o),/ca. 25 % teurer/);
});

test('missing common output basis shows price only and never invents an efficiency result',()=>{
  const ranking=fixture(),row=ranking.alternatives[0];
  const html=U.cardHtml(row,ranking,{...options,practice:{}});
  assert.match(html,/ca. 25 % teurer/);
  assert.match(html,/fehlt eine gemeinsame belastbare Grundlage/);
  assert.doesNotMatch(html,/% (mehr|weniger) nutzbare/);
});

test('real neighbour grid has existing models, their checks and no fabricated family facts',()=>{
  const ranking=fixture(),html=U.summaryHtml(ranking,options);
  assert.match(html,/<details class="ranking-grid">/);
  assert.match(html,/Größe kleiner: JBF-7B3S/);
  assert.match(html,/Ausgeschlossen/);
  assert.match(html,/Bedarf: 5.6 mm; Maschine: 5 mm/);
  assert.match(html,/Längere Längenstufe: JBF-10B3SL/);
  assert.match(html,/Eine Stationsstufe mehr: JBF-10B4S/);
  assert.match(html,/Kein Katalogmodell/);
  assert.doesNotMatch(html,/JBF-10B4SL|onclick=|; Universaltransfer\.|; Quertransfer\./);
  assert.match(html,/Universal- oder Quertransfer bestätigen lassen/);
  const excluded=html.split('Größe kleiner: JBF-7B3S')[1].split('Größe größer:')[0];
  assert.match(excluded,/Kein Ausbringungsvergleich: Modell technisch ausgeschlossen/);
  assert.doesNotMatch(excluded,/% (mehr|weniger) nutzbare/);
});

test('only recommendation and at most two valid alternatives produce card fragments',()=>{
  const ranking=fixture(),cards=ranking.all.map(row=>U.cardHtml(row,ranking,options));
  assert.equal(cards.filter(Boolean).length,3);
  assert.equal(U.cardHtml(ranking.all.find(r=>r.gesamt==='nein'),ranking,options),'');
  assert.equal(U.cardHtml(ranking.additional[0],ranking,options),'');
});

test('every external string, formatter result and translation is escaped',()=>{
  const ranking=fixture(),row=ranking.recommendation;
  row.o.m='bad"><img src=x onerror=alert(1)>';row.k=[{krit:'<script>alert(1)</script>',status:'offen',soll:'" onfocus="x',ist:'<b>value</b>'}];
  const html=U.cardHtml(row,ranking,{...options,fmt:()=>'<svg/onload=x>',eur:()=>'<script>price</script>'});
  assert.doesNotMatch(html,/<img|<script|<svg|<b>|onfocus="/);
  assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.match(html,/&lt;svg/);
  const translated=U.cardHtml(row,ranking,{...options,tr:s=>'<img src=x>'+s});
  assert.doesNotMatch(translated,/<img/);assert.match(translated,/&lt;img/);
});

test('all four translations preserve placeholders and render all five languages',()=>{
  const placeholders=s=>[...s.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort();
  for(const[key,values]of Object.entries(translations)){
    assert.equal(values.length,4,key);
    for(const value of values){assert.ok(value.trim(),key);assert.deepEqual(placeholders(value),placeholders(key),key);}
  }
  const source=fs.readFileSync(path.join(__dirname,'../ranking-ui.js'),'utf8');
  for(const match of source.matchAll(/c\.t\('([^']+)'/g))assert.ok(translations[match[1]],match[1]);
  const ranking=fixture();
  for(const index of [-1,0,1,2,3]){
    const tr=key=>index<0?key:translations[key]?.[index]||key;
    const html=U.summaryHtml(ranking,{...options,tr})+U.cardHtml(ranking.alternatives[0],ranking,{...options,tr});
    assert.match(html,/JBF-10B3S/);assert.doesNotMatch(html,/\{\w+\}/);
    if(index>=0){assert.ok(html.includes(translations['Empfehlung: {model}.'][index].replace('{model}','JBF-10B3S')));assert.ok(html.includes(translations['Ohne Werkzeug- und Betriebskosten; keine berechnete Amortisationszeit.'][index]));}
  }
});

test('browser exports match CommonJS without document or event-handler dependencies',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../machine-ranking.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../ranking-ui.js'),'utf8'),context);
  const ranking=fixture();
  assert.equal(context.JYRankingUI.summaryHtml(ranking,options),U.summaryHtml(ranking,options));
  assert.equal(context.JYRankingUI.cardHtml(ranking.alternatives[0],ranking,options),U.cardHtml(ranking.alternatives[0],ranking,options));
});
