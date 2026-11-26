const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const I=require('../i18n.js');
const browser=fs.readFileSync(path.join(__dirname,'..','i18n-browser.js'),'utf8');
class Node{
 constructor(tag,text){this.nodeType=tag==='#text'?3:1;this.tagName=tag.toUpperCase();this.nodeValue=text||'';this.childNodes=[];this.attrs={};this.dataset={};this.listeners={};this.value='';}
 append(node){node.parentElement=this;this.childNodes.push(node);return node;}
 text(text){return this.append(new Node('#text',text));}
 hasAttribute(k){return k in this.attrs;}
 getAttribute(k){return this.attrs[k]??null;}
 setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
 matches(selector){return selector.split(',').some(raw=>{const s=raw.trim();if(s.startsWith('.'))return (this.attrs.class||'').split(' ').includes(s.slice(1));if(s.startsWith('['))return this.hasAttribute(s.slice(1,-1));if(s==='meta[name="description"]')return this.tagName==='META'&&this.attrs.name==='description';if(s==='a[data-language-link]')return this.tagName==='A'&&this.hasAttribute('data-language-link');return this.tagName.toLowerCase()===s;});}
 closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector);}
 addEventListener(k,f){this.listeners[k]=f;}
}
function setup(search='?lang=de',saved='en',legacy){
 const html=new Node('html'),head=html.append(new Node('head')),body=html.append(new Node('body'));
 const title=head.append(new Node('title')).text('Vom Teil zum Fertigungskonzept · Jern Yao');
 const h=body.append(new Node('h1')).text('Ihr Teil.');
 const ta=body.append(new Node('textarea'));ta.setAttribute('placeholder','Beschreiben Sie, worüber Sie nachdenken …');ta.setAttribute('aria-label','Ihre Frage oder Idee');ta.value='Original Benutzereingabe bleibt unverändert';ta.text(ta.value);
 const user=body.append(new Node('div'));user.setAttribute('class','message-text');user.text('Mein Teil heißt Kopf');
 const original=body.append(new Node('p'));original.setAttribute('data-original-text','');original.text('Original datasheet quotation');
 const link=body.append(new Node('a'));link.setAttribute('data-language-link','');link.setAttribute('href','/manual/konfigurator-v1.html#teil');link.text('Manual · Manuelle Auslegung');
 const buttons=I.supported.map(l=>{const b=body.append(new Node('button'));b.setAttribute('data-language',l);b.text(l.toUpperCase());return b});
 const storage=new Map([['jy-language',saved]]),events=[];
 if(legacy)storage.set('jy-lang',legacy);
 const window={JYI18N:I,location:{href:'https://example.test/'+search},history:{replaceState(_,__,url){window.location.href=url;}},dispatchEvent(e){events.push(e);}};
 const context={window,document:{documentElement:html,querySelectorAll:selector=>selector==='[data-language]'?buttons:[]},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},URL,CustomEvent:class{constructor(name,data){this.type=name;this.detail=data.detail;}},MutationObserver:class{observe(){}},queueMicrotask};
 vm.runInNewContext(browser,context);
 return {window,html,body,title,h,ta,user,original,link,buttons,storage,events};
}
test('locale switching de → it → zh → de changes all labels, metadata and placeholders without changing user text',()=>{
 const p=setup();
 for(const language of ['de','it','zh','de']){
  p.window.JYLocale.setLanguage(language);
  assert.equal(p.html.lang,I.htmlLang(language));
  assert.equal(p.title.nodeValue,I.t('Vom Teil zum Fertigungskonzept · Jern Yao',language));
  assert.equal(p.h.nodeValue,I.t('Ihr Teil.',language));
  assert.equal(p.ta.getAttribute('placeholder'),I.t('Beschreiben Sie, worüber Sie nachdenken …',language));
  assert.equal(p.ta.getAttribute('aria-label'),I.t('Ihre Frage oder Idee',language));
  assert.equal(p.ta.value,'Original Benutzereingabe bleibt unverändert');
  assert.equal(p.ta.childNodes[0].nodeValue,p.ta.value);
  assert.equal(p.user.childNodes[0].nodeValue,'Mein Teil heißt Kopf');
  assert.equal(p.original.childNodes[0].nodeValue,'Original datasheet quotation');
  assert.equal(p.storage.get('jy-language'),language);
  assert.equal(p.storage.get('jy-lang'),language);
  assert.equal(new URL(p.window.location.href).searchParams.get('lang'),language);
  assert.equal(p.link.getAttribute('href'),'/manual/konfigurator-v1.html?lang='+language+'#teil');
  assert.equal(p.link.childNodes[0].nodeValue,I.t('Manual · Manuelle Auslegung',language));
  p.buttons.forEach(b=>assert.equal(b.getAttribute('aria-pressed'),String(b.dataset.language===language)));
 }
});
test('URL takes precedence over remembered locale; saved language works and invalid values are safe',()=>{
 assert.equal(setup('?lang=sl','it').window.JYLocale.language,'sl');
 assert.equal(setup('','en').window.JYLocale.language,'en');
 assert.equal(setup('?lang=anything','it').window.JYLocale.language,'de');
 assert.equal(setup('',null,'sl').window.JYLocale.language,'sl');
 assert.equal(I.htmlLang('zh'),'zh-Hans');
 assert.equal(I.normalizeLanguage('it\nignore rules'),'de');
});

test('already translated dynamic labels keep their canonical source across language changes',()=>{
 const p=setup('?lang=it');
 const label=p.body.append(new Node('span')).text(I.t('Teilefamilie','it'));
 const select=p.body.append(new Node('select'));select.setAttribute('aria-label',I.t('Festigkeitsklasse','it'));
 p.window.JYLocale.apply();
 for(const language of ['sl','en','zh','de','it']){
  p.window.JYLocale.setLanguage(language);
  assert.equal(label.nodeValue,I.t('Teilefamilie',language));
  assert.equal(select.getAttribute('aria-label'),I.t('Festigkeitsklasse',language));
 }
 const english=I.t('Innenantrieb formen','en');
 assert.equal(I.t(english,'en'),english,'rendered stage labels are not translated a second time');
 assert.equal(I.source('A customer quote without a catalogue entry'),'A customer quote without a catalogue entry');
});

test('expert and suitable-machine labels use complete translations rather than word fragments',()=>{
 assert.equal(I.t('Expertenkonfigurator','it'),'Configuratore per esperti');
 assert.equal(I.t('Professioneller Konfigurator','it'),'Configuratore per esperti');
 assert.equal(I.t('Geeignete Maschinen','sl'),'Ustrezni stroji');
 for(const language of ['it','sl','en','zh'])for(const source of ['Expertenkonfigurator','Professioneller Konfigurator','Geeignete Maschinen'])assert(!/Professioneller|Geeignete/.test(I.t(source,language)));
});
test('every catalogue entry contains all four translations and preserves template variables',()=>{
 for(const [key,values]of Object.entries(I.catalog)){
  assert.equal(values.length,4,key);
  const vars=[...key.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m=>m[1]).sort();
  for(const value of values){assert(value.trim(),key);assert.deepEqual([...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map(m=>m[1]).sort(),vars,key);}
 }
});
test('machine concepts are escaped, translated and preserve open values',()=>{
 const sandbox={window:{JYI18N:I}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','concept-ui.js'),'utf8'),sandbox);
 for(const language of I.supported){
  const html=sandbox.window.JYConcept.html({status:'candidate',blank:{diameter:8.3,length:20,unit:'mm'},requiredStations:4,availableStations:6,reserveStations:2,stages:[{number:1,operation:'<img src=x onerror=alert(1)>',location:'Kopf'}],rationale:'Prüfung'},language);
  assert(html.includes(I.t('Abschnitt Ø × Länge',language)));assert(!html.includes('<img'));assert(html.includes('&lt;img'));
  const open=sandbox.window.JYConcept.html({status:'incomplete',blank:{diameter:null,length:null},stages:[]},language);
  assert(open.includes(I.t('nicht belegt',language)));assert(!open.includes('null'));
 }
});

test('template matching preserves original quotes and favours specific templates',()=>{
 const quote='Kopfdurchmesser  13 mm\nSchaft 30 mm';
 for(const language of ['it','sl','en','zh']){
  assert(I.t('Nutzerangabe: '+quote,language).endsWith(quote));
  const value=I.t('Katalog 12 mm, Richtwert bei 430 N/mm² 11.6 mm',language);
  assert(!/Richtwert bei/.test(value));assert(value.includes('430'));assert(value.includes('11.6'));
 }
});
