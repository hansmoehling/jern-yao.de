const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=id=>JSON.parse(fs.readFileSync(path.join(__dirname,'../normen',id+'.json'),'utf8'));
const ids=['DIN960','DIN961','ISO8765','ISO7379','ISO4766','ISO7434','ISO7435','ISO7436'];

test('all eight datasets have source-bound rows; missing dimensions stay null',()=>{
 for(const id of ids){const f=read(id);assert.ok(Object.keys(f.groessen).length>0,id);
  for(const [size,row]of Object.entries(f.groessen)){
   assert.equal(row.coverage,'documented');assert.ok(Array.isArray(row.missingGeometryFields));
   for(const [rawKey,value]of Object.entries(row.roh)){
    const md=f.fields[size][rawKey];assert.ok(md,`${id}/${size}/${rawKey}`);
    assert.equal(md.nominal,value);assert.ok(md.note);assert.ok(md.sourceRefs.length);
    for(const ref of md.sourceRefs)assert.ok(f.sourceMeta[ref]);
    if(value===null)assert.equal(md.status,'missing');
    if(md.status==='verified'){assert.equal(md.verification,true);assert.ok(md.sourceRefs.length>=2);}
    else assert.equal(md.verification,false);
   }
   for(const [L,lr]of Object.entries(row.nachLaenge||{})){
    assert.ok(+L>0);for(const [rawKey,value]of Object.entries(lr.roh)){
     const md=lr.fields[rawKey];assert.ok(md,`${id}/${size}/${L}/${rawKey}`);assert.equal(md.nominal,value);
     for(const ref of md.sourceRefs)assert.ok(f.sourceMeta[ref]);
    }
   }
  }
 }
});

test('historical DIN fine-thread heads retain widths distinct from ISO 8765',()=>{
 const din=read('DIN960'),full=read('DIN961'),iso=read('ISO8765');
 assert.equal(din.edition,'1990-01');assert.equal(full.edition,'1990-01');assert.equal(iso.edition,'2022');
 for(const [size,d,i]of [['M10',17,16],['M12',19,18],['M14',22,21],['M22',32,34]]){
  assert.equal(din.groessen[size].vorbelegung.kSW,d);assert.equal(full.groessen[size].vorbelegung.kSW,d);assert.equal(iso.groessen[size].vorbelegung.kSW,i);
 }
 assert.deepEqual(din.groessen.M10.steigungen,[1,1.25]);assert.deepEqual(iso.groessen.M10.steigungen,[1.25,1]);
 assert.equal(iso.groessen.M18.roh.k_max_A,11.715);
});

test('DIN 960 conflicting reference lengths are disclosed, not falsely verified',()=>{
 const f=read('DIN960'),m=f.fields.M10.b_ref_l_le_125;
 assert.equal(m.status,'conflict');assert.equal(m.verification,false);assert.deepEqual(m.alternatives.map(x=>x.value),[26,28]);
 assert.equal(f.fields.M12.b_ref_125_lt_l_le_200.status,'conflict');
 assert.equal(f.fields.M20.b_ref_l_le_125.status,'conflict');
 assert.equal(f.groessen.M6,undefined);assert.equal(f.sizeCoverage.M6.status,'unresearched');
 assert.equal(f.groessen.M10.roh.ls_min,null);assert.ok(f.groessen.M10.missingGeometryFields.includes('shaftLengthDistribution'));
});

test('DIN 961 documented full-thread length cells retain correct product-grade limits',()=>{
 const f=read('DIN961');
 assert.equal(f.groessen.M8.nachLaenge[8].vorbelegung.b,8);assert.equal(f.groessen.M8.nachLaenge[8].vorbelegung.threadMode,'full');
 assert.equal(f.groessen.M8.nachLaenge[100].roh.productGrade,'B');assert.equal(f.groessen.M8.nachLaenge[100].fields.sL.min,98.25);
 assert.equal(f.groessen.M10.nachLaenge[100].roh.productGrade,'A');assert.equal(f.groessen.M10.nachLaenge[100].fields.sL.min,99.3);
 assert.equal(f.groessen.M27.nachLaenge[20].fields.sL.min,18.95);
 assert.equal(f.groessen.M33.nachLaenge[30],undefined);assert.equal(f.groessen.M8.nachLaenge[130],undefined);
});

test('ISO 8765 length-specific runout and grade-A coverage remain bounded',()=>{
 const f=read('ISO8765');
 assert.deepEqual([f.groessen.M8.nachLaenge[40].roh.ls_min,f.groessen.M8.nachLaenge[40].roh.lg_max],[11.75,18]);
 assert.deepEqual([f.groessen.M10.nachLaenge[45].roh.ls_min,f.groessen.M10.nachLaenge[45].roh.lg_max],[11.5,19]);
 assert.deepEqual([f.groessen.M24.nachLaenge[90].roh.ls_min,f.groessen.M24.nachLaenge[90].roh.lg_max],[21,36]);
 assert.equal(f.groessen.M8.nachLaenge[30],undefined);assert.equal(f.groessen.M14.nachLaenge[130].roh.b_actual,40);
 assert.equal(f.sizeCoverage.M30.status,'documented');assert.equal(f.catalogueSupplement.rows.M30.s_nom,46);
 assert.deepEqual(Object.keys(f.groessen.M30.nachLaenge),['120','300']);
 assert.equal(f.groessen.M30.nachLaenge[300].lengthEvidence.kind,'catalogue-range-endpoint');
 assert.equal(f.groessen.M30.nachLaenge[300].lengthEvidence.edition,null,'a manufacturer endpoint is not a viewed grade-B 2022 matrix');
});

test('ISO 7379 preserves normative shoulders and never calls shoulder length total shaft length',()=>{
 const f=read('ISO7379');
 for(const [size,d]of [['M5',6.5],['M10',13],['M20',25]])assert.equal(f.groessen[size].roh.ds_nom,d);
 assert.equal(f.groessen.M5.roh.ds_max,6.487);assert.equal(f.groessen.M8.roh.b_min,12.75);assert.equal(f.groessen.M8.roh.b_max,13.25);
 const r=f.groessen.M8.nachLaenge[40];assert.equal(r.roh.shoulderLength,40);assert.equal(r.roh.shoulderLength_max,40.25);
 assert.equal(r.vorbelegung.sL,undefined);assert.equal(r.vorbelegung.sD,undefined);assert.ok(r.missingGeometryFields.includes('shaftLengthDistribution'));
 assert.equal(f.sizeCoverage.M3.status,'not-in-standard');assert.equal(f.groessen.M5.nachLaenge[40],undefined);
});

test('slotted profiles keep their separate end dimensions and expose unresolved contours',()=>{
 const flat=read('ISO4766'),cone=read('ISO7434'),dog=read('ISO7435'),cup=read('ISO7436');
 assert.equal(flat.groessen.M3.vorbelegung.slotWidth,.46);assert.equal(flat.groessen.M3.roh.n_nom,.4);
 assert.equal(flat.groessen.M3.roh.dp_max,2);assert.equal(cone.groessen.M3.roh.dt_max,.3);
 assert.equal(dog.groessen.M3.roh.dp_max,2);assert.equal(cup.groessen.M3.roh.dz_max,1.4);
 assert.equal(dog.groessen.M3.roh.z_long_max,null);assert.equal(cup.groessen.M3.roh.cupDepth,null);
 assert.equal(cone.edition,'1983');assert.equal(cone.currentEdition,'2024');assert.equal(cone.groessen.M3.roh.tipAngle,null);
 for(const f of [flat,cone,dog,cup]){assert.equal(f.groessen.M3.geometryStatus,'partial');assert.equal(f.groessen.M3.nachLaenge[8].lengthEvidence.edition,'1983');assert.equal(f.sizeCoverage.M16.status,'not-in-standard');}
 assert.equal(dog.groessen.M3.nachLaenge[4],undefined,'dog-point minimum commercial length is 5 mm');
 assert.equal(cone.sizeCoverage['M3.5'].status,'documented');
});
