/* Grobauslegung und Maschinenwahl Jern Yao, Rechenkern V1 (25.11.2026)
   Läuft im Browser und unter Node (Tests). Alle Längen in mm, Kräfte in kN und t, Massen in g.
   Jede Regel trägt eine Kennung aus REGELN; die Herkunft steht dort. */
(function (root) {
  'use strict';

  const G = 9.80665; // kN je t

  // Werkstoffe: C, n, rho typische Werte; Rm typische Zugfestigkeit des Drahtes vor der Presse.
  // grp: Werkstoffgruppe für Fließpressgrenzen (siehe GRENZEN)
  const WERKSTOFFE = [
    { id: 'C10C', Rm: 420, C: 740, n: 0.23, rho: 7.85, grp: 'gut', hinweis: 'Schrauben 4.8 bis 5.8' },
    { id: 'C15C', Rm: 470, C: 820, n: 0.21, rho: 7.85, grp: 'gut', hinweis: 'Festigkeitsklasse 6.8' },
    { id: '19MnB4', Rm: 540, C: 850, n: 0.18, rho: 7.85, grp: 'schwerer', hinweis: '8.8 nach Vergüten' },
    { id: '20MnB4', Rm: 560, C: 880, n: 0.17, rho: 7.85, grp: 'schwerer', hinweis: '8.8' },
    { id: '23MnB4', Rm: 600, C: 920, n: 0.16, rho: 7.85, grp: 'schwerer', hinweis: '8.8 bis 10.9' },
    { id: '33B2', Rm: 700, C: 990, n: 0.14, rho: 7.85, grp: 'schwerer', hinweis: '10.9' },
    { id: 'C45', Rm: 700, C: 1100, n: 0.15, rho: 7.85, grp: 'schwer', hinweis: 'begrenzt kaltumformbar' },
    { id: '1.4301 (A2)', Rm: 620, C: 1400, n: 0.45, rho: 7.90, grp: 'rostfrei', hinweis: 'starke Verfestigung' },
    { id: '1.4305 (A1)', Rm: 550, C: 1200, n: 0.40, rho: 7.90, grp: 'rostfrei', hinweis: 'Automatenstahl, austenitisch' },
    { id: '1.4571 (A4)', Rm: 580, C: 1350, n: 0.43, rho: 8.00, grp: 'rostfrei', hinweis: 'Mo-legiert' },
    { id: 'CuZn37', Rm: 320, C: 650, n: 0.36, rho: 8.45, grp: 'messing', hinweis: 'Messing' },
    { id: 'Cu-ETP', Rm: 220, C: 450, n: 0.45, rho: 8.94, grp: 'kupfer', hinweis: 'Kupfer' },
    { id: 'AlMg3', Rm: 220, C: 420, n: 0.28, rho: 2.66, grp: 'alu', hinweis: 'Aluminium' },
    { id: 'AlMgSi1', Rm: 300, C: 410, n: 0.18, rho: 2.70, grp: 'alu', hinweis: 'Aluminium, vorverfestigt' }
  ];

  // Fließpressgrenzen je Hub, jeweils der vorsichtigere von zwei Richtwerttafeln (Fundstellen in regeln.md)
  const GRENZEN = {
    gut:      { vor: 0.70, napfMin: 0.20, napfMax: 0.65, tiefe: 3,   q: 'R-FP1' },
    schwerer: { vor: 0.60, napfMin: 0.25, napfMax: 0.65, tiefe: 2,   q: 'R-FP1' },
    schwer:   { vor: 0.55, napfMin: 0.35, napfMax: 0.60, tiefe: 1.5, q: 'R-FP1' },
    rostfrei: { vor: 0.45, napfMin: 0.35, napfMax: 0.50, tiefe: 1.5, q: 'R-FP1' },
    messing:  { vor: 0.70, napfMin: 0.20, napfMax: 0.65, tiefe: 3,   q: 'R-FP1' },
    kupfer:   { vor: 0.80, napfMin: 0.30, napfMax: 0.75, tiefe: 4,   q: 'R-FP1' },
    alu:      { vor: 0.95, napfMin: 0.10, napfMax: 0.95, tiefe: 6,   q: 'R-FP1' }
  };

  // Regelwerk: Kennung, Aussage, Art. Öffentliche Kurzform; Fundstellen in regeln.md im Projektordner.
  const REGELN = {
    'R-VOL': { t: 'Volumenkonstanz: Abschnittvolumen = Teilvolumen + Abgang (Grat, Butzen)', art: 'Identität' },
    'R-AB1': { t: 'Abschnitt-Ø der Maschine bei Festigkeit Rm über 400 N/mm²: d_max = d_Katalog · √(400/Rm)', art: 'Erfahrungswert aus Betriebsdaten' },
    'R-AB2': { t: 'Abschnittlänge innerhalb des Katalogbereichs', art: 'Katalogwert' },
    'R-ST1': { t: 'Stauchverhältnis s = Kopfvolumen / (A₀ · d₀); 1 Schlag bis 2,3; 2 Schläge bis 4,5; 3 Schläge bis 8,0; darüber 4', art: 'Erfahrungsregel' },
    'R-ST2': { t: 'Kopf mit Innenantrieb: Vorstauchen auch unter s = 2,3', art: 'Erfahrungsregel' },
    'R-ST3': { t: 'Größter Stauch-Ø frei 2,0 bis 2,5 · d₀, geführt bis 3 · d₀; darüber Zwischenstufe', art: 'Erfahrungsregel' },
    'R-RE1': { t: 'Freies Reduzieren bis 30 % Querschnittsabnahme, sonst geschlossenes Vorwärtsfließpressen', art: 'Erfahrungsregel' },
    'R-FP1': { t: 'Querschnittsabnahme je Hub nach Werkstoffgruppe (Vorwärts) und Napfbereich mit Lochtiefe', art: 'Richtwerte je Werkstoffgruppe, jeweils der vorsichtigere' },
    'R-LO1': { t: 'Lochbutzen T = 0,5 · Loch-Ø (normal), bis 1,0 · Loch-Ø', art: 'Erfahrungsregel' },
    'R-KF':  { t: 'Fließkurve k_f = C · φⁿ, Anfangswert bei φ = 0,025', art: 'Näherungsmodell (Fließkurve nach Ludwik)' },
    'R-F1':  { t: 'Stauchkraft F = A₁ · k_f1 / η_F; η_F 0,6 im Fertigschlag, 0,8 im Vorstauchen', art: 'Näherungsmodell, η_F aus dem Bereich 0,6 bis 0,9' },
    'R-F2':  { t: 'Fließpresskraft F = A₀ · k_fm · φ / η_F mit η_F = 0,6', art: 'Näherungsmodell, η_F aus dem Bereich 0,4 bis 0,8' },
    'R-F3':  { t: 'Napf- und Innenantriebsstempel: p = k_f · (1 + φ + 2μ·h/d), μ = 0,1, k_f bei aufsummiertem Umformgrad', art: 'Näherungsmodell' },
    'R-F4':  { t: 'Abgraten und Lochen: F = Schnittlänge · Dicke · 0,8 · k_f', art: 'Näherungsmodell' },
    'R-PK':  { t: 'Presskraft: höchste Stationskraft bis 80 % der Nennkraft (muss), bis 65 % (wünschenswert)', art: 'Auslegungsvorgabe' },
    'R-STN': { t: 'Stationen: benötigte Stufen (muss), eine weitere als Vorformreserve (wünschenswert)', art: 'Auslegungsvorgabe' },
    'R-KO':  { t: 'Auswerferweg matrizenseitig ≥ Teillänge in der Matrize; bei 180°-Wendung gilt der Klammerwert', art: 'Katalogwert' },
    'R-PKO': { t: 'Auswerferweg stempelseitig ≥ Teillänge im Stempel', art: 'Katalogwert' },
    'R-MA':  { t: 'Matrize: Außen-Ø = 4,5 / 5 / 6 · größter Bohrungs-Ø (minimal, normal, ideal)', art: 'Erfahrungsregel Armierung, durch Katalogproportionen bestätigt' },
    'R-SB':  { t: 'Schneidbüchse: Bohrung 1,01 · d₀, Außen-Ø rund 3,3 · d₀', art: 'Werknorm, durch Katalogproportionen bestätigt' },
    'R-SP':  { t: 'Stempelaufnahme rund 2,3 · Kopf-Ø', art: 'Katalogproportion Jern Yao' },
    'R-OU':  { t: 'Kopf-Ø höchstens Stauch-Ø der Maschine', art: 'Katalogwert' },
    'R-PI':  { t: 'Pitch mindestens Matrizen-Außen-Ø', art: 'Geometrie' }
  };

  // Schlüsselweite → Gewinde nach ISO 4032 (Regelgewinde), nur als Vorbelegung
  const SW_M = [[5.5, 3], [7, 4], [8, 5], [10, 6], [13, 8], [16, 10], [18, 12], [21, 14], [24, 16], [27, 18], [30, 20], [34, 22], [36, 24], [41, 27], [46, 30], [50, 33], [55, 36], [60, 39], [65, 42]];
  const mAusSW = sw => { let b = SW_M[0]; for (const x of SW_M) if (Math.abs(x[0] - sw) < Math.abs(b[0] - sw)) b = x; return b[1]; };
  const ETA_FERTIG = 0.6, ETA_VOR = 0.8, ETA_FP = 0.6, MU = 0.1;
  const kf = (m, phi) => m.C * Math.pow(Math.max(phi, 0.025), m.n);
  const kfm = (m, a, b) => (kf(m, a + 0.025) + kf(m, b + 0.025)) / 2; // Mittel aus Anfangs- und Endwert der Fließspannung
  const kreis = d => Math.PI * d * d / 4;
  const sechskant = s => Math.sqrt(3) / 2 * s * s;
  const pos = x => typeof x === 'number' && isFinite(x) && x > 0;
  const r1 = x => Math.round(x * 10) / 10;
  const z = x => String(r1(x)).replace('.', ',');

  function napfDruck(m, phiVor, eps, h, d) {
    // eps: Flächenverhältnis Stempel/Matrize; phi der Wand
    const phi = Math.log(1 / (1 - eps));
    const k = kf(m, phiVor + phi);
    return k * (1 + phi + 2 * MU * h / d);
  }

  /* Eingaben:
     typ: 'bolzen' | 'mutter' | 'formteil'
     wst: Index in WERKSTOFFE; rm (optional, überschreibt)
     d0: Draht-Ø
     bolzen/formteil: kopfForm ('rund'|'sechskant'|'abgratet'), kD (Kopf/Bund-Ø), kSW (Schlüsselweite bei Sechskant), kH (Kopfhöhe),
       sD (Schaft-Ø), sL (Schaftlänge), iSW (Innenantrieb SW), iT (Innenantrieb Tiefe),
       nD (Napf/Bohrung Ø), nT (Napftiefe), nDurch (durchgehend)
     mutter: mSW, mH, mLoch (Loch-Ø), mFlansch (Ø oder 0), mFlanschH
     masse (g, optional, überschreibt Volumen für die Abschnittlänge)
     lStempel (Länge im Stempel, Werkzeugtrennkante), wenden (bool)
     vorgaben: { stationen, ko, pko, matD, matL, stD, stL }
     soll: { ausbringung }
  */
  function auslegen(e) {
    const out = { stufen: [], hinweise: [], fehlt: [], regeln: new Set(), werte: {} };
    const m = WERKSTOFFE[e.wst] || WERKSTOFFE[0];
    const Rm = pos(e.rm) ? e.rm : m.Rm;
    const gr = GRENZEN[m.grp];
    out.werkstoff = Object.assign({}, m, { Rm });
    const d0 = e.d0;
    if (!pos(d0)) { out.fehlt.push('Draht-Ø d₀'); return out; }
    const A0 = kreis(d0);
    const R = id => out.regeln.add(id);

    let V = 0, Vab = 0, Lteil = 0, Lstempel = 0, kopfD = 0, kopfH = 0, matBohrung = d0;
    let phiKopf = 0, sKopf = 0;

    if (e.typ === 'mutter') {
      if (!pos(e.mSW) || !pos(e.mH)) { out.fehlt.push('Schlüsselweite und Höhe der Mutter'); return out; }
      const M = pos(e.mM) ? e.mM : mAusSW(e.mSW);
      out.werte.mM = M;
      const dl = pos(e.mLoch) ? e.mLoch : 0.84 * M;
      if (!pos(e.mLoch)) out.hinweise.push('Loch-Ø nicht angegeben: angenommen 0,84 × M = ' + z(dl) + ' mm');
      const Ahex = sechskant(e.mSW), eck = e.mSW / Math.cos(Math.PI / 6);
      const flansch = pos(e.mFlansch) ? e.mFlansch : 0, fH = pos(e.mFlanschH) ? e.mFlanschH : 0;
      V = Ahex * (e.mH - fH) + (flansch ? kreis(flansch) * fH : 0) - kreis(dl) * e.mH;
      const T = 0.5 * dl; R('R-LO1');
      Vab = kreis(dl) * T;
      Lteil = e.mH; kopfD = Math.max(eck, flansch); matBohrung = kopfD;
      Lstempel = pos(e.lStempel) ? e.lStempel : 0; // Mutter: Stempelseite nur auf Vorgabe
      // Stufen
      const phi1 = 0.15, A1 = A0 * Math.exp(phi1);
      const A2 = kreis(0.95 * eck), phi2 = Math.log(A2 / A0);
      const phiHex = Math.log(Ahex / A0) + 0.3;
      const eps = Math.min(0.9, kreis(dl) / Ahex);
      const p4 = napfDruck(m, phiHex, Math.min(eps, 0.75), 0.35 * e.mH, dl);
      const phiEnd = phiHex + 0.5;
      out.stufen.push({ v: 'Planstauchen', F: A1 * kf(m, phi1) / ETA_VOR, bohr: d0, r: 'R-F1' });
      out.stufen.push({ v: 'Vorstauchen rund', F: A2 * kf(m, phi2) / ETA_VOR, bohr: 0.95 * eck, r: 'R-F1' });
      out.stufen.push({ v: 'Sechskant formen, beidseitig vorlochen', F: Ahex * kf(m, phiHex) / ETA_FERTIG, bohr: eck, r: 'R-F1' });
      out.stufen.push({ v: 'Napf vertiefen bis Butzen', F: kreis(dl) * p4, bohr: eck, r: 'R-F3' });
      if (flansch) out.stufen.push({ v: 'Flansch fertigformen', F: kreis(flansch) * kf(m, phiEnd) / ETA_FERTIG, bohr: flansch, r: 'R-F1' });
      out.stufen.push({ v: 'Lochen', F: Math.PI * dl * T * 0.8 * kf(m, phiEnd), bohr: eck, r: 'R-F4' });
      ['R-F1', 'R-F3', 'R-F4', 'R-KF'].forEach(R);
      out.werte.loch = dl;
    } else {
      // Bolzen und Formteile: Kopf/Bund + Schaft (+ Napf, Innenantrieb)
      const hatKopf = pos(e.kD) && pos(e.kH);
      const sD = pos(e.sD) ? e.sD : d0, sL = pos(e.sL) ? e.sL : 0;
      if (!hatKopf && !sL) { out.fehlt.push('Kopf (Ø und Höhe) oder Schaftlänge'); return out; }
      let Akopf = 0, kopfAbgr = 0;
      if (hatKopf) {
        kopfD = e.kD; kopfH = e.kH;
        if (e.kopfForm === 'sechskant' && pos(e.kSW)) { Akopf = sechskant(e.kSW); kopfD = e.kSW / Math.cos(Math.PI / 6); }
        else if (e.kopfForm === 'abgratet' && pos(e.kSW)) {
          const eck = e.kSW / Math.cos(Math.PI / 6);
          kopfD = Math.max(e.kD, eck); Akopf = kreis(kopfD);
          kopfAbgr = (kreis(kopfD) - sechskant(e.kSW)) * e.kH;
        } else Akopf = kreis(e.kD);
      }
      const Vkopf = Akopf * kopfH;
      const Vi = (pos(e.iSW) && pos(e.iT)) ? sechskant(e.iSW) * e.iT : 0;
      const Vn = (pos(e.nD) && pos(e.nT)) ? kreis(e.nD) * e.nT : 0;
      const Vs = kreis(sD) * sL;
      V = Vkopf - kopfAbgr + Vs - Vi - Vn; // Fertigteil
      Vab = kopfAbgr;
      let butzen = 0;
      if (Vn && e.nDurch) { butzen = 0.5 * e.nD; Vab += kreis(e.nD) * butzen; R('R-LO1'); }
      Lteil = kopfH + sL;
      Lstempel = pos(e.lStempel) ? e.lStempel : (e.typ === 'bolzen' ? kopfH : kopfH);
      R('R-KF');
      // Schaft gegenüber Draht
      let phiSchaft = 0;
      if (sL && sD < d0 * 0.995) {
        const eps = 1 - (sD / d0) ** 2; phiSchaft = Math.log(1 / (1 - eps));
        R('R-RE1'); R('R-FP1'); R('R-F2');
        const nFP = eps <= 0.30 ? 0 : Math.ceil(Math.log(1 / (1 - eps)) / Math.log(1 / (1 - gr.vor)) - 1e-9);
        if (eps <= 0.30) {
          out.stufen.push({ v: 'Reduzieren ' + z(d0) + ' → ' + z(sD) + ' (' + Math.round(eps * 100) + ' %), mit Vorstauchen', F: A0 * kfm(m, 0, phiSchaft) * phiSchaft / ETA_FP, bohr: d0, r: 'R-F2', mit: true });
        } else {
          for (let i = 1; i <= nFP; i++) {
            const a = phiSchaft * (i - 1) / nFP, b = phiSchaft * i / nFP;
            const dA = Math.sqrt(4 * A0 * Math.exp(-a) / Math.PI), dB = Math.sqrt(4 * A0 * Math.exp(-b) / Math.PI);
            out.stufen.push({ v: 'Vorwärtsfließpressen Schaft ' + z(dA) + ' → ' + z(dB) + ' (' + Math.round((1 - Math.exp(a - b)) * 100) + ' %)', F: kreis(dA) * kfm(m, a, b) * (b - a) / ETA_FP, bohr: dA, r: 'R-F2' });
          }
          if (nFP > 1) out.hinweise.push('Querschnittsabnahme ' + Math.round(eps * 100) + ' % über der Grenze je Hub für ' + m.id + ' (' + Math.round(gr.vor * 100) + ' %): auf ' + nFP + ' Hübe verteilt');
        }
      } else if (sL && sD > d0 * 1.005) {
        out.hinweise.push('Schaft-Ø größer als Draht-Ø: Schaft wird gestaucht, Matrizenbohrung = Schaft-Ø');
      }
      matBohrung = Math.max(d0, sD);
      // Kopf
      if (hatKopf) {
        R('R-ST1'); R('R-ST3'); R('R-F1');
        sKopf = (Vkopf) / (A0 * d0);
        phiKopf = Math.log(Akopf / A0);
        let n = sKopf <= 2.3 ? 1 : sKopf <= 4.5 ? 2 : sKopf <= 8.0 ? 3 : 4;
        if (Vi && n < 2) { n = 2; R('R-ST2'); }
        const dv = kopfD / d0;
        if (dv > 3.0) { n += 1; out.hinweise.push('Kopf-Ø ' + z(kopfD) + ' mm ist ' + dv.toFixed(1).replace('.', ',') + ' × d₀, über dem Richtwert 3 × d₀: eine Zwischenstufe eingeplant'); }
        else if (dv > 2.5) out.hinweise.push('Kopf-Ø über 2,5 × d₀: geführtes Stauchen nötig');
        if (sKopf > 8) out.hinweise.push('Stauchverhältnis ' + sKopf.toFixed(1).replace('.', ',') + ' über 8,0: Sonderfolge, Prüfung im Fachgespräch');
        for (let i = 1; i <= n; i++) {
          const ph = phiKopf * i / n, A = A0 * Math.exp(ph);
          const fertig = i === n;
          let F = A * kf(m, ph) / (fertig ? ETA_FERTIG : ETA_VOR);
          let txt = fertig ? (e.kopfForm === 'sechskant' ? 'Sechskantkopf fertigstauchen' : 'Kopf fertigstauchen') : (i === 1 ? 'Vorstauchen' : 'Zwischenstauchen');
          if (fertig && Vi) {
            const epsI = sechskant(e.iSW) / Akopf;
            const p = napfDruck(m, phiKopf, Math.min(Math.max(epsI, 0.05), 0.9), e.iT, e.iSW);
            F += sechskant(e.iSW) * p; txt += ' mit Innenantrieb'; R('R-F3');
            if (e.iT > 2 * e.iSW) out.hinweise.push('Innenantrieb tiefer als 2 × SW: Vorformen im vorigen Schlag nötig');
          }
          out.stufen.push({ v: txt, F, bohr: matBohrung, kopf: Math.sqrt(4 * A / Math.PI), r: 'R-F1' });
        }
        if (kopfAbgr) {
          const U = 6 * e.kSW / Math.sqrt(3);
          out.stufen.push({ v: 'Sechskant abgraten', F: U * kopfH * 0.8 * kf(m, phiKopf), bohr: matBohrung, r: 'R-F4' }); R('R-F4');
        }
      }
      // Napf
      if (Vn) {
        R('R-FP1'); R('R-F3');
        const Dw = hatKopf && e.nT <= kopfH ? kopfD : Math.max(sD, d0);
        const eps = kreis(e.nD) / kreis(Dw);
        if (eps < gr.napfMin) out.hinweise.push('Napf: Querschnittsabnahme ' + Math.round(eps * 100) + ' % unter ' + Math.round(gr.napfMin * 100) + ' %: Stempel stark belastet');
        if (eps > gr.napfMax) out.hinweise.push('Napf: Querschnittsabnahme ' + Math.round(eps * 100) + ' % über ' + Math.round(gr.napfMax * 100) + ' %: Wand zu dünn für einen Hub');
        const tiefeJeHub = gr.tiefe * e.nD;
        const nN = Math.max(1, Math.ceil(e.nT / tiefeJeHub - 1e-9));
        for (let i = 1; i <= nN; i++) {
          const p = napfDruck(m, phiKopf || phiSchaft, Math.min(Math.max(eps, 0.05), 0.9), e.nT * i / nN, e.nD);
          out.stufen.push({ v: 'Napf rückwärts fließpressen' + (nN > 1 ? ' (' + i + '/' + nN + ')' : '') + ' Ø' + z(e.nD) + ' × ' + z(e.nT * i / nN), F: kreis(e.nD) * p, bohr: Dw, r: 'R-F3' });
        }
        if (e.nDurch) {
          out.stufen.push({ v: 'Lochen Ø' + z(e.nD), F: Math.PI * e.nD * butzen * 0.8 * kf(m, Math.max(phiKopf, phiSchaft) + 0.7), bohr: Dw, r: 'R-F4' }); R('R-F4');
        }
        matBohrung = Math.max(matBohrung, Dw);
      }
      if (e.typ === 'formteil') out.stufen.unshift({ v: 'Planstauchen, Abschnitt richten', F: A0 * Math.exp(0.1) * kf(m, 0.1) / ETA_VOR, bohr: d0, r: 'R-F1' });
    }

    // Abschnitt
    R('R-VOL');
    let Vab0 = V + Vab;
    if (pos(e.masse)) { Vab0 = e.masse / m.rho * 1000 + Vab; out.hinweise.push('Abschnitt aus der angegebenen Masse gerechnet'); }
    const L0 = Vab0 / A0;
    out.werte.V = V; out.werte.Vabgang = Vab; out.werte.L0 = L0; out.werte.masse = V * m.rho / 1000; out.werte.d0 = d0;
    out.werte.sKopf = sKopf; out.werte.phiKopf = phiKopf; out.werte.kopfD = kopfD; out.werte.Lteil = Lteil;

    // Stationen: Reduzieren bis 30 % läuft im Vorstauchschlag mit
    const stufenZaehlend = out.stufen.filter(s => !s.mit);
    const nStufen = stufenZaehlend.length;
    R('R-STN');
    out.werte.stationen = pos(e.vorgaben && e.vorgaben.stationen) ? e.vorgaben.stationen : nStufen;
    out.werte.stationenReserve = out.werte.stationen + 1;
    // Kräfte
    out.stufen.forEach(s => { s.t = s.F / 1000 / G; });
    // Reduzieren-mit-Vorstauchen: Kraft zum ersten Stauchschlag addieren
    for (let i = 0; i < out.stufen.length; i++) {
      if (out.stufen[i].mit && out.stufen[i + 1]) { out.stufen[i + 1].F += out.stufen[i].F; out.stufen[i + 1].t = out.stufen[i + 1].F / 1000 / G; out.stufen[i + 1].v = out.stufen[i].v.replace(', mit Vorstauchen', '') + ' und ' + out.stufen[i + 1].v; out.stufen.splice(i, 1); i--; }
    }
    const Fmax = Math.max(...out.stufen.map(s => s.F));
    const Fsum = out.stufen.reduce((a, s) => a + s.F, 0);
    R('R-PK');
    out.werte.Fmax_t = Fmax / 1000 / G; out.werte.Fsum_t = Fsum / 1000 / G;
    out.werte.FN_muss_t = out.werte.Fmax_t / 0.80; out.werte.FN_wunsch_t = out.werte.Fmax_t / 0.65;

    // Werkzeuge
    R('R-MA'); R('R-SB'); R('R-PI'); R('R-KO'); R('R-PKO');
    const v = e.vorgaben || {};
    const Lmatrize = Math.max(0, Lteil - Lstempel);
    out.werte.lStempel = Lstempel; out.werte.lMatrize = Lmatrize;
    out.werte.ko = pos(v.ko) ? v.ko : Lmatrize;
    out.werte.pko = (v.pko === 0 || pos(v.pko)) ? v.pko : Lstempel;
    out.werte.koVorgabe = pos(v.ko); out.werte.pkoVorgabe = (v.pko === 0 || pos(v.pko));
    out.werte.matBohrung = matBohrung;
    out.werte.matD = { min: 4.5 * matBohrung, normal: 5 * matBohrung, ideal: 6 * matBohrung };
    out.werte.matL = Lmatrize + 15;
    out.werte.stempelD = kopfD ? 2.3 * kopfD : null; if (kopfD) R('R-SP');
    out.werte.buechse = { bohrung: 1.01 * d0, aussen: 3.3 * d0 };
    out.werte.pitch = out.werte.matD.min;
    out.werte.wenden = !!e.wenden;
    out.werte.vorgaben = v;
    out.stufen.forEach(s => { s.matD = 4.5 * (s.bohr || matBohrung); });
    out.regelListe = [...out.regeln];
    return out;
  }

  // Maschinenprüfung. Status: 'ok' | 'knapp' | 'nein' | 'offen'
  const FAMILIEN = {
    bolzen: ['JBF', 'JBP', 'JNP'],
    formteil: ['JBF', 'JBP', 'JNP', 'JPF'],
    mutter: ['JNF', 'JNFR', 'JNFP', 'JPF']
  };

  function pruefe(o, a, e) {
    const w = a.werte, k = [];
    const add = (krit, status, soll, ist, r) => k.push({ krit, status, soll, ist, r });
    const Rm = a.werkstoff.Rm;
    // Stationen
    add('Stationen', o.st >= w.stationenReserve ? 'ok' : o.st >= w.stationen ? 'knapp' : 'nein', w.stationen + ' (+1 Reserve)', o.st, 'R-STN');
    // Abschnitt-Ø
    const dMax = o.cd * Math.sqrt(400 / Math.max(Rm, 400));
    add('Abschnitt-Ø', w.d0 <= dMax ? (w.d0 <= 0.95 * dMax ? 'ok' : 'knapp') : 'nein', z(w.d0) + ' mm', z(dMax) + ' mm bei ' + Rm + ' N/mm²', 'R-AB1');
    // Abschnittlänge
    if (o.cl) {
      const [lo, hi] = o.cl;
      const st = (hi && w.L0 > hi) || (lo && w.L0 < lo) ? 'nein' : 'ok';
      add('Abschnittlänge', st, z(w.L0) + ' mm', (lo ? lo + ' bis ' : 'bis ') + hi + ' mm', 'R-AB2');
    } else add('Abschnittlänge', 'offen', z(w.L0) + ' mm', 'nicht im Katalog', 'R-AB2');
    // Auswerfer matrizenseitig
    const koMax = w.wenden && o.kor ? o.kor : o.ko;
    if (pos(koMax)) add('Auswerfer Matrize (KO)', w.ko <= koMax ? (w.ko <= 0.95 * koMax ? 'ok' : 'knapp') : 'nein', z(w.ko) + ' mm', koMax + ' mm' + (w.wenden && o.kor ? ' (Wendung)' : ''), 'R-KO');
    else add('Auswerfer Matrize (KO)', 'offen', z(w.ko) + ' mm', 'nicht im Katalog', 'R-KO');
    // Auswerfer stempelseitig
    if (w.pko > 0) {
      if (pos(o.pko)) add('Auswerfer Stempel (PKO)', w.pko <= o.pko ? (w.pko <= 0.95 * o.pko ? 'ok' : 'knapp') : 'nein', z(w.pko) + ' mm', o.pko + ' mm', 'R-PKO');
      else add('Auswerfer Stempel (PKO)', 'offen', z(w.pko) + ' mm', 'nicht im Katalog', 'R-PKO');
    } else add('Auswerfer Stempel (PKO)', 'ok', 'nicht nötig', pos(o.pko) ? o.pko + ' mm' : 'nicht im Katalog', 'R-PKO');
    // Presskraft
    const ausl = w.Fmax_t / o.pw;
    add('Presskraft', ausl <= 0.65 ? 'ok' : ausl <= 0.80 ? 'knapp' : 'nein', z(w.Fmax_t) + ' t höchste Station', o.pw + ' t, Auslastung ' + Math.round(ausl * 100) + ' %', 'R-PK');
    // Matrize
    if (o.die) {
      const vg = w.vorgaben || {};
      if (pos(vg.matD)) {
        const st = o.die[0] === vg.matD ? 'ok' : o.die[0] > vg.matD ? 'knapp' : 'nein';
        add('Matrizenaufnahme', st === 'nein' || (pos(vg.matL) && vg.matL > o.die[1]) ? 'nein' : st, 'Ø' + vg.matD + (pos(vg.matL) ? ' × ' + vg.matL : '') + ' (Vorgabe)', 'Ø' + o.die[0] + ' × ' + o.die[1] + (st === 'knapp' ? ', mit Adapterhülse' : ''), 'R-MA');
      } else if (e.typ === 'mutter') {
        add('Matrizenaufnahme', 'ok', 'Mutternwerkzeug', 'Ø' + o.die[0] + ' × ' + o.die[1], 'R-MA');
      } else {
        const ratio = o.die[0] / w.matBohrung;
        const st = ratio >= 5 ? 'ok' : ratio >= 4.5 ? 'knapp' : ratio >= 4.0 ? 'knapp' : 'nein';
        const lst = o.die[1] >= w.matL ? st : (st === 'nein' ? 'nein' : 'knapp');
        add('Matrizenaufnahme', lst, 'Ø' + Math.round(w.matD.min) + ' bis ' + Math.round(w.matD.ideal) + ' × ' + Math.round(w.matL), 'Ø' + o.die[0] + ' × ' + o.die[1] + ' (' + ratio.toFixed(1).replace('.', ',') + ' × Bohrung)', 'R-MA');
      }
    }
    // Stempel
    if (o.pun) {
      const vg = w.vorgaben || {};
      if (pos(vg.stD)) {
        const st = o.pun[0] === vg.stD ? 'ok' : o.pun[0] > vg.stD ? 'knapp' : 'nein';
        add('Stempelaufnahme', st === 'nein' || (pos(vg.stL) && vg.stL > o.pun[1]) ? 'nein' : st, 'Ø' + vg.stD + (pos(vg.stL) ? ' × ' + vg.stL : '') + ' (Vorgabe)', 'Ø' + o.pun[0] + ' × ' + o.pun[1] + (st === 'knapp' ? ', mit Adapterhülse' : ''), 'R-SP');
      } else if (w.stempelD && e.typ !== 'mutter') {
        add('Stempelaufnahme', o.pun[0] >= w.stempelD ? 'ok' : o.pun[0] >= 0.9 * w.stempelD ? 'knapp' : 'nein', 'Ø' + Math.round(w.stempelD), 'Ø' + o.pun[0] + ' × ' + o.pun[1], 'R-SP');
      }
    }
    // Stauch-Ø
    if (w.kopfD && e.typ !== 'mutter') {
      if (pos(o.ou)) add('Stauch-Ø', w.kopfD <= o.ou ? 'ok' : 'nein', z(w.kopfD) + ' mm', o.ou + ' mm', 'R-OU');
    }
    // Mutterngröße gegen Produktbereich des Katalogs
    if (e.typ === 'mutter' && w.mM) {
      const mk = o.sz && /^M(\d+(?:\.\d+)?)$/.exec(o.sz);
      if (mk) add('Mutterngröße', w.mM <= +mk[1] ? 'ok' : 'nein', 'M' + w.mM, 'bis ' + o.sz, 'Katalog');
      else add('Mutterngröße', 'offen', 'M' + w.mM, o.size || 'nicht im Katalog', 'Katalog');
    }
    // Schaftlänge bei Bolzenpressen
    if (e.typ === 'bolzen' && pos(o.ml) && pos(e.sL)) add('Teillänge unter Kopf', e.sL <= o.ml ? 'ok' : 'nein', z(e.sL) + ' mm', 'bis ' + o.ml + ' mm', 'Katalog');
    // Ausbringung
    if (e.soll && pos(e.soll.ausbringung) && pos(o.out)) add('Ausbringung', e.soll.ausbringung <= o.out ? 'ok' : 'nein', e.soll.ausbringung + ' /min', 'bis ' + o.out + ' /min', 'Katalog');
    // Schneidbüchse (Nebenwert)
    if (o.q) add('Schneidbüchse', o.q[0] >= w.buechse.aussen ? 'ok' : 'knapp', 'Ø' + z(w.buechse.aussen), 'Ø' + o.q[0] + ' × ' + o.q[1], 'R-SB', true);
    if (pos(o.pi) && e.typ !== 'mutter') add('Pitch', o.pi >= w.pitch ? 'ok' : 'knapp', 'ab ' + Math.round(w.pitch) + ' mm', o.pi + ' mm', 'R-PI', true);
    const rang = { nein: 3, offen: 2, knapp: 1, ok: 0 };
    const haupt = k.filter(x => !['Schneidbüchse', 'Pitch'].includes(x.krit));
    const schlecht = Math.max(...haupt.map(x => rang[x.status]));
    return { k, gesamt: ['ok', 'knapp', 'offen', 'nein'][schlecht], ausl };
  }

  function waehle(maschinen, a, e) {
    const fam = FAMILIEN[e.typ] || FAMILIEN.bolzen;
    const res = maschinen.filter(o => fam.includes(o.f)).map(o => Object.assign({ o }, pruefe(o, a, e)));
    const ord = { ok: 0, knapp: 1, offen: 2, nein: 3 };
    const preis = r => r.o.rp || 9e9;
    res.sort((x, y) => (ord[x.gesamt] - ord[y.gesamt]) || (preis(x) - preis(y)));
    const passend = res.filter(r => r.gesamt === 'ok');
    const bedingt = res.filter(r => r.gesamt === 'knapp' || r.gesamt === 'offen');
    // Fast passend: genau ein Kriterium «nein»
    const fast = res.filter(r => r.gesamt === 'nein' && r.k.filter(x => x.status === 'nein').length === 1);
    return { passend, bedingt, fast, alle: res };
  }

  const API = { WERKSTOFFE, GRENZEN, REGELN, FAMILIEN, auslegen, pruefe, waehle, kf, G };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.JYK = API;
})(typeof window !== 'undefined' ? window : this);
