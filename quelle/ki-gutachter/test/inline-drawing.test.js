import test from 'node:test';
import assert from 'node:assert/strict';
import {screen} from '../analysis.js';
import E from '../../engine.js';
function fixture(){
 const values={d0:8,rodDiameter:8.5,kD:13,kH:5,sD:8,sL:30};
 const evidence=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{origin:'user_text',quote:`${k} ${v} mm`,originalValue:v,originalUnit:'mm',reference:k}]));
 const note='C4C; weichgeglühter Walzdraht; Inline-Vorzug unmittelbar vor der Presse. '+Object.values(evidence).map(e=>e.quote).join('; ');
 const input={typ:'bolzen',material:'C4C',materialEvidence:{origin:'user_text',quote:'C4C'},curveId:E.findMaterial('C4C').flowCurves[0].id,materialState:'soft-annealed',materialStateEvidence:{origin:'user_text',quote:'weichgeglühter Walzdraht'},wirePreparation:'inline-drawing',wirePreparationEvidence:{origin:'user_text',quote:'Inline-Vorzug unmittelbar vor der Presse'},values,evidence};
 return {input,context:{note}};
}
test('agent incorporates customer-defined drawing mathematically without a machine approval blocker',()=>{
 const {input,context}=fixture(),r=screen(input,context);
 assert.equal(r.ok,true);assert.equal(r.proposal.calculation.input.wirePreparation,'inline-drawing');
 assert(Math.abs(r.proposal.calculation.materialStatus.preparation.prestrain-2*Math.log(8.5/8))<1e-12);
 assert(r.proposal.calculation.values.Fmax_t>0);
 assert(r.proposal.machines.every(m=>!m.openPoints.some(p=>p.id==='machine-inline-drawing')));
 assert(r.proposal.machines.every(m=>!m.criteria.some(c=>/Inline-Vorzug|Zieheinrichtung|Ziehgerät/.test(c.criterion))));
 assert(r.proposal.machines.every(m=>m.concept.preparation.rodDiameter===8.5));
 assert(r.proposal.machines.every(m=>m.concept.preparation.wireDiameter===8));
 assert.deepEqual(r.questions,[]);
});
test('wire route and feed diameter need evidence; unsupported later annealing is not ignored',()=>{
 for(const change of [f=>delete f.input.wirePreparationEvidence,f=>delete f.input.evidence.rodDiameter,f=>{f.input.values.rodDiameter=7;f.input.evidence.rodDiameter.originalValue=7;f.input.evidence.rodDiameter.quote='rodDiameter 7 mm';f.context.note+=' rodDiameter 7 mm';},f=>{f.context.note+=' Nach dem Vorzug wird weichgeglüht.';}]){
  const f=fixture();change(f);assert.equal(screen(f.input,f.context).ok,false);
 }
});
test('the initial rod condition remains distinct from the subsequent inline drawing operation',()=>{
 const f=fixture();f.context.note+=' Der Walzdraht wird dann inline gezogen.';
 assert(screen(f.input,f.context).proposal.calculation.values.Fmax_t>0);
 f.input.materialStateEvidence.quote='weichgeglüht';
 assert.equal(screen(f.input,f.context).ok,false,'a generic state quote does not identify the rod before drawing');
});
