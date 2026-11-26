const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Q=path.join(__dirname,'..'),catalog={};
for(const name of fs.readdirSync(Q).filter(name=>/^i18n-.*\.json$/.test(name)).sort())Object.assign(catalog,JSON.parse(fs.readFileSync(path.join(Q,name),'utf8').replace(/^\uFEFF/,'')));
// Load source catalogues in memory; release generation is owned by the build.
const context={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(Q,'i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalog)),context);
const I=context.module.exports,sandbox={window:{JYI18N:I}};
vm.runInNewContext(fs.readFileSync(path.join(Q,'concept-ui.js'),'utf8'),sandbox);
const C=sandbox.window.JYConcept,E=require('../engine.js'),machines=require('../maschinen.json'),practice=require('../praxis.json');
const material=E.findMaterial('C15C'),base={typ:'bolzen',wst:E.WERKSTOFFE.indexOf(material),curveId:material.flowCurves[0].id,materialState:'soft-annealed',rm:400,d0:8,sD:8,sL:30,kD:13,kH:5,kopfForm:'rund',vorgaben:{},soll:{}};
const german=/Gleiche berechnete|Umformstufen|benötigte|Maschinenstationen|frei als|Innenantrieb|Tiefe|Kopf fertig|Vorstauchen|Reduzieren|Kreuzschlitz|Bohrung am|Schaftend-Napfwand|im Kopf|Kopf \/ Bund|Schaft \/ Körper/;

test('complete stage operations and nested drive names render in each selected language',()=>{
 const inputs=[{...base,d0:9},{...base,iTyp:'hex',iSW:5,iT:3},{...base,iTyp:'ph',iSize:'PH2',iT:3,iVol:20},{...base,iTyp:'pz',iSize:'PZ2',iT:3,iVol:20},{...base,shaftSegments:[{diameter:8,length:15},{diameter:6,length:15}],schaftende:'halbhohl',d_b:3,t_b:8}];
 for(const input of inputs){
  const result=E.auslegen(input);assert.deepEqual(result.fehlt,[]);assert(result.stufen.length);
  for(const language of I.supported)for(const stage of result.stufen){
   const text=C.stageText(stage,language),locations=C.locationText(stage,language);assert(text);
   if(language!=='de'){assert(!german.test(text),language+': '+text);assert(!german.test(locations),language+': '+locations);}
   if(stage.v.includes('PH2'))assert(text.includes('PH2'));
   if(stage.v.includes('PZ2'))assert(text.includes('PZ2'));
  }
 }
 const combined=E.auslegen(inputs[0]).stufen.find(stage=>stage.operationParts);assert.equal(combined.operationParts.length,2);
 for(const language of I.supported)assert.equal(C.stageText(combined,language),C.stageText({operation:combined.v},language),'saved results without metadata remain readable');
});

test('machine concept rationale translates whole sentences, including the reported Slovenian drive case',()=>{
 const source='Gleiche berechnete Basisfolge: 2 Umformstufen; 2 benötigte Stationen auf 3 Maschinenstationen; 1 frei als Reserve. Innenantrieb: Innensechskant SW 5 mm, Tiefe 3 mm.';
 for(const language of I.supported){
  const text=C.rationaleText({rationale:source},language);assert(text.includes('2'));assert(text.includes('5 mm'));assert(text.includes('3 mm'));
  if(language==='de')assert.equal(text,source);else assert(!german.test(text),language+': '+text);
 }
 assert(C.rationaleText({rationale:source},'sl').includes('Enako izračunano osnovno zaporedje'));
 const input={...base,iTyp:'hex',iSW:5,iT:3},result=E.auslegen(input),selected=E.waehle(machines,result,input,practice),row=[...selected.passend,...selected.bedingt][0];assert(row);
 const concept=E.maschinenKonzept(result,input,row.o,practice);assert(concept.rationaleParts.length>=2);assert.equal(concept.rationaleParts.join(' '),concept.rationale);
 for(const language of I.supported){const html=C.html(concept,language);assert(html.includes(row.o.st));if(language!=='de')assert(!german.test(html),language+': '+html);}
});

test('multi-operation locations are translated independently and arbitrary text remains escaped',()=>{
 const stage={number:1,operation:'Kopf fertigstauchen mit Innensechskant SW 5 mm, Tiefe 3 mm',operations:[{name:'Kopf fertigstauchen',location:'Kopf / Bund'},{name:'Innenantrieb formen',location:'Innensechskant SW 5 mm, Tiefe 3 mm; im Kopf / Bund'}]};
 for(const language of I.supported){
  const html=C.html({status:'candidate',stages:[stage]},language);if(language!=='de')assert(!german.test(html),language+': '+html);
  const unsafe=C.html({status:'incomplete',stages:[{operation:'<img src=x onerror=bad()>',number:1}],rationale:'<script>bad()</script>'},language);assert(!unsafe.includes('<img'));assert(!unsafe.includes('<script>'));assert(unsafe.includes('&lt;img'));
 }
});
