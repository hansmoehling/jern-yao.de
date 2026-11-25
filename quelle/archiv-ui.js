(function () {
  'use strict';
  const E = window.JYK;
  const L=window.JYLocale, tr=s=>L.t(s);
  const showPrices = window.JY_SHOW_PRICES !== false;
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

  // Size designations only: tool dimensions are not recess areas or forming factors.
  const DRIVE_SIZES = {
    hex: ['1.5','2','2.5','3','4','5','6','7','8','10','12','custom'],
    torx: [5,6,7,8,9,10,15,20,25,27,30,40,45,50,55,60].map(n=>'T'+n),
    ph: [0,1,2,3,4].map(n=>'PH'+n), pz: [0,1,2,3,4].map(n=>'PZ'+n)
  };
  let driveFamily = null, driveSize = '';
  function antriebAuswahl() {
    const family=f.elements.iTyp.value || 'none', sizes=DRIVE_SIZES[family] || [], field=f.elements.iSize;
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
  const THREAD_LABELS={'metric':'Metrisches Gewinde','trilobular':'Trilobulares Gewinde','duo-taptite':'Duo-Taptite','self-tapping':'Schneidgewinde','thermoplastic':'Thermoplast'};
  let standardKind=null;
  function standardAuswahl(){
    const kind=f.elements.standardKind?.value||'screw';
    const fill=(field,family)=>{if(!field)return;const previous=field.value;const choices=window.JYStandardFamilies?.getFamilies(family)||[];field.replaceChildren(...['',...choices.map(item=>item.id)].map(id=>{const option=document.createElement('option');option.value=id;option.dataset.originalText='';option.textContent=id?tr(choices.find(item=>item.id===id).label):tr('Ohne Normvorgabe');return option;}));field.value=choices.some(item=>item.id===previous)?previous:'';};
    if(standardKind!==kind){fill(f.elements.standardNorm,kind);standardKind=kind;}
    const family=(window.JYStandardFamilies?.getFamilies(kind)||[]).find(item=>item.id===f.elements.standardNorm?.value);
    if(family&&((family.headForm&&family.headForm!==f.elements.kopfForm.value)||(family.driveFamily&&family.driveFamily!==f.elements.iTyp.value)))f.elements.standardNorm.value='';
    fill(f.elements.nutNorm,'nut');
    $('standard-norm-field').hidden=['rivet','pin'].includes(kind);$('bolt-head').hidden=kind==='headless';
  }
  function normAnwenden(){
    const kind=f.elements.standardKind?.value||'screw',id=f.elements.standardNorm?.value;
    const family=(window.JYStandardFamilies?.getFamilies(kind)||[]).find(item=>item.id===id);
    if(family?.headForm)f.elements.kopfForm.value=family.headForm;
    if(family?.driveFamily)f.elements.iTyp.value=family.driveFamily;
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
    const drawing=drawingActive();
    $('standard-part-fields').hidden=special;$('manual-tools').hidden=special;$('parts-tabs').hidden=!special;$('parts-drawing-panel').hidden=!drawing;$('parts-drawing-output').hidden=!drawing;$('material-fields').hidden=drawing;$('geometry-panel').hidden=!special||drawing;$('geometry-view').hidden=!special||drawing;$('regelbox').hidden=special;$('anfrage').hidden=false;
    for(const mode of ['drawing','geometry']){const tab=$('parts-'+mode+'-tab');tab.setAttribute('aria-selected',String(partsMode===mode));tab.tabIndex=partsMode===mode?0:-1;}
    f.querySelectorAll('[data-fuer]').forEach(el => { el.hidden = !el.dataset.fuer.split(' ').includes(t); });
    const k = f.elements.kopfForm.value;
    f.querySelectorAll('[data-kopf]').forEach(el => { el.hidden = !el.dataset.kopf.split(' ').includes(k); });
    const thread=f.elements.threadFamily?.value||'metric';
    f.querySelectorAll('[data-thread]').forEach(el=>{el.hidden=!el.dataset.thread.split(' ').includes(thread);el.querySelectorAll('input').forEach(input=>input.disabled=el.hidden);});
    antriebAuswahl();
    const inlineDrawing=f.elements.wirePreparation.value==='inline-drawing';
    $('rod-diameter-field').hidden=!inlineDrawing;$('inline-drawing-note').hidden=!inlineDrawing;$('wire-strength-note').hidden=!inlineDrawing;
    f.elements.rodDiameter.disabled=!inlineDrawing;
    f.elements.rm.placeholder = tr('aus Drahtzeugnis, falls bekannt');
  }

  function lesen() {
    const g = n => num(f.elements[n] && f.elements[n].value);
    const variant=selectedVariant();
    const e = {
      typ: typ(), wst: variant?.index, curveId: variant?.curve.id, materialState:variant?.curve.state, rm: g('rm'), d0: g('d0'),
      standardKind:f.elements.standardKind?.value||'screw',standardReference:typ()==='mutter'?f.elements.nutNorm?.value:f.elements.standardNorm?.value,threadFamily:f.elements.threadFamily?.value||'metric',
      wirePreparation:f.elements.wirePreparation.value||'as-supplied',rodDiameter:f.elements.wirePreparation.value==='inline-drawing'?g('rodDiameter'):undefined,
      kopfForm: f.elements.kopfForm.value, kD: g('kD'), kSW: g('kSW'), kH: g('kH'), kVol:f.elements.kopfForm.value==='krallen'?g('kVol'):undefined,sD: g('sD'), sL: g('sL'),
      iTyp: f.elements.iTyp.value || 'none', iSize: f.elements.iSize.value,
      iSW: f.elements.iSize.value==='custom'?g('iSW'):num(f.elements.iSize.value), iT: g('iT'), iVol: g('iVol'),
      mM: g('mM'), mSW: g('mSW'), mH: g('mH'), mLoch: g('mLoch'),
      masse: g('masse'), lStempel: g('lStempel'), wenden: f.elements.wenden.checked,
      vorgaben: { ko: g('ko'), pko: g('pko'), matD: g('matD'), matL: g('matL'), stD: g('stD'), stL: g('stL'), stationen: g('stationen'), zusatz: g('zusatz') },
      soll: { ausbringung: g('ausbringung') }
    };
    if(e.typ==='bolzen'){
      if(['trilobular','duo-taptite'].includes(e.threadFamily))e.sArea=g('sArea');
      if(['duo-taptite','self-tapping','thermoplastic'].includes(e.threadFamily))e.tipLength=g('tipLength');
      if(e.threadFamily==='duo-taptite')e.tipArea=g('tipArea');
      if(['self-tapping','thermoplastic'].includes(e.threadFamily))e.tipDiameter=g('tipDiameter');
    }
    if(e.iTyp!=='hex')e.iSW=undefined;
    if(e.iTyp==='hex'||e.iTyp==='none')e.iVol=undefined;
    if(e.iTyp==='hex')e.iSize=undefined;
    if (e.typ !== 'bolzen' || e.iTyp==='none') { e.iTyp='none'; e.iSize=e.iSW=e.iT=e.iVol=undefined; }
    return e;
  }

  function ungueltig() {
    let bad = false;
    f.querySelectorAll('input[inputmode]').forEach(el => {
      if(el.disabled||el.closest?.('#geometry-wizard'))return;
      const v = num(el.value);
      const falsch = el.value.trim() !== '' && (!isFinite(v) || v < 0);
      el.style.borderColor = falsch ? 'var(--nein)' : '';
      el.title = falsch ? tr('Bitte eine Zahl eingeben, z. B. 12,5') : '';
      if (falsch) bad = true;
    });
    return bad;
  }

  let letzte = null, angefragtesModell = null,lastType=null,mailBusy=false,mailKey='',mailSignature='',mailReceipt=null,mailTimer=null,mailPolls=0;
  let geometryWizard=null,geometryPreview=null,geometryCalculation=null,geometryResult=null,geometrySelectedModel=null;
  let partsFile=null,partsFileError='',drawingPreview=null,drawingResult=null,drawingSelectedModel=null;
  const drawingNote=()=>$('parts-drawing-note').value.trim();
  const drawingMachines=()=>drawingResult?.proposal?.machines?.filter(machine=>MASCHINEN.some(item=>item.m===machine.model))||[];
  function drawingGallery(){if(formteilmodus())$('empty-visual').hidden=!drawingActive()||['ready','needs_info','failed'].includes(drawingResult?.status);}
  const geometryNote=()=>[...(geometryWizard?.featureSummary()||[]),$('geometry-note').value.trim()].filter(Boolean).join('\n');
  const geometryMachines=()=>geometryResult?.proposal?.machines?.filter(machine=>MASCHINEN.some(item=>item.m===machine.model))||[];
  function geometryInput(){
    if(!formteilmodus()||drawingActive()||!geometryCalculation?.valid||!geometryWizard)return null;
    const variant=selectedVariant(),e=lesen();
    return {geometrySpec:geometryWizard.getSpec(),geometryFeatures:geometryWizard.getFeatures(),material:variant?.material.id,materialState:variant?.curve.state,curveId:variant?.curve.id,wirePreparation:e.wirePreparation,rodDiameter:e.rodDiameter,d0:e.d0,rm:e.rm};
  }
  const maschinenFunde=wahl=>wahl?[...wahl.passend.slice(0,3),...wahl.bedingt.slice(0,wahl.passend.length?2:4),...wahl.fast.slice(0,4)]:[];
  const angefragteMaschine=()=>maschinenFunde(letzte?.wahl).find(result=>result.o.m===angefragtesModell);
  function anfrageAuswahlZeigen() {
    const node=$('selected-machine');
    const model=formteilmodus()?(drawingActive()?drawingSelectedModel:geometrySelectedModel):angefragtesModell;
    node.dataset.originalText='';node.hidden=!model;
    node.textContent=model?msg('Anfrage für {model}',{model}):'';
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
    drawingResult=null;drawingSelectedModel=null;anfrageAuswahlZeigen();drawingFileFeedback();drawingPreview?.update();drawingGallery();knoepfe();
  }
  function selectPartsMode(mode,focus=false){partsMode=mode==='geometry'?'geometry':'drawing';anfrageAuswahlLoeschen();rechnen();if(focus)$('parts-'+partsMode+'-tab').focus();}
  function rechnen() {
    sichtbar();
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
    if (ungueltig()) {letzte=null;anfrageAuswahlLoeschen();$('aus').hidden=true;$('empty-visual').hidden=false;knoepfe();L.apply();return;}
    const e = lesen();
    if(angefragtesModell&&JSON.stringify(e)!==JSON.stringify(letzte?.e))anfrageAuswahlLoeschen();
    const aus = E.auslegen(e);
    if (aus.fehlt.length || !aus.stufen.length) { $('leer').hidden = false; $('aus').hidden = true; $('empty-visual').hidden=false; $('leer').dataset.originalText=''; $('leer').textContent = aus.fehlt.length ? tr('Es fehlen noch:') + ' ' + aus.fehlt.map(tr).join(', ') + '.' : tr('Mit Draht-Ø und den Hüllmaßen des Teils erscheinen hier Stadienfolge, Werkzeuggröße und die passenden Modelle.'); letzte = null; anfrageAuswahlLoeschen(); knoepfe(); return; }
    const wahl = E.waehle(MASCHINEN, aus, e, PRAXIS);
    letzte = { e, aus, wahl };
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
    rendered($('stufen').tBodies[0],aus.stufen.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + h(s.v) + '</td><td class="z">' + (s.t==null?h('Kraft noch offen'):fmt(s.t)+' t') + '</td><td class="z">' + (s.p==null?h('nicht belegt'):fmt(s.p,0)) + '</td><td class="z">Ø' + (s.matD==null?h('nicht belegt'):rounded(s.matD)) + (s.arm ? '<br><small>' + h(s.arm) + '</small>' : '') + '</td></tr>').join(''));
    // Karten
    const k = [];
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
      const zeilen = r.k.map(x => '<tr><td>' + h(x.krit) + '</td><td>' + h(x.soll) + '</td><td>' + h(x.ist) + '</td><td><span class="st m-' + x.status + '">' + h({ ok: 'ok', knapp: 'knapp', nein: 'nein', offen: 'offen' }[x.status]) + '</span></td></tr>').join('');
      const kat = o.kat ? '<a href="' + KATURL + o.kat + '.pdf#page=' + (o.s || 1) + '" target="_blank" rel="noopener">'+esc(msg('Katalog {catalogue}, S. {page}',{catalogue:o.kat,page:o.s||1}))+'</a>' : '';
      return '<div class="karte' + (beste ? ' beste' : '') + '"><div class="kopfzeile"><div><span class="modell">' + esc(o.m) + '</span>' + badge + '<button type="button" class="quote-button" data-request-model="'+esc(o.m)+'" aria-label="'+h('Angebot anfragen')+' · '+esc(o.m)+'">'+h('Angebot anfragen')+'</button><div class="fam">' + h(FAMNAME[o.f] || o.f) + ' · ' + o.st + ' '+h('Stationen')+' · ' + fmt(o.pw) + ' t' + (o.sz ? ' · '+esc(msg('bis {v}',{v:o.sz})) : '') + '</div></div>' +
        (showPrices ? '<div class="preis"><b>' + esc(eur(o.rp)) + '</b><small>' + esc(sp) + '</small></div>' : '') + '</div>' +
        clarification +
        (r.ausl==null?'':'<div class="balken" title="'+h('Auslastung der Nennkraft, Strich bei 65 %')+'"><i style="width:' + Math.min(100, rounded(r.ausl * 100)) + '%;background:' + farbe + '"></i></div>') +
        '<div class="kurz"><span>'+(r.ausl==null?h('Kraft noch offen'):h('Auslastung')+' '+rounded(r.ausl*100)+' %')+'</span><span>'+esc(msg('Abschnitt bis Ø{value}',{value:fmt(o.cd)}))+'</span><span>KO ' + (o.ko ? fmt(o.ko) : '·') + (o.kor ? ' (' + esc(o.kor) + ')' : '') + '</span><span>PKO ' + (o.pko ? fmt(o.pko) : '·') + '</span><span>'+esc(msg('Matrize Ø{value}',{value:o.die?fmt(o.die[0])+' × '+fmt(o.die[1]):'·'}))+'</span>' + (o.wt ? '<span>'+esc(msg('rund {weight} t, Motor {power} kW',{weight:fmt(o.wt),power:fmt(o.hp==null?null:o.hp*0.7457,0)}))+'</span>' : '') + (r.plan ? '<span title="'+h('Erfahrungswert aus der Serienfertigung; der Katalog nennt die Höchstdrehzahl')+'">'+esc(msg('Planung ≈ {rate} /min, rund {hourly} Stück/h (Katalog bis {maximum})',{rate:fmt(r.plan.aus),hourly:fmt(r.stundeProStk,0),maximum:fmt(o.out)}))+'</span>' : (o.out ? '<span>'+esc(msg('bis {v}',{v:fmt(o.out)}))+' /min</span>' : '')) + '</div>' +
        (E.maschinenKonzept?window.JYConcept.html(E.maschinenKonzept(aus,e,o,PRAXIS),L.language):'')+'<details class="machine-check" id="'+checkId+'"><summary>'+h('Prüfung im Einzelnen')+'</summary><table class="krit"><thead><tr><th>'+h('Kriterium')+'</th><th>'+h('Bedarf')+'</th><th>'+h('Maschine')+'</th><th></th></tr></thead><tbody>' + zeilen + '</tbody></table><p class="klein">' + kat + '</p></details></div>';
    };
    if (wahl.passend.length) { k.push(...wahl.passend.slice(0, 3).map((r, i) => karte(r, i === 0))); }
    if (wahl.bedingt.length) { k.push('<h3>'+h('Bedingt geeignet')+'</h3>'); k.push(...wahl.bedingt.slice(0, wahl.passend.length ? 2 : 4).map(r => karte(r, !wahl.passend.length))); }
    if (!wahl.passend.length && !wahl.bedingt.length) k.push('<p>'+h('Kein Katalogmodell erfüllt alle Muss-Kriterien. Die Anfrage lohnt trotzdem: Sonderausführungen und Werkzeugkonzepte klärt Hans Möhling direkt mit Jern Yao.')+'</p>');
    if (wahl.fast.length) { k.push('<details><summary>'+esc(msg('Knapp daneben ({count})',{count:Math.min(wahl.fast.length,4)}))+'</summary>' + wahl.fast.slice(0, 4).map(r => karte(r, false)).join('') + '</details>'); }
    rendered($('karten'),k.join(''));
    rendered($('regeln'),aus.regelListe.map(id => { const r = E.REGELN[id]; return r ? '<tr><td>' + esc(id) + '</td><td>' + h(r.t) + '<br><span class="klein">' + h(r.art) + '</span></td></tr>' : ''; }).join(''));
  }

  function knoepfe() {
    const content=formteilmodus()?(drawingActive()?!!partsFile:!!geometryCalculation?.valid):!!letzte;
    const ok = content && a.elements.ok.checked && /.+@.+\..+/.test(a.elements.email.value);
    $('senden').disabled = !ok||mailBusy;
    $('drucken').disabled = !content;
  }

  function geometrySummary(){
    const variant=selectedVariant(),e=lesen(),result=geometryCalculation,lines=[tr('Formteile'),...geometryWizard.summary()];
    const value=(single,bounds,unit)=>single!=null?fmt(single,3)+' '+unit:Array.isArray(bounds)?fmt(bounds[0],3)+'–'+fmt(bounds[1],3)+' '+unit:tr('nicht belegt');
    if(geometrySelectedModel)lines.unshift(msg('Anfrage für {model}',{model:geometrySelectedModel}),'');
    if(variant)lines.push(tr('Werkstoff')+': '+materialLabel(variant));
    lines.push(tr('Vormaterial / Vorzug')+': '+preparationLabel(e.wirePreparation),tr('Draht-Ø an der Presse')+': '+fmt(e.d0)+' mm');
    if(e.wirePreparation==='inline-drawing')lines.push(tr('Walzdraht-Ø vor dem Vorzug')+': '+fmt(e.rodDiameter)+' mm');
    if(e.rm)lines.push(tr('Drahtzugfestigkeit Rm an der Presse')+': '+fmt(e.rm)+' N/mm²');
    const complete=geometryWizard.isComplete();
    lines.push(tr(complete?'Volumen':'Volumen der Grundgeometrie')+': '+value(result.volumeMm3,result.volumeBoundsMm3,'mm³'),tr('Masse Fertigteil')+': '+(complete?value(result.massG,result.massBoundsG,'g'):tr('Kontur noch unvollständig')),tr('Abschnittlänge')+': '+(complete?value(result.blankLengthMm,result.blankLengthBoundsMm,'mm'):tr('Kontur noch unvollständig')));
    if(complete&&densityNotice(variant))lines.push(densityNotice(variant));
    if($('geometry-note').value.trim())lines.push('',tr('Ergänzungen zum Stadienkonzept')+': '+$('geometry-note').value);
    if(geometryResult?.answer)lines.push('',geometryResult.answer);
    for(const stage of geometryResult?.proposal?.stages||[])lines.push(tr(stage.operation));
    for(const machine of geometryMachines().filter(m=>!geometrySelectedModel||m.model===geometrySelectedModel)){
      lines.push(machine.model+(showPrices&&Number.isFinite(machine.priceEUR)?' · '+eur(machine.priceEUR):''));
      for(const stage of machine.concept?.stages||[])lines.push('  '+stage.number+'. '+tr(stage.operation||'')+(stage.location?' · '+tr(stage.location):''));
      if(machine.concept?.rationale)lines.push(tr(machine.concept.rationale));
    }
    return lines.join('\n');
  }
  function zusammenfassung() {
    if(drawingActive()){
      const lines=[tr('Zeichnung')+': '+partsFile.name];if(drawingSelectedModel)lines.unshift(msg('Anfrage für {model}',{model:drawingSelectedModel}));
      if(drawingNote())lines.push(drawingNote());if(drawingResult?.answer)lines.push('',drawingResult.answer);
      for(const stage of drawingResult?.proposal?.stages||[])lines.push(tr(stage.operation||''));
      for(const machine of drawingMachines().filter(item=>!drawingSelectedModel||item.model===drawingSelectedModel)){lines.push(machine.model+(showPrices&&Number.isFinite(machine.priceEUR)?' · '+eur(machine.priceEUR):''));for(const stage of machine.concept?.stages||[])lines.push('  '+stage.number+'. '+tr(stage.operation||''));}
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
    field('Teileart', tr({ bolzen: 'Schraube/Bolzen', formteil: 'Formteil/Hülse', mutter: 'Mutter' }[e.typ]));
    if(e.standardReference)field('Normfamilie',e.standardReference);
    if(e.typ==='bolzen')field('Gewindefamilie',tr(THREAD_LABELS[e.threadFamily]||e.threadFamily));
    field('Werkstoff', (m.sourceName || m.id) + (m.number ? ' · ' + m.number : ''));
    field('Vormaterial / Vorzug',preparationLabel(e.wirePreparation));
    if(e.wirePreparation==='inline-drawing')field('Walzdraht-Ø vor dem Vorzug',mm(e.rodDiameter));
    field('Draht-Ø an der Presse',mm(e.d0));
    field('Drahtzugfestigkeit Rm an der Presse', m.Rm == null ? tr('nicht belegt') : fmt(m.Rm) + ' N/mm²');
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
      field('Form', tr({rund:'rund, Zylinder- oder Flanschkopf',sechskant:'Sechskant, gestaucht',abgratet:'Sechskant, rund gestaucht und abgegratet',none:'Ohne Kopf',krallen:'Krallenkopf / Umspritz-Mitnahmeprofil'}[e.kopfForm] || e.kopfForm));
      field('Kopfdurchmesser', mm(e.kD)); field('Kopfhöhe', mm(e.kH));
      if (e.kSW) field('Kopfschlüsselweite', mm(e.kSW));
      field('Körperdurchmesser', mm(e.sD || e.d0)); field('Körperlänge', mm(e.sL));
      if(e.kVol!=null)field('Kopf-Außenkonturvolumen',fmt(e.kVol)+' mm³');
      if(e.sArea!=null)field('Rohling-Querschnittsfläche',fmt(e.sArea)+' mm²');
      if(e.tipLength!=null)field('Spitzenlänge',mm(e.tipLength));
      if(e.tipArea!=null)field('Querschnittsfläche des Spitzenabschnitts',fmt(e.tipArea)+' mm²');
      if(e.tipDiameter!=null)field('End-Ø der konischen Spitze',mm(e.tipDiameter));
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
    aus.stufen.forEach((stage,index)=>lines.push('  '+(aus.qualitative?tr('Arbeitsschritt')+' ':'')+(index+1)+'. '+tr(stage.v)+': '+force(stage.t)));
    lines.push('',tr('Vorauswahl:'));
    const top=selected?[selected]:[...wahl.passend.slice(0,3),...(wahl.passend.length?[]:wahl.bedingt.slice(0,3))];
    const status={ok:'passt',knapp:'knapp',offen:'Klärung nötig',nein:'passt nicht'};
    top.forEach(r=>{
      lines.push('  '+r.o.m+' ('+tr(status[r.gesamt]||r.gesamt)+'), '+(showPrices?tr('Richtpreis')+' 2026 '+(r.o.rp?eur(r.o.rp):tr('auf Anfrage'))+', ':'')+(r.ausl==null?tr('Kraft noch offen'):tr('Auslastung')+' '+fmt(r.ausl*100,0)+' %')+(r.plan?', '+tr('Planung')+' '+fmt(r.plan.aus,0)+' /min':''));
      const openPoints=(r.openPoints||[]).filter(point=>point&&typeof point.detail==='string'&&point.detail.trim());
      if(openPoints.length){lines.push('    '+tr('Noch zu klären')+':');openPoints.forEach(point=>lines.push('    '+tr(point.owner)+': '+tr(point.detail)));}
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
  f.addEventListener('input', () => { if(angefragtesModell&&JSON.stringify(lesen())!==JSON.stringify(letzte?.e))anfrageAuswahlLoeschen();clearTimeout(t); t = setTimeout(rechnen, 120); });
  f.addEventListener('change', rechnen);
  document.querySelectorAll('input[name="typ"]').forEach(input=>input.addEventListener('change',rechnen));
  f.elements.standardKind?.addEventListener('change',()=>{standardKind=null;standardAuswahl();if(f.elements.standardKind.value==='headless')normAnwenden();else if(f.elements.kopfForm.value==='none')f.elements.kopfForm.value='rund';rechnen();});
  f.elements.standardNorm?.addEventListener('change',()=>{normAnwenden();rechnen();});
  $('flange-nut-route').addEventListener('click',()=>{f.elements.typ.value='formteil';selectPartsMode('geometry');$('geometry-wizard').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
  f.elements.nutNorm?.addEventListener('change',()=>{if(window.JYStandardFamilies?.get(f.elements.nutNorm.value)?.route==='formteil'){f.elements.typ.value='formteil';selectPartsMode('geometry');$('geometry-wizard').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});
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
  geometryWizard=window.JYGeometryWizard?.create({root:$('geometry-wizard'),view:$('geometry-view'),translate:tr,evaluate:(spec,options)=>window.JYGeometry?.evaluate(spec,options),onChange(){geometrySelectedModel=null;anfrageAuswahlZeigen();rechnen();}})||null;
  if(window.JYDrawingPreview)drawingPreview=window.JYDrawingPreview.create({button:$('parts-drawing-analyse'),progress:$('parts-drawing-progress'),status:$('parts-drawing-status'),result:$('parts-drawing-result'),refresh:$('parts-drawing-refresh'),showWhenEmpty:true,getFile:()=>drawingActive()?partsFile:null,getNote:drawingNote,canChooseMachine:model=>MASCHINEN.some(machine=>machine.m===model),onInvalidate(){drawingResult=null;drawingSelectedModel=null;anfrageAuswahlZeigen();drawingGallery();},onResult(data){drawingResult=data;drawingGallery();knoepfe();},onChooseMachine(model){if(!drawingMachines().some(machine=>machine.model===model))return;drawingSelectedModel=model;anfrageAuswahlZeigen();a.elements.email.focus({preventScroll:true});$('anfrage').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});
  if(window.JYDrawingPreview?.apiBase&&geometryWizard)geometryPreview=window.JYDrawingPreview.create({button:$('geometry-analyse'),progress:$('geometry-progress'),status:$('geometry-status'),result:$('geometry-result'),refresh:$('geometry-refresh'),getGeometry:geometryInput,getNote:geometryNote,canChooseMachine:model=>MASCHINEN.some(machine=>machine.m===model),onInvalidate(){geometryResult=null;geometrySelectedModel=null;anfrageAuswahlZeigen();},onResult(data){geometryResult=data;knoepfe();},onChooseMachine(model){if(!geometryMachines().some(machine=>machine.model===model))return;geometrySelectedModel=model;anfrageAuswahlZeigen();a.elements.email.focus({preventScroll:true});$('anfrage').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});
  $('geometry-note').addEventListener('input',()=>{geometryPreview?.update();knoepfe();});
  $('parts-file').addEventListener('change',()=>setDrawingFile($('parts-file').files?.[0]||null));
  const partsDrop=$('parts-drop-zone');
  for(const eventName of ['dragenter','dragover'])partsDrop.addEventListener(eventName,event=>{event.preventDefault();partsDrop.dataset.dragging='true';});
  partsDrop.addEventListener('dragleave',event=>{event.preventDefault();if(!partsDrop.contains?.(event.relatedTarget))partsDrop.dataset.dragging='false';});
  partsDrop.addEventListener('drop',event=>{event.preventDefault();partsDrop.dataset.dragging='false';if(!drawingActive())return;const files=event.dataTransfer?.files;if(files?.length!==1){setDrawingFile(null);partsFileError='Bitte wählen Sie genau eine Zeichnung aus.';drawingFileFeedback();return;}setDrawingFile(files[0]);if(partsFile)try{$('parts-file').files=files;}catch(_){/* The selected File remains available even when the browser will not mirror a dropped FileList. */}});
  $('parts-file-remove').addEventListener('click',()=>setDrawingFile(null));
  $('parts-drawing-note').addEventListener('input',()=>{drawingPreview?.update();knoepfe();});
  for(const mode of ['drawing','geometry']){$('parts-'+mode+'-tab').addEventListener('click',()=>selectPartsMode(mode));$('parts-'+mode+'-tab').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();selectPartsMode(event.key==='Home'?'drawing':event.key==='End'?'geometry':mode==='drawing'?'geometry':'drawing',true);}});}
  window.addEventListener('jy-languagechange',()=>{Array.from(sel.options).forEach(option=>{const variant=variantByValue.get(option.value);if(variant)option.textContent=optionLabel(variant);});standardKind=null;geometryWizard?.rerender();sichtbar();rechnen();L.apply();});
  sichtbar(); rechnen(); L.apply();
})();
