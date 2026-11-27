'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=require('../normen/resolver.js');
const L=require('../normen/library.js');
const ids=['DIN7500','DIN835','DIN940','ISO14581','ISO15072','ISO7049','ISO7050','ISO7051'];
const families=ids.map(id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../normen',id+'.json'),'utf8')));
const read=id=>families.find(f=>f.id===id);
const library={schemaVersion:1,version:'2026-11-26',families};
function resolve(id,groesse,laenge,form){const selection={id,groesse,...(laenge==null?{}:{laenge}),...(form?{form}:{})};return R.resolveStandard(L.selectionLibrary(library,selection),selection);}

test('all 85 size rows and their lengths have field-level primary evidence',()=>{
  let count=0,lengths=0;
  for(const f of families){
    const variants=f.variants?.length?f.variants.map(v=>L.variantFamily(f,v.id)):[f];
    for(const v of variants)for(const [size,row]of Object.entries(v.groessen)){
      count++;assert.equal(row.coverage,'documented');
      const check=(r,fields,label)=>{
        assert.equal(r.geometryStatus,'partial',label);
        assert.ok(r.missingGeometryFields.length>0,label);
        for(const [key,value]of Object.entries(r.roh)){
          const m=fields[key];assert.ok(m,label+'/'+key);
          assert.ok(['verified','single-source','missing','conflict'].includes(m.status));
          assert.ok(m.verificationMethod&&m.note);
          for(const ref of m.sourceRefs)assert.ok(f.sourceMeta[ref],label+'/'+ref);
          if(value===null)assert.equal(m.status,'missing');
          else{assert.ok([m.nominal,m.min,m.max].includes(value),label+'/'+key);assert.ok(m.sourceRefs.length>0);}
          if(m.status==='verified'){
            assert.equal(m.verification,true);
            const publishers=new Set(m.sourceRefs.map(ref=>new URL(f.sourceMeta[ref].url).hostname.replace(/^www\./,'')));
            assert.ok(publishers.size>=2,label+'/'+key+' independent publishers');
          }
          if(Number.isFinite(m.min)&&Number.isFinite(m.max))assert.ok(m.min<=m.max,label+'/'+key);
        }
        for(const [key,value]of Object.entries(r.vorbelegung)){
          const rawKey=v.feldzuordnung[key]||key,m=fields[rawKey];
          assert.ok(m,label+'/'+key+' default metadata');assert.notEqual(value,null);
          assert.notEqual(m.status,'missing',label+'/'+key);
          assert.ok([m.nominal,m.min,m.max].includes(value),label+'/'+key+' default value');
        }
      };
      check(row,v.fields[size],v.id+'/'+size);
      for(const [length,r]of Object.entries(row.nachLaenge)){lengths++;check(r,{...v.fields[size],...r.fields},v.id+'/'+size+'/'+length);}
    }
  }
  assert.equal(count,85);assert.ok(lengths>200);
});

test('DIN stud insertion ends and historical editions do not become shaft lengths',()=>{
  const a=read('DIN835'),b=read('DIN940');
  assert.equal(a.groessen.M6.vorbelegung.metalEndLength,12);
  assert.equal(b.groessen.M5.vorbelegung.metalEndLength,13);
  assert.equal(a.edition,'2010-07');assert.equal(a.currentEdition,'2025-08');
  assert.equal(b.edition,'2010-07');assert.equal(b.currentEdition,'2025-08');
  assert.equal(b.fields.M5.bm.status,'verified');
  const d=resolve('DIN940','M5',30);
  assert.equal(d.effective.metalEndLength,13);assert.equal(d.effective.sL,undefined);
  assert.ok(!d.issues.some(x=>x.code==='length-not-resolved'));
  assert.equal(d.effective.nominalLength,30);assert.equal(d.effective.nutEndThreadLength,16);
  assert.equal(d.effective.b,undefined);
});

test('ISO14581 keeps actual head diameter, size 45 drive and countersunk length',()=>{
  const f=read('ISO14581'),d=resolve(f.id,'M8',30);
  assert.equal(f.edition,'2013');assert.equal(f.currentEdition,'2022');
  assert.equal(d.effective.kD,15.8);assert.equal(d.effective.iSize,45);
  assert.equal(d.effective.totalLength,30);assert.equal(d.effective.sL,undefined);
  assert.equal(f.fields.M8.dk_actual_max.status,'single-source');
  assert.equal(f.fields.M6.dk_actual_max.status,'verified');
  assert.ok(f.groessen.M8.missingGeometryFields.includes('underheadReinforcement'));
});

test('ISO15072 uses its fine-thread and coarse-pitch shaft matrix without invented full b',()=>{
  const f=read('ISO15072');
  assert.equal(f.groessen.M10,undefined);
  assert.equal(f.groessen['M10x1'].vorbelegung.kSW,13);
  assert.equal(f.groessen['M12x1.5'].vorbelegung.kSW,15);
  const partial=resolve(f.id,'M8x1',35),full=resolve(f.id,'M8x1',30);
  assert.equal(partial.effective.b,22);assert.equal(partial.normBaseline.raw.lg_max,13);
  assert.equal(partial.normBaseline.raw.ls_min,6.75);
  assert.equal(full.effective.threadMode,'full');assert.equal(full.effective.b,undefined);
  assert.equal(f.groessen['M8x1'].nachLaenge[30].fields.b_actual.status,'missing');
  assert.equal(partial.effective.flangeHeight,undefined);
  assert.equal(f.groessen['M8x1'].roh.c_min,1.2);
});

test('self-tapping dimensions keep ST identity and three different length references',()=>{
  for(const id of ['ISO7049','ISO7050','ISO7051']){
    const f=read(id);assert.equal(f.threadFamily,'self-tapping');
    assert.ok(Object.keys(f.groessen).every(k=>k.startsWith('ST')));
    assert.equal(f.groessen.ST3_9,undefined);assert.equal(f.groessen['ST3.9'],undefined);
    assert.equal(f.groessen['ST4.8'].vorbelegung.sD,undefined);
    assert.ok(f.groessen['ST4.8'].missingGeometryFields.includes('rollingBlankDiameter'));
  }
  const pan=resolve('ISO7049','ST4.8',32),flat=resolve('ISO7050','ST4.8',32),raised=resolve('ISO7051','ST4.8',32);
  assert.equal(pan.effective.sL,32);
  assert.equal(flat.effective.totalLength,32);assert.equal(flat.effective.sL,undefined);
  assert.equal(raised.effective.countersunkLength,32);assert.equal(raised.effective.sL,undefined);
  assert.equal(raised.effective.capHeight,1.2);assert.equal(raised.effective.kH,2.8);
  assert.ok(read('ISO7049').groessen['ST4.8'].nachLaenge[38]);
  assert.equal(read('ISO7050').groessen['ST4.8'].nachLaenge[38],undefined);
});

test('DIN7500 requires an explicit manufacturer head variant and no circular blank guess',()=>{
  const f=read('DIN7500');assert.deepEqual(f.groessen,{});
  const c=resolve(f.id,'M3',10,'C'),m=resolve(f.id,'M3',10,'M');
  assert.equal(c.effective.kD,5.6);assert.equal(c.effective.kH,2.4);
  assert.equal(m.effective.kD,5.5);assert.equal(m.effective.kH,1.65);
  assert.equal(c.effective.sL,10);assert.equal(m.effective.totalLength,10);
  assert.equal(c.effective.sD,undefined);assert.equal(c.effective.iT,undefined);
  assert.equal(f.klassen.status,'not-applicable');assert.deepEqual(f.klassen.values,[]);
  for(const v of f.variants)assert.equal(v.threadFamily,'trilobular');
  assert.ok(f.variants.find(v=>v.id==='C').sizeData.M4.nachLaenge[45]);
  assert.equal(f.variants.find(v=>v.id==='C').sizeData.M4.nachLaenge[30],undefined);
});
