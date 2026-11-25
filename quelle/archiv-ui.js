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
  const eur = x => x ? x.toLocaleString(window.JYI18N.numberLocale(L.language)) + ' €' : 'auf Anfrage';
  const num = v => { if (v == null) return undefined; const s = String(v).trim().replace(/\s/g, '').replace(',', '.'); if (!s) return undefined; const n = Number(s); return isFinite(n) ? n : NaN; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Werkstoffliste
  const sel = f.elements.wst;
  E.WERKSTOFFE.forEach((w, i) => { const o = document.createElement('option'); o.value = i; o.textContent = (w.sourceName || w.id) + (w.number ? ' · '+w.number : '') + ' · ' + tr(w.hinweis || (w.curveStatus==='missing'?'Fließkurve des Lieferzustands fehlt':'Näherungsmodell'));  sel.appendChild(o); });
  sel.value = Math.max(0,E.WERKSTOFFE.findIndex(w=>w.id==='23MnB4')); // stable grade identity

  function typ() { return f.elements.typ.value; }
  function sichtbar() {
    const t = typ();
    f.querySelectorAll('[data-fuer]').forEach(el => { el.hidden = !el.dataset.fuer.split(' ').includes(t); });
    const k = f.elements.kopfForm.value;
    f.querySelectorAll('[data-kopf]').forEach(el => { el.hidden = !el.dataset.kopf.split(' ').includes(k); });
    f.elements.rm.placeholder = E.WERKSTOFFE[+sel.value].Rm==null?tr('nicht belegt'):E.WERKSTOFFE[+sel.value].Rm+' '+tr('typisch');
  }

  function lesen() {
    const g = n => num(f.elements[n] && f.elements[n].value);
    const e = {
      typ: typ(), wst: +sel.value, rm: g('rm'), d0: g('d0'),
      kopfForm: f.elements.kopfForm.value, kD: g('kD'), kSW: g('kSW'), kH: g('kH'), sD: g('sD'), sL: g('sL'),
      iSW: g('iSW'), iT: g('iT'), nD: g('nD'), nT: g('nT'), nDurch: f.elements.nDurch.checked,
      mM: g('mM'), mSW: g('mSW'), mH: g('mH'), mLoch: g('mLoch'), mFlansch: g('mFlansch'), mFlanschH: g('mFlanschH'),
      masse: g('masse'), lStempel: g('lStempel'), wenden: f.elements.wenden.checked,
      vorgaben: { ko: g('ko'), pko: g('pko'), matD: g('matD'), matL: g('matL'), stD: g('stD'), stL: g('stL'), stationen: g('stationen'), zusatz: g('zusatz') },
      soll: { ausbringung: g('ausbringung') }
    };
    if (e.typ !== 'bolzen') { e.iSW = e.iT = undefined; }
    if (e.typ !== 'formteil') { e.nD = e.nT = undefined; e.nDurch = false; }
    return e;
  }

  function ungueltig() {
    let bad = false;
    f.querySelectorAll('input[inputmode]').forEach(el => {
      const v = num(el.value);
      const falsch = el.value.trim() !== '' && (!isFinite(v) || v < 0);
      el.style.borderColor = falsch ? 'var(--nein)' : '';
      el.title = falsch ? 'Bitte eine Zahl eingeben, z. B. 12,5' : '';
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
    if (aus.fehlt.length || !aus.stufen.length) { $('leer').hidden = false; $('aus').hidden = true; $('leer').textContent = aus.fehlt.length ? 'Es fehlen noch: ' + aus.fehlt.join(', ') + '.' : 'Mit Draht-Ø und den Hüllmaßen des Teils erscheinen hier Stadienfolge, Werkzeuggröße und die passenden Modelle.'; letzte = null; knoepfe(); return; }
    const wahl = E.waehle(MASCHINEN, aus, e, PRAXIS);
    letzte = { e, aus, wahl };
    zeigen(e, aus, wahl); L.apply();
    knoepfe();
  }

  function zeigen(e, aus, wahl) {
    const w = aus.werte;
    const basis=document.getElementById('material-basis');if(basis)basis.textContent=(aus.werkstoff.sourceName||aus.werkstoff.id)+' · '+tr(aus.werkstoff.curveStatus==='missing'?'Fließkurve des Lieferzustands fehlt':'Näherungsmodell');
    $('leer').hidden = true; $('aus').hidden = false;
    // Platzhalter der Werkzeugfelder
    f.elements.lStempel.placeholder = fmt(w.lStempel) + ' berechnet';
    f.elements.ko.placeholder = fmt(w.lMatrize) + ' berechnet';
    f.elements.pko.placeholder = fmt(w.lStempel) + ' berechnet';
    f.elements.stationen.placeholder = String(aus.stufen.length);
    f.elements.zusatz.placeholder = String(w.zusatzStandard) + (w.zusatzStandard ? ' (Kalibrieren, Hohlteil)' : '');
    const kenn = [
      ['Abschnitt', 'Ø' + fmt(w.d0) + ' × ' + fmt(w.L0) + ' mm'],
      ['Masse Fertigteil', fmt(w.masse) + ' g'],
      ['Stationen', w.stationen + ' <small>+1 Reserve</small>'],
      ['Höchste Stationskraft', w.Fmax_t==null?'Kraft noch offen':fmt(w.Fmax_t) + ' t'],
      ['Nennkraft nötig', w.FN_muss_t==null?'Kraft noch offen':fmt(w.FN_muss_t, 0) + ' t <small>wünschenswert ' + fmt(w.FN_wunsch_t, 0) + ' t</small>'],
      ['Summe aller Stationen', w.Fsum_t==null?'Kraft noch offen':fmt(w.Fsum_t) + ' t'],
      ['Auswerfer Matrize (KO)', fmt(w.ko) + ' mm' + (w.koVorgabe ? ' <small>Vorgabe</small>' : '')],
      ['Auswerfer Stempel (PKO)', (w.pko > 0 ? fmt(w.pko) + ' mm' : 'nicht nötig') + (w.pkoVorgabe ? ' <small>Vorgabe</small>' : '')],
      ['Matrize Ø × L', rounded(w.matD.min) + ' bis ' + rounded(w.matD.ideal) + ' × ' + rounded(w.matL) + ' mm' + (e.typ !== 'mutter' ? ' <small>Pitch ab ' + rounded(w.pitch) + '</small>' : '')],
      ['Stempelaufnahme', w.stempelD ? 'Ø' + rounded(w.stempelD) + ' mm' : '·'],
      ['Schneidbüchse', 'Bohrung ' + fmt(w.buechse.bohrung, 2) + ' <small>außen Ø' + rounded(w.buechse.aussen) + '</small>']
    ];
    if (e.typ !== 'mutter') kenn.splice(3, 0, ['Stauchverhältnis Kopf', w.sKopf ? fmt(w.sKopf, 2) : '·']);
    $('kenn').innerHTML = kenn.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
    $('hinweise').innerHTML = aus.hinweise.map(h => '<li>' + esc(h) + '</li>').join('');
    $('stufen').tBodies[0].innerHTML = aus.stufen.map((s, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(s.v) + '</td><td class="z">' + (s.t==null?'Kraft noch offen':fmt(s.t)+' t') + '</td><td class="z">' + (s.p==null?tr('nicht belegt'):fmt(s.p,0)) + '</td><td class="z">Ø' + (s.matD==null?'nicht belegt':rounded(s.matD)) + (s.arm ? '<br><small>' + s.arm + '</small>' : '') + '</td></tr>').join('');
    // Karten
    const k = [];
    const karte = (r, beste) => {
      const o = r.o, sp = (o.lo && o.hi) ? eur(o.lo) + ' bis ' + eur(o.hi) : '';
      const farbe = r.ausl==null?'var(--offen)':r.ausl <= 0.65 ? 'var(--ok)' : r.ausl <= 0.8 ? 'var(--knapp)' : 'var(--nein)';
      const marke = { ok: 'passt', knapp: 'knapp', offen: 'Daten fehlen', nein: 'passt nicht' }[r.gesamt];
      const zeilen = r.k.map(x => '<tr><td>' + esc(x.krit) + '</td><td>' + esc(x.soll) + '</td><td>' + esc(x.ist) + '</td><td><span class="st m-' + x.status + '">' + { ok: 'ok', knapp: 'knapp', nein: 'nein', offen: 'offen' }[x.status] + '</span></td></tr>').join('');
      const kat = o.kat ? '<a href="' + KATURL + o.kat + '.pdf#page=' + (o.s || 1) + '" target="_blank" rel="noopener">Katalog ' + o.kat + ', S. ' + (o.s || 1) + '</a>' : '';
      return '<div class="karte' + (beste ? ' beste' : '') + '"><div class="kopfzeile"><div><span class="modell">' + o.m + '</span><span class="marke m-' + r.gesamt + '">' + marke + '</span><div class="fam">' + (FAMNAME[o.f] || o.f) + ' · ' + o.st + ' Stationen · ' + o.pw + ' t' + (o.sz ? ' · bis ' + o.sz : '') + '</div></div>' +
        '<div class="preis"><b>' + eur(o.rp) + '</b><small>' + sp + '</small></div></div>' +
        (r.ausl==null?'':'<div class="balken" title="Auslastung der Nennkraft, Strich bei 65 %"><i style="width:' + Math.min(100, rounded(r.ausl * 100)) + '%;background:' + farbe + '"></i></div>') +
        '<div class="kurz"><span>'+(r.ausl==null?'Kraft noch offen':'Auslastung '+rounded(r.ausl*100)+' %')+'</span><span>Abschnitt bis Ø' + o.cd + '</span><span>KO ' + (o.ko || '·') + (o.kor ? ' (' + o.kor + ')' : '') + '</span><span>PKO ' + (o.pko || '·') + '</span><span>Matrize Ø' + (o.die ? o.die[0] + ' × ' + o.die[1] : '·') + '</span>' + (o.wt ? '<span>rund ' + fmt(o.wt) + ' t, Motor ' + fmt(o.hp==null?null:o.hp*0.7457,0) + ' kW</span>' : '') + (r.plan ? '<span title="Erfahrungswert aus der Serienfertigung; der Katalog nennt die Höchstdrehzahl">Planung ≈ ' + r.plan.aus + ' /min, rund ' + r.stundeProStk.toLocaleString(window.JYI18N.numberLocale(L.language)) + ' Stück/h (Katalog bis ' + o.out + ')</span>' : (o.out ? '<span>bis ' + o.out + ' /min</span>' : '')) + '</div>' +
        (E.maschinenKonzept?window.JYConcept.html(E.maschinenKonzept(aus,e,o,PRAXIS),L.language):'')+'<details><summary>Prüfung im Einzelnen</summary><table class="krit"><thead><tr><th>Kriterium</th><th>Bedarf</th><th>Maschine</th><th></th></tr></thead><tbody>' + zeilen + '</tbody></table><p class="klein">' + kat + '</p></details></div>';
    };
    if (wahl.passend.length) { k.push(...wahl.passend.slice(0, 3).map((r, i) => karte(r, i === 0))); }
    if (wahl.bedingt.length) { k.push('<h3>Bedingt geeignet</h3>'); k.push(...wahl.bedingt.slice(0, wahl.passend.length ? 2 : 4).map(r => karte(r, !wahl.passend.length))); }
    if (!wahl.passend.length && !wahl.bedingt.length) k.push('<p>Kein Katalogmodell erfüllt alle Muss-Kriterien. Die Anfrage lohnt trotzdem: Sonderausführungen und Werkzeugkonzepte klärt Hans Möhling direkt mit Jern Yao.</p>');
    if (wahl.fast.length) { k.push('<details><summary>Knapp daneben (' + Math.min(wahl.fast.length, 4) + ')</summary>' + wahl.fast.slice(0, 4).map(r => karte(r, false)).join('') + '</details>'); }
    $('karten').innerHTML = k.join('');
    $('regeln').innerHTML = aus.regelListe.map(id => { const r = E.REGELN[id]; return r ? '<tr><td>' + id + '</td><td>' + esc(r.t) + '<br><span class="klein">' + esc(r.art) + '</span></td></tr>' : ''; }).join('');
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
    field('Werkstoffmodell:', tr(m.curveStatus === 'missing' ? 'Fließkurve des Lieferzustands fehlt' : 'Näherungsmodell'));
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
      if (e.iSW) {field('Innenantrieb-Schlüsselweite', mm(e.iSW));field('Innenantriebstiefe', mm(e.iT));}
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
    m8: { typ: 'bolzen', wst: '4', d0: '7,6', kopfForm: 'rund', kD: '17', kH: '6', sD: '7,2', sL: '40' },
    m6: { typ: 'bolzen', wst: '5', d0: '5,6', kopfForm: 'rund', kD: '10', kH: '6', sD: '5,4', sL: '30', iSW: '5', iT: '3' },
    mu: { typ: 'mutter', wst: '0', d0: '13', mM: '10', mSW: '16', mH: '8' },
    hu: { typ: 'formteil', wst: '1', d0: '16', kopfForm: 'rund', kD: '24', kH: '5', sD: '16', sL: '30', nD: '10', nT: '20', nDurch: true }
  };
  document.querySelectorAll('[data-bsp]').forEach(btn => btn.addEventListener('click', () => {
    f.reset(); a.elements.ok.checked = false;
    const d = {...BSP[btn.dataset.bsp]};const grades={m8:'23MnB4',m6:'33B2',mu:'C10C',hu:'C15C'};d.wst=String(Math.max(0,E.WERKSTOFFE.findIndex(w=>w.id===grades[btn.dataset.bsp])));
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
  window.addEventListener('jy-languagechange',()=>{Array.from(sel.options).forEach((o,i)=>{const w=E.WERKSTOFFE[i];o.textContent=(w.sourceName||w.id)+(w.number?' · '+w.number:'')+' · '+tr(w.hinweis||'');});sichtbar();rechnen();L.apply();});
  sichtbar(); rechnen(); L.apply();
})();
