const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../engine.js');
// Read source catalogs in memory so UI checks do not require writing build artifacts.
const i18nModule={exports:{}},catalog=Object.assign({},...fs.readdirSync(path.join(__dirname,'..')).filter(file=>/^i18n-.*\.json$/.test(file)).sort().map(file=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'))));
new Function('module',fs.readFileSync(path.join(__dirname,'../i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalog)))(i18nModule);
const I=i18nModule.exports;
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
 querySelector(){return null}
 scrollIntoView(options){this.scrollOptions=options}
 focus(options){this.focusOptions=options;this.focused=true}
 click(){this.clicked=true}
}
function setup(language,engine=E,showPrices,apiOptions,staged=false,integrated=false,chainMode=false){
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
 const get=id=>{assert(!['parts-drawing-refresh','geometry-refresh','archive-mail-refresh'].includes(id),'removed refresh control must not be requested');const dynamic=created.find(node=>node.id===id);if(dynamic)return dynamic;if(!ids.has(id))ids.set(id,make());return ids.get(id)};
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
  window.JYNormLibrary=require('../normen/library.js');window.JYStandards=require('../normen/resolver.js');window.JYNormAvailability=require('../normen/availability.js');
  window.JY_NORM_DATA={schemaVersion:1,version:'integration-test',families:['ISO4762','ISO4014','ISO4017','ISO4162','ISO4026','ISO14579','ISO14580','ISO14583','ISO14584','ISO8676','DIN7500','DIN835','ISO2338','ISO13918','DIN124','DIN302','DIN660','DIN661','DIN662','DIN674','DIN6791','DIN6792','DIN7338','ISO4032','ISO4161','DIN985'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json'),materials:require('../vorbelegung/werkstoff.json')};
  window.JYKvpContext=require('../kvp-context.js');
  for(const file of ['normen/ui.js','kvp-ui.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
 }
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','concept-ui.js'),'utf8'),context);
 window.JYGeometry=require('../geometry-model.js');window.JYStandardFamilies=require('../standard-families.js');
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','geometry-wizard.js'),'utf8'),context);
 let geometryWizard;const createWizard=window.JYGeometryWizard.create;window.JYGeometryWizard.create=options=>(geometryWizard=createWizard(options));
 if(chainMode){
  window.JYAxialChain=require('../axial-chain.js');window.JYNormToChain=require('../normen/to-chain.js');
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','axial-chain-ui.js'),'utf8'),context);
  const createChain=window.JYAxialChainUI.create;window.JYAxialChainUI.create=options=>(geometryWizard=createChain(options));
 }
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
async function pollStatus(p){const timer=[...p.timers].find(([,item])=>item.ms===4000);assert(timer,'expected automatic status poll');p.timers.delete(timer[0]);await timer[1].fn();}
test('P7 Duo variants retain distinct heads and translated labels without a stale Torx depth in both price modes',()=>{
 for(const language of I.supported)for(const showPrices of [true,false]){
  let input;const p=setup(language,{...E,auslegen(e){input=e;return E.auslegen(e);}},showPrices,undefined,true,true,true);
  const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  choose('kind','screw');choose('id','ISO14584');choose('groesse','M6');choose('laenge','20');assert.ok(input.iT>0);
  choose('id','DIN7500');choose('form','C-DUO-TX');choose('groesse','M3');choose('laenge','10');
  assert.equal(input.kD,6);assert.equal(input.kH,2.52);assert.equal(input.kopfForm,'linse');assert.equal(input.iTyp,'torx');assert.equal(input.iSize,'T10');
  assert.equal(p.f.elements.iT.value,'');assert.equal(p.f.elements.sD.value,'');assert.equal(p.f.elements.capHeight.value,'');assert.equal(input.normRequiresGeometryReview,true);
  const labels=p.get('norm-form').options.filter(o=>/DUO/.test(o.value)).map(o=>o.textContent);assert.equal(labels.length,2);if(language!=='de')assert.ok(labels.every(label=>!/Linsenkopf|Senkkopf|Innensechsrund/.test(label)));
  choose('form','M-DUO-TX');choose('groesse','M3');choose('laenge','10');assert.equal(input.kD,5.6);assert.equal(input.kH,1.65);assert.equal(input.kopfForm,'kegelstumpf');assert.equal(p.f.elements.sL.value,'');
  const before=p.f.elements.typ.value;p.get('norm-to-chain').events.click();assert.equal(p.f.elements.typ.value,before);assert.ok(p.get('norm-chain-status').textContent);
 }
});

test('P7 real Torx paths retain head-model provenance and nominal length in every language and price mode',()=>{
 for(const language of I.supported)for(const showPrices of [true,false])for(const spec of [
  {id:'ISO14583',shaft:20,head:4.6,crown:2,total:24.6},
  {id:'ISO14584',shaft:16.7,head:3.3,crown:1.4,total:21.4}
 ]){
  let input;const p=setup(language,{...E,auslegen(e){input=e;return E.auslegen(e);}},showPrices,undefined,true,true,true);
  const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  choose('kind','screw');choose('id',spec.id);choose('groesse','M6');choose('laenge','20');
  assert.equal(input.sL,spec.shaft);assert.equal(input.kH,spec.head);assert.equal(input.capHeight,spec.crown);assert.equal(input.iTyp,'torx');assert.equal(input.iSize,'T30');assert.equal(input.headModelAssumption.origin,'assumption');
  const g=E.boltGeometry(input);assert.ok(!g.error,g.error);assert.ok(Math.abs(g.totalLength-spec.total)<1e-9);
  const before=p.f.elements.typ.value;p.get('norm-to-chain').events.click();assert.equal(p.f.elements.typ.value,before);assert.ok(p.get('norm-chain-status').textContent,'unsupported Torx contour must retain the configured part');
 }
});

test('P7 real rivet paths carry source dimensions and calculation assumptions into the builder in both price modes',()=>{
 for(const language of I.supported)for(const showPrices of [true,false])for(const spec of [
  {id:'DIN662',d:'5',l:'16',k:.8,cap:1.7,shaft:16,total:18.5,alpha:140},
  {id:'DIN302',d:'10',l:'20',k:3,cap:1,shaft:17,total:21,alpha:75},
  {id:'DIN661',d:'4',l:'12',k:2,shaft:10,total:12,alpha:75},
  {id:'DIN6792',d:'4',l:'12',k:1.2,shaft:10.8,total:12,alpha:120}
 ]){
  let input;const p=setup(language,{...E,auslegen(e){input=e;return E.auslegen(e);}},showPrices,undefined,true,true,true);
  const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  choose('kind','rivet');choose('id',spec.id);choose('groesse',spec.d);
  if(p.get('norm-laenge').options.some(o=>o.value===spec.l))choose('laenge',spec.l);else{p.get('norm-laenge-custom').value=spec.l;p.get('norm-laenge-custom').events.input();}
  assert.equal(input.sL,spec.shaft,spec.id);assert.equal(input.kH,spec.k,spec.id);if(spec.cap)assert.equal(input.capHeight,spec.cap);assert.equal(input.alpha,spec.alpha);
  assert(input.rivetGeometryReference);assert.equal(input.boreBottomAssumption?.origin,spec.id==='DIN6792'?'assumption':undefined);
  const expected=E.boltGeometry(input);assert.ok(!expected.error);assert.ok(Math.abs(expected.totalLength-spec.total)<1e-9);
  const provenance=JSON.parse(JSON.stringify(input.rivetGeometryReference));p.get('norm-to-chain').events.click();assert.equal(p.get('norm-chain-status').textContent,'');assert.equal(p.f.elements.typ.value,'formteil');
  const chain=p.geometryWizard.getChain();assert.deepEqual(JSON.parse(JSON.stringify(chain.modelAssumptions.rivetReference)),provenance);assert.equal(chain.standardDocument.standardReference.id,spec.id);assert.ok(Math.abs(chain.segments.reduce((sum,s)=>sum+s.length,0)-spec.total)<1e-9);
 }
});
test('P7 switching from a semi-tubular rivet applies the screw end and restores only explicit rivet edits on return',()=>{
 let input;const p=setup('de',{...E,auslegen(e){input=e;return E.auslegen(e);}},true,undefined,true,true);
 const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
 choose('kind','rivet');choose('id','DIN6791');choose('groesse','4');choose('laenge','12');
 assert.equal(input.schaftende,'halbhohl');assert.equal(input.bottomShape,'cone');assert.equal(input.geometryOrigins.bottomShape.origin,'assumption');
 p.f.elements.bottomShape.value='flat';p.f.events.change({target:p.f.elements.bottomShape});assert.equal(input.geometryOrigins.bottomShape.origin,'customer');
 choose('kind','screw');choose('id','ISO4014');choose('groesse','M12');choose('laenge','80');
 assert.equal(input.schaftende,require('../normen/ISO4014.json').schaftende,'rounded end is the screw norm preset, not the old rivet');assert.equal(input.schaftende,'kuppe');
 assert.equal(input.standardDocument.overrides.schaftende,undefined);assert.equal(input.standardDocument.overrides.bottomShape,undefined);assert.equal(input.boreBottomAssumption,undefined);assert.equal(input.geometryOrigins,undefined);assert.equal(input.d_b,undefined);assert.equal(input.t_b,undefined);assert.equal(input.rivetGeometryReference,undefined);
 choose('kind','rivet');assert.equal(input.standardDocument.standardReference.id,'DIN6791');assert.equal(input.schaftende,'halbhohl');assert.equal(input.bottomShape,'flat');assert.equal(input.geometryOrigins.bottomShape.origin,'customer');assert.equal(input.d_b,2.7);
});
test('expert template contains no manual status refresh buttons',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','archiv-vorlage.html'),'utf8');
 assert.doesNotMatch(html,/parts-drawing-refresh|geometry-refresh|archive-mail-refresh|Stand aktualisieren/);
});
test('P5 bolt tab has the requested product subtitle and the legacy technical selector has no misplaced bolt or headless category',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','archiv-vorlage.html'),'utf8');
 assert.match(html,/value="bolzen" form="f" checked>Bolzen<small>Schrauben, Niete, Stifte<\/small>/);
 assert.match(html,/<option value="pin">Stift<\/option><option value="headless">Gewindestift<\/option>/);
 assert.doesNotMatch(html,/Bolzen und Schrauben|>Kopfloses Teil</);
});
test('force-chain translations cover all languages and preserve every numeric placeholder',()=>{
 const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
 for(const [key,values]of Object.entries(require('../i18n-p2-force.json'))){
  assert.equal(values.length,4);
  values.forEach((text,index)=>{assert(text.trim());assert.notEqual(text,key);assert.deepEqual(placeholders(text),placeholders(key));assert.equal(I.t(key,I.supported[index+1]),text);
   if(key.startsWith('Station {station}: Napfstempel'))assert.equal(I.t(key.replace('{station}','4').replace('{pressure}','2600'),I.supported[index+1]),text.replace('{station}','4').replace('{pressure}','2600'));
  });
 }
});
test('force-v2 stage status, band and punch pressure reach screen, concept, print and mail in five languages',async()=>{
 const extra=require('../i18n-p2-force.json');
 const text=(key,language,values={})=>(language==='de'?key:extra[key][I.supported.indexOf(language)-1]).replace(/\{(\w+)\}/g,(all,key)=>values[key]??all);
 for(const language of I.supported){
  let input;const engine={...E,auslegen(e){input=e;const result=E.auslegen({...e,forcePolicy:undefined});if(result.stufen[0])Object.assign(result.stufen[0],{forceStatus:'extrapoliert',forceExtrapolation:{phiMax:1,phiEnd:1.4},forceBand:{min:19613.3,max:29419.95,unit:'N',t:{min:2,max:3}},p:1750,pStempel:2450,pStempelBand:{min:2300,max:2450,unit:'N/mm²'}});return result;}};
  const p=setup(language,engine,true,undefined,true);p.examples.find(button=>button.dataset.bsp==='m6').events.click();
  assert.equal(input.forcePolicy,'force-v2');
  const fmt=(n,d=1)=>n.toLocaleString(I.numberLocale(language),{minimumFractionDigits:d,maximumFractionDigits:d});
  const status=text('extrapoliert über φ {value}',language,{value:fmt(1)}),band=text('Kraftband {min}–{max} t',language,{min:fmt(2),max:fmt(3)}),pressure=text('Stempelpressung {value} N/mm²',language,{value:fmt(2450,0)}),pressureBand=text('Stempelpressung im Band {min}–{max} N/mm²',language,{min:fmt(2300,0),max:fmt(2450,0)});
  const stages=p.get('stufen').tBodies[0].innerHTML;
  assert(stages.includes('class="stage-force-status">'+status));
  assert(stages.includes(band));assert(stages.includes(pressureBand));assert(stages.includes(text('Stempel {value}',language,{value:fmt(2450,0)})));
  assert(stages.includes('title="'+text('Formdruck {value} N/mm²',language,{value:fmt(1750,0)})+'">'+fmt(1750,0)),'forming pressure is distinct from the punch pressure');
  const concept=p.context.window.JYConcept.html({status:'candidate',stages:[{number:1,operation:'Napf',forceStatus:'extrapoliert',forceExtrapolation:{phiMax:1},forceBand:{t:{min:2,max:3}},pStempel:2450,pStempelBand:{min:2300,max:2450}}]},language);
  for(const value of [status,band,pressure,pressureBand])assert(concept.includes(value));
  p.get('drucken').events.click();await sendMail(p);
  for(const output of [p.get('blatt').innerHTML,new URL(p.context.location.href).searchParams.get('body')])for(const value of [status,band,pressure,pressureBand])assert(output.includes(value),language+' / '+value);
  for(const output of [stages,concept,p.get('blatt').innerHTML])assert(!output.includes('undefined')&&!output.includes('NaN'));
  if(language!=='de')assert(!stages.includes('extrapoliert über φ'));
 }
});
test('legacy stages have no force-v2 annotations or policy and malformed bands never display',()=>{
 let input;const p=setup('de',{...E,auslegen(e){input=e;return E.auslegen(e);}},true);p.examples[0].events.click();
 assert.equal(input.forcePolicy,undefined);assert.doesNotMatch(p.get('stufen').tBodies[0].innerHTML,/stage-force-status|stage-force-details|Stempelpressung/);
 const C=p.context.window.JYConcept;
 for(const stage of [{pStempel:2450},{forceStatus:'calculated',forceBand:{t:{min:3,max:2}},pStempel:Infinity},{forceStatus:'extrapoliert',forceExtrapolation:{phiMax:NaN},forceBand:{t:{min:null,max:3}}}])assert(Object.values(C.forceText(stage,'de')).every(value=>value===''));
 assert(!C.html({status:'candidate',stages:[{number:1,operation:'Napf',pStempel:2450}]},'de').includes('Stempelpressung'));
});
test('manual enquiry carries the staged force policy for server verification while legacy has no decision context',async()=>{
 for(const staged of [false,true]){
  const p=setup('de',E,true,{},staged);p.examples.find(button=>button.dataset.bsp==='m6').events.click();
  p.answers.push({data:{id:'ENQUIRY',token:'private-test-token',kind:'enquiry',status:'received',notificationStatus:'sent'}});await sendMail(p);
  const body=p.networkRequests[0].options.body;
  if(staged){const decision=JSON.parse(body.get('decisionContext'));assert.equal(decision.kind,'manual');assert.equal(decision.input.forcePolicy,'force-v2');assert.equal(decision.input.machinePolicy,'ranking-v2');}
  else assert.equal(body.get('decisionContext'),null);
 }
});
test('the staged M10 nut renders real extrapolation and endpoint checks in five languages',async()=>{
 for(const language of I.supported){
  let analysis,selection;const engine={...E,auslegen(e){return analysis=E.auslegen(e);},waehle(...args){return selection=E.waehle(...args);}};
  const p=setup(language,engine,true,undefined,true,true);p.examples.find(button=>button.dataset.bsp==='mu').events.click();
  assert.equal(analysis.forcePolicy,'force-v2');assert(analysis.stufen.every(stage=>Number.isFinite(stage.t)&&stage.t>0));
  const stage=analysis.stufen.find(stage=>stage.forceStatus==='extrapoliert');assert(stage);assert(stage.pStempel>0);
  const status=p.context.window.JYConcept.forceText(stage,language).status,table=p.get('stufen').tBodies[0].innerHTML,cards=p.get('karten').innerHTML;
  assert(table.includes(status));assert(cards.includes(status),'machine-specific concept retains the extrapolation metadata');
  assert(['ok','knapp'].includes(selection.ranking.recommendation.gesamt));
  assert(cards.includes(I.t('Beide Kraftbandgrenzen ergeben denselben Prüfstatus.',language)));
  assert(!table.includes(I.t('Kraft noch offen',language)));
  if(language!=='de')for(const output of [table,cards,p.get('regeln').innerHTML])assert(!/extrapoliert über|Beide Kraftbandgrenzen|Kraftbandgrenzen ändern|Scherkraft-Näherung|Gekennzeichnete Extrapolation/.test(output),language);
  p.get('drucken').events.click();await sendMail(p);
  for(const output of [p.get('blatt').innerHTML,new URL(p.context.location.href).searchParams.get('body')])assert(output.includes(status));
 }
});
test('price-free preset sends a v2 class-aware shortlist and displays the returned primary model without prices',async()=>{
 const p=setup('de',E,false,{ranking:true},true,true);p.examples.find(button=>button.dataset.bsp==='m6').events.click();
 const original=p.get('karten').innerHTML.match(/class="modell">([^<]+)/)[1];let expected,compared;
 p.answers.push(()=>{const body=JSON.parse(p.networkRequests.at(-1).options.body),primary=body.candidates.filter(row=>row.role==='primary'),reserve=body.candidates.filter(row=>row.role==='reserve');assert.equal(body.rankingVersion,'ranking-v2');assert(primary.length>0&&primary.length<=12);assert(reserve.length<=12);assert.equal(new Set(primary.map(row=>row.classification)).size,1);assert(!JSON.stringify(body).includes('rp'));assert(reserve.some(row=>row.model==='JBF-10B2S'));expected=primary.find(row=>row.model!==original).model;compared=body.candidates.length;return {data:{version:'ranking-v2',basis:'submitted-technical-status',priceRankingComplete:true,models:[{model:expected,comparison:null}]}};});
 const timer=[...p.timers].find(([,item])=>item.ms===450);assert(timer);p.timers.delete(timer[0]);await timer[1].fn();
 assert.equal(new URL(p.networkRequests[0].url).pathname,'/rangfolge');assert.equal(p.get('karten').innerHTML.match(/class="modell">([^<]+)/)[1],expected);assert(!p.get('karten').innerHTML.includes(compared+' von '));assert(p.get('karten').innerHTML.includes('Alle geprüften Modelle'));assert(!p.get('karten').innerHTML.includes('€'));assert(!p.get('karten').innerHTML.includes('<th>Richtpreis</th>'));
 assert.equal((p.get('karten').innerHTML.match(/class="ranking-request"/g)||[]).length,1,'configuration questions occur once below the cards');
 const card=p.get('karten').innerHTML.match(/<section class="ranking-card"[\s\S]*?<\/section>/)[0];
 assert(!card.includes('Maschinenbereich'));assert(!card.includes('Draht-Ø'));assert(!card.includes('ranking-request'));
 assert.match(p.get('karten').innerHTML,/<details class="machine-check"[^>]*><summary>Stadienkonzept und Prüfung im Einzelnen<\/summary><p class="ranking-reason">/);
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
test('P4 actual partial-thread norm click path clears the old length and keeps its two shank diameters through preview, mail, print and formed-part editing',async()=>{
 for(const language of I.supported){
  let input,analysis;const p=setup(language,{...E,auslegen(e){input=e;analysis=E.auslegen(e);return analysis;}},true,undefined,true,true,true);
  p.context.window.JYStandardPreview=require('../standard-preview.js');
  p.examples.find(button=>button.dataset.bsp==='m6').events.click();assert.equal(input.sL,30);
  const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  choose('id','ISO4014');choose('groesse','M12');
  assert.notEqual(p.f.elements.sL.value,'30','the prior socket-screw length is not silently retained');
  choose('laenge','custom');p.get('norm-laenge-custom').value='';p.get('norm-laenge-custom').events.input();
  assert.equal(p.f.elements.sL.value,'');assert.equal(input.sL,undefined);assert.equal(input.standardDocument.standardReference.laenge,undefined);assert.equal(p.get('aus').hidden,true,'a missing current length cannot retain prior machine results');
  const length=p.get('norm-laenge-custom');assert.equal(length.hidden,false);assert.equal(length.value,'');assert.equal(length.max,undefined);
  length.value='80';length.events.input();
  assert.equal(input.shaftPolicy,'shaft-v2');assert.equal(input.sL,80);assert.equal(input.ds,12);assert.equal(input.b,30);assert.equal(input.d0,12);
  assert.deepEqual(JSON.parse(JSON.stringify(input.shaftSegments)),[{diameter:12,length:50},{diameter:10.75,length:30}]);
  assert.deepEqual(analysis.fehlt,[]);assert.equal(p.get('aus').hidden,false);assert.equal(input.standardDocument.lengthSelection.origin,'customer');
  const modelNote=I.t('Rohlingmodell: Glatter Schaft l − b, Gewinderohling über b; der Gewindeauslauf ist vereinfacht.',language);
  assert(p.get('geometry-view').innerHTML.includes(modelNote));assert(p.get('geometry-view').innerHTML.includes('<svg'));assert.doesNotMatch(p.get('geometry-view').innerHTML,/nominal-blank-segmentation|R-SHAFT-PARTIAL/);
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(modelNote));
  await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(modelNote));
  const volume=analysis.werte.V;p.get('norm-to-chain').events.click();
  assert.equal(p.get('norm-chain-status').textContent,'');assert.equal(p.f.elements.typ.value,'formteil');
  const chain=p.geometryWizard.getChain();assert.equal(chain.standardDocument.standardReference.id,'ISO4014');
  assert.deepEqual(JSON.parse(JSON.stringify(chain.segments.slice(-2).map(({diameter,length})=>({diameter,length})))),[{diameter:12,length:50},{diameter:10.75,length:30}]);
  assert.equal(p.geometryWizard.isComplete(),true);assert(Math.abs(p.geometryWizard.refresh().volumeMm3-volume)<1e-6);
  p.f.events.change({target:p.f.elements.rm});assert(p.get('geometry-view').innerHTML.includes(modelNote));
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(modelNote));await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(modelNote));
 }
});
test('P4 flange model passes its documented approximation to preview, print and mail in five languages',async()=>{
 for(const language of I.supported){
  let input;const p=setup(language,{...E,auslegen(e){input=e;return E.auslegen(e);}},true,undefined,true,true);
  p.context.window.JYStandardPreview=require('../standard-preview.js');p.examples.find(button=>button.dataset.bsp==='m6').events.click();
  for(const[key,value]of [['id','ISO4162'],['groesse','M12']]){p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();}
  const length=p.get('norm-laenge-custom');length.value='80';length.events.input();
  assert(input.flangeDiameter>0);assert(input.flangeHeight>0);assert.equal(input.flangeModelAssumption.heightBasis,'published-minimum-c');assert.equal(p.get('aus').hidden,false);
  const modelNote=I.t('Kopfmodell: Sechskant und zylindrischer Flansch; Flanschhöhe {height} mm aus dem veröffentlichten Mindestmaß c angenähert.',language).replace('{height}',input.flangeHeight.toLocaleString(I.numberLocale(language),{maximumFractionDigits:2}));
  assert(p.get('geometry-view').innerHTML.includes(modelNote));assert.doesNotMatch(p.get('geometry-view').innerHTML,/published-minimum-c|hex-prism-and-flange-cylinder/);
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(modelNote));await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(modelNote));
 }
});
test('P5 K7 accepts shorthand after actual norm-to-parts conversion and a surrounding-form refresh',()=>{
 for(const trigger of ['keydown','focusout']){
  const p=setup('de',E,true,undefined,true,true,true);p.examples[1].events.click();p.get('norm-to-chain').events.click();
  assert.equal(p.f.elements.typ.value,'formteil');assert.equal(p.geometryWizard.getChain().segments.length,2);
  const root=p.get('geometry-wizard'),target={id:'chain-shorthand',value:'12x6, 8x30, 6x5',dataset:{},tagName:'INPUT'};
  root.events.input({target});p.f.events.change({target});
  assert.equal(target.value,'12x6, 8x30, 6x5');assert.equal(p.geometryWizard.getChain().segments.length,2);
  root.events[trigger]({key:'Enter',target,preventDefault(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(p.geometryWizard.getChain().segments.map(({diameter,length})=>[diameter,length]))),[[12,6],[8,30],[6,5]]);
  assert(p.geometryWizard.isComplete());assert(p.get('geometry-view').innerHTML.includes('S3'));
 }
});
test('P5 incomplete or invalid geometry clears derived tool placeholders but retains customer tool values',()=>{
 const p=setup('de',E,true,undefined,true,true);p.examples[1].events.click();
 for(const key of ['lStempel','ko','pko','stationen'])assert(p.f.elements[key].placeholder);
 p.f.elements.ko.value='17';p.f.events.change({target:p.f.elements.ko});
 p.f.elements.sL.value='invalid';p.f.events.change({target:p.f.elements.sL});
 for(const key of ['lStempel','ko','pko','stationen','zusatz'])assert.equal(p.f.elements[key].placeholder,'');
 assert.equal(p.f.elements.ko.value,'17');assert.equal(p.get('aus').hidden,true);
});
test('P5 a missing norm length has a clear localized prompt, without a geometry-builder or engine-segment error',()=>{
 for(const language of I.supported){
  const p=setup(language,E,true,undefined,true,true);p.context.window.JYStandardPreview=require('../standard-preview.js');p.examples[1].events.click();
  for(const[key,value]of [['id','ISO4014'],['groesse','M12']]){p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();}
  p.get('norm-laenge').value='custom';p.get('norm-laenge').events.change();p.get('norm-laenge-custom').value='';p.get('norm-laenge-custom').events.input();
  const prompt=I.t('Bitte Länge eingeben.',language);assert.equal(p.get('leer').textContent,'');assert.equal(p.get('leer').hidden,true);assert(p.get('geometry-view').innerHTML.includes(prompt));
  for(const key of ['lStempel','ko','pko','stationen','zusatz'])assert.equal(p.f.elements[key].placeholder,'',key+' has no result from the previous part');
  assert.doesNotMatch(p.get('geometry-view').innerHTML,/Jedes Schaftsegment|positive Länge|Baukasten/);assert.equal(p.get('aus').hidden,true);assert.equal(p.get('drucken').disabled,true);
  const texts=node=>[node.textContent,...(node.children||[]).flatMap(texts)],picker=texts(p.get('norm-picker')).join('\n');assert(picker.includes(prompt));assert(!picker.includes(I.t('Für diese Ausführung die fehlende Kontur im Baukasten ergänzen. Die belegten Normmaße bleiben erhalten.',language)));
  p.get('norm-to-chain').events.click();assert.equal(p.get('norm-chain-status').textContent,prompt);
 }
});
test('P5 real functional selectors retain norm edits on reentry, keep free geometry and identify set screws in reports',async()=>{
 for(const language of I.supported){
  let input;const p=setup(language,{...E,auslegen(e){input=e;return E.auslegen(e);}},true,undefined,true,true);
  p.examples[1].events.click();const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  choose('kind','set-screw');assert.equal(p.f.elements.standardKind.value,'headless');assert.equal(p.f.elements.kopfForm.value,'none');assert.equal(p.f.elements.kH.value,'0');
  choose('id','ISO4026');choose('groesse','M6');p.get('norm-laenge-custom').value='10';p.get('norm-laenge-custom').events.input();
  // Deliberate customer deviation closes the otherwise undocumented end taper.
  p.f.elements.schaftende.value='voll';p.f.events.change({target:p.f.elements.schaftende});
  assert.equal(input.partFunction,'set-screw');assert.equal(input.standardKind,'headless');assert.equal(p.get('aus').hidden,false,JSON.stringify({missing:input.normMissingFields,note:p.get('leer').textContent,kD:input.kD,kH:input.kH,sD:input.sD,sL:input.sL,iTyp:input.iTyp,iT:input.iT}));
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(I.t('Gewindestift',language)));await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(I.t('Gewindestift',language)));
  p.f.elements.sL.value='11';p.f.events.change({target:p.f.elements.sL});
  choose('kind','free');assert.equal(input.partFunction,'free');assert.equal(input.standardReference,undefined);assert.equal(p.f.elements.sL.value,'11');assert.equal(p.f.elements.kopfForm.value,'none');
  choose('kind','set-screw');assert.equal(input.standardDocument.standardReference.id,'ISO4026');assert.equal(input.sL,11);assert.equal(input.standardDocument.overrides.sL.origin,'customer');
  choose('kind','stud');assert.deepEqual(p.get('norm-id').options.map(o=>o.value),['','DIN835']);
  choose('kind','weld-stud');assert.deepEqual(p.get('norm-id').options.map(o=>o.value),['','ISO13918']);assert.equal(p.f.elements.standardKind.value,'pin');assert.equal(p.get('bolt-drive-fields').hidden,true);
  choose('kind','rivet');assert.equal(p.get('bolt-drive-fields').hidden,true);assert.equal(p.f.elements.iTyp.disabled,true);assert.equal(input.iTyp,'none');
  choose('kind','free');assert.equal(input.threadFamily,'none');assert.equal(input.iTyp,'none','free editing retains a former rivet or pin without inventing a thread or drive');
 }
});
test('P5 semi-tubular rivet defaults explain the 120-degree bottom instead of asking again, in preview, print and mail',async()=>{
 for(const language of I.supported){
  let input;const p=setup(language,{...E,auslegen(e){input=e;return E.auslegen(e);}},true,undefined,true,true,true);p.context.window.JYStandardPreview=require('../standard-preview.js');p.examples[1].events.click();
  for(const[key,value]of [['kind','rivet'],['id','DIN6791'],['groesse','4']]){p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();}
  p.get('norm-laenge-custom').value='12';p.get('norm-laenge-custom').events.input();
  assert(!input.normMissingFields.includes('boreBottomShape'));assert.equal(input.geometryOrigins.bottomAngle.origin,'assumption');assert.equal(p.get('bolt-drive-fields').hidden,true);assert.equal(input.iTyp,'none');
  assert.equal(p.f.elements.threadFamily.value,'none','the actual control retains the effective unthreaded geometry for later free editing');
  const note=I.t('Bohrungsgrund: {angle}°-Kegel als Umformannahme; keine Normvorgabe.',language).replace('{angle}','120');
  const previewNote=I.t('Kegelgrund 120° als Geometrie-/Prozessannahme, nicht aus der Normgröße abgeleitet.',language);
  assert(p.get('geometry-view').innerHTML.includes(previewNote));assert(!p.get('geometry-view').innerHTML.includes(note),'standard preview has one bore-assumption note');
  const texts=node=>[node.textContent,...(node.children||[]).flatMap(texts)],picker=texts(p.get('norm-picker')).join('\n');assert(picker.includes(I.t('Kopfwölbungsradius',language)));assert.doesNotMatch(picker,/headProfileRadius|boreBottomShape/);
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(note));await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(note));
  const assumption=input.boreBottomAssumption;p.get('norm-to-chain').events.click();assert.equal(p.get('norm-chain-status').textContent,'');assert.equal(p.f.elements.typ.value,'formteil');
  assert.deepEqual(JSON.parse(JSON.stringify(p.geometryWizard.getChain().modelAssumptions.bore)),assumption);assert(p.get('geometry-view').innerHTML.includes(note));
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(note));await sendMail(p);assert(new URL(p.context.location.href).searchParams.get('body').includes(note));
 }
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
  const model=machines.find(machine=>machine.f==='JNP').m;p.answers.push({data:{id:'D1',kind:'preview',status:'needs_info',answer:'Drawing concept',questions:['Please specify the material.'],proposal:{machines:[{model,status:'offen',priceEUR:999}]}}});await pollStatus(p);
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

test('standard references set only shape and drive, nuts with a collar stay in nuts, and profile fields follow the selected family',()=>{
 let received;const p=setup('de',{...E,auslegen(input){received=input;return E.auslegen(input);}});p.examples[0].events.click();const diameter=p.f.elements.d0.value;
 p.f.elements.standardNorm.value='ISO4762';p.f.elements.standardNorm.events.change();assert.equal(p.f.elements.kopfForm.value,'rund');assert.equal(p.f.elements.iTyp.value,'hex');assert.equal(p.f.elements.d0.value,diameter);assert.equal(received.standardReference,'ISO4762');
 p.f.elements.standardKind.value='headless';p.f.elements.standardKind.events.change();assert.equal(p.f.elements.kH.value,'0');assert.equal(p.f.elements.kD.value,'0');assert(p.get('bolt-head').hidden);
 p.f.elements.threadFamily.value='duo-taptite';p.f.elements.sArea.value='20';p.f.elements.tipLength.value='5';p.f.elements.tipArea.value='15';p.f.elements.tipDiameter.value='999';p.f.events.change();assert.equal(received.sArea,20);assert.equal(received.tipLength,5);assert.equal(received.tipArea,15);assert.equal(received.tipDiameter,undefined);
 p.f.elements.threadFamily.value='metric';p.f.events.change();assert.equal(received.sArea,undefined);assert.equal(received.tipArea,undefined);assert.equal(received.tipLength,undefined);
 p.f.elements.typ.value='mutter';p.f.events.change();p.f.elements.nutNorm.value='ISO4161';p.f.events.change({target:p.f.elements.nutNorm});assert.equal(p.f.elements.typ.value,'mutter');assert(p.get('geometry-panel').hidden);assert(!p.get('standard-part-fields').hidden);assert.equal(p.get('flange-nut-route').events.click,undefined);
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
  p.answers.push({data:{kind:'enquiry',status:'received',analysisStatus:'not_requested',notificationStatus:'sent'}});await pollStatus(p);assert.equal(p.get('sendehinweis').textContent,I.t('Hans Möhling wurde per E-Mail über Ihre Anfrage informiert.',language));assert(p.networkRequests.every(request=>!request.url.includes('/preview')));assert.equal(p.context.location.href,'');
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

test('empty illustrations follow the selected family and disappear for machine results',()=>{
 for(const prices of [true,false]){
  const p=setup('de',E,prices);
  for(const [type,visible]of [['bolzen','empty-screws'],['mutter','empty-nuts'],['formteil','empty-parts'],['bolzen','empty-screws']]){
   p.f.elements.typ.value=type;p.f.events.change();
   assert.equal(p.get('empty-visual').hidden,false);
   for(const id of ['empty-screws','empty-nuts','empty-parts'])assert.equal(p.get(id).hidden,id!==visible,type+' illustration: '+id);
  }
  p.examples[0].events.click();assert.equal(p.get('empty-visual').hidden,true);
 }
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
  assert(sheet.includes(I.t(kind==='rivet'?'Niet':'Stift',language)));
  assert(!sheet.includes(I.t('Gewindefamilie',language)));assert(!sheet.includes('Duo-Taptite'));assert(!sheet.includes(I.t('Innenantrieb',language)));
  p.events['jy-languagechange']();assert.equal(received.threadFamily,'none');
  p.f.elements.standardKind.value='screw';p.f.elements.standardKind.events.change();
  assert(!p.get('thread-family-field').hidden);assert(!p.get('bolt-drive-fields').hidden);
  assert.equal(received.threadFamily,'duo-taptite','returning to screw preserves its profile input');
 }
});

test('rivet material-class changes never ask for a drive, retain norm edits, and Cu clears prior Al forces in five languages',async()=>{
 for(const language of I.supported)for(const showPrices of [true,false])for(const id of ['DIN660','DIN6791']){
  let input,analysis;const p=setup(language,{...E,auslegen(e){input=e;return analysis=E.auslegen(e);}},showPrices,undefined,true,true);
  const choose=(key,value)=>{const field=p.get('norm-'+key);field.value=value;field.events.change();};
  assert(!p.f.elements.wst.options.some(option=>option.value.includes('missing-flow-curve')),'copper is not globally enabled');
  choose('kind','rivet');choose('id',id);choose('groesse','4');
  p.f.elements.kD.value='8.2';p.f.events.change({target:p.f.elements.kD});
  const geometry={sD:input.sD,sL:input.sL,kD:input.kD,kH:input.kH,d_b:input.d_b,t_b:input.t_b};
  for(const [materialClass,expected]of [['Al','AlMgSi1'],['Cu','Cu-ETP'],['CuZn','CuZn37'],['Cu','Cu-ETP'],['Stahl','C4C']]){
   choose('festigkeitsklasse',materialClass);
   assert.equal(E.WERKSTOFFE[input.wst].id,expected);assert.equal(analysis.werkstoff.id,expected);assert.equal(input.standardDocument.standardReference.id,id);assert.equal(input.standardDocument.standardReference.groesse,'4');assert.equal(input.propertyClass,materialClass);
   assert.deepEqual({sD:input.sD,sL:input.sL,kD:input.kD,kH:input.kH,d_b:input.d_b,t_b:input.t_b},geometry);assert.equal(input.standardDocument.overrides.kD.value,8.2);
   assert.equal(input.iTyp,'none');assert.equal(input.threadFamily,'none');assert(p.get('bolt-drive-fields').hidden);assert(p.f.elements.iTyp.disabled);assert(analysis.werte.V>0&&analysis.werte.masse>0);assert.equal(p.get('aus').hidden,false);
   assert.equal(p.f.elements.wst.options.some(option=>option.value.includes('missing-flow-curve')),materialClass==='Cu');
   if(materialClass==='Cu'){
    assert.equal(input.curveId,null);assert.equal(input.materialState,'unknown');assert.equal(analysis.werte.Fmax_t,null);assert(analysis.stufen.every(stage=>stage.F===null));
    assert(p.get('stufen').tBodies[0].innerHTML.includes(I.t('Kraft noch offen',language)));
    assert(p.get('material-basis').textContent.includes(I.t('Cu-ETP: Fließkurve für den Lieferzustand fehlt. Geometrie und Gewicht sind berechnet; Kräfte bleiben offen.',language)));
    assert(!p.get('material-basis').textContent.includes('φ'));
    p.get('drucken').events.click();await sendMail(p);
    for(const text of [p.get('blatt').innerHTML,new URL(p.context.location.href).searchParams.get('body')]){assert(text.includes('Cu-ETP'));assert(text.includes(I.t('Fließkurve des Lieferzustands fehlt',language)));assert(!text.includes(I.t('Literaturansatz',language)));assert(!text.includes('AlMgSi'));assert(!text.includes(I.t('Innenantrieb',language)));}
   }else assert(analysis.werte.Fmax_t>0,'approved material restores its own force calculation');
  }
  assert.equal(E.findMaterial('Cu-ETP').manualEligible,false,'no global curve approval is changed');
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
  p.f.events.change();assert.equal(received.d0,5.6);assert.equal(received.rmPolicy,'rm-v2');assert.equal(received.rm,undefined);
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
  const normHint=max=>I.t('Rm bis {max} N/mm² · Normobergrenze für {condition}; Lieferzustand als Rechenannahme.',language).replace('{max}',String(max)).replace('{condition}','+AC');
  p.examples[1].events.click();assert.equal(received.rm,undefined);assert.equal(received.rmPolicy,'rm-v2');assert.equal(p.get('rm-origin').textContent,normHint(330));
  const initial=E.rmVorbelegung(received);assert.equal(initial.materialId,'C4C');assert.equal(initial.value,null);assert.equal(initial.band.max,330);assert.equal(initial.origin,'standard');assert.equal(p.f.elements.rm.value,'');
  const a=E.auslegen(received),chosen=E.waehle(machines,a,received,praxis);assert(chosen.passend.length>0);
  assert(!chosen.passend[0].openPoints.some(x=>x.id==='wire-tensile-strength'));
  const variant=p.f.elements.wst.options.find(o=>o.textContent.startsWith('C10C'));p.f.elements.wst.value=variant.value;p.f.events.change();
  assert.equal(received.rm,undefined);assert.equal(p.f.elements.rm.placeholder,I.t('aus Drahtzeugnis, falls bekannt',language));assert.equal(p.get('rm-origin').textContent,normHint(380));
  assert.equal(E.rmVorbelegung(received).value,null);assert.equal(E.rmVorbelegung(received).band.max,380);
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes(I.t('Herkunft Rm',language)));assert(p.get('blatt').innerHTML.includes(I.t('Normobergrenze',language)));assert(!p.get('blatt').innerHTML.includes(I.t('Richtwert · vorläufig',language)));
  p.f.elements.rm.value='450';p.f.events.change();assert.equal(received.rm,450);assert(p.get('rm-origin').textContent.includes(I.t('Kundenangabe',language)));
  p.f.elements.rm.value='';p.f.elements.wirePreparation.value='inline-drawing';p.f.elements.rodDiameter.value='6';p.f.events.change();
  assert.equal(E.rmVorbelegung(received).value,null);assert(p.get('rm-origin').hidden,'pre-drawing reference must not be reused after inline drawing');
  p.get('drucken').events.click();assert(!p.get('blatt').innerHTML.includes(I.t('Vorläufiges Praxisband',language))&&!p.get('blatt').innerHTML.includes(I.t('Normobergrenze',language)),'an unknown post-drawing Rm must not reuse the prior band');
 }
});

test('the Rm norm-band hint follows the new wire diameter across 5 mm without overwriting customer values',()=>{
 for(const language of I.supported){
  let received;const p=setup(language,{...E,auslegen(e){received=e;return E.auslegen(e);}},true,undefined,true);
  for(const [key,value]of Object.entries({sD:'4.8',sL:'25',kD:'8',kH:'4'}))p.f.elements[key].value=value;
  p.f.events.change();assert.equal(received.d0,5.1);
  const chooseWire=value=>{const field=p.get('wire-candidates');assert(field.options.some(option=>option.value===String(value)));field.value=String(value);field.events.change();};
  for(const [diameter,max,condition,rangeMin,rangeMax]of [[5,320,'+U+C+AC',2,5],[5.1,330,'+AC',5,100],[5,320,'+U+C+AC',2,5]]){
   chooseWire(diameter);const rm=E.rmVorbelegung(received);
   assert.equal(received.d0,diameter);assert.equal(received.rm,undefined);assert.equal(p.f.elements.rm.value,'');assert.equal(rm.band.max,max);assert.equal(rm.deliveryCondition,condition);assert.equal(rm.diameterRange.minExclusive,rangeMin);assert.equal(rm.diameterRange.maxInclusive,rangeMax);
   const expected=I.t('Rm bis {max} N/mm² · Normobergrenze für {condition}; Lieferzustand als Rechenannahme.',language).replace('{max}',String(max)).replace('{condition}',condition);
   assert.equal(p.get('rm-origin').textContent,expected,'hint must use the just-selected diameter, not the previous input snapshot');
  }
  p.f.elements.rm.value='417';p.f.events.change();chooseWire(5.1);assert.equal(received.rm,417);assert.equal(p.f.elements.rm.value,'417');assert(p.get('rm-origin').textContent.includes(I.t('Kundenangabe',language)));assert(!p.get('rm-origin').textContent.includes(I.t('Normobergrenze',language)));
  chooseWire('custom');p.f.elements.d0.value='5.03';p.f.elements.d0.events.input();p.f.events.change();p.f.elements.sL.value='28';p.f.events.change();
  assert.equal(received.d0,5.03);assert.equal(received.inputOrigins.d0.origin,'customer');assert.equal(received.rm,417);assert.equal(p.f.elements.rm.value,'417');
  p.f.elements.rm.value='';p.f.events.change();assert.equal(received.d0,5.03);assert.equal(received.rm,undefined);assert.equal(E.rmVorbelegung(received).band.max,330);assert(p.get('rm-origin').textContent.includes('+AC'));
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

test('P5 ISO4161 stays in the nut calculator with its own collar and never enters a formed-part route',()=>{
 for(const language of I.supported){
  let received;const p=setup(language,{...E,auslegen(input){received=input;return E.auslegen(input);}},true,undefined,true,true);p.examples[2].events.click();
  for(const[key,value]of [['id','ISO4161'],['groesse','M8']]){p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();}
  assert.equal(p.f.elements.typ.value,'mutter');assert.equal(received.partFunction,'nut');assert.equal(p.f.elements.nutFlange.checked,true);assert.equal(received.mFlansch,17.9);assert.equal(received.mFlanschH,1.2);
  assert.equal(p.get('geometry-panel').hidden,true);assert.equal(p.get('aus').hidden,false);p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes('ISO4161'));
  p.get('norm-id').value='ISO4032';p.get('norm-id').events.change();p.events['jy-languagechange']();
  assert.equal(p.f.elements.typ.value,'mutter');assert.equal(p.f.elements.nutFlange.checked,false);assert.equal(received.mFlansch,undefined);assert.equal(received.standardDocument.standardReference.id,'ISO4032');
  p.get('drucken').events.click();assert(p.get('blatt').innerHTML.includes('ISO4032'));assert(!p.get('blatt').innerHTML.includes('ISO4161'));
 }
});

test('P7 fine nut holes use documented internal 6H data and clear stale values only when the required tolerance evidence is missing',()=>{
 for(const language of I.supported)for(const showPrices of [true,false]){
  let received;const p=setup(language,{...E,auslegen(input){received=input;return E.auslegen(input);}},showPrices,undefined,true,true);p.examples[2].events.click();
  const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  choose('id','DIN985');choose('groesse','M10x1');assert.equal(p.f.elements.mLoch.value,'9.04');
  choose('groesse','M18x2');assert.equal(p.f.elements.mLoch.value,'16.02');assert.equal(received.threadModel.internalOnly,true);assert.equal(received.normRequiresGeometryReview,false);
  const catalog=p.context.window.JY_NORM_DATA;catalog.threads=JSON.parse(JSON.stringify(catalog.threads));delete catalog.threads.TD1Grade6['2'];
  choose('groesse','M10x1');assert.equal(p.f.elements.mLoch.value,'9.04');choose('groesse','M18x2');
  assert.equal(p.f.elements.mLoch.value,'');assert.equal(received.threadModel,null);assert.ok(received.normMissingFields.includes('nutHoleTolerance'));assert.equal(received.normRequiresGeometryReview,true);assert.equal(p.get('aus').hidden,true);
  const source='Bohrungs-Ø eingeben – Gewindetoleranzmodell fehlt',label=p.context.window.JYNormLibrary.missingLabel('nutHoleTolerance',key=>I.t(key,language));assert.equal(label,I.t(source,language));if(language!=='de')assert.notEqual(label,source);
  p.f.elements.mLoch.value='16.15';p.f.events.change({target:p.f.elements.mLoch});assert.equal(p.f.elements.mLoch.value,'16.15');assert.equal(received.mLoch,16.15);assert.equal(received.normRequiresGeometryReview,false);
  choose('groesse','M20x2');assert.equal(p.f.elements.mLoch.value,'16.15');assert.equal(received.standardDocument.overrides.mLoch.value,16.15);
 }
});

test('P7 missing 6g records cannot carry the old M6 rolling blank into another screw size',()=>{
 for(const language of I.supported)for(const showPrices of [true,false]){
  let received;const p=setup(language,{...E,auslegen(input){received=input;return E.auslegen(input);}},showPrices,undefined,true,true);p.examples[0].events.click();
  const choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  choose('id','ISO4762');choose('groesse','M6');choose('laenge','30');
  assert.equal(p.f.elements.sD.value,'5.27');
  choose('id','ISO8676');choose('groesse','M18');choose('laenge','35');
  assert.equal(p.get('norm-steigung').value,'2');assert.equal(received.standardDocument.standardReference.steigung,2);assert.ok(p.get('norm-steigung').options.some(option=>option.value==='1.5'));
  assert.equal(p.f.elements.sD.value,'');assert.equal(p.f.elements.kSW.value,'27');assert.equal(p.f.elements.sL.value,'35');
  assert.ok(received.normMissingFields.includes('rollingBlankDiameter'));assert.equal(received.normRequiresGeometryReview,true);assert.equal(p.get('aus').hidden,true);
  const key='Durchmesser des Walzrohlings',label=p.context.window.JYNormLibrary.missingLabel('rollingBlankDiameter',text=>I.t(text,language));assert.equal(label,I.t(key,language));if(language!=='de')assert.notEqual(label,key);
  p.f.elements.sD.value='16.6';p.f.events.change({target:p.f.elements.sD});assert.equal(p.f.elements.sD.value,'16.6');assert.equal(received.sD,16.6);assert.ok(!received.normMissingFields.includes('rollingBlankDiameter'));
  choose('groesse','M20');assert.equal(p.f.elements.sD.value,'16.6');assert.equal(received.standardDocument.overrides.sD.value,16.6);
 }
});
