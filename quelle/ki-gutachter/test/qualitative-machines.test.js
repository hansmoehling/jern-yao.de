import test from 'node:test';
import assert from 'node:assert/strict';
import {analyse,publicResult} from '../analysis.js';
import {catalogModel,qualitativeCatalog,qualitativeMachineCards,withQualitativeMachines} from '../qualitative-machines.js';

const A='JPF-10B5S',B='JBP-13B5S';
const env=()=>({ANTHROPIC_API_KEY:'test-only',SPEICHER:{async get(key){return {regeln:'Geometrische Stadienfolge prüfen.',wissenskarten:'Auswerfer und Transfer anhand der Zwischenformen prüfen.'}[key]||null;}}});
function mock(t,answer,{suggestions,inspect}={}){
 const original=globalThis.fetch;let count=0;
 globalThis.fetch=async(url,request)=>{
  const body=JSON.parse(request.body);inspect?.(body,count);
  return Response.json({content:count++===0?[{type:'tool_use',id:'knowledge',name:'projektwissen',input:{}}]:[{type:'text',text:JSON.stringify({answer,questions:[],sourceIds:['engine'],...(suggestions?{machineSuggestions:suggestions}:{})})}]});
 };
 t.after(()=>{globalThis.fetch=original;});
 return ()=>count;
}

test('affirmative catalog models become qualitative cards without any calculated values',()=>{
 const answer=`Als geometrischer Anfragekandidat kommt ${A} in Betracht. ${B} ist ebenfalls ein möglicher Kandidat; die Familie klären die Technologen in Taiwan.`;
 const cards=qualitativeMachineCards(answer);
 assert.deepEqual(cards.map(c=>c.model),[A,B]);
 for(const card of cards){
  assert.equal(card.selectionBasis,'qualitative');assert.equal(card.status,'offen');
  assert.equal(card.utilization,null);assert.equal(card.planningOutput,null);assert.equal(card.concept,null);
  assert.deepEqual(card.criteria,[]);assert.equal(card.catalog.id,catalogModel(card.model).kat);
  assert.equal(card.catalogSpecs.nominalCutoffDiameterMm,catalogModel(card.model).cd);
 }
 const proposal=withQualitativeMachines(null,cards,'test');
 assert.equal(proposal.classification,'qualitative');assert.equal(proposal.calculation,null);assert.deepEqual(proposal.stages,[]);
});

test('positive model mentions are recognised in all five response languages',()=>{
 for(const answer of [`${A} ist ein plausibler Kandidat.`,`${A} is a candidate for further enquiry.`,`${A} è un candidato da valutare.`,`${A} je primeren kandidat za preverjanje.`,`${A} 可作为候选机型。`])assert.equal(qualitativeMachineCards(answer)[0]?.model,A,answer);
 assert.equal(qualitativeMachineCards('JPF 10B5S ist ein plausibler Kandidat.')[0]?.model,A);
 assert.equal(qualitativeMachineCards('JPF–10B5S ist ein plausibler Kandidat.')[0]?.model,A);
});

test('negative, unknown, neutral, quoted and question-only mentions never produce cards',()=>{
 for(const answer of [`${A} ist nicht zu empfehlen.`,`${A} würde ich nicht anfragen.`,`${A} 不建议选用。`,`${A} ist ein Kandidat, passt jedoch nicht.`])assert.deepEqual(qualitativeMachineCards(answer),[],answer);
 for(const answer of [`${A} ist nicht geeignet.`,`${A} ist kein Kandidat.`,`${A} is not a feasible option.`,`${A} non è adatta.`,`${A} ni primeren.`,`${A} 不适合。`,`${A} steht im Katalog.`,`Ist ${A} geeignet?`,`Der Kunde fragt: "${A} ist geeignet".`,`JPF-999B99S ist ein Kandidat.`])assert.deepEqual(qualitativeMachineCards(answer),[],answer);
 const answer=`${A} ist geeignet. ${A} scheidet aus.`;
 assert.deepEqual(qualitativeMachineCards(answer,[{model:A,reason:`${A} ist geeignet.`}]),[]);
 assert.deepEqual(qualitativeMachineCards(`${A} ist ungeeignet, aber ${B} ist ein Kandidat.`).map(c=>c.model),[B]);
});

test('explicit final suggestions accept model headings with a separate literal reason',()=>{
 const reason='Fünf Stationen für das geometrische Konzept; Auswerferdetails klärt Taiwan.';
 const answer=`### ${A}\n${reason}`;
 const cards=qualitativeMachineCards(answer,[{model:A,reason}]);
 assert.equal(cards.length,1);assert.equal(cards[0].reason,reason);
 assert.deepEqual(qualitativeMachineCards(answer,[{model:B,reason}]),[],'model must occur in answer');
 assert.deepEqual(qualitativeMachineCards(answer,[{model:A,reason:'invented reason'}]),[],'reason must occur in answer');
 assert.deepEqual(qualitativeMachineCards(`### ${A}\n${reason}\n${A} ist ausgeschlossen.`,[{model:A,reason}]),[]);
 assert.deepEqual(qualitativeMachineCards(`### ${A}\nNicht geeignet.\n${reason}`,[{model:A,reason}]),[]);
});

test('hard numerical exclusions and existing cards cannot be promoted or duplicated',()=>{
 const answer=`${A} ist ein Kandidat. ${B} ist ein Kandidat.`;
 for(const row of [{model:A,status:'nein'},{model:A,status:'offen',concept:{status:'excluded'}},{model:A,status:'offen',criteria:[{status:'nein'}]}]){
  const proposal={calculation:{input:{test:true}},machines:[row]};
  const cards=qualitativeMachineCards(answer,[],proposal);
  assert.deepEqual(cards.map(c=>c.model),[B]);
  const merged=withQualitativeMachines(proposal,cards,'test');assert.equal(merged.calculation,proposal.calculation);assert.equal(merged.machines[0],row);
 }
 assert.deepEqual(qualitativeMachineCards(`${A} ist ein Kandidat.`,[],null,new Set([A])),[]);
});

test('a model omitted from numerical rows cannot bypass already known mechanical limits',()=>{
 const answer='JBF-7B2S ist ein möglicher Kandidat.';
 const calculate=values=>qualitativeMachineCards(answer,[],{calculation:{input:{d0:8},values},stages:Array(5).fill({}),machines:[]});
 assert.deepEqual(calculate({d0:8,L0:30,stationen:5}),[]);
 assert.deepEqual(calculate({d0:4,L0:100,stationen:2}),[]);
 assert.deepEqual(calculate({d0:4,L0:30,stationen:2,ko:1000,koVorgabe:true}),[]);
 assert.deepEqual(calculate({d0:4,L0:30,stationen:2,pko:1000,pkoVorgabe:true}),[]);
 assert.equal(calculate({d0:4,L0:30,stationen:2,ko:1000,pko:1000})[0]?.model,'JBF-7B2S','unconfirmed ejection assumptions alone do not create a new exclusion');
 assert.equal(calculate({d0:4,L0:30,stationen:2})[0]?.model,'JBF-7B2S');
});

test('compact catalog includes real diameter, stations, length, knockout and turning fields, no prices',()=>{
 const data=qualitativeCatalog(),model=catalogModel(A),row=data.rows.find(r=>r[0]===A);
 const spec=Object.fromEntries(data.columns.map((key,index)=>[key,row[index]]));
 assert.equal(spec.nominalCutoffDiameterMm,model.cd);assert.equal(spec.stations,model.st);assert.deepEqual(spec.cutoffLengthMm,model.cl);
 assert.equal(spec.dieKnockoutMm,model.ko);assert.equal(spec.punchKnockoutMm,model.pko);assert.equal(spec.turningLengthMm,model.kor);
 assert.ok(!data.columns.some(key=>/price|cost/i.test(key)));
 const missing=data.rows.find(row=>row[0]==='JNF-8B5S');assert.equal(missing[data.columns.indexOf('punchKnockoutMm')],null);
});

test('no-material analysis returns both family candidates, real catalog sources and no fabricated engine source',async t=>{
 const answer=`${A} und ${B} sind qualitative Anfragekandidaten für den Drahtschnitt und das Stadienkonzept. Die endgültige Familienwahl bei offener Produktlänge und Auswerferdetails übernehmen die Technologen in Taiwan.`;
 const calls=mock(t,answer,{inspect(body,round){
  assert.match(body.system,/Nennmaß des Drahtschnitts/);assert.match(body.system,/Stufen deines geometrischen Stadienkonzepts/);assert.match(body.system,/Technologen in Taiwan/);
  assert.match(body.system,/nach projektwissen direkt aus catalogModels antworten/);
  assert.doesNotMatch(body.system,/echte Maschinen mit grobauslegung prüfen/);
  if(round){const knowledge=JSON.parse(body.messages.at(-1).content[0].content);assert.ok(knowledge.catalogModels.rows.length>100);assert.match(knowledge.note,/jetzt direkt die Schlussantwort/);assert.match(knowledge.note,/Keine weitere Projektwissen-, Recherche- oder Grobauslegungsrunde allein wegen fehlendem Werkstoff/);}
 }});
 const result=await analyse({message:'Werkstoff fehlt; geometrisch fünf Stationen und Drahtschnitt 8 mm. Welche Maschine?',pricePolicy:'with-prices'},env());
 assert.equal(calls(),2);assert.deepEqual(result.proposal.machines.map(c=>c.model),[A,B]);
 assert.equal(result.proposal.calculation,null);assert.ok(!result.sources.some(s=>s.id==='engine'));
 for(const card of result.proposal.machines)assert.ok(result.sources.some(s=>s.id==='catalog:'+card.catalog.id));
 assert.ok(result.proposal.machines.every(card=>card.priceEUR>0));
 const restricted=publicResult(result,{pricePolicy:'technical-only'});
 for(const card of restricted.proposal.machines){assert.ok(!('priceEUR'in card));assert.ok(!('priceRangeEUR'in card));}
 assert.deepEqual(restricted.proposal.machines.map(c=>c.model),[A,B]);
});

test('technical-only analysis strips qualitative prices while preserving the same cards',async t=>{
 mock(t,`${A} ist ein geometrischer Anfragekandidat.`);
 const result=await analyse({message:'Fünf geometrische Stationen, Werkstoff unbekannt.',pricePolicy:'technical-only'},env());
 assert.equal(result.proposal.machines[0].model,A);assert.ok(!('priceEUR'in result.proposal.machines[0]));assert.ok(!('priceRangeEUR'in result.proposal.machines[0]));
});

test('negative known model discussion is accepted as prose without turning it into an enquiry',async t=>{
 const calls=mock(t,`${A} ist für dieses Konzept ausgeschlossen.`);
 const result=await analyse({message:'Welches Modell scheidet aus?'},env());
 assert.equal(calls(),2);assert.equal(result.proposal,null);assert.match(result.answer,/ausgeschlossen/);
});
