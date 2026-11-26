const test=require('node:test'),assert=require('node:assert/strict'),K=require('../kvp-context.js');
test('technical context drops part identity, drawings, contact data and assumed Rm',()=>{
 const c=K.fromCalculation({input:{typ:'bolzen',standardKind:'rivet',d0:4,materialState:'soft-annealed',email:'private',filename:'customer.pdf'},values:{L0:12,rm:400,sKopf:2},material:{id:'C4C'},stages:2,selectedModel:'JBF-10B2S'});
 assert.deepEqual(c.features,{klasse:'niet',topologie:'kopf-schaft',merkmale:{d0:4,werkstoffgruppe:'unlegiert-weich',L0_d0:3,stauch_h0_d0_max:2}});
 assert.ok(!JSON.stringify(c).includes('private'));assert.equal(c.predictedStages,2);
});
test('cold-drawn input is never classified as soft-annealed; incomplete scans cannot send invented dimensions',()=>{
 assert.equal(K.fromCalculation({source:'drawing'}),null);
 assert.equal(K.fromCalculation({input:{d0:6,typ:'formteil',materialState:'cold-drawn'},material:{id:'C10C'}}).features.merkmale.werkstoffgruppe,'unbekannt');
});
