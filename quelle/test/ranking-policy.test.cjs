const test=require('node:test'),assert=require('node:assert/strict');
const {build,E,MASCHINEN,PRAXIS}=require('../../pruef/pruefstand.cjs');

test('v2 engine passes threaded nominal size and preserves the published v1 decisions',()=>{
  for(const [id,groesse,laenge,oldModel,newPrefix] of [
    ['ISO4762','M6',30,'JBF-10B2S','JBF-10B3'],
    ['ISO4017','M8',40,'JBF-10B2S','JBF-13'],
    ['ISO4014','M12',80,'JBF-17B2S','JBF-19']
  ]){
    const {e}=build({id,groesse,laenge,festigkeitsklasse:'8.8'}),a=E.auslegen(e);
    const legacy=E.waehle(MASCHINEN,a,{...e,machinePolicy:'ranking-v1'},PRAXIS);
    assert.equal(legacy.ranking.version,'ranking-v1');
    assert.equal(legacy.ranking.recommendation.o.m,oldModel);
    const current=E.waehle(MASCHINEN,a,e,PRAXIS);
    assert.equal(current.ranking.version,'ranking-v2');
    assert.equal(current.ranking.recommendation.ranking.classification,'A');
    assert(current.ranking.recommendation.o.m.startsWith(newPrefix),id+': '+current.ranking.recommendation.o.m);
    assert.equal(current.ranking.checkedCount,MASCHINEN.length);
    assert.notEqual(E.maschinenKonzept(a,e,current.ranking.recommendation.o,PRAXIS).status,'unsuitable');
    const withoutThreadModel=E.waehle(MASCHINEN,a,{...e,threadModel:undefined},PRAXIS);
    assert.equal(withoutThreadModel.ranking.recommendation.o.m,current.ranking.recommendation.o.m,'norm reference retains nominal-size fallback');
  }
});

test('five-stage nuts use regular five-station nut capacity only in the new policy',()=>{
  const {e}=build({id:'ISO4032',groesse:'M10',festigkeitsklasse:'8'}),a=E.auslegen(e);
  const model=MASCHINEN.find(o=>o.f==='JNF'&&o.st===5);
  assert.equal(a.werte.stationen,5);
  assert.equal(E.pruefe(model,a,e,PRAXIS).k.find(c=>c.krit==='Stationen').status,'ok');
  assert.equal(E.pruefe(model,a,{...e,machinePolicy:'ranking-v1'},PRAXIS).k.find(c=>c.krit==='Stationen').status,'knapp');
  const parts=MASCHINEN.find(o=>o.f==='JPF'&&o.st===5);
  assert.equal(E.pruefe(parts,a,e,PRAXIS).k.find(c=>c.krit==='Stationen').status,'knapp');
});
