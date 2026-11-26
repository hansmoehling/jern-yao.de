const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const source = fs.readFileSync(path.join(__dirname, '..', 'drawing-preview.js'), 'utf8');
const catalogue={};
for(const name of fs.readdirSync(path.join(__dirname,'..')).filter(name=>/^i18n-.*\.json$/.test(name)).sort())Object.assign(catalogue,JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/^\uFEFF/,'')));
const translationModule={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalogue)),translationModule);
const I18N=translationModule.module.exports;
const models=JSON.parse(fs.readFileSync(path.join(__dirname,'..','maschinen.json'),'utf8')).map(machine=>machine.m);

class Element {
  constructor() { this.hidden = false; this.disabled = false; this.dataset = {}; this.textContent = ''; this.innerHTML = ''; this.events = {}; }
  addEventListener(name, fn) { this.events[name] = fn; }
}
function harness(mode='geometry',{language='de',showPrices=false}={}) {
  const nodes = Object.fromEntries(['button', 'progress', 'status', 'result', 'refresh'].map(key => [key, new Element()]));
  const requests = [], answers = [], received = [], chosen = [], timers = new Map(),events={}; let nextTimer = 0, invalidations = 0,clock=0;
  let geometry = { geometrySpec: { version: 1, coordinateSystem: 'tool-parting-plane', elements: [{ id: 'body', operation: 'add', shape: 'cylinder', side: 'die', start: 0, length: 12, diameter: 8 }], trimming: [] }, material: 'C10C', d0: 8 };
  let note = 'Original note',file=null;
  const locale = { language, t: value => I18N.t(value,locale.language) };
  const window = { JYAnswerFormat: require('../answer-format.js'), JYLocale: locale, JYI18N: I18N, JY_API_BASE: 'https://api.example.test', JY_SHOW_PRICES: showPrices, location: { href: 'https://jernyao.de/konfigurator/' },addEventListener(name,fn){events[name]=fn;}, setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; }, clearTimeout(id) { timers.delete(id); } };
  const context = { window,Date:{now:()=>clock}, URL, URLSearchParams, FormData, AbortController, crypto, Uint8Array, TypeError, fetch: async (url, options) => { requests.push({ url, options }); const answer = await answers.shift(); if (answer instanceof Error) throw answer; assert(answer, 'unexpected API request'); return { ok: answer.ok !== false, status: answer.status || 200, json: async () => answer.data }; } };
  vm.runInNewContext(source, context);
  const controller = window.JYDrawingPreview.create({ ...nodes, ...(mode==='drawing'?{getFile:()=>file,showWhenEmpty:true}:{getGeometry:()=>geometry}), getNote: () => note, canChooseMachine:model=>models.includes(model), onChooseMachine:model=>chosen.push(model), onInvalidate: () => invalidations++, onResult: data => received.push(data) });
  return { ...nodes, controller, locale, requests, answers, received, chosen, timers,events,advance(ms){clock+=ms;}, get invalidations() { return invalidations; }, get geometry() { return geometry; }, set geometry(value) { geometry = value; }, set note(value) { note = value; },set file(value){file=value;}, async poll() { const entry = [...timers].find(([, item]) => item.delay === 4000); assert(entry, 'expected status poll'); timers.delete(entry[0]);clock+=4000; await entry[1].fn(); } };
}
const receipt = (id, status = 'queued') => ({ data: { id, token: 'private-' + id, kind: 'preview', status, notificationStatus: 'not_requested' } });

test('qualitative catalogue candidates show translated status and reason, preserve quote selection and obey both price policies',async()=>{
 for(const mode of ['geometry','drawing'])for(const language of I18N.supported)for(const showPrices of [false,true]){
  const p=harness(mode,{language,showPrices}),reason='JNP-10B6S: six stages; confirm tooling <before approval>.';
  if(mode==='drawing')p.file=new File(['drawing'],'part.png',{type:'image/png'});
  const response=receipt('QUALITATIVE','ready');response.data.proposal={machines:[
   {model:'JNP-10B6S',status:'offen',selectionBasis:'qualitative',reason,priceEUR:123456,criteria:[],openPoints:[],concept:null},
   {model:'JBF-10B2S',status:'offen',selectionBasis:'qualitative',reason:'Shorter part route.',priceRangeEUR:[234567,345678]},
   {model:'JBF-99999B9S',status:'offen',selectionBasis:'qualitative',reason:'Unknown model'}
  ]};p.answers.push(response);await p.controller.start();
  const html=p.result.innerHTML;
  assert(html.includes(I18N.t('Kandidat aus dem Stadienkonzept',language)));assert(!html.includes(I18N.t('Passend zur Vorauswahl',language)));
  assert(html.includes('JNP-10B6S: six stages; confirm tooling &lt;before approval&gt;.'));assert(!html.includes('<before approval>'));
  assert.equal((html.match(/data-preview-model=/g)||[]).length,2,'only catalogue models can be chosen');
  assert.equal(html.includes('€'),showPrices);assert.equal(html.includes(I18N.t('Richtpreis',language)),showPrices);assert.equal(html.includes(I18N.t('Preisspanne',language)),showPrices);
  const body=p.requests[0].options.body,policy=mode==='geometry'?JSON.parse(body).pricePolicy:body.get('pricePolicy');
  assert.equal(policy,showPrices?(mode==='geometry'?'with-prices':null):'technical-only');
  const click=model=>p.result.events.click({target:{closest:()=>({dataset:{previewModel:model}})}});
  click('JNP-10B6S');assert.deepEqual(p.chosen,['JNP-10B6S']);assert.equal(p.requests.length,1,'model choice does not send an enquiry');
  click('JBF-99999B9S');click(models.find(model=>!['JNP-10B6S','JBF-10B2S'].includes(model)));assert.deepEqual(p.chosen,['JNP-10B6S']);
  p.note='Changed part';p.controller.update();click('JNP-10B6S');assert.deepEqual(p.chosen,['JNP-10B6S'],'invalidated result cannot restore an old selection');
 }
});

test('drawing analysis action stays visible, starts only on click and sends no mail or implicit geometry',async()=>{
 const p=harness('drawing');assert.equal(p.button.hidden,false);assert.equal(p.button.disabled,true);await p.controller.start();assert.equal(p.requests.length,0);
 p.file=new File(['drawing'],'part.png',{type:'image/png'});p.controller.update();assert.equal(p.button.hidden,false);assert.equal(p.button.disabled,false);assert.equal(p.requests.length,0);
 p.answers.push(receipt('DRAWING'));await p.controller.start();assert.equal(p.requests.length,1);assert.match(p.requests[0].url,/\/preview\?language=de/);
 const body=p.requests[0].options.body;assert.equal(body.get('datei').name,'part.png');assert.equal(body.get('notiz'),'Original note');for(const name of ['email','consent','geometrySpec','material'])assert.equal(body.has(name),false);
 assert.equal(p.progress.hidden,false);p.file=null;p.controller.update();assert.equal(p.button.hidden,false);assert.equal(p.button.disabled,true);assert.equal(p.progress.hidden,true);assert.equal(p.result.hidden,true);
});

test('invalid/empty geometry does not queue an analysis; explicit start snapshots JSON and blocks duplicate starts', async () => {
  const p = harness(); const initial = p.geometry; p.geometry = null; p.controller.update();
  assert.equal(p.button.disabled, true); await p.controller.start(); assert.equal(p.requests.length, 0);
  p.geometry = initial; p.controller.update(); let finish; p.answers.push(new Promise(resolve => { finish = resolve; }));
  const first = p.controller.start(); const duplicate = p.controller.start(); assert.equal(p.requests.length, 1);
  const body = JSON.parse(p.requests[0].options.body); assert.equal(body.geometrySpec.elements[0].length, 12);
  assert.equal(body.pricePolicy, 'technical-only'); assert.equal(body.language, 'de'); assert.equal(body.note, 'Original note');
  assert.equal(p.requests[0].options.headers['Content-Type'], 'application/json'); assert.match(p.requests[0].url, /\/geometry-preview\?language=de/);
  assert.equal(body.email, undefined); assert.equal(body.consent, undefined);
  p.geometry.geometrySpec.elements[0].length = 19; p.controller.update();
  finish(receipt('OLD', 'ready')); await first; await duplicate;
  assert.equal(JSON.parse(p.requests[0].options.body).geometrySpec.elements[0].length, 12, 'sent body is an immutable snapshot');
  assert.equal(p.received.length, 0, 'old geometry response cannot become the new result'); assert.equal(p.result.hidden, true); assert.equal(p.progress.hidden, true);
  p.answers.push(receipt('NEW', 'ready')); await p.controller.start();
  assert.equal(JSON.parse(p.requests[1].options.body).geometrySpec.elements[0].length, 19);
  assert.notEqual(JSON.parse(p.requests[1].options.body).idempotency_key, body.idempotency_key); assert.equal(p.received[0].id, 'NEW');
});

test('late polling response cannot restore a detached geometry; note and language changes invalidate', async () => {
  const p = harness(); p.answers.push(receipt('A')); await p.controller.start();
  let finish; p.answers.push(new Promise(resolve => { finish = resolve; })); const oldPoll = p.poll();
  p.note = 'Changed note'; p.controller.update(); finish(receipt('A', 'ready')); await oldPoll;
  assert.equal(p.received.length, 1, 'only the original receipt was observed'); assert.equal(p.result.hidden, true);
  p.locale.language = 'en'; p.controller.update(); p.answers.push(receipt('B', 'ready')); await p.controller.start();
  const body = JSON.parse(p.requests.at(-1).options.body); assert.equal(body.language, 'en'); assert.equal(body.note, 'Changed note');
  assert.equal(new URL(p.requests.at(-1).url).searchParams.get('language'), 'en'); assert.equal(p.received.at(-1).id, 'B');
});

test('uncertain transmission retry retains its key; known failed analysis gets a fresh key', async () => {
  const p = harness(); p.answers.push(new TypeError('Offline')); await p.controller.start();
  const firstKey = JSON.parse(p.requests[0].options.body).idempotency_key; assert.equal(p.progress.hidden, true);
  p.answers.push(receipt('FAILED', 'failed')); await p.controller.start();
  assert.equal(JSON.parse(p.requests[1].options.body).idempotency_key, firstKey, 'uncertain network outcome must not double queue');
  p.answers.push(receipt('RETRY', 'ready')); await p.controller.start();
  const nextKey = JSON.parse(p.requests[2].options.body).idempotency_key; assert.notEqual(nextKey, firstKey, 'confirmed failure permits a new analysis');
  p.answers.push(receipt('RETRY', 'ready')); await p.controller.start();
  assert.equal(JSON.parse(p.requests[3].options.body).idempotency_key, nextKey, 'ready result repeat uses backend idempotent replay');
});

test('changing and restoring a failed snapshot still retries with a new analysis key', async () => {
  const p = harness(); p.answers.push(receipt('FAILED', 'failed')); await p.controller.start();
  const failedKey = JSON.parse(p.requests[0].options.body).idempotency_key;
  p.note = 'Temporary edit'; p.controller.update(); p.note = 'Original note'; p.controller.update();
  p.answers.push(receipt('RETRY', 'queued')); await p.controller.start();
  assert.notEqual(JSON.parse(p.requests[1].options.body).idempotency_key, failedKey, 'restoring input must not replay a known failed job');
});

test('polling covers three worker attempts and keeps a readable job ID after its time budget',async()=>{
 const p=harness();p.answers.push(receipt('LONG'));await p.controller.start();
 p.advance(3*240000+2*60000);p.answers.push(receipt('LONG','processing'));await p.poll();
 assert.equal(p.progress.hidden,false);assert.ok([...p.timers.values()].some(t=>t.delay===4000));
 assert.match(p.status.textContent,/Anfrage: LONG/);assert(!p.status.textContent.includes('private-LONG'));
 p.advance(6*60000);p.answers.push(receipt('LONG','processing'));await p.poll();
 assert.equal(p.progress.hidden,true);assert.equal(p.refresh.hidden,false);
 assert.match(p.status.textContent,/erneut abrufen/);assert.match(p.status.textContent,/LONG/);
 assert.equal([...p.timers.values()].some(t=>t.delay===4000),false);
 p.answers.push({...receipt('LONG','ready'),data:{...receipt('LONG','ready').data,answer:'Late result'}});await p.refresh.events.click();
 assert.equal(p.result.hidden,false);assert.match(p.result.innerHTML,/Late result/);
 assert.equal(p.requests.filter(r=>r.options.method==='POST').length,1);
});

test('returning focus resumes an accepted job without submitting another analysis',async()=>{
 const p=harness();p.answers.push(receipt('FOCUS'));await p.controller.start();
 p.advance(21*60000);p.answers.push(receipt('FOCUS','processing'));await p.poll();
 p.answers.push(receipt('FOCUS','processing'));await p.events.focus();
 assert.equal(p.progress.hidden,false);assert.ok([...p.timers.values()].some(t=>t.delay===4000));
 assert.equal(p.requests.filter(r=>r.options.method==='POST').length,1);
 assert.match(p.requests.at(-1).url,/\/status\?/);
});

test('inactive geometry and drawing tabs retain a job but never expose late output until the same input returns',async()=>{
 for(const mode of ['geometry','drawing']){
  const p=harness(mode),geometry=p.geometry,file=new File(['drawing'],'same.png',{type:'image/png'});
  if(mode==='drawing')p.file=file;
  p.answers.push(receipt('TABS'));await p.controller.start();
  let finish;p.answers.push(new Promise(resolve=>{finish=resolve;}));const pending=p.poll();
  if(mode==='geometry')p.geometry=null;else p.file=null;p.controller.update();
  finish({data:{...receipt('TABS','ready').data,answer:'Preserved answer'}});await pending;
  assert.equal(p.received.length,1,'inactive host does not receive an obsolete callback');
  assert.equal(p.result.hidden,true);assert.equal(p.status.hidden,true);
  if(mode==='geometry')p.geometry=geometry;else p.file=file;p.controller.update();
  assert.equal(p.received.length,2);assert.equal(p.result.hidden,false);
  assert.match(p.result.innerHTML,/Preserved answer/);assert.match(p.status.textContent,/TABS/);
  assert.equal(p.requests.filter(r=>r.options.method==='POST').length,1);
 }
});

test('changed geometry after an inactive interval invalidates the retained job',async()=>{
 const p=harness(),geometry=p.geometry;p.answers.push(receipt('STALE','ready'));await p.controller.start();
 p.geometry=null;p.controller.update();geometry.geometrySpec.elements[0].length=24;p.geometry=geometry;p.controller.update();
 assert.equal(p.result.hidden,true);assert.equal(p.refresh.hidden,true);assert.equal(p.status.textContent,'');
 p.answers.push(receipt('FRESH'));await p.controller.start();
 assert.notEqual(JSON.parse(p.requests[0].options.body).idempotency_key,JSON.parse(p.requests[1].options.body).idempotency_key);
});

test('public validation messages identify known fields and never echo raw server errors',async()=>{
 for(const language of I18N.supported){
  const p=harness('geometry',{language});
  p.answers.push({ok:false,status:400,data:{error:'SECRET provider payload',issues:[{path:'rodDiameter',code:'inline_drawing_diameters',message:'SECRET detail'},{path:'rm',code:'invalid_positive_number'},{path:'SECRET path',code:'unrecognized',message:'SECRET detail'}]}});
  await p.controller.start();assert.equal(p.status.hidden,false);
  assert(p.status.textContent.includes(I18N.t('Walzdraht-Ø vor dem Vorzug muss größer als der Draht-Ø an der Presse sein',language)));
  assert(p.status.textContent.includes(I18N.t('Drahtzugfestigkeit Rm an der Presse',language)));
  assert(!p.status.textContent.includes('SECRET'));assert(!p.status.textContent.includes('Dateiformat'));
 }
 const p=harness();p.answers.push({ok:false,status:422,data:{error:'SECRET',issues:[{code:'toString',message:'SECRET'}]}});await p.controller.start();
 assert.equal(p.status.textContent,'Bitte die strukturierte Geometrie und den Drahtprozess prüfen.');
});

test('known processing failures and automatic retries stay readable without provider diagnostics',async()=>{
 for(const language of I18N.supported)for(const [code,expected]of [['model_output_limit','Die KI-Antwort wurde zu umfangreich und konnte nicht vollständig abgeschlossen werden.'],['model_timeout','Die KI-Auswertung hat das Zeitlimit erreicht.'],['service_timeout','Die KI-Auswertung hat das Zeitlimit erreicht.']]){
  const p=harness('geometry',{language}),retry=I18N.t('Die Auswertung wird automatisch erneut versucht.',language);p.answers.push({data:{...receipt('RETRY').data,processingInfo:{attempt:2,failureCode:code,retrying:true,raw:'SECRET'}}});await p.controller.start();
  assert(p.status.textContent.includes(I18N.t(expected,language)));assert(p.status.textContent.includes(retry));
  if(language!=='de')assert.notEqual(I18N.t(expected,language),expected,'diagnostic translation is required');
  p.answers.push({data:{...receipt('RETRY','failed').data,answer:'Public failure summary',processingInfo:{failureCode:code,retrying:false,raw:'SECRET'}}});await p.poll();
  assert.equal(p.result.hidden,false);assert(p.status.textContent.includes(I18N.t(expected,language)));assert(p.status.textContent.includes(I18N.t('Anfrage',language)+': RETRY'));
  assert(!p.status.textContent.includes('SECRET'));assert(!p.status.textContent.includes('private-RETRY'));assert(!p.status.textContent.includes(retry));
 }
});
