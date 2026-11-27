'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../normen/resolver.js');
const ids=['DIN660','DIN661','DIN662','DIN674','DIN6791','DIN6792','DIN7338','DIN124','DIN302','ISO1051','ISO2340','ISO2341','ISO2338','ISO8734','ISO8735',...Array.from({length:8},(_,i)=>`ISO${8740+i}`),'ISO13918'];
const families=ids.map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../normen',id+'.json'),'utf8')));
const family=id=>families.find(f=>f.id===id);
const library={schemaVersion:1,version:'2026-11-26',families};
const resolve=(id,size,length)=>R.resolveStandard(library,{id,groesse:String(size),laenge:length});

test('every published raw value has explicit evidence, unit and an honest verification status',()=>{
  assert.equal(new Set(families.map(f=>f.id)).size,24);
  for(const f of families){
    const sources=new Map(f.quellen.map(s=>[s.id,s]));
    assert.equal(sources.size,f.quellen.length,f.id+' duplicate source ID');
    function checkRow(size,row,fields,mapping){
      const prefix=f.id+'/'+size;
      assert.ok(['documented','unresearched','not-in-standard'].includes(row.coverage),prefix);
      assert.ok(['complete','partial','missing'].includes(row.geometryStatus),prefix);
      assert.ok(Array.isArray(row.missingGeometryFields),prefix);
      if(row.geometryStatus==='complete')assert.equal(row.missingGeometryFields.length,0,prefix);
      for(const[key,value]of Object.entries(row.roh||{})){
        const m=fields[key];assert.ok(m,prefix+'/'+key);
        assert.ok(['verified','single-source','missing','conflict'].includes(m.status),prefix+'/'+key);
        assert.ok(['mm','deg'].includes(m.unit),prefix+'/'+key);
        assert.ok((typeof m.verification==='boolean'||typeof m.verification==='string'&&m.verification.length>0)&&m.note,prefix+'/'+key);
        if(m.status==='verified')assert.notEqual(m.verification,false,prefix+'/'+key+' cannot mark an unverified value as verified');
        for(const ref of m.sourceRefs)assert.ok(sources.has(ref),prefix+'/'+key+'/'+ref);
        if(typeof value==='number'){
          assert.ok(Number.isFinite(value));
          assert.ok([m.nominal,m.min,m.max].includes(value),prefix+'/'+key+' does not match metadata');
          assert.ok(m.sourceRefs.length>0,prefix+'/'+key+' has no evidence');
        }else assert.equal(value,null,prefix+'/'+key+' must not hide a number in prose');
        if(m.status==='verified'){
          assert.ok(m.sourceRefs.length>=2,prefix+'/'+key+' needs independent evidence');
          const hosts=new Set(m.sourceRefs.map(ref=>new URL(sources.get(ref).url).hostname.replace(/^www\./,'')));
          assert.ok(hosts.size>=2,prefix+'/'+key+' only repeats one publisher');
        }
        if(m.min!==undefined&&m.max!==undefined)assert.ok(m.min<=m.max,prefix+'/'+key);
        if(m.status==='missing')assert.equal(value,null,prefix+'/'+key);
      }
      for(const[key,value]of Object.entries(row.vorbelegung||{})){
        const m=fields[mapping[key]||key];assert.ok(m,prefix+' unmapped '+key);
        assert.ok([m.nominal,m.max,m.min].includes(value),prefix+' untraceable default '+key);
      }
      for(const[length,child]of Object.entries(row.nachLaenge||{}))checkRow(size+'x'+length,child,child.fields||{},mapping);
    }
    for(const[size,row]of Object.entries(f.groessen))checkRow(size,row,f.fields[size]||{},f.feldzuordnung);
    for(const v of f.variants||[])for(const[size,row]of Object.entries(v.sizeData))checkRow(v.id+'/'+size,row,v.fields[size]||{},v.feldzuordnung||f.feldzuordnung);
  }
});

test('DIN660 4x10 restores shaft and spherical-cap head, including reedit/reset',()=>{
  const doc=resolve('DIN660',4,10);
  assert.deepEqual(doc.effective,{sD:4,kD:7,kH:2.4,sL:10});
  const {kD,kH}=doc.effective;
  const capVolume=Math.PI*kH*(3*(kD/2)**2+kH*kH)/6;
  assert.ok(Math.abs(capVolume-53.419)<0.01,'acceptance head volume is approximately 53.4 mm3');
  const changed=R.setOverride(doc,'kH',3);
  const restored=R.restore(JSON.stringify(R.snapshot(changed)));
  assert.equal(restored.effective.sL,10);
  assert.equal(restored.effective.kD,7);
  assert.equal(R.resetOverride(restored,'kH').effective.kH,2.4);
});

test('DIN6791 4x12 keeps bore diameter and depth but does not invent a bore bottom',()=>{
  const f=family('DIN6791'),doc=resolve('DIN6791',4,12);
  assert.deepEqual(doc.effective,{sD:4,kD:8,kH:1.8,d_b:2.7,t_b:4,sL:12});
  assert.equal(doc.normBaseline.provenance.t_b.min,4);
  assert.equal(doc.normBaseline.provenance.t_b.max,4.5);
  assert.equal(f.groessen['4'].geometryStatus,'partial');
  assert.ok(f.groessen['4'].missingGeometryFields.includes('boreBottomShape'));
  assert.equal(f.groessen['4'].vorbelegung.boreBottomAngle,undefined);
});

test('original-source corrections replace wrong heights while unresolved bounds stay explicit',()=>{
  for(const id of ['DIN674','DIN6792'])for(const[size,row]of Object.entries(family(id).groessen)){
    assert.equal(family(id).fields[size].k_js14.status,'verified');
    assert.equal(row.vorbelegung.kH,family(id).fields[size].k_js14.nominal);
    assert.ok(family(id).fields[size].k_js14.superseded,'correction keeps its audit trail');
  }
  const b=family('DIN7338').variants.find(v=>v.id==='B');
  assert.equal(b.fields['4'].t_min.status,'verified');
  assert.equal(b.sizeData['4'].vorbelegung.t_b,4);
  assert.equal(b.fields['4'].t_max.status,'conflict');
  assert.equal(family('ISO2341').groessen['24'].vorbelegung.kH,6);
  assert.equal(family('ISO2341').fields['24'].k.status,'conflict');
});

test('restored catalogue lengths and missing rows are not claimed as a complete normative matrix',()=>{
  assert.ok(family('DIN660').laengen.values.includes(38));
  assert.ok(family('DIN6791').laengen.values.includes(12));
  assert.match(family('DIN660').laengen.kind,/catalog/);
  assert.equal(family('DIN660').groessen['4'].nachLaenge['38'],undefined);
  const unknown=resolve('DIN660',4,38);
  assert.ok(unknown.issues.some(i=>i.code==='length-not-resolved'));
  assert.ok(!unknown.issues.some(i=>/excluded|not-in-standard/.test(i.code)));
  assert.equal(family('ISO1051').datasetKind,'rivet-size-series');
  for(const r of Object.values(family('ISO1051').groessen))assert.deepEqual(Object.keys(r.vorbelegung),['sD']);
});

test('grooved-pin legacy dimensions stay separated from the changed 2025/2026 editions',()=>{
  for(let i=8740;i<=8747;i++){
    const f=family('ISO'+i);
    assert.equal(f.edition,'1997');
    assert.equal(f.normstatus.status,'withdrawn');
    assert.ok(['2025','2026'].includes(f.currentEdition.edition));
    assert.equal(f.currentEdition.dimensionCoverage,'unresearched');
    assert.ok(Object.values(f.groessen).every(r=>r.geometryStatus==='partial'));
  }
  assert.equal(family('ISO8735').groessen['4'],undefined,'DIN7979 diameter must not be attributed to ISO8735');
});

test('all 14 weld-stud types are isolated, with post-weld dimensions excluded from raw-part defaults',()=>{
  const f=family('ISO13918');
  assert.deepEqual(f.groessen,{});
  assert.deepEqual(f.variants.map(v=>v.id).sort(),['FD','MD','PD','RD','UD','ND','ID','SD','PS','US','IS','PT','UT','IT'].sort());
  for(const v of f.variants)for(const[size,row]of Object.entries(v.sizeData)){
    assert.ok(Object.keys(v.sizeData).length>0);
    assert.equal(row.geometryStatus,'partial');
    const mapped=new Set(Object.values(v.feldzuordnung));
    for(const[key,meta]of Object.entries(v.fields[size])){
      if(meta.dimensionStage==='after-welding')assert.ok(!mapped.has(key),v.id+'/'+key);
    }
    assert.equal(row.vorbelegung.t_b,undefined,'thread engagement is not total blind-hole depth');
    if(v.id!=='SD'){
      assert.equal(row.vorbelegung.kD,undefined,'weld collar must not become a forged head');
      assert.equal(row.vorbelegung.kH,undefined);
    }
  }
  const pt=f.variants.find(v=>v.id==='PT');
  assert.equal(pt.sizeData.M3.roh.ignitionTipDiameter,0.6);
  assert.equal(pt.sizeData.M8.roh.ignitionTipDiameter,0.75);
  const sd=f.variants.find(v=>v.id==='SD');
  assert.equal(sd.sizeData['10'].vorbelegung.kD,19);
  assert.equal(sd.sizeData['10'].vorbelegung.kH,7);
  assert.equal(sd.sizeData['16'].vorbelegung.kH,undefined,'ambiguous merged norm table must remain a gap');
});
