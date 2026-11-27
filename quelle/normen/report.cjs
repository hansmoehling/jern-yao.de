'use strict';
const fs=require('node:fs'),path=require('node:path');
const N=require('./library.js'),R=require('./resolver.js'),A=require('./availability.js');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const order=(a,b)=>a<b?-1:a>b?1:0;
const entries=value=>object(value)?Object.entries(value).sort(([a],[b])=>order(a,b)):[];
const sum=(values,key)=>values.reduce((total,value)=>total+value[key],0);
const safe=value=>String(value??'').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
const evidenceKeys=['verifiedMultiple','singleSource','unverified','missing','conflict'];
function sourceRegistry(family){
  const registry=new Map();
  function add(id,source){
    if(!id||!object(source))return;
    let url=null;try{const parsed=new URL(source.url);if(['http:','https:'].includes(parsed.protocol)){parsed.hash='';url=parsed.href;}}catch{}
    const next={...source,url},prior=registry.get(id);
    // An ID pointing at different documents must not accidentally verify a fact.
    registry.set(id,prior?.ambiguous||prior?.url&&url&&prior.url!==url?{ambiguous:true}: {...prior,...next,url:url||prior?.url||null});
  }
  for(const [id,source]of entries(family.sourceMeta))add(id,source);
  for(const source of family.quellen||[])if(object(source))add(source.id,source);
  return registry;
}
function evidenceSummary(family){
  const registry=sourceRegistry(family),result={records:0,...Object.fromEntries(evidenceKeys.map(key=>[key,0])),withoutDocument:0,unresolvedReferences:0,duplicateDocumentReferences:0,statusOnlyReferences:0};
  function visit(value){
    if(Array.isArray(value)){value.forEach(visit);return;}
    if(!object(value))return;
    if(Array.isArray(value.sourceRefs)&&('status'in value||'verification'in value)){
      result.records++;
      const refs=[...new Set(value.sourceRefs)],documents=new Set();let resolved=0;
      for(const ref of refs){
        const source=registry.get(ref);
        if(!source?.url||source.ambiguous){result.unresolvedReferences++;continue;}
        if(['edition-status','edition-changes'].includes(source.scope)||['standard-register','standards-body'].includes(source.type||source.kind)&&!source.url.toLowerCase().includes('.pdf')){result.statusOnlyReferences++;continue;}
        resolved++;documents.add(source.url);
      }
      result.duplicateDocumentReferences+=resolved-documents.size;
      if(!documents.size)result.withoutDocument++;
      const state=value.status;
      if(state==='conflict')result.conflict++;
      else if(state==='missing'||state==='unresearched'||state==='unresolved'||value.value===null)result.missing++;
      else if(state==='verified'&&value.verification!==false&&documents.size>=2)result.verifiedMultiple++;
      else if(documents.size===1)result.singleSource++;
      else result.unverified++;
    }
    for(const [,child]of entries(value))visit(child);
  }
  visit(family);return result;
}
function familyRows(family){
  return [
    ...entries(family.groessen).map(([size,row])=>({size,row,variant:null})),
    ...(family.variants||[]).flatMap(variant=>entries(variant.sizeData).map(([size,row])=>({size,row,variant:variant.id})))
  ];
}
function spectrumSummary(family,rows,data,machines){
  const result={within:0,excluded:0,unknown:0,notApplicable:0};
  for(const item of rows){
    if(['invalid-reference','rivet-size-series'].includes(family.datasetKind)){result.notApplicable++;continue;}
    const selection={id:family.id,groesse:item.size,...(item.variant?{form:item.variant}:{})};
    let part;
    try{part=N.adapt(data,R.resolveStandard(N.selectionLibrary(data,selection),selection,{},{shaftPolicy:'shaft-v2'}));}catch{result.unknown++;continue;}
    const check=A.sizeAvailability({part,catalogue:machines});
    if(check.disabled)result.excluded++;
    else if(check.diameter>0&&check.candidateCount>check.unknownCount)result.within++;
    else result.unknown++;
  }
  return result;
}
function declaredSizeCoverage(family){
  const result={documented:0,notInStandard:0,unresearched:0,other:0};
  for(const owner of [family,...family.variants||[]])for(const [,value]of entries(owner.sizeCoverage)){
    const key=({documented:'documented','not-in-standard':'notInStandard',unresearched:'unresearched'})[value.status]||'other';result[key]++;
  }
  return result;
}
function summarize({families,threads={},machines=[]}){
  if(!Array.isArray(families)||families.some(f=>!f.id||!object(f.groessen)))throw new TypeError('Normfamilien mit id und groessen erforderlich.');
  if(new Set(families.map(f=>f.id)).size!==families.length)throw new TypeError('Doppelte Normfamilien-ID.');
  const sorted=[...families].sort((a,b)=>order(a.id,b.id)),data={schemaVersion:1,version:'report',families:sorted,threads};
  const details=sorted.map(f=>{
    const rows=familyRows(f),lengths=rows.map(item=>entries(item.row.nachLaenge).length),variantCount=(f.variants||[]).length;
    const editionKind=f.edition==null?'missing':/^catalog/.test(String(f.edition))?'catalogue':'stated';
    return {id:f.id,edition:f.edition??null,editionKind,editionStatus:f.editionStatus??null,datasetKind:f.datasetKind||'part-standard',
      directSizes:entries(f.groessen).length,variantCount,variantSizes:rows.filter(row=>row.variant!==null).length,
      lengthCells:lengths.reduce((a,b)=>a+b,0),sizesWithLengths:lengths.filter(n=>n>0).length,
      lengthRelevant:f.funktion!=='mutter'&&!['invalid-reference','rivet-size-series'].includes(f.datasetKind),
      sourceStatus:evidenceSummary(f),sizeCoverage:declaredSizeCoverage(f),spectrum:spectrumSummary(f,rows,data,machines)};
  });
  const total={families:details.length,directFamilies:details.filter(f=>f.directSizes>0).length,directSizes:sum(details,'directSizes'),variantSizes:sum(details,'variantSizes'),variantCount:sum(details,'variantCount'),lengthCells:sum(details,'lengthCells'),sizesWithLengths:sum(details,'sizesWithLengths'),withLengths:details.filter(f=>f.lengthCells>0).length,lengthRelevant:details.filter(f=>f.lengthRelevant).length,withoutLengths:details.filter(f=>f.lengthRelevant&&!f.lengthCells).length,
    editions:{stated:details.filter(f=>f.editionKind==='stated').length,catalogue:details.filter(f=>f.editionKind==='catalogue').length,missing:details.filter(f=>f.editionKind==='missing').length},
    sourceStatus:Object.fromEntries(Object.keys(details[0]?.sourceStatus||evidenceSummary({})).map(key=>[key,details.reduce((n,f)=>n+f.sourceStatus[key],0)])),
    spectrum:Object.fromEntries(['within','excluded','unknown','notApplicable'].map(key=>[key,details.reduce((n,f)=>n+f.spectrum[key],0)]))};
  return {versions:[...new Set(sorted.map(f=>f.version).filter(Boolean))].sort(order),machineCount:machines.length,total,families:details};
}
function renderReport(input){
  const report=summarize(input),t=report.total;
  const lines=['# Normbibliothek – automatisch erzeugter Abdeckungsbericht','',
    'Erzeugt mit `node quelle/normen/report.cjs` aus den Familien-JSON-Dateien, dem Gewindedatensatz und dem Maschinenkatalog. `bauen.py` aktualisiert diesen Bericht automatisch. Manuelle Änderungen werden überschrieben.','',
    'Datensatzversionen laut Dateien: '+(report.versions.map(safe).join(', ')||'nicht angegeben')+'. Dies ist kein neues fachliches Prüfdatum.','',
    'Der Bericht zählt vorhandene Daten und deren gespeicherten Prüfstatus. Er bestätigt weder die Vollständigkeit einer Norm noch die Aktualität ihrer Ausgabe oder die Machbarkeit eines Bauteils.','',
    '## Datenbestand','',
    '| Merkmal | Anzahl |','|---|---:|',
    `| Familienreferenzen | ${t.families} |`,`| Familien mit direkten Größenzeilen | ${t.directFamilies} |`,`| Direkte Größen-/Steigungszeilen | ${t.directSizes} |`,`| Definierte Varianten | ${t.variantCount} |`,`| Zusätzliche Varianten-Größenzeilen | ${t.variantSizes} |`,`| Größen-/Variantenzeilen mit mindestens einer Längenzelle | ${t.sizesWithLengths} |`,`| Gespeicherte Längenzellen | ${t.lengthCells} |`,`| Familien mit mindestens einer Längenzelle | ${t.withLengths} |`,`| Längenrelevante Produktfamilien ohne Längenzelle | ${t.withoutLengths} von ${t.lengthRelevant} |`,`| Ausgabe angegeben | ${t.editions.stated} |`,`| Katalogausgabe nicht zugeordnet | ${t.editions.catalogue} |`,`| Ausgabe fehlt | ${t.editions.missing} |`,'',
    'Direkte Größen und Variantengrößen werden getrennt gezählt. Varianten ohne eigene Größenzeilen erzeugen keine zusätzlichen Größen. Eine Längenzelle ist ein vorhandener Eintrag in `nachLaenge`, unabhängig von seinem Quellenstatus; eine globale Kataloglängenliste ist keine nachgewiesene Matrix je Größe. Muttern, reine Durchmesserreihen und ungültige Verweise zählen nicht als längenrelevante Produktfamilien.','',
    '## Quellenstatus','',
    '| Gespeicherter Maß-/Metadatensatz | Anzahl |','|---|---:|',
    `| Als bestätigt markiert, mindestens zwei verschiedene auflösbare Quelldokumente | ${t.sourceStatus.verifiedMultiple} |`,`| Nur ein auflösbares Quelldokument | ${t.sourceStatus.singleSource} |`,`| Ungeprüft oder nicht ausreichend zugeordnet | ${t.sourceStatus.unverified} |`,`| Fehlend oder ausdrücklich offen | ${t.sourceStatus.missing} |`,`| Widersprüchlich | ${t.sourceStatus.conflict} |`,`| Summe der Maß-/Metadatensätze | ${t.sourceStatus.records} |`,'',
    `Zusätzliche Diagnose: ${t.sourceStatus.withoutDocument} Datensätze ohne auflösbares Maßdokument; ${t.sourceStatus.unresolvedReferences} nicht auflösbare Quellenreferenzen; ${t.sourceStatus.duplicateDocumentReferences} weitere Referenzen auf dasselbe Dokument; ${t.sourceStatus.statusOnlyReferences} Referenzen auf reine Status-/Änderungsseiten. Diese Diagnosezahlen überschneiden sich mit der Tabelle.`, '',
    'Gezählt werden Datensätze mit `sourceRefs` und Prüfstatus; derselbe Zahlenwert kann an mehreren Datenstellen vorkommen. `quellen` und `sourceMeta` werden zusammen ausgewertet. Gleiche Dokument-URLs zählen einmal. Verschiedene Domains oder Quellen-IDs beweisen keine Unabhängigkeit: „bestätigt“ übernimmt nur die bereits hinterlegte Bewertung und setzt mindestens zwei auflösbare Maßdokumente voraus. Reine Normstatusseiten bestätigen keine Maßzahl. Eine angegebene Ausgabe ist nicht automatisch verifiziert.','',
    '## Familien und Längen','',
    '| Familie | Datenedition | Direkte Größen | Variantengrößen | Varianten | Größen mit Längen | Längenzellen | Offene Größenmetadaten |','|---|---|---:|---:|---:|---:|---:|---:|'];
  for(const f of report.families)lines.push(`| ${safe(f.id)} | ${f.editionKind==='stated'?safe(f.edition):f.editionKind==='catalogue'?'Katalogausgabe offen':'offen'} | ${f.directSizes} | ${f.variantSizes} | ${f.variantCount} | ${f.sizesWithLengths} | ${f.lengthCells} | ${f.sizeCoverage.unresearched+f.sizeCoverage.other} |`);
  lines.push('','„Offene Größenmetadaten“ zählt ausdrücklich ungeprüfte oder anderweitig offene Einträge in `sizeCoverage`. Null bedeutet nicht, dass alle möglichen Größen erfasst sind. Als „nicht in der Norm vorgesehen“ markierte Größen bleiben von Recherchelücken getrennt.','',
    '## Quellenstatus je Familie','',
    '| Familie | Bestätigt mit ≥2 Dokumenten | Einquelle | Ungeprüft | Fehlend/offen | Konflikt | Nicht vorgesehene Größen laut Metadaten |','|---|---:|---:|---:|---:|---:|---:|');
  for(const f of report.families){const s=f.sourceStatus;lines.push(`| ${safe(f.id)} | ${s.verifiedMultiple} | ${s.singleSource} | ${s.unverified} | ${s.missing} | ${s.conflict} | ${f.sizeCoverage.notInStandard} |`);}
  lines.push('','## Bezug zum Maschinenkatalog','',
    `Geprüfter Katalogumfang: ${report.machineCount} Modelle. Der Bericht verwendet denselben vorsichtigen Schaftkontur-/Werkzeugaufnahmevergleich wie die Größenauswahl. Kopf- oder Mutteraußendurchmesser allein liefern keinen Ausschluss. Fehlende Konturen oder Aufnahmemaße bleiben offen. Dies ersetzt keine Prüfung von Draht, Kraft, Stationen, Transport und Länge.`, '',
    '„Im Aufnahmerahmen“ bedeutet: Mindestens eine dokumentierte Werkzeugaufnahme ist groß genug. „Außerhalb“ gilt nur bei einem belegten Ausschluss durch alle Modelle. Ohne belegte Kontur oder hinreichende Maschinendaten bleibt die Zeile „offen“. Eine ausgewählte Länge wird nicht erfunden; `ml` und `cl` begrenzen unterschiedliche Größen.','',
    '| Familie | Im Aufnahmerahmen | Außerhalb aller Aufnahmen | Offen | Keine Teilekonturprüfung |','|---|---:|---:|---:|---:|');
  for(const f of report.families){const s=f.spectrum;lines.push(`| ${safe(f.id)} | ${s.within} | ${s.excluded} | ${s.unknown} | ${s.notApplicable} |`);}
  lines.push(`| **Summe** | **${t.spectrum.within}** | **${t.spectrum.excluded}** | **${t.spectrum.unknown}** | **${t.spectrum.notApplicable}** |`,'',
    '## Gesonderte Referenzen','');
  const special=report.families.filter(f=>['invalid-reference','rivet-size-series'].includes(f.datasetKind));
  if(!special.length)lines.push('Keine gesonderten Referenztypen im Datensatz.');
  for(const f of special)lines.push(`- ${safe(f.id)}: ${f.datasetKind==='invalid-reference'?'ungültiger Produktverweis; keine vollständige Teilefamilie':'Durchmesserreihe; keine eigenständige vollständige Teilekontur'}.`);
  lines.push('','## Grenzen der Auswertung','',
    '- DIN- und ISO-Ausgaben sowie Hersteller-Sortimente werden nicht gleichgesetzt.','- Ein fehlender Tabellenwert bedeutet eine Datenlücke; daraus folgt kein Normverbot.','- Modellannahmen für Radien, Bohrungsgründe oder Bundkonturen sind keine recherchierten Normmaße.','- Vollständige Längenmatrizen und unabhängige Zweitbelege bleiben dort offen, wo die Familien-Daten sie nicht nachweisen.','');
  return lines.join('\n');
}
function loadInputs(directory=__dirname){
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const families=fs.readdirSync(directory).filter(name=>name.endsWith('.json')).sort(order).map(name=>read(path.join(directory,name))).filter(f=>object(f)&&f.id&&object(f.groessen));
  return {families,threads:read(path.join(directory,'gewinde.json')),machines:read(path.join(directory,'../maschinen.json'))};
}
if(require.main===module){
  const text=renderReport(loadInputs()),file=path.join(__dirname,'BERICHT.md');
  if(process.argv.includes('--check')){
    if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==text){process.stderr.write('BERICHT.md ist nicht aktuell. node quelle/normen/report.cjs ausführen.\n');process.exitCode=1;}
  }else{fs.writeFileSync(file,text,'utf8');process.stdout.write('Normbericht aktualisiert.\n');}
}
module.exports={sourceRegistry,evidenceSummary,familyRows,summarize,renderReport,loadInputs};
