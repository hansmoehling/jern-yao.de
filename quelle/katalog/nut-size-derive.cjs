'use strict';
const fs=require('node:fs'),path=require('node:path');
const NUT_FAMILIES=new Set(['JNF','JNL','JNFP','JNFR']);
const ORIGIN='abgeleitet aus Abschnitt-Ø';
const PRODUCT_LABELS={
  'NFL-5D5B-6D6B':'PRODUCT / SOCKET WRENCH (diameter x length)',
  'NFPL-5D5B-6D6B':'PRODUCT SIZE (diameter x length)',
  'NFRL-5D5B-6D6B':'PRODUCT SIZE (diameter x length)'
};
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
const clean=value=>Number(value.toPrecision(12));
const fits=(required,capacity)=>required<=capacity+Number.EPSILON*8*Math.max(1,capacity);
const present=value=>value!==undefined&&value!==null&&value!=='';

function standardSizes(standard){
  if(standard?.id!=='ISO4032')throw TypeError('ISO4032 dimensions are required.');
  return Object.entries(standard.groessen||{}).flatMap(([size,row])=>{
    const nominal=/^M(\d+(?:\.\d+)?)$/.exec(size),s=row.roh?.s_nom,height=row.roh?.m_max;
    const evidence=standard.fields?.[size],sourceRefs=[...new Set([...(evidence?.s_nom?.sourceRefs||[]),...(evidence?.m_max?.sourceRefs||[])])];
    if(!nominal||!positive(s)||!positive(height)||evidence?.s_nom?.nominal!==s||evidence?.m_max?.max!==height||!evidence.s_nom.sourceRefs?.length||!evidence.m_max.sourceRefs?.length||sourceRefs.some(id=>!standard.sourceMeta?.[id]))return [];
    return [{size,nominal:+nominal[1],acrossFlatsMm:s,nutHeightMaxMm:height,proposedWireDiameterMm:clean(.8*s),sourceRefs}];
  }).sort((a,b)=>a.nominal-b.nominal);
}

function deriveSize(machine,standard){
  if(!NUT_FAMILIES.has(machine?.f)||!positive(machine.cd))return null;
  const sizes=standardSizes(standard);if(!sizes.length)return null;
  // Cut-off length is a blank limit, never a substitute for product height.
  // The NFL socket-wrench row is a reference product, not a general nut limit.
  const productLabel=PRODUCT_LABELS[machine.kat],lengthField=positive(machine.ml)?'ml':productLabel&&positive(machine.ps?.[1])?'ps[1]':null;
  const productLength=lengthField==='ml'?machine.ml:lengthField==='ps[1]'?machine.ps[1]:null;
  const heightCheck=lengthField==='ml'?'catalog-max-product-length':lengthField==='ps[1]'?(machine.kat==='NFL-5D5B-6D6B'?'reference-product-only':'catalog-product-size'):'unverified';
  const admitted=sizes.filter(row=>fits(row.proposedWireDiameterMm,machine.cd)&&(productLength===null||fits(row.nutHeightMaxMm,productLength)));
  const chosen=admitted.at(-1);if(!chosen)return null;
  return {sz:chosen.size,szMeta:{
    origin:ORIGIN,status:'derived-unconfirmed',owner:'Jern Yao',rule:'R-NUT-SIZE-01',confirmationRequired:true,heightCheck,
    standard:{id:standard.id,edition:standard.edition,version:standard.version,size:chosen.size,sourceRefs:chosen.sourceRefs,sources:chosen.sourceRefs.map(id=>({id,...standard.sourceMeta[id]}))},
    calculation:{wireFactor:.8,acrossFlatsMm:chosen.acrossFlatsMm,nutHeightMaxMm:chosen.nutHeightMaxMm,proposedWireDiameterMm:chosen.proposedWireDiameterMm,cutoffDiameterMaxMm:machine.cd,productLengthMm:productLength,productLengthField:lengthField},
    catalog:{url:machine.kat?'https://www.jernyao.com/files/'+machine.kat+'.pdf':null,page:machine.s||null,productLengthLabel:lengthField==='ml'?'MAX. LENGTH':productLabel||null},
    coverage:{minimumDocumentedSize:sizes[0].size,maximumDocumentedSize:sizes.at(-1).size,upperBoundReached:chosen.size===sizes.at(-1).size}
  }};
}

function applyDerivedSizes(catalog,standard){
  return catalog.map(machine=>{
    if(present(machine.sz))return machine;
    const derived=deriveSize(machine,standard);return derived?{...machine,...derived}:machine;
  });
}
function proposals(catalog){
  return catalog.filter(row=>row.szMeta?.origin===ORIGIN).map(row=>({model:row.m,size:row.sz,cutoffDiameterMm:row.cd,wireDiameterMm:row.szMeta.calculation.proposedWireDiameterMm,nutHeightMaxMm:row.szMeta.calculation.nutHeightMaxMm,productLengthMm:row.szMeta.calculation.productLengthMm,productLengthField:row.szMeta.calculation.productLengthField,heightCheck:row.szMeta.heightCheck,tableUpperBound:row.szMeta.coverage.upperBoundReached,confirmationOwner:row.szMeta.owner,source:row.szMeta.catalog.url,page:row.szMeta.catalog.page}));
}
if(require.main===module){
  const target=path.join(__dirname,'..','maschinen.json'),standard=require('../normen/ISO4032.json'),catalog=JSON.parse(fs.readFileSync(target,'utf8')),updated=applyDerivedSizes(catalog,standard),added=updated.filter((row,index)=>row!==catalog[index]).length;
  if(process.argv.includes('--write'))fs.writeFileSync(target,JSON.stringify(updated)+'\n');
  if(process.argv.includes('--proposals'))process.stdout.write(JSON.stringify(proposals(updated),null,2)+'\n');
  else process.stdout.write(JSON.stringify({added,derived:proposals(updated).length,unresolved:updated.filter(row=>NUT_FAMILIES.has(row.f)&&!present(row.sz)).map(row=>row.m),written:process.argv.includes('--write')})+'\n');
}
module.exports={ORIGIN,standardSizes,deriveSize,applyDerivedSizes,proposals};
