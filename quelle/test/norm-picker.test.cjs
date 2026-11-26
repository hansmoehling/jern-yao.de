const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const N=require('../normen/library.js'),R=require('../normen/resolver.js'),threads=require('../normen/gewinde.json'),I=require('../i18n.js');
class El{constructor(tag='div'){this.tagName=tag.toUpperCase();this.value='';this.name='';this.type='';this.checked=false;this.children=[];this.events={};this.parent=null;this.hidden=false;}append(...nodes){nodes.forEach(n=>{n.parent=this;this.children.push(n);});}replaceChildren(...nodes){this.children=[];this.append(...nodes);}setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.events[k]=fn;}focus(){this.focused=true;}contains(node){return node===this||this.children.some(child=>child.contains(node));}closest(tag){return this.tagName.toLowerCase()===tag?this:this.parent?.closest(tag);}get options(){return this.children;}get textContent(){return this._text||this.children.map(x=>x.textContent).join('');}set textContent(x){this._text=x;}}
function setup(language='de'){
 const host=new El(),form=new El('form'),detail=new El('details'),nodes=[];form.elements={typ:{value:'bolzen'},standardKind:{value:'screw'}};
 const events={},document={createElement(tag){const e=new El(tag);nodes.push(e);return e;},getElementById(){return detail;},addEventListener(name,fn){events[name]=fn;}};
 const data={schemaVersion:1,version:'test',threads,families:['ISO4762','ISO14579','DIN934','DIN7338','ISO13918'].map(id=>require('../normen/'+id+'.json'))};
 const window={document,JYNormLibrary:N,JYStandards:R};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../normen/ui.js'),'utf8'),{window});
 const part={d0:5.6,wst:'existing',nachricht:'unchanged customer text'};
 let applied;const picker=window.JYNormPicker.create({host,form,data,tr:x=>I.t(x,language),getType:()=>form.elements.typ.value,getPart:()=>({...part}),onApply:x=>{applied=x;},onChange(){}});
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
