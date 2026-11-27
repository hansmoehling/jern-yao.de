(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.JYNormLibrary=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const number=x=>Number(String(x).replace(',','.'));
  const round=(x,p=3)=>Math.round(x*10**p)/10**p;
  const SHAFT_POLICY_VERSION='shaft-v2';
  const positive=x=>Number.isFinite(x)&&x>0;
  function partialThreadBlank(out,document,row,lengthRow){
    const model=row?.shaftModelV2;if(!model)return false;
    // New observations never change legacy snapshots. Only a verified value
    // in the selected length interval may define the new reference blank.
    const override=document.overrides,group=model.threadLengths?.find(g=>out.sL>g.minExclusive&&(g.maxInclusive==null||out.sL<=g.maxInclusive));
    delete out.b;delete out.ds;delete out.shaftType;
    const ds=override.ds?.value??(model.ds?.verification===true?model.ds.value:null);
    const mode=lengthRow?.fields?.threadMode;
    const observedFullLength=mode?.nominal==='full'&&Array.isArray(mode.sourceRefs)&&mode.sourceRefs.length>0&&
      (mode.verification===true||mode.status==='single-source'&&['standard-matrix','historical-standard-matrix'].includes(lengthRow?.lengthEvidence?.kind));
    // A short flange bolt can be fully threaded even when l exceeds the general
    // reference b. An observed length cell takes precedence over that formula;
    // its source status is retained and customer b/segments still take priority.
    const referenceB=override.b?.value??(observedFullLength?out.sL:(group?.verification===true?group.value:null));
    if(positive(ds))out.ds=ds;
    if(positive(referenceB))out.b=referenceB;
    const flange=model.flange;
    if(flange){
      if(!override.flangeDiameter&&flange.diameter?.verification===true)out.flangeDiameter=flange.diameter.value;
      if(!override.flangeHeight&&flange.height?.verification===true){
        out.flangeHeight=flange.height.value;
        out.flangeModelAssumption={origin:'assumption',provisional:true,rule:'R-FLANGE-ENVELOPE-01',model:'hex-prism-and-flange-cylinder',heightBasis:'published-minimum-c',height:flange.height.value,sourceRefs:clone(flange.height.sourceRefs)};
      }
      if(positive(out.flangeDiameter)&&positive(out.flangeHeight))out.normMissingFields=out.normMissingFields.filter(k=>k!=='flangeHeight');
    }
    if(!positive(out.sL)||!positive(ds)||!positive(referenceB)||!positive(out.sD)||referenceB>out.sL&&override.b){
      out.normMissingFields.push(positive(out.sL)?'shaftLengthDistribution':'length');
      out.shaftModelStatus=positive(out.sL)?'thread-length-unresolved':'length-missing';return true;
    }
    const threadedLength=Math.min(referenceB,out.sL),plainLength=out.sL-threadedLength;
    out.b=threadedLength;out.shaftType=plainLength>0?'partial':'full';
    if(plainLength>0)out.shaftSegments=[{diameter:ds,length:plainLength},{diameter:out.sD,length:threadedLength}];
    out.shaftModelStatus='ready';
    out.shaftModelAssumption={origin:'assumption',provisional:true,rule:'R-SHAFT-PARTIAL-01',model:'nominal-blank-segmentation',plainLength,threadedLength,referenceThreadLength:referenceB,shortLengthApproximation:referenceB>=out.sL,threadRunoutModel:'omitted',sourceRefs:clone(group?.sourceRefs||[]),diameterSourceRefs:clone(model.ds?.sourceRefs||[]),threadLengthOrigin:override.b?'customer':'standard-reference',diameterOrigin:override.ds?'customer':'standard-reference'};
    if(observedFullLength&&!override.b){out.shaftModelAssumption.threadLengthOrigin='standard-length-cell';out.shaftModelAssumption.shortLengthApproximation=false;out.shaftModelAssumption.sourceRefs=clone(mode.sourceRefs);out.shaftModelAssumption.sourceVerification=mode.verification===true;out.shaftModelAssumption.lengthEvidence=clone(lengthRow.lengthEvidence||null);}
    if(lengthRow?.roh?.ls_min!=null)out.shaftModelAssumption.lsMin=lengthRow.roh.ls_min;
    if(lengthRow?.roh?.lg_max!=null)out.shaftModelAssumption.lgMax=lengthRow.roh.lg_max;
    out.normMissingFields=out.normMissingFields.filter(k=>!['shaftLengthDistribution','length'].includes(k));return true;
  }
  function familyKind(f){
    if(f.id==='ISO13918')return 'pin';
    if(f.klasse==='mutter'||f.funktion==='mutter')return 'nut';
    if(/niet/.test(f.funktion||''))return 'rivet';
    if(/stift|bolzen/.test(f.funktion||'')&&!/schwei|steh|gewinde/.test(f.funktion))return 'pin';
    if(f.kopfTyp==='none'||f.kopfTyp==='kopflos'||/gewindestift|stehbolzen/.test(f.funktion||''))return 'headless';
    return 'screw';
  }
  const FUNCTION_DEFINITIONS=Object.freeze({
    screw:{source:'schraube',label:'Schraube',kind:'screw'},rivet:{source:'niet',label:'Niet',kind:'rivet'},pin:{source:'stift',label:'Stift',kind:'pin'},
    'set-screw':{source:'gewindestift',label:'Gewindestift',kind:'headless'},stud:{source:'stehbolzen',label:'Stehbolzen',kind:'headless'},
    'weld-stud':{source:'schweissbolzen',label:'Schweißbolzen',kind:'pin'},free:{source:'frei',label:'frei',kind:'screw'},nut:{source:'mutter',label:'Mutter',kind:'nut'}
  });
  function familyFunction(f){const source=String(f?.funktion||'').toLowerCase().replace(/ß/g,'ss');return Object.keys(FUNCTION_DEFINITIONS).find(key=>FUNCTION_DEFINITIONS[key].source===source)||'free';}
  function functionKind(key){return FUNCTION_DEFINITIONS[key]?.kind||'screw';}
  function functionLabel(key,tr=x=>x){return tr(FUNCTION_DEFINITIONS[key]?.label||'frei');}
  function functionChoices(){return Object.keys(FUNCTION_DEFINITIONS).map(key=>[key,FUNCTION_DEFINITIONS[key].label]);}
  function functionFamilies(data,kind){return kind==='free'?[]:data.families.filter(f=>familyFunction(f)===kind&&f.datasetKind!=='rivet-size-series'&&f.datasetKind!=='invalid-reference');}
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
  const FIELD_LABELS={nutHoleTolerance:'Bohrungs-Ø eingeben – Gewindetoleranzmodell fehlt',length:'Länge',lengthBeforeWelding:'Bauteillänge vor dem Schweißen',weldingTipProfile:'Schweiß- / Zündspitzenkontur',headProfileDefinition:'Kopfkontur',tubeProfile:'Rohrkontur',boreDepth:'Bohrtiefe',boreBottomShape:'Bohrungsgrund',shaftLengthDistribution:'Längenaufteilung des Schafts',endDiameter:'Enddurchmesser',endLength:'Länge des Schaftendes',shaftEndProfile:'Kontur am Schaftende',unsupportedDriveContour:'Normantrieb noch ohne unterstützte Kontur',rollingBlankDiameter:'Durchmesser des Walzrohlings',headToShaftLength:'Schaftlänge unter dem Senkkopf',sArea:'Rohling-Querschnittsfläche',recessVolumeModel:'Volumen des Innenantriebs',formingLeadProfile:'Kontur des gewindeformenden Anfangs',nominalLength:'Nennlänge mit eindeutigem Längenbezug',nutEndThreadLength:'Gewindelänge am Mutterende',threadRunout:'Gewindeauslauf',endGeometry:'Endgeometrie',shortStudException:'Längenverteilung des kurzen Stehbolzens',
    blindHoleDepth:'Sacklochtiefe',capProfile:'Kuppenkontur',capWallThickness:'Kappenwanddicke',expandedDiameterAtSelectedLength:'Kerb-Aufweitungsdurchmesser für Länge und Werkstoff',flangeHeight:'Bundhöhe',flangeProfile:'Bundkontur',grooveProfile:'Kerbprofil',h_verified:'Bestätigte Gesamthöhe der Sicherungsmutter',headAngle:'Kopfwinkel',headGeometry:'Kopfgeometrie',headHeight:'Kopfhöhe',headProfileRadius:'Kopfwölbungsradius',headTransition:'Übergang Kopf/Schaft',iT:'Innenantriebstiefe',insertOuterProfile:'Außenkontur des Sicherungseinsatzes',insertSeatDepth:'Sitztiefe des Sicherungseinsatzes',insertSeatDiameter:'Sitzdurchmesser des Sicherungseinsatzes',partStandard:'Bauteilnorm',pilotDiameter:'Zentrierbunddurchmesser',pilotHeight:'Zentrierbundhöhe',prevailingTorqueProfile:'Klemmkontur des Sicherungsteils',secondSourceHeadAngle:'Bestätigung des Senkwinkels',selectedEndForm:'Ausführung am Schaftende',selectedForm:'Ausführung',squareNeckTransition:'Übergang am Vierkantansatz',underheadReinforcement:'Verstärkung unter dem Kopf',verifiedBoreDepth:'Bestätigte Bohrtiefe',verifiedHeadHeight:'Bestätigte Kopfhöhe',weldProjectionHeight:'Schweißwarzenhöhe',weldProjectionShape:'Schweißwarzenkontur',
    kopfForm:'Kopfform',kD:'Kopfdurchmesser',kSW:'Kopfschlüsselweite',kH:'Kopfhöhe',kVol:'Kopf-Außenkonturvolumen',sD:'Schaftdurchmesser',sL:'Schaftlänge',iTyp:'Innenantrieb',iSize:'Antriebsgröße',iSW:'Innenantrieb-Schlüsselweite',iVol:'Volumen der Antriebsvertiefung',nutShape:'Mutternform',nutFlange:'Bund',mM:'Gewindenenngröße',mSW:'Mutternschlüsselweite',mH:'Mutternhöhe',mLoch:'Bohrungs-Ø',mFlansch:'Bunddurchmesser',mFlanschH:'Bundhöhe',d_b:'Bohrungs-Ø',t_b:'Bohrtiefe',schaftende:'Ausführung am Schaftende',bottomShape:'Bohrungsgrund',bottomAngle:'Grundwinkel in Grad',boreDepthMode:'Bezug der Bohrtiefe',kC:'Bundhöhe',capHeight:'Kuppenhöhe',flangeDiameter:'Bunddurchmesser',threadFamily:'Gewindefamilie',tipLength:'Spitzenlänge am Fertigteil',tipDiameter:'End-Ø nach Gewindewalzen',tipAngle:'Spitzenwinkel',tipArea:'Spitzenquerschnitt nach Gewindewalzen',shaftSegments:'Schaftsegmente',ds:'Glatter Schaftdurchmesser',b:'Gewindelänge'};
  function missingLabel(key,tr=x=>x){return tr(FIELD_LABELS[key]||'Weiteres Geometriemaß');}
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
  function internalNutThread(data,row,pitch){
    const rule=data.threads?.internalMinorDiameterRule,d=number(row?.roh?.d_nom),P=number(pitch??row?.roh?.P),TD1=data.threads?.TD1Grade6?.[String(P)];
    // Only the documented metric d/P pair is extended. No external-thread
    // diameters or rolling blank are inferred from the internal 6H model.
    if(rule?.version!=='internal-6h-v1'||!row?.thread?.sourceRefs?.length||row.thread.diameter!==d||row.thread.pitch!==P||!positive(d)||!positive(P)||!positive(TD1)||!rule.sourceRefs.every(ref=>data.threads.sourceMeta?.[ref]))return null;
    const D1min=round(d-1.082532*P,3),D1max=round(D1min+TD1,3);if(!positive(D1min)||D1max>=d)return null;
    return {d,P,D1min,D1max,nutHole:round((D1min+D1max)/2,2),internalOnly:true,internalTolerance:'6H',internalSourceRefs:clone(rule.sourceRefs),internalStatus:'primary-formula-derived',internalDerivation:rule.derivation,nutHoleAssumption:data.threads.modelAssumptions?.nutHole};
  }
  function reference(document,tr=x=>x){
    const r=document?.standardReference;if(!r)return '';
    return [r.id+(r.edition?':'+editionLabel(r.edition,tr):''),r.form?tr('Form')+' '+r.form:'',r.groesse,r.steigung!=null?'P'+r.steigung:'',r.laenge!=null?'× '+r.laenge:'',r.festigkeitsklasse||''].filter(Boolean).join(' ');
  }
  const HEADS={zylinder:'rund',sechskant:'sechskant',sechskant_bund:'sechskant_bund',kugelabschnitt:'kugelabschnitt',linse:'linse',linsensenk:'linsensenk',kegelstumpf:'kegelstumpf',flachrund:'kugelabschnitt',none:'none',kopflos:'none'};
  function rivetHead(out,document,f,row){
    if(row?.headGeometry&&!document.overrides.kopfForm)out.headModelAssumption={origin:'assumption',...clone(row.headGeometry)};
    const raised=f.geometryAdapter==='rivet-raised-countersunk';
    if(!raised&&f.geometryAdapter!=='rivet-countersunk-length')return;
    // Table k is the total head height in DIN662, but only the cone in DIN302.
    // Customer kH edits already use the calculator's cone-height convention.
    const base=document.normBaseline.values,referenceCone=f.headHeightReference==='total'?base.kH-base.capHeight:base.kH;
    if(raised&&out.kopfForm==='linsensenk'&&!document.overrides.kH&&positive(referenceCone))out.kH=round(referenceCone,8);
    const includesHead=['includes-head','includes-cone-excludes-crown'].includes(f.lengthReference?.kind);
    if(includesHead&&!document.overrides.sL){
      const nominal=number(document.standardReference.laenge),cone=out.kH;
      if(positive(nominal)&&positive(cone)&&nominal>cone){out.sL=round(nominal-cone,8);out.normMissingFields=out.normMissingFields.filter(k=>!['length','headToShaftLength'].includes(k));}
      else{out.sL=null;out.clearFields=[...new Set([...(out.clearFields||[]),'sL'])];out.normMissingFields.push('headToShaftLength');}
    }
    out.rivetGeometryReference={adapter:f.geometryAdapter,length:clone(f.lengthReference),headHeightReference:f.headHeightReference||'cone',nominalLength:document.standardReference.laenge??null,referenceConeHeight:positive(referenceCone)?round(referenceCone,8):null,headHeightOrigin:document.overrides.kH?'customer':'derived-from-standard',shaftLengthOrigin:document.overrides.sL?'customer':includesHead?'derived-from-standard':'standard',...(row?.headGeometry?{head:clone(row.headGeometry)}:{})};
  }
  function screwHead(out,document,f,row){
    const override=document.overrides,model=row?.headGeometry;
    if(!model||override.kopfForm)return;
    out.headModelAssumption={origin:'assumption',...clone(model)};
    if(f.geometryAdapter==='pan-head-radius'&&out.kopfForm==='linse'&&!override.capHeight){
      const radius=model.radius,half=out.kD/2;
      if(positive(radius)&&positive(half)&&radius>=half){
        const crown=radius-Math.sqrt(radius*radius-half*half);
        if(crown<=out.kH){out.capHeight=crown;if(!override.kC)out.kC=out.kH-crown;out.headModelAssumption.capHeight=crown;out.headModelAssumption.calculation='r_f−sqrt(r_f²−(kD/2)²)';}
        else out.normMissingFields.push('headProfileDefinition');
      }else out.normMissingFields.push('headProfileDefinition');
    }
    if(f.geometryAdapter==='raised-countersunk-nominal-length'&&out.kopfForm==='linsensenk'){
      const nominal=number(document.standardReference.laenge);
      if(!override.sL){
        if(positive(nominal)&&positive(out.kH)&&nominal>out.kH){out.sL=round(nominal-out.kH,8);out.normMissingFields=out.normMissingFields.filter(k=>!['length','headToShaftLength'].includes(k));}
        else{out.sL=null;out.clearFields=[...new Set([...(out.clearFields||[]),'sL'])];out.normMissingFields.push('headToShaftLength');}
      }
      out.headModelAssumption.lengthReference={...clone(f.lengthReference),nominalLength:document.standardReference.laenge??null,shaftLengthOrigin:override.sL?'customer':'derived-from-standard',headHeightOrigin:override.kH?'customer':'standard'};
    }
  }
  function adapt(data,document){
    const r=document.standardReference,f=variantFamily(data.families.find(x=>x.id===r.id),r.form),row=f?.groessen?.[r.groesse],v=clone(document.effective),definition=document.normBaseline.definition;
    const lengthKey=document.overrides.sL?String(v.sL):String(r.laenge),lengthRow=row?.nachLaenge?.[lengthKey];
    const kind=familyKind(f||{}),t=['rivet','pin'].includes(kind)?null:thread(data,r.groesse,r.steigung??row?.roh?.P??row?.vorbelegung?.P);
    const head=HEADS[definition.kopfTyp]||definition.kopfTyp;
    const out={...v,standardKind:kind==='nut'?undefined:kind,partFunction:familyFunction(f),standardReference:reference(document),standardDocument:clone(document),threadModel:t,propertyClass:r.festigkeitsklasse};
    const shaftV2=document.shaftPolicy===SHAFT_POLICY_VERSION;
    const geometricLengthRow=shaftV2||lengthRow?.shaftPolicy!==SHAFT_POLICY_VERSION?lengthRow:null;
    if(!geometricLengthRow&&lengthRow&&!document.overrides.b)delete out.b;
    if(shaftV2)out.shaftPolicy=SHAFT_POLICY_VERSION;
    out.normGeometryStatus=geometricLengthRow?.geometryStatus||row?.geometryStatus||f?.geometryStatus||'partial';
    out.normMissingFields=clone(geometricLengthRow?.missingGeometryFields||row?.missingGeometryFields||f?.missingGeometryFields||[]);
    if(f?.variantId){
      out.standardVariant=f.variantId;
      // Welding-table lengths and post-weld collars are not a bolt shaft.
      // Tubular rivets likewise require their real tube/head contour.
      out.normRequiresGeometryReview=out.normMissingFields.some(key=>['weldingTipProfile','lengthBeforeWelding','headProfileDefinition','tubeProfile','boreDepth'].includes(key));
    }
    delete out.shaftSegments;delete out.shaftModelAssumption;
    if(shaftV2)delete out.flangeModelAssumption;
    if(kind==='nut'){
      const nutThread=t||(shaftV2?internalNutThread(data,row,r.steigung):null);out.threadModel=nutThread;
      out.mM??=number(r.groesse.replace(/^M/,'').split('x')[0]);
      out.nutShape=document.overrides.nutShape?.value??(/vierkant|square/.test(f?.kopfTyp||f?.form||'')?'square':f?.id==='DIN1587'?'cap':'hex');
      out.mFlansch??=v.dc;out.mFlanschH??=v.c;
      if(nutThread?.nutHole!=null&&!document.overrides.mLoch)out.mLoch=nutThread.nutHole;
      if(shaftV2){
        out.normMissingFields=out.normMissingFields.filter(key=>key!=='nutHoleTolerance');
        if(nutThread?.nutHole==null&&!document.overrides.mLoch){
          out.mLoch=null;out.clearFields=[...new Set([...(out.clearFields||[]),'mLoch'])];
          out.normMissingFields.push('nutHoleTolerance');
        }else if(document.overrides.mLoch&&!positive(out.mLoch))out.normMissingFields.push('nutHoleTolerance');
      }
      out.nutFlange=document.overrides.nutFlange?.value??(f?.kopfTyp==='sechskant_bund'||positive(document.normBaseline.values.mFlansch??document.normBaseline.values.dc)||positive(document.overrides.mFlansch?.value));
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
        if(!document.overrides.sL){if(shaftV2){out.sL=null;out.clearFields=['sL'];}else delete out.sL;}
        if(lengthField&&r.laenge!=null)out[lengthField]??=number(r.laenge);
        if(lengthField&&!document.overrides.sL)out.normMissingFields.push('headToShaftLength');
        if(shoulder||stud)out.normMissingFields.push('shaftLengthDistribution');
      }else if(shaftV2&&f?.id!=='ISO13918'){
        const length=document.overrides.sL?.value??(r.laenge!=null?number(r.laenge):null);
        out.sL=positive(length)?length:null;
        if(out.sL===null){out.clearFields=['sL'];out.normMissingFields.push('length');}
      }else if(r.laenge!=null&&f?.id!=='ISO13918')out.sL??=number(r.laenge);
      // A countersunk screw is designated by total length. The blank's shaft
      // starts below the head; apply the explicitly sourced reference once.
      // Customer shaft edits and legacy saved documents keep their own values.
      if(shaftV2&&kind==='screw'&&f?.lengthReference?.kind==='includes-head'&&f.lengthReference.policy===SHAFT_POLICY_VERSION&&!document.overrides.sL){
        const nominal=number(r.laenge),headHeight=out.kH;
        out.nominalLength=positive(nominal)?nominal:null;
        out.shaftLengthReference={kind:'includes-head',nominalLength:out.nominalLength,headHeight,origin:'derived-from-standard',sourceRefs:clone(f.lengthReference.sourceRefs||[])};
        if(positive(nominal)&&positive(headHeight)&&nominal>headHeight){out.sL=round(nominal-headHeight,8);out.normMissingFields=out.normMissingFields.filter(k=>!['length','headToShaftLength'].includes(k));}
        else{out.sL=null;out.clearFields=[...new Set([...(out.clearFields||[]),'sL'])];out.normMissingFields.push('headToShaftLength');}
      }
      if(kind==='rivet'||kind==='pin')out.threadFamily='none';
      else out.threadFamily=document.overrides.threadFamily?.value??f?.threadFamily??'metric';
      if(['self-tapping','thermoplastic','duo-taptite','trilobular'].includes(out.threadFamily)&&!document.overrides.schaftende&&['spitze','kegelstumpf_flach'].includes(out.schaftende)){
        out.finishedThreadEnd=out.schaftende;out.schaftende='voll';
      }
      if(!['rivet','pin'].includes(kind)&&!shoulder&&!stud&&out.threadFamily==='metric'&&t?.rollBlank!=null){
        if(!document.overrides.sD)out.sD=t.rollBlank;
        // A reference b alone does not establish a plain shaft. The length row
        // must explicitly identify the threaded and unthreaded portions.
        const partialHandled=shaftV2&&partialThreadBlank(out,document,row,lengthRow);
        let plain=partialHandled?null:geometricLengthRow?.plainLength??geometricLengthRow?.roh?.ls_nom;
        if(!partialHandled&&plain==null&&geometricLengthRow?.roh?.ls_min!=null&&geometricLengthRow?.roh?.lg_max!=null&&geometricLengthRow.roh.lg_max>=geometricLengthRow.roh.ls_min){
          plain=(geometricLengthRow.roh.ls_min+geometricLengthRow.roh.lg_max)/2;
          out.shaftModelAssumption={origin:'assumption',provisional:true,plainLength:plain,min:geometricLengthRow.roh.ls_min,max:geometricLengthRow.roh.lg_max};
        }
        if(plain>0&&out.sL>plain)out.shaftSegments=[{diameter:t.d,length:plain},{diameter:out.sD,length:out.sL-plain}];
        if(!partialHandled&&document.overrides.sL&&!lengthRow&&Object.values(row?.nachLaenge||{}).some(x=>x.plainLength>0||x.roh?.ls_nom>0||x.roh?.ls_min>0)){
          out.normMissingFields.push('shaftLengthDistribution');out.normRequiresGeometryReview=true;
        }
      }
      if(shoulder||stud||['trilobular','duo-taptite'].includes(out.threadFamily)||out.normMissingFields.includes('rollingBlankDiameter')){
        if(!document.overrides.sD)delete out.sD;
        if(['trilobular','duo-taptite'].includes(out.threadFamily)&&!document.overrides.sD)out.normMissingFields.push('rollingBlankDiameter');
      }
      if(out.kopfForm==='none')out.kD=out.kH=out.kSW=0;
      for(const key of ['iSize','schaftende','bottomShape','bottomAngle','boreDepthMode','capHeight','flangeDiameter','flangeHeight','endLength','endDiameter','tipAngle','tipLength','tipDiameter'])if(document.overrides[key])out[key]=document.overrides[key].value;
      if(kind==='rivet')rivetHead(out,document,f,row);
      if(kind==='screw')screwHead(out,document,f,row);
      if(out.schaftende==='halbhohl'){
        const bottomValid=['flat','round'].includes(out.bottomShape)||out.bottomShape==='cone'&&out.bottomAngle>0&&out.bottomAngle<180;
        if(bottomValid){
          out.normMissingFields=out.normMissingFields.filter(key=>key!=='boreBottomShape');
          out.geometryOrigins={bottomShape:{origin:document.overrides.bottomShape?'customer':'assumption',value:out.bottomShape},...(out.bottomShape==='cone'?{bottomAngle:{origin:document.overrides.bottomAngle?'customer':'assumption',value:out.bottomAngle}}:{})};
          if(out.bottomShape==='cone'&&(!document.overrides.bottomShape||!document.overrides.bottomAngle))out.boreBottomAssumption={origin:'assumption',shape:'cone',angle:out.bottomAngle,angleOrigin:document.overrides.bottomAngle?'customer':'assumption'};
        }
      }
      if(['rivet','pin'].includes(kind)){out.iTyp='none';out.normMissingFields=out.normMissingFields.filter(key=>key!=='unsupportedDriveContour');}
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
    if(shaftV2&&f?.id==='ISO13918'&&row?.lengthDefinition){
      const def=row.lengthDefinition,selected=number(r.laenge),ref=def.reference;
      // l1 and l2 have different physical reference surfaces. Never retain a
      // previous variant's length, or treat either one as a plain bolt shank.
      for(const key of ['l1','l2','sL'])if(!document.overrides[key]){delete out[key];out.clearFields=[...new Set([...(out.clearFields||[]),key])];}
      if(positive(selected)){
        out[ref]=document.overrides[ref]?.value??selected;
        const conversion=def.toBeforeWelding;
        if(ref==='l2'&&conversion&&(!conversion.appliesTo||conversion.appliesTo==='minimum-only'&&selected===def.min)&&!document.overrides.l1)out.l1=round(selected+conversion.value,8);
      }
      const outside=positive(selected)&&(def.min!=null&&selected<def.min||def.max!=null&&selected>def.max);
      out.weldingLength={definition:clone(def),selected:positive(selected)?selected:null,selectionStatus:!positive(selected)?'missing':def.kind==='matrix'?(lengthRow?'listed':'by-agreement'):outside?'by-agreement':'within-reference',...(positive(out.l1)?{beforeWelding:out.l1}:{}),...(def.toBeforeWelding?.faceAngle&&ref==='l2'&&positive(out.l1)&&!document.overrides.l1?{angleAssumption:{origin:'assumption',value:def.toBeforeWelding.faceAngle,unit:'deg'}}:{})};
      if(positive(out.l1))out.normMissingFields=out.normMissingFields.filter(key=>key!=='lengthBeforeWelding');else if(!out.normMissingFields.includes('lengthBeforeWelding'))out.normMissingFields.push('lengthBeforeWelding');
    }
    // A documented variant can deliberately leave dimensions unresolved.
    // Do not carry automatic dimensions of the previous norm into that gap;
    // explicit customer edits still have priority and remain editable.
    for(const field of f?.clearAutomaticFields||[])if(!document.overrides[field]){
      delete out[field];out.clearFields=[...new Set([...(out.clearFields||[]),field])];
    }
    if(document.overrides.shaftSegments){
      const parts=document.overrides.shaftSegments.value;
      if(Array.isArray(parts)&&parts.length&&parts.every(s=>Number.isFinite(s.diameter)&&s.diameter>0&&Number.isFinite(s.length)&&s.length>0)&&Math.abs(parts.reduce((n,s)=>n+s.length,0)-out.sL)<1e-7){out.shaftSegments=clone(parts);out.normMissingFields=out.normMissingFields.filter(key=>key!=='shaftLengthDistribution');if(shaftV2){out.shaftModelStatus='customer';out.shaftModelAssumption={origin:'customer',model:'explicit-shaft-segments'};delete out.shaftType;delete out.b;delete out.ds;}}
      else{delete out.shaftSegments;out.normMissingFields.push('shaftLengthDistribution');out.normRequiresGeometryReview=true;}
    }
    for(const [field,missing]of [['sD','rollingBlankDiameter'],['sL','headToShaftLength'],['sArea','sArea']])if(document.overrides[field]?.value>0)out.normMissingFields=out.normMissingFields.filter(key=>key!==missing);
    out.normMissingFields=[...new Set(out.normMissingFields)];
    out.normRequiresGeometryReview=out.normMissingFields.some(key=>['weldingTipProfile','lengthBeforeWelding','headProfileDefinition','tubeProfile','boreDepth','shaftLengthDistribution','endDiameter','endLength','shaftEndProfile','unsupportedDriveContour','rollingBlankDiameter','headToShaftLength','sArea',...(shaftV2?['length','nutHoleTolerance']:[])].includes(key));
    return out;
  }
  return Object.freeze({SHAFT_POLICY_VERSION,familyKind,families,familyFunction,functionKind,functionLabel,functionChoices,functionFamilies,variants,variantFamily,selectionLibrary,editionLabel,familyLabel,missingLabel,sizes,lengths,thread,pitches,reference,adapt});
});
