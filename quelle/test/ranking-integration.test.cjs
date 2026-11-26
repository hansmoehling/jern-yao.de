const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),machines=require('../maschinen.json'),practice=require('../praxis.json');
const material=E.WERKSTOFFE.findIndex(x=>x.id==='C4C');
test('versioned selection checks every family and keeps hard exclusions outside the recommendation',()=>{
 const e={typ:'bolzen',standardKind:'rivet',schaftende:'voll',kopfTyp:'kugelabschnitt',kopfForm:'kugelabschnitt',kD:7,kH:2,sD:4,sL:10,d0:4,wst:material,curveId:E.WERKSTOFFE[material].flowCurves[0].id,materialState:'soft-annealed',rmPolicy:'rm-v1',machinePolicy:'ranking-v1'};
 const a=E.auslegen(e),selection=E.waehle(machines,a,e,practice);
 assert.equal(selection.ranking.checkedCount,machines.length);
 assert.equal(new Set(selection.alle.map(r=>r.o.f)).size,new Set(machines.map(r=>r.f)).size);
 assert.ok(selection.ranking.recommendation);
 assert.ok(selection.ranking.candidates.every(r=>!r.k.some(k=>k.status==='nein')));
 const first=selection.ranking.recommendation,tier=r=>r.gesamt==='offen'?1:0;
 assert.equal(first.o.rp,Math.min(...selection.ranking.candidates.filter(r=>tier(r)===tier(first)).map(r=>r.o.rp)));
 assert.notEqual(E.maschinenKonzept(a,e,first.o,practice).status,'unsuitable');
 const legacy=E.waehle(machines,a,{...e,machinePolicy:undefined},practice);assert.equal(legacy.ranking,undefined);
});
