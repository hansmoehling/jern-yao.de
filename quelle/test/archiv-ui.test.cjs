const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const I=require('../i18n.js'),E=require('../engine.js');
const source=fs.readFileSync(path.join(__dirname,'..','archiv-ui.js'),'utf8');
const machines=JSON.parse(fs.readFileSync(path.join(__dirname,'..','maschinen.json'),'utf8'));
const praxis=JSON.parse(fs.readFileSync(path.join(__dirname,'..','praxis.json'),'utf8'));
class El{
 constructor(){this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.checked=false;this.style={};this.dataset={};this.options=[];this.files=[];this.events={};this.tBodies=[{innerHTML:'',dataset:{}}];this.selectedOptions=[{textContent:'rund'}];}
 appendChild(e){this.options.push(e)}
 replaceChildren(...elements){this.options=elements;this.value=elements[0]?.value||''}
 addEventListener(k,fn){this.events[k]=fn}
 querySelectorAll(){return []}
 scrollIntoView(options){this.scrollOptions=options}
 focus(options){this.focusOptions=options;this.focused=true}
 click(){this.clicked=true}
}
function setup(language,engine=E,showPrices){
 const ids=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new El());return ids.get(id)};
 const f=get('f'),a=get('a');f.elements={};a.elements={};
 for(const key of ['typ','wst','rm','d0','wirePreparation','rodDiameter','kopfForm','kD','kSW','kH','sD','sL','iTyp','iSize','iSW','iT','iVol','nD','nT','nDurch','mM','mSW','mH','mLoch','mFlansch','mFlanschH','masse','lStempel','wenden','ko','pko','matD','matL','stD','stL','stationen','zusatz','ausbringung','zeichnung'])f.elements[key]=new El();
 for(const key of ['ok','email','name','firma','tel','nachricht'])a.elements[key]=new El();
 Object.defineProperty(f.elements.zeichnung,'value',{get(){return this.fileValue||''},set(value){this.fileValue=value;if(value==='')this.files=[]}});
 f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund';f.elements.iTyp.value='none';f.elements.wirePreparation.value='as-supplied';
 f.reset=()=>{for(const [key,el]of Object.entries(f.elements)){if(key!=='wst')el.value='';el.checked=false;}f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund';f.elements.iTyp.value='none';f.elements.wirePreparation.value='as-supplied'};
 f.querySelector=selector=>({set checked(value){if(value)f.elements.typ.value=selector.match(/value=([^\]]+)/)[1]}});
 get('daten').textContent=JSON.stringify(machines);get('praxis').textContent=JSON.stringify(praxis);
 const examples=['m8','m6','mu','hu'].map(name=>{const el=new El();el.dataset.bsp=name;return el});
 const locale={language,t:s=>I.t(s,locale.language),apply(){}};
 const events={};const window={JYK:engine,JYI18N:I,JYLocale:locale,matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>events[name]=fn,print(){}};
 if(showPrices!==undefined)window.JY_SHOW_PRICES=showPrices;
 const document={getElementById:get,createElement:()=>new El(),querySelectorAll:selector=>selector==='[data-bsp]'?examples:[]};
 const networkRequests=[];
 const context={window,document,clearTimeout,setTimeout,location:{href:''},FormData,fetch:(...args)=>{networkRequests.push(args);throw Error('Network forbidden in archive tests')}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','concept-ui.js'),'utf8'),context);
 vm.runInNewContext(source,context);
 return {get,f,a,examples,events,context,networkRequests};
}
test('only approved wire-condition curves are selectable and all examples explicitly use annealed C4C',()=>{
 for(const language of I.supported){
  const p=setup(language),allowed=E.WERKSTOFFE.flatMap((material,index)=>(material.manualEligible?material.flowCurves||[]:[]).filter(curve=>curve.eligible===true).map(curve=>({index,material,curve})));
  assert(allowed.length>0);assert.equal(p.f.elements.wst.options.length,allowed.length);assert(allowed.length<E.WERKSTOFFE.length);
  for(const option of p.f.elements.wst.options){
   const [index,curveId]=option.value.split('|'),material=E.WERKSTOFFE[Number(index)],curve=material.flowCurves.find(curve=>curve.id===curveId);
   assert(curve?.eligible);assert(['literature','proxy'].includes(curve.approval));assert(material.number&&curve.materialNumbers?.includes(material.number)||curve.materialIds?.includes(material.id));
   const identity=(material.sourceName||material.id)+(material.number?' · '+material.number:'');
   if(['soft-annealed','normalized-rolled'].includes(curve.state))assert.equal(option.textContent,identity,'annealed and normalized-rolled states are omitted only from option labels');
   else assert.equal(option.textContent,identity+' · '+I.t(curve.state==='cold-drawn'?'gezogen':curve.stateLabel||curve.state,language));
   assert(!option.textContent.includes(I.t('Literaturansatz',language)));assert(!option.textContent.includes(curve.id));assert(curve.sourceRefs.length,'internal evidence remains available');
   assert(!['C8C','23MnB4','33B2'].includes(material.id));
  }
  const labels=p.f.elements.wst.options.map(option=>option.textContent);
  p.events['jy-languagechange']();assert.deepEqual(p.f.elements.wst.options.map(option=>option.textContent),labels,'language refresh preserves the simplified labels');
  for(const example of p.examples){example.events.click();const cards=p.get('karten').innerHTML;assert(cards.includes(I.t('Stadienkonzept für diese Maschine',language)),language+' '+example.dataset.bsp);assert(!cards.includes('NaN'));assert.equal(E.WERKSTOFFE[Number(p.f.elements.wst.value.split('|')[0])].id,'C4C');assert(p.get('material-basis').textContent.includes(I.t('weichgeglüht',language)));assert(!p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)),'all demonstration geometries stay within the selected C4C curve');}
 }
 assert(!fs.readFileSync(path.join(__dirname,'..','archiv-vorlage.html'),'utf8').includes('id="hinweise"'),'the brown note block is removed');
});

test('AISI 1010 drawn selection is independent, translated and bounded in screen, print and mail',async()=>{
 for(const language of I.supported){
  const p=setup(language),index=E.WERKSTOFFE.findIndex(material=>material.id==='AISI 1010'),curve=E.WERKSTOFFE[index].flowCurves[0];
  p.examples[0].events.click();p.f.elements.wst.value=index+'|'+curve.id;
  for(const [key,value]of Object.entries({d0:8,kD:13,kH:5,sD:8,sL:30}))p.f.elements[key].value=String(value);
  p.f.events.change();
  const state=I.t('gezogen',language),basis=p.get('material-basis').textContent;
  assert(basis.includes('AISI 1010'));assert(basis.includes(state));assert(!basis.includes(I.t('weichgeglüht',language)));
  assert(!p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)));
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(state));
  await p.get('senden').events.click();assert(new URL(p.context.location.href).searchParams.get('body').includes(state));
  p.events['jy-languagechange']();assert.equal(p.f.elements.wst.value,index+'|'+curve.id);
  p.f.elements.kD.value='18';p.f.events.change();assert(p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)));
 }
});

test('direct C10C literature curve is selectable in all languages and retains its range limit',()=>{
 for(const language of I.supported){
  const p=setup(language),index=E.WERKSTOFFE.findIndex(material=>material.id==='C10C'),material=E.WERKSTOFFE[index];
  const curve=material.flowCurves.find(item=>item.eligible&&item.approval==='literature');assert(curve,'C10C needs its own sourced curve');
  p.examples[0].events.click();p.f.elements.wst.value=index+'|'+curve.id;
  for(const [key,value]of Object.entries({d0:8,kD:13,kH:5,sD:8,sL:30}))p.f.elements[key].value=String(value);
  p.f.events.change();
  assert(p.f.elements.wst.options.some(option=>option.value===index+'|'+curve.id));
  assert(p.get('material-basis').textContent.includes('C10C'));
  assert(!p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)));
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes('C10C'));
  p.f.elements.kD.value='14';p.f.events.change();
  assert(p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)),'C10C is not extrapolated beyond the source range');
 }
});
test('out-of-range curve values stay qualitative and unsupported dropdown injections fail closed',()=>{
 const p=setup('en');p.examples[0].events.click();
 p.f.elements.kD.value='40';p.f.events.change();
 assert(p.get('kenn').innerHTML.includes(I.t('Kraft noch offen','en')));
 assert(p.get('stufen').tBodies[0].innerHTML.includes(I.t('Kraft noch offen','en')));
 assert(!p.get('karten').innerHTML.includes('Auslastung 0 %'));
 assert(!p.f.elements.rm.placeholder.includes('null'));
 assert(!p.get('karten').innerHTML.includes('NaN'));
 p.get('drucken').events.click();assert(!p.get('blatt').innerHTML.includes('null'));assert(!p.get('blatt').innerHTML.includes('Auslastung 0 %'));
 const missing=E.WERKSTOFFE.findIndex(w=>w.curveStatus==='missing');assert(missing>=0);
 p.f.elements.wst.value=String(missing);p.f.events.change();assert.equal(p.get('aus').hidden,true);assert.equal(p.get('drucken').disabled,true);
});

test('each machine shows its own open data and owner in five languages, print and mail',async()=>{
 for(const language of I.supported){
  const points=[{id:'wire-rm',owner:'Kunde / Drahtlieferant',detail:'Drahtzugfestigkeit'},{id:'machine-ko',owner:'Jern Yao',detail:'Auswerfer Matrize (KO)'}];
  let selectedModels=[];
  const engine={...E,waehle(...args){
   const found=E.waehle(...args),rows=[...found.passend,...found.bedingt];selectedModels=rows.slice(0,2).map(row=>row.o.m);
   for(const row of [...found.passend,...found.bedingt,...found.fast]){const index=selectedModels.indexOf(row.o.m);row.openPoints=index<0?[]:[points[index]];if(index>=0)row.gesamt='offen';}
   return found;
  }};
  const p=setup(language,engine);p.examples[0].events.click();
  const cards=p.get('karten').innerHTML.split(/<div class="karte(?: beste)?">/).slice(1);
  for(let index=0;index<2;index++){
   const card=cards.find(html=>html.includes('<span class="modell">'+selectedModels[index]+'</span>'));assert(card);
   const start=card.indexOf('<div class="machine-open-points">'),end=card.indexOf('</ul></div>',start),section=card.slice(start,end);
   assert(start>=0&&start<card.indexOf('<details class="machine-check"'),'open data are visible without opening details');
   assert(section.includes(I.t('Noch zu klären',language)));assert(section.includes(I.t(points[index].owner,language)));assert(section.includes(I.t(points[index].detail,language)));
   assert(!section.includes(I.t(points[1-index].detail,language)),'only this machine\'s missing data');
   assert(card.includes(I.t('Klärung nötig',language)));assert(!card.includes(I.t('Daten fehlen',language)));
   const button=card.match(/<button type="button" class="marke m-offen" data-open-check aria-controls="([^"]+)"[^>]*>([^<]+)<\/button>/);
   assert(button,'clarification is a keyboard-accessible button');
   assert.equal(button[2],I.t('Klärung nötig',language));
   assert(card.includes('<details class="machine-check" id="'+button[1]+'">'),'button refers to this machine’s detail check');
  }
  p.get('drucken').events.click();const print=p.get('blatt').innerHTML;
  await p.get('senden').events.click();const mail=new URL(p.context.location.href).searchParams.get('body');
  for(const point of points)for(const text of [print,mail])assert(text.includes(I.t(point.owner,language)+': '+I.t(point.detail,language)));
 }
});

test('inline drawing keeps the starting condition, passes both diameters, and survives print, mail and locale changes',async()=>{
 for(const language of I.supported){
  let received;
  const engine={...E,auslegen(input){received={...input};return E.auslegen(input);}};
  const p=setup(language,engine);p.examples[0].events.click();
  for(const [key,value]of Object.entries({d0:8,kD:13,kH:5,sD:8,sL:30}))p.f.elements[key].value=String(value);
  p.f.events.change();const selected=p.f.elements.wst.value;
  assert.equal(received.wirePreparation,'as-supplied');assert.equal(received.rodDiameter,undefined);
  assert(p.get('rod-diameter-field').hidden);assert(p.f.elements.rodDiameter.disabled);
  p.f.elements.wirePreparation.value='inline-drawing';p.f.elements.rodDiameter.value='8,4';p.f.events.change();
  assert.equal(received.wirePreparation,'inline-drawing');assert.equal(received.rodDiameter,8.4);assert.equal(received.d0,8);
  assert.equal(received.materialState,'soft-annealed');assert.equal(p.f.elements.wst.value,selected,'drawing is not a change of the starting condition');
  assert(!p.get('rod-diameter-field').hidden);assert(!p.f.elements.rodDiameter.disabled);assert(!p.get('wire-strength-note').hidden);
  const summary=p.get('inline-drawing-summary').textContent;
  assert(summary.includes('→'));assert(summary.includes('φ'));assert(summary.includes((8.4).toLocaleString(I.numberLocale(language))));
  assert(p.get('karten').innerHTML.includes(summary),'preparation is shown for each machine concept');
  assert.equal((p.get('stufen').tBodies[0].innerHTML.match(/<tr>/g)||[]).length,1,'inline drawing is not a press station');
  p.get('drucken').events.click();await p.get('senden').events.click();
  for(const text of [p.get('blatt').innerHTML,new URL(p.context.location.href).searchParams.get('body')]){
   assert(text.includes(I.t('Vormaterial / Vorzug',language)));assert(text.includes(I.t('Walzdraht mit Inline-Vorzug',language)));
   assert(text.includes(I.t('Walzdraht-Ø vor dem Vorzug',language)));assert(text.includes(I.t('Draht-Ø an der Presse',language)));assert(text.includes(summary));
  }
  p.events['jy-languagechange']();assert.equal(p.f.elements.wirePreparation.value,'inline-drawing');assert.equal(p.f.elements.rodDiameter.value,'8,4');
  p.f.elements.wirePreparation.value='as-supplied';p.f.events.change();assert.equal(received.rodDiameter,undefined,'stale rod diameter does not enter the no-drawing path');assert(p.get('inline-drawing-summary').hidden);
  p.examples[0].events.click();assert.equal(p.f.elements.wirePreparation.value,'as-supplied');assert.equal(p.f.elements.rodDiameter.value,'');
 }
});

test('complete rendered archive output has localized cards, figures, tooling, stages, rules and attributes before DOM translation',()=>{
 const visible=html=>html.replace(/<[^>]+>/g,' ').replace(/&(?:amp|lt|gt|quot);/g,' ');
 const german=/\b(?:bis|rund|Matrize|außen|ab|Stück|Stationen|berechnet|wünschenswert|Schneidbüchse|Teilepresse|Bolzenpresse|Knapp|Bedarf|Kriterium|Anfrage|Sonderausführungen|Prüfung|Vorgabe|Planung|Kraft noch offen)\b/u;
 for(const language of I.supported){
  const p=setup(language);
  for(const example of p.examples){
   example.events.click();
   const outputs=['kenn','karten','regeln'].map(id=>p.get(id).innerHTML).concat(p.get('stufen').tBodies[0].innerHTML);
   for(const [i,html]of outputs.entries()){
    const titles=Array.from(html.matchAll(/\btitle="([^"]*)"/g),m=>m[1]).join(' ');
    if(language!=='de')assert(!german.test(visible(html)+' '+titles),language+' '+example.dataset.bsp+' output '+i+': '+(visible(html)+' '+titles).match(german));
    assert(!/\{(?:value|rate|hourly|maximum|catalogue|page|count|weight|power)\}/.test(html),'unfilled translation template');
   }
   for(const id of ['kenn','karten','regeln'])assert.equal(p.get(id).dataset.originalText,'','localized result is protected from second translation');
   assert.equal(p.get('stufen').tBodies[0].dataset.originalText,'');
  }
 }
 const p=setup('en');p.examples[0].events.click();
 const cards=p.get('karten').innerHTML,figures=p.get('kenn').innerHTML;
 for(const expected of ['€ to ','Blank up to Ø','Die Ø','parts/h (catalogue up to '])assert(cards.includes(expected),'M8 card: '+expected);
 for(const expected of ['Station pitch from 36','Bore 8.08','outside Ø26'])assert(figures.includes(expected),'M8 figures: '+expected);
});

test('archive exposes only its translated custom file button, not the browser-native file widget',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','archiv-vorlage.html'),'utf8');
 const input=html.match(/<input\b[^>]*type="file"[^>]*>/)[0];
 assert(/\bhidden(?:\s|>)/.test(input));assert(input.includes('aria-hidden="true"'));assert(input.includes('tabindex="-1"'));
 assert(/\[hidden\]\s*\{\s*display:none !important/.test(html));
 assert(/id="archive-choose-file"[^>]*aria-describedby="archive-file-types archive-file-name"/.test(html));
 assert(/id="archive-file-status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"[^>]*hidden/.test(html));
 assert(/type="button"[^>]*id="archive-remove-file"/.test(html));
 for(const language of I.supported)assert(I.t('Datei auswählen',language).length);
});
test('manual file feedback names the local file and size in five languages, survives language changes, and clears on removal or reset',()=>{
 for(const language of I.supported){
  const p=setup(language,E,false);p.examples[0].events.click();const figures=p.get('kenn').innerHTML;
  assert(p.get('archive-file-status').hidden);p.get('archive-choose-file').events.click();assert(p.f.elements.zeichnung.clicked);
  const drawing={name:'Original <Teil>  Zeichnung.PDF',size:1500000};p.f.elements.zeichnung.files=[drawing];p.f.elements.zeichnung.events.change();
  assert.equal(p.get('archive-file-status').hidden,false);assert.equal(p.get('archive-file-status').dataset.state,'ready');
  assert.equal(p.get('archive-file-state').textContent,I.t('Datei ausgewählt',language));assert.equal(p.get('archive-file-name').textContent,drawing.name);assert.equal(p.get('archive-file-name').innerHTML,'','filename is rendered as text');
  assert.equal(p.get('archive-file-size').textContent,(1.5).toLocaleString(I.numberLocale(language),{maximumFractionDigits:1,minimumFractionDigits:0})+' MB');assert(p.get('archive-file-error').hidden);
  if(language!=='de')assert.notEqual(I.t('Datei ausgewählt',language),'Datei ausgewählt');
  const next=language==='en'?'de':'en';p.context.window.JYLocale.language=next;p.events['jy-languagechange']();
  assert.equal(p.get('archive-file-state').textContent,I.t('Datei ausgewählt',next));assert.equal(p.get('archive-file-name').textContent,drawing.name);assert.equal(p.f.elements.zeichnung.files[0],drawing);
  p.context.window.JYLocale.language=language;p.events['jy-languagechange']();assert.equal(p.get('kenn').innerHTML,figures,'file feedback leaves the calculation unchanged');
  p.get('archive-remove-file').events.click();assert.equal(p.f.elements.zeichnung.files.length,0);assert(p.get('archive-file-status').hidden);assert.equal(p.get('archive-file-name').textContent,'');assert.equal(p.get('archive-file-size').textContent,'');assert(p.get('archive-choose-file').focused);
  p.f.elements.zeichnung.files=[{name:'Große Zeichnung.step',size:25000000}];p.f.elements.zeichnung.events.change();assert.equal(p.get('archive-file-status').dataset.state,'ready','local manual adds no upload-size limit');assert.equal(p.get('archive-file-size').textContent,'25 MB');
  p.examples[1].events.click();assert.equal(p.f.elements.zeichnung.files.length,0);assert(p.get('archive-file-status').hidden,'example reset cannot leave a stale file confirmation');
  assert.equal(p.context.location.href,'');assert.deepEqual(p.networkRequests,[],'selection/removal never analyses, uploads or sends');
 }
});

test('unsupported manual file selections show a localized error and are removed from the input and mail, then recover cleanly',async()=>{
 const key='Dieses Dateiformat wird hier nicht unterstützt. Bitte wählen Sie ein angegebenes Format.';
 for(const language of I.supported){
  const p=setup(language);p.examples[0].events.click();p.a.elements.email.value='customer@example.invalid';
  p.f.elements.zeichnung.files=[{name:'Programm.exe',size:2048}];p.f.elements.zeichnung.events.change();
  assert.equal(p.f.elements.zeichnung.files.length,0,'rejected file is actually removed');assert.equal(p.get('archive-file-status').dataset.state,'invalid');assert.equal(p.get('archive-file-status').hidden,false);
  assert.equal(p.get('archive-file-state').textContent,I.t('Dateiauswahl prüfen',language));assert.equal(p.get('archive-file-name').textContent,'Programm.exe');assert.equal(p.get('archive-file-error').textContent,I.t(key,language));assert.equal(p.get('archive-file-error').hidden,false);
  if(language!=='de')assert.notEqual(I.t(key,language),key);
  p.events['jy-languagechange']();assert.equal(p.get('archive-file-status').dataset.state,'invalid','language refresh cannot turn rejection into success');
  assert.equal(p.context.location.href,'');assert.deepEqual(p.networkRequests,[]);
  await p.get('senden').events.click();assert(!new URL(p.context.location.href).searchParams.get('body').includes('Programm.exe'),'explicit mail request does not carry a rejected file');
  p.f.elements.zeichnung.files=[{name:'Bauteil.iges',size:800}];p.f.elements.zeichnung.events.change();assert.equal(p.get('archive-file-status').dataset.state,'ready');assert(p.get('archive-file-error').hidden);assert.equal(p.get('archive-file-error').textContent,'');assert.equal(p.get('archive-file-size').textContent,'800 B');
  p.f.elements.zeichnung.files=[{name:'Leer.pdf',size:0}];p.f.elements.zeichnung.events.change();assert.equal(p.f.elements.zeichnung.files.length,0);assert.equal(p.get('archive-file-status').dataset.state,'invalid');assert.equal(p.get('archive-file-error').textContent,I.t('Die ausgewählte Datei ist leer. Bitte wählen Sie die Zeichnung erneut aus.',language));
  p.f.elements.zeichnung.files=[];p.f.elements.zeichnung.events.change();assert(p.get('archive-file-status').hidden,'empty selection removes stale feedback');
 }
});

test('print and mail are fully localized before DOM translation, with identical summary numbers and unchanged customer text',async()=>{
 for(const language of I.supported){
  const p=setup(language);p.examples[0].events.click();
  p.a.elements.name.value='Original Name';p.a.elements.firma.value='Original Firma';p.a.elements.email.value='customer@example.invalid';
  const original='Kopfdurchmesser  13 mm\nOriginalnotiz bleibt unverändert';p.a.elements.nachricht.value=original;
  p.f.elements.zeichnung.files=[{name:'Original_Zeichnung.pdf'}];
  p.get('drucken').events.click();
  const html=p.get('blatt').innerHTML;
  assert(html.includes('<h1>'+I.t('Anforderungsblatt Mehrstufenpresse',language)+'</h1>'));
  assert(html.includes(I.t('Grobauslegung, unverbindlich',language)));
  assert.equal(p.get('blatt').dataset.originalText,'');
  const summary=html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
  assert(summary.includes((8).toLocaleString(I.numberLocale(language))+' mm'));
  assert(summary.includes('C4C'));assert(summary.includes(I.t('weichgeglüht',language)));assert(summary.includes(I.t('Literaturansatz',language)));
  if(language!=='de')assert(!/Teileart|Drahtzugfestigkeit|Werkstoffmodell|Kopfdurchmesser|Körperlänge|Höchste Stationskraft|Nennkraft nötig|Kopf fertigstauchen|Vorauswahl|Richtpreis|Auslastung/.test(summary),language+' untranslated summary');
  await p.get('senden').events.click();
  const uri=new URL(p.context.location.href),body=uri.searchParams.get('body');
  assert(uri.searchParams.get('subject').startsWith(I.t('Richtpreisanfrage',language)));
  assert(body.includes(original.replace(/\n/g,'\r\n')),'customer note is preserved');
  assert(body.includes(summary.replace(/\n/g,'\r\n')),'mail and print summaries are identical');
  assert(body.includes('Original_Zeichnung.pdf'));
  assert(body.includes(I.t('(bitte anhängen)',language)));
  assert(!uri.searchParams.get('subject').includes('undefined'));
 }
});

test('technical-only manual removes prices from cards, print and email in five languages without changing machine selection',async()=>{
 const translations=JSON.parse(fs.readFileSync(path.join(__dirname,'..','i18n-integration.json'),'utf8'));
 const machineSubject=language=>language==='de'?'Maschinenanfrage':translations.Maschinenanfrage[['it','sl','en','zh'].indexOf(language)];
 const models=html=>Array.from(html.matchAll(/<span class="modell">([^<]+)<\/span>/g),match=>match[1]);
 for(const language of I.supported){
  const variants=[undefined,true,false].map(flag=>({flag,p:setup(language,E,flag)}));
  for(const {flag,p}of variants){
   p.examples[0].events.click();p.a.elements.email.value='customer@example.invalid';
   const cards=p.get('karten').innerHTML;assert(models(cards).length>0,'the price-free result still offers machines');
   const priced=flag!==false;
   assert.equal(cards.includes('class="preis"'),priced,language+' card price block');
   assert.equal(cards.includes('€'),priced,language+' card currency');
   p.get('drucken').events.click();const print=p.get('blatt').innerHTML;
   await p.get('senden').events.click();const mail=new URL(p.context.location.href),body=mail.searchParams.get('body'),subject=mail.searchParams.get('subject');
   for(const [channel,text]of [['print',print],['email',body]]){
    assert.equal(text.includes('€'),priced,language+' '+channel+' currency');
    assert.equal(text.includes(I.t('Richtpreis',language)),priced,language+' '+channel+' price label');
    assert(text.includes(I.t('Höchste Stationskraft',language)),channel+' retains technical requirements');
    assert(text.includes(models(cards)[0]),channel+' retains the selected machine');
   }
   assert(subject.startsWith((priced?I.t('Richtpreisanfrage',language):machineSubject(language))+' '),language+' localized enquiry subject');
   assert(subject.includes(models(cards)[0]),'enquiry subject retains the model');
   if(!priced)assert(!subject.includes(I.t('Richtpreisanfrage',language))&&!subject.includes('€'));
   const labels=cards;p.events['jy-languagechange']();assert.equal(p.get('karten').innerHTML,labels,'locale refresh retains the price policy');
  }
  const baseline=variants[0].p;
  for(const {p}of variants.slice(1)){
   assert.deepEqual(models(p.get('karten').innerHTML),models(baseline.get('karten').innerHTML),'price policy preserves recommendation order');
   assert.equal(p.get('kenn').innerHTML,baseline.get('kenn').innerHTML,'price policy preserves calculated figures');
   assert.equal(p.get('stufen').tBodies[0].innerHTML,baseline.get('stufen').tBodies[0].innerHTML,'price policy preserves the forming sequence');
  }
 }
});

const requestModel=(p,model)=>p.get('karten').events.click({target:{closest:selector=>selector==='button[data-request-model]'?{dataset:{requestModel:model}}:null}});
const quoteModels=p=>Array.from(p.get('karten').innerHTML.matchAll(/<button type="button" class="quote-button" data-request-model="([^"]+)" aria-label="([^"]+)">([^<]+)<\/button>/g));

test('each machine quote button selects that model for the form, print and mail without changing the customer note or sending',async()=>{
 for(const language of I.supported)for(const prices of [true,false]){
  const p=setup(language,E,prices);p.examples[0].events.click();
  const buttons=quoteModels(p);assert(buttons.length>1,'fixture must offer a machine beyond the first recommendation');
  assert.equal(buttons.length,(p.get('karten').innerHTML.match(/<span class="modell">/g)||[]).length,'every displayed machine has its own quote button');
  for(const button of buttons){assert.equal(button[3],I.t('Angebot anfragen',language));assert.equal(button[2],I.t('Angebot anfragen',language)+' · '+button[1],'accessible name includes visible label and model');}
  if(language!=='de'){assert.notEqual(I.t('Angebot anfragen',language),'Angebot anfragen');assert.notEqual(I.t('Anfrage für {model}',language),'Anfrage für {model}');}
  const first=buttons[0][1],selected=buttons[1][1],note='Originalnotiz  mit Abstand\nBitte Zeichnung beachten';
  p.a.elements.nachricht.value=note;p.a.elements.email.value='customer@example.invalid';
  requestModel(p,'INVENTED-MODEL');assert(p.get('selected-machine').hidden);assert(!p.a.elements.email.focused,'unavailable model is rejected');
  requestModel(p,selected);
  const label=I.t('Anfrage für {model}',language).replace('{model}',selected);
  assert.equal(p.get('selected-machine').textContent,label);assert.equal(p.get('selected-machine').hidden,false);assert.equal(p.get('selected-machine').dataset.originalText,'');
  assert(p.a.elements.email.focused);assert.equal(p.a.elements.email.focusOptions.preventScroll,true);assert.equal(p.get('anfrage').scrollOptions.block,'start');
  assert.equal(p.context.location.href,'','selecting a model never sends or opens mail');assert.equal(p.a.elements.nachricht.value,note);
  const changedLanguage=language==='en'?'de':'en';p.context.window.JYLocale.language=changedLanguage;p.events['jy-languagechange']();
  assert.equal(p.get('selected-machine').textContent,I.t('Anfrage für {model}',changedLanguage).replace('{model}',selected),'language changes retain and translate the chosen model');
  p.context.window.JYLocale.language=language;p.events['jy-languagechange']();
  p.get('drucken').events.click();const print=p.get('blatt').innerHTML;assert(print.includes(label));assert(print.includes('\n  '+selected+' ('));assert(!print.includes('\n  '+first+' ('),'print uses the chosen machine instead of the first match');
  await p.get('senden').events.click();const mail=new URL(p.context.location.href),body=mail.searchParams.get('body');
  assert.equal(mail.searchParams.get('subject'),I.t(prices?'Richtpreisanfrage':'Maschinenanfrage',language)+' '+selected);
  assert(body.includes(label));assert(body.includes('\r\n  '+selected+' ('));assert(!body.includes('\r\n  '+first+' ('));assert(body.includes(note.replace(/\n/g,'\r\n')));
  assert.equal(p.a.elements.nachricht.value,note);if(!prices)assert(!/€/.test(print+body));
 }
});

test('quote selections are cleared when calculation inputs or available models change, including pending input',async()=>{
 const p=setup('de');p.examples[0].events.click();const chosen=quoteModels(p)[1][1];requestModel(p,chosen);
 p.f.elements.sL.value='41';p.f.events.input();assert(p.get('selected-machine').hidden,'pending input immediately clears the old choice');
 await p.get('senden').events.click();assert(!new URL(p.context.location.href).searchParams.get('body').includes('Anfrage für '+chosen),'send recalculates pending geometry without the stale selection');
 const next=quoteModels(p)[1][1];requestModel(p,next);p.f.elements.d0.value='';p.f.events.change();assert(p.get('selected-machine').hidden);assert.equal(p.get('drucken').disabled,true);assert.equal(p.get('empty-visual').hidden,false);
 requestModel(p,chosen);assert(p.get('selected-machine').hidden,'old card clicks are rejected after an incomplete calculation');
 let available=true;
 const engine={...E,waehle(...args){const result=E.waehle(...args);return available?result:{...result,passend:[],bedingt:[],fast:[]};}};
 const q=setup('de',engine);assert.equal(q.get('empty-visual').hidden,false);q.examples[0].events.click();assert.equal(q.get('empty-visual').hidden,true);
 requestModel(q,quoteModels(q)[0][1]);available=false;q.f.events.change();assert(q.get('selected-machine').hidden,'model must still be in the current results');assert.equal(q.get('empty-visual').hidden,false,'no machine matches keeps the empty visual');
});

test('normalized-rolled dropdown labels are simplified while the selected result retains the technical state',()=>{
 for(const language of I.supported){
  const p=setup(language),index=E.WERKSTOFFE.findIndex(material=>material.id==='20MnB4'),material=E.WERKSTOFFE[index],curve=material.flowCurves.find(item=>item.state==='normalized-rolled'&&item.eligible);
  assert(curve);p.examples[0].events.click();p.f.elements.wst.value=index+'|'+curve.id;p.f.events.change();
  const option=p.f.elements.wst.options.find(item=>item.value===p.f.elements.wst.value);assert(option);assert(!option.textContent.includes(I.t('normalisierend warmgewalzt',language)));
  assert(p.get('material-basis').textContent.includes(I.t('normalisierend warmgewalzt',language)));p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(I.t('normalisierend warmgewalzt',language)));
 }
});

test('drive profile choices reach the result, each machine concept, print and mail in all five languages',async()=>{
 const german=/Innenantrieb|Innensechskant|Kreuzschlitz|Vertiefungsvolumen|Restwand|Umformkraft|Tiefe|Abschnittlänge|Teilemasse/u;
 for(const language of I.supported){
  const p=setup(language);p.examples[0].events.click();
  for(const [family,size]of [['torx','T20'],['ph','PH2'],['pz','PZ2']]){
   p.f.elements.iTyp.value=family;p.f.events.change();
   assert(p.f.elements.iSize.options.some(option=>option.value===size));
   p.f.elements.iSize.value=size;p.f.elements.iT.value='3';p.f.elements.iSW.value='999';p.f.events.change();
   assert.equal(p.get('aus').hidden,false);
   const figures=p.get('kenn').innerHTML,cards=p.get('karten').innerHTML;
   assert(figures.includes(size));assert(figures.includes(I.t('nicht belegt',language)));
   assert(cards.includes(size));assert(cards.includes(I.t('Stadienkonzept für diese Maschine',language)));
   assert(!/NaN|null|undefined/.test(figures+cards));
   if(language!=='de')assert(!german.test(figures+cards),language+' '+family+' untranslated drive: '+(figures+cards).match(german));
   p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(size));
   await p.get('senden').events.click();assert(new URL(p.context.location.href).searchParams.get('body').includes(size));
   p.events['jy-languagechange']();assert.equal(p.f.elements.iSize.value,size,'locale update preserves drive selection');
  }
 }
});

test('hex presets and custom widths remain usable, while changing profile or size clears stale CAD volume',()=>{
 const p=setup('en');p.examples[1].events.click();
 assert.equal(p.f.elements.iTyp.value,'hex');assert.equal(p.f.elements.iSize.value,'5');
 assert(p.get('kenn').innerHTML.includes('Hex socket AF 5 mm'));
 p.f.elements.iSize.value='custom';p.f.elements.iSW.value='4.5';p.f.events.change();
 assert.equal(p.get('drive-custom-hex').hidden,false);assert(p.get('kenn').innerHTML.includes('4,5 mm'));
 p.f.elements.iTyp.value='torx';p.f.events.change();p.f.elements.iSize.value='T20';p.f.events.change();
 p.f.elements.iVol.value='40';p.f.events.change();assert.equal(p.f.elements.iVol.value,'40');
 assert(!p.get('kenn').innerHTML.match(/<dt>Blank<\/dt><dd>[^<]*unverified/));
 p.f.elements.iSize.value='T25';p.f.events.change();assert.equal(p.f.elements.iVol.value,'');
 p.f.elements.iVol.value='50';p.f.events.change();p.f.elements.iTyp.value='pz';p.f.events.change();assert.equal(p.f.elements.iVol.value,'');
 p.f.elements.iTyp.value='none';p.f.events.change();assert.equal(p.get('aus').hidden,false);assert(!p.get('kenn').innerHTML.includes('<dt>Internal drive</dt>'));
});
