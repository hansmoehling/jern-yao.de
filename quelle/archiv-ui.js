(function () {
  'use strict';
  const E = window.JYK;
  const L=window.JYLocale, tr=s=>L.t(s);
  const MASCHINEN = JSON.parse(document.getElementById('daten').textContent);
  const PRAXIS = JSON.parse(document.getElementById('praxis').textContent);
  const ENDPOINT = ''; // später: Empfangsdienst für Upload und KI-Gutachten, z. B. https://api.jernyao.de/anfrage
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
  const conditionLabel=curve=>tr(curve.state==='soft-annealed'?'weichgeglüht':curve.state);
  const modelLabel=curve=>tr(curve.approval==='proxy'?'begründete Ersatzkurve':'Literaturansatz');
  const materialLabel=variant=>(variant.material.sourceName||variant.material.id)+(variant.material.number?' · '+variant.material.number:'')+' · '+conditionLabel(variant.curve)+' · '+modelLabel(variant.curve);
  variants.forEach(variant=>{const option=document.createElement('option');option.value=variant.value;option.dataset.originalText='';option.textContent=materialLabel(variant);sel.appendChild(option);});
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
  function sichtbar() {
    const t = typ();
    f.querySelectorAll('[data-fuer]').forEach(el => { el.hidden = !el.dataset.fuer.split(' ').includes(t); });
    const k = f.elements.kopfForm.value;
    f.querySelectorAll('[data-kopf]').forEach(el => { el.hidden = !el.dataset.kopf.split(' ').includes(k); });
    antriebAuswahl();
    f.elements.rm.placeholder = tr('aus Drahtzeugnis, falls bekannt');
  }

  function lesen() {
    const g = n => num(f.elements[n] && f.elements[n].value);
    const variant=selectedVariant();
    const e = {
      typ: typ(), wst: variant?.index, curveId: variant?.curve.id, materialState:variant?.curve.state, rm: g('rm'), d0: g('d0'),
      kopfForm: f.elements.kopfForm.value, kD: g('kD'), kSW: g('kSW'), kH: g('kH'), sD: g('sD'), sL: g('sL'),
      iTyp: f.elements.iTyp.value || 'none', iSize: f.elements.iSize.value,
      iSW: f.elements.iSize.value==='custom'?g('iSW'):num(f.elements.iSize.value), iT: g('iT'), iVol: g('iVol'),
      nD: g('nD'), nT: g('nT'), nDurch: f.elements.nDurch.checked,
      mM: g('mM'), mSW: g('mSW'), mH: g('mH'), mLoch: g('mLoch'), mFlansch: g('mFlansch'), mFlanschH: g('mFlanschH'),
      masse: g('masse'), lStempel: g('lStempel'), wenden: f.elements.wenden.checked,
      vorgaben: { ko: g('ko'), pko: g('pko'), matD: g('matD'), matL: g('matL'), stD: g('stD'), stL: g('stL'), stationen: g('stationen'), zusatz: g('zusatz') },
      soll: { ausbringung: g('ausbringung') }
    };
    if(e.iTyp!=='hex')e.iSW=undefined;
    if(e.iTyp==='hex'||e.iTyp==='none')e.iVol=undefined;
    if(e.iTyp==='hex')e.iSize=undefined;
    if (e.typ !== 'bolzen' || e.iTyp==='none') { e.iTyp='none'; e.iSize=e.iSW=e.iT=e.iVol=undefined; }
    if (e.typ !== 'formteil') { e.nD = e.nT = undefined; e.nDurch = false; }
    return e;
  }

  function ungueltig() {
    let bad = false;
    f.querySelectorAll('input[inputmode]').forEach(el => {
      if(el.disabled)return;
      const v = num(el.value);
      const falsch = el.value.trim() !== '' && (!isFinite(v) || v < 0);
      el.style.borderColor = falsch ? 'var(--nein)' : '';
      el.title = falsch ? tr('Bitte eine Zahl eingeben, z. B. 12,5') : '';
      if (falsch) bad = true;
    });
    return bad;
  }

  let letzte = null;
  function rechnen() {
    sichtbar();
    if (ungueltig()) {letzte=null;$('aus').hidden=true;knoepfe();L.apply();return;}
    const e = lesen();
    const aus = E.auslegen(e);
    if (aus.fehlt.length || !aus.stufen.length) { $('leer').hidden = false; $('aus').hidden = true; $('leer').dataset.originalText=''; $('leer').textContent = aus.fehlt.length ? tr('Es fehlen noch:') + ' ' + aus.fehlt.map(tr).join(', ') + '.' : tr('Mit Draht-Ø und den Hüllmaßen des Teils erscheinen hier Stadienfolge, Werkzeuggröße und die passenden Modelle.'); letzte = null; knoepfe(); return; }
    const wahl = E.waehle(MASCHINEN, aus, e, PRAXIS);
    letzte = { e, aus, wahl };
    zeigen(e, aus, wahl); L.apply();
    knoepfe();
  }

  function zeigen(e, aus, wahl) {
    const w = aus.werte;
    const variant=selectedVariant(),basis=document.getElementById('material-basis');
    if(basis){basis.dataset.originalText='';basis.textContent=variant?materialLabel(variant)+' · '+tr('Raumtemperatur')+' · φ '+fmt(variant.curve.phiMin,2)+'–'+fmt(variant.curve.phiMax,2):tr('Fließkurve des Lieferzustands fehlt');}
    $('leer').hidden = true; $('aus').hidden = false;
    // Platzhalter der Werkzeugfelder
    f.elements.lStempel.placeholder = fmt(w.lStempel) + ' ' + tr('berechnet');
    f.elements.ko.placeholder = fmt(w.lMatrize) + ' ' + tr('berechnet');
    f.elements.pko.placeholder = fmt(w.lStempel) + ' ' + tr('berechnet');
    f.elements.stationen.placeholder = String(aus.stufen.length);
    f.elements.zusatz.placeholder = String(w.zusatzStandard) + (w.zusatzStandard ? ' '+tr('(Kalibrieren, Hohlteil)') : '');
    const kenn = [
      ['Abschnitt', 'Ø' + fmt(w.d0) + ' × ' + fmt(w.L0) + ' mm'],
      ['Masse Fertigteil', fmt(w.masse) + ' g'],
      ['Stationen', w.stationen + ' <small>'+h('+1 Reserve')+'</small>'],
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
    rendered($('hinweise'),aus.hinweise.map(note => '<li>' + h(note) + '</li>').join(''));
    rendered($('stufen').tBodies[0],aus.stufen.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + h(s.v) + '</td><td class="z">' + (s.t==null?h('Kraft noch offen'):fmt(s.t)+' t') + '</td><td class="z">' + (s.p==null?h('nicht belegt'):fmt(s.p,0)) + '</td><td class="z">Ø' + (s.matD==null?h('nicht belegt'):rounded(s.matD)) + (s.arm ? '<br><small>' + h(s.arm) + '</small>' : '') + '</td></tr>').join(''));
    // Karten
    const k = [];
    const karte = (r, beste) => {
      const o = r.o, sp = (o.lo && o.hi) ? eur(o.lo) + ' '+tr('bis')+' ' + eur(o.hi) : '';
      const farbe = r.ausl==null?'var(--offen)':r.ausl <= 0.65 ? 'var(--ok)' : r.ausl <= 0.8 ? 'var(--knapp)' : 'var(--nein)';
      const marke = { ok: 'passt', knapp: 'knapp', offen: 'Daten fehlen', nein: 'passt nicht' }[r.gesamt];
      const zeilen = r.k.map(x => '<tr><td>' + h(x.krit) + '</td><td>' + h(x.soll) + '</td><td>' + h(x.ist) + '</td><td><span class="st m-' + x.status + '">' + h({ ok: 'ok', knapp: 'knapp', nein: 'nein', offen: 'offen' }[x.status]) + '</span></td></tr>').join('');
      const kat = o.kat ? '<a href="' + KATURL + o.kat + '.pdf#page=' + (o.s || 1) + '" target="_blank" rel="noopener">'+esc(msg('Katalog {catalogue}, S. {page}',{catalogue:o.kat,page:o.s||1}))+'</a>' : '';
      return '<div class="karte' + (beste ? ' beste' : '') + '"><div class="kopfzeile"><div><span class="modell">' + esc(o.m) + '</span><span class="marke m-' + r.gesamt + '">' + h(marke) + '</span><div class="fam">' + h(FAMNAME[o.f] || o.f) + ' · ' + o.st + ' '+h('Stationen')+' · ' + fmt(o.pw) + ' t' + (o.sz ? ' · '+esc(msg('bis {v}',{v:o.sz})) : '') + '</div></div>' +
        '<div class="preis"><b>' + esc(eur(o.rp)) + '</b><small>' + esc(sp) + '</small></div></div>' +
        (r.ausl==null?'':'<div class="balken" title="'+h('Auslastung der Nennkraft, Strich bei 65 %')+'"><i style="width:' + Math.min(100, rounded(r.ausl * 100)) + '%;background:' + farbe + '"></i></div>') +
        '<div class="kurz"><span>'+(r.ausl==null?h('Kraft noch offen'):h('Auslastung')+' '+rounded(r.ausl*100)+' %')+'</span><span>'+esc(msg('Abschnitt bis Ø{value}',{value:fmt(o.cd)}))+'</span><span>KO ' + (o.ko ? fmt(o.ko) : '·') + (o.kor ? ' (' + esc(o.kor) + ')' : '') + '</span><span>PKO ' + (o.pko ? fmt(o.pko) : '·') + '</span><span>'+esc(msg('Matrize Ø{value}',{value:o.die?fmt(o.die[0])+' × '+fmt(o.die[1]):'·'}))+'</span>' + (o.wt ? '<span>'+esc(msg('rund {weight} t, Motor {power} kW',{weight:fmt(o.wt),power:fmt(o.hp==null?null:o.hp*0.7457,0)}))+'</span>' : '') + (r.plan ? '<span title="'+h('Erfahrungswert aus der Serienfertigung; der Katalog nennt die Höchstdrehzahl')+'">'+esc(msg('Planung ≈ {rate} /min, rund {hourly} Stück/h (Katalog bis {maximum})',{rate:fmt(r.plan.aus),hourly:fmt(r.stundeProStk,0),maximum:fmt(o.out)}))+'</span>' : (o.out ? '<span>'+esc(msg('bis {v}',{v:fmt(o.out)}))+' /min</span>' : '')) + '</div>' +
        (E.maschinenKonzept?window.JYConcept.html(E.maschinenKonzept(aus,e,o,PRAXIS),L.language):'')+'<details><summary>'+h('Prüfung im Einzelnen')+'</summary><table class="krit"><thead><tr><th>'+h('Kriterium')+'</th><th>'+h('Bedarf')+'</th><th>'+h('Maschine')+'</th><th></th></tr></thead><tbody>' + zeilen + '</tbody></table><p class="klein">' + kat + '</p></details></div>';
    };
    if (wahl.passend.length) { k.push(...wahl.passend.slice(0, 3).map((r, i) => karte(r, i === 0))); }
    if (wahl.bedingt.length) { k.push('<h3>'+h('Bedingt geeignet')+'</h3>'); k.push(...wahl.bedingt.slice(0, wahl.passend.length ? 2 : 4).map(r => karte(r, !wahl.passend.length))); }
    if (!wahl.passend.length && !wahl.bedingt.length) k.push('<p>'+h('Kein Katalogmodell erfüllt alle Muss-Kriterien. Die Anfrage lohnt trotzdem: Sonderausführungen und Werkzeugkonzepte klärt Hans Möhling direkt mit Jern Yao.')+'</p>');
    if (wahl.fast.length) { k.push('<details><summary>'+esc(msg('Knapp daneben ({count})',{count:Math.min(wahl.fast.length,4)}))+'</summary>' + wahl.fast.slice(0, 4).map(r => karte(r, false)).join('') + '</details>'); }
    rendered($('karten'),k.join(''));
    rendered($('regeln'),aus.regelListe.map(id => { const r = E.REGELN[id]; return r ? '<tr><td>' + esc(id) + '</td><td>' + h(r.t) + '<br><span class="klein">' + h(r.art) + '</span></td></tr>' : ''; }).join(''));
  }

  function knoepfe() {
    const ok = !!letzte && a.elements.ok.checked && /.+@.+\..+/.test(a.elements.email.value);
    $('senden').disabled = !ok;
    $('drucken').disabled = !letzte;
  }

  function zusammenfassung() {
    const { e, aus, wahl } = letzte, w = aus.werte, m = aus.werkstoff;
    const lines = [];
    const field = (label, value) => lines.push(tr(label).replace(/[:：]$/, '') + ': ' + value);
    const mm = value => value == null ? tr('nicht belegt') : fmt(value) + ' mm';
    const force = value => value == null ? tr('Kraft noch offen') : fmt(value) + ' t';
    field('Teileart', tr({ bolzen: 'Schraube/Bolzen', formteil: 'Formteil/Hülse', mutter: 'Mutter' }[e.typ]));
    field('Werkstoff', (m.sourceName || m.id) + (m.number ? ' · ' + m.number : ''));
    field('Drahtzugfestigkeit', m.Rm == null ? tr('nicht belegt') : fmt(m.Rm) + ' N/mm²');
    const variant=selectedVariant();
    if(variant){field('Lieferzustand',conditionLabel(variant.curve));field('Werkstoffmodell:',modelLabel(variant.curve)+' · '+variant.curve.id);field('Kurvenbereich',tr('Raumtemperatur')+' · φ '+fmt(variant.curve.phiMin,2)+'–'+fmt(variant.curve.phiMax,2));}
    else field('Werkstoffmodell:',tr('Fließkurve des Lieferzustands fehlt'));
    field('Abschnitt Ø × Länge', mm(w.d0) + ' × ' + mm(w.L0));
    field('Masse Fertigteil', fmt(w.masse) + ' g');
    if (e.typ === 'mutter') {
      field('Mutter', 'M' + fmt(w.mM)); field('Mutternschlüsselweite', mm(e.mSW)); field('Mutternhöhe', mm(e.mH));
      if (e.mFlansch) field('Flanschdurchmesser', mm(e.mFlansch));
    } else {
      field('Form', tr({rund:'rund, Zylinder- oder Flanschkopf',sechskant:'Sechskant, gestaucht',abgratet:'Sechskant, rund gestaucht und abgegratet'}[e.kopfForm] || e.kopfForm));
      field('Kopfdurchmesser', mm(e.kD)); field('Kopfhöhe', mm(e.kH));
      if (e.kSW) field('Kopfschlüsselweite', mm(e.kSW));
      field('Körperdurchmesser', mm(e.sD || e.d0)); field('Körperlänge', mm(e.sL));
      if(aus.antrieb){
        field('Innenantrieb',tr(aus.antrieb.label));
        if(e.iSW)field('Innenantrieb-Schlüsselweite',mm(e.iSW));
        field('Innenantriebstiefe',mm(e.iT));
        if(e.iVol)field('Volumen der Antriebsvertiefung',fmt(e.iVol)+' mm³');
      }
      if (e.nD) {field('Napfinnendurchmesser', mm(e.nD));field('Napftiefe', mm(e.nT));if(e.nDurch) lines.push(tr('durchgehend, gelocht'));}
    }
    field('Länge im Stempel', mm(w.lStempel)); field('Auswerfer Matrize (KO)', mm(w.ko)); field('Auswerfer Stempel (PKO)', mm(w.pko));
    if (e.wenden) lines.push(tr('Teil wird im Transfer um 180° gewendet'));
    const v=e.vorgaben;
    if(v.matD)field('Matrize Ø × L',mm(v.matD)+' × '+mm(v.matL));
    if(v.stD)field('Stempelaufnahme',mm(v.stD)+' × '+mm(v.stL));
    if(v.zusatz!=null&&isFinite(v.zusatz))field('Zusatzstufen',fmt(v.zusatz,0));
    if(e.soll.ausbringung)field('Ausbringung',fmt(e.soll.ausbringung,0)+' /min');
    lines.push('',tr('Grobauslegung'));
    field('Stationen',fmt(w.stationen,0)+' (+1 '+tr('Reserve')+')');
    field('Höchste Stationskraft',force(w.Fmax_t));field('Nennkraft nötig',force(w.FN_muss_t));
    aus.stufen.forEach((stage,index)=>lines.push('  '+(index+1)+'. '+tr(stage.v)+': '+force(stage.t)));
    lines.push('',tr('Vorauswahl:'));
    const top=[...wahl.passend.slice(0,3),...(wahl.passend.length?[]:wahl.bedingt.slice(0,3))];
    const status={ok:'passt',knapp:'knapp',offen:'Daten fehlen',nein:'passt nicht'};
    top.forEach(r=>lines.push('  '+r.o.m+' ('+tr(status[r.gesamt]||r.gesamt)+'), '+tr('Richtpreis')+' 2026 '+(r.o.rp?eur(r.o.rp):tr('auf Anfrage'))+', '+(r.ausl==null?tr('Kraft noch offen'):tr('Auslastung')+' '+fmt(r.ausl*100,0)+' %')+(r.plan?', '+tr('Planung')+' '+fmt(r.plan.aus,0)+' /min':'')));
    return lines.join('\n');
  }

  async function senden() {
    if (!letzte) return;
    const z = f.elements.zeichnung.files[0];
    const kopf = [tr('Name')+': '+a.elements.name.value,tr('Firma')+': '+a.elements.firma.value,tr('E-Mail')+': '+a.elements.email.value,tr('Telefon')+': '+a.elements.tel.value].join('\n');
    const text = kopf + '\n\n' + (a.elements.nachricht.value ? a.elements.nachricht.value + '\n\n' : '') + zusammenfassung() + (z ? '\n\n'+tr('Zeichnung:')+' '+z.name+' '+tr('(bitte anhängen)') : '');
    const betreff = (tr('Richtpreisanfrage')+' '+(((letzte.wahl.passend[0] || letzte.wahl.bedingt[0] || {}).o || {}).m || '')).trim();
    if (ENDPOINT) {
      const fd = new FormData();
      fd.append('betreff', betreff); fd.append('text', text); fd.append('eingaben', JSON.stringify(letzte.e)); fd.append('email', a.elements.email.value);
      if (z) fd.append('zeichnung', z, z.name);
      try {
        const r = await fetch(ENDPOINT, { method: 'POST', body: fd });
        if (r.ok) { $('sendehinweis').textContent = 'Danke. Die Anfrage ist angekommen; die Antwort kommt persönlich.'; return; }
      } catch (err) { /* Rückfall auf E-Mail */ }
    }
    location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(betreff) + '&body=' + encodeURIComponent(text.replace(/\n/g, '\r\n'));
  }

  function drucken() {
    if (!letzte) return;
    const b = $('blatt');
    b.dataset.originalText = ''; // This export is already localized once; preserve its numbers and identifiers.
    b.innerHTML = '<h1>'+esc(tr('Anforderungsblatt Mehrstufenpresse'))+'</h1><p>' + new Date().toLocaleDateString(window.JYI18N.numberLocale(L.language)) + ' · '+esc(tr('Grobauslegung, unverbindlich'))+' · info@jernyao.de</p><pre style="white-space:pre-wrap;font:inherit">' + esc(zusammenfassung()) + '</pre>';
    window.print();
  }

  const BSP = {
    m8: { typ: 'bolzen', d0: '8', kopfForm: 'rund', kD: '17', kH: '6', sD: '7,2', sL: '40' },
    m6: { typ: 'bolzen', d0: '5,6', kopfForm: 'rund', kD: '10', kH: '6', sD: '5,4', sL: '30', iTyp:'hex', iSize:'5', iT: '3' },
    mu: { typ: 'mutter', d0: '13', mM: '10', mSW: '16', mH: '8' },
    hu: { typ: 'formteil', d0: '16', kopfForm: 'rund', kD: '24', kH: '5', sD: '16', sL: '30', nD: '10', nT: '20', nDurch: true }
  };
  document.querySelectorAll('[data-bsp]').forEach(btn => btn.addEventListener('click', () => {
    f.reset(); a.elements.ok.checked = false;
    const d = {...BSP[btn.dataset.bsp]};d.wst=variants.find(variant=>variant.material.id==='C4C'&&variant.curve.state==='soft-annealed')?.value||'';
    f.elements.iTyp.value=d.iTyp||'none';antriebAuswahl();
    for (const [k, v] of Object.entries(d)) {
      const el = f.elements[k];
      if (k === 'typ') f.querySelector('input[name=typ][value=' + v + ']').checked = true;
      else if (el && el.type === 'checkbox') el.checked = !!v;
      else if (el) el.value = v;
    }
    rechnen();
    if (window.matchMedia('(max-width:900px)').matches) $('ergebnis').scrollIntoView({ behavior: 'smooth' });
  }));

  let t = null;
  f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(rechnen, 120); });
  f.addEventListener('change', rechnen);
  a.addEventListener('input', knoepfe); a.addEventListener('change', knoepfe);
  $('archive-choose-file').addEventListener('click',()=>f.elements.zeichnung.click());
  f.elements.zeichnung.addEventListener('change',()=>{$('archive-file-name').textContent=f.elements.zeichnung.files[0]?.name||'';});
  $('senden').addEventListener('click', senden);
  $('drucken').addEventListener('click', drucken);
  window.addEventListener('jy-languagechange',()=>{Array.from(sel.options).forEach(option=>{const variant=variantByValue.get(option.value);if(variant)option.textContent=materialLabel(variant);});sichtbar();rechnen();L.apply();});
  sichtbar(); rechnen(); L.apply();
})();
