const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../axial-chain.js'),G=require('../geometry-model.js'),W=require('../geometry-wizard.js');
class Node{constructor(){this.events={};this.dataset={};this.innerHTML='';this.nodes={};}addEventListener(type,fn){this.events[type]=fn;}querySelector(key){return this.nodes[key]??(this.nodes[key]={value:'',textContent:'',focus(){},scrollIntoView(){}});}}
function setup(evaluate=G.evaluate){const root=new Node(),view=new Node(),context={JYAxialChain:C,JYGeometryWizard:W};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../axial-chain-ui.js'),'utf8'),context);let changes=0;const templates=['stufenbolzen','kugelzapfen'].map(id=>require('../vorlagen/'+id+'.json'));const ui=context.JYAxialChainUI.create({root,view,evaluate,templates,onChange(){changes++;}});return {root,view,ui,get changes(){return changes;}};}
const click=(node,data={},attribute)=>node.events.click({target:{closest:()=>({dataset:data,hasAttribute:x=>x===attribute})}});
const field=(node,kind,id,key,value,select=false)=>{node.events[select?'change':'input']({target:{dataset:{chainKind:kind,chainId:id,chainField:key},tagName:select?'SELECT':'INPUT',value}});};
const change=(node,id,value)=>node.events.change({target:{id,value,dataset:{},tagName:'INPUT'}});

test('chain controller couples length/end, retains boundary selections and blocks invalid edits',()=>{
 const {root,view,ui}=setup();ui.setChain(C.parse('12×6,8×30'));
 field(root,'segment','S1','length','8,5');assert.equal(ui.getChain().segments[0].length,8.5);assert.equal(root.querySelector('[data-chain-id="S1"][data-chain-field="end"]').value,8.5);
 field(root,'segment','S1','end','9');assert.equal(ui.getChain().segments[0].length,9);
 click(root,{chainAdd:'recess'});field(root,'recess','I1','from','after:S1',true);assert(root.innerHTML.includes('value="after:S1" selected'));
 field(root,'segment','S1','end','-1');assert.equal(ui.getSpec(),null);assert.equal(ui.isComplete(),false);assert(view.innerHTML.includes('Segmentlänge muss positiv sein.'));assert(root.querySelector('#chain-message').textContent.includes('Endposition'));
});

test('undo and deletion do not reuse segment or recess IDs; zero parting remains intentional',()=>{
 const {root,ui}=setup();const c=C.parse('12×6,8×30');c.parting=0;ui.setChain(c);click(root,{chainAdd:'segment'});assert.equal(ui.getChain().parting,0);assert.equal(ui.getChain().segments.at(-1).id,'S3');
 click(root,{},'data-chain-undo');click(root,{chainAdd:'segment'});assert.equal(ui.getChain().segments.at(-1).id,'S4');
 click(root,{chainRemove:'S4'});click(root,{chainAdd:'segment'});assert.equal(ui.getChain().segments.at(-1).id,'S5');
 click(root,{chainAdd:'recess'});click(root,{chainRemove:'I1'});click(root,{chainAdd:'recess'});assert.equal(ui.getChain().recesses[0].id,'I2');
});

test('template scaling retains notes, absolute dimensions, IDs and independent trim planes',()=>{
 const {root,view,ui}=setup();change(root,'chain-template','kugelzapfen');assert.equal(ui.getChain().templateId,'kugelzapfen');assert(view.innerHTML.includes('Kontur ist eine Modellnäherung'));
 const before=ui.getChain();change(root,'chain-lead-diameter','12');const after=ui.getChain();assert.equal(after.segments[0].id,before.segments[0].id);assert.equal(after.segments[0].length,before.segments[0].length*2);assert.equal(after.leadDiameterMm,12);
 const c=C.parse('12×6,8×30');c.trimming=[{id:'T1',start:0,length:6,angleDeg:0,distance:5},{id:'T2',start:0,length:6,angleDeg:60,distance:5}];ui.setChain(c);assert(root.innerHTML.includes('data-chain-id="T2"'));field(root,'trim','T2','distance','4,5');assert.equal(ui.getChain().trimming[0].distance,5);assert.equal(ui.getChain().trimming[1].distance,4.5);
 click(root,{chainTrimRemove:'T1'});assert.deepEqual(ui.getChain().trimming.map(t=>t.id),['T2']);
});

test('bounded geometry renders intervals and model notes without claiming exact part volume',()=>{
 const {ui,view}=setup(()=>({valid:true,volumeMm3:null,volumeBoundsMm3:[100,120],massG:null,massBoundsG:[.785,.942],blankLengthMm:null,blankLengthBoundsMm:[2,3],warnings:[],errors:[]}));const c=C.parse('8×10');c.modelNotes=['Kontur als Modellannahme <test>.'];ui.setChain(c);
 assert(view.innerHTML.includes('100 … 120 mm³'));assert(view.innerHTML.includes('0,785 … 0,942 g'));assert(view.innerHTML.includes('2 … 3 mm'));assert(view.innerHTML.includes('Modellvolumen'));assert(view.innerHTML.includes('&lt;test&gt;'));assert(ui.summary().includes(c.modelNotes[0]));
});

test('sketch selects a segment without moving the parting plane, boundary controls do move it',()=>{
 const {ui,root,view}=setup();ui.setChain(C.parse('12×6,8×30'));assert(view.innerHTML.includes('data-chain-select="S2"'));click(view,{chainSelect:'S2'});assert.equal(ui.getChain().parting,6);assert(root.innerHTML.includes('chain-active" data-chain-row="S2"'));
 click(view,{chainBoundary:'S2'});assert.equal(ui.getChain().parting,36);
 let prevented=false;root.events.keydown({key:'Enter',target:{dataset:{chainKind:'segment',chainId:'S1'}},preventDefault(){prevented=true;}});assert(prevented);assert.deepEqual(ui.getChain().segments.map(s=>s.id),['S1','S3','S2']);
});
