'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const report=require('../normen/report.cjs');
const row=(sD,lengths={})=>({vorbelegung:sD==null?{}:{sD},roh:{},nachLaenge:lengths});
const family=(id,extra={})=>({id,version:'fixture-v1',funktion:'schraube',kopfTyp:'zylinder',antrieb:{art:'none'},groessen:{},fields:{},...extra});
function fixture(){
  const A=family('A',{edition:'2024',groessen:{M4:row(4,{10:{},20:{}}),M80:row(80)},sizeCoverage:{M4:{status:'documented'},M7:{status:'unresearched'},M100:{status:'not-in-standard'}},
    sourceMeta:{primary:{url:'https://source.example/one.pdf'},mirror:{url:'https://source.example/one.pdf#page=2'},status:{url:'https://standards.example/status',scope:'edition-status'}},quellen:[{id:'independent',url:'https://source.example/two.pdf'}],
    fields:{M4:{good:{value:4,sourceRefs:['primary','independent'],status:'verified',verification:true},single:{value:2,sourceRefs:['primary'],status:'single-source'},alias:{value:2,sourceRefs:['primary','mirror'],status:'verified'},conflict:{value:3,sourceRefs:['primary','independent'],status:'conflict'},missing:{sourceRefs:[],status:'missing'},unreviewed:{value:3,sourceRefs:['primary','independent'],status:'single-source',verification:false},statusOnly:{value:3,sourceRefs:['status'],status:'verified'},dangling:{sourceRefs:['not-registered'],status:'verified'}}}});
  const B=family('B',{edition:'2025',variants:[{id:'one',sizeData:{small:row(2,{10:{}}),large:row(81),unknown:row(null)}},{id:'empty',sizeData:{}}]});
  const N=family('N',{edition:'2023',funktion:'mutter',klasse:'mutter',groessen:{M5:row(null)}});
  const C=family('C',{edition:'catalog-undated',datasetKind:'rivet-size-series',groessen:{4:row(4)}});
  const D=family('D',{edition:null,funktion:'stift',groessen:{4:row(4)}});
  const X=family('X',{edition:null,datasetKind:'invalid-reference'});
  return {families:[X,N,B,D,C,A],threads:{},machines:[{m:'machine',die:[20,100],pun:[40,100],ml:80,cl:[10,100]}]};
}

test('report counts direct rows, variant rows and real length cells separately',()=>{
  const {total,families}=report.summarize(fixture());
  assert.deepEqual({families:total.families,directFamilies:total.directFamilies,directSizes:total.directSizes,variantSizes:total.variantSizes,variantCount:total.variantCount,lengthCells:total.lengthCells,sizesWithLengths:total.sizesWithLengths,lengthRelevant:total.lengthRelevant,withoutLengths:total.withoutLengths},
    {families:6,directFamilies:4,directSizes:5,variantSizes:3,variantCount:2,lengthCells:3,sizesWithLengths:2,lengthRelevant:3,withoutLengths:1});
  assert.deepEqual(total.editions,{stated:3,catalogue:1,missing:2});
  assert.deepEqual(families.find(f=>f.id==='A').sizeCoverage,{documented:1,notInStandard:1,unresearched:1,other:0});
  const changed=fixture();changed.families.find(f=>f.id==='D').laengen={values:[10,20,30]};
  assert.equal(report.summarize(changed).total.lengthCells,3,'a family list is not a size/length matrix');
});

test('source status resolves both registries without upgrading aliases, domains or status pages',()=>{
  const f=fixture().families.find(f=>f.id==='A'),e=report.evidenceSummary(f);
  assert.deepEqual(e,{records:8,verifiedMultiple:1,singleSource:2,unverified:3,missing:1,conflict:1,withoutDocument:3,unresolvedReferences:1,duplicateDocumentReferences:1,statusOnlyReferences:1});
  assert.equal(e.verifiedMultiple,1,'distinct documents on one domain retain the stored assessment; no domain count is used');
  f.fields.M4.good.verification=false;
  assert.equal(report.evidenceSummary(f).verifiedMultiple,0,'two URLs cannot create verification');
  f.quellen.push({id:'primary',url:'https://different.example/conflicting-id.pdf'});
  assert.equal(report.sourceRegistry(f).get('primary').ambiguous,true,'conflicting IDs do not silently overwrite evidence');
  assert.ok(report.evidenceSummary(f).unresolvedReferences>1);
});

test('machine scope uses the shared cautious contour check and exposes unknown data',()=>{
  const input=fixture(),r=report.summarize(input);
  assert.deepEqual(r.total.spectrum,{within:3,excluded:2,unknown:2,notApplicable:1});
  assert.deepEqual(r.families.find(f=>f.id==='B').spectrum,{within:1,excluded:1,unknown:1,notApplicable:0});
  assert.deepEqual(r.families.find(f=>f.id==='B').machineScopeRows,[
    {size:'large',variant:'one',status:'excluded'},
    {size:'small',variant:'one',status:'within'},
    {size:'unknown',variant:'one',status:'unknown'}
  ]);
  input.machines.push({m:'unknown'});
  const uncertain=report.summarize(input);
  assert.equal(uncertain.total.spectrum.excluded,0,'unknown machine dimensions cannot prove catalogue-wide exclusion');
  assert.equal(uncertain.total.spectrum.unknown,4);
  input.machines=[];
  assert.deepEqual(report.summarize(input).total.spectrum,{within:0,excluded:0,unknown:7,notApplicable:1});
});

test('rendering is deterministic, independent of insertion order and leaves inputs unchanged',()=>{
  const input=fixture(),before=JSON.stringify(input),first=report.renderReport(input);
  const reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,v])=>[key,reverse(v)])):value;
  const reordered=reverse(input);reordered.families.reverse();
  for(const f of reordered.families){f.variants?.reverse();f.quellen?.reverse();}
  assert.equal(first,report.renderReport(reordered));assert.equal(JSON.stringify(input),before);
  assert.match(first,/keine Unabhängigkeit/);assert.match(first,/keine nachgewiesene Matrix/);assert.match(first,/Dies ist kein neues fachliches Prüfdatum/);
  assert.match(first,/\| Katalogausgabe nicht zugeordnet \| 1 \|/);
  const changed=fixture();changed.families.find(f=>f.id==='D').groessen[4].nachLaenge[30]={};
  assert.notEqual(report.renderReport(changed),first);assert.equal(report.summarize(changed).total.withoutLengths,0);
});

test('current family files replace stale hand-written counts including the three variant families',()=>{
  const input=report.loadInputs(),r=report.summarize(input),byId=Object.fromEntries(r.families.map(f=>[f.id,f]));
  assert.equal(r.total.families,100);assert.ok(r.total.directSizes>=1100);assert.ok(r.total.variantSizes>=114);assert.ok(r.total.lengthCells>5000);
  assert.equal(byId.DIN7338.directSizes,0);assert.equal(byId.DIN7338.variantSizes,24);assert.equal(byId.DIN7338.lengthCells,2,'no size/length cells invented from the general diameter row');
  assert.equal(byId.DIN7500.directSizes,0);assert.ok(byId.DIN7500.variantSizes>=8);assert.ok(byId.DIN7500.lengthCells>=44);
  assert.deepEqual([byId.ISO13918.directSizes,byId.ISO13918.variantSizes,byId.ISO13918.lengthCells],[0,82,156]);
  assert.ok(byId.ISO4762.directSizes>=13);assert.ok(byId.ISO4762.lengthCells>70);
  assert.ok(byId.DIN603.directSizes>=7);assert.ok(byId.DIN835.directSizes>=13);assert.equal(byId.ISO14581.lengthCells,86);
  for(const f of r.families){assert.equal(Object.values(f.spectrum).reduce((a,b)=>a+b,0),f.directSizes+f.variantSizes);assert.equal(['verifiedMultiple','singleSource','unverified','missing','conflict'].reduce((n,key)=>n+f.sourceStatus[key],0),f.sourceStatus.records);}
});

test('the generated report is current and the standalone checker requires no site build',()=>{
  const filename=path.join(__dirname,'../normen/BERICHT.md');
  assert.equal(fs.readFileSync(filename,'utf8').replace(/\r\n/g,'\n'),report.renderReport(report.loadInputs()));
  const check=spawnSync(process.execPath,[path.join(__dirname,'../normen/report.cjs'),'--check'],{encoding:'utf8',cwd:__dirname});
  assert.equal(check.status,0,check.stderr);
});

test('duplicate family identities fail instead of creating a misleading report',()=>{
  const input=fixture();input.families.push(structuredClone(input.families[0]));
  assert.throws(()=>report.renderReport(input),/Doppelte Normfamilien/);
});
