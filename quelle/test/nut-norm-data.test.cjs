'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../normen/resolver.js');
const ids=['ISO4032','ISO4033','ISO4035','ISO8673','ISO8674','ISO8675','ISO4161','ISO10663','ISO7040','ISO7042','ISO7719','ISO10511','ISO10512','ISO10513','DIN934','DIN936','DIN439','DIN6923','DIN6924','DIN980','DIN985','DIN6926','DIN6927','DIN929','DIN928','DIN557','DIN562','DIN1587'];
const families=ids.map(id=>require('../normen/'+id+'.json'));
const byId=Object.fromEntries(families.map(f=>[f.id,f]));
const library={schemaVersion:1,version:'nut-data-test',families};

test('all requested nut families have bounded, source-linked dimensional records',()=>{
  assert.equal(new Set(families.map(f=>f.id)).size,28);
  let count=0;
  for(const f of families){
    assert.equal(f.klasse,'mutter');assert.ok(f.edition);assert.ok(f.editionStatus);
    assert.equal(f.sourceStatus,'per-value');
    for(const [size,row]of Object.entries(f.groessen)){
      count++;assert.ok(row.roh.d_nom>=f.coverage.diameterMin&&row.roh.d_nom<=f.coverage.diameterMax,`${f.id} ${size}: outside documented coverage`);
      assert.equal(row.thread.diameter,row.roh.d_nom);assert.equal(row.thread.pitch,row.roh.P);
      assert.ok(row.thread.sourceRefs.length);
      for(const [raw,value]of Object.entries(row.roh)){
        assert.ok(Number.isFinite(value)&&value>0,`${f.id} ${size} ${raw}`);
        const field=f.fields[size][raw];assert.ok(field,`${f.id} ${size}: missing provenance for ${raw}`);
        assert.equal(field.unit,'mm');assert.ok(field.sourceRefs.length);
        if(field.status==='verified')assert.ok(new Set(field.sourceRefs).size>=2);
        else assert.ok(field.note,`${f.id} ${size} ${raw}: unexplained gap`);
        for(const ref of field.sourceRefs){assert.ok(f.sourceMeta[ref],ref);assert.match(f.sourceMeta[ref].url,/^https:\/\//);assert.ok(f.sourceMeta[ref].locator);}
      }
      for(const [key,value]of Object.entries(row.vorbelegung)){
        assert.ok(Number.isFinite(value)&&value>0,`${f.id} ${size} ${key}`);
        assert.ok(f.fields[size][f.feldzuordnung[key]],`${f.id} ${size}: unmapped ${key}`);
      }
    }
  }
  assert.ok(count>=444,'documented edge sizes must not disappear from the library');
});

test('DIN and ISO dimensions remain distinct, including thin nuts',()=>{
  assert.equal(byId.ISO4032.groessen.M10.vorbelegung.mSW,16);
  assert.equal(byId.DIN934.groessen.M10.vorbelegung.mSW,17);
  assert.equal(byId.ISO4035.groessen.M10.vorbelegung.mH,5);
  assert.equal(byId.DIN936.groessen.M10.vorbelegung.mH,6);
  assert.equal(byId.ISO4033.groessen.M27.vorbelegung.mH,26.7);
  assert.equal(byId.ISO4032.groessen.M7.vorbelegung.mH,6.5);
  assert.equal(byId.DIN980.groessen.M27.vorbelegung.mH,27);
});

test('fine-pitch rows use only the documented D x P variants',()=>{
  assert.equal(byId.ISO8673.groessen['M10x1.25'].roh.P,1.25);
  assert.equal(byId.ISO10663.groessen['M12x1.25'].vorbelegung.mSW,18);
  assert.equal(byId.DIN934.groessen['M8x0.5'].roh.P,0.5);
  assert.equal(byId.DIN439.groessen['M10x0.75'].roh.P,0.75);
  assert.equal(byId.DIN980.groessen['M27x2'].vorbelegung.mH,27);
  assert.equal(byId.DIN6927.groessen['M12x1.25'],undefined,'ambiguous catalog typo is not a new size');
  assert.equal(byId.ISO8673.groessen.M6,undefined);
});

test('M8 flange c is a sourced minimum at the measuring circle, not a nominal solid cylinder',()=>{
  const f=byId.ISO4161,r=f.groessen.M8,meta=f.fields.M8.c_min;
  assert.equal(r.vorbelegung.c,1.2);assert.equal(r.vorbelegung.dc,17.9);
  assert.equal(r.roh.dw_min,15.8);assert.equal(meta.min,1.2);assert.equal(meta.nominal,undefined);
  assert.equal(meta.status,'verified');assert.match(meta.note,/Messdurchmesser/);
  assert.equal(r.geometryStatus,'dimensioned-envelope');
});

test('source conflicts remain visible and do not silently promote the catalog value',()=>{
  assert.equal(byId.ISO4161.groessen.M20.roh.s_min,29.16);
  assert.equal(byId.ISO4161.fields.M20.s_min.status,'conflict');
  assert.equal(byId.ISO4161.groessen.M8.roh.m_min,7.64);
  assert.equal(byId.ISO4161.fields.M8.m_min.status,'conflict');
  assert.equal(byId.DIN980.groessen.M22.roh.e_min,35.03);
  assert.deepEqual(byId.DIN980.fields.M22.e_min.sourceValues.map(x=>x.value),[35.03,350.3]);
  assert.equal(byId.ISO10511.fields.M10.e_min.status,'conflict');
  assert.equal(byId.DIN6924.fields.M16.h_max.status,'conflict');
});

test('historical locking editions do not claim the revised 2025 dimensions',()=>{
  for(const id of ['ISO7040','ISO7042','ISO7719','ISO10511','ISO10512','ISO10513']){
    const f=byId[id];assert.equal(f.edition,'2012');assert.equal(f.currentEdition,'2025');assert.equal(f.editionStatus,'superseded');
    assert.ok(f.editionSourceRefs.every(ref=>f.sourceMeta[ref]));
  }
  assert.equal(byId.ISO7040.groessen.M5.vorbelegung.mH,6.8);
  assert.equal(byId.DIN557.edition,'1994-01');assert.equal(byId.DIN557.currentEdition,'2026-02');
});

test('dated nut tables correct dimensions without relabelling supplier extras as standard rows',()=>{
  assert.equal(byId.DIN562.edition,'2013-05');
  assert.equal(byId.DIN562.groessen.M10.vorbelegung.mSW,16);
  assert.equal(byId.DIN557.groessen.M10.vorbelegung.mSW,17,'the historical DIN557 table is retained separately');
  assert.equal(byId.DIN934.groessen.M1.roh.P,0.25);
  assert.equal(byId.DIN934.groessen['M100x6'].vorbelegung.mSW,145);
  assert.equal(byId.DIN985.groessen.M48.vorbelegung.mH,48);
  assert.equal(byId.DIN934.groessen['M8x0.5'].standardMatrixMembership,false);
  assert.equal(byId.DIN1587.groessen.M27.standardMatrixMembership,false);
  assert.equal(byId.DIN928.groessen.M16.roh.e_min,32);
  assert.equal(byId.DIN928.groessen['M14x1.5'].vorbelegung.mH,11,'2013 correction wins over the older 11.4 manufacturer value');
  assert.equal(byId.DIN929.groessen.M14.vorbelegung.mSW,22);
  assert.equal(byId.DIN929.groessen['M12x1.25'].roh.e_min,20.91);
  assert.equal(byId.DIN929.groessen['M12x1.25'].dataEdition,'manufacturer-table-undated');
});

test('thread engagement depth is not an invented cap cavity or a second height source',()=>{
  const cap=byId.DIN1587.groessen.M10;
  assert.ok(cap.roh.threadDepth_min>0);
  assert.equal(cap.vorbelegung.mLoch,undefined);
  assert.ok(cap.missingGeometryFields.includes('blindHoleDepth'));
  assert.deepEqual(byId.DIN6927.fields.M8.h_max.sourceRefs,['ugatu6927']);
  assert.equal(byId.DIN6927.fields.M8.h_max.status,'single-source');
});

test('undated locking-nut dimensions do not inherit the dated comparison-table edition',()=>{
  const f=byId.DIN6927;
  const undatedRows=Object.entries(f.groessen).filter(([size])=>size==='M5'||size.includes('x'));
  assert.equal(undatedRows.length,8);
  for(const [,row]of undatedRows){
    assert.equal(row.dataEdition,'manufacturer-table-undated');
    assert.match(row.note,/UGATU/);
  }
  for(const size of Object.keys(f.groessen)){
    assert.equal(f.fields[size].h_max.dataEdition,'manufacturer-table-undated');
    assert.deepEqual(f.fields[size].h_max.sourceRefs,['ugatu6927']);
    assert.equal(f.fields[size].h_max.status,'single-source');
  }
  assert.equal(f.edition,'1983-11');
  assert.equal(f.fields.M8.s_nom.status,'verified','the dated matched subset retains its evidence');
});

test('unresolved special geometry is exposed without invented holes, inserts or cap depths',()=>{
  for(const id of ['ISO7040','ISO7042','ISO7719','ISO10511','ISO10512','ISO10513','DIN980','DIN985','DIN6924','DIN6926','DIN6927','DIN928','DIN929','DIN1587']){
    for(const [size,row]of Object.entries(byId[id].groessen)){
      assert.equal(row.geometryStatus,'partial');assert.ok(row.missingGeometryFields.length);
      for(const key of row.missingGeometryFields)assert.equal(byId[id].fields[size][key].status,'missing');
    }
  }
  for(const f of families)for(const row of Object.values(f.groessen))assert.equal(row.vorbelegung.mLoch,undefined);
  assert.equal(byId.DIN6924.groessen.M14.vorbelegung.mH,undefined);
  assert.equal(byId.DIN6924.fields.M14.h_max.status,'unresolved');
});

test('nut records resolve and serialize with provenance and retained customer geometry',()=>{
  const prior={partSnapshot:{geometrySpec:{elements:[{id:'customer-cap',angleDeg:120,depth:0.5}]},wire:{d0:7,origin:'customer'},process:{materialState:'annealed'}}};
  for(const f of families)for(const size of Object.keys(f.groessen)){
    const doc=R.resolveStandard(library,{id:f.id,groesse:size},prior);
    assert.deepEqual(doc.normBaseline.values,f.groessen[size].vorbelegung);
    assert.deepEqual(doc.partSnapshot,prior.partSnapshot);
    assert.deepEqual(R.restore(JSON.stringify(R.snapshot(doc))),doc);
    for(const key of Object.keys(doc.normBaseline.values))assert.ok(doc.normBaseline.provenance[key].sourceRefs.length);
  }
  const doc=R.resolveStandard(library,{id:'ISO4161',groesse:'M8'},prior);
  const edited=R.setOverride(doc,'c',1.4),reset=R.resetOverride(edited,'c');
  assert.equal(edited.effective.c,1.4);assert.equal(reset.effective.c,1.2);
  assert.deepEqual(reset.partSnapshot,prior.partSnapshot);
});
