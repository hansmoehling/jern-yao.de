import test from 'node:test';
import assert from 'node:assert/strict';
import {screen} from '../analysis.js';
import E from '../../engine.js';
import {coaxialDrawingTopology} from './topology-fixture.js';

function fixture(quote='normalisierend warmgewalzt'){
 const curve=E.findMaterial('20MnB4')?.flowCurves.find(curve=>curve.id==='komischke2019-20mnb4-normalized-rolled');
 assert(curve,'reviewed 20MnB4 profile must be built before running the state tests');
 const values={d0:8,kD:13,kH:5,sD:8,sL:30};
 const evidence=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{origin:'user_text',quote:`${key} ${value} mm`,originalValue:value,originalUnit:'mm',reference:key}]));
 const context={note:'20MnB4; '+quote+'; '+Object.values(evidence).map(item=>item.quote).join('; ')};
 const input={typ:'bolzen',material:'20MnB4',materialEvidence:{origin:'user_text',quote:'20MnB4'},curveId:curve.id,materialState:'normalized-rolled',materialStateEvidence:{origin:'user_text',quote},values,evidence};
 return {input,context,curve};
}

test('normalizing hot-rolled is an independently evidenced starting condition in all five languages',()=>{
 for(const quote of ['normalisierend warmgewalzt','normalizing hot-rolled','laminato normalizzante a caldo','normalizacijsko vroče valjano','正火热轧态']){
  for(const origin of ['user_text','drawing','assumption']){
   const {input,context,curve}=fixture(quote);input.materialStateEvidence={origin,quote,...(origin==='drawing'?{page:1}:{})};
   if(origin!=='user_text')context.note=context.note.replace(quote,'Ausgangszustand zur Auslegung');
   if(origin==='drawing'){context.file={type:'application/pdf',bytes:new Uint8Array()};input.topology=coaxialDrawingTopology();}
   const result=screen(input,context);assert.equal(result.ok,true,quote);const p=result.proposal;
   assert.equal(p.calculation.input.materialState,'normalized-rolled');assert.equal(p.calculation.materialStatus.flow,'ready');assert(p.calculation.values.Fmax_t>0);
   assert.equal(p.calculation.materialModel.selectedFlowCurve.id,curve.id);
   const state=p.input.find(item=>item.field==='materialState');assert.equal(state.value,'normalisierend warmgewalzt');assert.equal(state.origin,origin);assert.equal(state.quote,quote);
   assert.equal(!!state.assumption,origin==='assumption');assert(p.assumptions.some(text=>text.includes('Ausgangszustand: normalisierend warmgewalzt')));
   assert(!p.assumptions.some(text=>text.includes('für weichgeglühten Draht')||text.includes('0,0336')),'curve basis is neither annealed nor hardcoded to the AISI rate');
  }
 }
});

test('plain normalized, annealed, drawn, tempered and negated states cannot release the normalizing-rolled curve',()=>{
 const states=['normalisiert','normalized','normalgeglüht','warmgewalzt','hot-rolled','weichgeglüht','kaltgezogen','vergütet','nicht normalisierend warmgewalzt','not normalized-rolled','non laminato normalizzante a caldo','ni normalizacijsko vroče valjano','非正火热轧态','normalisierend warmgewalzt, danach weichgeglüht','normalized-rolled, then cold-drawn'];
 for(const quote of states){const {input,context}=fixture(quote),r=screen(input,context);assert(!Number.isFinite(r.proposal?.calculation.values.Fmax_t),quote);}
 const invented=fixture('weichgeglüht');invented.input.materialStateEvidence.quote='normalisierend warmgewalzt';assert.equal(screen(invented.input,invented.context).proposal.calculation.values.Fmax_t,null);
 const substring=fixture('nicht normalisierend warmgewalzt');substring.input.materialStateEvidence.quote='normalisierend warmgewalzt';assert.equal(screen(substring.input,substring.context).proposal.calculation.values.Fmax_t,null);
 for(const quote of ['normalisierend warmgewalzt, nicht weichgeglüht','normalized-rolled, not annealed']){const f=fixture(quote);assert(screen(f.input,f.context).proposal.calculation.values.Fmax_t>0,quote);}
 const wrongCurve=fixture();wrongCurve.input.curveId=E.findMaterial('C15C').flowCurves[0].id;assert.equal(screen(wrongCurve.input,wrongCurve.context).proposal.calculation.values.Fmax_t,null);
 const wrongState=fixture();wrongState.input.materialState='soft-annealed';wrongState.input.materialStateEvidence={origin:'assumption',quote:'weichgeglüht'};assert.equal(screen(wrongState.input,wrongState.context).proposal.calculation.values.Fmax_t,null);
});

test('normalizing-rolled rod is evidenced before inline drawing, not overwritten by the later draw',()=>{
 const f=fixture('normalisierend warmgewalzter Walzdraht');
 f.input.wirePreparation='inline-drawing';f.input.wirePreparationEvidence={origin:'user_text',quote:'Inline-Vorzug unmittelbar vor der Presse'};
 f.input.values.rodDiameter=8.5;f.input.evidence.rodDiameter={origin:'user_text',quote:'rodDiameter 8.5 mm',originalValue:8.5,originalUnit:'mm',reference:'rodDiameter'};
 f.context.note+='; Inline-Vorzug unmittelbar vor der Presse; rodDiameter 8.5 mm. Der Walzdraht wird dann inline gezogen.';
 const result=screen(f.input,f.context);assert.equal(result.ok,true);const p=result.proposal;
 assert.equal(p.calculation.input.materialState,'normalized-rolled');assert.equal(p.calculation.materialStatus.flow,'ready');assert(p.calculation.values.Fmax_t>0);
 assert(Math.abs(p.calculation.materialStatus.preparation.prestrain-2*Math.log(8.5/8))<1e-12);
 assert(p.machines.every(machine=>machine.concept.preparation.type==='inline-drawing'));
 f.input.materialStateEvidence={origin:'assumption',quote:'Prozessvorschlag: normalisierend warmgewalzten Walzdraht verwenden.'};
 assert(screen(f.input,f.context).proposal.calculation.values.Fmax_t>0);
 const conflictingContext={...f.context,note:f.context.note.replace('normalisierend warmgewalzter Walzdraht','weichgeglühter Walzdraht')};
 assert(!Number.isFinite(screen(f.input,conflictingContext).proposal?.calculation.values.Fmax_t),'a scoped process assumption does not override an explicitly annealed starting rod');
 f.input.materialStateEvidence.quote='normalisierend warmgewalzt';assert.equal(screen(f.input,f.context).ok,false,'unscoped evidence does not identify the starting rod');
 f.input.materialStateEvidence={origin:'user_text',quote:'normalisierend warmgewalzter Walzdraht'};
 f.context.note+=' Nach dem Vorzug wird weichgeglüht.';assert.equal(screen(f.input,f.context).ok,false);
});

test('a negated inline route never becomes affirmative evidence or a process assumption',()=>{
 const phrases=[['kein Inline-Vorzug','Inline-Vorzug'],['no inline drawing','inline drawing'],['senza trafilatura in linea','trafilatura in linea'],['brez predvleka','predvleka'],['无需在线拉拔','在线拉拔']];
 for(const [negative,substring]of phrases){
  for(const origin of ['user_text','drawing','assumption']){
   const f=fixture('normalisierend warmgewalzter Walzdraht');
   f.input.wirePreparation='inline-drawing';f.input.wirePreparationEvidence={origin,quote:negative,...(origin==='drawing'?{page:1}:{})};
   f.input.values.rodDiameter=8.5;f.input.evidence.rodDiameter={origin:'user_text',quote:'rodDiameter 8.5 mm',originalValue:8.5,originalUnit:'mm',reference:'rodDiameter'};
   f.context.note+='; rodDiameter 8.5 mm; '+negative;
   if(origin==='drawing')f.context.file={type:'application/pdf',bytes:new Uint8Array()};
   assert.equal(screen(f.input,f.context).ok,false,origin+': '+negative);
   f.input.wirePreparationEvidence.quote=substring;
   assert.equal(screen(f.input,f.context).ok,false,'an affirmative substring cannot reverse the original negation: '+negative);
  }
 }
});
