import test from 'node:test';
import assert from 'node:assert/strict';
import {screen,analyse} from '../analysis.js';
import worker,{tokenFor} from '../worker.js';
import {coaxialDrawingTopology} from './topology-fixture.js';

const file={type:'application/pdf',bytes:new TextEncoder().encode('%PDF-1.7 simple drawing')};
function fixture({typ='bolzen',drawing=false,values={sD:8,sL:30,kD:13,kH:5}}={}){
 const evidence=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{origin:'user_text',reference:key,quote:key+' '+value+' mm',originalValue:value,originalUnit:'mm'}]));
 const context={note:'C15C; '+Object.values(evidence).map(item=>item.quote).join('; '),...(drawing?{file}:{})};
 return {context,input:{typ,material:'C15C',materialEvidence:{origin:'user_text',quote:'C15C'},values,evidence,...(drawing?{topology:coaxialDrawingTopology()}:{} )}};
}
const noCalculation=result=>{assert.equal(result.ok,false);assert.equal(result.proposal,null);assert.equal(result.invalidatePreviousProposal,true);};
class KV{constructor(){this.map=new Map([['regeln','Volumenkonstanz prüfen.'],['wissenskarten','Sondergeometrie muss vollständig dargestellt sein.']]);}async get(k){return this.map.get(k)||null;}async put(k,v){this.map.set(k,v);}}
const environment=()=>({SPEICHER:new KV(),ANTHROPIC_API_KEY:'mock',ZUGRIFF_SCHLUESSEL:'test-access-key-at-least-32-characters',DATEIEN:{async get(){return {arrayBuffer:async()=>file.bytes.buffer};}}});
const tool=(name,input={})=>({type:'tool_use',id:name,name,input});
const final=answer=>({type:'text',text:JSON.stringify({answer,questions:[],sourceIds:['engine','konzept']})});
function fetchMock(t,handler){const old=globalThis.fetch;globalThis.fetch=handler;t.after(()=>{globalThis.fetch=old;});}

test('form parts require an actual drawing even with complete text envelope dimensions or a renamed bolt type',()=>{
 const f=fixture({typ:'formteil'});let r=screen(f.input,f.context);noCalculation(r);assert.equal(r.topology.status,'drawing_required');assert.match(r.questions[0],/Zeichnung/);
 f.input.typ='bolzen';f.context.note+=' Sonderteil mit vollständigen Hüllmaßen.';r=screen(f.input,f.context);noCalculation(r);assert.equal(r.topology.status,'drawing_required');
 r=screen(f.input,{...f.context,filename:'part.step',unreadableFile:true});noCalculation(r);assert.equal(r.topology.status,'drawing_required');
});

test('drawings need explicit sourced topology, while supported simple form parts can still calculate',()=>{
 const f=fixture({typ:'formteil',drawing:true});const complete=screen(f.input,f.context);assert.equal(complete.ok,true);assert.ok(complete.proposal.machines.length);
 for(const mutate of [x=>delete x.topology,x=>{x.topology.axisRelationship='unknown';},x=>{x.topology.engineCoverage='incomplete';},x=>{x.topology.evidence.origin='assumption';},x=>{delete x.topology.evidence.page;},x=>{x.topology.evidence.quote='';}]){
  const input=structuredClone(f.input);mutate(input);const r=screen(input,f.context);noCalculation(r);assert.equal(r.topology.status,'unresolved');
 }
 const bolt=fixture({drawing:true});delete bolt.input.topology;noCalculation(screen(bolt.input,bolt.context));
});

test('standard text bolts and nuts remain supported; explicit drawing review does not alter their numbers',()=>{
 const f=fixture(),text=screen(f.input,f.context);assert.equal(text.ok,true);
 const drawn=screen({...f.input,topology:coaxialDrawingTopology()},{...f.context,file});assert.equal(drawn.ok,true);assert.deepEqual(drawn.proposal.calculation.values,text.proposal.calculation.values);assert.deepEqual(drawn.proposal.stages,text.proposal.stages);
 const nut=fixture({typ:'mutter',values:{d0:13,mSW:16,mH:8,mLoch:8.4,mM:10}});assert.equal(screen(nut.input,nut.context).ok,true);
 const review=coaxialDrawingTopology({cavityOpening:'through',requiredOperations:['axial-through-piercing']});assert.equal(screen({...nut.input,topology:review},{...nut.context,file}).ok,true);
});

test('a semi-tubular rivet or shaft-end cup can never be silently converted to a head cavity',()=>{
 for(const description of ['Halbhohlniet, Napf am Schaftende','semi-tubular rivet','rivetto semitubolare','polvotla zakovica','半空心铆钉']){
  const f=fixture({drawing:true,values:{sD:8,sL:30,kD:13,kH:5,nD:4,nT:10}});f.context.note+=' '+description;
  f.input.topology=coaxialDrawingTopology({cavityOpening:'head-end'});
  const r=screen(f.input,f.context);noCalculation(r);assert.equal(r.topology.status,'unsupported');assert.ok(r.topology.reasons.some(x=>/Schaftendnapf/.test(x)));
  delete f.input.values.nD;delete f.input.values.nT;f.input.topology.cavityOpening='none';noCalculation(screen(f.input,f.context));
 }
 const f=fixture({drawing:true});f.input.topology.cavityOpening='shaft-end';noCalculation(screen(f.input,f.context));
});

test('opening side and operation coverage are checked against cavity, drive and through-hole fields',()=>{
 const f=fixture({drawing:true,values:{sD:8,sL:30,kD:13,kH:5,nD:4,nT:3}});
 noCalculation(screen(f.input,f.context));f.input.topology.cavityOpening='head-end';assert.equal(screen(f.input,f.context).ok,true);
 f.input.nDurch=true;f.input.topology.cavityOpening='through';f.input.topology.requiredOperations=['axial-through-piercing'];noCalculation(screen(f.input,f.context));
 f.input.values.nT=35;f.input.evidence.nT={...f.input.evidence.nT,quote:'nT 35 mm',originalValue:35};f.context.note+='; nT 35 mm';assert.equal(screen(f.input,f.context).ok,true);
 f.input.topology.requiredOperations=[];noCalculation(screen(f.input,f.context));
 const drive=fixture({drawing:true,values:{sD:8,sL:30,kD:13,kH:5,iSW:4,iT:2}});noCalculation(screen(drive.input,drive.context));drive.input.topology.driveOpening='head-end';assert.equal(screen(drive.input,drive.context).ok,true);drive.input.topology.driveOpening='shaft-end';noCalculation(screen(drive.input,drive.context));
});

test('the flange drawing axis spacing of 0.5 mm is not accepted as a slot-width-only symmetric model',()=>{
 const f=fixture({typ:'formteil',drawing:true,values:{sD:5.9,sL:4.1,kD:9,kH:5,nD:4.9,nT:2.5}});
 f.context.note+=' Oberes Maß 0,5 +0,1: Abstand zweier Mittellinien von Innen-Ø4,9 und Außen-Ø5,9 (A/B). Detail X separat: 0,5 +0,3/-0,1 mit 75° +4°.';
 f.input.topology=coaxialDrawingTopology({cavityOpening:'head-end'});
 let r=screen(f.input,f.context);noCalculation(r);assert.equal(r.topology.status,'unsupported');assert.ok(r.topology.reasons.some(x=>/Achsenversatz/.test(x)));
 f.context.note='C15C';f.input.topology.axisOffsetMm=.5;r=screen(f.input,f.context);noCalculation(r);assert.equal(r.topology.status,'unsupported','positive offset overrides the contradictory coaxial declaration');
 const ordinary=fixture({drawing:true});ordinary.context.note+=' Maß 0,5 mm im Detail.';assert.equal(screen(ordinary.input,ordinary.context).ok,true,'the number 0.5 alone is not an eccentricity detector');
 ordinary.context.note+=' Keine Exzentrik, ohne Achsversatz.';assert.equal(screen(ordinary.input,ordinary.context).ok,true,'negative statements do not assert an offset');
});

test('special trimming cannot hide behind a standard hex head, turning flag or spare station',()=>{
 const f=fixture({drawing:true});f.input.kopfForm='abgratet';f.input.values.kSW=10;f.input.evidence.kSW={origin:'user_text',reference:'SW',quote:'kSW 10 mm',originalValue:10,originalUnit:'mm'};f.context.note+=' kSW 10 mm';
 f.input.topology.requiredOperations=['hex-head-trimming'];let r=screen(f.input,f.context);assert.equal(r.ok,true);assert.ok(r.proposal.stages.some(x=>x.operation==='Sechskant abgraten'));
 f.input.topology.requiredOperations=['hex-head-trimming','contour-trimming'];f.input.wenden=true;f.input.values.zusatz=1;f.input.evidence.zusatz={origin:'assumption',reference:'Reserve'};r=screen(f.input,f.context);noCalculation(r);assert.equal(r.topology.status,'unsupported');
 f.input.topology.requiredOperations=['hex-head-trimming'];f.context.note+=' Stadienbild: abgetrennter Ring und abgeflachter Bund.';r=screen(f.input,f.context);noCalculation(r);assert.ok(r.topology.reasons.some(x=>/Beschnitt/.test(x)));
});

test('topology has an explicit schema and no instruction can treat an unknown placement as a calculation assumption',async t=>{
 let calls=0;
 fetchMock(t,async(url,req)=>{const b=JSON.parse(req.body),schema=b.tools.find(x=>x.name==='grobauslegung').input_schema.properties.topology;assert.ok(schema.required.includes('cavityOpening'));assert.ok(schema.required.includes('engineCoverage'));assert.ok(schema.properties.cavityOpening.enum.includes('shaft-end'));assert.match(b.system,/Maßlinienenden/);assert.match(b.system,/Halbhohlniet/);return Response.json({content:calls++===0?[tool('projektwissen')]:[final('Eine koaxiale Zuordnung muss zuerst geprüft werden.')]});});
 const r=await analyse({message:'Wie liest man Achsenbezüge?'},environment());assert.equal(r.proposal,null);
 const f=fixture({drawing:true});f.input.topology={...f.input.topology,cavityOpening:'unknown'};noCalculation(screen(f.input,f.context));
});

test('newly discovered special topology invalidates a prior standard proposal and stays locked against relabeling',async t=>{
 const f=fixture({drawing:true});let calls=0;
 fetchMock(t,async(url,req)=>{
  const b=JSON.parse(req.body);calls++;
  if(calls===1)return Response.json({content:[tool('projektwissen')]});
  if(calls===2)return Response.json({content:[tool('grobauslegung',f.input)]});
  if(calls===3){assert.equal(JSON.parse(b.messages.at(-1).content[0].content).ok,true);return Response.json({content:[tool('grobauslegung',{...f.input,topology:{...f.input.topology,axisRelationship:'eccentric',axisOffsetMm:.5,requiredOperations:['eccentric-forming','contour-trimming']}})]});}
  if(calls===4){assert.equal(JSON.parse(b.messages.at(-1).content[0].content).topology.status,'unsupported');return Response.json({content:[tool('grobauslegung',f.input)]});}
  if(calls===5){assert.equal(JSON.parse(b.messages.at(-1).content[0].content).topology.status,'unsupported');return Response.json({content:[final('Die Abgratkraft beträgt 12 kN.')]});}
  return Response.json({content:[final('Qualitatives Konzept: Volumen vorverteilen, den Achsenversatz gezielt vorformen, Bund und Schaft ausformen, anschließend den Sonderbeschnitt zuordnen. Wenden und Gegenstempel sind dabei Teil des zu prüfenden Werkzeugkonzepts.')]});
 });
 const r=await analyse(f.context,environment(),{maxRounds:7});assert.equal(calls,6);assert.equal(r.proposal,null);assert.ok(!r.answer.includes('12 kN'));assert.match(r.answer,/Sonderbeschnitt/);assert.ok(!r.sources.some(x=>x.id==='engine'));
});

test('linked follow-up chat recognises its saved drawing and can review a supported form-part topology',async t=>{
 const f=fixture({typ:'formteil',drawing:true}),e=environment(),id='11111111-2222-4333-8444-555555555555';
 await e.SPEICHER.put('anfrage:'+id,JSON.stringify({id,kind:'preview',createdAt:new Date().toISOString(),note:f.context.note,language:'de',pricePolicy:'technical-only',siteOrigin:'https://jernyao.de',file:{key:'original',name:'drawing.pdf',type:'application/pdf',readable:true}}));
 let calls=0;fetchMock(t,async(url,req)=>{const b=JSON.parse(req.body);assert.equal(b.messages[0].content[1].type,'document');if(calls++===0)return Response.json({content:[tool('projektwissen')]});if(calls===2)return Response.json({content:[tool('grobauslegung',f.input)]});assert.equal(JSON.parse(b.messages.at(-1).content[0].content).ok,true);return Response.json({content:[final('Die koaxiale Testgeometrie ist als Rechenmodell zugeordnet.')]});});
 const response=await worker.fetch(new Request('https://worker.test/chat',{method:'POST',headers:{Origin:'https://jernyao.de'},body:JSON.stringify({requestId:id,token:await tokenFor(e,id),message:'Bitte diese Zeichnung weiter auslegen.'})}),e);assert.equal(response.status,200);assert.ok((await response.json()).proposal.machines.length);
});

test('known special geometry cannot bypass the calculation gate by answering with an invented force and no tool call',async t=>{
 let calls=0;fetchMock(t,async()=>{calls++;return Response.json({content:calls===1?[tool('projektwissen')]:[final(calls===2?'Die Exzenter-Presskraft beträgt 35 kN.':'Für die Exzentrik ist eine eigene Vorform vorgesehen; der Bundbeschnitt bleibt eine gesonderte Operation.')]});});
 const r=await analyse({note:'Exzentrisches Bundteil mit 0,5 mm Achsversatz.',file},environment());assert.equal(calls,3);assert.equal(r.proposal,null);assert.ok(!r.answer.includes('35 kN'));
});

test('recognising eccentricity in final prose removes an earlier symmetric proposal',async t=>{
 const f=fixture({drawing:true});let calls=0;
 fetchMock(t,async()=>Response.json({content:++calls===1?[tool('projektwissen')]:calls===2?[tool('grobauslegung',f.input)]:[final('Die Zeichnung zeigt zusätzlich Exzentrik. Das bisherige symmetrische Konzept bildet diese Form nicht ab; ein eigener Vorform- und Beschnittschritt ist zuzuordnen.')]}));
 const r=await analyse(f.context,environment());assert.equal(r.proposal,null);assert.match(r.answer,/Exzentrik/);assert.ok(!r.sources.some(x=>x.id==='engine'));
});
