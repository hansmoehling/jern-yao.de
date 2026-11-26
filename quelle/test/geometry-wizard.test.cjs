const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../geometry-wizard.js'),G=require('../geometry-model.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),C=require('../axial-chain.js');
const cylinder=(id,side,operation,diameter,length,start=0)=>({id,side,operation,shape:'cylinder',diameter,length,start,offsetX:0,offsetY:0});
const spec=elements=>({version:1,coordinateSystem:'tool-parting-plane',elements,trimming:[]});
class Node{constructor(){this.events={};this.dataset={};this.innerHTML='';}addEventListener(type,handler){this.events[type]=handler;}}
test('wizard serializes decimal comma, signed eccentricity, cone tip and six actual trim planes',()=>{
 const geometry=W.specFrom([{...cylinder('E1','punch','add','12,5','8'),shape:'cone',diameterEnd:'0',offsetX:'-2,5',offsetY:'1'}],{mode:'hex',side:'punch',start:'0',length:'8',acrossFlats:'10'});
 assert.equal(geometry.elements[0].diameter,12.5);assert.equal(geometry.elements[0].diameterEnd,0);assert.equal(geometry.elements[0].offsetX,-2.5);
 assert.equal(geometry.trimming.length,6);assert.deepEqual(geometry.trimming.map(p=>p.angleDeg),[0,60,120,180,240,300]);assert(geometry.trimming.every(p=>p.distance===5));assert(G.validate(geometry).valid);
});
test('longitudinal sketch has correct tool-side cavity opening and handles trimming and Y offset',()=>{
 const geometry=spec([cylinder('E1','die','add',10,20),cylinder('E2','die','subtract',6,8,12)]);
 assert.deepEqual(W.sectionIntervals(geometry,5),[[-5,5]]);assert.deepEqual(W.sectionIntervals(geometry,15),[[-5,-3],[3,5]]);assert.deepEqual(W.sectionIntervals(geometry,-1),[]);
 geometry.trimming=[{id:'T1',side:'die',start:0,length:20,angleDeg:0,distance:4}];assert.deepEqual(W.sectionIntervals(geometry,5),[[-5,4]]);
 const before=W.sketch(geometry);geometry.elements[0].offsetY=9;assert.notEqual(W.sketch(geometry),before);assert.deepEqual(W.sectionIntervals(geometry,5),[]);
 assert(before.includes('z &lt; 0'));assert(before.includes('z &gt; 0'));assert(before.includes('role="img"'));assert(!before.includes('NaN'));
});

test('punch centre recess is visible as an inward-pointing hole, not a reversed cone or an omitted zero-end shape',()=>{
 const head=cylinder('head','punch','add',8,4),recess={...cylinder('centre','punch','subtract',0,2,2),shape:'cone',diameterEnd:4};
 const geometry=spec([head,recess]);assert(G.validate(geometry).valid);
 assert.deepEqual(W.sectionIntervals(geometry,-4),[[-4,-2],[2,4]],'wide opening at the outer end');
 assert.deepEqual(W.sectionIntervals(geometry,-3),[[-4,-1],[1,4]]);
 assert.deepEqual(W.sectionIntervals(geometry,-2),[[-4,4]],'the cone ends at an interior point');
 assert.deepEqual(W.sectionIntervals(geometry,-1),[[-4,4]],'solid rest bottom towards the parting plane');
 assert.deepEqual(W.sectionIntervals(geometry,3),[],'the cavity is not mirrored into the die side');
 const holeSvg=W.sketch(geometry),solidSvg=W.sketch(spec([head])),path=svg=>svg.match(/<path d="([^"]*)"/)[1];
 assert.notEqual(path(holeSvg),path(solidSvg),'the actual rendered material path includes the zero-ended cone subtraction');assert(!holeSvg.includes('NaN'));
});

test('selecting a subtractive cone initializes its inner tip to zero and preserves the outside opening through select events',()=>{
 const root=new Node(),view=new Node(),controller=W.create({root,view,evaluate:G.evaluate});
 controller.setElements([cylinder('head','punch','add',8,4),cylinder('centre','punch','subtract',4,2,2)]);
 const select=(field,value)=>({target:{dataset:{geometryKind:'element',geometryField:field,element:'centre'},value,tagName:'SELECT'}});
 root.events.input(select('shape','cone'));root.events.change(select('shape','cone'));
 let recess=controller.getSpec().elements.find(e=>e.id==='centre');assert.equal(recess.diameter,0);assert.equal(recess.diameterEnd,4);assert(G.validate(controller.getSpec()).valid);
 assert(root.innerHTML.includes('Öffnungs-Ø außen in mm'));assert(root.innerHTML.includes('Ø am Grund innen in mm'));assert(root.innerHTML.includes('Körner / konische Vertiefung'));
 assert.deepEqual(W.sectionIntervals(controller.getSpec(),-3),[[-4,-1],[1,4]]);
 root.events.change(select('operation','add'));recess=controller.getSpec().elements.find(e=>e.id==='centre');assert.equal(recess.diameter,4);assert.equal(recess.diameterEnd,0);
 root.events.input(select('operation','subtract'));root.events.change(select('operation','subtract'));recess=controller.getSpec().elements.find(e=>e.id==='centre');assert.equal(recess.diameter,0);assert.equal(recess.diameterEnd,4);
});

test('changing a cone recess back to a cylinder preserves its opening, depth and tool side',()=>{
 for(const side of ['punch','die']){
  const root=new Node(),view=new Node(),controller=W.create({root,view,evaluate:G.evaluate});
  controller.setElements([cylinder('body',side,'add',8,4),cylinder('recess',side,'subtract',4,2,2)]);
  const shape=value=>({target:{dataset:{geometryKind:'element',geometryField:'shape',element:'recess'},value,tagName:'SELECT'}});
  for(const value of ['cone','cylinder','cone','hex','cylinder']){
   root.events.input(shape(value));root.events.change(shape(value));
   const recess=controller.getSpec().elements.find(e=>e.id==='recess');
   assert.equal(recess.side,side);assert.equal(recess.length,2);assert.equal(recess.start,2);
   if(value==='cone'){assert.equal(recess.diameter,0);assert.equal(recess.diameterEnd,4);assert(G.validate(controller.getSpec()).valid);}
   if(value==='cylinder'){assert.equal(recess.diameter,4);assert(G.validate(controller.getSpec()).valid);}
  }
 }
});

test('hex trimming requires positive across-flats before creating signed plane distances',()=>{
 const elements=[cylinder('body','punch','add',8,4)],trim={mode:'hex',side:'punch',start:0,length:4};
 for(const acrossFlats of [0,-1,'-0,5','',null]){
  const geometry=W.specFrom(elements,{...trim,acrossFlats});
  assert(geometry.trimming.every(plane=>plane.distance===null));
  const result=G.evaluate(geometry);assert.equal(result.valid,false);assert.equal(result.volumeMm3,null);
  assert(result.errors.some(error=>error.code==='dimension-range'&&error.path.endsWith('.distance')));
 }
 assert(G.validate(W.specFrom(elements,{...trim,acrossFlats:'6,5'})).valid);
 const plane=W.specFrom(elements,{...trim,mode:'plane',angleDeg:0,distance:-1});
 assert.equal(plane.trimming[0].distance,-1);assert(G.validate(plane).valid,'signed individual plane distances remain supported');
});

test('die-side editor has no claw option and injected die-side feature events are ignored',()=>{
 const root=new Node(),view=new Node(),controller=W.create({root,view,evaluate:G.evaluate});
 controller.setElements([cylinder('head','punch','add',8,4)]);assert(root.innerHTML.includes('Krallenkopf'));
 const feature=(side,field,value,type='select',checked=false)=>({target:{dataset:{geometryKind:'feature',geometryField:field,element:side},value,type,checked,tagName:type==='select'?'SELECT':'INPUT'}});
 root.events.change(feature('punch','kind','claw'));assert.equal(controller.isComplete(),false);
 root.events.click({target:{closest:()=>({dataset:{geometryStep:'3'}})}});
 assert(!root.innerHTML.includes('Krallenkopf'));assert(!root.innerHTML.includes('data-geometry-kind="feature"'));
 const before=controller.getFeatures();root.events.change(feature('die','kind','claw'));root.events.input(feature('die','complete','','checkbox',true));
 assert.deepEqual(controller.getFeatures(),before);assert.equal(controller.isComplete(),false);assert(!controller.featureSummary().some(line=>line.includes('Matrizenseite')));
});
test('claw features stay outside geometric spec and suppress complete-part weight until explicitly modelled',()=>{
 const root=new Node(),view=new Node();let controller;controller=W.create({root,view,evaluate:G.evaluate,onChange(){controller.refresh({densityGcm3:7.85,wireDiameterMm:8});}});
 controller.setElements([cylinder('E1','punch','add',12,6)]);
 controller.refresh({densityGcm3:7.85,wireDiameterMm:8,densityStatus:'reference-steel-density'});assert(view.innerHTML.includes('Gewicht mit Stahl-Bezugsdichte 7,85 g/cm³; Näherungswert'));
 const event=(field,value,type='select',checked=false)=>({target:{dataset:{geometryKind:'feature',geometryField:field,element:'punch'},value,type,checked,tagName:type==='select'?'SELECT':'INPUT'}});
 root.events.change(event('kind','claw'));assert.equal(controller.isComplete(),false);assert.deepEqual(controller.getFeatures(),[{side:'punch',type:'claw-head',contourComplete:false}]);
 assert(!Object.hasOwn(controller.getSpec(),'features'));assert(view.innerHTML.includes('Volumen der Grundgeometrie'));assert(view.innerHTML.includes('Kontur noch unvollständig'));
 root.events.input(event('complete','', 'checkbox',true));assert.equal(controller.isComplete(),true);assert(!view.innerHTML.includes('Kontur noch unvollständig'));assert(controller.featureSummary()[0].includes('Stempelseite'));
});
test('incomplete inputs remain invalid and reviewing another step preserves entered dimensions',()=>{
 const root=new Node(),view=new Node(),controller=W.create({root,view,evaluate:G.evaluate});
 assert.equal((view.innerHTML.match(/Mindestens ein additiver Grundkörper ist erforderlich\./g)||[]).length,1,'duplicate validation paths produce one useful visible message');
 const button={dataset:{geometryAdd:'die',operation:'add'}};root.events.click({target:{closest:()=>button}});
 assert.equal(G.validate(controller.getSpec()).valid,false);
 for(const [key,value]of [['length','20'],['diameter','9,5']])root.events.input({target:{dataset:{geometryField:key,geometryKind:'element',element:'E1'},value,tagName:'INPUT'}});
 assert(G.validate(controller.getSpec()).valid);const saved=controller.getSpec();root.events.click({target:{closest:()=>({dataset:{geometryStep:'4'}})}});assert.deepEqual(controller.getSpec(),saved);assert(root.innerHTML.includes('Versatz X'));
});

test('real form-part templates produce complete localized geometry reports without changing their geometry',()=>{
 const catalogue={};
 for(const file of fs.readdirSync(path.join(__dirname,'..')).filter(name=>/^i18n-.*\.json$/.test(name)).sort())Object.assign(catalogue,JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8').replace(/^\uFEFF/,'')));
 const context={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalogue)),context);const I=context.module.exports;
 const expected={de:['Werkzeugtrennkante','Stempelseite','Matrizenseite'],it:['Piano di divisione degli utensili','Lato punzone','Lato matrice'],sl:['Delilna ravnina orodja','Stran pestiča','Stran matrice'],en:['Tool parting line','Punch side','Die side'],zh:['模具分型位置','冲头侧','凹模侧']};
 for(const file of fs.readdirSync(path.join(__dirname,'../vorlagen')).filter(name=>name.endsWith('.json'))){
  const template=JSON.parse(fs.readFileSync(path.join(__dirname,'../vorlagen',file),'utf8')),projection=C.project(C.fromTemplate(template)),before=JSON.stringify(projection.spec);assert.equal(projection.ok,true,file);
  for(const [language,[parting,punch,die]]of Object.entries(expected)){
   const tr=text=>I.t(text,language),fmt=value=>Number(value).toLocaleString(I.numberLocale(language),{maximumFractionDigits:3});
   const report=[tr(template.label),...W.summary(projection.spec,tr,fmt),...template.notes.map(tr)].join('\n');
   assert.ok(report.includes(parting+': z = 0 mm'),file+' '+language);assert.ok(report.includes(punch+':'));assert.ok(report.includes(die+':'));
   if(language!=='de')assert.doesNotMatch(report,/Werkzeugtrennkante|Stempelseite|Matrizenseite|Abstand von Trennkante|Körper|Aussparung|Kegelstumpf|Prozessannahme|Kegelspitze|Modellnäherung|Stufenbolzen|Halbhohlniet|Kugelzapfen|Schweißbolzen/,file+' '+language);
   for(const element of projection.spec.elements)assert.ok(report.includes(element.id+' · '),'stable geometry identifiers remain in the report');
   assert.equal(JSON.stringify(projection.spec),before,'report localization cannot edit geometry');
  }
 }
});
