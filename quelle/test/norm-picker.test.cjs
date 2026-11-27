const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const N=require('../normen/library.js'),R=require('../normen/resolver.js'),threads=require('../normen/gewinde.json'),baseI=require('../i18n.js'),extra={...require('../i18n-p4.json'),...require('../i18n-p5-ui.json')};
const I={...baseI,t:(key,language)=>language!=='de'&&extra[key]?extra[key][baseI.supported.indexOf(language)-1]:baseI.t(key,language)};
class El{constructor(tag='div'){this.tagName=tag.toUpperCase();this.value='';this.name='';this.type='';this.checked=false;this.children=[];this.events={};this.parent=null;this.hidden=false;}append(...nodes){nodes.forEach(n=>{n.parent=this;this.children.push(n);});}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.events[k]=fn;}focus(){this.focused=true;}contains(node){return node===this||this.children.some(child=>child.contains(node));}closest(tag){return this.tagName.toLowerCase()===tag?this:this.parent?.closest(tag);}get options(){return this.children;}get textContent(){return this._text||this.children.map(x=>x.textContent).join('');}set textContent(x){this._text=x;}}
function setup(language='de',enhanced=false,catalogue=[{die:[50,100],pun:[25,100],ml:120,cl:[10,200]}],functional=false){
 const host=new El(),form=new El('form'),detail=new El('details'),nodes=[];form.elements={typ:{value:'bolzen'},standardKind:{value:'screw'}};
 const events={},document={createElement(tag){const e=new El(tag);nodes.push(e);return e;},getElementById(){return detail;},addEventListener(name,fn){events[name]=fn;}};
 const data={schemaVersion:1,version:'test',threads,materials:require('../vorbelegung/werkstoff.json'),families:['ISO4762','ISO14579','ISO4026','DIN835','ISO2338','DIN934','DIN660','DIN6791','DIN7338','ISO13918'].map(id=>require('../normen/'+id+'.json'))};
 // Synthetic coverage gap isolates missing length rows from later catalogue additions.
 data.families.push({id:'TEST-NO-LENGTH',funktion:'schraube',klasse:'bolzen',kopfTyp:'zylinder',antrieb:{art:'hex'},groessen:{M6:{vorbelegung:{sD:6,kD:10,kH:6,iSW:5,iT:3}},M8:{vorbelegung:{sD:8,kD:13,kH:8,iSW:6,iT:4}}}});
 const window={document,JYNormLibrary:N,JYStandards:R,JYNormAvailability:require('../normen/availability.js')};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../normen/ui.js'),'utf8'),{window});
 const part={d0:5.6,wst:'existing',nachricht:'unchanged customer text'};
 let applied;const picker=window.JYNormPicker.create({host,form,data,tr:x=>I.t(x,language),getType:()=>form.elements.typ.value,getPart:()=>({...part}),onApply:x=>{applied=x;},onChange(){},...(enhanced?{shaftPolicy:'shaft-v2',catalogue}: {}),...(functional?{functionPolicy:'function-v1'}:{})});
 return {picker,form,host,detail,part,events,setLanguage(value){language=value;picker.refreshType();},get:id=>nodes.find(n=>n.id===id),get applied(){return applied;}};
}
function edit(p,name,value,tagName='SELECT',type='',checked=false){p.form.events.change({target:{name,value,tagName,type,checked}});}

test('norm picker stores drive-size and checkbox overrides and keeps the full customer snapshot',()=>{
 const p=setup();assert(p.picker.select({id:'ISO4762',groesse:'M6',laenge:30}));edit(p,'iSize','custom');edit(p,'iSW','4,7','INPUT');let a=p.picker.adapted();assert.equal(a.iSize,'custom');assert.equal(a.iSW,4.7);assert.equal(a.standardDocument.partSnapshot.nachricht,'unchanged customer text');
 assert(p.picker.select({id:'DIN934',groesse:'M8'}));edit(p,'nutShape','square');edit(p,'nutFlange','on','INPUT','checkbox',false);a=p.picker.adapted();assert.equal(a.nutShape,'square');assert.equal(a.nutFlange,false);assert.equal(p.picker.document().overrides.nutFlange.value,false);
});

test('norm picker exposes documented variant sizes without fabricating welding geometry',()=>{
 const p=setup();p.picker.select({id:'DIN7338',form:'B',groesse:'3'});assert.equal(p.get('norm-form').value,'B');assert(p.get('norm-form').options.some(x=>x.value==='A'));assert.equal(p.picker.document().standardReference.form,'B');assert.equal(p.applied.d_b,1.7);assert(p.applied.normRequiresGeometryReview);
 p.picker.select({id:'ISO13918',form:'PT',groesse:'M3',laenge:12});assert.equal(p.get('norm-kind').value,'pin');assert.equal(p.get('norm-form').value,'PT');assert.equal(p.get('norm-form').options.length,14);assert.equal(p.applied.l1,12);assert.equal(p.applied.normRequiresGeometryReview,true);assert.equal(p.picker.document().standardReference.form,'PT');
 assert(!p.host.textContent.includes('catalog-undated'));assert(!p.host.textContent.includes('catalogue-unassigned'));
});

test('rivet material classes preserve the norm template and geometry edits for solid and semi-tubular rivets',()=>{
 for(const language of I.supported)for(const id of ['DIN660','DIN6791']){
  const p=setup(language);p.picker.select({id,groesse:'4',laenge:id==='DIN660'?10:12,festigkeitsklasse:'Stahl'});edit(p,'kD','8.2','INPUT');
  const field=p.get('norm-festigkeitsklasse');assert.deepEqual(field.options.map(option=>option.value),['Stahl','Cu','CuZn','Al']);
  const geometryBaseline=document=>JSON.stringify(Object.fromEntries(Object.entries(document.normBaseline).filter(([key])=>key!=='id'))),baseline=geometryBaseline(p.picker.document()),length=p.applied.sL;
  for(const materialClass of ['Al','Cu','CuZn','Stahl']){
   field.value=materialClass;field.events.change();const adapted=p.picker.adapted(),doc=p.picker.document();
   assert.equal(doc.standardReference.id,id);assert.equal(doc.standardReference.groesse,'4');assert.equal(doc.standardReference.festigkeitsklasse,materialClass);assert.equal(adapted.propertyClass,materialClass);
   assert.equal(geometryBaseline(doc),baseline);assert.equal(adapted.sL,length);assert.equal(adapted.kD,8.2);assert.equal(doc.overrides.kD.value,8.2);
   assert.equal(adapted.threadFamily,'none');assert.equal(adapted.iTyp,'none');
   if(id==='DIN6791'){assert.equal(adapted.schaftende,'halbhohl');assert.equal(adapted.d_b,2.7);assert.equal(adapted.t_b,4);}
  }
 }
});

test('rivet mappings use approved exact materials and keep copper explicitly without a flow curve',()=>{
 const rules=require('../vorbelegung/werkstoff.json').rules.filter(rule=>rule.kind==='rivet'),E=require('../engine.js');
 assert.deepEqual(rules.flatMap(rule=>rule.classes),['Stahl','Cu','CuZn','Al']);
 for(const [materialClass,id]of [['Stahl','C4C'],['Cu','Cu-ETP'],['CuZn','CuZn37'],['Al','AlMgSi1']]){
  const rule=rules.find(rule=>rule.classes.includes(materialClass)),material=E.findMaterial(rule.materialId);assert.equal(rule.materialId,id);assert(material);
  if(materialClass==='Cu'){assert.equal(rule.availability,'missing-flow-curve');assert.equal(rule.state,'unknown');assert.equal(material.manualEligible,false);assert.equal(material.flowCurves.length,0);}
  else assert(material.manualEligible&&material.flowCurves.some(curve=>curve.state===rule.state&&curve.eligible&&['literature','proxy'].includes(curve.approval)));
 }
});

test('numeric normative Torx sizes adapt to actual catalogue labels and customer sizes survive',()=>{
 const p=setup();p.picker.select({id:'ISO14579',groesse:'M6'});assert.equal(p.applied.iSize,'T30');edit(p,'iSize','T25');assert.equal(p.picker.adapted().iSize,'T25');
});

test('exported template snapshot follows wire and material edits made outside norm fields',()=>{
 const p=setup();p.picker.select({id:'ISO4762',groesse:'M6',laenge:30});p.part.d0=5.2;p.part.wst='customer-wire';
 assert.equal(p.picker.document().partSnapshot.d0,5.2);
 assert.equal(p.picker.adapted().standardDocument.partSnapshot.wst,'customer-wire');
 assert.equal(p.picker.document().standardReference.id,'ISO4762');
 assert.deepEqual(Object.keys(p.picker.document().overrides),[]);
});

test('changing the locale refreshes every picker label and option without resetting the norm or edits',()=>{
 const p=setup('it');p.picker.select({id:'ISO4762',groesse:'M6',laenge:35});edit(p,'kD','10.2','INPUT');
 const before=JSON.stringify(p.picker.document());
 for(const language of ['sl','en','zh','de','it']){
  p.setLanguage(language);
  for(const [key,source]of [['kind','Teilefamilie'],['id','Normvorlage'],['form','Ausführung'],['groesse','Größe'],['laenge','Länge in mm'],['steigung','Steigung in mm'],['festigkeitsklasse','Festigkeitsklasse']]){
   const control=p.get('norm-'+key);assert.equal(control['aria-label'],I.t(source,language));assert.equal(control.parent.children[0].textContent,I.t(source,language));
  }
  assert.equal(p.get('norm-id').options[0].textContent,I.t('Ohne Normvorgabe',language));
  assert.equal(p.get('norm-kind').options.find(option=>option.value==='rivet').textContent,I.t('Niet',language));
  assert.equal(p.get('norm-laenge-toggle')['aria-label'],I.t('Länge in mm',language)+': 35 mm');
  assert.equal(JSON.stringify(p.picker.document()),before);
 }
});

test('length disclosure renders documented choices in the page and restores focus after selection or Escape',()=>{
 const p=setup(),button=p.get('norm-laenge-toggle'),list=p.get('norm-laenge');
 assert.equal(button.disabled,true);assert.equal(list.hidden,true);
 p.picker.select({id:'ISO4762',groesse:'M6',laenge:30});
 assert.equal(button.disabled,false);assert(button.textContent.includes('30 mm'));
 assert.equal(button['aria-controls'],'norm-laenge');assert.equal(button['aria-expanded'],'false');assert.equal(button['aria-haspopup'],'listbox');
 assert.equal(list.size,6);
 button.events.click();assert.equal(list.hidden,false);assert.equal(button['aria-expanded'],'true');assert.equal(list.focused,true);
 assert.deepEqual(list.options.map(option=>Number(option.value)),N.lengths(require('../normen/ISO4762.json'),'M6').map(Number));
 list.value='35';list.events.change();list.events.click();assert.equal(p.applied.sL,35);assert.equal(list.hidden,true);assert.equal(button.focused,true);assert(button.textContent.includes('35 mm'));
 let prevented=false;button.events.keydown({key:'ArrowDown',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(list.hidden,false);
 button.focused=false;list.events.keydown({key:'ArrowDown',preventDefault(){throw Error('native arrow navigation must remain available');}});list.value='40';list.events.change();assert.equal(list.hidden,false);assert.equal(button.focused,false);assert.equal(p.applied.sL,40);
 list.events.keydown({key:'Enter',preventDefault(){}});assert.equal(list.hidden,true);assert.equal(button.focused,true);
 button.events.click();list.events.keydown({key:'Escape',preventDefault(){}});assert.equal(list.hidden,true);assert.equal(p.picker.document().standardReference.laenge,40);
 button.events.click();p.events.click({target:button});assert.equal(list.hidden,false);
 p.events.click({target:new El()});assert.equal(list.hidden,true);
});

test('P4 offers custom lengths, clears old automatic lengths across norms, and preserves deliberate lengths and overrides',()=>{
 for(const language of I.supported){
  const p=setup(language,true),choose=(key,value)=>{p.get('norm-'+key).value=value;p.get('norm-'+key).events.change();};
  p.picker.select({id:'ISO4762',groesse:'M6',laenge:30});assert.equal(p.picker.document().shaftPolicy,'shaft-v2');
  assert.equal(p.get('norm-laenge').options.at(-1).value,'custom');assert.equal(p.get('norm-laenge').options.at(-1).textContent,I.t('Andere Länge …',language));
  choose('id','TEST-NO-LENGTH');
  const input=p.get('norm-laenge-custom');assert.equal(input.hidden,false);assert.equal(input.disabled,false);assert.equal(input.value,'');assert.equal(p.get('norm-laenge-toggle').hidden,true);
  assert.equal(p.picker.document().standardReference.laenge,undefined);assert.equal(p.applied.sL,null);assert(p.applied.clearFields.includes('sL'));
  assert(p.get('norm-length-range').textContent.includes('120'));assert(p.get('norm-length-range').textContent.includes('10–200'));assert.equal(input.max,undefined);assert.equal(input.min,'0.01');
  input.value='37.5';input.events.input();assert.equal(p.applied.sL,37.5);assert.equal(p.picker.document().lengthSelection.origin,'customer');
  edit(p,'kD','11.2','INPUT');choose('groesse','M8');assert.equal(input.value,'37.5');assert.equal(p.applied.sL,37.5);assert.equal(p.applied.kD,11.2);
  choose('id','ISO4762');assert.equal(p.applied.sL,37.5);assert.equal(p.get('norm-laenge').value,'custom');assert.equal(p.picker.document().overrides.kD.value,11.2);
  input.value='';input.events.input();assert.equal(p.applied.sL,null);assert.equal(p.picker.document().standardReference.laenge,undefined);
  input.value='250';input.events.input();assert.equal(p.applied.sL,250,'catalogue cutoff limits must never be HTML product-length limits');
  edit(p,'sL','41','INPUT');choose('id','TEST-NO-LENGTH');assert.equal(p.applied.sL,41);assert.equal(p.picker.document().overrides.sL.origin,'customer');
 }
});

test('P4 series selection resets only automatic length on size changes and keeps custom input keyboard focus',()=>{
 const p=setup('de',true);p.picker.select({id:'ISO4762',groesse:'M6',laenge:30});
 const size=p.get('norm-groesse');size.value='M8';size.events.change();
 assert.notEqual(p.applied.sL,30);assert.equal(p.picker.document().lengthSelection.origin,'standard');
 const list=p.get('norm-laenge'),input=p.get('norm-laenge-custom');list.value='custom';list.events.change();list.events.click();
 assert.equal(input.hidden,false);assert.equal(input.focused,true);assert.equal(list.hidden,true);
 input.value='31.2';input.events.input();p.setLanguage('sl');assert.equal(input.value,'31.2');assert.equal(input['aria-label'],I.t('Individuelle Länge in mm','sl'));assert.equal(p.applied.sL,31.2);assert.equal(list.options.at(-1).textContent,I.t('Andere Länge …','sl'));
});

test('P4 disables only documented impossible contours and explains them in every language',()=>{
 for(const language of I.supported){
  const p=setup(language,true,[{die:[7,100],pun:[6.5,100],ml:120,cl:[10,200]}]);p.picker.select({id:'TEST-NO-LENGTH',groesse:'M6'});
  const small=p.get('norm-groesse').options.find(o=>o.value==='M6'),large=p.get('norm-groesse').options.find(o=>o.value==='M8');assert.equal(small.disabled,false);assert.equal(large.disabled,true);
  const reason=I.t('Schaftkontur Ø {diameter} mm liegt außerhalb der dokumentierten Werkzeugaufnahmen im Maschinenkatalog (bis Ø {maximum} mm).',language).replace('{diameter}','7.1').replace('{maximum}','7');assert.equal(large.title,reason);assert(large.textContent.includes(reason));
  p.setLanguage('en');assert.equal(large.title,I.t('Schaftkontur Ø {diameter} mm liegt außerhalb der dokumentierten Werkzeugaufnahmen im Maschinenkatalog (bis Ø {maximum} mm).','en').replace('{diameter}','7.1').replace('{maximum}','7'));
 }
 const unknown=setup('de',true,[{die:[11,100]}]);unknown.picker.select({id:'TEST-NO-LENGTH',groesse:'M6'});assert(unknown.get('norm-groesse').options.every(o=>!o.disabled));
 const openHead=setup('de',true,[{die:[11,100],pun:[10,100]}]);openHead.picker.select({id:'TEST-NO-LENGTH',groesse:'M8'});assert(openHead.get('norm-groesse').options.every(o=>!o.disabled),'a larger openly upset head does not exclude an otherwise fitting shank');
});

test('P5 functions have separate norm lists, five-language names and compatible technical kinds',()=>{
 for(const language of I.supported){
  const p=setup(language,true,undefined,true),field=p.get('norm-kind'),choose=value=>{field.value=value;field.events.change();};
  assert.deepEqual(field.options.map(o=>o.value),['screw','rivet','pin','set-screw','stud','weld-stud','free']);
  for(const [key,label,id,kind]of [['pin','Stift','ISO2338','pin'],['set-screw','Gewindestift','ISO4026','headless'],['stud','Stehbolzen','DIN835','headless'],['weld-stud','Schweißbolzen','ISO13918','pin']]){
   choose(key);assert.equal(field.options.find(o=>o.value===key).textContent,I.t(label,language));
   assert.deepEqual(p.get('norm-id').options.map(o=>o.value),['',id]);assert.equal(p.form.elements.standardKind.value,kind);assert.equal(p.picker.partFunction(),key);
  }
  choose('rivet');assert(p.get('norm-id').options.some(o=>o.value==='DIN6791'));assert(!p.get('norm-id').options.some(o=>o.value==='ISO13918'));
  choose('free');assert.equal(p.picker.document(),null);assert.equal(p.picker.partFunction(),'free');assert.equal(p.get('norm-id').parent.hidden,true);
 }
});

test('P5 function switching and free editing preserve each norm template, customer changes and selected variant',()=>{
 const p=setup('de',true,undefined,true),choose=value=>{p.get('norm-kind').value=value;p.get('norm-kind').events.change();};
 p.picker.select({id:'ISO4026',groesse:'M6',laenge:10});edit(p,'iSW','3.2','INPUT');assert.equal(p.picker.partFunction(),'set-screw');
 const saved=JSON.stringify(p.picker.document());p.part.sL=12.3;
 choose('free');assert.equal(p.part.sL,12.3);assert.equal(p.picker.document(),null);assert.equal(p.detail.open,true);
 choose('set-screw');assert.equal(p.picker.document().standardReference.id,'ISO4026');assert.equal(p.applied.iSW,3.2);assert.equal(p.picker.document().standardReference.laenge,10);
 p.picker.select({id:'DIN835',groesse:'M6',laenge:30});assert.equal(p.picker.partFunction(),'stud');assert.equal(p.applied.standardKind,'headless');
 p.picker.select({id:'DIN934',groesse:'M8'});assert.equal(p.form.elements.typ.value,'mutter');
 p.picker.select({id:'ISO13918',form:'PT',groesse:'M3',laenge:12});assert.equal(p.form.elements.typ.value,'bolzen');assert.equal(p.picker.partFunction(),'weld-stud');assert.equal(p.get('norm-form').value,'PT');assert.equal(p.applied.standardKind,'pin');
 const before=JSON.stringify(p.picker.document());p.setLanguage('sl');assert.equal(p.get('norm-kind').value,'weld-stud');assert.equal(p.get('norm-kind').options.find(o=>o.value==='weld-stud').textContent,I.t('Schweißbolzen','sl'));assert.equal(JSON.stringify(p.picker.document()),before);
 assert(saved.includes('3.2'));
});
