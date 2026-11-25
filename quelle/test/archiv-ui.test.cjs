const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const I=require('../i18n.js'),E=require('../engine.js');
const source=fs.readFileSync(path.join(__dirname,'..','archiv-ui.js'),'utf8');
const machines=JSON.parse(fs.readFileSync(path.join(__dirname,'..','maschinen.json'),'utf8'));
const praxis=JSON.parse(fs.readFileSync(path.join(__dirname,'..','praxis.json'),'utf8'));
class El{
 constructor(){this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.checked=false;this.style={};this.dataset={};this.options=[];this.files=[];this.events={};this.tBodies=[{innerHTML:''}];this.selectedOptions=[{textContent:'rund'}];}
 appendChild(e){this.options.push(e)}
 addEventListener(k,fn){this.events[k]=fn}
 querySelectorAll(){return []}
 scrollIntoView(){}
}
function setup(language){
 const ids=new Map();const get=id=>{if(!ids.has(id))ids.set(id,new El());return ids.get(id)};
 const f=get('f'),a=get('a');f.elements={};a.elements={};
 for(const key of ['typ','wst','rm','d0','kopfForm','kD','kSW','kH','sD','sL','iSW','iT','nD','nT','nDurch','mM','mSW','mH','mLoch','mFlansch','mFlanschH','masse','lStempel','wenden','ko','pko','matD','matL','stD','stL','stationen','zusatz','ausbringung','zeichnung'])f.elements[key]=new El();
 for(const key of ['ok','email','name','firma','tel','nachricht'])a.elements[key]=new El();
 f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund';
 f.reset=()=>{for(const [key,el]of Object.entries(f.elements)){if(key!=='wst')el.value='';el.checked=false;}f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund'};
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
test('all material identities and four examples render machine concepts in all five locales',()=>{
 for(const language of I.supported){
  const p=setup(language);assert.equal(p.f.elements.wst.options.length,E.WERKSTOFFE.length);
  for(const example of p.examples){example.events.click();const cards=p.get('karten').innerHTML;assert(cards.includes(I.t('Stadienkonzept für diese Maschine',language)),language+' '+example.dataset.bsp);assert(!cards.includes('NaN'));}
 }
});
test('missing flow curves remain qualitative, never showing null typical values or 0% force utilization',()=>{
 const p=setup('en');p.examples[0].events.click();
 const missing=E.WERKSTOFFE.findIndex(w=>w.curveStatus==='missing');assert(missing>=0);
 p.f.elements.wst.value=String(missing);p.f.events.change();
 assert(p.get('kenn').innerHTML.includes('Kraft noch offen'));
 assert(p.get('stufen').tBodies[0].innerHTML.includes('Kraft noch offen'));
 assert(!p.get('karten').innerHTML.includes('Auslastung 0 %'));
 assert(!p.f.elements.rm.placeholder.includes('null'));
 assert(!p.get('karten').innerHTML.includes('NaN'));
 p.get('drucken').events.click();assert(!p.get('blatt').innerHTML.includes('null'));assert(!p.get('blatt').innerHTML.includes('Auslastung 0 %'));
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
  assert(summary.includes((7.6).toLocaleString(I.numberLocale(language))+' mm'));
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
