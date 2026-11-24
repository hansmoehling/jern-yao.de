const E=require('../engine.js');
const M=require('../maschinen.json');
const W=n=>E.WERKSTOFFE.findIndex(w=>w.id.startsWith(n));
const F=[
 {name:'M8 Flanschschraube 8.8', e:{typ:'bolzen',wst:W('23MnB4'),d0:7.6,kopfForm:'rund',kD:17,kH:6,sD:7.2,sL:40}},
 {name:'M6 Zylinderschraube ISO 4762 10.9', e:{typ:'bolzen',wst:W('33B2'),d0:5.6,kopfForm:'rund',kD:10,kH:6,sD:5.4,sL:30,iSW:5,iT:3}},
 {name:'M10 Sechskantschraube abgegratet', e:{typ:'bolzen',wst:W('20MnB4'),d0:9.2,kopfForm:'abgratet',kD:18,kSW:16,kH:6.4,sD:9.0,sL:50}},
 {name:'M10 Mutter C10C', e:{typ:'mutter',wst:W('C10C'),d0:13,mSW:16,mH:8,mLoch:8.4}},
 {name:'Hülse mit Bund, gelocht', e:{typ:'formteil',wst:W('C15C'),d0:16,kopfForm:'rund',kD:24,kH:5,sD:16,sL:30,nD:10,nT:20,nDurch:true}},
 {name:'Langer Bolzen M12x150', e:{typ:'bolzen',wst:W('23MnB4'),d0:11,kopfForm:'rund',kD:19,kH:8,sD:10.8,sL:150}},
];
for(const f of F){
  const a=E.auslegen(f.e);
  console.log('\n=== '+f.name+'  fehlt:',a.fehlt.join(','));
  if(a.fehlt.length) continue;
  const w=a.werte;
  console.log('L0',w.L0.toFixed(1),'masse g',w.masse.toFixed(1),'s',w.sKopf.toFixed(2),'St',w.stationen,'Fmax t',w.Fmax_t.toFixed(1),'Fsum t',w.Fsum_t.toFixed(1),'KO',w.ko.toFixed(1),'PKO',w.pko.toFixed(1),'Mat',Math.round(w.matD.min)+'..'+Math.round(w.matD.ideal)+'x'+Math.round(w.matL),'Stempel',w.stempelD&&Math.round(w.stempelD));
  a.stufen.forEach((s,i)=>console.log('  '+(i+1)+'. '+s.v+'  '+s.t.toFixed(1)+' t'));
  a.hinweise.forEach(h=>console.log('  ! '+h));
  const r=E.waehle(M,a,f.e);
  console.log('passend',r.passend.length,'bedingt',r.bedingt.length,'fast',r.fast.length);
  [...r.passend.slice(0,3),...r.bedingt.slice(0,2)].forEach(x=>console.log('  ->',x.o.m,x.gesamt,x.o.rp,Math.round(x.ausl*100)+'%',x.k.filter(k=>k.status!=='ok').map(k=>k.krit+':'+k.status).join('; ')));
  r.fast.slice(0,2).forEach(x=>console.log('  ~ ',x.o.m,x.k.filter(k=>k.status==='nein').map(k=>k.krit+' '+k.soll+' vs '+k.ist).join('; ')));
}
