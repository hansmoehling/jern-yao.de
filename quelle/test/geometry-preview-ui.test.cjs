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
  const requests = [], answers = [], received = [], chosen = [], timers = new Map(); let nextTimer = 0, invalidations = 0;
  let geometry = { geometrySpec: { version: 1, coordinateSystem: 'tool-parting-plane', elements: [{ id: 'body', operation: 'add', shape: 'cylinder', side: 'die', start: 0, length: 12, diameter: 8 }], trimming: [] }, material: 'C10C', d0: 8 };
  let note = 'Original note',file=null;
  const locale = { language, t: value => I18N.t(value,locale.language) };
  const window = { JYAnswerFormat: require('../answer-format.js'), JYLocale: locale, JYI18N: I18N, JY_API_BASE: 'https://api.example.test', JY_SHOW_PRICES: showPrices, location: { href: 'https://jernyao.de/konfigurator/' }, setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; }, clearTimeout(id) { timers.delete(id); } };
  const context = { window, URL, URLSearchParams, FormData, AbortController, crypto, Uint8Array, TypeError, fetch: async (url, options) => { requests.push({ url, options }); const answer = await answers.shift(); if (answer instanceof Error) throw answer; assert(answer, 'unexpected API request'); return { ok: answer.ok !== false, status: answer.status || 200, json: async () => answer.data }; } };
  vm.runInNewContext(source, context);
  const controller = window.JYDrawingPreview.create({ ...nodes, ...(mode==='drawing'?{getFile:()=>file,showWhenEmpty:true}:{getGeometry:()=>geometry}), getNote: () => note, canChooseMachine:model=>models.includes(model), onChooseMachine:model=>chosen.push(model), onInvalidate: () => invalidations++, onResult: data => received.push(data) });
  return { ...nodes, controller, locale, requests, answers, received, chosen, timers, get invalidations() { return invalidations; }, get geometry() { return geometry; }, set geometry(value) { geometry = value; }, set note(value) { note = value; },set file(value){file=value;}, async poll() { const entry = [...timers].find(([, item]) => item.delay === 4000); assert(entry, 'expected status poll'); timers.delete(entry[0]); await entry[1].fn(); } };
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
