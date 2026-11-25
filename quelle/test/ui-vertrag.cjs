const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto').webcrypto;
// Use the source catalogues so these checks also cover translations before a build.
const catalogue={};
for(const name of fs.readdirSync(path.join(__dirname,'..')).filter(name=>/^i18n-.*\.json$/.test(name)).sort())Object.assign(catalogue,JSON.parse(fs.readFileSync(path.join(__dirname,'..',name),'utf8').replace(/^\uFEFF/,'')));
const translationModule={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalogue)),translationModule);
const I18N=translationModule.module.exports;
const source = fs.readFileSync(path.join(__dirname, '..', 'ui.js'), 'utf8');
const template = fs.readFileSync(path.join(__dirname, '..', 'vorlage.html'), 'utf8');
// Network-contract tests with an intentionally small DOM double. These check
// state, payloads and rendering data; they do not replace visual browser QA.
class Element {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.events={}; this.dataset={}; this.attributes={}; this.value=''; this.files=[]; this.hidden=false; this.open=false; this.disabled=false; this.textContent=''; this.className=''; this.classList={add(){},remove(){}}; }
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
  scrollIntoView(options){this.scrollOptions=options}
}
function harness(base='https://api.example.test',language='de',showPrices) {
  const nodes = new Map();
  for (const match of template.matchAll(/id="([^"]+)"/g)) { assert(!nodes.has(match[1]), 'duplicate id '+match[1]); nodes.set(match[1],new Element()); }
  nodes.get('consent').checked=true;
  nodes.get('daten').textContent=fs.readFileSync(path.join(__dirname,'..','maschinen.json'),'utf8');
  Object.defineProperty(nodes.get('file'),'value',{get(){return this._value||''},set(value){this._value=value;if(value==='')this.files=[]}});
  const tabs=['upload','chat'].map(mode=>{const el=nodes.get('tab-'+mode);el.dataset.mode=mode;return el});
  const questions=[new Element()];questions[0].dataset.question='Wie entsteht die Stadienfolge?';
  const requests=[]; const answers=[]; const events={}; const timers=new Map();let timerId=0;
  const document={getElementById(id){assert(nodes.has(id),'unknown id '+id);return nodes.get(id)},createElement(tag){return new Element(tag)},createTextNode(text){const node=new Element('#text');node.textContent=text;return node},querySelectorAll(selector){return selector==='[data-mode]'?tabs:selector==='[data-question]'?questions:[]}};
  const locale={language,t:text=>I18N.t(text,locale.language),apply(){},autonyms:{de:'Deutsch',it:'Italiano',sl:'Slovenščina',en:'English',zh:'简体中文'}};
  const context={document,window:{JYAnswerFormat:require('../answer-format.js'),JYI18N:I18N,JYLocale:locale,JYConcept:{html:()=>'<section>concept</section>'},JY_API_BASE:base,location:{href:'https://jern-yao.de/'},setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId},clearTimeout(id){timers.delete(id)},addEventListener(name,fn){(events[name] ||= []).push(fn)}},URL,URLSearchParams,FormData,AbortController,TextEncoder,crypto,TypeError,fetch:async(url,options)=>{requests.push({url,options});const answer=await answers.shift();if(answer instanceof Error)throw answer;if(!answer)throw new Error('Unmocked API call');return {ok:answer.ok!==false,status:answer.status||200,json:async()=>answer.data}}};
  if(showPrices!==undefined)context.window.JY_SHOW_PRICES=showPrices;
  vm.runInNewContext(source,context);
  return {nodes,tabs,questions,requests,answers,locale,events,timers,get:id=>nodes.get(id),async runTimer(delay=4000){const timer=[...timers].find(([,value])=>value.delay===delay);assert(timer,'expected scheduled timer '+delay);timers.delete(timer[0]);await timer[1].fn();await new Promise(setImmediate)}};
}
const flattened = node => node.textContent+' '+node.children.map(flattened).join(' ');
const descendants = node => [node,...node.children.flatMap(descendants)];
const quoteButtons = node => descendants(node).filter(item=>item.tagName==='button'&&item.className==='quote-button');
(async()=>{
  for(const language of I18N.supported){
    const p=harness('https://api.example.test',language,false);
    assert.equal(p.tabs.length,2);assert.equal(p.get('contact-details').open,false);
    assert.equal(p.get('request-submit').disabled,true);
    p.get('email').value='test@example.invalid';p.get('description').value='Notiz ohne Zeichnung';
    await p.get('request-form').emit('input');await p.get('request-form').emit('submit');
    assert.equal(p.requests.length,0,'notes cannot replace a drawing or a selected catalogue model');
    p.get('contact-details').open=false;
    for(const name of ['original.pdf','part.step']){
      const drawing=new File(['ORIGINAL DRAWING BYTES'],name,{type:name.endsWith('pdf')?'application/pdf':'application/octet-stream'});
      p.get('file').files=[drawing];await p.get('file').emit('change');
      const before=p.requests.length;
      assert.equal(p.get('file-actions').hidden,false);assert.equal(p.get('open-contact').disabled,false);
      await p.get('open-contact').emit('click');
      assert.equal(p.get('contact-details').open,true);assert.equal(p.get('email').focused,true);
      assert.equal(p.requests.length,before,'contact button does not upload or start AI');
      assert.equal(p.get('file').files[0],drawing);
      p.answers.push({data:{id:'MAIL-'+name,token:'private-mail',kind:'enquiry',status:'received',notificationStatus:'pending'}});
      await p.get('request-form').emit('submit');
      const sent=p.requests.at(-1);assert.match(sent.url,/\/anfrage\?/);
      assert.equal(sent.options.body.get('datei').name,name);assert.equal(await sent.options.body.get('datei').text(),'ORIGINAL DRAWING BYTES');
      assert.equal(sent.options.body.get('notiz'),'Notiz ohne Zeichnung');assert.equal(sent.options.body.get('consent'),'true');
      assert.equal(sent.options.body.get('language'),language);assert.equal(sent.options.body.get('pricePolicy'),'technical-only');
      assert.equal(p.get('request-mail-status').textContent,I18N.t('Die Benachrichtigung an Hans Möhling ist noch in Bearbeitung.',language));
      assert.equal(p.get('request-submit').disabled,true);
      await p.get('request-form').emit('submit');assert.equal(p.requests.length,before+1,'received enquiry is not resubmitted');
      p.answers.push({data:{kind:'enquiry',status:'received',notificationStatus:'sent',answer:'MUST NOT RENDER ANALYSIS',proposal:{machines:[{model:'JBF-10B2S'}]}}});
      await p.get('request-refresh').emit('click');
      assert.equal(p.get('request-mail-status').textContent,I18N.t('Hans Möhling wurde per E-Mail über Ihre Anfrage informiert.',language));
      assert.equal(p.get('request-refresh').hidden,true);assert.equal(p.get('messages').children.length,0);
      p.get('contact-details').open=false;
    }
    p.get('chat-input').value='Was ist Rückwärtsfließpressen?';p.answers.push({data:{answer:'**Fachantwort**\n\n- Werkzeug\n- Ablauf'}});
    await p.get('chat-form').emit('submit');
    const chat=JSON.parse(p.requests.at(-1).options.body);
    assert.deepEqual(Object.keys(chat).sort(),['history','language','message','pricePolicy']);
    assert.equal(chat.message,'Was ist Rückwärtsfließpressen?');assert.deepEqual(chat.history,[]);
    assert(!JSON.stringify(chat).includes('private-mail'));assert(!JSON.stringify(chat).includes('ORIGINAL DRAWING'));
    assert.equal(descendants(p.get('messages')).filter(n=>n.tagName==='strong').length,1,'chat remains safely formatted');
    const count=p.requests.length;await p.get('remove-file').emit('click');
    assert.equal(p.requests.length,count);assert.equal(p.get('file-actions').hidden,true);
    assert(flattened(p.get('messages')).includes('Fachantwort'),'mail attachment changes do not reset the independent chat');
    assert(!p.requests.some(r=>/\/(?:preview|geometry-preview)\b/.test(r.url)));
  }
  {
    const p=harness();p.get('chat-input').value='Was ist Rückwärtsfließpressen?';p.answers.push({data:{answer:'Allgemeine Fachantwort'}});
    await p.get('chat-form').emit('submit');assert.equal(p.requests.length,1,'general technical questions need no drawing');
    await p.get('chat-to-request').emit('click');assert.equal(p.get('contact-details').open,true);assert.equal(p.get('email').focused,true);
    assert.equal(p.get('request-submit').disabled,true,'chat transfer still needs drawing or an explicit model');assert.equal(p.requests.length,1);
    p.get('chat-input').value='Angebot für JBF-10B2S';p.answers.push({data:{answer:'Modell',proposal:{machines:[{model:'JBF-10B2S',status:'offen'}]}}});await p.get('chat-form').emit('submit');
    await quoteButtons(p.get('messages')).at(-1).emit('click');assert.equal(p.get('contact-details').open,true);assert.equal(p.get('request-submit').disabled,false);
    p.get('description').value='Bitte ein Angebot mit Lieferzeit.';await p.get('request-form').emit('input');
    assert.equal(p.get('selected-machine').hidden,false,'notes on a direct model enquiry retain its explicit selection');
    p.get('email').value='test@example.invalid';p.answers.push({data:{id:'MACHINE-MAIL',token:'private',kind:'enquiry',status:'received',notificationStatus:'sent'}});
    await p.get('request-form').emit('submit');const data=p.requests.at(-1).options.body;
    assert.equal(data.has('datei'),false);assert.equal(data.get('notiz'),'Anfrage für JBF-10B2S\n\nBitte ein Angebot mit Lieferzeit.');
  }
  assert.equal((template.match(/type="file"/g)||[]).length,1,'one central file input');
  assert.equal((template.match(/type="file"/g)||[]).length,1);
  assert(!template.includes('tab-description'));
  assert.match(template,/<a class="expert-configurator-button" data-language-link href="\/manual\/konfigurator-v1\.html">Expertenkonfigurator: Schrauben, Formteile, Muttern<\/a>/);
  assert.match(template,/<details id="contact-details" class="contact-details">/);
  assert.match(template,/<details class="approach" id="ansatz"><summary>Wie die Auslegung arbeitet<\/summary>/);
  assert.match(template,/<button type="button" class="primary" id="open-contact">Anfrage an Hans senden<\/button>/);
  for(const obsolete of ['preview-start','preview-progress','preview-cad-help','result-content','refresh-status','continue-chat'])assert(!template.includes('id="'+obsolete+'"'),'obsolete frontpage element removed: '+obsolete);
  assert.doesNotMatch(source,/\/preview|previewRevision|previewBusy|body\.requestId|body\.token/,'frontpage has no drawing-analysis controller or chat attachment identity');
  for(const marker of ['/*PROGRAMME_CSS*/','<!--PROGRAMME_SECTION-->'])assert.equal(template.split(marker).length,2);
  for(const language of I18N.supported){
    const p=harness('https://api.example.test',language);
    const file=new File([new Uint8Array(2048)],'Zeichnung Anfrage senden.pdf',{type:'application/pdf'});
    const ready=()=>{
      assert.equal(p.get('file-summary').hidden,false);assert.equal(p.get('file-summary').dataset.state,'ready');
      assert.equal(p.get('file-state-icon').textContent,'✓');assert.equal(p.get('file-status').textContent,I18N.t('Datei bereit zum Absenden',language));
      assert.equal(p.get('file-name').textContent,file.name+' · 2 KB');assert.equal(p.get('file-name').dataset.originalText,'','filename is never translated');
      assert.equal(p.get('file-error').hidden,true);assert.equal(p.get('file').attributes['aria-invalid'],'false');
      assert.equal(p.requests.length,0,'file selection does not upload, submit or start AI analysis');
    };
    const remove=async()=>{
      await p.get('remove-file').emit('click');
      assert.equal(p.get('file').files.length,0);assert.equal(p.get('file-summary').hidden,true);
      assert.equal(p.get('file-summary').dataset.state,'');assert.equal(p.get('file-state-icon').textContent,'');
      assert.equal(p.get('file-status').textContent,'');assert.equal(p.get('file-name').textContent,'');assert.equal(p.get('file-error').hidden,true);
    };
    p.get('file').files=[file];await p.get('file').emit('change');ready();
    await remove();await p.get('drop-zone').emit('drop',{dataTransfer:{files:[file]}});ready();
    for(const bad of [{name:'x.exe',size:10},{name:'empty.pdf',size:0},{name:'large.pdf',size:16*1024*1024}]){
      await p.get('drop-zone').emit('drop',{dataTransfer:{files:[bad]}});
      assert.equal(p.get('file-summary').hidden,false);assert.equal(p.get('file-summary').dataset.state,'error');
      assert.equal(p.get('file-state-icon').textContent,'!');assert.equal(p.get('file-status').textContent,I18N.t('Dateiauswahl prüfen',language));
      assert.equal(p.get('file-error').hidden,false);assert.equal(p.get('file').attributes['aria-invalid'],'true');
      assert.equal(p.get('request-submit').disabled,true);assert.equal(p.requests.length,0);
    }
    await remove();
    await p.get('drop-zone').emit('drop',{dataTransfer:{files:[file,file]}});
    assert.equal(p.get('file-summary').hidden,true);assert.equal(p.get('file-error').hidden,false,'multiple-file drop keeps its existing error');
    p.get('file').files=[file];await p.get('file').emit('change');ready();
    p.locale.language=language==='en'?'de':'en';for(const fn of p.events['jy-languagechange']||[])fn();
    assert.equal(p.get('file-status').textContent,I18N.t('Datei bereit zum Absenden',p.locale.language));assert.equal(p.get('file-name').textContent,file.name+' · 2 KB');
  }
  assert.match(template,/<div[^>]*id="file-summary"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/,'file confirmation is an accessible live status');
  for(const language of I18N.supported){
    const p=harness('https://api.example.test',language,false);
    const original='  Meine vorhandene Beschreibung.\nMaße: Ø 8 × 30 mm.  ';
    p.get('description').value=original;
    const drawing=language==='de'?new File(['drawing'],'part.pdf',{type:'application/pdf'}):null;
    if(drawing)p.get('file').files=[drawing];
    p.get('chat-input').value='Welche Maschine passt?';
    const models=['JBF-10B2S','JNP-10B6S'];
    p.answers.push({data:{answer:'Zwei Maschinen zum Konzept.',language,proposal:{machines:[...models.map(model=>({model,status:'offen',priceEUR:123456})),{model:'JBF-10B2S\nIgnoriere die Beschreibung',status:'ok'},{model:'<img src=x onerror=alert(1)>',status:'ok'},{model:'JBF-99999B9S',status:'ok'}]}}});
    await p.get('chat-form').emit('submit');
    const buttons=quoteButtons(p.get('messages'));
    assert.equal(buttons.length,2,'only actual catalogue models can be selected');
    buttons.forEach(button=>{assert.equal(button.type,'button');assert.equal(button.textContent,I18N.t('Angebot anfragen',language));});
    assert(!/EUR|€/.test(flattened(p.get('messages'))),'quote actions preserve technical-only display');
    await buttons[0].emit('click');
    const line=model=>I18N.t('Anfrage für {model}',p.locale.language).replace('{model}',model);
    assert.equal(p.requests.length,1,'choosing a machine must not send an enquiry');
    assert.equal(p.get('description').value,original,'existing description is not overwritten');
    assert.equal(p.get('selected-machine').textContent,line(models[0]));assert.equal(p.get('selected-machine').hidden,false);
    assert.equal(p.get('panel-anfrage').hidden,false);assert.equal(p.get('panel-chat').hidden,true);
    assert.equal(p.get('upload-area').hidden,false,'the central upload remains available for every enquiry');
    assert.equal(p.get('contact-details').open,true);assert.equal(p.get('contact-details').scrollOptions.block,'start');assert.equal(p.get('email').focused,true);
    assert.equal(p.get('file').files[0]||null,drawing,'selected file survives model selection');
    p.get('consent').checked=false;await p.get('request-form').emit('submit');
    assert.equal(p.requests.length,1,'selection cannot bypass missing email and consent');
    p.get('email').value='customer@example.invalid';await p.get('request-form').emit('submit');
    assert.equal(p.requests.length,1,'selection cannot bypass consent');
    p.get('consent').checked=true;p.answers.push(new TypeError('Offline'));
    await p.get('request-form').emit('submit');
    const first=p.requests.at(-1).options.body,key=first.get('idempotency_key');
    assert.equal(first.get('notiz'),line(models[0])+'\n\n'+original.trim());
    assert.equal(first.get('pricePolicy'),'technical-only');
    assert.equal(first.has('datei'),!!drawing);
    if(drawing)assert.equal(first.get('datei').name,drawing.name);
    p.answers.push({data:{id:'QUOTE-'+language,token:'test-token',kind:'enquiry',status:'received',notificationStatus:'sent'}});
    await p.get('request-form').emit('submit');
    assert.equal(p.requests.at(-1).options.body.get('idempotency_key'),key,'same selection retries with the same key');
    assert.equal(p.get('request-submit').disabled,true,'received selection cannot be resubmitted unchanged');
    await buttons[0].emit('click');assert.equal(p.get('request-submit').disabled,true,'reselecting the same machine stays idempotent');
    await buttons[1].emit('click');
    assert.equal(p.get('request-submit').disabled,false,'a different machine changes the request signature');
    assert.equal(p.get('selected-machine').textContent,line(models[1]));assert.equal(p.get('description').value,original);
    p.answers.push({data:{id:'QUOTE-SECOND-'+language,token:'test-token',kind:'enquiry',status:'received',notificationStatus:'sent'}});
    await p.get('request-form').emit('submit');
    const second=p.requests.at(-1).options.body;
    assert.notEqual(second.get('idempotency_key'),key);assert.equal(second.get('notiz'),line(models[1])+'\n\n'+original.trim());
    await p.get('email-fallback').emit('click');
    const mailBody=new URL(p.get('email-fallback').href).searchParams.get('body');
    assert(mailBody.includes(line(models[1])+'\n\n'+original.trim()));assert(!mailBody.includes(models[0]),'fallback contains only the current machine');
    assert.equal(p.get('description').value,original);
    p.locale.language=language==='en'?'de':'en';
    for(const fn of p.events['jy-languagechange']||[])fn();
    assert.equal(p.get('selected-machine').textContent,line(models[1]),'language change preserves and relabels the selected model');
    assert.equal(p.get('description').value,original,'language change preserves customer text');
  }
  {
    for(const longHistory of [false,true]){
      const p=harness('https://api.example.test','de',false);
      const questions=['Hülse: außen Ø 12 mm, innen Ø 6 mm, Länge 25 mm.','Jahresbedarf 200000 Stück. Welche Maschine passt?'].map(text=>longHistory?text.padEnd(7000,'x'):text);
      for(const question of questions){
        p.get('chat-input').value=question;
        p.answers.push({data:{answer:'KI-Annahme: nicht vom Kunden bestätigte Werkstoffangabe.',proposal:{machines:[{model:'JBF-10B2S',status:'offen'}]}}});
        await p.get('chat-form').emit('submit');
      }
      assert.equal(p.get('description').value,'');
      await quoteButtons(p.get('messages')).at(-1).emit('click');
      const copied=questions.join('\n\n').slice(0,12000);
      assert.equal(p.get('description').value,copied,'standalone quote carries original user dimensions and requirements');
      assert(!copied.includes('KI-Annahme'),'assistant claims are excluded from the request description');
      assert.equal(p.requests.length,2,'copying chat context does not send the enquiry');
      if(longHistory)assert.equal(p.get('description').value.length,12000,'copied context respects the form limit');
      p.get('email').value='customer@example.invalid';p.answers.push({data:{id:'CHAT-CONTEXT-QUOTE',token:'test-token',kind:'enquiry',status:'received',notificationStatus:'sent'}});
      await p.get('request-form').emit('submit');
      const note=p.requests.at(-1).options.body.get('notiz');
      assert.equal(note,'Anfrage für JBF-10B2S\n\n'+copied);
      assert(!note.includes('KI-Annahme'),'only user history is sent to Hans');
    }
  }
  for(const language of I18N.supported){
    for(const flag of [undefined,true,false]){
      const p=harness('https://api.example.test',language,flag),priced=flag!==false;
      const proposal={machines:[
        {model:'MODEL-FIXED',status:'offen',priceEUR:123456,criteria:[{criterion:'Stationen',required:4,available:5}],openPoints:[{owner:'Jern Yao',detail:'Auswerfer Matrize (KO)'}]},
        {model:'MODEL-RANGE',status:'ok',priceRangeEUR:[234567,345678]}
      ]};
      const assertPricePolicy=(node,channel)=>{
        const text=flattened(node);
        assert(text.includes('MODEL-FIXED')&&text.includes('MODEL-RANGE'),channel+' retains both machine recommendations');
        assert(text.includes(I18N.t('Stationen',language)),channel+' retains technical criteria');
        assert(text.includes(I18N.t('Auswerfer Matrize (KO)',language)),channel+' retains open machine questions');
        assert.equal(/EUR|€/.test(text),priced,language+' '+channel+' currency');
        const all=node=>[node,...node.children.flatMap(all)];
        const priceRows=all(node).filter(item=>item.tagName==='dd'&&item.className==='small');
        assert.equal(priceRows.length,priced?2:0,language+' '+channel+' fixed price and price range');
        if(!priced){assert(!text.includes(I18N.t('Richtpreis',language)));assert(!text.includes(I18N.t('Preisspanne',language)));}
      };
      p.get('email').value='customer@example.invalid';p.get('description').value='Hülse Ø12, Länge 25 mm';p.get('file').files=[new File(['drawing'],'part.pdf')];
      p.answers.push({data:{id:'PRICE-POLICY',token:'test-token',kind:'enquiry',status:'received',notificationStatus:'sent'}});
      await p.get('request-form').emit('submit');
      const form=p.requests[0].options.body;
      assert.equal(form.get('pricePolicy'),priced?null:'technical-only',language+' request form policy');
      assert.equal(form.get('notiz'),'Hülse Ø12, Länge 25 mm');assert.equal(form.get('language'),language);
      p.get('chat-input').value='Welche Maschine passt?';p.answers.push({data:{answer:'Technical response',language,proposal}});
      await p.get('chat-form').emit('submit');
      const chat=JSON.parse(p.requests.at(-1).options.body);
      assert.equal(chat.pricePolicy,priced?undefined:'technical-only',language+' chat policy');
      assert.equal(chat.message,'Welche Maschine passt?');assert.equal(chat.language,language);assert.equal(chat.requestId,undefined);assert.equal(chat.token,undefined);
      assertPricePolicy(p.get('messages'),'chat result');
    }
  }
  for(const language of I18N.supported){
    for(const [flow,statusLabel]of [['ready',null],['state-missing','Lieferzustand des Drahts fehlt'],['strain-outside-range','Umformgrad außerhalb des belegten Fließkurvenbereichs']]){
      const p=harness('https://api.example.test',language);p.get('chat-input').value='Original question';
      p.answers.push({data:{answer:'Model reply',language,proposal:{calculation:{materialModel:{selectedFlowCurve:{id:'source-c4c',approval:'literature',state:'soft-annealed'}},materialStatus:{flow}}}}});
      await p.get('chat-form').emit('submit');
      const rendered=flattened(p.get('messages'));
      assert(rendered.includes(I18N.t('Literaturansatz',language)));assert(rendered.includes(I18N.t('weichgeglüht',language)));assert(rendered.includes('source-c4c'));
      if(statusLabel)assert(rendered.includes(I18N.t(statusLabel,language)),'selected curve does not imply a usable force model');
    }
  }
  for(const language of I18N.supported){
    const p=harness('https://api.example.test',language);p.get('chat-input').value='Original question';
    const points=[{id:'wire-rm',owner:'Kunde / Drahtlieferant',detail:'Drahtzugfestigkeit'},{id:'machine-ko',owner:'Jern Yao',detail:'Auswerfer Matrize (KO)'}];
    p.answers.push({data:{answer:'Model reply',language,proposal:{machines:points.map((point,index)=>({model:'MODEL-'+index,status:'offen',openPoints:[point]}))}}});
    await p.get('chat-form').emit('submit');
    const descendants=node=>[node,...node.children.flatMap(descendants)];
    const sections=descendants(p.get('messages')).filter(node=>node.className==='machine-open-points');assert.equal(sections.length,2);
    sections.forEach((section,index)=>{
      const text=flattened(section);assert(text.includes(I18N.t('Noch zu klären',language)));assert(text.includes(I18N.t(points[index].owner,language)));assert(text.includes(I18N.t(points[index].detail,language)));
      assert(!text.includes(I18N.t(points[1-index].detail,language)),'open data stay attached to their machine');
    });
    const rendered=flattened(p.get('messages'));assert(rendered.includes(I18N.t('Klärung nötig',language)));assert(!rendered.includes(I18N.t('Angaben offen',language)));
  }
  for(const language of I18N.supported){
    const p=harness('https://api.example.test',language);p.get('chat-input').value='Original question';
    p.answers.push({data:{answer:'Model reply',language,proposal:{input:[{field:'wirePreparation',value:'inline-drawing'},{field:'rodDiameter',value:8.4,unit:'mm'},{field:'d0',value:8,unit:'mm'},{field:'rm',value:500,unit:'N/mm²'}]}}});
    await p.get('chat-form').emit('submit');const rendered=flattened(p.get('messages'));
    for(const key of ['Vormaterial / Vorzug','Walzdraht mit Inline-Vorzug','Walzdraht-Ø vor dem Vorzug','Draht-Ø an der Presse','Drahtzugfestigkeit Rm an der Presse'])assert(rendered.includes(I18N.t(key,language)),language+' '+key);
    assert(!rendered.includes('inline-drawing'));assert(!rendered.includes('rodDiameter'));
  }
  for(const language of I18N.supported){
    const translated=harness('https://api.example.test',language);translated.get('email').value='test@example.invalid';translated.get('description').value='Originaltext';translated.get('file').files=[new File(['drawing'],'part.pdf')];translated.answers.push({data:{id:'LANG-'+language,token:'test',kind:'enquiry',status:'received',notificationStatus:'sent'}});await translated.get('request-form').emit('submit');
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



  assert.equal(offline.get('panel-anfrage').hidden,true);

  const live=harness();await live.get('request-form').emit('submit');assert.equal(live.requests.length,0);
  live.get('email').value='test@example.invalid';live.get('description').value='Original drawing enquiry';
  live.get('file').files=[new File(['drawing'],'part.pdf')];
  live.answers.push(new TypeError('Offline'));await live.get('request-form').emit('submit');
  assert.match(live.get('request-message').textContent,/Verbindung/);
  const firstKey=live.requests[0].options.body.get('idempotency_key');
  live.answers.push({data:{id:'MAIL',token:'private',kind:'enquiry',status:'received',notificationStatus:'pending'}});
  await live.get('request-form').emit('submit');
  assert.equal(live.requests[1].options.body.get('idempotency_key'),firstKey,'uncertain mail retry retains its key');
  assert.equal(live.requests[1].options.body.has('datei'),true);
  live.answers.push({data:{kind:'enquiry',status:'received',notificationStatus:'failed'}});await live.runTimer();
  assert.equal(live.get('request-refresh').hidden,false);assert.match(live.get('request-mail-status').textContent,/nicht zugestellt/);
  live.get('chat-input').value='Wie funktioniert Wenden?';
  live.answers.push({data:{answer:'Transfer und Länge zusammen prüfen.',sources:[{label:'Unsichere URL',url:'javascript:alert(1)'},{label:'Katalog',url:'https://www.jernyao.com/'}]}});
  await live.get('chat-form').emit('submit');
  const chatBody=JSON.parse(live.requests.at(-1).options.body);
  assert.equal(chatBody.requestId,undefined);assert.equal(chatBody.token,undefined);
  const sourceList=live.get('messages').children[1].children.at(-1);
  assert.equal(sourceList.children[0].children.length,0);assert.equal(sourceList.children[1].children[0].tagName,'a');

  // File selection while a general answer is pending must neither attach that
  // file nor discard a response which is independent of the mail form.
  const independent=harness();let resolveChat;
  independent.get('chat-input').value='Was ist Kaltumformung?';
  independent.answers.push(new Promise(resolve=>{resolveChat=resolve}));
  const pending=independent.get('chat-form').emit('submit');await new Promise(setImmediate);
  independent.get('file').files=[new File(['private drawing'],'private.pdf')];await independent.get('file').emit('change');
  resolveChat({data:{answer:'Unabhängige Fachantwort'}});await pending;
  assert.equal(independent.requests.length,1);assert.match(independent.requests[0].url,/\/chat\?/);
  assert(flattened(independent.get('messages')).includes('Unabhängige Fachantwort'));

  const provenanceUI=harness('https://api.example.test','en');
  const originalQuote='Kopfdurchmesser  13 mm\nSchaft 30 mm';const originalReference='Nutzerangabe: '+originalQuote;
  for(const language of ['en','it','zh']){
    provenanceUI.locale.language=language;provenanceUI.get('chat-input').value='Frage';
    provenanceUI.answers.push({data:{answer:'Fachantwort',proposal:{input:[{field:'kD',value:13,unit:'mm',origin:'user_text',reference:originalReference}]}}});
    await provenanceUI.get('chat-form').emit('submit');
    const facts=provenanceUI.get('messages').children.at(-1).children.find(node=>node.className==='proposal-grid');
    const detail=facts.children[0].children[2],reference=detail.children.at(-1);
    assert.equal(reference.textContent,I18N.t(originalReference,language));assert(reference.textContent.endsWith(originalQuote));
    assert.equal(reference.dataset.originalText,'');assert.equal(detail.children[0].textContent,I18N.t('Ihre Beschreibung',language));
  }
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
  unconfirmed.get('email').value='test@example.invalid';unconfirmed.get('description').value='Eine Hülse';unconfirmed.get('file').files=[new File(['drawing'],'part.pdf')];
  unconfirmed.answers.push({data:{status:'queued'}});
  await unconfirmed.get('request-form').emit('submit');
  assert.doesNotMatch(unconfirmed.get('request-message').textContent,/angekommen/,'2xx without receipt must not claim success');
  assert.match(unconfirmed.get('request-message').textContent,/nicht eindeutig bestätigt/);
  const unavailable=harness(); unavailable.get('email').value='test@example.invalid'; unavailable.get('description').value='Ein Teil';unavailable.get('file').files=[new File(['drawing'],'part.pdf')];
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
  for(const token of ['/*DATEN*/','/*PRAXIS*/','/*ENGINE*/','/*UI*/','/*ANSWER_FORMAT*/'])assert.equal(template.split(token).length,2,'build placeholder '+token);
  const privacy=template.match(/<details id="datenschutz">([\s\S]*?)<\/details>/)[1];
  for(const term of ['30 Tage','privaten Cloudflare-Speicher','Anthropic','Resend','ausschließlich Ihrer E-Mail-Anfrage','diesem Chat nicht beigefügt','bewusst im Expertenkonfigurator'])assert(privacy.includes(term),'privacy statement: '+term);
  assert.doesNotMatch(privacy,/nichts gespeichert|speichert keine Eingaben/);
  assert.match(template,/<input[^>]*id="consent"[^>]*required/);assert.match(template,/<input[^>]*id="email"[^>]*required/);
  assert.match(template,/<textarea[^>]*id="chat-input"[^>]*maxlength="8000"/);
  const newTranslations=JSON.parse(fs.readFileSync(path.join(__dirname,'..','i18n-frontpage-mail.json'),'utf8'));
  for(const [key,translations] of Object.entries(newTranslations)){
    assert.equal(translations.length,4);assert(source.includes(key)||template.includes(key),'catalogue key is used: '+key);
    for(const language of ['it','sl','en','zh'])assert.notEqual(I18N.t(key,language),key,'translation '+language+': '+key);
  }
  console.log('PASS: mail-only upload with original attachments, explicit consent/contact/send, receipt and mail-status separation, independent text-only chat, no drawing AI endpoint, five-language rendering, safe proposals/quotes, technical-only prices, file validation and expert link.');
})().catch(error=>{console.error(error);process.exitCode=1});
