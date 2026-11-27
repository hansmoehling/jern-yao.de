'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../engine.js'),N=require('../normen/library.js'),R=require('../normen/resolver.js'),W=require('../vorbelegung/draht.js');
const catalogue=require('../maschinen.json');
const data={...require('../normen/index.json'),families:[require('../normen/ISO10642.json')],threads:require('../normen/gewinde.json')};
const values=rows=>rows.map(row=>row.value);
function countersunk(extra={}){
 const selection={id:'ISO10642',groesse:'M6',laenge:20,festigkeitsklasse:'10.9'};
 const preset=N.adapt(data,R.resolveStandard(N.selectionLibrary(data,selection),selection));
 const material=E.findMaterial('34CrMo4'),curve=material.flowCurves.find(row=>row.state==='soft-annealed');
 return {...preset,typ:'bolzen',wst:E.WERKSTOFFE.indexOf(material),curveId:curve.id,materialState:curve.state,rmPolicy:'rm-v2',forcePolicy:'force-v2',machinePolicy:'ranking-v2',kopfTyp:preset.kopfTyp||preset.kopfForm,vorgaben:{},soll:{},wirePreparation:'as-supplied',...extra};
}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const outside=()=>({fehlt:[],stufen:[{F:null}],materialStatus:{flow:'strain-outside-range'}});
const ready=()=>({fehlt:[],stufen:[{F:100},{F:200}],materialStatus:{flow:'ready'}});

test('ISO10642 M6x20 10.9 finds 6.4 mm and three actual operations without changing part or material',()=>{
 const input=freeze(countersunk()),saved=structuredClone(input),calls=[];
 const original=W.candidates(input,null,catalogue),baseline=E.auslegen({...input,d0:original[0].value});
 assert.equal(original[0].value,5.6);assert.equal(baseline.materialStatus.flow,'strain-outside-range');assert.ok(baseline.stufen.some(stage=>stage.F===null));
 const result=W.candidates(input,null,catalogue,{evaluate:e=>{calls.push(structuredClone(e));return E.auslegen(e);}}),best=result[0],alternative=E.auslegen({...input,d0:best.value});
 assert.equal(best.value,6.4);assert.equal(best.forceRoute.stations,3);assert.equal(best.forceRoute.baselineDiameter,5.6);assert.equal(best.forceRoute.reason,'strain-range');assert.equal(best.origin,'assumption');assert.equal(best.provisional,true);
 assert.deepEqual(result.slice(1),original,'the original thin and thick routes remain available');assert.equal(new Set(values(result)).size,result.length);
 assert.equal(alternative.stufen.length,3);assert.ok(alternative.stufen.every(stage=>stage.F>0&&Number.isFinite(stage.F)));assert.match(alternative.stufen[0].v,/Vorwärtsfließpressen Schaft/);assert.equal(alternative.materialStatus.flow,'ready');
 for(const key of ['V','masse','Lteil','kopfD','lStempel','lMatrize','ko','pko'])assert.equal(alternative.werte[key],baseline.werte[key],key+' is a part or tool-layout property');
 assert.equal(alternative.werte.V,Math.PI/4*best.value**2*alternative.werte.L0);
 assert.equal(alternative.werkstoff.id,baseline.werkstoff.id);assert.equal(alternative.werkstoff.selectedFlowCurve.id,baseline.werkstoff.selectedFlowCurve.id);assert.equal(alternative.werkstoff.selectedMaterialState,baseline.werkstoff.selectedMaterialState);
 assert.deepEqual(input,saved);for(const call of calls)assert.deepEqual(call,{...saved,d0:call.d0});
 assert.equal(calls.length,9,'one baseline and eight bounded 0.1 mm candidates, not a catalogue-wide search');assert.deepEqual(calls.map(c=>c.d0),[5.6,5.7,5.8,5.9,6,6.1,6.2,6.3,6.4]);
});

test('customer wire, tensile strength, delivery condition and tooling values are never overwritten',()=>{
 const input=freeze(countersunk({d0:7.2,rm:620,rmDeliveryCondition:'+AC+C+AC',inputOrigins:{d0:{origin:'customer'}},vorgaben:{ko:40,pko:5},soll:{ausbringung:35}})),saved=structuredClone(input),calls=[];
 const result=W.candidates(input,null,catalogue,{evaluate:e=>{calls.push(structuredClone(e));return E.auslegen(e);}});
 assert.ok(result[0].forceRoute);assert.deepEqual(input,saved);assert.equal(input.d0,7.2);assert.equal(input.inputOrigins.d0.origin,'customer');
 for(const call of calls){assert.deepEqual(call,{...saved,d0:call.d0});assert.equal(call.rm,620);assert.equal(call.rmDeliveryCondition,'+AC+C+AC');assert.deepEqual(call.vorgaben,{ko:40,pko:5});}
});

test('legacy policies, absent evaluator, nuts and form parts retain exactly the prior candidates',()=>{
 for(const extra of [{rmPolicy:undefined},{rmPolicy:'rm-v1'},{rmPolicy:true},{forcePolicy:undefined},{forcePolicy:'force-v1'},{forcePolicy:true},{typ:'mutter',mSW:16},{typ:'formteil'}]){
  const input=countersunk(extra),geometry={elements:[{operation:'add',shape:'cylinder',diameter:8,length:20}]};let calls=0;
  const expected=W.candidates(input,geometry,catalogue),actual=W.candidates(input,geometry,catalogue,{evaluate(){calls++;throw Error('No evaluation under a legacy or unrelated policy');}});
  assert.deepEqual(actual,expected);assert.equal(calls,0);
 }
 const input=countersunk();for(const options of [undefined,{}, {evaluate:false}])assert.deepEqual(W.candidates(input,null,catalogue,options),W.candidates(input,null,catalogue));
});

test('missing dimensions, qualitative models and other material failures cannot trigger rerouting',()=>{
 const input=countersunk(),expected=W.candidates(input,null,catalogue);
 for(const baseline of [{...outside(),fehlt:['Schaftlänge']},{...outside(),qualitative:true},{...outside(),stufen:[]},...['ready','state-mismatch','selection-missing','strain-rate-missing','unknown'].map(flow=>({...outside(),materialStatus:{flow}}))]){
  let calls=0;const actual=W.candidates(input,null,catalogue,{evaluate(){calls++;return baseline;}});assert.deepEqual(actual,expected);assert.equal(calls,1);
 }
});

test('a route is promoted only after every stage has a finite positive calculated force',()=>{
 const input=countersunk(),bad=[{...ready(),fehlt:['Maß']},{...ready(),qualitative:true},{...ready(),stufen:[]},{...ready(),materialStatus:{flow:'strain-outside-range'}},...[null,0,-1,NaN,Infinity].map(F=>({...ready(),stufen:[{F:100},{F}]}))];
 for(const rejected of bad){let calls=0;const result=W.candidates(input,null,catalogue,{evaluate(){calls++;return calls===1?outside():calls===2?rejected:ready();}});assert.equal(result[0].value,5.8);assert.equal(calls,3);assert.equal(result[0].forceRoute.stations,2);}
 let calls=0;const result=W.candidates(input,null,catalogue,{evaluate(){return ++calls===1?outside():ready();}});
 assert.equal(result[0].value,5.7);assert.equal(values(result).filter(d=>d===5.7).length,1,'the promoted neighbour does not appear twice');
});

test('search cost and diameters stay bounded by head, catalogue and one hundred attempts',()=>{
 const base={typ:'bolzen',standardKind:'screw',sD:1,kD:100,rmPolicy:'rm-v2',forcePolicy:'force-v2'};
 for(const [head,limit,expected]of [[100,500,101],[1.35,500,3],[100,1.35,3],[undefined,500,1]]){
  const input={...base,kD:head},calls=[];const result=W.candidates(input,null,[{cd:limit}],{evaluate:e=>{calls.push(e.d0);return outside();}});
  assert.equal(calls.length,expected);assert.ok(calls.every(d=>d<=Math.min(head||1.1,limit)));assert.ok(!result.some(row=>row.forceRoute));
 }
});

test('browser and Node produce the same calculated route and provenance from the same inputs',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../vorbelegung/draht.js'),'utf8'),context={window:{}};
 vm.runInNewContext(source.replace('/*WIRE_PRESETS_BEGIN*/null/*WIRE_PRESETS_END*/',JSON.stringify(require('../vorbelegung/draht.json'))),context);
 const input=countersunk(),options={evaluate:E.auslegen};
 assert.equal(JSON.stringify(context.window.JYWireDefaults.candidates(input,null,catalogue,options)),JSON.stringify(W.candidates(input,null,catalogue,options)));
});

test('generated Rm check paragraphs translate all statuses and preserve exact condition and interval in five languages',()=>{
 const I=require('../i18n.js'),machine=catalogue.find(row=>row.m==='JBF-10B3S'),numbers=text=>text.match(/\d+(?:[.,]\d+)?/g);
 assert.deepEqual(I.supported,['de','it','sl','en','zh']);
 const starts={it:'Intervallo Rm secondo norma',sl:'Območje Rm po standardu',en:'Standard-based Rm band',zh:'标准Rm范围'};
 for(const patch of [{d0:4.7},{d0:6.4,rmDeliveryCondition:'+AC'}]){
  const input=countersunk(patch),calculation=E.auslegen(input),preset=calculation.werkstoff.rmVorbelegung;
  assert.equal(preset.origin,'standard');
  const conditions=patch.rmDeliveryCondition?{de:'ausgewählt',it:'selezionato',sl:'izbrano',en:'selected',zh:'已选择'}:{de:'angenommen',it:'assunto',sl:'predpostavljeno',en:'assumed',zh:'为假设'};
  for(const [cd,status]of [[null,'offen'],[input.d0-.1,'nein'],[20,'ok'],[input.d0/.94,'offen']]){
   const check=E.pruefe({...machine,cd},calculation,input).k.find(row=>row.krit==='Abschnitt-Ø');assert.equal(check.status,status);
   for(const language of I.supported){
    const paragraph=I.t(check.detail,language);
    assert.ok(paragraph.includes(preset.source.standard),language+' retains the exact standard edition');assert.ok(paragraph.includes(preset.deliveryCondition),language+' retains the entire delivery sequence');
    assert.ok(paragraph.includes(conditions[language]),language+' distinguishes assumed from selected condition');
    assert.deepEqual(numbers(paragraph),numbers(check.detail),language+' retains Rm and both interval bounds');
    assert.ok(paragraph.includes('N/mm²'));assert.ok(paragraph.includes(' < d ≤ '));assert.doesNotMatch(paragraph,/\{[^}]+\}/);
    if(language==='de')assert.equal(paragraph,check.detail);
    else{assert.ok(paragraph.startsWith(starts[language]),language);assert.doesNotMatch(paragraph,/Normbasiert|Lieferzustand|angenommen|ausgewählt|Katalogdurchmesser|Prüfstatus|Bandgrenzen|Abschnitt-Ø/);}
   }
  }
 }
});

test('the actual thicker-wire route description translates without losing diameter or stage count',()=>{
 const I=require('../i18n.js'),route=W.candidates(countersunk(),null,catalogue,{evaluate:E.auslegen})[0];assert.equal(route.value,6.4);assert.equal(route.forceRoute.stations,3);
 const paragraph=route.reason.replace(/\{(\w+)\}/g,(_,key)=>String(route.params[key]).replace('.',','));
 const starts={it:'Alternativa di processo:',sl:'Alternativni postopek:',en:'Alternative process:',zh:'备选工艺：'};
 for(const language of I.supported){
  const translated=I.t(paragraph,language);assert.ok(translated.includes('6,4'));assert.ok(translated.includes('3'));assert.ok(translated.includes('mm'));assert.doesNotMatch(translated,/\{[^}]+\}/);
  assert.deepEqual(translated.match(/\d+(?:[.,]\d+)?/g),paragraph.match(/\d+(?:[.,]\d+)?/g));
  if(language==='de')assert.equal(translated,paragraph);
  else{assert.ok(translated.startsWith(starts[language]));assert.doesNotMatch(translated,/Prozessalternative|Draht|reduziert|Stauchanteil|Stadien|vollständigem|Kraftansatz/);}
 }
});
