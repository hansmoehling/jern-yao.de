const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../engine.js'),P=require('../standard-preview.js'),N=require('../normen/library.js'),R=require('../normen/resolver.js');
const base={typ:'bolzen',wst:0,d0:4,sD:4,sL:12,kD:7,kH:2.4,kopfForm:'kugelabschnitt',kopfTyp:'kugelabschnitt',iTyp:'none',schaftende:'voll'};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const preview=input=>P.render({input,analysis:E.auslegen(input),format:x=>x.toFixed(3)});

test('preview displays calculator volume and mass, never an independent silhouette calculation',()=>{
 const analysis={werte:{V:123.456,masse:.777,L0:9.876},fehlt:[]},html=P.render({input:base,analysis,material:{id:'C10C'},format:x=>x.toFixed(3)});
 assert(html.includes('123.456 mm³'));assert(html.includes('0.777 g'));assert(html.includes('9.876 mm'));assert(html.includes('C10C'));assert(html.includes('data-preview="outer"'));assert(!html.includes('NaN'));
 const result=E.auslegen(base),computed=preview(base);assert(computed.includes(result.werte.V.toFixed(3)+' mm³'));assert(computed.includes(result.werte.masse.toFixed(3)+' g'));
});

test('head drive and blind shaft-end bore are rendered at opposite ends with their true depths',()=>{
 const input={...base,kopfTyp:'zylinder',kopfForm:'rund',kD:10,kH:6,sD:6,d0:6,sL:20,iTyp:'hex',iSW:4,iT:3,schaftende:'halbhohl',d_b:3,t_b:5,bottomShape:'cone',bottomAngle:120};
 const html=preview(input);assert.match(html,/data-preview="head-drive" data-start-mm="0" data-end-mm="3"/);assert.match(html,/data-preview="shaft-end-bore" data-start-mm="21" data-end-mm="26"/);
 assert(html.includes('Kegelgrund 120°'));assert(html.includes('Stirnansicht A'));
});

test('all analytical head families and explicit shaft ends produce finite silhouettes',()=>{
 for(const changes of [{kopfTyp:'zylinder'},{kopfTyp:'kugelabschnitt'},{kopfTyp:'linse',kC:1.4,capHeight:1},{kopfTyp:'kegelstumpf',kD:8,kH:2},{kopfTyp:'linsensenk',kD:8,kH:2,capHeight:1},{kopfTyp:'sechskant',kSW:7,kH:4},{kopfTyp:'sechskant_bund',kSW:7,kD:10,kH:4,flangeDiameter:10,flangeHeight:1},{kopfTyp:'kopflos',kD:0,kH:0,schaftende:'spitze',endDiameter:0,endLength:2},{schaftende:'zapfen',endDiameter:2,endLength:2}]){
  const input={...base,...changes},html=preview(input);assert(html.includes('data-preview="outer"'),JSON.stringify(changes));assert(!html.includes('NaN'));assert(!html.includes('Infinity'));
 }
});

test('nut preview uses the actual nut model, including flange and square contour',()=>{
 for(const nutShape of ['hex','square']){
  const input={typ:'mutter',wst:0,d0:10,nutModelVersion:'nut-model-v1',nutShape,mSW:13,mH:8,mLoch:6.8,mFlansch:19,mFlanschH:1.2},analysis=E.auslegen(input),html=P.render({input,analysis,format:x=>x.toFixed(3)});
  assert(analysis.nutGeometry.valid);assert(html.includes(analysis.werte.V.toFixed(3)+' mm³'));assert(html.includes('data-preview="nut-bore" data-start-mm="0" data-end-mm="8"'));assert(html.includes('19.000 × 1.200 mm'));
 }
 const cap={typ:'mutter',wst:0,d0:10,nutModelVersion:'nut-model-v1',nutShape:'cap',mSW:13,mH:15,mLoch:6.8,mM:8},html=preview(cap);assert(!html.includes('data-preview="nut-bore"'));assert(html.includes('nicht für eine vollständige Schnittkontur'));
});

test('preview escapes customer/model strings and states incomplete profile contours',()=>{
 const input={...base,threadFamily:'trilobular',sArea:10,kopfForm:'rund',kopfTyp:'zylinder'},html=P.render({input,analysis:E.auslegen(input),material:'<script>evil()</script>',translate:x=>x});
 assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('Hüllkontur dargestellt'));assert(html.includes('stroke-dasharray="5 3"'));
 const invalid=P.render({input:{},analysis:{fehlt:['missing'],werte:{V:123,masse:2,L0:4}}});assert(!invalid.includes('123 mm³'));assert(invalid.includes('— mm³'));
});

test('browser UMD uses the injected engine and the same render contract',()=>{
 const context={window:{JYK:E}};vm.runInNewContext(fs.readFileSync(require.resolve('../standard-preview.js'),'utf8'),context);const html=context.window.JYStandardPreview.render({input:base,analysis:E.auslegen(base)});assert(html.includes('<svg'));assert(html.includes('Volumen (Rechenergebnis)'));
});

test('SVG drive labels use the dynamic translation catalogue in every language',()=>{
 const I=require('../i18n.js'),input={...base,kopfTyp:'zylinder',kD:10,kH:6,iTyp:'hex',iSW:5,iT:3};
 for(const language of ['it','sl','en','zh']){const html=P.render({input,analysis:E.auslegen(input),translate:key=>I.t(key,language)});assert(!html.includes('Innensechskant SW'));assert(html.includes(I.t('Innensechskant SW 5 mm',language)));}
});

test('staged self-tapping and thermoplastic previews show the cylindrical cold-formed blank',()=>{
 for(const threadFamily of ['self-tapping','thermoplastic']){
  const e={typ:'bolzen',wst:0,d0:4,sD:4,sL:20,kopfForm:'rund',kD:8,kH:3,iTyp:'none',threadFamily,tipLength:4,tipDiameter:0};
  const staged={...e,kopfTyp:'zylinder',schaftende:'voll'},old=E.auslegen(e),current=E.auslegen(staged),reference=E.auslegen({...staged,threadFamily:'metric',tipLength:undefined,tipDiameter:undefined});assert.deepEqual(current.fehlt,[]);close(current.werte.V,old.werte.V);assert.deepEqual(current.werte,reference.werte);assert.deepEqual(current.stufen,reference.stufen);assert.equal(current.geometry.tip,null);
  const g=E.boltGeometry(staged);close(g.shaftVolume,Math.PI*4*4/4*20);assert.equal(g.shaftDiameterAt(20),4);const html=preview(staged);assert(html.includes('Gewindespitze entsteht beim Walzen'));assert(!html.includes('<dt>Spitze</dt>'));
 }
});

test('an explicitly pressed preform tip stays separate from the rolled thread tip',()=>{
 const input={...base,kopfTyp:'zylinder',threadFamily:'self-tapping',schaftende:'spitze',endLength:2,endDiameter:1,tipLength:8,tipDiameter:0},a=E.auslegen(input),g=E.boltGeometry(input);
 assert.deepEqual(a.fehlt,[]);assert.equal(g.tip.length,2);assert.equal(g.tip.diameter,1);assert(g.shaftVolume<Math.PI*4*4/4*12);assert(a.stufen.some(s=>s.v==='Schaftendspitze formen'));assert.equal(a.secondaryOperations[0].code,'thread-tip-rolling');
 const incomplete=E.auslegen({...input,endLength:undefined,endDiameter:undefined});assert(incomplete.fehlt.some(x=>/Gepresste Vorformspitze/.test(x)));
});

test('set-screw ends cannot silently become flat solid cylinders',()=>{
 const data={version:'test',families:['ISO4026','ISO4027','ISO4028','ISO4029'].map(id=>require('../normen/'+id+'.json')),threads:require('../normen/gewinde.json')};
 for(const f of data.families){let doc=R.resolveStandard(data,{id:f.id,groesse:'M6',laenge:20}),a=N.adapt(data,doc);assert.equal(a.schaftende,f.schaftende);assert.equal(a.normRequiresGeometryReview,true);
  if(['spitze','zapfen','kegelstumpf_flach'].includes(f.schaftende)){doc=R.setOverride(doc,'endDiameter',f.schaftende==='spitze'?0:3.8);doc=R.setOverride(doc,'endLength',2);a=N.adapt(data,doc);assert(!a.normRequiresGeometryReview);const g=E.boltGeometry({...a,kopfTyp:'kopflos'});assert(!g.error);assert(g.shaftVolume<Math.PI*a.sD*a.sD/4*a.sL);}
 }
});
