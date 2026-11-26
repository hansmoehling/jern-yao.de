const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const I=require('../i18n.js'),E=require('../engine.js');
const crypto=require('node:crypto').webcrypto;
const source=fs.readFileSync(path.join(__dirname,'..','archiv-ui.js'),'utf8');
const machines=JSON.parse(fs.readFileSync(path.join(__dirname,'..','maschinen.json'),'utf8'));
const praxis=JSON.parse(fs.readFileSync(path.join(__dirname,'..','praxis.json'),'utf8'));
class El{
 constructor(){this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.checked=false;this.style={};this.dataset={};this.options=[];this.files=[];this.events={};this.tBodies=[{innerHTML:'',dataset:{}}];this.selectedOptions=[{textContent:'rund'}];}
 appendChild(e){this.options.push(e)}
 replaceChildren(...elements){this.options=elements;this.value=elements[0]?.value||''}
 addEventListener(k,fn){this.events[k]=fn}
 setAttribute(key,value){(this.attributes||={})[key]=value}
 querySelectorAll(){return []}
 scrollIntoView(options){this.scrollOptions=options}
 focus(options){this.focusOptions=options;this.focused=true}
 click(){this.clicked=true}
}
function setup(language,engine=E,showPrices,apiOptions,staged=false,integrated=false){
 const ids=new Map(),created=[];let ownerDocument;
 class DomEl extends El{
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.name='';this.type='';this.ownerDocument=ownerDocument;created.push(this);}
  get value(){return this._value||''}set value(value){this._value=String(value??'');if(this.tagName==='SELECT'&&!this.options.some(o=>o.value===this._value))this._value='';}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}if(this.tagName==='SELECT')this.options=this.children;}
  appendChild(node){this.append(node);return node;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);if(this.tagName==='SELECT')this.value=this.options[0]?.value||'';}
  closest(selector){if(selector==='label'&&this.tagName==='LABEL'||selector==='[hidden]'&&this.hidden)return this;return this.parent?.closest(selector)||null;}
  addEventListener(key,handler){const prior=this.events[key];this.events[key]=prior?(event)=>{prior(event);return handler(event);}:handler;}
 }
 const make=tag=>integrated?new DomEl(tag):new El();
 const get=id=>{const dynamic=created.find(node=>node.id===id);if(dynamic)return dynamic;if(!ids.has(id))ids.set(id,make());return ids.get(id)};
 const f=get('f'),a=get('a');f.elements={};a.elements={};
 for(const key of ['typ','wst','rm','d0','wirePreparation','rodDiameter','standardKind','standardNorm','nutNorm','threadFamily','kopfForm','kD','kSW','kH','kVol','sD','sL','sArea','tipLength','tipDiameter','tipArea','iTyp','iSize','iSW','iT','iVol','mM','mSW','mH','mLoch','mFlansch','mFlanschH','masse','lStempel','wenden','ko','pko','matD','matL','stD','stL','stationen','zusatz','ausbringung'])f.elements[key]=new El();
 for(const key of ['ok','email','name','firma','tel','nachricht'])a.elements[key]=new El();
 if(integrated){
  const html=fs.readFileSync(path.join(__dirname,'..','archiv-vorlage.html'),'utf8');
  for(const match of html.matchAll(/<(input|select)\b([^>]*\bname="([^"]+)"[^>]*)>/g)){
   const [,tag,attrs,name]=match,tail=tag==='select'?html.slice(match.index+match[0].length).split('</select>')[0]:'';if(['typ','ok','email','name','firma','tel','nachricht'].includes(name))continue;
   const field=make(tag);field.name=name;field.type=attrs.match(/\btype="([^"]+)"/)?.[1]||'';
   if(tag==='select')for(const option of tail.matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([^<]*)/g)){const o=make('option');o.value=option[1];o.textContent=option[2];field.append(o);}
   field.value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||field.options[0]?.value||'';f.elements[name]=field;
   const id=attrs.match(/\bid="([^"]+)"/)?.[1];if(id)ids.set(id,field);
   const label=make('label');label.append(field);
  }
  for(const [name,field]of Object.entries(f.elements))field.name=name;
  Object.defineProperty(f.elements,Symbol.iterator,{value:function*(){yield* Object.values(this);}});
 }
 f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund';f.elements.iTyp.value='none';f.elements.wirePreparation.value='as-supplied';f.elements.standardKind.value='screw';f.elements.threadFamily.value='metric';
 f.reset=()=>{for(const [key,el]of Object.entries(f.elements)){if(key!=='wst')el.value='';el.checked=false;}f.elements.typ.value='bolzen';f.elements.kopfForm.value='rund';f.elements.iTyp.value='none';f.elements.wirePreparation.value='as-supplied'};
 if(integrated){const reset=f.reset;f.reset=()=>{reset();for(const node of created)if(node.tagName==='SELECT')node.value=node.options[0]?.value||'';f.elements.typ.value='bolzen';};}
 f.querySelector=selector=>({set checked(value){if(value)f.elements.typ.value=selector.match(/value=([^\]]+)/)[1]}});
 get('daten').textContent=JSON.stringify(machines);get('praxis').textContent=JSON.stringify(praxis);
 const examples=['m8','m6','mu'].map(name=>{const el=new El();el.dataset.bsp=name;el.disabled=true;return el});
 const disabledDuringInit=[];
 const locale={language,t:s=>I.t(s,locale.language),apply(){disabledDuringInit.push(examples.every(button=>button.disabled));}};
 const events={};const window={JYK:engine,JYI18N:I,JYLocale:locale,matchMedia:()=>({matches:false}),addEventListener:(name,fn)=>events[name]=fn,print(){this.printCount=(this.printCount||0)+1}};
 if(showPrices!==undefined)window.JY_SHOW_PRICES=showPrices;
 if(staged){window.JY_CONFIGURATOR_VERSION='kvp-v1';window.JYWireDefaults=require('../vorbelegung/draht.js');}
 const document={getElementById:get,createElement:tag=>make(tag),querySelectorAll:selector=>selector==='[data-bsp]'?examples:[]};
 if(integrated){ownerDocument=document;document.defaultView=window;document.documentElement={lang:language};window.document=document;for(const node of created)node.ownerDocument=document;}
 const networkRequests=[],answers=[],timers=new Map();let timerId=0;
 window.location={href:'https://jern-yao.de/manual/konfigurator-v1.html'};window.setTimeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId};window.clearTimeout=id=>timers.delete(id);
 if(apiOptions)window.JY_API_BASE=apiOptions.base||'https://api.example.test';
 const context={window,document,clearTimeout,setTimeout,location:{href:''},FormData,URL,URLSearchParams,AbortController,crypto,TypeError,fetch:async(url,options)=>{networkRequests.push({url,options});if(!apiOptions)throw Error('Network forbidden in archive tests');let answer=answers.shift();if(typeof answer==='function')answer=await answer();if(answer instanceof Error)throw answer;if(!answer)throw Error('Unmocked request');return {ok:answer.ok!==false,status:answer.status||200,json:async()=>answer.data}}};
 if(integrated){
  window.fetch=context.fetch;window.AbortController=AbortController;
  window.JYNormLibrary=require('../normen/library.js');window.JYStandards=require('../normen/resolver.js');
  window.JY_NORM_DATA={schemaVersion:1,version:'integration-test',families:['ISO4762','ISO4017','DIN6791','ISO4032'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json'),materials:require('../vorbelegung/werkstoff.json')};
  window.JYKvpContext=require('../kvp-context.js');
  for(const file of ['normen/ui.js','kvp-ui.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 }
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','concept-ui.js'),'utf8'),context);
 window.JYGeometry=require('../geometry-model.js');window.JYStandardFamilies=require('../standard-families.js');
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','geometry-wizard.js'),'utf8'),context);
 let geometryWizard;const createWizard=window.JYGeometryWizard.create;window.JYGeometryWizard.create=options=>(geometryWizard=createWizard(options));
 if(apiOptions)vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','drawing-preview.js'),'utf8'),context);
 if(apiOptions?.ranking){
  get('daten').textContent=JSON.stringify(machines.map(({rp,lo,hi,...machine})=>machine));
  window.JYMachineRanking=require('../machine-ranking.js');
  context.JYMachineRanking=window.JYMachineRanking;
  for(const file of ['ranking-ui.js','ranking-service.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
  window.JYRankingUI=context.JYRankingUI;window.JYRankingService=context.JYRankingService;
 }
 vm.runInNewContext(source,context);
 return {get,f,a,examples,events,context,networkRequests,answers,timers,geometryWizard,disabledDuringInit:[...disabledDuringInit]};
}
async function sendMail(p){if(!p.a.elements.email.value)p.a.elements.email.value='customer@example.invalid';p.a.elements.ok.checked=true;await p.get('senden').events.click();}
test('price-free preset connects its bounded economic shortlist and displays the returned models without prices',async()=>{
 const p=setup('de',E,false,{ranking:true},true,true);p.examples.find(button=>button.dataset.bsp==='m6').events.click();
 const original=p.get('karten').innerHTML.match(/class="modell">([^<]+)/)[1];let expected;
 p.answers.push(()=>{const body=JSON.parse(p.networkRequests.at(-1).options.body);assert.equal(body.candidates.length,12);assert(!JSON.stringify(body).includes('rp'));assert(body.candidates.some(row=>row.model==='JBF-10B2S'));expected=body.candidates.find(row=>row.model!==original).model;return {data:{version:'ranking-v1',basis:'submitted-technical-status',priceRankingComplete:true,models:[{model:expected,comparison:null}]}};});
 const timer=[...p.timers].find(([,item])=>item.ms===450);assert(timer);p.timers.delete(timer[0]);await timer[1].fn();
 assert.equal(new URL(p.networkRequests[0].url).pathname,'/rangfolge');assert.equal(p.get('karten').innerHTML.match(/class="modell">([^<]+)/)[1],expected);assert(p.get('karten').innerHTML.includes('12 von '));assert(!p.get('karten').innerHTML.includes('€'));assert(!p.get('karten').innerHTML.includes('<th>Richtpreis</th>'));
 p.events['jy-languagechange']();assert.equal(p.networkRequests.length,1,'same candidate request is cached across a locale rerender');
});
test('example buttons stay disabled until final UI initialization has completed',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','archiv-vorlage.html'),'utf8');
 const buttons=[...html.matchAll(/<button\b[^>]*\bdata-bsp="[^"]+"[^>]*>/g)];
 assert.equal(buttons.length,5);
 for(const [tag]of buttons)assert.match(tag,/\sdisabled(?:\s|>)/);
 for(const staged of [false,true]){
  const p=setup('de',E,true,{},staged,staged);
  assert.ok(p.disabledDuringInit.length>0);
  assert.ok(p.disabledDuringInit.every(Boolean),'initial rendering and translation must finish before enabling examples');
  for(const button of p.examples){assert.equal(button.disabled,false);assert.equal(typeof button.events.click,'function');}
 }
});
test('the first example click with norm picker, previews and KVP starts from a fresh shared UI',()=>{
 for(const language of I.supported)for(const [example,id,size]of [['m6','ISO4762','M6'],['m8','ISO4017','M8'],['mu','ISO4032','M10']]){
  let input;const p=setup(language,{...E,auslegen(e){input=e;return E.auslegen(e);}},true,{},true,true);
  assert.equal(p.get('norm-id').value,'');
  assert.doesNotThrow(()=>p.examples.find(button=>button.dataset.bsp===example).events.click());
  assert.equal(p.get('norm-id').value,id);assert.equal(p.get('norm-groesse').value,size);
  assert.equal(input.standardDocument.standardReference.id,id);
  assert(Number(p.f.elements[example==='mu'?'mSW':'sD'].value)>0);
  assert(Number(p.f.elements.d0.value)>0);
  assert.equal(p.get('kvp-panel').children.length,1,'the real KVP module is mounted in this integration test');
  if(example==='m6'){assert.equal(p.f.elements.kH.value,'6');assert.equal(p.f.elements.sL.value,'30');assert.equal(p.f.elements.iSize.value,'5');}
  assert.equal(p.networkRequests.length,0,'example selection must not send KVP or analysis requests');
 }
});

test('shortcut length changes propagate through native input/change order into dimensions, shaft geometry and calculation',()=>{
 for(const language of I.supported)for(const [example,id,lengths]of [['m6','ISO4762',[35,40]],['m8','ISO4017',[50,60]]]){
  let input,analysis,pending;
  const p=setup(language,{...E,auslegen(e){input=e;analysis=E.auslegen(e);return analysis;}},true,{},true,true);
  p.context.window.JYStandardPreview=require('../standard-preview.js');
  p.context.setTimeout=fn=>{pending=fn;return 1;};p.context.clearTimeout=()=>{pending=null;};
  p.examples.find(button=>button.dataset.bsp===example).events.click();
  const field=p.get('norm-laenge'),headHeight=p.f.elements.kH.value;
  let volume=analysis.werte.V,preview=p.get('geometry-view').innerHTML;
  for(const length of lengths){
   const toggle=p.get('norm-laenge-toggle');toggle.events.click();assert.equal(field.hidden,false);assert.equal(toggle.attributes['aria-expanded'],'true');
   field.value=String(length);
   p.f.events.input({target:field});field.events.change({target:field});p.f.events.change({target:field});field.events.click();pending?.();
   assert.equal(field.value,String(length));assert.equal(p.f.elements.sL.value,String(length));assert.equal(input.sL,length);
   assert.equal(field.hidden,true);assert.equal(toggle.attributes['aria-expanded'],'false');assert.equal(toggle.focused,true);
   assert.equal(input.standardDocument.standardReference.id,id);assert.equal(input.standardDocument.standardReference.laenge,length);
   assert.equal(p.f.elements.kH.value,headHeight);assert.deepEqual(Object.keys(input.standardDocument.overrides),[]);
   assert.equal(E.boltGeometry(input).shaftLength,length);assert.deepEqual(analysis.fehlt,[]);
   assert(analysis.werte.V>volume);volume=analysis.werte.V;
   assert.notEqual(p.get('geometry-view').innerHTML,preview);preview=p.get('geometry-view').innerHTML;
   const options=field.options.slice();p.f.events.change({target:p.f.elements.rm});
   assert.ok(options.every((option,index)=>field.options[index]===option),'ordinary recalculation must not replace the open length options');
  }
 }
});

test('example reset clears a selected drawing while retaining a usable norm and KVP state',()=>{
 const p=setup('de',E,true,{},true,true);
 p.f.elements.typ.value='formteil';p.f.events.change({target:p.f.elements.typ});
 const file=new Blob(['drawing'],{type:'application/pdf'});Object.defineProperty(file,'name',{value:'customer.pdf'});
 p.get('parts-file').files=[file];p.get('parts-file').events.change();
 p.examples.find(button=>button.dataset.bsp==='m6').events.click();
 assert.equal(p.get('norm-id').value,'ISO4762');assert.equal(p.get('norm-groesse').value,'M6');
 assert.equal(p.get('parts-file-feedback').hidden,true);assert.equal(p.f.elements.typ.value,'bolzen');
 assert.equal(p.networkRequests.length,0);
});
test('norm-to-builder refuses unresolved shaft distribution and preserves the norm and customer edits',()=>{
 const p=setup('de',E,true,{},true,true);p.examples.find(button=>button.dataset.bsp==='m6').events.click();
 p.get('norm-laenge').value='35';p.get('norm-laenge').events.change();
 p.f.elements.sL.value='41';p.f.events.input({target:p.f.elements.sL});
 const before=Object.fromEntries(Object.entries(p.f.elements).map(([key,field])=>[key,{value:field.value,checked:field.checked}]));
 let converted=0;p.context.window.JYNormToChain={fromBolt(){converted++;throw Error('must not convert incomplete contour');}};
 p.get('norm-to-chain').events.click();
 assert.equal(converted,0);assert.equal(p.f.elements.typ.value,'bolzen');assert.equal(p.get('norm-id').value,'ISO4762');assert.equal(p.get('norm-laenge').value,'35');assert.equal(p.f.elements.sL.value,'41');assert.match(p.get('norm-chain-status').textContent,/Rohteilkontur/);assert.match(p.get('norm-chain-status').textContent,/Längenaufteilung des Schafts/);
 assert.deepEqual(Object.fromEntries(Object.entries(p.f.elements).map(([key,field])=>[key,{value:field.value,checked:field.checked}])),before);
 assert.equal(p.networkRequests.length,0);
});
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
  await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(state));
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
  await sendMail(p);const mail=new URL(p.context.location.href).searchParams.get('body');
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
  p.get('drucken').events.click();await sendMail(p);
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

test('expert upload is confined to the drawing tab under formed parts with an explicit initially disabled start',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','archiv-vorlage.html'),'utf8');
 assert(html.includes('<h1>Expertenkonfigurator</h1>'));
 assert.equal((html.match(/<input\b[^>]*type="file"/g)||[]).length,1);assert(html.includes('id="parts-file"'));assert(!html.includes('data-bsp="hu"'));
 assert(!html.includes('standard-drawing-route'));assert(!html.includes('standard-drawing-note'));assert(!source.includes('standard-drawing-note'));
 assert(!html.includes('special-drawing-route'),'drawing analysis is now directly inside expert parts');
 assert(source.includes('getGeometry:geometryInput'));assert(!source.includes("'/preview'"));
 assert(html.indexOf('value="bolzen" form="f"')<html.indexOf('value="formteil" form="f"'));assert(html.indexOf('value="formteil" form="f"')<html.indexOf('value="mutter" form="f"'));
 for(const language of I.supported){const p=setup(language,E,false,{});assert.deepEqual(p.networkRequests,[]);assert(p.get('drucken').disabled);assert(p.get('senden').disabled);for(const type of ['bolzen','mutter','formteil']){p.f.elements.typ.value=type;p.f.events.change();assert.equal(p.get('parts-drawing-panel').hidden,type!=='formteil');assert(p.get('geometry-panel').hidden);assert(p.get('parts-drawing-analyse').disabled);assert.equal(p.get('parts-drawing-analyse').hidden,false);}assert(p.get('material-fields').hidden);p.get('parts-geometry-tab').events.click();assert(!p.get('geometry-panel').hidden);assert(!p.get('material-fields').hidden);assert(p.get('parts-drawing-panel').hidden);}
});

test('empty form-part geometry bypasses the standard engine and clears stale selections and exports',async()=>{
 for(const language of I.supported){
  let calls=0;const engine={...E,auslegen(input){assert.notEqual(input.typ,'formteil','special geometry must never reach envelope-based calculation');calls++;return E.auslegen(input);}};
  const p=setup(language,engine,false,{});p.examples[0].events.click();const previous=quoteModels(p)[0][1];requestModel(p,previous);p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(previous));const printCount=p.context.window.printCount;
  const before=calls;p.f.elements.typ.value='formteil';p.f.events.change();p.get('parts-geometry-tab').events.click();assert.equal(calls,before);
  assert(p.get('standard-part-fields').hidden);assert(p.get('manual-tools').hidden);assert.equal(p.get('geometry-panel').hidden,false);assert(p.get('regelbox').hidden);assert.equal(p.get('anfrage').hidden,false);
  assert(p.get('aus').hidden);assert(p.get('leer').hidden);assert(p.get('selected-machine').hidden);assert(p.get('drucken').disabled);assert(p.get('empty-visual').hidden);
  for(const id of ['kenn','karten','regeln','blatt'])assert.equal(p.get(id).innerHTML,'','stale '+id+' is removed');assert.equal(p.get('stufen').tBodies[0].innerHTML,'');assert.equal(p.get('material-basis').textContent,'');
  p.get('drucken').events.click();assert.equal(p.context.window.printCount,printCount,'old print output cannot be reopened');requestModel(p,previous);assert(p.get('selected-machine').hidden,'stale card actions cannot restore the old model');
  p.a.elements.email.value='customer@example.invalid';p.a.elements.ok.checked=true;p.a.elements.nachricht.value='Nur eine Notiz zum Exzenter';p.a.events.input();assert(p.get('senden').disabled);
  await p.get('senden').events.click();assert.equal(p.networkRequests.length,0);assert.equal(p.context.location.href,'','an empty geometric model cannot be submitted');
  p.events['jy-languagechange']();assert.equal(calls,before);assert(p.get('drucken').disabled);
  p.f.elements.typ.value='bolzen';p.f.events.change();assert.equal(p.get('standard-part-fields').hidden,false);assert.equal(p.get('manual-tools').hidden,false);assert(p.get('geometry-panel').hidden);assert.equal(p.get('aus').hidden,false,'supported standard calculation remains available');assert(p.get('selected-machine').hidden);
 }
});

test('constructed geometry uses its own volume, private KI request, selected model and mail without file upload',async()=>{
 for(const language of I.supported){
  const engine={...E,auslegen(input){assert.notEqual(input.typ,'formteil');return E.auslegen(input);}};
  const p=setup(language,engine,false,{});p.f.elements.typ.value='formteil';p.f.elements.d0.value='8';p.f.events.change();p.get('parts-geometry-tab').events.click();
  const elements=[{id:'E1',shape:'cylinder',operation:'add',side:'die',start:0,length:20,diameter:10,offsetX:0,offsetY:0}];
  p.geometryWizard.setElements(elements);assert.equal(p.get('drucken').disabled,false);assert(!p.get('geometry-analyse').disabled);assert(p.get('geometry-view').innerHTML.includes('mm³'));assert.equal(p.get('karten').innerHTML,'');
  const model=machines.find(machine=>machine.f==='JNP').m;
  p.answers.push({data:{id:'G1',token:'private-token',kind:'preview',status:'ready',answer:'Geometry concept',proposal:{machines:[{model,status:'offen',priceEUR:999}],stages:[]}}});
  await p.get('geometry-analyse').events.click();const preview=p.networkRequests[0],body=JSON.parse(preview.options.body);
  assert.equal(new URL(preview.url).pathname,'/geometry-preview');assert.equal(body.geometrySpec.elements[0].diameter,10);assert.equal(body.d0,8);assert.equal(body.language,language);assert.equal(body.pricePolicy,'technical-only');assert(!('datei' in body));assert(!('email' in body));
  assert.equal(body.inputOrigins,undefined,'legacy geometry requests keep their existing shape');
  const button={dataset:{previewModel:model}};p.get('geometry-result').events.click({target:{closest:()=>button}});assert(!p.get('selected-machine').hidden);assert(p.a.elements.email.focused);
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(model));assert(p.get('blatt').innerHTML.includes('Geometry concept'));assert(!p.get('blatt').innerHTML.includes('€'));
  p.a.elements.email.value='customer@example.invalid';p.a.elements.ok.checked=true;p.a.elements.nachricht.value='Unchanged note';
  p.answers.push({data:{id:'M1',token:'mail-token',kind:'enquiry',status:'received',notificationStatus:'sent'}});await p.get('senden').events.click();
  const mail=p.networkRequests.at(-1);assert.equal(new URL(mail.url).pathname,'/anfrage');assert(mail.options.body.get('betreff').includes(model));assert(mail.options.body.get('notiz').includes('E1'));assert(mail.options.body.get('notiz').includes('Unchanged note'));assert(!mail.options.body.has('datei'));
  p.geometryWizard.setElements([{...elements[0],diameter:11}]);assert(p.get('selected-machine').hidden);assert(p.get('geometry-result').hidden);assert.equal(p.get('geometry-result').innerHTML,'');
 }
});

test('parts drawing selection, explicit KI analysis, progress and explicit mail are independent in five languages',async()=>{
 for(const language of I.supported){
  const p=setup(language,E,false,{});p.f.elements.typ.value='formteil';p.f.events.change();
  const file=new File(['%PDF-1.7\nOriginal drawing'],'part.pdf',{type:'application/pdf'});p.get('parts-file').files=[file];p.get('parts-file').events.change();
  assert.equal(p.networkRequests.length,0);assert(!p.get('parts-file-feedback').hidden);assert(p.get('parts-file-name').textContent.includes('part.pdf'));assert(!p.get('parts-drawing-analyse').disabled);assert(!p.get('empty-visual').hidden);
  p.get('parts-drawing-note').value='Only the explicit drawing note';p.get('parts-drawing-note').events.input();
  p.answers.push({data:{id:'D1',token:'private-drawing-token',kind:'preview',status:'queued',notificationStatus:'not_requested'}});await p.get('parts-drawing-analyse').events.click();
  const analysis=p.networkRequests[0];assert.equal(new URL(analysis.url).pathname,'/preview');assert.equal(analysis.options.body.get('datei').name,'part.pdf');assert.equal(analysis.options.body.get('notiz'),'Only the explicit drawing note');assert.equal(analysis.options.body.get('language'),language);assert.equal(analysis.options.body.get('pricePolicy'),'technical-only');assert(!analysis.options.body.has('email'));assert(!analysis.options.body.has('material'));assert(!analysis.options.body.has('d0'));assert(!p.get('parts-drawing-progress').hidden);assert(p.get('parts-drawing-analyse').disabled);
  const model=machines.find(machine=>machine.f==='JNP').m;p.answers.push({data:{id:'D1',kind:'preview',status:'needs_info',answer:'Drawing concept',questions:['Please specify the material.'],proposal:{machines:[{model,status:'offen',priceEUR:999}]}}});await p.get('parts-drawing-refresh').events.click();
  assert(p.get('parts-drawing-progress').hidden);assert(!p.get('parts-drawing-result').hidden);assert(p.get('parts-drawing-result').innerHTML.includes('Please specify the material.'));assert(p.get('empty-visual').hidden);assert.equal(p.networkRequests.length,2);
  p.get('parts-drawing-result').events.click({target:{closest:()=>({dataset:{previewModel:model}})}});assert(!p.get('selected-machine').hidden);assert.equal(p.networkRequests.length,2);
  p.a.elements.email.value='customer@example.invalid';p.a.elements.nachricht.value='Personal enquiry';p.a.elements.ok.checked=true;
  p.answers.push({data:{id:'MAIL',token:'private-mail-token',kind:'enquiry',status:'received',notificationStatus:'sent',analysisStatus:'not_requested'}});await p.get('senden').events.click();
  const mail=p.networkRequests[2];assert.equal(new URL(mail.url).pathname,'/anfrage');assert.equal(mail.options.body.get('datei').name,'part.pdf');assert.equal(await mail.options.body.get('datei').text(),await file.text());assert(mail.options.body.get('notiz').includes('Personal enquiry'));assert(mail.options.body.get('notiz').includes('Drawing concept'));assert(!mail.options.body.get('notiz').includes('C4C'));assert(!mail.options.body.get('notiz').includes('€'));assert(mail.options.body.get('betreff').includes(model));assert.notEqual(mail.options.body.get('idempotency_key'),analysis.options.body.get('idempotency_key'));assert.equal(p.networkRequests.filter(r=>new URL(r.url).pathname==='/preview').length,1);
  p.get('parts-file-remove').events.click();assert(p.get('parts-drawing-result').hidden);assert(p.get('selected-machine').hidden);assert(p.get('parts-drawing-analyse').disabled);assert(!p.get('parts-drawing-analyse').hidden);assert(!p.get('empty-visual').hidden);assert(p.get('senden').disabled);
 }
});

test('drawing mail works without KI, CAD remains mail-only, and invalid drops cannot be sent',async()=>{
 const p=setup('de',E,false,{});p.f.elements.typ.value='formteil';p.f.events.change();p.a.elements.email.value='customer@example.invalid';p.a.elements.ok.checked=true;
 let prevented=false;const file=new File(['ISO-10303-21;'],'part.step');p.get('parts-drop-zone').events.drop({preventDefault(){prevented=true},dataTransfer:{files:[file]}});assert(prevented);assert(p.get('parts-file-name').textContent.includes('part.step'));assert(p.get('parts-drawing-analyse').disabled);assert.equal(p.networkRequests.length,0);
 p.answers.push({data:{id:'CAD',token:'private',kind:'enquiry',status:'received',notificationStatus:'sent'}});await p.get('senden').events.click();assert.equal(new URL(p.networkRequests[0].url).pathname,'/anfrage');assert.equal(p.networkRequests[0].options.body.get('datei').name,'part.step');assert.equal(p.networkRequests.length,1);
 for(const files of [[new File([],'empty.pdf')],[new File(['bad'],'bad.exe')],[{name:'large.pdf',size:15*1024*1024+1}],[file,file]]){
  p.get('parts-file').value='stale';p.get('parts-drop-zone').events.drop({preventDefault(){},dataTransfer:{files}});assert.equal(p.get('parts-file').value,'');assert.equal(p.get('parts-file-feedback').dataset.state,'error');assert(p.get('senden').disabled);assert(p.get('parts-drawing-analyse').disabled);await p.get('senden').events.click();assert.equal(p.networkRequests.length,1);
 }
});

test('switching to standard parts hides drawing controls and never attaches their retained drawing to a standard quote',async()=>{
 const p=setup('en',E,false,{});p.examples[0].events.click();p.f.elements.typ.value='formteil';p.f.events.change();p.get('parts-file').files=[new File(['%PDF-1.7'],'retained.pdf')];p.get('parts-file').events.change();
 p.f.elements.typ.value='bolzen';p.f.events.change();assert(p.get('parts-drawing-panel').hidden);assert(p.get('parts-tabs').hidden);assert(!p.get('material-fields').hidden);
 p.a.elements.email.value='customer@example.invalid';p.a.elements.ok.checked=true;p.answers.push({data:{id:'STANDARD',token:'private',kind:'enquiry',status:'received',notificationStatus:'sent'}});await p.get('senden').events.click();assert(!p.networkRequests[0].options.body.has('datei'));assert(!p.networkRequests[0].options.body.get('notiz').includes('retained.pdf'));
});

test('standard references set only shape and drive, flange nuts route to the parts builder, and profile fields follow the selected family',()=>{
 let received;const p=setup('de',{...E,auslegen(input){received=input;return E.auslegen(input);}});p.examples[0].events.click();const diameter=p.f.elements.d0.value;
 p.f.elements.standardNorm.value='ISO4762';p.f.elements.standardNorm.events.change();assert.equal(p.f.elements.kopfForm.value,'rund');assert.equal(p.f.elements.iTyp.value,'hex');assert.equal(p.f.elements.d0.value,diameter);assert.equal(received.standardReference,'ISO4762');
 p.f.elements.standardKind.value='headless';p.f.elements.standardKind.events.change();assert.equal(p.f.elements.kH.value,'0');assert.equal(p.f.elements.kD.value,'0');assert(p.get('bolt-head').hidden);
 p.f.elements.threadFamily.value='duo-taptite';p.f.elements.sArea.value='20';p.f.elements.tipLength.value='5';p.f.elements.tipArea.value='15';p.f.elements.tipDiameter.value='999';p.f.events.change();assert.equal(received.sArea,20);assert.equal(received.tipLength,5);assert.equal(received.tipArea,15);assert.equal(received.tipDiameter,undefined);
 p.f.elements.threadFamily.value='metric';p.f.events.change();assert.equal(received.sArea,undefined);assert.equal(received.tipArea,undefined);assert.equal(received.tipLength,undefined);
 p.f.elements.typ.value='mutter';p.f.events.change();p.f.elements.nutNorm.value='ISO4161';p.f.elements.nutNorm.events.change();assert.equal(p.f.elements.typ.value,'formteil');assert(!p.get('geometry-panel').hidden);assert(p.get('standard-part-fields').hidden);
});

test('cylinder-head norms override a stale hexagon even when input calculation precedes change',async()=>{
 let received;const p=setup('de',{...E,auslegen(input){received=input;return E.auslegen(input);}});p.examples[0].events.click();
 p.f.elements.standardNorm.value='ISO4017';p.f.elements.standardNorm.events.change();assert.equal(p.f.elements.kopfForm.value,'sechskant');
 p.f.elements.standardNorm.value='ISO4762';p.f.events.input();await new Promise(resolve=>setTimeout(resolve,150));
 assert.equal(p.f.elements.standardNorm.value,'ISO4762');assert.equal(p.f.elements.kopfForm.value,'rund');assert.equal(p.f.elements.iTyp.value,'hex');
 p.f.elements.standardNorm.events.change();p.f.events.change();assert.equal(received.standardReference,'ISO4762');assert.equal(received.kopfForm,'rund');assert.equal(received.iTyp,'hex');
});

test('norm-controlled heads and drives remain consistent in five languages and unlock for custom parts',()=>{
 for(const language of I.supported){
  const p=setup(language);p.examples[1].events.click();
  const head=p.f.elements.kopfForm,drive=p.f.elements.iTyp,norm=p.f.elements.standardNorm;
  head.options=['rund','sechskant','abgratet','none','krallen'].map(value=>Object.assign(new El(),{value}));
  for(const [reference,driveValue]of [['ISO4762','hex'],['ISO14579','torx']]){
   head.value='sechskant';drive.value='none';norm.value=reference;norm.events.change();p.f.elements.iSize.value=driveValue==='hex'?'5':'T20';p.f.events.change();if(driveValue==='torx'){p.f.elements.iVol.value='20';p.f.events.change();}
   assert.equal(head.value,'rund');assert.equal(drive.value,driveValue);assert(head.disabled);assert(drive.disabled);assert(!p.get('standard-norm-note').hidden);
   assert.equal(head.options[0].textContent,I.t('Zylinderkopf',language));assert(head.options.filter(o=>o.value!=='rund').every(o=>o.disabled));
   p.f.elements.sL.value='31';p.f.events.change();p.events['jy-languagechange']();assert.equal(norm.value,reference);assert.equal(head.value,'rund');
   p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(reference));assert(p.get('blatt').innerHTML.includes(I.t('Zylinderkopf',language)));
  }
  norm.value='';norm.events.change();assert(!head.disabled);assert(!drive.disabled);assert(head.options.every(o=>!o.disabled));assert(p.get('standard-norm-note').hidden);
  assert.equal(head.options[0].textContent,I.t('rund, Zylinder- oder Flanschkopf',language));head.value='krallen';drive.value='ph';p.f.events.change();assert.equal(head.value,'krallen');assert.equal(drive.value,'ph');
  norm.value='ISO4014';norm.events.change();assert.equal(head.value,'sechskant');assert(!head.disabled);assert.equal(drive.value,'none');
  head.value='abgratet';p.f.events.change();assert.equal(norm.value,'ISO4014');assert.equal(head.value,'abgratet');assert(!head.options.find(o=>o.value==='abgratet').disabled);assert(head.options.find(o=>o.value==='rund').disabled);
  p.f.elements.standardKind.value='rivet';p.f.elements.standardKind.events.change();assert.equal(norm.value,'');assert(!head.disabled);assert(drive.disabled);assert(head.options.every(o=>!o.disabled));
 }
});

test('profile and claw-head results remain qualitative without null station counts or invented reserve in exports',async()=>{
 for(const language of I.supported){
  const p=setup(language);p.examples[0].events.click();p.f.elements.threadFamily.value='trilobular';p.f.elements.sArea.value='35';p.f.events.change();
  assert.equal(p.get('stages-heading').textContent,I.t('Qualitative Operationsfolge',language));assert.equal(p.get('stage-column-heading').textContent,I.t('Arbeitsschritt',language));
  assert(p.get('karten').innerHTML.includes(I.t('Arbeitsschritt',language)+' 1:'));assert(!p.get('karten').innerHTML.includes(I.t('Stadium',language)+' 1:'));
  assert.equal(p.get('aus').hidden,false);assert(p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)));assert(!p.get('kenn').innerHTML.includes('null'));assert(!p.get('kenn').innerHTML.includes(I.t('+1 Reserve',language)));
  p.get('drucken').events.click();await sendMail(p);for(const text of [p.get('blatt').innerHTML,new URL(p.context.location.href).searchParams.get('body')]){assert(!text.includes('null'));assert(!text.includes('(+1 '+I.t('Reserve',language)+')'));assert(text.includes('35 mm²'));assert(text.includes(I.t('Qualitative Operationsfolge',language)));assert(text.includes(I.t('Arbeitsschritt',language)+' 1.'));}
  p.f.elements.threadFamily.value='metric';p.f.elements.kopfForm.value='krallen';p.f.elements.kVol.value='900';p.f.events.change();assert.equal(p.get('aus').hidden,false);assert(p.get('kenn').innerHTML.includes(I.t('Kraft noch offen',language)));assert(!p.get('kenn').innerHTML.includes('null'));p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes('900 mm³'));
  p.examples[0].events.click();assert.equal(p.get('stages-heading').textContent,I.t('Stadienfolge',language));assert.equal(p.get('stage-column-heading').textContent,I.t('Station',language));assert(p.get('karten').innerHTML.includes(I.t('Stadium',language)+' 1:'));
 }
});

test('inactive dimensions are preserved in their fields but excluded from validation and calculation',()=>{
 let received;const p=setup('de',{...E,auslegen(input){received=input;return E.auslegen(input);}});p.examples[0].events.click();
 for(const key of ['kSW','mSW','rodDiameter','iT','sArea']){p.f.elements[key].name=key;p.f.elements[key].value='-1';}
 const numeric=['kD','kSW','mSW','rodDiameter','iT','sArea'].map(key=>Object.assign(p.f.elements[key],{name:key}));
 p.f.querySelectorAll=selector=>selector==='input[inputmode]'?numeric:[];
 p.f.events.change();assert.equal(p.get('aus').hidden,false);
 for(const key of ['kSW','mSW','rodDiameter','iT','sArea']){assert.equal(received[key],undefined);assert.equal(p.f.elements[key].value,'-1');assert.equal(p.f.elements[key].style.borderColor,'');}
 p.f.elements.kD.value='-1';p.f.events.change();assert.equal(p.get('aus').hidden,true,'active invalid head is rejected');
 p.f.elements.typ.value='mutter';p.f.elements.mM.value='10';p.f.elements.mSW.value='16';p.f.elements.mH.value='8';p.f.events.change();
 assert.equal(p.get('aus').hidden,false,'hidden invalid bolt dimensions do not block a nut');assert.equal(received.kD,undefined);assert.equal(received.sL,undefined);assert.equal(p.f.elements.kD.value,'-1');assert.equal(p.f.elements.kD.style.borderColor,'');
 p.f.elements.typ.value='bolzen';p.f.events.change();assert.equal(p.get('aus').hidden,true,'the stored invalid dimension is checked on returning');
});

test('reference steel density is identified in weight figures and exports but absent for separately sourced densities',async()=>{
 const density='Gewicht mit Stahl-Bezugsdichte 7,85 g/cm³; Näherungswert';
 const materials=E.WERKSTOFFE.map(material=>({...material,densityStatus:'reference-steel-density',rho:7.85}));
 const p=setup('de',{...E,WERKSTOFFE:materials});p.examples[0].events.click();assert.equal(p.get('mass-basis').textContent,density);assert.equal(p.get('mass-basis').hidden,false);
 p.get('drucken').events.click();await sendMail(p);assert(p.get('blatt').innerHTML.includes(density));assert(new URL(p.context.location.href).searchParams.get('body').includes(density));
 materials.forEach(material=>material.densityStatus='verified');p.f.events.change();assert(p.get('mass-basis').hidden);assert.equal(p.get('mass-basis').textContent,'');
});

test('standard enquiry sends the chosen machine and calculation without a drawing or AI request, in both price modes and five languages',async()=>{
 for(const language of I.supported)for(const prices of [true,false]){
  const p=setup(language,E,prices,{});p.examples[0].events.click();p.a.elements.email.value='customer@example.invalid';p.a.elements.nachricht.value='Originalnotiz  unverändert';const model=quoteModels(p)[1][1];requestModel(p,model);assert.equal(p.networkRequests.length,0);
  await p.get('senden').events.click();assert.equal(p.networkRequests.length,0,'consent remains required');p.a.elements.ok.checked=true;p.a.elements.email.value='invalid';await p.get('senden').events.click();assert.equal(p.networkRequests.length,0,'valid contact remains required');p.a.elements.email.value='customer@example.invalid';
  p.answers.push({data:{id:'STANDARD',token:'private-mail-token',kind:'enquiry',status:'received',analysisStatus:'not_requested',notificationStatus:'pending'}});await p.get('senden').events.click();
  const request=p.networkRequests[0],body=request.options.body;assert.equal(new URL(request.url).pathname,'/anfrage');assert.equal(body.get('consent'),'true');assert.equal(body.get('language'),language);assert.equal(body.get('pricePolicy'),prices?null:'technical-only');assert(!body.has('datei'));assert(!body.has('zeichnung'));
  assert(body.get('notiz').includes(model));assert(body.get('notiz').includes('Originalnotiz  unverändert'));assert(body.get('notiz').includes(I.t('Höchste Stationskraft',language)));assert.equal(body.get('notiz').includes('€'),prices);assert.equal(body.get('betreff'),I.t(prices?'Richtpreisanfrage':'Maschinenanfrage',language)+' '+model);
  p.answers.push({data:{kind:'enquiry',status:'received',analysisStatus:'not_requested',notificationStatus:'sent'}});await p.get('archive-mail-refresh').events.click();assert.equal(p.get('sendehinweis').textContent,I.t('Hans Möhling wurde per E-Mail über Ihre Anfrage informiert.',language));assert(p.networkRequests.every(request=>!request.url.includes('/preview')));assert.equal(p.context.location.href,'');
 }
});

test('manual server mail retry preserves identity and incomplete receipts never claim acceptance',async()=>{
 const p=setup('de',E,false,{});p.examples[0].events.click();p.a.elements.email.value='customer@example.invalid';p.a.elements.ok.checked=true;
 p.answers.push(new TypeError('Offline'));await p.get('senden').events.click();const key=p.networkRequests[0].options.body.get('idempotency_key');assert(!p.get('sendehinweis').textContent.includes('angekommen'));assert.equal(p.get('senden').disabled,false);
 p.answers.push({data:{kind:'enquiry',status:'received'}});await p.get('senden').events.click();assert.equal(p.networkRequests[1].options.body.get('idempotency_key'),key);assert(p.get('sendehinweis').textContent.includes('nicht eindeutig bestätigt'));
 p.answers.push({data:{id:'E1',token:'secret',kind:'enquiry',status:'received',notificationStatus:'failed'}});await p.get('senden').events.click();assert.equal(p.networkRequests[2].options.body.get('idempotency_key'),key);assert(p.get('sendehinweis').textContent.includes('nicht zugestellt'));assert(!p.get('sendehinweis').textContent.includes('secret'));
});

test('print and mail are fully localized before DOM translation, with identical summary numbers and unchanged customer text',async()=>{
 for(const language of I.supported){
  const p=setup(language);p.examples[0].events.click();
  p.a.elements.name.value='Original Name';p.a.elements.firma.value='Original Firma';p.a.elements.email.value='customer@example.invalid';
  const original='Kopfdurchmesser  13 mm\nOriginalnotiz bleibt unverändert';p.a.elements.nachricht.value=original;
  p.get('drucken').events.click();
  const html=p.get('blatt').innerHTML;
  assert(html.includes('<h1>'+I.t('Anforderungsblatt Mehrstufenpresse',language)+'</h1>'));
  assert(html.includes(I.t('Grobauslegung, unverbindlich',language)));
  assert.equal(p.get('blatt').dataset.originalText,'');
  const summary=html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
  assert(summary.includes((8).toLocaleString(I.numberLocale(language))+' mm'));
  assert(summary.includes('C4C'));assert(summary.includes(I.t('weichgeglüht',language)));assert(summary.includes(I.t('Literaturansatz',language)));
  if(language!=='de')assert(!/Teileart|Drahtzugfestigkeit|Werkstoffmodell|Kopfdurchmesser|Körperlänge|Höchste Stationskraft|Nennkraft nötig|Kopf fertigstauchen|Vorauswahl|Richtpreis|Auslastung/.test(summary),language+' untranslated summary');
  await sendMail(p);
  const uri=new URL(p.context.location.href),body=uri.searchParams.get('body');
  assert(uri.searchParams.get('subject').startsWith(I.t('Richtpreisanfrage',language)));
  assert(body.includes(original.replace(/\n/g,'\r\n')),'customer note is preserved');
  assert(body.includes(summary.replace(/\n/g,'\r\n')),'mail and print summaries are identical');
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
   await sendMail(p);const mail=new URL(p.context.location.href),body=mail.searchParams.get('body'),subject=mail.searchParams.get('subject');
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
  await sendMail(p);const mail=new URL(p.context.location.href),body=mail.searchParams.get('body');
  assert.equal(mail.searchParams.get('subject'),I.t(prices?'Richtpreisanfrage':'Maschinenanfrage',language)+' '+selected);
  assert(body.includes(label));assert(body.includes('\r\n  '+selected+' ('));assert(!body.includes('\r\n  '+first+' ('));assert(body.includes(note.replace(/\n/g,'\r\n')));
  assert.equal(p.a.elements.nachricht.value,note);if(!prices)assert(!/€/.test(print+body));
 }
});

test('quote selections are cleared when calculation inputs or available models change, including pending input',async()=>{
 const p=setup('de');p.examples[0].events.click();const chosen=quoteModels(p)[1][1];requestModel(p,chosen);
 p.f.elements.sL.value='41';p.f.events.input();assert(p.get('selected-machine').hidden,'pending input immediately clears the old choice');
 await sendMail(p);assert(!new URL(p.context.location.href).searchParams.get('body').includes('Anfrage für '+chosen),'send recalculates pending geometry without the stale selection');
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
   await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(size));
   p.events['jy-languagechange']();assert.equal(p.f.elements.iSize.value,size,'locale update preserves drive selection');
  }
 }
});

test('small Torx sizes T1 to T4 can be selected without invented recess dimensions',()=>{
 for(const showPrices of [true,false]){
  const p=setup('de',E,showPrices);p.examples[0].events.click();p.f.elements.iTyp.value='torx';p.f.events.change();
  assert.deepEqual(Array.from(p.f.elements.iSize.options.slice(1,6),o=>o.value),['T1','T2','T3','T4','T5']);
  for(const size of ['T1','T2','T3','T4']){
   p.f.elements.iSize.value=size;p.f.elements.iT.value='1';p.f.events.change();
   assert.equal(p.get('aus').hidden,false);assert(p.get('kenn').innerHTML.includes('Torx '+size));
   assert(p.get('kenn').innerHTML.includes(I.t('nicht belegt','de')));
   p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(size));
  }
 }
});

test('rivets and pins ignore inherited screw profiles and drives in both sites and all languages',()=>{
 for(const language of I.supported)for(const showPrices of [true,false])for(const kind of ['rivet','pin']){
  let received;const p=setup(language,{...E,auslegen(e){received=e;return E.auslegen(e);}},showPrices);
  p.examples[1].events.click();p.f.elements.standardNorm.value='ISO4762';p.f.elements.standardNorm.events.change();
  p.f.elements.threadFamily.value='duo-taptite';p.f.elements.sArea.value='20';p.f.elements.tipArea.value='15';p.f.elements.tipLength.value='5';p.f.events.change();
  p.f.elements.standardKind.value=kind;p.f.elements.standardKind.events.change();
  assert.equal(received.threadFamily,'none');assert.equal(received.iTyp,'none');
  for(const field of ['sArea','tipArea','tipLength','tipDiameter','iSize','iSW','iT','iVol'])assert.equal(received[field],undefined,field);
  assert(p.get('thread-family-field').hidden);assert(p.f.elements.threadFamily.disabled);assert(p.get('bolt-drive-fields').hidden);assert(p.f.elements.iTyp.disabled);
  assert.equal(p.get('aus').hidden,false);assert(!/JNFP|JNF-|JNFR/.test(p.get('karten').innerHTML));
  p.get('drucken').events.click();const sheet=p.get('blatt').innerHTML;
  assert(sheet.includes(I.t(kind==='rivet'?'Niet':'Bolzen',language)));
  assert(!sheet.includes(I.t('Gewindefamilie',language)));assert(!sheet.includes('Duo-Taptite'));assert(!sheet.includes(I.t('Innenantrieb',language)));
  p.events['jy-languagechange']();assert.equal(received.threadFamily,'none');
  p.f.elements.standardKind.value='screw';p.f.elements.standardKind.events.change();
  assert(!p.get('thread-family-field').hidden);assert(!p.get('bolt-drive-fields').hidden);
  assert.equal(received.threadFamily,'duo-taptite','returning to screw preserves its profile input');
 }
});

test('missing or cleared shaft dimensions block cards, print and requests for rivets',()=>{
 for(const language of I.supported)for(const showPrices of [true,false]){
  const p=setup(language,E,showPrices);p.examples[0].events.click();p.f.elements.standardKind.value='rivet';p.f.elements.standardKind.events.change();
  for(const key of ['sD','sL']){
   const previous=p.f.elements[key].value;p.f.elements[key].value='';p.f.events.change();
   assert(p.get('aus').hidden);assert(!p.get('leer').hidden);assert(p.get('leer').textContent.includes(I.t('Schaftdurchmesser und Schaftlänge vollständig angeben',language)));
   assert(p.get('drucken').disabled);assert(p.get('senden').disabled);
   p.f.elements[key].value=previous;p.f.events.change();assert.equal(p.get('aus').hidden,false);assert.equal(p.get('drucken').disabled,false);
  }
  p.examples[2].events.click();p.f.elements.standardKind.value='rivet';p.f.events.change();
  assert.equal(p.get('aus').hidden,false,'hidden rivet selection cannot block a nut calculation');
  assert(/JNF|JPF/.test(p.get('karten').innerHTML));
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

test('staged defaults preserve customer wire values and expose the thinner annealed-wire route in every language',()=>{
 for(const language of I.supported){
  let received;const p=setup(language,{...E,auslegen(e){received=e;return E.auslegen(e);}},true,undefined,true);
  for(const [key,value]of Object.entries({sD:'5.27',sL:'30',kD:'10',kH:'6'}))p.f.elements[key].value=value;
  p.f.events.change();assert.equal(received.d0,5.6);assert.equal(received.rmPolicy,E.RM_POLICY_VERSION);assert.equal(received.rm,undefined);
  assert.equal(received.inputOrigins.d0.origin,'assumption');assert(!p.get('wire-candidates-field').hidden);assert(p.get('wire-custom-field').hidden);
  assert(p.get('wire-process-note').textContent.includes(I.t('Stauchdraht will geglüht sein, Reduzierdraht braucht das weniger',language)));
  const thinner=p.get('wire-candidates').options.find(o=>Number(o.value)>0&&Number(o.value)<5.6);assert(thinner);
  p.get('wire-candidates').value=thinner.value;p.get('wire-candidates').events.change();assert.equal(received.d0,Number(thinner.value));
  assert(p.get('wire-origin').textContent.includes(I.t('Mehr Aufstauchen: geglühten Draht vorsehen.',language)));
  p.get('wire-candidates').value='custom';p.get('wire-candidates').events.change();assert(!p.get('wire-custom-field').hidden);
  p.f.elements.d0.value='6.4';p.f.elements.d0.events.input();p.f.events.change();p.f.elements.sD.value='5.4';p.f.events.change();
  assert.equal(received.d0,6.4);assert.equal(received.inputOrigins.d0.origin,'customer');
  p.events['jy-languagechange']();assert.equal(received.d0,6.4);
 }
});

test('staged geometry preserves wire provenance in requests, print and enquiry in five languages',async()=>{
 for(const language of I.supported){
  const p=setup(language,E,false,{},true);p.f.elements.typ.value='formteil';p.f.events.change();p.get('parts-geometry-tab').events.click();
  const element={id:'E1',shape:'cylinder',operation:'add',side:'die',start:0,length:20,diameter:10,offsetX:0,offsetY:0};
  p.geometryWizard.setElements([element]);assert.equal(p.f.elements.d0.value,'10');
  p.answers.push({data:{id:'AUTO',token:'auto-token',kind:'preview',status:'ready',answer:'Concept'}});await p.get('geometry-analyse').events.click();
  const automatic=JSON.parse(p.networkRequests[0].options.body);
  assert.deepEqual(automatic.inputOrigins,{d0:{origin:'assumption',provisional:true}});assert.equal(automatic.inputOrigins.d0.reason,undefined);
  p.get('drucken').events.click();
  const originLabel=I.t('Herkunft Drahtdurchmesser',language),suggestionLabel=I.t('Drahtvorschlag · vorläufig',language);
  assert(p.get('blatt').innerHTML.includes(originLabel));assert(p.get('blatt').innerHTML.includes(suggestionLabel));
  p.answers.push({data:{id:'MAIL',token:'mail-token',kind:'enquiry',status:'received',notificationStatus:'sent'}});await sendMail(p);
  const note=p.networkRequests.at(-1).options.body.get('notiz');assert(note.includes(originLabel));assert(note.includes(suggestionLabel));
  p.get('wire-candidates').value='custom';p.get('wire-candidates').events.change();
  assert.equal(p.f.elements.d0.value,'10');assert(p.get('geometry-result').hidden,'same diameter with changed provenance invalidates the previous analysis');
  p.answers.push({data:{id:'CUSTOM',token:'custom-token',kind:'preview',status:'ready',answer:'Concept'}});await p.get('geometry-analyse').events.click();
  const custom=JSON.parse(p.networkRequests.at(-1).options.body);assert.deepEqual(custom.inputOrigins,{d0:{origin:'customer'}});
  assert.notEqual(custom.idempotency_key,automatic.idempotency_key);
  p.geometryWizard.setElements([{...element,length:23}]);assert.equal(p.f.elements.d0.value,'10');
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(I.t('Drahtdurchmesser aus Ihrer Eingabe',language)));assert(!p.get('blatt').innerHTML.includes(suggestionLabel));
 }
});

test('staged Rm defaults stay identifiable in display and exports and never become invented certificate inputs',()=>{
 for(const language of I.supported){
  let received;const p=setup(language,{...E,auslegen(e){received=e;return E.auslegen(e);}},true,undefined,true);
  p.examples[1].events.click();assert.equal(received.rm,undefined);assert(p.get('rm-origin').textContent.includes('400'));
  const a=E.auslegen(received),chosen=E.waehle(machines,a,received,praxis);assert(chosen.passend.length>0);
  assert(!chosen.passend[0].openPoints.some(x=>x.id==='wire-tensile-strength'));
  const variant=p.f.elements.wst.options.find(o=>o.textContent.startsWith('C10C'));p.f.elements.wst.value=variant.value;p.f.events.change();
  assert.equal(received.rm,undefined);assert(p.f.elements.rm.placeholder.includes('350'));assert(p.get('rm-origin').textContent.includes(I.t('Richtwert · vorläufig',language)));
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(I.t('Herkunft Rm',language)));assert(p.get('blatt').innerHTML.includes(I.t('Richtwert · vorläufig',language)));
  p.f.elements.rm.value='450';p.f.events.change();assert.equal(received.rm,450);assert(p.get('rm-origin').textContent.includes(I.t('Kundenangabe',language)));
  p.f.elements.rm.value='';p.f.elements.wirePreparation.value='inline-drawing';p.f.elements.rodDiameter.value='6';p.f.events.change();
  assert.equal(E.rmVorbelegung(received).value,null);assert(p.get('rm-origin').hidden,'pre-drawing reference must not be reused after inline drawing');
  p.get('drucken').events.click();assert(!p.get('blatt').innerHTML.includes(I.t('Vorläufiges Praxisband',language)),'an unknown Rm must not be described as a known band');
 }
});

test('staged ISO4014 input uses its plain shaft as the wire baseline and preserves an edited wire',()=>{
 let received;const p=setup('de',{...E,auslegen(e){received=e;return E.auslegen(e);}},true,undefined,true);
 for(const [key,value]of Object.entries({standardNorm:'ISO4014',sD:'6',sL:'50',kSW:'10',kH:'4'}))p.f.elements[key].value=value;
 p.f.events.change();assert.equal(received.standardReference,'ISO4014');assert.equal(received.d0,6);
 assert(p.get('wire-origin').textContent.includes('Teilgewinde'));assert(!p.get('wire-origin').textContent.includes('Vollgewinde'));
 p.get('wire-candidates').value='custom';p.get('wire-candidates').events.change();p.f.elements.d0.value='6.2';p.f.elements.d0.events.input();p.f.events.change();
 assert.equal(received.d0,6.2);assert.equal(received.inputOrigins.d0.origin,'customer');
});

test('drawing material selection is explicit, leaves the original note intact and invalidates a previous analysis',async()=>{
 for(const language of I.supported){
  const p=setup(language,E,true,{},true);p.f.elements.typ.value='formteil';p.f.events.change();
  assert(!p.get('drawing-material-field').hidden);assert.equal(p.get('drawing-material').value,'');assert(p.get('drawing-material-origin').textContent.includes('C4C'));
  const file=new Blob(['%PDF-1.4 test drawing'],{type:'application/pdf'});Object.defineProperty(file,'name',{value:'neutral.pdf'});p.get('parts-file').files=[file];p.get('parts-file').events.change();
  p.get('parts-drawing-note').value='Original drawing note';p.get('parts-drawing-note').events.input();
  const option=p.get('drawing-material').options.find(o=>o.textContent.startsWith('C10C'));p.get('drawing-material').value=option.value;p.get('drawing-material').events.change();
  p.answers.push({data:{id:'job-1',token:'token-1',kind:'preview',status:'queued'}});await p.get('parts-drawing-analyse').events.click();
  assert.equal(p.networkRequests.length,1);const first=p.networkRequests[0].options.body,choice=JSON.parse(first.get('materialChoice'));
  assert.equal(choice.materialId,'C10C');assert.equal(choice.origin,'user_selection');assert.equal(first.get('notiz'),'Original drawing note');
  p.get('drawing-material').value='';p.get('drawing-material').events.change();assert(p.get('parts-drawing-result').hidden);
  p.answers.push({data:{id:'job-2',token:'token-2',kind:'preview',status:'queued'}});await p.get('parts-drawing-analyse').events.click();
  const second=p.networkRequests[1].options.body;assert.equal(second.get('materialChoice'),null);assert.notEqual(second.get('idempotency_key'),first.get('idempotency_key'));
  assert(p.networkRequests.every(r=>r.url.includes('/preview')),'material selection and analysis never send mail');
 }
});

test('returning from the flange-nut builder never labels a standard nut calculation as ISO4161',()=>{
 for(const language of I.supported){
  let received;const p=setup(language,{...E,auslegen(input){received=input;return E.auslegen(input);}});p.examples[2].events.click();
  const dimensions=['mM','mSW','mH'].map(key=>p.f.elements[key].value);
  p.f.elements.nutNorm.value='ISO4161';p.f.elements.nutNorm.events.change();p.f.events.change();
  assert.equal(p.f.elements.typ.value,'formteil');assert.equal(p.get('geometry-panel').hidden,false);
  p.f.elements.typ.value='mutter';p.f.events.change();
  assert.equal(p.f.elements.nutNorm.value,'');assert.equal(received.standardReference,'');
  assert.equal(p.get('geometry-panel').hidden,true);assert.equal(p.get('aus').hidden,false);
  assert.deepEqual(['mM','mSW','mH'].map(key=>p.f.elements[key].value),dimensions,'returning keeps the entered nut dimensions');
  p.get('drucken').events.click();assert(!p.get('blatt').innerHTML.includes('ISO4161'));
  p.f.elements.nutNorm.value='ISO4032';p.f.elements.nutNorm.events.change();p.f.events.change();p.events['jy-languagechange']();
  assert.equal(p.f.elements.typ.value,'mutter');assert.equal(received.standardReference,'ISO4032');
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes('ISO4032'));
 }
});
