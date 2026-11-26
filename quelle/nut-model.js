(function(root,factory){
  let threads=/*NUT_THREADS_BEGIN*/null/*NUT_THREADS_END*/;
  if(!threads&&typeof module==='object'&&module.exports){try{threads=require('./normen/gewinde.json');}catch(_){/* Missing evidence remains missing. */}}
  const api=factory(threads);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.JYNutModel=api;
})(typeof window==='object'?window:globalThis,function(defaultThreads){
  'use strict';
  const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
  const present=x=>x!==undefined&&x!==null;
  const circle=d=>Math.PI*d*d/4;
  const result=()=>({valid:false,status:'invalid',errors:[],issues:[],volume:null,grossVolume:null,
    outerArea:null,blankArea:null,maxDiameter:null,totalHeight:null,holeDiameter:null,
    assumptions:[],operations:[],thread:null});
  const fail=(r,code,message,status='invalid')=>{r.status=status;r.errors.push(message);r.issues.push({code});return r;};

  // Pure dimensional model. Operations are concepts, not a station or force calculation.
  // outerArea is the unflanged polygon area; blankArea is the largest gross section.
  // A flange replaces the same axial portion of the body; it is never added twice.
  function nutModel(e,options={}){
    const r=result();
    if(!e||typeof e!=='object'||Array.isArray(e))return fail(r,'input-missing','Muttermaße fehlen.');
    const shape=e.nutShape??'hex';
    if(!['hex','square','cap'].includes(shape))return fail(r,'shape-invalid','Mutterform eindeutig auswählen.');
    for(const key of ['mSW','mH','mLoch','mFlansch','mFlanschH','mM','threadPitch']){
      if(present(e[key])&&(typeof e[key]!=='number'||!Number.isFinite(e[key])||e[key]<0))return fail(r,'number-invalid','Ungültiger Zahlenwert: '+key);
    }
    if(present(e.threadPitch)&&e.threadPitch===0)return fail(r,'thread-pitch-invalid','Gewindesteigung muss positiv sein.');
    if(!positive(e.mSW)||!positive(e.mH))return fail(r,'body-missing','Schlüsselweite und Höhe der Mutter vollständig angeben.','partial');
    r.totalHeight=e.mH;
    if(shape==='cap'){
      r.operations=['Geschlossenen Napf formen','Hutkontur und Restboden prüfen','Innengewinde nacharbeiten'];
      return fail(r,'cap-geometry-unresolved','Hutmutter: Hutkontur, Sacklochtiefe und Restboden im Formteilmodell ergänzen.','partial');
    }
    const flange=positive(e.mFlansch)?e.mFlansch:0,c=positive(e.mFlanschH)?e.mFlanschH:0;
    if(Boolean(flange)!==Boolean(c))return fail(r,'flange-incomplete','Bunddurchmesser und Bundhöhe vollständig angeben.','partial');
    if(c>=e.mH)return fail(r,'flange-height-invalid','Bundhöhe muss kleiner als die Gesamthöhe der Mutter sein.');

    const threads=Object.hasOwn(options||{},'threads')?options.threads:defaultThreads;
    const size=positive(e.mM)?threads?.rows?.['M'+e.mM]:null;
    const pitch=positive(e.threadPitch)?e.threadPitch:size?.coarse;
    const t=positive(pitch)?size?.pitches?.[String(pitch)]:null;
    const limitsKnown=positive(t?.D1min)&&positive(t?.D1max)&&t.D1max>=t.D1min;
    if(limitsKnown)r.thread={diameter:e.mM,pitch,D1min:t.D1min,D1max:t.D1max,sourceRefs:Array.isArray(t.sourceRefs)?t.sourceRefs.slice():[],status:t.status||'source-status-unspecified'};
    let hole=positive(e.mLoch)?e.mLoch:null;
    if(hole===null){
      if(!limitsKnown)return fail(r,'thread-hole-unresolved','Lochdurchmesser oder belegte 6H-Gewindemaße für Größe und Steigung ergänzen.','partial');
      hole=Math.round((t.D1min+t.D1max)*50)/100;
      // Do not let rounding leave a very narrow supplied tolerance interval.
      hole=Math.max(t.D1min,Math.min(t.D1max,hole));
      r.assumptions.push('Lochdurchmesser: Mittelwert der belegten 6H-Kerndurchmessergrenzen als vorläufiger Rohling für spanendes Gewinden; kein Gewindeformloch.');
      r.issues.push({code:'hole-midpoint-assumption',diameter:hole,min:t.D1min,max:t.D1max});
    }else if(limitsKnown&&(hole<t.D1min||hole>t.D1max)){
      r.assumptions.push('Angegebener Lochdurchmesser liegt außerhalb der belegten 6H-Kerndurchmessergrenzen; Gewindeverfahren und Fertigmaß prüfen.');
      r.issues.push({code:'hole-outside-thread-tolerance',diameter:hole,min:t.D1min,max:t.D1max});
    }else if(!limitsKnown&&positive(e.mM)){
      r.issues.push({code:'thread-limits-unresolved'});
      r.assumptions.push('Angegebener Lochdurchmesser übernommen; der Abgleich mit 6H für diese Größe und Steigung bleibt offen.');
    }
    if(hole>=e.mSW)return fail(r,'body-wall-invalid','Lochdurchmesser muss kleiner als die Schlüsselweite sein.');
    if(flange&&hole>=flange)return fail(r,'flange-wall-invalid','Lochdurchmesser muss kleiner als der Bunddurchmesser sein.');
    const bodyArea=(shape==='square'?1:Math.sqrt(3)/2)*e.mSW*e.mSW;
    const bodyDiameter=e.mSW*(shape==='square'?Math.SQRT2:2/Math.sqrt(3));
    const flangeArea=flange?circle(flange):0;
    const gross=bodyArea*(e.mH-c)+flangeArea*c;
    const volume=gross-circle(hole)*e.mH;
    const blankArea=Math.max(bodyArea,flangeArea),diameter=Math.max(bodyDiameter,flange);
    if(![bodyArea,blankArea,diameter,gross,volume].every(positive))return fail(r,'numeric-range-invalid','Geometrie außerhalb des numerischen Rechenbereichs; Maße und Einheiten prüfen.');
    Object.assign(r,{valid:true,status:'ready',volume,grossVolume:gross,outerArea:bodyArea,blankArea,maxDiameter:diameter,holeDiameter:hole});
    r.assumptions.push('Außenkontur als ideales Polygon und Bohrung als Zylinder; Fasen, Radien und Gewindegänge sind im Volumen nicht aufgelöst.');
    r.issues.push({code:'ideal-envelope-assumption'});
    r.operations=['Planstauchen','Vorstauchen rund',shape==='square'?'Vierkant formen':'Sechskant formen','Beidseitig vorlochen','Napf vertiefen bis Butzen'];
    if(shape==='square'){
      r.assumptions.push('Vierkant: Eckfüllung, Radien und Werkzeugteilung im Stadienkonzept prüfen.');
      r.issues.push({code:'square-corner-fill-review'});
    }
    if(flange){
      r.operations.push('Bund fertigformen');
      r.assumptions.push('Bund als zylindrische Ersatzkontur mit eingegebener Höhe; c_min aus der Norm ist eine Mindestdicke am Messkreis und legt diese Vollkontur nicht fest.');
      r.issues.push({code:'flange-cylinder-assumption',height:c,diameter:flange});
      if(flange<bodyDiameter)r.issues.push({code:'flange-smaller-than-corners',flangeDiameter:flange,bodyCornerDiameter:bodyDiameter});
    }
    r.operations.push('Butzen auslochen','Innengewinde nacharbeiten');
    return r;
  }
  return Object.freeze({nutModel});
});
