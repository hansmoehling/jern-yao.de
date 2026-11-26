'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const R=require('../machine-ranking.js');
const U=require('../ranking-ui.js');
const translations={...require('../i18n-p6.json'),...require('../i18n-report-release.json'),...require('../i18n-p1-ranking.json')};
const requirements={blankDiameter:5.6,blankLength:36,partLength:30,stations:2,forceTonnes:24,demandPerMinute:30};
const practice={quote:0.35,modelle:{'JBF-10B3S':90}};
const machine=(m,rp,extra={})=>({m,f:'JBF',st:3,cd:8,cl:[10,70],ml:50,ko:60,sz:'M6',pw:40,out:300,rp,...extra});
function fixture(){
  const machines=[machine('JBF-10B3S',100),machine('JBF-10B4S',125,{st:4}),machine('JBF-13B3S',140,{cd:10}),machine('JBF-10B3SL',150,{cl:[15,100],ml:75}),machine('JBF-7B3S',50,{cd:5})];
  return R.rankMachines(machines,{requirements,practice,checkMachine:o=>({gesamt:o.cd<5.6?'nein':'ok',ausl:0.6,k:[{krit:'Technische Prüfung',status:o.cd<5.6?'nein':'ok',soll:'5.6 mm',ist:o.cd+' mm'}]})});
}
const options={requirements,practice,showPrices:true,fmt:x=>Number(x.toFixed(2)).toString(),eur:x=>'EUR '+x};

test('recommendation is one sentence while full dimensions and class priority belong to the details',()=>{
  const ranking=fixture(),html=U.summaryHtml(ranking,options),lead=html.split('<details class="ranking-grid">')[0];
  assert.match(lead,/<h3>Empfehlung<\/h3>/);
  assert.match(lead,/<p class="ranking-recommendation"><strong>JBF-10B3S:<\/strong> Auslastung 60 %, eine Reservestation, Draht-Ø 5.6 mm bei Abschnitt-Ø bis 8 mm\.<\/p>/);
  assert.doesNotMatch(lead,/Maschinenbereich|Teillänge|Richtpreis|ranking-checks|ranking-request/);
  const details=U.detailsHtml(ranking.recommendation,ranking,options);
  assert.match(details,/2 Stadien bei 3 Stationen/);
  assert.match(details,/Abschnittlänge 36 mm; Maschinenbereich 10 bis 70 mm/);
  assert.match(details,/Niedrigster Richtpreis der verglichenen Kandidaten aus Eignungsklasse A/);
  assert.match(lead,/5 Katalogmodelle technisch geprüft/);
  const card=U.cardHtml(ranking.recommendation,ranking,options);
  assert.doesNotMatch(card,/<ul|Technische Prüfung: Prüfungen erfüllt/);
  assert.doesNotMatch(card,/Auslastung|Reservestation|Draht-Ø|Maschinenbereich|Teillänge|Richtpreis|ranking-request/);
});

test('all-ok recommendation cards stay compact while only open or tight checks are visible',()=>{
  const ranking=fixture(),row=ranking.recommendation;
  row.k=Array.from({length:14},(_,i)=>({krit:'Prüfung '+i,status:'ok',soll:'10',ist:'12'}));
  const allOk=U.cardHtml(row,ranking,options);
  assert.doesNotMatch(allOk,/<ul|<li>|Prüfung \d/);
  row.k.push({krit:'Presskraft',status:'knapp'},{krit:'Auswerferweg',status:'offen'});
  const needsChecks=U.cardHtml(row,ranking,options);
  assert.equal((needsChecks.match(/<li>/g)||[]).length,2);
  assert.match(needsChecks,/Presskraft: Grenzbereich/);
  assert.match(needsChecks,/Auswerferweg: Technische Prüfung offen/);
  assert.doesNotMatch(needsChecks,/Prüfung \d/);
});

test('open suitability and incomplete price order remain explicit',()=>{
  const ranking=fixture(),row=ranking.recommendation;
  row.gesamt='offen';row.k=[{krit:'Technische Prüfung',status:'offen',soll:'Kraft',ist:'offen'}];
  const open=U.summaryHtml(ranking,options);
  assert.match(open,/<h3>Vorauswahl<\/h3>/);
  assert.match(open,/Technische Eignung noch offen; siehe Prüfung im Einzelnen/);
  ranking.priceRankingComplete=false;
  const fallback=U.detailsHtml(row,ranking,{...options,showPrices:false});
  assert.match(fallback,/Preisrang nicht vollständig verfügbar/);
  assert.doesNotMatch(fallback,/Niedrigster Richtpreis|Richtpreis EUR/);
  assert.match(U.summaryHtml(null,options),/Keine Empfehlung/);
});

test('alternative comparison is rounded, demand capped and states the common output basis',()=>{
  const ranking=fixture(),row=ranking.alternatives[0],html=U.cardHtml(row,ranking,options);
  assert.match(html,/Alternative 1/);
  assert.match(html,/ca. 25 % teurer als JBF-10B3S/);
  assert.match(html,/und etwa 20 % weniger amortisationseffizient; 2 Reservestationen/);
  assert.doesNotMatch(html,/Maschinenbereich|Teillänge/);
  assert.match(html,/<details class="ranking-basis"><summary>Vergleichsbasis<\/summary>/);
  assert.match(html,/Kataloghubzahl beider Modelle × 35 %/);
  assert.match(html,/Bedarf von 30 Stück\/min/);
  assert.match(html,/keine berechnete Amortisationszeit/);
  assert.doesNotMatch(html,/amortisiert sich|Monate|Jahre/);
  const bothPractice={modelle:{'JBF-10B3S':100,'JBF-10B4S':110}};
  assert.match(U.cardHtml(row,ranking,{...options,practice:bothPractice}),/Praxiswerte für beide Modelle/);
});

test('a cheaper alternative without reserve has a compact price and amortisation comparison',()=>{
  const ranking=fixture(),row={...ranking.recommendation,o:machine('JBF-10B2S',80,{st:2}),ranking:{...ranking.recommendation.ranking,classification:'B'}};
  ranking.alternatives=[row,...ranking.alternatives].slice(0,2);
  const html=U.cardHtml(row,ranking,options);
  assert.match(html,/ca. 20 % preiswerter als JBF-10B3S und etwa 25 % mehr amortisationseffizient; ohne Reservestation\./);
  assert.doesNotMatch(html,/Maschinenbereich|Teillänge|Draht-Ø/);
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
  assert.match(html,/ca. 25 % teurer/);assert.match(html,/etwa 20 % weniger amortisationseffizient/);
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
  assert.doesNotMatch(html,/% (mehr|weniger) amortisationseffizient/);
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
  assert.doesNotMatch(html,/Universal- oder Quertransfer bestätigen lassen/);
  const excluded=html.split('Größe kleiner: JBF-7B3S')[1].split('Größe größer:')[0];
  assert.match(excluded,/Kein Ausbringungsvergleich: Modell technisch ausgeschlossen/);
  assert.doesNotMatch(excluded,/% (mehr|weniger) amortisationseffizient/);
});

test('knife and transfer requests are consolidated once after the selected cards',()=>{
  const ranking=fixture(),summary=U.summaryHtml(ranking,options),cards=[ranking.recommendation,...ranking.alternatives].map(r=>U.cardHtml(r,ranking,options)).join('');
  assert.doesNotMatch(summary+cards,/ranking-request|Geschlossenes Abschermesser bestätigen|Universal- oder Quertransfer bestätigen/);
  const requests=U.requestHtml(ranking,options);
  assert.equal((requests.match(/Geschlossenes Abschermesser bestätigen lassen\./g)||[]).length,1);
  assert.equal((requests.match(/Universal- oder Quertransfer bestätigen lassen\./g)||[]).length,1);
  assert.equal(U.requestHtml(null,options),'');
  ranking.recommendation.requestPoints=[];ranking.alternatives=[];assert.equal(U.requestHtml(ranking,options),'');
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
  const html=U.cardHtml(row,ranking,options)+U.detailsHtml(row,ranking,{...options,fmt:()=>'<svg/onload=x>'});
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
    if(index>=0){assert.ok(html.includes(translations['Empfehlung'][index]));assert.ok(html.includes(translations['Ohne Werkzeug- und Betriebskosten; keine berechnete Amortisationszeit.'][index]));assert.ok(html.includes(translations['etwa {percent} % weniger amortisationseffizient'][index].replace('{percent}','20')));}
  }
});

test('size-grid checks are localized and ranking reason codes never become interface text',()=>{
  const ranking=fixture(),reason={krit:'Größenklasse',status:'nein',grund:'unter der Größenklasse des Rasters',code:'below-size-grid'};
  for(const model of ['JBF-7B3S','JBF-10B4S'])ranking.all.find(r=>r.o.m===model).k.push(reason);
  ranking.recommendation.ranking.reasons.push({code:'thread-size-grid'},{code:'standard-five-stage-nut-occupancy'});
  for(const index of [-1,0,1,2,3]){
    const tr=key=>index<0?key:translations[key]?.[index]||key;
    const html=U.summaryHtml(ranking,{...options,tr})+U.detailsHtml(ranking.recommendation,ranking,{...options,tr});
    assert(html.includes(tr('Größenklasse')));
    const gridDetails=html.split('<div class="ranking-table-scroll">')[1],neighbours=html.split('<div class="ranking-table-scroll">')[0];
    for(const section of [neighbours,gridDetails])assert(section.includes(tr('unter der Größenklasse des Rasters')),'reason appears in neighbours and model details');
    assert.doesNotMatch(html,/thread-size-grid|standard-five-stage-nut-occupancy|below-size-grid/);
    if(index>=0){assert(!html.includes('Größenklasse'));assert(!html.includes('unter der Größenklasse des Rasters'));}
  }
  reason.grund='<img src=x onerror=alert(1)>';
  const malicious=U.summaryHtml(ranking,options);assert(!malicious.includes('<img'));assert(malicious.includes('&lt;img'));
});

test('browser exports match CommonJS without document or event-handler dependencies',()=>{
  const context={};vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../machine-ranking.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../ranking-ui.js'),'utf8'),context);
  const ranking=fixture();
  assert.equal(context.JYRankingUI.summaryHtml(ranking,options),U.summaryHtml(ranking,options));
  assert.equal(context.JYRankingUI.cardHtml(ranking.alternatives[0],ranking,options),U.cardHtml(ranking.alternatives[0],ranking,options));
});
