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
 scrollIntoView(){}
}
function setup(language){
 const ids=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new El());return ids.get(id)};
 const f=get('f'),a=get('a');f.elements={};a.elements={};
 for(const key of ['typ','wst','rm','d0','kopfForm','kD','kSW','kH','sD','sL','iTyp','iSize','iSW','iT','iVol','nD','nT','nDurch','mM','mSW','mH','mLoch','mFlansch','mFlanschH','masse','lStempel','wenden','ko','pko','matD','matL','stD','stL','stationen','zusatz','ausbringung','zeichnung'])f.elements[key]=new El();
 for(const key of ['ok','email','name','firma','tel','nachricht'])a.elements[key]=new El();
 f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund';f.elements.iTyp.value='none';
 f.reset=()=>{for(const [key,el]of Object.entries(f.elements)){if(key!=='wst')el.value='';el.checked=false;}f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund';f.elements.iTyp.value='none'};
 f.querySelector=selector=>({set checked(value){if(value)f.elements.typ.value=selector.match(/value=([^\]]+)/)[1]}});
 get('daten').textContent=JSON.stringify(machines);get('praxis').textContent=JSON.stringify(praxis);
 const examples=['m8','m6','mu','hu'].map(name=>{const el=new El();el.dataset.bsp=name;return el});
 const events={};const window={JYK:E,JYI18N:I,JYLocale:{language,t:s=>I.t(s,language),apply(){}},matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>events[name]=fn,print(){}};
 const document={getElementById:get,createElement:()=>new El(),querySelectorAll:selector=>selector==='[data-bsp]'?examples:[]};
 const context={window,document,clearTimeout,setTimeout,location:{href:''},FormData,fetch:()=>{throw Error('Network forbidden in archive tests')}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','concept-ui.js'),'utf8'),context);
 vm.runInNewContext(source,context);
 return {get,f,a,examples,events,context};
}
test('only approved wire-condition curves are selectable and all examples explicitly use annealed C4C',()=>{
 for(const language of I.supported){
  const p=setup(language),allowed=E.WERKSTOFFE.flatMap((material,index)=>(material.manualEligible?material.flowCurves||[]:[]).filter(curve=>curve.eligible===true).map(curve=>({index,material,curve})));
  assert(allowed.length>0);assert.equal(p.f.elements.wst.options.length,allowed.length);assert(allowed.length<E.WERKSTOFFE.length);
  for(const option of p.f.elements.wst.options){
   const [index,curveId]=option.value.split('|'),material=E.WERKSTOFFE[Number(index)],curve=material.flowCurves.find(curve=>curve.id===curveId);
   assert(curve?.eligible);assert(['literature','proxy'].includes(curve.approval));assert(material.number&&curve.materialNumbers?.includes(material.number)||curve.materialIds?.includes(material.id));
   assert(option.textContent.includes(I.t(curve.state==='cold-drawn'?'gezogen (Literaturzustand)':'weichgeglüht',language)));assert(option.textContent.includes(I.t('Literaturansatz',language)));
   assert(!['C8C','23MnB4','33B2'].includes(material.id));
  }
  for(const example of p.examples){example.events.click();const cards=p.get('karten').innerHTML;assert(cards.includes(I.t('Stadienkonzept für diese Maschine',language)),language+' '+example.dataset.bsp);assert(!cards.includes('NaN'));assert.equal(E.WERKSTOFFE[Number(p.f.elements.wst.value.split('|')[0])].id,'C4C');assert(p.get('material-basis').textContent.includes(I.t('weichgeglüht',language)));assert(!p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)),'all demonstration geometries stay within the selected C4C curve');}
 }
});

test('AISI 1010 drawn selection is independent, translated and bounded in screen, print and mail',async()=>{
 for(const language of I.supported){
  const p=setup(language),index=E.WERKSTOFFE.findIndex(material=>material.id==='AISI 1010'),curve=E.WERKSTOFFE[index].flowCurves[0];
  p.examples[0].events.click();p.f.elements.wst.value=index+'|'+curve.id;
  for(const [key,value]of Object.entries({d0:8,kD:13,kH:5,sD:8,sL:30}))p.f.elements[key].value=String(value);
  p.f.events.change();
  const state=I.t('gezogen (Literaturzustand)',language),basis=p.get('material-basis').textContent;
  assert(basis.includes('AISI 1010'));assert(basis.includes(state));assert(!basis.includes(I.t('weichgeglüht',language)));
  assert(!p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)));
  assert(p.get('hinweise').innerHTML.includes('0.0336'));
  if(language!=='de')assert(!/gezogenes|Ziehgrad|Wärmebehandlung|dynamischer Einfluss|Raumtemperatur/.test(p.get('hinweise').innerHTML));
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

test('complete rendered archive output has localized cards, figures, tooling, stages, rules and attributes before DOM translation',()=>{
 const visible=html=>html.replace(/<[^>]+>/g,' ').replace(/&(?:amp|lt|gt|quot);/g,' ');
 const german=/\b(?:bis|rund|Matrize|außen|ab|Stück|Stationen|berechnet|wünschenswert|Schneidbüchse|Teilepresse|Bolzenpresse|Knapp|Bedarf|Kriterium|Anfrage|Sonderausführungen|Prüfung|Vorgabe|Planung|Kraft noch offen)\b/u;
 for(const language of I.supported){
  const p=setup(language);
  for(const example of p.examples){
   example.events.click();
   const outputs=['kenn','hinweise','karten','regeln'].map(id=>p.get(id).innerHTML).concat(p.get('stufen').tBodies[0].innerHTML);
   for(const [i,html]of outputs.entries()){
    const titles=Array.from(html.matchAll(/\btitle="([^"]*)"/g),m=>m[1]).join(' ');
    if(language!=='de')assert(!german.test(visible(html)+' '+titles),language+' '+example.dataset.bsp+' output '+i+': '+(visible(html)+' '+titles).match(german));
    assert(!/\{(?:value|rate|hourly|maximum|catalogue|page|count|weight|power)\}/.test(html),'unfilled translation template');
   }
   for(const id of ['kenn','hinweise','karten','regeln'])assert.equal(p.get(id).dataset.originalText,'','localized result is protected from second translation');
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
 for(const language of I.supported)assert(I.t('Datei auswählen',language).length);
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

test('drive profile choices reach the result, each machine concept, print and mail in all five languages',async()=>{
 const german=/Innenantrieb|Innensechskant|Kreuzschlitz|Vertiefungsvolumen|Restwand|Umformkraft|Tiefe|Abschnittlänge|Teilemasse/u;
 for(const language of I.supported){
  const p=setup(language);p.examples[0].events.click();
  for(const [family,size]of [['torx','T20'],['ph','PH2'],['pz','PZ2']]){
   p.f.elements.iTyp.value=family;p.f.events.change();
   assert(p.f.elements.iSize.options.some(option=>option.value===size));
   p.f.elements.iSize.value=size;p.f.elements.iT.value='3';p.f.elements.iSW.value='999';p.f.events.change();
   assert.equal(p.get('aus').hidden,false);
   const figures=p.get('kenn').innerHTML,cards=p.get('karten').innerHTML,notes=p.get('hinweise').innerHTML;
   assert(figures.includes(size));assert(figures.includes(I.t('nicht belegt',language)));
   assert(cards.includes(size));assert(cards.includes(I.t('Stadienkonzept für diese Maschine',language)));
   assert(!/NaN|null|undefined/.test(figures+cards+notes));
   if(language!=='de')assert(!german.test(figures+cards+notes),language+' '+family+' untranslated drive: '+(figures+cards+notes).match(german));
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
