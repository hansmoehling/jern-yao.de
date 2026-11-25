'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const M=require('../maschinen.json');
const P=require('../praxis.json');
const W=id=>E.WERKSTOFFE.findIndex(w=>w.id===id);
const four={typ:'bolzen',wst:W('20MnB4'),d0:8,kopfForm:'rund',kD:24,kH:10,sD:8,sL:40};
const matching=(a,e,n)=>E.waehle(M,a,e,P).alle.find(row=>row.o.st===n&&row.gesamt!=='nein')?.o;

test('four calculated stages remain four on four- and six-station catalog machines',()=>{
 const a=E.auslegen(four),m4=matching(a,four,4),m6=matching(a,four,6);
 assert.equal(a.stufen.length,4);assert.ok(m4&&m6);
 const before=JSON.stringify(a),c4=E.maschinenKonzept(a,four,m4,P),c6=E.maschinenKonzept(a,four,m6,P);
 for(const c of [c4,c6]){
  assert.equal(c.status,'candidate');assert.equal(c.requiredStations,4);assert.equal(c.stages.length,4);
  assert.deepEqual(c.blank,{diameter:a.werte.d0,length:a.werte.L0,unit:'mm'});
  assert.deepEqual(c.stages.map(x=>x.operation),a.stufen.map(x=>x.v));
 }
 assert.equal(c4.availableStations,4);assert.equal(c4.reserveStations,0);
 assert.equal(c6.availableStations,6);assert.equal(c6.reserveStations,2);
 assert.deepEqual(c4.stages,c6.stages);assert.match(c6.rationale,/Gleiche berechnete Basisfolge/);
 assert.equal(JSON.stringify(a),before,'mapping never mutates the calculation');
});
test('real combined operations retain their own zones within a single computed station',()=>{
 const e={typ:'bolzen',wst:W('33B2'),d0:5.6,kopfForm:'rund',kD:10,kH:6,sD:5.4,sL:30,iSW:5,iT:3};
 const a=E.auslegen(e),m=E.waehle(M,a,e,P).alle.find(x=>x.gesamt!=='nein').o,c=E.maschinenKonzept(a,e,m,P);
 assert.equal(c.stages.length,a.stufen.length);
 assert.equal(c.stages[0].kind,'combined');
 assert.deepEqual(c.stages[0].operations.map(x=>x.name),['Reduzieren','Vorstauchen']);
 assert.deepEqual(c.stages[0].operations.map(x=>x.location),['Schaft / Körper','Kopf / Bund']);
 assert.equal(c.stages.at(-1).kind,'combined');
 assert.ok(c.stages.at(-1).operations.some(x=>x.name==='Innenantrieb formen'));
});
test('nut outside forming and two-sided prepiercing stay one combined operation stage',()=>{
 const e={typ:'mutter',wst:W('C10C'),d0:13,mSW:16,mH:8,mLoch:8.4},a=E.auslegen(e);
 const m=E.waehle(M,a,e,P).alle.find(x=>x.gesamt!=='nein').o,c=E.maschinenKonzept(a,e,m,P);
 assert.equal(c.stages.length,5);assert.equal(c.stages[2].kind,'combined');
 assert.deepEqual(c.stages[2].operations.map(x=>x.name),['Sechskant formen','Beidseitig vorlochen']);
});
test('excluded catalog models get no assigned sequence; incomplete calculations get none either',()=>{
 const a=E.auslegen(four),small=M.find(x=>x.m==='JBF-7B2S'),c=E.maschinenKonzept(a,four,small,P);
 assert.equal(c.status,'unsuitable');assert.deepEqual(c.stages,[]);assert.match(c.rationale,/Stationen/);
 assert.equal(c.requiredStations,4);assert.equal(c.availableStations,2);assert.equal(c.reserveStations,0);
 assert.equal(E.maschinenKonzept(E.auslegen({...four,d0:0}),four,small,P).status,'incomplete');
 assert.deepEqual(E.maschinenKonzept(null,four,small,P).stages,[]);
 const nut=M.find(x=>x.f==='JNF'&&x.st>=4);
 assert.equal(E.maschinenKonzept(a,four,nut,P).status,'unsuitable');
});
test('extra machine capacity and unspecified extra stages never invent process details',()=>{
 const e={typ:'bolzen',wst:W('C15C'),d0:8,kopfForm:'rund',kD:13,kH:5,sD:8,sL:30,vorgaben:{zusatz:1,stationen:4}};
 const a=E.auslegen(e),m=matching(a,e,6),c=E.maschinenKonzept(a,e,m,P);
 assert.equal(c.status,'candidate');assert.equal(c.stages.length,a.stufen.length);
 assert.equal(c.requiredStations,4);assert.equal(c.reserveStations,2);
 assert.equal(c.stages.at(-1).kind,'unassigned');assert.equal(c.stages.at(-1).operations.length,1);
 assert.equal(c.stages.at(-1).operation,'Zusatzoperation noch festzulegen');
 assert.match(c.rationale,/Stationsvorgabe bindet weitere Plätze/);
});
test('hole location follows head-only versus body-spanning geometry',()=>{
 const e={typ:'formteil',wst:W('C15C'),d0:6,kD:12,kH:10,sD:6,sL:20,nD:5,nT:5},a=E.auslegen(e);
 assert.equal(a.stufen.find(x=>x.v.startsWith('Napf')).operations[0].location,'Napf im Kopf / Bund');
 const b=E.auslegen({...e,nT:15});
 assert.equal(b.stufen.find(x=>x.v.startsWith('Napf')).operations[0].location,'Napf durch Kopf / Bund und Körper / Schaft');
});

