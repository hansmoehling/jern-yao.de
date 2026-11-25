const E=require('../engine.js');
const M=require('../maschinen.json');
const W=n=>E.WERKSTOFFE.findIndex(w=>w.id.startsWith(n));
const fmt=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'offen';
const F=[
 {name:'M8 Flanschschraube 8.8', e:{typ:'bolzen',wst:W('23MnB4'),d0:7.6,kopfForm:'rund',kD:17,kH:6,sD:7.2,sL:40}},
 {name:'M6 Zylinderschraube ISO 4762 10.9', e:{typ:'bolzen',wst:W('33B2'),d0:5.6,kopfForm:'rund',kD:10,kH:6,sD:5.4,sL:30,iSW:5,iT:3}},
 {name:'M10 Sechskantschraube abgegratet', e:{typ:'bolzen',wst:W('20MnB4'),d0:9.2,kopfForm:'abgratet',kD:18,kSW:16,kH:6.4,sD:9.0,sL:50}},
 {name:'M10 Mutter C10C', e:{typ:'mutter',wst:W('C10C'),d0:13,mSW:16,mH:8,mLoch:8.4}},
 {name:'Hülse mit Bund, gelocht', e:{typ:'formteil',wst:W('C15C'),d0:16,kopfForm:'rund',kD:24,kH:5,sD:16,sL:30,nD:10,nT:20,nDurch:true}},
 {name:'Langer Bolzen M12x150', e:{typ:'bolzen',wst:W('23MnB4'),d0:11,kopfForm:'rund',kD:19,kH:8,sD:10.8,sL:150}},
 // Prüffälle aus Stadienplänen (Sammlung «Literatur», Bericht vom 25.11.2026); plan = Stufen laut Plan
 {name:'Plan Exzenter 3,5 C10C (5 Stufen, Abschnitt 13,4)', plan:5, e:{typ:'bolzen',wst:W('C10C'),d0:4.64,kopfForm:'rund',kD:9,kH:1.45,sD:4.9,sL:7.65,iSW:4,iT:2.5,vorgaben:{zusatz:2}}},
 {name:'Plan Spindel mit Paddelkopf (4 Stufen, Abschnitt 64,7)', plan:4, e:{typ:'bolzen',wst:W('C10C'),d0:9.65,kopfForm:'rund',kD:26.2,kH:4.67,sD:6.82,sL:60.8,vorgaben:{zusatz:1}}},
 {name:'Plan Hülse 9 mm CuZn (6 Stufen + 1 frei, Abschnitt 10,2)', plan:6, e:{typ:'formteil',wst:W('CuZn37'),d0:8.3,kopfForm:'rund',sD:9.85,sL:20,nD:8.4,nT:15.75,masse:4.62,vorgaben:{zusatz:2}}},
 {name:'Plan Bundhülse 26002 (5 Stufen + 1 Reserve, Abschnitt 15,8)', plan:5, e:{typ:'formteil',wst:W('C15C'),d0:12,kopfForm:'rund',kD:20.4,kH:2.1,sD:17.15,sL:6.1,nD:7.9,nT:6.1,masse:13.99}},
 {name:'Plan Kupferkontakt Ø1,25 (kein Modell erwartet)', plan:5, e:{typ:'formteil',wst:W('Cu-ETP'),d0:1.25,kopfForm:'rund',kD:1.77,kH:3,sD:0.5,sL:5,nD:1.2,nT:2.5,masse:0.0315}},
 {name:'H4 Stift D-02 CuZn37 (Annahmen)', e:{typ:'formteil',wst:W('CuZn37'),d0:5.5,kopfForm:'rund',kD:6.6,kH:10,sD:3.9,sL:17.4,nD:2.6,nT:8}},
 {name:'H4 Gegenkontakt D-05 CuZn37 (Annahmen)', e:{typ:'formteil',wst:W('CuZn37'),d0:5.5,kopfForm:'rund',kD:6.6,kH:10,sD:5.2,sL:23.1,nD:4.0,nT:8}},
 {name:'Formteil gewendet, JPF-Produktmaß', e:{typ:'formteil',wst:W('C10C'),d0:14,kopfForm:'rund',kD:20,kH:6,sD:14,sL:30,nD:8,nT:10,wenden:true}},
];
for(const f of F){
  const a=E.auslegen(f.e);
  console.log('\n=== '+f.name+'  fehlt:',a.fehlt.join(','));
  if(a.fehlt.length) continue;
  const w=a.werte;
  if(f.plan) console.log('Stufen: Plan '+f.plan+', Rechenkern '+w.stationen+(f.plan===w.stationen?' (gleich)':''));
  console.log('L0',fmt(w.L0),'masse g',fmt(w.masse),'s',fmt(w.sKopf,2),'St',w.stationen,'Fmax t',fmt(w.Fmax_t),'Fsum t',fmt(w.Fsum_t),'KO',fmt(w.ko),'PKO',fmt(w.pko),'Mat',Math.round(w.matD.min)+'..'+Math.round(w.matD.ideal)+'x'+Math.round(w.matL),'Stempel',w.stempelD&&Math.round(w.stempelD));
  a.stufen.forEach((s,i)=>console.log('  '+(i+1)+'. '+s.v+'  '+fmt(s.t)+' t'));
  a.hinweise.forEach(h=>console.log('  ! '+h));
  const r=E.waehle(M,a,f.e);
  console.log('passend',r.passend.length,'bedingt',r.bedingt.length,'fast',r.fast.length);
  [...r.passend.slice(0,3),...r.bedingt.slice(0,2)].forEach(x=>console.log('  ->',x.o.m,x.gesamt,x.o.rp,Number.isFinite(x.ausl)?Math.round(x.ausl*100)+'%':'offen',x.k.filter(k=>k.status!=='ok').map(k=>k.krit+':'+k.status).join('; ')));
  r.fast.slice(0,2).forEach(x=>console.log('  ~ ',x.o.m,x.k.filter(k=>k.status==='nein').map(k=>k.krit+' '+k.soll+' vs '+k.ist).join('; ')));
}
