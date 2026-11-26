(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYNormLibrary=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const number=x=>Number(String(x).replace(',','.'));
  const round=(x,p=3)=>Math.round(x*10**p)/10**p;
  function familyKind(f){
    if(f.klasse==='mutter'||f.funktion==='mutter')return 'nut';
    if(/niet/.test(f.funktion||''))return 'rivet';
    if(/stift|bolzen/.test(f.funktion||'')&&!/schwei|steh|gewinde/.test(f.funktion))return 'pin';
    if(f.kopfTyp==='none'||f.kopfTyp==='kopflos'||/gewindestift|stehbolzen/.test(f.funktion||''))return 'headless';
    return 'screw';
  }
  function families(data,kind){return data.families.filter(f=>familyKind(f)===kind&&f.datasetKind!=='rivet-size-series'&&f.datasetKind!=='invalid-reference');}
  function sizes(f){return Object.keys(f?.groessen||{}).sort((a,b)=>number(a.replace(/^M/,'').split('x')[0])-number(b.replace(/^M/,'').split('x')[0]));}
  function lengths(f,size){return Object.keys(f?.groessen?.[size]?.nachLaenge||{}).filter(x=>Number.isFinite(number(x))).sort((a,b)=>number(a)-number(b));}
  function thread(data,diameter,pitch){
    const parts=String(diameter).replace(/^M/,'').split('x'),d=number(parts[0]),key='M'+d;
    const row=data.threads?.rows?.[key];if(!row)return null;
    const P=pitch==null?(parts[1]?number(parts[1]):row.coarse):number(pitch),r=row.pitches?.[String(P)];
    if(!r)return null;
    return clone({...r,d,P,rollBlank:r.d2min!=null&&r.d2max!=null?round((r.d2min+r.d2max)/2,2):null,nutHole:r.D1min!=null&&r.D1max!=null?round((r.D1min+r.D1max)/2,2):null});
  }
  function pitches(data,size){const [base,fixed]=String(size).split('x');if(fixed)return [number(fixed)];const row=data.threads?.rows?.[base];return row?Object.keys(row.pitches).map(number).sort((a,b)=>b-a):[];}
  function reference(document){
    const r=document?.standardReference;if(!r)return '';
    return [r.id+(r.edition?':'+r.edition:''),r.groesse,r.steigung!=null?'P'+r.steigung:'',r.laenge!=null?'× '+r.laenge:'',r.festigkeitsklasse||''].filter(Boolean).join(' ');
  }
  const HEADS={zylinder:'rund',sechskant:'sechskant',sechskant_bund:'sechskant_bund',kugelabschnitt:'kugelabschnitt',linse:'linse',linsensenk:'linsensenk',kegelstumpf:'kegelstumpf',flachrund:'kugelabschnitt',none:'none',kopflos:'none'};
  function adapt(data,document){
    const r=document.standardReference,f=data.families.find(x=>x.id===r.id),row=f?.groessen?.[r.groesse],lengthRow=row?.nachLaenge?.[String(r.laenge)],v=clone(document.effective),definition=document.normBaseline.definition;
    const kind=familyKind(f||{}),t=['rivet','pin'].includes(kind)?null:thread(data,r.groesse,r.steigung??row?.roh?.P??row?.vorbelegung?.P);
    const head=HEADS[definition.kopfTyp]||definition.kopfTyp;
    const out={...v,standardKind:kind==='nut'?undefined:kind,standardReference:reference(document),standardDocument:clone(document),threadModel:t,propertyClass:r.festigkeitsklasse};
    if(kind==='nut'){
      out.mM??=number(r.groesse.replace(/^M/,'').split('x')[0]);
      out.nutShape=/vierkant|square/.test(f?.kopfTyp||f?.form||'')?'square':f?.id==='DIN1587'?'cap':'hex';
      out.mFlansch??=v.dc;out.mFlanschH??=v.c;
      if(t?.nutHole!=null&&!document.overrides.mLoch)out.mLoch=t.nutHole;
    }else{
      if(head)out.kopfForm=head;
      out.iTyp=definition.antrieb?.art||'none';
      out.schaftende=typeof definition.schaftende==='string'?definition.schaftende:definition.schaftende?.art||'voll';
      if(!['halbhohl','rohr'].includes(out.schaftende))out.schaftende='voll';
      if(out.schaftende==='halbhohl'){out.bottomShape='cone';out.bottomAngle=120;out.boreDepthMode='total';}
      out.capHeight??=v.f;out.flangeDiameter??=v.dc;out.flangeHeight??=v.c;
      if(['kein','ohne'].includes(out.iTyp))out.iTyp='none';
      if(document.overrides.kopfForm)out.kopfForm=document.overrides.kopfForm.value;
      if(document.overrides.iTyp)out.iTyp=document.overrides.iTyp.value;
      if(r.laenge!=null)out.sL??=number(r.laenge);
      if(kind==='rivet'||kind==='pin')out.threadFamily='none';
      else if(t?.rollBlank!=null&&!document.overrides.sD){
        out.sD=t.rollBlank;
        // A reference b alone does not establish a plain shaft. The length row
        // must explicitly identify the threaded and unthreaded portions.
        let plain=lengthRow?.plainLength??lengthRow?.roh?.ls_nom;
        if(plain==null&&lengthRow?.roh?.ls_min!=null&&lengthRow?.roh?.lg_max!=null&&lengthRow.roh.lg_max>=lengthRow.roh.ls_min){
          plain=(lengthRow.roh.ls_min+lengthRow.roh.lg_max)/2;
          out.shaftModelAssumption={origin:'assumption',provisional:true,plainLength:plain,min:lengthRow.roh.ls_min,max:lengthRow.roh.lg_max};
        }
        if(plain>0&&out.sL>plain)out.shaftSegments=[{diameter:t.d,length:plain},{diameter:t.rollBlank,length:round(out.sL-plain)}];
      }
      if(out.kopfForm==='none')out.kD=out.kH=out.kSW=0;
      for(const key of ['schaftende','bottomShape','bottomAngle','capHeight','flangeDiameter','flangeHeight'])if(document.overrides[key])out[key]=document.overrides[key].value;
    }
    out.normGeometryStatus=lengthRow?.geometryStatus||row?.geometryStatus||f?.geometryStatus||'partial';
    out.normMissingFields=clone(lengthRow?.missingGeometryFields||row?.missingGeometryFields||f?.missingGeometryFields||[]);
    return out;
  }
  return Object.freeze({familyKind,families,sizes,lengths,thread,pitches,reference,adapt});
});
