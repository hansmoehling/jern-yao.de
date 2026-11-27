'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const N=require('../normen/library'),R=require('../normen/resolver');
const ids=['ISO4014','DIN931','ISO8765','DIN960','ISO4162','EN1665','ISO4762','ISO4017'];
const families=ids.map(id=>require('../normen/'+id+'.json'));
const data={...require('../normen/index'),families,threads:require('../normen/gewinde')};
const family=id=>families.find(f=>f.id===id);
const row=(id,size)=>family(id).groessen[size];
const lengths=(id,size)=>N.lengths(family(id),size).map(Number);
function document(id,size,length,versioned=true){return R.resolveStandard(data,{id,groesse:size,laenge:length,festigkeitsklasse:'8.8'},{},versioned?{shaftPolicy:'shaft-v2'}:{});}
const preset=(id,size,length)=>N.adapt(data,document(id,size,length));

test('ISO4014 current length cells are not interpolated from an older catalogue range',()=>{
 assert.deepEqual(lengths('ISO4014','M12'),[50,55,60,65,70,80,90,100,110,120]);
 assert.deepEqual(lengths('ISO4014','M3.5'),[20,25,30,35]);
 assert.deepEqual(lengths('ISO4014','M7'),[35,40,45,50,55,60,65,70]);
 assert.equal(row('ISO4014','M12').nachLaenge['30'],undefined);
 assert.equal(row('ISO4014','M12').nachLaenge['75'],undefined);
 const c=row('ISO4014','M12').nachLaenge['80'];
 assert.equal(c.lengthEvidence.kind,'standard-matrix');assert.equal(c.lengthEvidence.edition,'2022');assert.equal(c.lengthEvidence.verification,true);
 assert.deepEqual(preset('ISO4014','M12',80).shaftSegments,[{diameter:12,length:50},{diameter:10.75,length:30}]);
});

test('DIN931 catalogue combinations stay catalogue combinations, including large sizes',()=>{
 const c=row('DIN931','M12').nachLaenge['40'];assert.equal(c.lengthEvidence.kind,'catalogue-matrix');assert.equal(c.lengthEvidence.edition,null);
 assert.ok(c.lengthEvidence.sourceRefs.includes('wasi931'));assert.ok(c.lengthEvidence.verification);
 assert.deepEqual(lengths('DIN931','M33'),[110,120,150,180]);
 assert.equal(row('ISO4014','M33').nachLaenge['110'].lengthEvidence.kind,'catalogue-matrix');
 assert.equal(preset('DIN931','M22',100).kSW,32);assert.equal(preset('ISO4014','M22',100).kSW,34);
});

test('fine-thread corroboration matches the actual pitch and never borrows a neighbouring pitch programme',()=>{
 const iso=row('ISO8765','M12').nachLaenge['80'];
 assert.equal(row('ISO8765','M12').roh.P,1.5);assert.deepEqual(iso.lengthEvidence.sourceRefs,['iso8765_2022']);assert.equal(iso.lengthEvidence.verification,false);
 assert.equal(row('ISO8765','M8').nachLaenge['80'].lengthEvidence.verification,true);
 assert.equal(row('DIN960','M10').roh.P,1);assert.deepEqual(lengths('DIN960','M10'),[40,60,110]);
 assert.equal(row('DIN960','M10').nachLaenge['55'],undefined,'55 belongs to M10x1.25 in the observed Böllhoff matrix');
 assert.deepEqual(lengths('DIN960','M18'),[]);assert.deepEqual(lengths('DIN960','M22'),[]);assert.deepEqual(lengths('DIN960','M33'),[]);
 assert.deepEqual(lengths('ISO8765','M33'),[130,320],'two published endpoints do not imply an intermediate preferred-number series');
});

test('explicit short flange full threads override the generic b reference, without negative segments',()=>{
 const p=preset('EN1665','M12',40);
 assert.equal(p.b,40);assert.equal(p.shaftType,'full');assert.equal(p.shaftSegments,undefined);
 assert.equal(p.shaftModelAssumption.threadLengthOrigin,'standard-length-cell');assert.equal(p.shaftModelAssumption.shortLengthApproximation,false);
 assert.equal(p.shaftModelAssumption.sourceVerification,true);
 const c=row('EN1665','M12').nachLaenge['40'];assert.equal(c.roh.ls_min,null);assert.equal(c.roh.lg_max,5.25);
 const next=preset('EN1665','M12',45);assert.equal(next.b,30);assert.equal(next.shaftType,'partial');assert.equal(next.shaftSegments[0].length,15);
 assert.equal(row('EN1665','M12').nachLaenge['45'].roh.ls_min,6.25);
});

test('an observed historical full-thread cell remains single-source, not falsely independently verified',()=>{
 const p=preset('ISO4162','M12',40);
 assert.equal(p.b,40);assert.equal(p.shaftType,'full');assert.equal(p.shaftModelAssumption.sourceVerification,false);
 assert.equal(p.shaftModelAssumption.lengthEvidence.edition,'1990');assert.equal(p.shaftModelAssumption.lengthEvidence.kind,'historical-standard-matrix');
 assert.deepEqual(p.shaftModelAssumption.sourceRefs,['iso4162-original']);
 const altered=structuredClone(data),f=altered.families.find(f=>f.id==='EN1665'),c=f.groessen.M12.nachLaenge['40'];
 c.fields.threadMode.verification=false;c.fields.threadMode.status='conflict';
 assert.equal(N.adapt(altered,document('EN1665','M12',40)).b,30,'a conflicting cell may not silently replace the verified b model');
});

test('customer b and explicit shaft segments take precedence over a short full-thread template',()=>{
 const d=document('EN1665','M12',40),edited=N.adapt(data,R.setOverride(d,'b',20));
 assert.equal(edited.b,20);assert.equal(edited.shaftType,'partial');assert.equal(edited.shaftSegments[0].length,20);
 const segments=[{diameter:12,length:10},{diameter:10,length:30}];
 const p=N.adapt(data,R.setOverride(d,'shaftSegments',segments));assert.deepEqual(p.shaftSegments,segments);assert.equal(p.shaftModelStatus,'customer');assert.equal(p.b,undefined);
});

test('socket screw short lengths retain full thread while large historical rows identify their edition',()=>{
 assert.deepEqual(lengths('ISO4762','M3'),[5,6,8,10,12,16,20,25,30]);
 for(const [size,length]of [['M3',5],['M4',6],['M6',10],['M12',20]]){
  const c=row('ISO4762',size).nachLaenge[String(length)];assert.equal(c.roh.threadMode,'full');assert.equal(c.roh.b_actual,length);assert.equal(preset('ISO4762',size,length).shaftSegments,undefined);
 }
 assert.equal(row('ISO4762','M14').nachLaenge['140'].lengthEvidence.edition,'1997');
 assert.equal(row('ISO4762','M14').nachLaenge['140'].lengthEvidence.kind,'historical-standard-matrix');
 assert.equal(row('ISO4762','M36').nachLaenge['300'],undefined,'unseen continuation is not invented');
 assert.equal(row('ISO4762','M14').nachLaenge['60'].roh.ls_min,10);
});

test('full-thread hexagonal rows and additional sizes are read from their own current matrix',()=>{
 assert.deepEqual(lengths('ISO4017','M33'),[65,70,80,90,100,110,120,130,140,150,160,180,200]);
 for(const [size,length]of [['M3.5',8],['M7',70],['M33',65]]){const c=row('ISO4017',size).nachLaenge[String(length)];assert.equal(c.roh.threadMode,'full');assert.equal(c.roh.b_actual,length);assert.equal(c.lengthEvidence.edition,'2022');}
 assert.equal(preset('ISO4017','M33',65).kSW,50);assert.equal(preset('ISO4017','M33',65).kH,21);
});

test('current edition evidence does not relabel historical geometry or serve as a second dimension source',()=>{
 const f=family('ISO4162');assert.equal(f.edition,'1990');assert.equal(f.currentEdition,'2012');
 for(const r of Object.values(f.groessen))for(const c of Object.values(r.nachLaenge)){
  assert.equal(c.lengthEvidence.edition,'1990');assert.deepEqual(c.lengthEvidence.sourceRefs,['iso4162-original']);assert.equal(c.lengthEvidence.verification,false);
 }
 assert.equal(family('EN1665').edition,'1997 + AC:2007');
 assert.equal(family('DIN931').edition,'1987-09');assert.equal(family('DIN931').editionStatus,'historical-catalogue-data');
});

test('every matrix cell has valid geometry, precise provenance and an honest completeness boundary',()=>{
 const expected={ISO4014:162,DIN931:307,ISO8765:85,DIN960:109,ISO4162:96,EN1665:112,ISO4762:193,ISO4017:245};
 let total=0;
 for(const f of families){let count=0,single=0;assert.equal(f.lengthMatrixPolicy.complete,false);
  const registry=new Map([...Object.entries(f.sourceMeta||{}),...f.quellen.map(s=>[s.id,s])]);
  for(const [size,r]of Object.entries(f.groessen))for(const [length,c]of Object.entries(r.nachLaenge||{})){
   count++;assert.ok(+length>0);assert.equal(c.roh.sL,+length);assert.ok(c.roh.b_actual>0&&c.roh.b_actual<=+length,`${f.id} ${size} ${length}`);
   assert.ok(['full','partial'].includes(c.roh.threadMode));const e=c.lengthEvidence;assert.ok(e&&e.sourceRefs.length);
   const docs=e.sourceRefs.map(id=>registry.get(id)?.url);assert.ok(docs.every(Boolean),`${f.id} ${size} ${length}`);
   if(e.verification)assert.ok(new Set(docs).size>=2);else single++;
   for(const fact of Object.values(c.fields))if(fact.verification)assert.ok(new Set(fact.sourceRefs.map(id=>registry.get(id)?.url)).size>=2,`${f.id} ${size} ${length}`);
  }
  assert.equal(count,expected[f.id],f.id);assert.equal(single,f.lengthMatrixPolicy.singleSourceCells,f.id);total+=count;
 }
 assert.equal(total,1309);
});

test('legacy documents do not inherit newly added flange shaft bounds and unverified longer b remains unavailable',()=>{
 const legacy=N.adapt(data,document('EN1665','M12',80,false));assert.equal(legacy.shaftSegments,undefined);assert.equal(legacy.flangeHeight,undefined);
 const old=N.adapt(data,document('ISO4014','M12',80,false));assert.equal(old.b,undefined);assert.equal(old.shaftSegments,undefined);
 const missing=preset('ISO4014','M3.5',150);assert.equal(missing.b,undefined);assert.equal(missing.shaftSegments,undefined);assert.ok(missing.normMissingFields.includes('shaftLengthDistribution'));
});
