(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYNormLibrary=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const number=x=>Number(String(x).replace(',','.'));
  const round=(x,p=3)=>Math.round(x*10**p)/10**p;
  function familyKind(f){
    if(f.id==='ISO13918')return 'pin';
    if(f.klasse==='mutter'||f.funktion==='mutter')return 'nut';
    if(/niet/.test(f.funktion||''))return 'rivet';
    if(/stift|bolzen/.test(f.funktion||'')&&!/schwei|steh|gewinde/.test(f.funktion))return 'pin';
    if(f.kopfTyp==='none'||f.kopfTyp==='kopflos'||/gewindestift|stehbolzen/.test(f.funktion||''))return 'headless';
    return 'screw';
  }
  function families(data,kind){return data.families.filter(f=>familyKind(f)===kind&&f.datasetKind!=='rivet-size-series'&&f.datasetKind!=='invalid-reference');}
  function variants(f){return (f?.variants||[]).filter(v=>Object.keys(v.sizeData||{}).length>0);}
  function variantFamily(f,form){
    if(!f||!variants(f).length)return f;
    const v=variants(f).find(v=>v.id===form);if(!v)return {...f,groessen:{},fields:{}};
    return {...f,...v,id:f.id,variantId:v.id,variantLabel:v.label,groessen:v.sizeData,fields:v.fields||{},feldzuordnung:{...f.feldzuordnung,...v.feldzuordnung}};
  }
  function selectionLibrary(data,selection){return {...data,families:data.families.map(f=>f.id===selection.id?variantFamily(f,selection.form):f)};}
  function editionLabel(edition,tr=x=>x){if(!edition)return '';return ['catalog-undated','catalogue-unassigned'].includes(edition)?tr('Ausgabe nicht zugeordnet'):edition;}
  function familyLabel(f,tr=x=>x){return f.id.replace(/^(ISO|DIN|EN)(\d)/,'$1 $2')+(f.edition?' · '+editionLabel(f.edition,tr):'');}
  function missingLabel(key,tr=x=>x){return tr(({length:'Länge',lengthBeforeWelding:'Bauteillänge vor dem Schweißen',weldingTipProfile:'Schweiß- / Zündspitzenkontur',headProfileDefinition:'Kopfkontur',tubeProfile:'Rohrkontur',boreDepth:'Bohrtiefe',boreBottomShape:'Bohrungsgrund',shaftLengthDistribution:'Längenaufteilung des Schafts',endDiameter:'Enddurchmesser',endLength:'Länge des Schaftendes',shaftEndProfile:'Kontur am Schaftende',unsupportedDriveContour:'Normantrieb noch ohne unterstützte Kontur',rollingBlankDiameter:'Durchmesser des Walzrohlings',headToShaftLength:'Schaftlänge unter dem Senkkopf',sArea:'Rohling-Querschnittsfläche',recessVolumeModel:'Volumen des Innenantriebs',formingLeadProfile:'Kontur des gewindeformenden Anfangs',nominalLength:'Nennlänge mit eindeutigem Längenbezug',nutEndThreadLength:'Gewindelänge am Mutterende',threadRunout:'Gewindeauslauf',endGeometry:'Endgeometrie',shortStudException:'Längenverteilung des kurzen Stehbolzens'})[key]||key);}
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
  function reference(document,tr=x=>x){
    const r=document?.standardReference;if(!r)return '';
    return [r.id+(r.edition?':'+editionLabel(r.edition,tr):''),r.form?tr('Form')+' '+r.form:'',r.groesse,r.steigung!=null?'P'+r.steigung:'',r.laenge!=null?'× '+r.laenge:'',r.festigkeitsklasse||''].filter(Boolean).join(' ');
  }
  const HEADS={zylinder:'rund',sechskant:'sechskant',sechskant_bund:'sechskant_bund',kugelabschnitt:'kugelabschnitt',linse:'linse',linsensenk:'linsensenk',kegelstumpf:'kegelstumpf',flachrund:'kugelabschnitt',none:'none',kopflos:'none'};
  function adapt(data,document){
    const r=document.standardReference,f=variantFamily(data.families.find(x=>x.id===r.id),r.form),row=f?.groessen?.[r.groesse],v=clone(document.effective),definition=document.normBaseline.definition;
    const lengthKey=document.overrides.sL?String(v.sL):String(r.laenge),lengthRow=row?.nachLaenge?.[lengthKey];
    const kind=familyKind(f||{}),t=['rivet','pin'].includes(kind)?null:thread(data,r.groesse,r.steigung??row?.roh?.P??row?.vorbelegung?.P);
    const head=HEADS[definition.kopfTyp]||definition.kopfTyp;
    const out={...v,standardKind:kind==='nut'?undefined:kind,standardReference:reference(document),standardDocument:clone(document),threadModel:t,propertyClass:r.festigkeitsklasse};
    out.normGeometryStatus=lengthRow?.geometryStatus||row?.geometryStatus||f?.geometryStatus||'partial';
    out.normMissingFields=clone(lengthRow?.missingGeometryFields||row?.missingGeometryFields||f?.missingGeometryFields||[]);
    if(f?.variantId){
      out.standardVariant=f.variantId;
      // Welding-table lengths and post-weld collars are not a bolt shaft.
      // Tubular rivets likewise require their real tube/head contour.
      out.normRequiresGeometryReview=out.normMissingFields.some(key=>['weldingTipProfile','lengthBeforeWelding','headProfileDefinition','tubeProfile','boreDepth'].includes(key));
    }
    delete out.shaftSegments;delete out.shaftModelAssumption;
    if(kind==='nut'){
      out.mM??=number(r.groesse.replace(/^M/,'').split('x')[0]);
      out.nutShape=document.overrides.nutShape?.value??(/vierkant|square/.test(f?.kopfTyp||f?.form||'')?'square':f?.id==='DIN1587'?'cap':'hex');
      out.mFlansch??=v.dc;out.mFlanschH??=v.c;
      if(t?.nutHole!=null&&!document.overrides.mLoch)out.mLoch=t.nutHole;
      out.nutFlange=document.overrides.nutFlange?.value??(Number(out.mFlansch)>0);
      if(!out.nutFlange)out.mFlansch=out.mFlanschH=0;
    }else{
      if(head)out.kopfForm=head;
      out.iTyp=definition.antrieb?.art||'none';
      out.schaftende=typeof definition.schaftende==='string'?definition.schaftende:definition.schaftende?.art||'voll';
      if(out.schaftende==='halbhohl'){out.bottomShape='cone';out.bottomAngle=120;out.boreDepthMode='total';}
      out.capHeight??=v.f;out.flangeDiameter??=v.dc;out.flangeHeight??=v.c;
      if(['kein','ohne'].includes(out.iTyp))out.iTyp='none';
      if(document.overrides.kopfForm)out.kopfForm=document.overrides.kopfForm.value;
      if(document.overrides.iTyp)out.iTyp=document.overrides.iTyp.value;
      // Unsupported norm drives must not inherit the UI's previous "none"
      // option. Only an explicit customer drive override can replace them.
      const driveMissing=definition.antrieb!=null&&!definition.antrieb?.art&&!document.overrides.iTyp;
      out.normMissingFields=out.normMissingFields.filter(key=>key!=='unsupportedDriveContour');
      if(driveMissing||!['none','hex','torx','ph','pz'].includes(out.iTyp))out.normMissingFields.push('unsupportedDriveContour');
      const shoulder=f?.geometryAdapter==='shoulder-screw-required'||f?.id==='ISO7379',stud=!!f?.feldzuordnung?.metalEndLength;
      const lengthField=f?.feldzuordnung?.totalLength?'totalLength':f?.feldzuordnung?.countersunkLength?'countersunkLength':null;
      if(lengthField||shoulder||stud){
        if(!document.overrides.sL)delete out.sL;
        if(lengthField&&r.laenge!=null)out[lengthField]??=number(r.laenge);
        if(lengthField&&!document.overrides.sL)out.normMissingFields.push('headToShaftLength');
        if(shoulder||stud)out.normMissingFields.push('shaftLengthDistribution');
      }else if(r.laenge!=null&&f?.id!=='ISO13918')out.sL??=number(r.laenge);
      if(kind==='rivet'||kind==='pin')out.threadFamily='none';
      else out.threadFamily=document.overrides.threadFamily?.value??f?.threadFamily??'metric';
      if(['self-tapping','thermoplastic','duo-taptite','trilobular'].includes(out.threadFamily)&&!document.overrides.schaftende&&['spitze','kegelstumpf_flach'].includes(out.schaftende)){
        out.finishedThreadEnd=out.schaftende;out.schaftende='voll';
      }
      if(!['rivet','pin'].includes(kind)&&!shoulder&&!stud&&out.threadFamily==='metric'&&t?.rollBlank!=null){
        if(!document.overrides.sD)out.sD=t.rollBlank;
        // A reference b alone does not establish a plain shaft. The length row
        // must explicitly identify the threaded and unthreaded portions.
        let plain=lengthRow?.plainLength??lengthRow?.roh?.ls_nom;
        if(plain==null&&lengthRow?.roh?.ls_min!=null&&lengthRow?.roh?.lg_max!=null&&lengthRow.roh.lg_max>=lengthRow.roh.ls_min){
          plain=(lengthRow.roh.ls_min+lengthRow.roh.lg_max)/2;
          out.shaftModelAssumption={origin:'assumption',provisional:true,plainLength:plain,min:lengthRow.roh.ls_min,max:lengthRow.roh.lg_max};
        }
        if(plain>0&&out.sL>plain)out.shaftSegments=[{diameter:t.d,length:plain},{diameter:out.sD,length:out.sL-plain}];
        if(document.overrides.sL&&!lengthRow&&Object.values(row?.nachLaenge||{}).some(x=>x.plainLength>0||x.roh?.ls_nom>0||x.roh?.ls_min>0)){
          out.normMissingFields.push('shaftLengthDistribution');out.normRequiresGeometryReview=true;
        }
      }
      if(shoulder||stud||['trilobular','duo-taptite'].includes(out.threadFamily)||out.normMissingFields.includes('rollingBlankDiameter')){
        if(!document.overrides.sD)delete out.sD;
        if(['trilobular','duo-taptite'].includes(out.threadFamily)&&!document.overrides.sD)out.normMissingFields.push('rollingBlankDiameter');
      }
      if(out.kopfForm==='none')out.kD=out.kH=out.kSW=0;
      for(const key of ['iSize','schaftende','bottomShape','bottomAngle','boreDepthMode','capHeight','flangeDiameter','flangeHeight','endLength','endDiameter','tipAngle','tipLength','tipDiameter'])if(document.overrides[key])out[key]=document.overrides[key].value;
      if(document.overrides.schaftende&&!['ringschneide'].includes(out.schaftende))out.normMissingFields=out.normMissingFields.filter(key=>key!=='shaftEndProfile');
      if(document.overrides.schaftende&&['voll','kuppe','halbhohl','rohr'].includes(out.schaftende))out.normMissingFields=out.normMissingFields.filter(key=>!['endLength','endDiameter'].includes(key));
      if(out.schaftende==='kuppe'||out.schaftende==='kegelstumpf_flach'&&kind!=='headless'){
        out.shaftEndAssumption={origin:'assumption',scope:'minor-end-contour',volumeModel:'full-envelope',note:'Kleine Endkuppe oder Gewindeanfangsform im Volumen mit voller Schafthülle gerechnet; keine zusätzliche Umformoperation angesetzt.'};
      }else if(['spitze','kegelstumpf_flach','zapfen'].includes(out.schaftende)){
        const rolled=['self-tapping','thermoplastic','duo-taptite','trilobular'].includes(out.threadFamily),diameter=out.endDiameter??(rolled?undefined:out.tipDiameter),length=out.endLength??(rolled?undefined:out.tipLength),angle=out.tipAngle;
        if(!Number.isFinite(diameter)||diameter<0||out.schaftende!=='spitze'&&diameter===0)out.normMissingFields.push('endDiameter');
        else out.normMissingFields=out.normMissingFields.filter(key=>key!=='endDiameter');
        if(!(length>0)&&!(out.schaftende!=='zapfen'&&angle>0&&angle<180))out.normMissingFields.push('endLength');
        else out.normMissingFields=out.normMissingFields.filter(key=>key!=='endLength');
        if(out.normMissingFields.some(key=>['endDiameter','endLength'].includes(key)))out.normRequiresGeometryReview=true;
      }else if(out.schaftende==='ringschneide'){out.normMissingFields.push('shaftEndProfile');out.normRequiresGeometryReview=true;}
      if(['torx','ph','pz'].includes(out.iTyp)&&/^\d+(?:\.\d+)?$/.test(String(out.iSize)))out.iSize=({torx:'T',ph:'PH',pz:'PZ'})[out.iTyp]+out.iSize;
      if(out.iTyp==='hex'&&document.overrides.iSize&&Number.isFinite(number(out.iSize))&&number(out.iSize)>0)out.iSW=number(out.iSize);
    }
    if(document.overrides.shaftSegments){
      const parts=document.overrides.shaftSegments.value;
      if(Array.isArray(parts)&&parts.length&&parts.every(s=>Number.isFinite(s.diameter)&&s.diameter>0&&Number.isFinite(s.length)&&s.length>0)&&Math.abs(parts.reduce((n,s)=>n+s.length,0)-out.sL)<1e-7){out.shaftSegments=clone(parts);out.normMissingFields=out.normMissingFields.filter(key=>key!=='shaftLengthDistribution');}
      else{delete out.shaftSegments;out.normMissingFields.push('shaftLengthDistribution');out.normRequiresGeometryReview=true;}
    }
    for(const [field,missing]of [['sD','rollingBlankDiameter'],['sL','headToShaftLength'],['sArea','sArea']])if(document.overrides[field]?.value>0)out.normMissingFields=out.normMissingFields.filter(key=>key!==missing);
    out.normMissingFields=[...new Set(out.normMissingFields)];
    out.normRequiresGeometryReview=out.normMissingFields.some(key=>['weldingTipProfile','lengthBeforeWelding','headProfileDefinition','tubeProfile','boreDepth','shaftLengthDistribution','endDiameter','endLength','shaftEndProfile','unsupportedDriveContour','rollingBlankDiameter','headToShaftLength','sArea'].includes(key));
    return out;
  }
  return Object.freeze({familyKind,families,variants,variantFamily,selectionLibrary,editionLabel,familyLabel,missingLabel,sizes,lengths,thread,pitches,reference,adapt});
});
