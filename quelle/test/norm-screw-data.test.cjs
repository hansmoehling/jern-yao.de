const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'../normen');
const ids='ISO4014 ISO4017 ISO8765 ISO8676 DIN931 DIN933 DIN960 DIN961 ISO4162 EN1662 EN1665 DIN6921 ISO15071 ISO15072 ISO4762 ISO14579 ISO14580 ISO7380-1 ISO7380-2 ISO7984 DIN7984 ISO10642 ISO14581 ISO14584 ISO2009 ISO7046 ISO1580 ISO7045 ISO14583 ISO7049 ISO7050 ISO7051 DIN7500 ISO4026 ISO4027 ISO4028 ISO4029 ISO4766 ISO7434 ISO7435 ISO7436 ISO7379 DIN835 DIN938 DIN939 DIN940 DIN603 ISO8677'.split(' ');
const read=id=>JSON.parse(fs.readFileSync(path.join(base,id+'.json'),'utf8'));
test('screw families preserve per-value evidence and explicit gaps',()=>{
 for(const id of ids){const f=read(id);assert.equal(f.id,id);assert.ok(f.sourceMeta);assert.ok(f.groessen);assert.ok(f.fields);
  for(const [size,row]of Object.entries(f.groessen)){
   assert.equal(row.coverage,'documented');assert.ok(Array.isArray(row.missingGeometryFields));
   for(const [field,value]of Object.entries(row.vorbelegung)){assert.notEqual(value,null,`${id}/${size}/${field}`);assert.ok(f.fields[size][f.feldzuordnung[field]||field],`${id}/${size}/${field} metadata`);}
   for(const md of Object.values(f.fields[size])){
    assert.ok(['verified','single-source','missing','conflict'].includes(md.status));assert.ok(Array.isArray(md.sourceRefs));
    for(const ref of md.sourceRefs)assert.ok(f.sourceMeta[ref],`${id}/${size}: ${ref}`);
    if(md.status==='verified'){assert.ok(md.sourceRefs.length>=2);assert.equal(md.verification,true);}else assert.ok(md.note?.length);
   }
  }
 }
});
test('M6x30 socket screw uses full thread despite the 24 mm reference',()=>{
 const f=read('ISO4762'),r=f.groessen.M6;
 assert.deepEqual([r.vorbelegung.kD,r.vorbelegung.kH,r.vorbelegung.iSW,r.vorbelegung.iT],[10,6,5,3]);
 assert.equal(r.roh.b_ref,24);assert.equal(r.nachLaenge[30].vorbelegung.threadMode,'full');assert.equal(r.nachLaenge[30].vorbelegung.b,30);
 assert.equal(r.nachLaenge[35].roh.ls_min,6);assert.equal(r.nachLaenge[35].roh.lg_max,11);
 assert.equal(r.nachLaenge[30].plainLength,undefined);
 const resolver=require('../normen/resolver.js');
 const state=resolver.resolveStandard({version:'test',families:[f]},{id:f.id,groesse:'M6',laenge:30});
 assert.equal(state.effective.b,30);assert.equal(state.normBaseline.raw.b_ref,24);assert.equal(state.normBaseline.provenance.b.rawKey,'b_actual');
 for(const key of ['dk_max','k_max','s_nom','t_min'])assert.equal(f.fields.M6[key].status,'verified');
});
test('M8x40 full hex screw and DIN/ISO width differences remain distinct',()=>{
 const iso=read('ISO4017'),din=read('DIN933');assert.equal(iso.groessen.M8.nachLaenge[40].vorbelegung.threadMode,'full');
 assert.deepEqual(iso.groessen.M8.laengen,[16,20,25,30,35,40,45,50,55,60,65,70,80]);
 for(const [size,a,b]of [['M10',16,17],['M12',18,19],['M14',21,22],['M22',34,32]]){assert.equal(iso.groessen[size].vorbelegung.kSW,a);assert.equal(din.groessen[size].vorbelegung.kSW,b);}
});
test('a missing size never means a norm prohibition; invalid reference is not a screw',()=>{
 assert.equal(read('ISO4762').sizeCoverage.M18.status,'unresearched');assert.equal(read('ISO14580').sizeCoverage.M33.status,'not-in-standard');
 assert.equal(read('ISO7984').datasetKind,'invalid-reference');assert.equal(read('ISO7984').correctedReference,'DIN7984');
 assert.equal(read('DIN7984').groessen.M6.vorbelegung.iSW,4);assert.equal(read('ISO4028').groessen.M6.vorbelegung.iSW,3);
});
test('historical dimensions and fine thread scopes are never silently modernized',()=>{
 assert.equal(read('ISO10642').edition,'1997');assert.equal(read('ISO10642').currentEdition,'2026');
 assert.equal(read('ISO14579').edition,'2001');assert.deepEqual(read('ISO8676').groessen.M10.steigungen,[1.25,1]);
 assert.equal(read('ISO7046').part,'ISO7046-1');assert.ok(read('ISO7046').groessen.M6.missingGeometryFields.includes('recessVolumeModel'));
});
