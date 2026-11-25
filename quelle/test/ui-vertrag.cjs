const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto;
const I18N=require('../i18n.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'ui.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '..', 'vorlage.html'), 'utf8');
// Network-contract tests with an intentionally small DOM double. These check
// state, payloads and rendering data; they do not replace visual browser QA.
class Element {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.events={}; this.dataset={}; this.attributes={}; this.value=''; this.files=[]; this.hidden=false; this.disabled=false; this.textContent=''; this.className=''; this.classList={add(){},remove(){}}; }
  addEventListener(name,fn){(this.events[name] ||= []).push(fn)}
  async emit(name,extra={}){for(const fn of this.events[name]||[]) await fn({preventDefault(){},currentTarget:this,...extra});await new Promise(setImmediate)}
  setCustomValidity(value){this.validationMessage=value}
  click(){}
  setAttribute(key,value){this.attributes[key]=value}
  appendChild(child){child.parent=this;this.children.push(child);return child}
  replaceChildren(){this.children=[]}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  reportValidity(){return this.valid !== false}
  focus(){this.focused=true}
  scrollIntoView(){}
}
function harness(base='https://api.example.test',language='de') {
  const nodes = new Map();
  for (const match of template.matchAll(/id="([^"]+)"/g)) { assert(!nodes.has(match[1]), 'duplicate id '+match[1]); nodes.set(match[1],new Element()); }
  nodes.get('consent').checked=true;
  const tabs=['upload','description','chat'].map(mode=>{const el=nodes.get('tab-'+mode);el.dataset.mode=mode;return el});
  const questions=[new Element()];questions[0].dataset.question='Wie entsteht die Stadienfolge?';
  const requests=[]; const answers=[];
  const document={getElementById(id){assert(nodes.has(id),'unknown id '+id);return nodes.get(id)},createElement(tag){return new Element(tag)},querySelectorAll(selector){return selector==='[data-mode]'?tabs:selector==='[data-question]'?questions:[]}};
  const locale={language,t:text=>I18N.t(text,locale.language),apply(){},autonyms:{de:'Deutsch',it:'Italiano',sl:'Slovenščina',en:'English',zh:'简体中文'}};
  const context={document,window:{JYI18N:I18N,JYLocale:locale,JYConcept:{html:()=>'<section>concept</section>'},JY_API_BASE:base,location:{href:'https://jern-yao.de/'},setTimeout(){return 1},clearTimeout(){},addEventListener(){}},URL,URLSearchParams,FormData,AbortController,TextEncoder,crypto,TypeError,fetch:async(url,options)=>{requests.push({url,options});const answer=answers.shift();if(answer instanceof Error)throw answer;if(!answer)throw new Error('Unmocked API call');return {ok:answer.ok!==false,status:answer.status||200,json:async()=>answer.data}}};
  vm.runInNewContext(source,context);
  return {nodes,tabs,questions,requests,answers,locale,get:id=>nodes.get(id)};
}
const flattened = node => node.textContent+' '+node.children.map(flattened).join(' ');
(async()=>{
  for(const language of I18N.supported){
    const translated=harness('https://api.example.test',language);translated.get('email').value='test@example.invalid';translated.get('description').value='Originaltext';translated.answers.push({data:{id:'LANG-'+language,token:'test',status:'queued'}});await translated.get('request-form').emit('submit');
    assert.equal(translated.requests[0].options.body.get('language'),language);assert.equal(new URL(translated.requests[0].url).searchParams.get('language'),language);assert.equal(translated.get('request-message').textContent,I18N.t('Ihre Anfrage ist angekommen.',language));
    translated.get('chat-input').value='Original question';translated.answers.push({data:{answer:'Model reply',language}});await translated.get('chat-form').emit('submit');assert.equal(JSON.parse(translated.requests.at(-1).options.body).language,language);
  }
  for(const language of I18N.supported){const invalid=harness('https://api.example.test',language);invalid.get('email').value='bad';invalid.get('consent').checked=false;await invalid.get('request-form').emit('submit');assert.equal(invalid.requests.length,0);assert.equal(invalid.get('email').validationMessage,I18N.t('Bitte geben Sie eine gültige E-Mail-Adresse ein.',language));assert.equal(invalid.get('consent').validationMessage,I18N.t('Bitte stimmen Sie der Verarbeitung Ihrer Anfrage zu.',language));}
  const offline=harness('');
  assert.equal(offline.get('availability').hidden,false);
  assert.equal(offline.get('request-submit').disabled,true);
  assert.equal(offline.get('chat-submit').disabled,true);
  assert.equal(offline.requests.length,0);
  await offline.tabs[1].emit('click');
  assert.equal(offline.get('upload-area').hidden,true);
  assert.equal(offline.get('description-help').hidden,false);
  await offline.tabs[2].emit('click');
  assert.equal(offline.get('panel-anfrage').hidden,true);
  assert.equal(offline.get('panel-chat').hidden,false);

  const live=harness();
  await live.get('request-form').emit('submit');
  assert.equal(live.requests.length,0,'empty requests blocked');
  live.get('email').value='test@example.invalid';
  live.get('description').value='Hülse Ø12, Bohrung Ø6, Länge25 mm; Werkstoff offen.';
  live.answers.push(new TypeError('Offline'));
  await live.get('request-form').emit('submit');
  assert.match(live.get('request-message').textContent,/Verbindung/);
  const firstKey=live.requests[0].options.body.get('idempotency_key');
  live.answers.push({data:{id:'DEMO-1',token:'test-token',status:'queued',notificationStatus:'pending'}});
  await live.get('request-form').emit('submit');
  assert.equal(live.requests[1].options.body.get('idempotency_key'),firstKey,'retry retains idempotency');
  assert.equal(live.requests[1].options.body.has('datei'),false,'text-only request accepted');
  assert.equal(live.requests[1].options.body.has('eingaben'),false,'no engine data needed');
  assert.match(live.get('request-message').textContent,/angekommen/);
  assert.doesNotMatch(live.get('notification').textContent,/wurde per E-Mail/,'pending must not claim sent');
  live.answers.push({data:{status:'ready',answer:'Konzept für das Teil',questions:['Welcher Werkstoff?'],notificationStatus:'sent',proposal:{input:[{field:'Länge',value:25,unit:'mm',reference:'Beschreibung'}],stages:[{number:1,operation:'Vorformen',force_t:8,rule:'R-ST1'}],machines:[{model:'JNP-10B6S',status:'offen',priceEUR:100000,criteria:[{criterion:'Stufen',required:6,available:6,rule:'R-STN'}]}],rules:[{id:'R-STN',text:'Stationen',type:'Regel'}],assumptions:['Werkstoff noch offen']},sources:[{label:'Katalog',url:'https://www.jernyao.com/'}]}});
  await live.get('refresh-status').emit('click');
  assert.match(flattened(live.get('result-content')),/Welcher Werkstoff/);
  assert.match(flattened(live.get('result-content')),/JNP-10B6S/);
  assert.match(live.get('notification').textContent,/wurde per E-Mail/);

  live.get('chat-input').value='Wie funktioniert Wenden?';
  live.answers.push({data:{answer:'Transfer und Länge zusammen prüfen.',questions:['Wie lang ist das Teil?'],sources:[{label:'Unsichere URL',url:'javascript:alert(1)'},{label:'Katalog',url:'https://www.jernyao.com/'}]}});
  await live.get('chat-form').emit('submit');
  const chatBody=JSON.parse(live.requests.at(-1).options.body);
  assert.equal(chatBody.requestId,'DEMO-1'); assert.equal(chatBody.token,'test-token');
  assert.equal(live.get('chat-input').value,'');
  const sourceList=live.get('messages').children[1].children.at(-1);
  assert.equal(sourceList.children[0].children.length,0,'dangerous source URI not linked');
  assert.equal(sourceList.children[1].children[0].tagName,'a');

  const freeChat=harness();
  freeChat.get('chat-input').value='Ein Konzept ohne Zeichnung';
  freeChat.answers.push({data:{answer:'Beschreiben Sie Ihr Teil.'}});
  await freeChat.get('chat-form').emit('submit');
  assert.equal(JSON.parse(freeChat.requests[0].options.body).requestId,undefined,'chat without enquiry');
  await freeChat.get('chat-to-request').emit('click');
  assert.match(freeChat.get('description').value,/Konzept ohne Zeichnung/);

  const longChat=harness();
  for(let turn=0;turn<8;turn++){
    longChat.get('chat-input').value='\u{1F527}'.repeat(4000);
    longChat.answers.push({data:{answer:'\u{1F529}'.repeat(4000)}});
    await longChat.get('chat-form').emit('submit');
    assert(Buffer.byteLength(longChat.requests.at(-1).options.body,'utf8')<=60000,'long multibyte chat stays below body limit');
  }
  assert(JSON.parse(longChat.requests.at(-1).options.body).history.length<12,'oldest history is bounded');

  const unconfirmed=harness();
  unconfirmed.get('email').value='test@example.invalid';unconfirmed.get('description').value='Eine Hülse';
  unconfirmed.answers.push({data:{status:'queued'}});
  await unconfirmed.get('request-form').emit('submit');
  assert.doesNotMatch(unconfirmed.get('request-message').textContent,/angekommen/,'2xx without receipt must not claim success');
  assert.match(unconfirmed.get('request-message').textContent,/nicht eindeutig bestätigt/);

  const provenanceUI=harness('https://api.example.test','en');
  provenanceUI.get('email').value='test@example.invalid';provenanceUI.get('description').value='Original';
  provenanceUI.answers.push({data:{id:'PROVENANCE',token:'test-token',status:'queued'}});
  await provenanceUI.get('request-form').emit('submit');
  const originalQuote='Kopfdurchmesser  13 mm\nSchaft 30 mm';
  const originalReference='Nutzerangabe: '+originalQuote;
  for(const language of ['en','it','zh']){
    provenanceUI.locale.language=language;
    provenanceUI.answers.push({data:{status:'ready',notificationStatus:'sent',proposal:{input:[{field:'kD',value:13,unit:'mm',origin:'user_text',reference:originalReference}]}}});
    await provenanceUI.get('refresh-status').emit('click');
    const content=provenanceUI.get('result-content');
    const facts=content.children.find(node=>node.className==='proposal-grid');
    const detail=facts.children[0].children[2];
    const reference=detail.children.at(-1);
    assert.equal(reference.textContent,I18N.t(originalReference,language),'full reference template localized once');
    assert(reference.textContent.endsWith(originalQuote),'customer quote retains wording and whitespace');
    assert.equal(reference.dataset.originalText,'','DOM translation must skip original quote span');
    assert.equal(detail.children[0].textContent,I18N.t('Ihre Beschreibung',language),'origin label is localized separately');
  }

  const unavailable=harness(); unavailable.get('email').value='test@example.invalid'; unavailable.get('description').value='Ein Teil';
  unavailable.answers.push({ok:false,status:503,data:{error:'not configured'}});
  await unavailable.get('request-form').emit('submit');
  assert.doesNotMatch(unavailable.get('request-message').textContent,/angekommen/);
  assert.equal(unavailable.get('request-submit').disabled,false,'retry available');
  unavailable.get('file').files=[{name:'x.exe',size:10,lastModified:0}];await unavailable.get('file').emit('change');
  assert.equal(unavailable.get('request-submit').disabled,true,'unsupported file blocked');
  unavailable.get('file').files=[{name:'x.pdf',size:16*1024*1024,lastModified:0}];await unavailable.get('file').emit('change');
  assert.match(unavailable.get('file-error').textContent,/größer/);
  unavailable.get('file').files=[{name:'x.step',size:100,lastModified:0}];await unavailable.get('file').emit('change');
  assert.match(unavailable.get('file-name').textContent,/CAD-Anhang/);

  for(const token of ['/*DATEN*/','/*PRAXIS*/','/*ENGINE*/','/*UI*/'])assert.equal(template.split(token).length,2,'build placeholder '+token);
  const privacy=template.match(/<details id="datenschutz">([\s\S]*?)<\/details>/)[1];
  for(const term of ['30 Tage','privaten Cloudflare-Speicher','Anthropic','Resend','CAD-Dateien werden nicht automatisch gelesen'])assert(privacy.includes(term),'privacy statement: '+term);
  assert.doesNotMatch(privacy,/nichts gespeichert|speichert keine Eingaben/);
  assert.match(template,/<input[^>]*id="consent"[^>]*required/);
  assert.match(template,/<input[^>]*id="email"[^>]*required/);
  assert.match(template,/<textarea[^>]*id="chat-input"[^>]*maxlength="8000"/);
  console.log('PASS: offline mode, tabs, text-only request, retry idempotency, verified receipt vs mail status, proposal/questions/sources, safe source links, standalone chat, bounded multibyte history, chat-to-request, 503, file types/size, privacy, unique IDs and build placeholders.');
})().catch(error=>{console.error(error);process.exitCode=1});
