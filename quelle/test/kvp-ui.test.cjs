'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../kvp-ui.js'),'utf8');
const catalog={};for(const file of fs.readdirSync(path.join(__dirname,'..')).filter(f=>/^i18n.*\.json$/.test(f)).sort())Object.assign(catalog,JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8')));
const localeModule={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalog)),localeModule);const I=localeModule.module.exports;
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.events={};this.value='';this.checked=false;this.disabled=false;this._text='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;this._text='';}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join(' ');}
 setAttribute(k,v){this.attributes[k]=String(v);}
 addEventListener(name,fn){this.events[name]=fn;}
}
const initial=()=>({source:'drawing',features:{klasse:'formteil',topologie:'kopf-schaft-napf',merkmale:{d0:8,L0_d0:2,werkstoffgruppe:'unlegiert-weich'}},predictedStages:4,selectedModel:'JBF-10B2S'});
function setup(language='de'){
 let context=initial();const requests=[],answers=[],timers=new Map();let nextTimer=0;
 const view={location:{href:'https://jern-yao.de/'},JYLocale:{language},AbortController,setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id);},async fetch(url,options){requests.push({url,options});const answer=await answers.shift();if(answer instanceof Error)throw answer;assert.ok(answer,'unexpected request');return {ok:answer.status===undefined||answer.status<400,json:async()=>answer.body};}};
 const doc={defaultView:view,documentElement:{lang:language},createElement(tag){return new Element(tag,doc);}},host=new Element('div',doc);
 vm.runInNewContext(source,{window:view,URL});const controller=view.JYKvpUI.create({host,endpoint:'https://api.example.test/',tr:key=>I.t(key,view.JYLocale.language),getContext:()=>context});
 const nodes=()=>{const all=[];const visit=n=>{all.push(n);n.children.forEach(visit);};visit(host);return all;};
 const find=key=>nodes().find(n=>n.dataset.kvpField===key||n.dataset.kvpAction===key);
 const fire=async(key,event='click')=>find(key).events[event]?.({target:find(key)});
 return {host,view,controller,requests,answers,timers,find,fire,get context(){return context;},set context(v){context=v;},async ready(){find('consent').checked=true;await fire('consent','change');find('feedback').value='passt';await fire('feedback','change');}};
}
const ack={body:{accepted:true,status:'ungeprueft',knowledgeEligible:false}};
const approved={body:{status:'ready',cases:[{id:'F-0001',stadien:[{},{}],ergebnis:{status:'laeuft'},text:'PRIVATE_SERVER_TEXT'}]}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('creation and refresh make no requests and consent starts unchecked',async()=>{
 const p=setup();assert.equal(p.find('consent').checked,false);assert.equal(p.find('send').disabled,true);
 p.controller.refresh();await p.fire('send');assert.equal(p.requests.length,0);assert.match(p.host.textContent,/nur auf Wunsch/);
 assert.equal(typeof require('../kvp-ui.js').create,'function');
});

test('explicit feedback sends only the backend whitelist and needs a valid confirmation',async()=>{
 const p=setup();Object.assign(p.context,{customer:'PRIVATE_NAME',drawing:{bytes:'PRIVATE_BYTES'},selectedModel:'PRIVATE_MODEL'});p.context.features.note='PRIVATE_NOTE';p.context.features.merkmale.email='PRIVATE_EMAIL';p.controller.refresh();
 await p.ready();p.find('actualStages').value='5';await p.fire('actualStages','input');p.answers.push(ack);await p.fire('send');
 assert.equal(p.requests.length,1);assert.equal(p.requests[0].url,'https://api.example.test/rueckmeldung');
 const body=JSON.parse(p.requests[0].options.body);assert.ok(!JSON.stringify(body).includes('PRIVATE_'));assert.equal(body.actualStages,5);assert.equal(body.predictedStages,4);assert.equal(body.optIn,true);
 const {prepareFeedback}=await import('../ki-gutachter/src/kvp.js');const {featureVersion,language,...payload}=body;assert.equal(featureVersion,'kvp-v1');assert.equal(language,'de');assert.equal(prepareFeedback(payload).status,'ungeprueft');
 assert.equal(p.requests[0].options.credentials,'omit');assert.equal(p.find('consent').checked,false);assert.match(p.host.textContent,/gespeichert.*ungeprüft/);assert.equal(p.timers.size,0);
 await p.ready();assert.equal(p.find('send').disabled,true,'same feedback cannot be sent twice');
});

test('invalid optional counts and unrecognized technical enums cannot be transmitted',async()=>{
 const p=setup();await p.ready();for(const value of ['2.5','-1','21','PRIVATE']){p.find('actualStages').value=value;await p.fire('actualStages','input');await p.fire('send');assert.equal(p.find('send').disabled,true);}
 assert.match(p.host.textContent,/ganze Stadienzahl/);assert.equal(p.requests.length,0);
 p.context.features.topologie='PRIVATE_EMAIL';p.controller.refresh();assert.equal(p.find('experience').disabled,true);assert.match(p.host.textContent,/fehlen noch vergleichbare/);
});

test('network errors and malformed acknowledgements remain errors and allow a deliberate retry',async()=>{
 const p=setup();await p.ready();p.answers.push({status:400,body:{error:'PRIVATE_SERVER_ERROR'}});await p.fire('send');
 assert.match(p.host.textContent,/konnte nicht gespeichert/);assert.ok(!p.host.textContent.includes('PRIVATE_'));assert.equal(p.find('send').disabled,false);
 p.answers.push({body:{accepted:true,status:'approved',knowledgeEligible:true}});await p.fire('send');assert.match(p.host.textContent,/konnte nicht gespeichert/);
 p.answers.push(ack);await p.fire('send');assert.match(p.host.textContent,/gespeichert.*ungeprüft/);
});

test('experience is an explicit separate query without consent, model or drawing payload',async()=>{
 const p=setup();p.answers.push(approved);await p.fire('experience');
 const r=p.requests[0],body=JSON.parse(r.options.body);assert.equal(r.url,'https://api.example.test/erfahrung');assert.deepEqual(Object.keys(body).sort(),['featureVersion','features','k','language']);
 assert.equal(p.find('consent').checked,false);assert.match(p.host.textContent,/F-0001: 2 Stadien/);assert.ok(!p.host.textContent.includes('PRIVATE_'));
 for(const status of ['missing','pending-approval','ready']){p.answers.push({body:{status,cases:[]}});await p.fire('experience');assert.match(p.host.textContent,/Noch keine bestätigten Vergleichsfälle/);}
 p.answers.push(new Error('PRIVATE_NETWORK'));await p.fire('experience');assert.match(p.host.textContent,/konnten nicht geladen/);
});

test('pending sends cannot duplicate and a new part discards late acknowledgements',async()=>{
 const p=setup(),wait=deferred();await p.ready();p.answers.push(wait.promise);const pending=p.fire('send');await p.fire('send');assert.equal(p.requests.length,1);assert.equal(p.find('feedback').disabled,true);
 p.context.features.merkmale.d0=9;p.controller.refresh();assert.equal(p.requests[0].options.signal.aborted,true);assert.equal(p.find('consent').checked,false);
 wait.resolve(ack);await pending;assert.ok(!p.host.textContent.includes('Rückmeldung gespeichert'));assert.equal(p.find('send').disabled,true);
});

test('model changes and explicit file reset invalidate consent and late experience',async()=>{
 const p=setup(),wait=deferred();await p.ready();p.answers.push(wait.promise);const pending=p.fire('experience');
 p.context.selectedModel='JBF-13B2S';p.controller.refresh();assert.equal(p.find('consent').checked,false);wait.resolve(approved);await pending;assert.ok(!p.host.textContent.includes('F-0001'));
 await p.ready();p.controller.refresh({reset:true});assert.equal(p.find('consent').checked,false);assert.equal(p.requests.length,1);
});

test('all five UI languages translate labels, results and consent without resetting the same context',async()=>{
 const p=setup();await p.ready();
 for(const language of I.supported){p.view.JYLocale.language=language;p.controller.refresh();assert.equal(p.find('consent').checked,true);assert.equal(p.find('send').textContent,I.t('Rückmeldung senden',language));p.answers.push(approved);await p.fire('experience');assert.ok(p.host.textContent.includes(I.t('Betrieb bestätigt',language)));}
 assert.equal(p.requests.length,5);assert.equal(p.requests[4].options.body.includes('"language":"zh"'),true);
 for(const [key,variants]of Object.entries(require('../i18n-p7.json'))){assert.equal(variants.length,4,key);const names=[...key.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();for(const value of variants)assert.deepEqual([...value.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort(),names,key);}
});

test('new nut messages and operations are covered in all four translations',()=>{
 const {nutModel}=require('../nut-model.js'),good={mM:8,mSW:13,mH:8};
 const inputs=[null,{...good,nutShape:'bad'},{...good,mSW:'bad'},{...good,threadPitch:0},{mSW:13},{...good,nutShape:'cap'},{...good,mFlansch:17.9},{...good,mFlansch:17.9,mFlanschH:8},{mSW:13,mH:8},{...good,mLoch:13},{...good,mLoch:8,mFlansch:7,mFlanschH:1},{mSW:1e308,mH:8,mLoch:6},good,{...good,mLoch:5},{mM:10,mSW:16,mH:8.4,threadPitch:1,mLoch:9},{...good,nutShape:'square',mFlansch:20,mFlanschH:1}];
 const messages=new Set(inputs.flatMap(e=>{const r=nutModel(e);return [...r.errors,...r.assumptions,...r.operations];}));
 for(const message of messages)for(const language of ['it','sl','en','zh'])assert.notEqual(I.t(message,language),message,`${language}: ${message}`);
 for(const [key,variants]of Object.entries(require('../i18n-p4.json'))){assert.equal(variants.length,4,key);assert.ok(variants.every(x=>typeof x==='string'&&x.length));}
});
