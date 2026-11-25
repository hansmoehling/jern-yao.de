const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../geometry-wizard.js'),G=require('../geometry-model.js');
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
