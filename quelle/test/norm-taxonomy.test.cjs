const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const N=require('../normen/library.js'),R=require('../normen/resolver.js');
const source=path.join(__dirname,'..'),families=fs.readdirSync(path.join(source,'normen')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(source,'normen',f),'utf8'))).filter(f=>f.id&&f.groessen);
const data={schemaVersion:1,version:'taxonomy-test',families,threads:require('../normen/gewinde.json')};
const catalog=Object.assign({},...fs.readdirSync(source).filter(f=>/^i18n-.*\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(path.join(source,f),'utf8')))),moduleI={exports:{}};
new Function('module',fs.readFileSync(path.join(source,'i18n-runtime.js'),'utf8').replace('/*CATALOG*/',JSON.stringify(catalog)))(moduleI);const I=moduleI.exports;
const resolve=(selection,previous={})=>R.resolveStandard(N.selectionLibrary(data,selection),selection,previous,{shaftPolicy:'shaft-v2'});

test('P5 each actual norm function has a direct selector family without changing its technical engine kind',()=>{
 const expected={schraube:'screw',niet:'rivet',stift:'pin',gewindestift:'set-screw',stehbolzen:'stud',schweissbolzen:'weld-stud',mutter:'nut'};
 for(const family of families){const key=expected[family.funktion];assert(key,family.id+' unsupported function');assert.equal(N.familyFunction(family),key);assert.equal(N.functionKind(key),N.familyKind(family));}
 for(const [source,key]of Object.entries(expected)){
  const available=N.functionFamilies(data,key);assert(available.length);
  assert(available.every(f=>f.funktion===source));assert(!available.some(f=>['rivet-size-series','invalid-reference'].includes(f.datasetKind)));
 }
 assert.deepEqual(N.functionFamilies(data,'free'),[]);assert.equal(N.familyFunction({id:'UNKNOWN',kopfTyp:'kopflos'}),'free','a head shape cannot invent a product function');
 assert.equal(N.familyFunction({funktion:'schweißbolzen'}),'weld-stud');
});

test('P5 every missing norm field is understandable and translated in all five languages',()=>{
 const missing=new Set(),walk=value=>{if(value&&typeof value==='object'){for(const key of value.missingGeometryFields||[])missing.add(key);for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);}};
 families.forEach(walk);assert(missing.has('headProfileRadius'));missing.add('verifiedBoreDepth'); // Older saved references still use this translated gap label.
 for(const key of missing){const label=N.missingLabel(key);assert.notEqual(label,key);assert.notEqual(label,'Weiteres Geometriemaß',key+' must have a specific label');for(const lang of I.supported.slice(1)){const translated=N.missingLabel(key,text=>I.t(text,lang));assert.notEqual(translated,label,key+' '+lang);}}
 for(const key of ['pin','set-screw','stud','weld-stud','free'])for(const lang of I.supported.slice(1))assert.notEqual(N.functionLabel(key,text=>I.t(text,lang)),N.functionLabel(key));
 assert.equal(N.missingLabel('unknownFutureField'),'Weiteres Geometriemaß');
});

test('P5 an explicitly sourced forming assumption resolves the semi-tubular rivet bottom without hiding missing depth data',()=>{
 const doc=resolve({id:'DIN6791',groesse:'4',laenge:12}),part=N.adapt(data,doc);
 assert.equal(part.bottomShape,'cone');assert.equal(part.bottomAngle,120);assert(!part.normMissingFields.includes('boreBottomShape'));assert(part.normMissingFields.includes('headProfileRadius'));
 assert.deepEqual(part.geometryOrigins,{bottomShape:{origin:'assumption',value:'cone'},bottomAngle:{origin:'assumption',value:120}});assert.equal(part.boreBottomAssumption.origin,'assumption');
 const flat=N.adapt(data,R.setOverride(doc,'bottomShape','flat'));assert.equal(flat.geometryOrigins.bottomShape.origin,'customer');assert(!flat.normMissingFields.includes('boreBottomShape'));assert.equal(flat.boreBottomAssumption,undefined);
 const angle=N.adapt(data,R.setOverride(doc,'bottomAngle',100));assert.equal(angle.boreBottomAssumption.angleOrigin,'customer');assert.equal(angle.geometryOrigins.bottomAngle.value,100);
 const invalid=N.adapt(data,R.setOverride(doc,'bottomShape','unresolved'));assert(invalid.normMissingFields.includes('boreBottomShape'));assert.equal(invalid.boreBottomAssumption,undefined);
 const corrected=N.adapt(data,resolve({id:'DIN7338',form:'B',groesse:'4',laenge:12}));assert.equal(corrected.t_b,4,'new primary sources resolve the basic bore depth');assert(!corrected.normMissingFields.includes('verifiedBoreDepth'));assert.equal(families.find(f=>f.id==='DIN7338').variants.find(v=>v.id==='B').fields['4'].t_max.status,'conflict','a bottom assumption does not resolve competing upper-depth limits');
 const inherited=N.adapt(data,R.setOverride(doc,'iTyp','hex'));assert.equal(inherited.iTyp,'none');assert.equal(inherited.standardDocument.overrides.iTyp.value,'hex','inactive customer edits remain stored, never an active rivet drive');
});

test('P5 changing to a plain nut clears an automatic collar but preserves the customer collar choice',()=>{
 const bundled=resolve({id:'ISO4161',groesse:'M8'}),plain=resolve({id:'ISO4032',groesse:'M8'},bundled);
 const automatic=N.adapt(data,plain);assert.equal(automatic.nutFlange,false);assert.equal(automatic.mFlansch,0);
 const custom=N.adapt(data,resolve({id:'ISO4032',groesse:'M8'},R.setOverride(bundled,'nutFlange',true)));assert.equal(custom.nutFlange,true);assert(custom.mFlansch>0);
});

test('P5 added translations preserve all substitution placeholders',()=>{
 const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
 for(const[key,values]of Object.entries(require('../i18n-p5-ui.json'))){assert.equal(values.length,4);values.forEach(text=>{assert(text.trim());assert.deepEqual(placeholders(text),placeholders(key));});}
});
