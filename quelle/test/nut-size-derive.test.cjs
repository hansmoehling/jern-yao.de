const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../katalog/nut-size-derive.cjs'),standard=require('../normen/ISO4032.json'),catalog=require('../maschinen.json');

test('nut size selection obeys both documented dimensions and includes M30 without extending the norm table',()=>{
 const machine={m:'FIXTURE',f:'JNF',cd:36.8,ml:25.6},derived=D.deriveSize(machine,standard);
 assert.equal(derived.sz,'M30');assert.equal(derived.szMeta.calculation.proposedWireDiameterMm,36.8);assert.equal(derived.szMeta.coverage.upperBoundReached,true);
 assert.equal(D.deriveSize({...machine,cd:36.79},standard).sz,'M27');
 assert.equal(D.deriveSize({...machine,ml:25.59},standard).sz,'M27');
 assert.equal(D.deriveSize({...machine,cd:60,ml:100},standard).sz,'M30');
 assert.equal(D.deriveSize({...machine,cd:6.39},standard),null,'no undocumented M3/M4 floor');
 assert.equal(D.deriveSize({...machine,ml:4.69},standard),null,'no smaller undocumented nut height');
});
test('cut-off length and knockout stroke never replace the product-height field',()=>{
 const machine={f:'JNFP',cd:13,cl:[null,5],ko:5},derived=D.deriveSize(machine,standard);
 assert.equal(derived.sz,'M10');assert.equal(derived.szMeta.heightCheck,'unverified');assert.equal(derived.szMeta.calculation.productLengthMm,null);
 const product=D.deriveSize({...machine,kat:'NFPL-5D5B-6D6B',ps:[12,6.8]},standard);
 assert.equal(product.sz,'M8');assert.equal(product.szMeta.heightCheck,'catalog-product-size');assert.equal(product.szMeta.calculation.productLengthField,'ps[1]');
 const reference=D.deriveSize({...machine,f:'JNF',kat:'NFL-5D5B-6D6B',ps:[12,6.8]},standard);
 assert.equal(reference.sz,'M8');assert.equal(reference.szMeta.heightCheck,'reference-product-only');
});
test('existing manufacturer sizes and other families remain unchanged, with no invented lower cut-off bound',()=>{
 const input=[{m:'EXISTING',f:'JNF',sz:'M5',cd:13,ml:30,cl:[null,33]},{m:'PARTS',f:'JNP',cd:13,ml:30,cl:[null,33]},{m:'NEW',f:'JNF',cd:13,ml:30,cl:[null,33]}];
 const snapshot=JSON.stringify(input),result=D.applyDerivedSizes(input,standard);
 assert.equal(JSON.stringify(input),snapshot);assert.equal(result[0],input[0]);assert.equal(result[1],input[1]);assert.equal(result[2].sz,'M10');assert.deepEqual(result[2].cl,[null,33]);
 assert.deepEqual(D.applyDerivedSizes(result,standard),result,'repeat execution is idempotent');
});
test('only sourced nominal width and maximum height values can participate',()=>{
 const modified=structuredClone(standard);delete modified.fields.M30.m_max.sourceRefs;
 assert.equal(D.deriveSize({f:'JNF',cd:60,ml:100},modified).sz,'M27');
 assert.throws(()=>D.deriveSize({f:'JNF',cd:60,ml:100},{...standard,id:'OTHER'}));
});
test('catalogue derivations reproduce all 65 missing long-stroke sizes and retain their explicit confirmation owner',()=>{
 const derived=catalog.filter(row=>row.szMeta?.origin===D.ORIGIN);
 assert.equal(derived.length,65);assert.deepEqual(Object.fromEntries(['JNF','JNFP','JNFR'].map(f=>[f,derived.filter(row=>row.f===f).length])),{JNF:28,JNFP:25,JNFR:12});
 for(const row of derived){
  assert.deepEqual({sz:row.sz,szMeta:row.szMeta},D.deriveSize(row,standard),row.m);
  assert.equal(row.szMeta.confirmationRequired,true);assert.equal(row.szMeta.owner,'Jern Yao');assert.equal(row.szMeta.status,'derived-unconfirmed');
  assert.equal(row.ml,undefined,'a product example never creates a general ml limit');assert.equal(row.cl[0],null,'unknown minimum cut-off length remains unknown');
  assert(row.szMeta.calculation.nutHeightMaxMm<=row.ps[1]);assert.equal(row.szMeta.calculation.productLengthField,'ps[1]');
  assert(row.szMeta.standard.sources.every(source=>source.url.startsWith('https://')));
 }
 for(const f of ['JNF','JNFP','JNFR'])assert(catalog.filter(row=>row.f===f).every(row=>row.sz),f);
});
