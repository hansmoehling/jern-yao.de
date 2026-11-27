'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../normen/resolver.js');
const ids=['DIN603','ISO8677','DIN938','DIN939','ISO4762'];
const families=ids.map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../normen',id+'.json'),'utf8')));
const family=id=>families.find(f=>f.id===id);
const library={schemaVersion:1,version:'2026-11-26',families};
const resolve=(id,groesse,laenge)=>R.resolveStandard(library,{id,groesse,laenge});

test('supplement values and every mapped default retain evidence or an explicit gap',()=>{
  let newSizeCount=0,lengthCount=0;
  for(const f of families){
    const sources=new Map(f.quellen.map(s=>[s.id,s]));
    assert.equal(sources.size,f.quellen.length,f.id+' duplicate source IDs');
    function rowCheck(label,row,fields){
      assert.equal(row.coverage,'documented',label);
      assert.ok(Array.isArray(row.missingGeometryFields),label);
      for(const [key,value]of Object.entries(row.roh)){
        const m=fields[key];assert.ok(m,label+'/'+key);
        assert.ok(['verified','single-source','conflict','missing'].includes(m.status),label+'/'+key);
        assert.equal(new Set(m.sourceRefs).size,m.sourceRefs.length,label+'/'+key+' duplicate references');
        for(const ref of m.sourceRefs)assert.ok(sources.has(ref),label+'/'+key+'/'+ref);
        assert.equal(typeof m.verification,'boolean',label+'/'+key);
        assert.ok(m.verificationMethod&&m.note,label+'/'+key);
        assert.equal(m.unit,typeof value==='string'?null:'mm',label+'/'+key);
        if(value===null)assert.equal(m.status,'missing',label+'/'+key);
        else{
          assert.ok([m.nominal,m.min,m.max].includes(value),label+'/'+key+' mismatched metadata');
          assert.ok(m.sourceRefs.length>0,label+'/'+key+' no source');
        }
        if(m.status==='verified'){
          const publishers=new Set(m.sourceRefs.map(ref=>new URL(sources.get(ref).url).hostname.replace(/^www\./,'')));
          assert.ok(publishers.size>=2,label+'/'+key+' needs independent publishers');
        }
        if(Number.isFinite(m.min)&&Number.isFinite(m.max))assert.ok(m.min<=m.max,label+'/'+key);
      }
      for(const [key,value]of Object.entries(row.vorbelegung)){
        const m=fields[f.feldzuordnung[key]||key];assert.ok(m,label+'/'+key+' missing mapping');
        assert.ok([m.nominal,m.min,m.max].includes(value),label+'/'+key+' untraceable default');
      }
    }
    for(const[size,row]of Object.entries(f.groessen)){
      if(f.id!=='ISO4762'){newSizeCount++;rowCheck(f.id+'/'+size,row,f.fields[size]);}
      for(const[length,child]of Object.entries(row.nachLaenge||{})){
        lengthCount++;rowCheck(f.id+'/'+size+'x'+length,child,child.fields);
      }
    }
  }
  assert.equal(newSizeCount,59);
  assert.equal(lengthCount,1089);
});

test('DIN603 and ISO8677 keep their different head dimensions and square neck geometry',()=>{
  const din=resolve('DIN603','M8',40),iso=resolve('ISO8677','M8',40);
  assert.equal(din.effective.kD,20.65);assert.equal(din.effective.kH,4.88);
  assert.equal(iso.effective.kD,20);assert.equal(iso.effective.kH,4.8);
  for(const doc of [din,iso]){
    assert.equal(doc.effective.squareNeckWidth,8.58);assert.equal(doc.effective.squareNeckLength,5.6);
    assert.equal(doc.effective.sL,40);assert.equal(doc.effective.b,undefined);
    assert.ok(!doc.issues.some(x=>x.code==='length-not-resolved'));
    assert.ok(doc.normBaseline.provenance.sL.sourceRefs.length>0);
  }
  assert.equal(family('DIN603').fields.M5.dk_max.status,'conflict');
  assert.equal(family('DIN603').groessen.M5.roh.dk_max,13.55);
});

test('editions and unresearched size rows are not promoted into current norm coverage',()=>{
  assert.equal(family('DIN603').edition,'catalogue-unassigned');
  assert.equal(family('DIN603').currentEdition.edition,'2026-08');
  assert.equal(family('DIN603').currentEdition.dimensionCoverage,'unresearched');
  assert.equal(family('DIN603').sizeCoverage.M4.status,'unresearched');
  assert.equal(family('ISO8677').normstatus.status,'withdrawn');
  assert.equal(family('DIN939').edition,'1995-02');
  assert.equal(family('DIN939').currentEdition.edition,'2025-08');
  assert.equal(family('DIN939').currentEdition.dimensionCoverage,'unresearched');
});

test('studs use tabulated metal ends without confusing nominal and overall lengths',()=>{
  for(const[size,bm]of [['M27',25],['M33',32],['M36',35],['M39',38]])assert.equal(family('DIN938').groessen[size].vorbelegung.metalEndLength,bm);
  const doc=resolve('DIN939','M10',75);
  assert.equal(doc.effective.d,10);assert.equal(doc.effective.metalEndLength,12);
  assert.equal(doc.effective.sL,undefined);assert.equal(doc.effective.b,undefined);
  assert.equal(family('DIN939').fields.M10.b_gt200.status,'conflict');
  assert.equal(family('DIN939').groessen.M10.roh.b_gt200,45);
  assert.equal(family('DIN938').fields.M3.b_gt200.status,'missing');
});

test('ISO4762 has its own full-thread threshold for every supplemented diameter',()=>{
  for(const[size,full,partial,b]of [['M3',20,25,18],['M4',25,30,20],['M5',25,30,22],['M6',30,35,24],['M8',35,40,28],['M10',40,45,32],['M12',50,55,36]]){
    const a=resolve('ISO4762',size,full),c=resolve('ISO4762',size,partial);
    assert.equal(a.effective.threadMode,'full',size);assert.equal(a.effective.b,full,size);
    assert.equal(c.effective.threadMode,'partial',size);assert.equal(c.effective.b,b,size);
    assert.equal(c.effective.sL,partial,size);
    assert.equal(c.normBaseline.sourceStatus.b,'verified',size);
  }
});

test('ISO4762 length-specific body and grip limits survive independently of thread references',()=>{
  for(const[size,length,ls,lg]of [['M3',25,4.5,7],['M5',35,9,13],['M8',40,5.75,12],['M8',80,45.75,52],['M10',100,60.5,68],['M12',120,75.25,84]]){
    const row=family('ISO4762').groessen[size].nachLaenge[length];
    assert.equal(row.roh.ls_min,ls);assert.equal(row.fields.ls_min.min,ls);
    assert.equal(row.roh.lg_max,lg);assert.equal(row.fields.lg_max.max,lg);
    assert.equal(row.fields.ls_min.status,'verified');assert.equal(row.fields.lg_max.status,'verified');
  }
  const length=family('ISO4762').groessen.M8.nachLaenge[40].fields.sL;
  assert.deepEqual([length.nominal,length.min,length.max],[40,39.5,40.5]);
  assert.deepEqual(length.sourceRefs,['iteh4762_2004']);
  assert.equal(length.status,'single-source');
});

test('missing ISO4762 length stays unresolved and reset restores documented length-specific values',()=>{
  const missing=resolve('ISO4762','M8',90);
  assert.equal(missing.effective.sL,undefined);assert.equal(missing.effective.b,undefined);
  assert.ok(missing.issues.some(x=>x.code==='length-not-resolved'));
  const original=resolve('ISO4762','M8',40);
  const changed=R.setOverride(original,'b',30);
  assert.equal(changed.effective.b,30);assert.equal(changed.effective.sL,40);
  const reset=R.resetOverride(changed,'b');
  assert.equal(reset.effective.b,28);assert.equal(reset.effective.sL,40);
  assert.equal(reset.normBaseline.sourceStatus.b,'verified');
});
