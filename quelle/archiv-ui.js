(function () {
  'use strict';
  const E = window.JYK;
  const L=window.JYLocale, tr=s=>L.t(s);
  const showPrices = window.JY_SHOW_PRICES !== false;
  const staged = window.JY_CONFIGURATOR_VERSION === 'kvp-v1';
  const MASCHINEN = JSON.parse(document.getElementById('daten').textContent);
  const PRAXIS = JSON.parse(document.getElementById('praxis').textContent);
  const MAIL = 'info@jernyao.de';
  const FAMNAME = { JBF: 'Bolzenpresse', JBP: 'Teilepresse, Langhub', JNP: 'Teilepresse, Kurzhub', JPF: 'Teilepresse für Mutternteile', JNF: 'Mutternpresse', JNFR: 'Mutternpresse, Buchsenabschnitt', JNFP: 'Mutternpresse' };
  const KATURL = 'https://www.jernyao.com/files/';
  const f = document.getElementById('f'), a = document.getElementById('a');
  const $ = id => document.getElementById(id);
  const fmt = (x, d = 1) => (x == null || !isFinite(x)) ? tr('nicht belegt') : x.toLocaleString(window.JYI18N.numberLocale(L.language), { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const rounded=x=>typeof x==='number'&&Number.isFinite(x)?Math.round(x):tr('nicht belegt');
  const eur = x => x ? x.toLocaleString(window.JYI18N.numberLocale(L.language)) + ' €' : tr('auf Anfrage');
  const num = v => { if (v == null) return undefined; const s = String(v).trim().replace(/\s/g, '').replace(',', '.'); if (!s) return undefined; const n = Number(s); return isFinite(n) ? n : NaN; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const h = s => esc(tr(s));
  const msg = (key, values) => tr(key).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  const rendered = (node, html) => { node.dataset.originalText = ''; node.innerHTML = html; };

  // Manual exposes only reviewed material/condition/curve combinations.
  // Catalogue identities without a curve remain available to the drawing assistant.
  const sel = f.elements.wst;
  const variants=E.WERKSTOFFE.flatMap((material,index)=>(material.manualEligible?material.flowCurves||[]:[])
    .filter(curve=>curve.eligible===true&&['literature','proxy'].includes(curve.approval))
    .map(curve=>({value:index+'|'+curve.id,index,material,curve})));
  const variantByValue=new Map(variants.map(variant=>[variant.value,variant]));
  const selectedVariant=()=>variantByValue.get(sel.value)||null;
  const conditionLabel=curve=>tr(curve.state==='soft-annealed'?'weichgeglüht':curve.state==='cold-drawn'?'gezogen':curve.stateLabel||curve.state);
  const modelLabel=curve=>tr(curve.approval==='proxy'?'begründete Ersatzkurve':'Literaturansatz');
  const preparationLabel=value=>tr(value==='inline-drawing'?'Walzdraht mit Inline-Vorzug':'Draht im gewählten Lieferzustand');
  const materialIdentity=variant=>(variant.material.sourceName||variant.material.id)+(variant.material.number?' · '+variant.material.number:'');
  const materialLabel=variant=>materialIdentity(variant)+' · '+conditionLabel(variant.curve);
  const optionLabel=variant=>['soft-annealed','normalized-rolled'].includes(variant.curve.state)?materialIdentity(variant):materialLabel(variant);
  const densityNotice=variant=>variant?.material.densityStatus==='reference-steel-density'?tr('Gewicht mit Stahl-Bezugsdichte 7,85 g/cm³; Näherungswert'):'';
  variants.forEach(variant=>{const option=document.createElement('option');option.value=variant.value;option.dataset.originalText='';option.textContent=optionLabel(variant);sel.appendChild(option);});
  sel.value=variants.find(variant=>variant.material.id==='C4C'&&variant.curve.state==='soft-annealed')?.value||'';

  let wireMode='auto',wireOption=null,wireSignature='';
  let materialMode='auto',materialDefaultKey='';
  sel.addEventListener('change',()=>{materialMode='customer';});
  function drawingMaterialChoice(){
    if(!staged)return null;
    const variant=variantByValue.get($('drawing-material').value);
    return variant?{materialId:variant.material.id,curveId:variant.curve.id,materialState:variant.curve.state,origin:'user_selection'}:null;
  }
  function drawingMaterialOptions(){
    const field=$('drawing-material'),previous=field.value;
    field.replaceChildren(...['',...variants.map(v=>v.value)].map(value=>{const o=document.createElement('option');o.value=value;o.dataset.originalText='';o.textContent=value?optionLabel(variantByValue.get(value)):tr('Aus der Zeichnung lesen');return o;}));
    field.value=variantByValue.has(previous)?previous:'';
  }
  if(staged)drawingMaterialOptions();
  function defaultText(value){return value?.reason?msg(value.reason,Object.fromEntries(Object.entries(value.params||{}).map(([key,n])=>[key,typeof n==='number'?fmt(n,2):n]))):'';}
  function vorbelegen(){
    if(!staged)return;
    const e=lesen(),drawing=drawingActive(),choice=drawingMaterialChoice();
    $('drawing-material-field').hidden=!drawing;$('drawing-material-origin').hidden=!drawing;
    $('drawing-material-origin').dataset.originalText='';$('drawing-material-origin').textContent=tr(choice?'Ihre Auswahl gilt, wenn die Zeichnung keinen Werkstoff nennt.':'Ohne Werkstoffangabe: Annahme C4C, weichgeglüht (vorläufig).');
    const rm=E.rmVorbelegung?.(e),rmText=rm?.value!=null?msg('Rm {value} N/mm² · {origin}',{value:fmt(rm.value),origin:tr(rm.origin==='customer'?'Kundenangabe':'Richtwert · vorläufig')}):rm?.band?.max===400?tr('Rm bis 400 N/mm² · vorläufiges Praxisband für weichgeglühten Draht'):'';
    $('rm-origin').hidden=!rmText;$('rm-origin').dataset.originalText='';$('rm-origin').textContent=rmText;
    f.elements.rm.placeholder=rm?.origin!=='customer'&&rm?.value!=null?fmt(rm.value)+' · '+tr('Richtwert · vorläufig'):tr('aus Drahtzeugnis, falls bekannt');
    const candidates=window.JYWireDefaults?.candidates(e,formteilmodus()?geometryWizard?.getSpec():null,MASCHINEN)||[];
    const signature=JSON.stringify(candidates);
    if(signature!==wireSignature){wireSignature=signature;if(wireMode==='auto')wireOption=candidates[0]||null;else if(wireMode==='candidate')wireOption=candidates.find(c=>c.value===wireOption?.value)||candidates[0]||null;}
    if(wireMode!=='custom')f.elements.d0.value=wireOption?String(wireOption.value):'';
    const field=$('wire-candidates');field.replaceChildren(...[...candidates.map(c=>({value:String(c.value),label:'Ø '+fmt(c.value,2)+' mm · '+defaultText(c)})),{value:'custom',label:tr('Eigenen Drahtdurchmesser eingeben')}].map(item=>{const o=document.createElement('option');o.value=item.value;o.textContent=item.label;o.dataset.originalText='';return o;}));
    field.value=wireMode==='custom'?'custom':wireOption?String(wireOption.value):'custom';
    $('wire-candidates-field').hidden=drawing||!candidates.length;$('wire-custom-field').hidden=!drawing&&candidates.length>0&&wireMode!=='custom';
    const text=wireMode==='custom'?tr('Drahtdurchmesser aus Ihrer Eingabe'):wireOption?[tr('Drahtvorschlag · vorläufig'),defaultText(wireOption),wireOption.route?.upsetting!=='baseline'&&wireOption.route?.wireConditionAdvice?tr(wireOption.route.wireConditionAdvice):''].filter(Boolean).join(' '):'';
    $('wire-origin').hidden=!text||drawing;$('wire-origin').dataset.originalText='';$('wire-origin').textContent=text;
    $('wire-process-note').hidden=drawing||!candidates.length;$('wire-process-note').dataset.originalText='';$('wire-process-note').textContent=tr('Stauchdraht will geglüht sein, Reduzierdraht braucht das weniger')+'.';
  }

  // Size designations only: tool dimensions are not recess areas or forming factors.
  const DRIVE_SIZES = {
    hex: ['1.5','2','2.5','3','4','5','6','7','8','10','12','custom'],
    torx: [1,2,3,4,5,6,7,8,9,10,15,20,25,27,30,40,45,50,55,60].map(n=>'T'+n),
    ph: [0,1,2,3,4].map(n=>'PH'+n), pz: [0,1,2,3,4].map(n=>'PZ'+n)
  };
  let driveFamily = null, driveSize = '';
  function antriebAuswahl() {
    const family=antriebsFamilie(), sizes=DRIVE_SIZES[family] || [], field=f.elements.iSize;
    if(driveFamily!==family){
      f.elements.iVol.value='';
      const previous=field.value;
      field.replaceChildren(...['',...sizes].map(value=>{const option=document.createElement('option');option.value=value;return option;}));
      field.value=sizes.includes(previous)?previous:'';
      driveFamily=family;
    }
    if(driveSize!==field.value){f.elements.iVol.value='';driveSize=field.value;}
    Array.from(field.options).forEach(option=>{
      option.dataset.originalText='';
      option.textContent=!option.value?tr('Größe wählen'):option.value==='custom'?tr('Eigene Schlüsselweite'):family==='hex'?fmt(Number(option.value))+' mm':option.value;
    });
    f.querySelectorAll('[data-antrieb]').forEach(el=>{
      el.hidden=typ()!=='bolzen'||!el.dataset.antrieb.split(' ').includes(family);
      el.querySelectorAll('input,select').forEach(input=>input.disabled=el.hidden);
    });
    $('drive-custom-hex').hidden=typ()!=='bolzen'||family!=='hex'||field.value!=='custom';
    f.elements.iSW.disabled=$('drive-custom-hex').hidden;
  }

  function typ() { return f.elements.typ.value; }
  function gewindelos() { return typ()==='bolzen'&&['rivet','pin'].includes(f.elements.standardKind?.value); }
  function gewindeFamilie() { return gewindelos()?'none':f.elements.threadFamily?.value||'metric'; }
  function antriebsFamilie() { return gewindelos()?'none':f.elements.iTyp.value||'none'; }
  const THREAD_LABELS={'metric':'Metrisches Gewinde','trilobular':'Trilobulares Gewinde','duo-taptite':'Duo-Taptite','self-tapping':'Schneidgewinde','thermoplastic':'Thermoplast'};
  const HEAD_LABELS={rund:'rund, Zylinder- oder Flanschkopf',sechskant:'Sechskant, gestaucht',abgratet:'Sechskant, rund gestaucht und abgegratet',none:'Ohne Kopf',krallen:'Krallenkopf / Umspritz-Mitnahmeprofil'};
  let standardKind=null;
  let normPicker=null;
  function standardAuswahl(){
    if(staged&&normPicker){
      normPicker.refreshType();
      $('standard-norm-field').hidden=true;$('standard-kind').closest('label').hidden=true;
      $('nut-norm').closest('label').hidden=true;$('standard-norm-note').hidden=true;
      $('bolt-head').hidden=f.elements.standardKind.value==='headless';
      $('thread-family-field').hidden=gewindelos();f.elements.threadFamily.disabled=gewindelos();
      return;
    }
    const kind=f.elements.standardKind?.value||'screw';
    const fill=(field,family)=>{if(!field)return;const previous=field.value;const choices=window.JYStandardFamilies?.getFamilies(family)||[];field.replaceChildren(...['',...choices.map(item=>item.id)].map(id=>{const option=document.createElement('option');option.value=id;option.dataset.originalText='';option.textContent=id?tr(choices.find(item=>item.id===id).label):tr('Ohne Normvorgabe');return option;}));field.value=choices.some(item=>item.id===previous)?previous:'';};
    if(standardKind!==kind){fill(f.elements.standardNorm,kind);standardKind=kind;}
    normAnwenden();
    fill(f.elements.nutNorm,'nut');
    $('standard-norm-field').hidden=['rivet','pin'].includes(kind);$('bolt-head').hidden=kind==='headless';
    $('thread-family-field').hidden=gewindelos();f.elements.threadFamily.disabled=gewindelos();
  }
  function normAnwenden(){
    if(staged&&normPicker)return;
    const kind=f.elements.standardKind?.value||'screw',id=f.elements.standardNorm?.value;
    const family=(window.JYStandardFamilies?.getFamilies(kind)||[]).find(item=>item.id===id);
    // A norm specifies the finished head, while either upsetting or trimming can
    // produce a hexagon. Apply it before calculation, including delayed input.
    const heads=family?.headForm==='sechskant'?['sechskant','abgratet']:family?.headForm?[family.headForm]:null;
    if(heads&&!heads.includes(f.elements.kopfForm.value))f.elements.kopfForm.value=family.headForm;
    if(family?.driveFamily)f.elements.iTyp.value=family.driveFamily;
    f.elements.kopfForm.disabled=!!heads&&heads.length===1;
    Array.from(f.elements.kopfForm.options).forEach(option=>{
      option.disabled=!!heads&&!heads.includes(option.value);
      option.dataset.originalText='';
      option.textContent=tr(family?.headForm==='rund'&&option.value==='rund'?'Zylinderkopf':HEAD_LABELS[option.value]||option.value);
    });
    f.elements.iTyp.disabled=gewindelos()||!!family?.driveFamily;
    $('standard-norm-note').hidden=!family;
    if(kind==='headless'||family?.headForm==='none'){f.elements.kopfForm.value='none';for(const key of ['kD','kH','kSW'])f.elements[key].value='0';}
    antriebAuswahl();
  }
  const formteilmodus=()=>typ()==='formteil';
  let partsMode='drawing';
  const drawingActive=()=>formteilmodus()&&partsMode==='drawing';
  function sichtbar() {
    const t = typ();
    standardAuswahl();
    const special=formteilmodus();
    $('calculation-method-note').hidden=special;
    const drawing=drawingActive();
    $('standard-part-fields').hidden=special;$('manual-tools').hidden=special;$('parts-tabs').hidden=!special;$('parts-drawing-panel').hidden=!drawing;$('parts-drawing-output').hidden=!drawing;$('material-fields').hidden=drawing;$('geometry-panel').hidden=!special||drawing;$('geometry-view').hidden=!special||drawing;$('regelbox').hidden=special;$('anfrage').hidden=false;
    if(staged&&!special)$('geometry-view').hidden=false;
    for(const mode of ['drawing','geometry']){const tab=$('parts-'+mode+'-tab');tab.setAttribute('aria-selected',String(partsMode===mode));tab.tabIndex=partsMode===mode?0:-1;}
    f.querySelectorAll('[data-fuer]').forEach(el => { el.hidden = !el.dataset.fuer.split(' ').includes(t); });
    $('bolt-drive-fields').hidden=t!=='bolzen'||gewindelos();
    const k = f.elements.kopfForm.value;
    f.querySelectorAll('[data-kopf]').forEach(el => { el.hidden = !el.dataset.kopf.split(' ').includes(k); });
    f.querySelectorAll('[data-shaft-end]').forEach(el=>{el.hidden=t!=='bolzen'||!el.dataset.shaftEnd.split(' ').includes(f.elements.schaftende?.value||'voll');});
    $('shaft-end-note').hidden=t!=='bolzen'||f.elements.schaftende?.value!=='halbhohl';
    f.querySelectorAll('[data-nut-flange]').forEach(el=>{el.hidden=t!=='mutter'||!f.elements.nutFlange?.checked;});
    $('nut-flange-note').hidden=t!=='mutter'||!f.elements.nutFlange?.checked;
    const thread=gewindeFamilie();
    f.querySelectorAll('[data-thread]').forEach(el=>{el.hidden=!el.dataset.thread.split(' ').includes(thread);el.querySelectorAll('input').forEach(input=>input.disabled=el.hidden);});
    antriebAuswahl();
    const inlineDrawing=f.elements.wirePreparation.value==='inline-drawing';
    $('rod-diameter-field').hidden=!inlineDrawing;$('inline-drawing-note').hidden=!inlineDrawing;$('wire-strength-note').hidden=!inlineDrawing;
    f.elements.rodDiameter.disabled=!inlineDrawing;
    f.elements.rm.placeholder = tr('aus Drahtzeugnis, falls bekannt');
  }

  function zahlenfeldAktiv(name){
    const bolt=typ()==='bolzen',head=f.elements.kopfForm.value,drive=antriebsFamilie(),thread=gewindeFamilie();
    if(['kD','kH','kSW','kVol'].includes(name))return bolt&&head!=='none'&&(name!=='kSW'||['sechskant','abgratet','sechskant_bund'].includes(head))&&(name!=='kVol'||head==='krallen');
    if(['kC','capHeight','flangeDiameter','flangeHeight'].includes(name))return bolt&&!!f.elements[name]&&!f.elements[name].closest('[data-kopf]')?.hidden;
    if(['d_b','t_b'].includes(name))return bolt&&f.elements.schaftende?.value&&f.elements.schaftende.value!=='voll'&&(name!=='t_b'||f.elements.schaftende.value==='halbhohl');
    if(['endLength','endDiameter','tipAngle'].includes(name))return bolt&&['spitze','zapfen','kegelstumpf_flach'].includes(f.elements.schaftende?.value);
    if(['sD','sL'].includes(name))return bolt;
    if(['mM','mSW','mH','mLoch'].includes(name))return typ()==='mutter';
    if(['mFlansch','mFlanschH'].includes(name))return typ()==='mutter'&&f.elements.nutFlange?.checked;
    if(['iSW','iT','iVol'].includes(name))return bolt&&drive!=='none'&&(name!=='iSW'||drive==='hex'&&f.elements.iSize.value==='custom')&&(name!=='iVol'||drive!=='hex');
    if(name==='sArea')return bolt&&['trilobular','duo-taptite'].includes(thread);
    if(name==='tipLength')return bolt&&['duo-taptite','self-tapping','thermoplastic'].includes(thread);
    if(name==='tipArea')return bolt&&thread==='duo-taptite';
    if(name==='tipDiameter')return bolt&&['self-tapping','thermoplastic'].includes(thread);
    if(name==='rodDiameter')return f.elements.wirePreparation.value==='inline-drawing';
    return true;
  }
  function lesen() {
    const g = n => zahlenfeldAktiv(n)?num(f.elements[n] && f.elements[n].value):undefined;
    const variant=selectedVariant();
    const e = {
      typ: typ(), wst: variant?.index, curveId: variant?.curve.id, materialState:variant?.curve.state, rm: g('rm'), d0: g('d0'),
      ...(staged?{machinePolicy:'ranking-v1',rmPolicy:E.RM_POLICY_VERSION,inputOrigins:{d0:wireMode==='custom'?{origin:'customer'}:wireOption?{origin:'assumption',provisional:true,reason:defaultText(wireOption)}:null}}:{}),
      standardKind:typ()==='bolzen'?f.elements.standardKind?.value||'screw':undefined,standardReference:typ()==='mutter'?f.elements.nutNorm?.value:f.elements.standardNorm?.value,threadFamily:typ()==='bolzen'?gewindeFamilie():undefined,
      wirePreparation:f.elements.wirePreparation.value||'as-supplied',rodDiameter:f.elements.wirePreparation.value==='inline-drawing'?g('rodDiameter'):undefined,
      kopfForm: f.elements.kopfForm.value, kD: g('kD'), kSW: g('kSW'), kH: g('kH'), kVol:f.elements.kopfForm.value==='krallen'?g('kVol'):undefined,sD: g('sD'), sL: g('sL'),
      ...(staged&&f.elements.schaftende?{kopfTyp:f.elements.kopfForm.value==='rund'?'zylinder':f.elements.kopfForm.value,kC:g('kC'),capHeight:g('capHeight'),flangeDiameter:g('flangeDiameter'),flangeHeight:g('flangeHeight'),schaftende:f.elements.schaftende.value,d_b:g('d_b'),t_b:g('t_b'),bottomShape:f.elements.bottomShape?.value||'cone',bottomAngle:num(f.elements.bottomAngle?.value||'120'),boreDepthMode:'total'}:{}),
      iTyp: antriebsFamilie(), iSize: f.elements.iSize.value,
      iSW: f.elements.iSize.value==='custom'?g('iSW'):num(f.elements.iSize.value), iT: g('iT'), iVol: g('iVol'),
      mM: g('mM'), mSW: g('mSW'), mH: g('mH'), mLoch: g('mLoch'),
      ...(staged&&f.elements.nutShape?{nutModelVersion:'nut-model-v1',nutShape:f.elements.nutShape.value,mFlansch:g('mFlansch'),mFlanschH:g('mFlanschH')}:{}),
      masse: g('masse'), lStempel: g('lStempel'), wenden: f.elements.wenden.checked,
      vorgaben: { ko: g('ko'), pko: g('pko'), matD: g('matD'), matL: g('matL'), stD: g('stD'), stL: g('stL'), stationen: g('stationen'), zusatz: g('zusatz') },
      soll: { ausbringung: g('ausbringung') }
    };
    if(e.typ==='bolzen'){
      for(const key of ['endLength','endDiameter','tipAngle'])if(f.elements[key])e[key]=g(key);
      if(['trilobular','duo-taptite'].includes(e.threadFamily))e.sArea=g('sArea');
      if(['duo-taptite','self-tapping','thermoplastic'].includes(e.threadFamily))e.tipLength=g('tipLength');
      if(e.threadFamily==='duo-taptite')e.tipArea=g('tipArea');
      if(['self-tapping','thermoplastic'].includes(e.threadFamily))e.tipDiameter=g('tipDiameter');
    }
    if(e.iTyp!=='hex')e.iSW=undefined;
    if(e.iTyp==='hex'||e.iTyp==='none')e.iVol=undefined;
    if(e.iTyp==='hex')e.iSize=undefined;
    if (e.typ !== 'bolzen' || e.iTyp==='none') { e.iTyp='none'; e.iSize=e.iSW=e.iT=e.iVol=undefined; }
    if(staged&&normPicker){
      const preset=normPicker.adapted();
      if(preset){
        for(const key of ['standardReference','standardDocument','threadModel','propertyClass','normGeometryStatus','normMissingFields','normRequiresGeometryReview'])e[key]=preset[key];
        if(e.typ==='mutter'&&preset.threadModel)e.threadPitch=preset.threadModel.P;
        for(const key of ['shaftSegments','d_b','t_b','endAngle','endShape','kC','kF','kAlpha','mFlansch','mFlanschH'])if(preset[key]!=null&&!f.elements[key])e[key]=preset[key];
      }
    }
    return e;
  }

  function ungueltig() {
    let bad = false;
    f.querySelectorAll('input[inputmode]').forEach(el => {
      if(el.disabled||!zahlenfeldAktiv(el.name)||el.closest?.('[hidden],#geometry-wizard')){el.style.borderColor='';el.title='';return;}
      const v = num(el.value);
      const falsch = el.value.trim() !== '' && (!isFinite(v) || v < 0);
      el.style.borderColor = falsch ? 'var(--nein)' : '';
      el.title = falsch ? tr('Bitte eine Zahl eingeben, z. B. 12,5') : '';
      if (falsch) bad = true;
    });
    return bad;
  }

  let letzte = null, angefragtesModell = null,lastType=null,mailBusy=false,mailKey='',mailSignature='',mailReceipt=null,mailTimer=null,mailPolls=0;
  let geometryWizard=null,geometryPreview=null,geometryCalculation=null,geometryResult=null,geometrySelectedModel=null,wireStudy=null,kvpUI=null;
  let partsFile=null,partsFileError='',drawingPreview=null,drawingResult=null,drawingSelectedModel=null;
  const drawingNote=()=>$('parts-drawing-note').value.trim();
  const drawingMachines=()=>drawingResult?.proposal?.machines?.filter(machine=>MASCHINEN.some(item=>item.m===machine.model))||[];
  function drawingGallery(){if(formteilmodus())$('empty-visual').hidden=!drawingActive()||['ready','needs_info','failed'].includes(drawingResult?.status);}
  const geometryNote=()=>[geometryWizard?.getChain?.().standardReference,...(geometryWizard?.featureSummary()||[]),$('geometry-note').value.trim()].filter(Boolean).join('\n');
  const geometryMachines=()=>geometryResult?.proposal?.machines?.filter(machine=>MASCHINEN.some(item=>item.m===machine.model))||[];
  function geometryInput(){
    if(!formteilmodus()||drawingActive()||!geometryCalculation?.valid||!geometryWizard)return null;
    const variant=selectedVariant(),e=lesen();
    const origin=staged?e.inputOrigins?.d0?.origin:null;
    const inputOrigins=['assumption','customer'].includes(origin)?{d0:{origin,...(origin==='assumption'?{provisional:true}:{})}}:null;
    return {geometrySpec:geometryWizard.getSpec(),geometryFeatures:geometryWizard.getFeatures(),material:variant?.material.id,materialState:variant?.curve.state,curveId:variant?.curve.id,wirePreparation:e.wirePreparation,rodDiameter:e.rodDiameter,d0:e.d0,rm:e.rm,...(inputOrigins?{inputOrigins}:{})};
  }
  const maschinenFunde=wahl=>wahl?.ranking?wahl.ranking.candidates:wahl?[...wahl.passend.slice(0,3),...wahl.bedingt.slice(0,wahl.passend.length?2:4),...wahl.fast.slice(0,4)]:[];
  const angefragteMaschine=()=>maschinenFunde(letzte?.wahl).find(result=>result.o.m===angefragtesModell);
  function anfrageAuswahlZeigen() {
    const node=$('selected-machine');
    const model=formteilmodus()?(drawingActive()?drawingSelectedModel:geometrySelectedModel):angefragtesModell;
    node.dataset.originalText='';node.hidden=!model;
    node.textContent=model?msg('Anfrage für {model}',{model}):'';
    kvpUI?.refresh();
  }
  function anfrageAuswahlLoeschen() { angefragtesModell=null;geometrySelectedModel=null;drawingSelectedModel=null;anfrageAuswahlZeigen(); }
  function drawingFileFeedback(){
    const box=$('parts-file-feedback');box.dataset.state=partsFileError?'error':'ready';box.hidden=!partsFile&&!partsFileError;
    $('parts-file-state').dataset.originalText='';$('parts-file-state').textContent=tr(partsFileError?'Dateiauswahl prüfen':'Datei ausgewählt');
    $('parts-file-name').dataset.originalText='';$('parts-file-name').textContent=partsFileError?tr(partsFileError):partsFile?partsFile.name+' · '+fmt(partsFile.size/1024,1)+' KB':'';
    $('parts-file-remove').hidden=!partsFile;
    if(!drawingPreview){$('parts-drawing-analyse').hidden=false;$('parts-drawing-analyse').disabled=true;$('parts-drawing-status').dataset.originalText='';$('parts-drawing-status').textContent=partsFile?tr('Die Zeichnungsanalyse ist gerade nicht verfügbar.'):' ';$('parts-drawing-status').hidden=!partsFile;}
  }
  function setDrawingFile(file){
    partsFileError=!file?'':!file.size?'Die ausgewählte Datei ist leer. Bitte wählen Sie die Zeichnung erneut aus.':file.size>15*1024*1024?'Die Datei ist für die Übertragung zu groß. Bitte verwenden Sie eine Datei bis 15 MB.':!/\.(pdf|png|jpe?g|webp|tiff?|step|stp|dxf|dwg|igs|iges)$/i.test(file.name)?'Dieses Dateiformat wird hier nicht unterstützt. Bitte wählen Sie ein angegebenes Format.':'';
    partsFile=partsFileError?null:file||null;if(!partsFile)$('parts-file').value='';
    drawingResult=null;drawingSelectedModel=null;kvpUI?.refresh({reset:true});anfrageAuswahlZeigen();drawingFileFeedback();drawingPreview?.update();drawingGallery();knoepfe();
  }
  function selectPartsMode(mode,focus=false){partsMode=mode==='geometry'?'geometry':'drawing';anfrageAuswahlLoeschen();rechnen();if(focus)$('parts-'+partsMode+'-tab').focus();}
  function rechnen() {
    sichtbar();
    vorbelegen();
    if(staged&&$('norm-chain-actions'))$('norm-chain-actions').hidden=typ()!=='bolzen';
    if(lastType!==typ()){lastType=typ();anfrageAuswahlLoeschen();}
    if(formteilmodus()){
      letzte=null;$('aus').hidden=true;$('leer').hidden=true;drawingGallery();
      for(const id of ['kenn','karten','regeln','blatt'])rendered($(id),'');
      rendered($('stufen').tBodies[0],'');$('material-basis').textContent='';$('inline-drawing-summary').textContent='';$('inline-drawing-summary').hidden=true;
      const variant=selectedVariant();
      if(!drawingActive())geometryCalculation=geometryWizard?.refresh({wireDiameterMm:num(f.elements.d0.value),densityGcm3:variant?.material.rho,densityStatus:variant?.material.densityStatus})||null;
      geometryPreview?.update();drawingPreview?.update();drawingFileFeedback();knoepfe();L.apply();return;
    }
    geometryPreview?.update();drawingPreview?.update();
    if (ungueltig()) {letzte=null;anfrageAuswahlLoeschen();$('aus').hidden=true;$('geometry-view').hidden=true;$('empty-visual').hidden=false;knoepfe();L.apply();return;}
    const e = lesen();
    const aus = E.auslegen(e);
    if(staged&&window.JYStandardPreview){
      $('geometry-view').hidden=!(e.sD||e.kD||e.mM||e.mSW);
      rendered($('geometry-view'),window.JYStandardPreview.render({input:e,analysis:e.normRequiresGeometryReview?{...aus,fehlt:['Kontur ergänzen']}:aus,material:selectedVariant()?.material,translate:tr,format:x=>fmt(x,3),engine:E}));
    }
    if(e.normRequiresGeometryReview){
      letzte=null;anfrageAuswahlLoeschen();$('aus').hidden=true;$('leer').hidden=false;$('leer').dataset.originalText='';$('leer').textContent=tr('Die Normvorlage enthält noch keine vollständige Rohteilkontur. Fehlende Geometrie im Baukasten ergänzen.');knoepfe();L.apply();return;
    }
    if(angefragtesModell&&JSON.stringify(e)!==JSON.stringify(letzte?.e))anfrageAuswahlLoeschen();
    if (aus.fehlt.length || !aus.stufen.length) { $('leer').hidden = false; $('aus').hidden = true; $('empty-visual').hidden=false; $('leer').dataset.originalText=''; $('leer').textContent = aus.fehlt.length ? tr('Es fehlen noch:') + ' ' + aus.fehlt.map(tr).join(', ') + '.' : tr('Mit Draht-Ø und den Hüllmaßen des Teils erscheinen hier Stadienfolge, Werkzeuggröße und die passenden Modelle.'); letzte = null; anfrageAuswahlLoeschen(); knoepfe(); return; }
    const wahl = E.waehle(MASCHINEN, aus, e, PRAXIS);
    letzte = { e, aus, wahl };
    if(staged&&wahl.ranking&&window.JYWireOptimization){
      const candidates=window.JYWireDefaults.candidates(e,null,MASCHINEN);
      wireStudy=window.JYWireOptimization.evaluateVariants({engine:E,catalogue:MASCHINEN,practice:PRAXIS,input:e,analysis:aus,selection:wahl,candidates,thresholdPercent:window.JYMachineRanking.CONFIG?.economicChangeThresholdPercent});
      const box=$('wire-variants');box.hidden=!wireStudy.suggestions.length&&!wireStudy.concepts.some(x=>x.needsAnneal);
      rendered(box,'<h3>'+h('Drahtwege vergleichen')+'</h3>'+wireStudy.suggestions.map(v=>'<div class="wire-variant"><p><strong>'+esc(msg('Draht Ø{diameter} mm: {model}',{diameter:fmt(v.value,2),model:v.row.o.m}))+'</strong> · '+esc(msg('{stages} Stadien, Abschnittlänge {length} mm',{stages:v.aus.werte.stationen,length:fmt(v.aus.werte.L0)}))+'</p><p>'+esc(msg(v.reason,v.reasonParams||{}))+' '+esc(msg('Etwa {percent} % mehr nutzbare Ausbringung pro Investition.',{percent:v.compare.efficiency.percent}))+'</p><p>'+v.technicalChanges.map(x=>esc(typeof x==='string'?tr(x):msg(x.reason||x.code,Object.fromEntries(Object.entries(x.params||{}).map(([key,value])=>[key,typeof value==='number'?fmt(value):tr(value)]))))).join(' · ')+'</p><button type="button" class="knopf zwei" data-apply-wire="'+v.value+'">'+h('Diesen Drahtweg berechnen')+'</button></div>').join('')+(wireStudy.concepts.some(x=>x.needsAnneal)?'<p class="klein">'+h('Dünnere Stauchvarianten benötigen einen passenden geglühten Drahtzustand. Der gewählte Werkstoffzustand wird nicht automatisch geändert.')+'</p>':'')+'<p class="klein">'+esc(msg('Änderungsempfehlung ab {percent} % Vorteil; vorläufige Schwelle. Gleiche Ausbringungsbasis, ohne Werkzeug- und Betriebskosten.',{percent:wireStudy.thresholdPercent}))+'</p>');
    }
    if(angefragtesModell&&!angefragteMaschine())angefragtesModell=null;
    anfrageAuswahlZeigen();$('empty-visual').hidden=maschinenFunde(wahl).length>0;
    zeigen(e, aus, wahl); L.apply();
    knoepfe();
  }

  function zeigen(e, aus, wahl) {
    const w = aus.werte;
    const variant=selectedVariant(),basis=document.getElementById('material-basis');
    const massBasis=$('mass-basis');massBasis.dataset.originalText='';massBasis.textContent=densityNotice(variant);massBasis.hidden=!massBasis.textContent;
    if(basis){basis.dataset.originalText='';basis.textContent=variant?materialLabel(variant)+' · '+tr('Raumtemperatur')+' · φ '+fmt(variant.curve.phiMin,2)+'–'+fmt(variant.curve.phiMax,2):tr('Fließkurve des Lieferzustands fehlt');}
    if(basis&&typeof aus.vorzug?.assumption==='string')basis.textContent+=' · '+tr(aus.vorzug.assumption);
    const preparationSummary=$('inline-drawing-summary'),preparationText=window.JYConcept.preparationText(aus.vorzug,L.language);
    preparationSummary.hidden=!preparationText;preparationSummary.dataset.originalText='';preparationSummary.textContent=preparationText;
    $('leer').hidden = true; $('aus').hidden = false;
    // Platzhalter der Werkzeugfelder
    f.elements.lStempel.placeholder = fmt(w.lStempel) + ' ' + tr('berechnet');
    f.elements.ko.placeholder = fmt(w.lMatrize) + ' ' + tr('berechnet');
    f.elements.pko.placeholder = fmt(w.lStempel) + ' ' + tr('berechnet');
    f.elements.stationen.placeholder = w.stationen==null?tr('nicht belegt'):String(aus.stufen.length);
    f.elements.zusatz.placeholder = String(w.zusatzStandard) + (w.zusatzStandard ? ' '+tr('(Kalibrieren, Hohlteil)') : '');
    const kenn = [
      ['Abschnitt', 'Ø' + fmt(w.d0) + ' × ' + fmt(w.L0) + ' mm'],
      ['Masse Fertigteil', fmt(w.masse) + ' g'],
      ['Stationen', w.stationen==null?h('nicht belegt'):w.stationen + ' <small>'+h('+1 Reserve')+'</small>'],
      ['Höchste Stationskraft', w.Fmax_t==null?h('Kraft noch offen'):fmt(w.Fmax_t) + ' t'],
      ['Nennkraft nötig', w.FN_muss_t==null?h('Kraft noch offen'):fmt(w.FN_muss_t, 0) + ' t <small>'+esc(msg('wünschenswert {value} t',{value:fmt(w.FN_wunsch_t,0)}))+'</small>'],
      ['Summe aller Stationen', w.Fsum_t==null?h('Kraft noch offen'):fmt(w.Fsum_t) + ' t'],
      ['Auswerfer Matrize (KO)', fmt(w.ko) + ' mm' + (w.koVorgabe ? ' <small>'+h('Vorgabe')+'</small>' : '')],
      ['Auswerfer Stempel (PKO)', (w.pko > 0 ? fmt(w.pko) + ' mm' : h('nicht nötig')) + (w.pkoVorgabe ? ' <small>'+h('Vorgabe')+'</small>' : '')],
      ['Matrize Ø × L', rounded(w.matD.min) + ' '+h('bis')+' ' + rounded(w.matD.ideal) + ' × ' + rounded(w.matL) + ' mm' + (e.typ !== 'mutter' ? ' <small>'+esc(msg('Pitch ab {value}',{value:rounded(w.pitch)}))+'</small>' : '')],
      ['Stempelaufnahme', w.stempelD ? 'Ø' + rounded(w.stempelD) + ' mm' : '·'],
      ['Schneidbüchse', h('Bohrung')+' ' + fmt(w.buechse.bohrung, 2) + ' <small>'+esc(msg('außen Ø{value}',{value:rounded(w.buechse.aussen)}))+'</small>']
    ];
    if(aus.antrieb)kenn.splice(1,0,['Innenantrieb',h(aus.antrieb.label)+(aus.antrieb.depth?' · '+fmt(aus.antrieb.depth)+' mm':'')]);
    if (e.typ !== 'mutter') kenn.splice(3, 0, ['Stauchverhältnis Kopf', w.sKopf ? fmt(w.sKopf, 2) : '·']);
    rendered($('kenn'),kenn.map(([k, v]) => '<div><dt>' + h(k) + '</dt><dd>' + v + '</dd></div>').join(''));
    for(const [id,text]of [['stages-heading',aus.qualitative?'Qualitative Operationsfolge':'Stadienfolge'],['stage-column-heading',aus.qualitative?'Arbeitsschritt':'Station']]){$(id).dataset.originalText='';$(id).textContent=tr(text);}
    rendered($('stufen').tBodies[0],aus.stufen.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(window.JYConcept.stageText(s,L.language)) + '</td><td class="z">' + (s.t==null?h('Kraft noch offen'):fmt(s.t)+' t') + '</td><td class="z">' + (s.p==null?h('nicht belegt'):fmt(s.p,0)) + '</td><td class="z">Ø' + (s.matD==null?h('nicht belegt'):rounded(s.matD)) + (s.arm ? '<br><small>' + h(s.arm) + '</small>' : '') + '</td></tr>').join(''));
    // Karten
    const k = [];
    const rankingOptions={tr,fmt,eur,showPrices,practice:PRAXIS,requirements:{blankDiameter:w.d0,blankLength:w.L0,stations:w.stationen,partLength:w.Lteil,knockoutLength:w.ko,demandPerMinute:e.soll?.ausbringung}};
    if(wahl.ranking&&window.JYRankingUI)k.push(window.JYRankingUI.summaryHtml(wahl.ranking,rankingOptions));
    let checkIndex = 0;
    const karte = (r, beste) => {
      const o = r.o, sp = (o.lo && o.hi) ? eur(o.lo) + ' '+tr('bis')+' ' + eur(o.hi) : '';
      const farbe = r.ausl==null?'var(--offen)':r.ausl <= 0.65 ? 'var(--ok)' : r.ausl <= 0.8 ? 'var(--knapp)' : 'var(--nein)';
      const marke = { ok: 'passt', knapp: 'knapp', offen: 'Klärung nötig', nein: 'passt nicht' }[r.gesamt];
      const checkId = 'machine-check-' + checkIndex++;
      const badge = r.gesamt === 'offen'
        ? '<button type="button" class="marke m-offen" data-open-check aria-controls="' + checkId + '" title="' + h('Prüfung im Einzelnen') + '">' + h(marke) + '</button>'
        : '<span class="marke m-' + r.gesamt + '">' + h(marke) + '</span>';
      const openPoints=(r.openPoints||[]).filter(point=>point&&typeof point.detail==='string'&&point.detail.trim());
      const clarification=openPoints.length?'<div class="machine-open-points"><strong>'+h('Noch zu klären')+'</strong><ul>'+openPoints.map(point=>'<li><strong>'+h(point.owner)+':</strong> '+h(point.detail)+'</li>').join('')+'</ul></div>':'';
      const zeilen = r.k.map(x => '<tr><td>' + h(x.krit) + (x.detail?'<br><small>'+h(x.detail)+'</small>':'')+'</td><td>' + h(x.soll) + '</td><td>' + h(x.ist) + '</td><td><span class="st m-' + x.status + '">' + h({ ok: 'ok', knapp: 'knapp', nein: 'nein', offen: 'offen' }[x.status]) + '</span></td></tr>').join('');
      const kat = o.kat ? '<a href="' + KATURL + o.kat + '.pdf#page=' + (o.s || 1) + '" target="_blank" rel="noopener">'+esc(msg('Katalog {catalogue}, S. {page}',{catalogue:o.kat,page:o.s||1}))+'</a>' : '';
      if(wahl.ranking&&window.JYRankingUI){
        const concept=E.maschinenKonzept?window.JYConcept.html(E.maschinenKonzept(aus,e,o,PRAXIS),L.language):'';
        return '<div class="karte'+(beste?' beste':'')+'"><div class="kopfzeile"><div><span class="modell">'+esc(o.m)+'</span>'+badge+'<button type="button" class="quote-button" data-request-model="'+esc(o.m)+'">'+h('Angebot anfragen')+'</button></div>'+(showPrices?'<div class="preis"><b>'+esc(eur(o.rp))+'</b><small>'+esc(sp)+'</small></div>':'')+'</div>'+window.JYRankingUI.cardHtml(r,wahl.ranking,rankingOptions)+'<details class="machine-check" id="'+checkId+'"><summary>'+h('Stadienkonzept und Prüfung im Einzelnen')+'</summary>'+clarification+concept+'<table class="krit"><thead><tr><th>'+h('Kriterium')+'</th><th>'+h('Bedarf')+'</th><th>'+h('Maschine')+'</th><th></th></tr></thead><tbody>'+zeilen+'</tbody></table><p>'+kat+'</p></details></div>';
      }
      return '<div class="karte' + (beste ? ' beste' : '') + '"><div class="kopfzeile"><div><span class="modell">' + esc(o.m) + '</span>' + badge + '<button type="button" class="quote-button" data-request-model="'+esc(o.m)+'" aria-label="'+h('Angebot anfragen')+' · '+esc(o.m)+'">'+h('Angebot anfragen')+'</button><div class="fam">' + h(FAMNAME[o.f] || o.f) + ' · ' + o.st + ' '+h('Stationen')+' · ' + fmt(o.pw) + ' t' + (o.sz ? ' · '+esc(msg('bis {v}',{v:o.sz})) : '') + '</div></div>' +
        (showPrices ? '<div class="preis"><b>' + esc(eur(o.rp)) + '</b><small>' + esc(sp) + '</small></div>' : '') + '</div>' +
        clarification +
        (r.ausl==null?'':'<div class="balken" title="'+h('Auslastung der Nennkraft, Strich bei 65 %')+'"><i style="width:' + Math.min(100, rounded(r.ausl * 100)) + '%;background:' + farbe + '"></i></div>') +
        '<div class="kurz"><span>'+(r.ausl==null?h('Kraft noch offen'):h('Auslastung')+' '+rounded(r.ausl*100)+' %')+'</span><span>'+esc(msg('Abschnitt bis Ø{value}',{value:fmt(o.cd)}))+'</span><span>KO ' + (o.ko ? fmt(o.ko) : '·') + (o.kor ? ' (' + esc(o.kor) + ')' : '') + '</span><span>PKO ' + (o.pko ? fmt(o.pko) : '·') + '</span><span>'+esc(msg('Matrize Ø{value}',{value:o.die?fmt(o.die[0])+' × '+fmt(o.die[1]):'·'}))+'</span>' + (o.wt ? '<span>'+esc(msg('rund {weight} t, Motor {power} kW',{weight:fmt(o.wt),power:fmt(o.hp==null?null:o.hp*0.7457,0)}))+'</span>' : '') + (r.plan ? '<span title="'+h('Erfahrungswert aus der Serienfertigung; der Katalog nennt die Höchstdrehzahl')+'">'+esc(msg('Planung ≈ {rate} /min, rund {hourly} Stück/h (Katalog bis {maximum})',{rate:fmt(r.plan.aus),hourly:fmt(r.stundeProStk,0),maximum:fmt(o.out)}))+'</span>' : (o.out ? '<span>'+esc(msg('bis {v}',{v:fmt(o.out)}))+' /min</span>' : '')) + '</div>' +
        (E.maschinenKonzept?window.JYConcept.html(E.maschinenKonzept(aus,e,o,PRAXIS),L.language):'')+'<details class="machine-check" id="'+checkId+'"><summary>'+h('Prüfung im Einzelnen')+'</summary><table class="krit"><thead><tr><th>'+h('Kriterium')+'</th><th>'+h('Bedarf')+'</th><th>'+h('Maschine')+'</th><th></th></tr></thead><tbody>' + zeilen + '</tbody></table><p class="klein">' + kat + '</p></details></div>';
    };
    if(wahl.ranking){
      k.push(...[wahl.ranking.recommendation,...wahl.ranking.alternatives].filter(Boolean).map((r,i)=>karte(r,i===0)));
      k.push('<details class="ranking-all"><summary>'+esc(msg('Alle geprüften Modelle ({count})',{count:wahl.alle.length}))+'</summary><table class="krit"><thead><tr><th>'+h('Maschine')+'</th><th>'+h('Prüfung')+'</th><th>'+h('Richtpreis')+'</th></tr></thead><tbody>'+wahl.alle.map(r=>'<tr><td>'+esc(r.o.m)+'</td><td>'+h({ok:'passt',knapp:'knapp',offen:'Klärung nötig',nein:'passt nicht'}[r.gesamt])+(r.gesamt==='nein'?'<br><small>'+r.k.filter(x=>x.status==='nein').map(x=>h(x.krit)).join(', ')+'</small>':'')+'</td><td>'+(showPrices?esc(eur(r.o.rp)):'')+'</td></tr>').join('')+'</tbody></table></details>');
    }else{
    if (wahl.passend.length) { k.push(...wahl.passend.slice(0, 3).map((r, i) => karte(r, i === 0))); }
    if (wahl.bedingt.length) { k.push('<h3>'+h('Bedingt geeignet')+'</h3>'); k.push(...wahl.bedingt.slice(0, wahl.passend.length ? 2 : 4).map(r => karte(r, !wahl.passend.length))); }
    if (!wahl.passend.length && !wahl.bedingt.length) k.push('<p>'+h('Kein Katalogmodell erfüllt alle Muss-Kriterien. Die Anfrage lohnt trotzdem: Sonderausführungen und Werkzeugkonzepte klärt Hans Möhling direkt mit Jern Yao.')+'</p>');
    if (wahl.fast.length) { k.push('<details><summary>'+esc(msg('Knapp daneben ({count})',{count:Math.min(wahl.fast.length,4)}))+'</summary>' + wahl.fast.slice(0, 4).map(r => karte(r, false)).join('') + '</details>'); }
    }
    rendered($('karten'),k.join(''));
    rendered($('regeln'),aus.regelListe.map(id => { const r = E.REGELN[id]; return r ? '<tr><td>' + esc(id) + '</td><td>' + h(r.t) + '<br><span class="klein">' + h(r.art) + '</span></td></tr>' : ''; }).join(''));
  }

  function knoepfe() {
    const content=formteilmodus()?(drawingActive()?!!partsFile:!!geometryCalculation?.valid):!!letzte;
    const ok = content && a.elements.ok.checked && /.+@.+\..+/.test(a.elements.email.value);
    $('senden').disabled = !ok||mailBusy;
    $('drucken').disabled = !content;
    if(kvpUI){$('kvp-container').hidden=!content;kvpUI.refresh();}
  }

  function kvpContext(){
    if(!window.JYKvpContext)return null;
    if(!formteilmodus())return letzte?window.JYKvpContext.fromCalculation({input:letzte.e,values:letzte.aus.werte,material:selectedVariant()?.material,stages:letzte.aus.werte.stationen,selectedModel:angefragtesModell||letzte.wahl.ranking?.recommendation?.o.m}):null;
    const proposal=(drawingActive()?drawingResult:geometryResult)?.proposal;
    const input=drawingActive()?proposal?.calculation?.input||{typ:'formteil',d0:proposal?.wireDiameter?.value}:{...lesen(),typ:'formteil'};
    const values=proposal?.calculation?.values||(!drawingActive()?{d0:input.d0,L0:geometryCalculation?.blankLengthMm}:{});
    const material=drawingActive()?E.findMaterial(proposal?.materialContext?.materialId||proposal?.calculation?.materialModel?.id||''):selectedVariant()?.material;
    return window.JYKvpContext.fromCalculation({source:drawingActive()?'drawing':'structured_geometry',input,values,material,stages:proposal?.stages?.length||undefined,chain:drawingActive()?null:geometryWizard.getChain?.(),selectedModel:drawingActive()?drawingSelectedModel:geometrySelectedModel});
  }

  function geometrySummary(){
    const variant=selectedVariant(),e=lesen(),result=geometryCalculation,lines=[tr('Formteile'),...geometryWizard.summary()];
    if(geometryWizard.getChain?.().standardReference)lines.push(geometryWizard.getChain().standardReference);
    const value=(single,bounds,unit)=>single!=null?fmt(single,3)+' '+unit:Array.isArray(bounds)?fmt(bounds[0],3)+'–'+fmt(bounds[1],3)+' '+unit:tr('nicht belegt');
    if(geometrySelectedModel)lines.unshift(msg('Anfrage für {model}',{model:geometrySelectedModel}),'');
    if(variant)lines.push(tr('Werkstoff')+': '+materialLabel(variant));
    lines.push(tr('Vormaterial / Vorzug')+': '+preparationLabel(e.wirePreparation),tr('Draht-Ø an der Presse')+': '+fmt(e.d0)+' mm');
    if(staged&&e.inputOrigins?.d0)lines.push(tr('Herkunft Drahtdurchmesser')+': '+(e.inputOrigins.d0.origin==='assumption'?tr('Drahtvorschlag · vorläufig')+' · '+tr(e.inputOrigins.d0.reason):tr('Drahtdurchmesser aus Ihrer Eingabe')));
    if(e.wirePreparation==='inline-drawing')lines.push(tr('Walzdraht-Ø vor dem Vorzug')+': '+fmt(e.rodDiameter)+' mm');
    if(e.rm)lines.push(tr('Drahtzugfestigkeit Rm an der Presse')+': '+fmt(e.rm)+' N/mm²');
    const complete=geometryWizard.isComplete();
    lines.push(tr(complete?'Volumen':'Volumen der Grundgeometrie')+': '+value(result.volumeMm3,result.volumeBoundsMm3,'mm³'),tr('Masse Fertigteil')+': '+(complete?value(result.massG,result.massBoundsG,'g'):tr('Kontur noch unvollständig')),tr('Abschnittlänge')+': '+(complete?value(result.blankLengthMm,result.blankLengthBoundsMm,'mm'):tr('Kontur noch unvollständig')));
    if(complete&&densityNotice(variant))lines.push(densityNotice(variant));
    if($('geometry-note').value.trim())lines.push('',tr('Ergänzungen zum Stadienkonzept')+': '+$('geometry-note').value);
    if(geometryResult?.answer)lines.push('',geometryResult.answer);
    for(const stage of geometryResult?.proposal?.stages||[])lines.push(window.JYConcept.stageText(stage,L.language));
    for(const machine of geometryMachines().filter(m=>!geometrySelectedModel||m.model===geometrySelectedModel)){
      lines.push(machine.model+(showPrices&&Number.isFinite(machine.priceEUR)?' · '+eur(machine.priceEUR):''));
      for(const stage of machine.concept?.stages||[])lines.push('  '+stage.number+'. '+window.JYConcept.stageText(stage,L.language)+(stage.location?' · '+window.JYConcept.locationText(stage,L.language):''));
      if(machine.concept?.rationale)lines.push(window.JYConcept.rationaleText(machine.concept,L.language));
    }
    return lines.join('\n');
  }
  function zusammenfassung() {
    if(drawingActive()){
      const lines=[tr('Zeichnung')+': '+partsFile.name];if(drawingSelectedModel)lines.unshift(msg('Anfrage für {model}',{model:drawingSelectedModel}));
      if(drawingNote())lines.push(drawingNote());if(drawingResult?.answer)lines.push('',drawingResult.answer);
      for(const stage of drawingResult?.proposal?.stages||[])lines.push(window.JYConcept.stageText(stage,L.language));
      for(const machine of drawingMachines().filter(item=>!drawingSelectedModel||item.model===drawingSelectedModel)){lines.push(machine.model+(showPrices&&Number.isFinite(machine.priceEUR)?' · '+eur(machine.priceEUR):''));for(const stage of machine.concept?.stages||[])lines.push('  '+stage.number+'. '+window.JYConcept.stageText(stage,L.language));}
      return lines.join('\n');
    }
    if(formteilmodus())return geometrySummary();
    const { e, aus, wahl } = letzte, w = aus.werte, m = aus.werkstoff;
    const lines = [];
    const field = (label, value) => lines.push(tr(label).replace(/[:：]$/, '') + ': ' + value);
    const mm = value => value == null ? tr('nicht belegt') : fmt(value) + ' mm';
    const force = value => value == null ? tr('Kraft noch offen') : fmt(value) + ' t';
    const selected=angefragteMaschine();
    if(selected)lines.push(msg('Anfrage für {model}',{model:selected.o.m}),'');
    field('Teileart', tr(e.typ==='bolzen'?({screw:'Schraube',rivet:'Niet',pin:'Bolzen',headless:'Kopfloses Teil'}[e.standardKind]||'Schraube/Bolzen'):{formteil:'Formteil/Hülse',mutter:'Mutter'}[e.typ]));
    if(e.standardReference)field('Normfamilie',normPicker?.summary()||e.standardReference);
    if(e.typ==='bolzen'&&e.threadFamily!=='none')field('Gewindefamilie',tr(THREAD_LABELS[e.threadFamily]||e.threadFamily));
    field('Werkstoff', (m.sourceName || m.id) + (m.number ? ' · ' + m.number : ''));
    field('Vormaterial / Vorzug',preparationLabel(e.wirePreparation));
    if(e.wirePreparation==='inline-drawing')field('Walzdraht-Ø vor dem Vorzug',mm(e.rodDiameter));
    field('Draht-Ø an der Presse',mm(e.d0));
    if(staged&&e.inputOrigins?.d0?.origin==='assumption')field('Herkunft Drahtdurchmesser',tr('Drahtvorschlag · vorläufig')+' · '+tr(e.inputOrigins.d0.reason));
    field('Drahtzugfestigkeit Rm an der Presse', m.Rm == null ? tr('nicht belegt') : fmt(m.Rm) + ' N/mm²');
    if(staged&&m.rmVorbelegung&&(m.rmVorbelegung.value!=null||m.rmVorbelegung.band))field('Herkunft Rm',tr(m.rmVorbelegung.origin==='customer'?'Kundenangabe':m.rmVorbelegung.value!=null?'Richtwert · vorläufig':'Vorläufiges Praxisband'));
    const variant=selectedVariant();
    if(variant){field('Lieferzustand',conditionLabel(variant.curve));field('Werkstoffmodell:',modelLabel(variant.curve)+' · '+variant.curve.id);field('Kurvenbereich',tr('Raumtemperatur')+' · φ '+fmt(variant.curve.phiMin,2)+'–'+fmt(variant.curve.phiMax,2));}
    else field('Werkstoffmodell:',tr('Fließkurve des Lieferzustands fehlt'));
    const preparationText=window.JYConcept.preparationText(aus.vorzug,L.language);
    if(preparationText){lines.push(preparationText);if(typeof aus.vorzug.assumption==='string')lines.push(tr(aus.vorzug.assumption));}
    field('Abschnitt Ø × Länge', mm(w.d0) + ' × ' + mm(w.L0));
    field('Masse Fertigteil', fmt(w.masse) + ' g');
    if(densityNotice(variant))lines.push(densityNotice(variant));
    if (e.typ === 'mutter') {
      field('Mutter', 'M' + fmt(w.mM)); field('Mutternschlüsselweite', mm(e.mSW)); field('Mutternhöhe', mm(e.mH));
      if (e.mFlansch) field('Flanschdurchmesser', mm(e.mFlansch));
    } else {
      field('Form', tr(window.JYStandardFamilies?.get(e.standardReference)?.headForm==='rund'?'Zylinderkopf':HEAD_LABELS[e.kopfForm] || e.kopfForm));
      field('Kopfdurchmesser', mm(e.kD)); field('Kopfhöhe', mm(e.kH));
      if (e.kSW) field('Kopfschlüsselweite', mm(e.kSW));
      field('Körperdurchmesser', mm(e.sD)); field('Körperlänge', mm(e.sL));
      if(e.kVol!=null)field('Kopf-Außenkonturvolumen',fmt(e.kVol)+' mm³');
      if(e.sArea!=null)field('Rohling-Querschnittsfläche',fmt(e.sArea)+' mm²');
      if(e.tipLength!=null)field('Spitzenlänge am Fertigteil',mm(e.tipLength));
      if(e.tipArea!=null)field('Spitzenquerschnitt nach Gewindewalzen',fmt(e.tipArea)+' mm²');
      if(e.tipDiameter!=null)field('End-Ø nach Gewindewalzen',mm(e.tipDiameter));
      if(aus.antrieb){
        field('Innenantrieb',tr(aus.antrieb.label));
        if(e.iSW)field('Innenantrieb-Schlüsselweite',mm(e.iSW));
        field('Innenantriebstiefe',mm(e.iT));
        if(e.iVol)field('Volumen der Antriebsvertiefung',fmt(e.iVol)+' mm³');
      }
    }
    field('Länge im Stempel', mm(w.lStempel)); field('Auswerfer Matrize (KO)', mm(w.ko)); field('Auswerfer Stempel (PKO)', mm(w.pko));
    if (e.wenden) lines.push(tr('Teil wird im Transfer um 180° gewendet'));
    const v=e.vorgaben;
    if(v.matD)field('Matrize Ø × L',mm(v.matD)+' × '+mm(v.matL));
    if(v.stD)field('Stempelaufnahme',mm(v.stD)+' × '+mm(v.stL));
    if(v.zusatz!=null&&isFinite(v.zusatz))field('Zusatzstufen',fmt(v.zusatz,0));
    if(e.soll.ausbringung)field('Ausbringung',fmt(e.soll.ausbringung,0)+' /min');
    lines.push('',tr('Grobauslegung'));
    field('Stationen',fmt(w.stationen,0)+(w.stationen==null?'':' (+1 '+tr('Reserve')+')'));
    field('Höchste Stationskraft',force(w.Fmax_t));field('Nennkraft nötig',force(w.FN_muss_t));
    if(aus.qualitative)lines.push(tr('Qualitative Operationsfolge'));
    aus.stufen.forEach((stage,index)=>lines.push('  '+(aus.qualitative?tr('Arbeitsschritt')+' ':'')+(index+1)+'. '+window.JYConcept.stageText(stage,L.language)+': '+force(stage.t)));
    lines.push('',tr('Vorauswahl:'));
    const top=selected?[selected]:wahl.ranking?[wahl.ranking.recommendation,...wahl.ranking.alternatives].filter(Boolean):[...wahl.passend.slice(0,3),...(wahl.passend.length?[]:wahl.bedingt.slice(0,3))];
    const status={ok:'passt',knapp:'knapp',offen:'Klärung nötig',nein:'passt nicht'};
    top.forEach(r=>{
      lines.push('  '+r.o.m+' ('+tr(status[r.gesamt]||r.gesamt)+'), '+(showPrices?tr('Richtpreis')+' 2026 '+(r.o.rp?eur(r.o.rp):tr('auf Anfrage'))+', ':'')+(r.ausl==null?tr('Kraft noch offen'):tr('Auslastung')+' '+fmt(r.ausl*100,0)+' %')+(r.plan?', '+tr('Planung')+' '+fmt(r.plan.aus,0)+' /min':''));
      const openPoints=(r.openPoints||[]).filter(point=>point&&typeof point.detail==='string'&&point.detail.trim());
      if(openPoints.length){lines.push('    '+tr('Noch zu klären')+':');openPoints.forEach(point=>lines.push('    '+tr(point.owner)+': '+tr(point.detail)));}
      const card=Array.from($('karten').querySelectorAll('[data-ranking-model]')).find(node=>node.dataset.rankingModel===r.o.m);
      for(const node of card?.querySelectorAll('.ranking-comparison,.ranking-basis,.ranking-request')||[])lines.push('    '+node.textContent);
    });
    return lines.join('\n');
  }

  function versandStatus(data){
    const texts={sent:'Hans Möhling wurde per E-Mail über Ihre Anfrage informiert.',pending:'Anfrage eingegangen. Die E-Mail an Hans Möhling wird versandt.',failed:'Ihre Anfrage ist gespeichert. Die E-Mail an Hans Möhling konnte noch nicht zugestellt werden.'};
    const node=$('sendehinweis');node.dataset.originalText='';node.textContent=tr(texts[data.notificationStatus]||'Ihre Anfrage ist angekommen.');
    $('archive-mail-refresh').hidden=false;
  }
  async function versandAktualisieren(){
    if(!mailReceipt)return;const identity=mailReceipt,api=window.JYDrawingPreview;$('archive-mail-refresh').disabled=true;
    try{const data=await api.request('/status?'+new URLSearchParams(identity));if(identity!==mailReceipt)return;versandStatus(data);mailPolls++;if(data.notificationStatus==='pending'&&mailPolls<30)mailTimer=window.setTimeout(versandAktualisieren,4000);}
    catch(error){if(identity===mailReceipt){$('sendehinweis').dataset.originalText='';$('sendehinweis').textContent=tr(error.message);}}
    finally{$('archive-mail-refresh').disabled=false;}
  }
  async function senden() {
    if(mailBusy)return;
    rechnen();
    if(formteilmodus()?(drawingActive()?!partsFile:!geometryCalculation?.valid):!letzte)return;
    const drawing=drawingActive()?partsFile:null;
    const email=a.elements.email.value.trim(),consent=a.elements.ok.checked,contactName=a.elements.name.value,company=a.elements.firma.value,language=L.language;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!consent){$('sendehinweis').dataset.originalText='';$('sendehinweis').textContent=tr(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?'Bitte geben Sie eine gültige E-Mail-Adresse ein.':'Bitte stimmen Sie der Verarbeitung Ihrer Anfrage zu.');(!consent?a.elements.ok:a.elements.email).focus();return;}
    const kopf = [tr('Name')+': '+a.elements.name.value,tr('Firma')+': '+a.elements.firma.value,tr('E-Mail')+': '+a.elements.email.value,tr('Telefon')+': '+a.elements.tel.value].join('\n');
    const text = kopf + '\n\n' + (a.elements.nachricht.value ? a.elements.nachricht.value + '\n\n' : '') + zusammenfassung();
    const betreff = (tr(showPrices?'Richtpreisanfrage':'Maschinenanfrage')+' '+(formteilmodus()?((drawingActive()?drawingSelectedModel:geometrySelectedModel)||''):((angefragteMaschine() || letzte.wahl.passend[0] || letzte.wahl.bedingt[0])?.o.m || ''))).trim();
    const api=window.JYDrawingPreview;
    if(api?.apiBase){
      mailBusy=true;knoepfe();$('sendehinweis').dataset.originalText='';$('sendehinweis').textContent=tr('Ihre Anfrage wird übertragen …');
      try {
        const signature=await api.fingerprint(drawing,JSON.stringify([email,contactName,company,text]),language,showPrices?'with-prices':'technical-only');
        if(signature!==mailSignature){mailSignature=signature;mailKey=api.uuid();}
        const fd=new FormData();fd.append('email',email);fd.append('name',contactName);fd.append('firma',company);fd.append('notiz',text);fd.append('betreff',betreff);fd.append('consent','true');fd.append('language',language);fd.append('idempotency_key',mailKey);if(!showPrices)fd.append('pricePolicy','technical-only');
        if(staged&&!formteilmodus()&&letzte)fd.append('decisionContext',JSON.stringify({kind:'manual',input:letzte.e,candidates:maschinenFunde(letzte.wahl).map((row,i)=>({model:row.o.m,status:row.gesamt,rank:i+1})),selectedModel:angefragtesModell}));
        if(drawing)fd.append('datei',drawing,drawing.name);
        const receipt=await api.request('/anfrage',{method:'POST',body:fd,language});
        if(receipt.kind!=='enquiry'||receipt.status!=='received'||typeof receipt.id!=='string'||!receipt.id||typeof receipt.token!=='string'||!receipt.token)throw new Error('Der Eingang konnte nicht eindeutig bestätigt werden. Bitte versuchen Sie es erneut.');
        window.clearTimeout(mailTimer);mailReceipt={id:receipt.id,token:receipt.token};mailPolls=0;versandStatus(receipt);if(receipt.notificationStatus==='pending')mailTimer=window.setTimeout(versandAktualisieren,4000);
      }catch(error){$('sendehinweis').dataset.originalText='';$('sendehinweis').textContent=tr(error.message);}
      finally{mailBusy=false;knoepfe();}
      return;
    }
    location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(betreff) + '&body=' + encodeURIComponent(text.replace(/\n/g, '\r\n'));
    if(drawing){$('sendehinweis').dataset.originalText='';$('sendehinweis').textContent=tr('Bitte hängen Sie die ausgewählte Zeichnung im E-Mail-Programm selbst an.');}
  }

  function drucken() {
    rechnen();
    if(formteilmodus()?(drawingActive()?!partsFile:!geometryCalculation?.valid):!letzte)return;
    const b = $('blatt');
    b.dataset.originalText = ''; // This export is already localized once; preserve its numbers and identifiers.
    b.innerHTML = '<h1>'+esc(tr('Anforderungsblatt Mehrstufenpresse'))+'</h1><p>' + new Date().toLocaleDateString(window.JYI18N.numberLocale(L.language)) + ' · '+esc(tr('Grobauslegung, unverbindlich'))+' · info@jernyao.de</p><pre style="white-space:pre-wrap;font:inherit">' + esc(zusammenfassung()) + '</pre>';
    window.print();
  }

  const BSP = {
    m8: { typ: 'bolzen', d0: '8', kopfForm: 'rund', kD: '17', kH: '6', sD: '7,2', sL: '40' },
    m6: { typ: 'bolzen', d0: '5,6', kopfForm: 'rund', kD: '10', kH: '6', sD: '5,4', sL: '30', iTyp:'hex', iSize:'5', iT: '3' },
    mu: { typ: 'mutter', d0: '13', mM: '10', mSW: '16', mH: '8' }
  };
  document.querySelectorAll('[data-bsp]').forEach(btn => btn.addEventListener('click', () => {
    if(staged&&normPicker){
      normPicker.reset();materialMode='auto';wireMode='auto';wireOption=null;wireSignature='';
      f.reset();setDrawingFile(null);anfrageAuswahlLoeschen();
      if(btn.dataset.bsp==='stufen'){
        sel.value=variants.find(v=>v.material.id==='C4C'&&v.curve.state==='soft-annealed')?.value||'';
        geometryWizard.setChain(window.JYAxialChain.fromTemplate(window.JY_CHAIN_TEMPLATES.find(t=>t.id==='stufenbolzen')));
        f.elements.typ.value='formteil';selectPartsMode('geometry');
      }else{
        const choices={m6:{id:'ISO4762',groesse:'M6',laenge:30,festigkeitsklasse:'8.8'},m8:{id:'ISO4017',groesse:'M8',laenge:40,festigkeitsklasse:'8.8'},niet:{id:'DIN6791',groesse:'4',laenge:12,festigkeitsklasse:'Stahl'},mu:{id:'ISO4032',groesse:'M10',festigkeitsklasse:'8'}};
        normPicker.select(choices[btn.dataset.bsp]);rechnen();
      }
      return;
    }
    if(staged){wireMode='custom';wireOption=null;wireSignature='';}
    f.reset(); a.elements.ok.checked = false;
    setDrawingFile(null);
    if(f.elements.standardKind)f.elements.standardKind.value='screw';
    if(f.elements.threadFamily)f.elements.threadFamily.value='metric';
    if(f.elements.standardNorm)f.elements.standardNorm.value='';if(f.elements.nutNorm)f.elements.nutNorm.value='';
    f.elements.wirePreparation.value='as-supplied';
    const d = {...BSP[btn.dataset.bsp]};d.wst=variants.find(variant=>variant.material.id==='C4C'&&variant.curve.state==='soft-annealed')?.value||'';
    f.elements.iTyp.value=d.iTyp||'none';antriebAuswahl();
    for (const [k, v] of Object.entries(d)) {
      const el = f.elements[k];
      if (k === 'typ') f.elements.typ.value=v;
      else if (el && el.type === 'checkbox') el.checked = !!v;
      else if (el) el.value = v;
    }
    rechnen();
    if (window.matchMedia('(max-width:900px)').matches) $('ergebnis').scrollIntoView({ behavior: 'smooth' });
  }));

  let t = null;
  if(staged){
    $('wire-variants')?.addEventListener('click',event=>{const button=event.target.closest('[data-apply-wire]');if(!button)return;const value=Number(button.dataset.applyWire);if(!wireStudy?.suggestions.some(v=>v.value===value))return;wireMode='custom';wireOption=null;f.elements.d0.value=String(value);rechnen();});
    $('wire-candidates').addEventListener('change',()=>{const value=$('wire-candidates').value;wireMode=value==='custom'?'custom':'candidate';wireOption=(window.JYWireDefaults?.candidates(lesen(),formteilmodus()?geometryWizard?.getSpec():null,MASCHINEN)||[]).find(c=>String(c.value)===value)||null;rechnen();});
    f.elements.d0.addEventListener('input',()=>{wireMode='custom';wireOption=null;});
    $('drawing-material').addEventListener('change',()=>{vorbelegen();drawingPreview?.update();knoepfe();});
  }
  f.addEventListener('input', () => { if(angefragtesModell&&JSON.stringify(lesen())!==JSON.stringify(letzte?.e))anfrageAuswahlLoeschen();clearTimeout(t); t = setTimeout(rechnen, 120); });
  f.addEventListener('change', rechnen);
  document.querySelectorAll('input[name="typ"]').forEach(input=>input.addEventListener('change',rechnen));
  f.elements.standardKind?.addEventListener('change',()=>{standardKind=null;standardAuswahl();if(f.elements.standardKind.value==='headless')normAnwenden();else if(f.elements.kopfForm.value==='none')f.elements.kopfForm.value='rund';rechnen();});
  f.elements.standardNorm?.addEventListener('change',()=>{normAnwenden();rechnen();});
  $('flange-nut-route')?.addEventListener('click',()=>{f.elements.typ.value='formteil';selectPartsMode('geometry');$('geometry-wizard').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
  f.elements.nutNorm?.addEventListener('change',()=>{if(window.JYStandardFamilies?.get(f.elements.nutNorm.value)?.route==='formteil'){f.elements.nutNorm.value='';f.elements.typ.value='formteil';selectPartsMode('geometry');$('geometry-wizard').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});
  $('karten').addEventListener('click', event => {
    const requestButton=event.target.closest('button[data-request-model]');
    if(requestButton){
      const model=requestButton.dataset.requestModel;
      rechnen();
      if(!maschinenFunde(letzte?.wahl).some(result=>result.o.m===model))return;
      angefragtesModell=model;anfrageAuswahlZeigen();
      a.elements.email.focus({preventScroll:true});
      $('anfrage').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
      return;
    }
    const button = event.target.closest('button[data-open-check]');
    if (!button) return;
    const details = button.closest('.karte').querySelector('details.machine-check');
    details.open = true;
    details.querySelector('summary').focus({ preventScroll: true });
    details.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  a.addEventListener('input',knoepfe); a.addEventListener('change',knoepfe);
  $('senden').addEventListener('click', senden);
  $('archive-mail-refresh').addEventListener('click',()=>{mailPolls=0;window.clearTimeout(mailTimer);return versandAktualisieren();});
  $('drucken').addEventListener('click', drucken);
  if(staged&&window.JYNormPicker){
    normPicker=window.JYNormPicker.create({host:$('norm-picker'),form:f,data:window.JY_NORM_DATA,tr,getType:typ,
      getPart:()=>Object.fromEntries(Array.from(f.elements).filter(field=>field.name&&field.type!=='file'&&(field.type!=='radio'||field.checked)).map(field=>[field.name,field.type==='checkbox'?field.checked:field.value])),
      onApply(preset){
        for(const [key,value]of Object.entries(preset)){
          const field=f.elements[key];if(!field||value==null||typeof value==='object')continue;
          if(field.tagName==='SELECT'&&!Array.from(field.options).some(o=>o.value===String(value)))continue;
          field.value=String(value);field.disabled=false;
        }
        Array.from(f.elements.kopfForm.options).forEach(option=>option.disabled=false);
        f.elements.kopfForm.disabled=false;f.elements.iTyp.disabled=false;
        antriebAuswahl();
        if(preset.iSize!=null)f.elements.iSize.value=String(preset.iSize);
        if(preset.iTyp==='hex'&&preset.iSW!=null){f.elements.iSize.value=preset.iSize==='custom'?'custom':String(preset.iSW);if(!f.elements.iSize.value)f.elements.iSize.value='custom';if(f.elements.iSize.value==='custom')f.elements.iSW.value=String(preset.iSW);}
        antriebAuswahl();if(preset.iVol!=null)f.elements.iVol.value=String(preset.iVol);
        if(f.elements.nutFlange)f.elements.nutFlange.checked=preset.nutFlange??!!preset.mFlansch;
        const kind=typ()==='mutter'?'nut':preset.standardKind==='headless'?'screw':preset.standardKind;
        const rule=window.JY_NORM_DATA.materials.rules.find(rule=>rule.kind===kind&&rule.classes.includes(preset.propertyClass));
        const materialDefault=rule&&variants.find(v=>v.material.id===rule.materialId&&v.curve.state===rule.state);
        if(materialMode==='auto'&&materialDefault){sel.value=materialDefault.value;materialDefaultKey=kind+':'+preset.propertyClass;}
        wireSignature='';anfrageAuswahlLoeschen();
      },onChange:rechnen});
    $('norm-picker').hidden=false;
  }
  geometryWizard=(staged&&window.JYAxialChainUI?window.JYAxialChainUI:window.JYGeometryWizard)?.create({root:$('geometry-wizard'),view:$('geometry-view'),translate:tr,templates:window.JY_CHAIN_TEMPLATES||[],evaluate:(spec,options)=>window.JYGeometry?.evaluate(spec,options),onChange(){geometrySelectedModel=null;anfrageAuswahlZeigen();rechnen();}})||null;
  if(staged&&$('norm-to-chain'))$('norm-to-chain').addEventListener('click',()=>{
    const status=$('norm-chain-status');status.dataset.originalText='';
    try{
      const e=lesen();
      if(e.normRequiresGeometryReview){
        const missing=(e.normMissingFields||[]).map(key=>window.JYNormLibrary?.missingLabel(key,tr)||key);
        status.textContent=tr('Vor der Übernahme die offene Rohteilkontur ergänzen. Normvorlage und bisherige Eingaben bleiben erhalten.')+(missing.length?' '+tr('Noch zu ergänzen')+': '+missing.join(', ')+'.':'');
        return;
      }
      const chain=window.JYNormToChain.fromBolt(e,E.boltGeometry(e));
      geometryWizard.setChain(chain);wireMode='custom';wireOption=null;f.elements.d0.value=String(e.d0||'');f.elements.typ.value='formteil';selectPartsMode('geometry');
      status.textContent='';$('geometry-panel').scrollIntoView({block:'start',behavior:'smooth'});
    }catch(error){status.textContent=tr(error.message);}
  });
  if(window.JYDrawingPreview)drawingPreview=window.JYDrawingPreview.create({button:$('parts-drawing-analyse'),progress:$('parts-drawing-progress'),status:$('parts-drawing-status'),result:$('parts-drawing-result'),refresh:$('parts-drawing-refresh'),showWhenEmpty:true,getFile:()=>drawingActive()?partsFile:null,getNote:drawingNote,getMaterialChoice:drawingMaterialChoice,canChooseMachine:model=>MASCHINEN.some(machine=>machine.m===model),onInvalidate(){drawingResult=null;drawingSelectedModel=null;anfrageAuswahlZeigen();drawingGallery();},onResult(data){drawingResult=data;drawingGallery();knoepfe();},onChooseMachine(model){if(!drawingMachines().some(machine=>machine.model===model))return;drawingSelectedModel=model;anfrageAuswahlZeigen();a.elements.email.focus({preventScroll:true});$('anfrage').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});
  if(window.JYDrawingPreview?.apiBase&&geometryWizard)geometryPreview=window.JYDrawingPreview.create({button:$('geometry-analyse'),progress:$('geometry-progress'),status:$('geometry-status'),result:$('geometry-result'),refresh:$('geometry-refresh'),getGeometry:geometryInput,getNote:geometryNote,canChooseMachine:model=>MASCHINEN.some(machine=>machine.m===model),onInvalidate(){geometryResult=null;geometrySelectedModel=null;anfrageAuswahlZeigen();},onResult(data){geometryResult=data;knoepfe();},onChooseMachine(model){if(!geometryMachines().some(machine=>machine.model===model))return;geometrySelectedModel=model;anfrageAuswahlZeigen();a.elements.email.focus({preventScroll:true});$('anfrage').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});
  $('geometry-note').addEventListener('input',()=>{geometryPreview?.update();knoepfe();});
  $('parts-file').addEventListener('change',()=>setDrawingFile($('parts-file').files?.[0]||null));
  const partsDrop=$('parts-drop-zone');
  for(const eventName of ['dragenter','dragover'])partsDrop.addEventListener(eventName,event=>{event.preventDefault();partsDrop.dataset.dragging='true';});
  partsDrop.addEventListener('dragleave',event=>{event.preventDefault();if(!partsDrop.contains?.(event.relatedTarget))partsDrop.dataset.dragging='false';});
  partsDrop.addEventListener('drop',event=>{event.preventDefault();partsDrop.dataset.dragging='false';if(!drawingActive())return;const files=event.dataTransfer?.files;if(files?.length!==1){setDrawingFile(null);partsFileError='Bitte wählen Sie genau eine Zeichnung aus.';drawingFileFeedback();return;}setDrawingFile(files[0]);if(partsFile)try{$('parts-file').files=files;}catch(_){/* The selected File remains available even when the browser will not mirror a dropped FileList. */}});
  $('parts-file-remove').addEventListener('click',()=>setDrawingFile(null));
  if(staged&&window.JYKvpUI&&window.JYDrawingPreview?.apiBase&&$('kvp-panel'))kvpUI=window.JYKvpUI.create({host:$('kvp-panel'),endpoint:window.JYDrawingPreview.apiBase,tr,getContext:kvpContext});
  $('parts-drawing-note').addEventListener('input',()=>{drawingPreview?.update();knoepfe();});
  for(const mode of ['drawing','geometry']){$('parts-'+mode+'-tab').addEventListener('click',()=>selectPartsMode(mode));$('parts-'+mode+'-tab').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();selectPartsMode(event.key==='Home'?'drawing':event.key==='End'?'geometry':mode==='drawing'?'geometry':'drawing',true);}});}
  window.addEventListener('jy-languagechange',()=>{Array.from(sel.options).forEach(option=>{const variant=variantByValue.get(option.value);if(variant)option.textContent=optionLabel(variant);});if(staged)drawingMaterialOptions();standardKind=null;geometryWizard?.rerender();sichtbar();rechnen();L.apply();});
  sichtbar(); rechnen(); L.apply();
  document.querySelectorAll('[data-bsp]').forEach(button=>{button.disabled=false;});
})();
