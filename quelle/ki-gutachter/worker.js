/* KI-Gutachter für den Konfigurator (Cloudflare Worker).
   POST /anfrage   nimmt Anfrage und Zeichnung an, antwortet sofort und arbeitet im Hintergrund:
                   Claude liest die Zeichnung, rechnet mit dem Rechenkern (Werkzeug grobauslegung) und schreibt
                   Gutachten und Kundentext. Beides geht als Entwurf an Hans Möhling, nie direkt an den Kunden.
   GET  /freigabe  zeigt den Entwurf mit Knopf; POST /freigabe sendet den Kundentext ab.
   Wissen und Regeln liegen im KV-Speicher (Schlüssel «wissenskarten», «regeln»), nicht im Code. */
import ENGINE from '../engine.js';
import MASCHINEN from '../maschinen.json';

const E = ENGINE || globalThis.JYK;
const HERKUNFT = ['https://jern-yao.de', 'https://jernyao.de', 'https://www.jernyao.de'];
const TYPEN = { 'application/pdf': 'document', 'image/png': 'image', 'image/jpeg': 'image', 'image/webp': 'image', 'image/gif': 'image' };
const MAX_BYTES = 15 * 1024 * 1024;

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': HERKUNFT.includes(origin) ? origin : HERKUNFT[0], 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/anfrage' && req.method === 'POST') return anfrage(req, env, ctx, cors);
    if (url.pathname === '/freigabe') return freigabe(req, url, env);
    return new Response('Nicht gefunden', { status: 404 });
  }
};

async function anfrage(req, env, ctx, cors) {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  let fd;
  try { fd = await req.formData(); } catch { return json({ ok: false, fehler: 'Formular unlesbar' }, 400); }
  const email = String(fd.get('email') || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, fehler: 'E-Mail fehlt' }, 400);
  const datei = fd.get('zeichnung');
  if (datei && typeof datei === 'object' && datei.size > MAX_BYTES) return json({ ok: false, fehler: 'Zeichnung über 15 MB' }, 413);
  // einfache Bremse: 10 Anfragen je Adresse und Tag
  const ip = req.headers.get('CF-Connecting-IP') || 'unbekannt';
  const rl = 'rl:' + ip + ':' + new Date().toISOString().slice(0, 10);
  const n = +(await env.SPEICHER.get(rl) || 0);
  if (n >= 10) return json({ ok: false, fehler: 'Zu viele Anfragen heute' }, 429);
  await env.SPEICHER.put(rl, String(n + 1), { expirationTtl: 86400 });
  const anf = {
    id: crypto.randomUUID(), zeit: new Date().toISOString(), email,
    betreff: String(fd.get('betreff') || 'Richtpreisanfrage').slice(0, 200),
    text: String(fd.get('text') || '').slice(0, 20000),
    eingaben: sicherJSON(fd.get('eingaben')),
    datei: datei && typeof datei === 'object' && datei.size ? { name: datei.name, typ: datei.type, b64: b64(await datei.arrayBuffer()) } : null
  };
  ctx.waitUntil(bearbeiten(anf, env));
  return json({ ok: true });
}

async function bearbeiten(anf, env) {
  let gutachten = '', kundentext = '', fehler = '';
  try {
    if (env.ANTHROPIC_API_KEY) ({ gutachten, kundentext } = await gutachter(anf, env));
    else fehler = 'Kein KI-Schlüssel hinterlegt; Anfrage ohne Gutachten.';
  } catch (e) { fehler = 'KI-Gutachten fehlgeschlagen: ' + e.message; }
  const entwurf = { id: anf.id, email: anf.email, betreff: anf.betreff, kundentext, gesendet: false };
  await env.SPEICHER.put('entwurf:' + anf.id, JSON.stringify(entwurf), { expirationTtl: 30 * 86400 });
  const link = env.BASIS + '/freigabe?id=' + anf.id + '&sig=' + await signatur(env, anf.id);
  const teile = [anf.text, '', '─── KI-Gutachten (Entwurf) ───', gutachten || fehler || '·', '', '─── Kundentext (Entwurf) ───', kundentext || '·', '', 'Freigeben und an ' + anf.email + ' senden: ' + link];
  await mail(env, {
    to: env.EMPFAENGER, subject: anf.betreff + ' · Entwurf', text: teile.join('\n'), replyTo: anf.email,
    attachments: anf.datei ? [{ filename: anf.datei.name, content: anf.datei.b64 }] : undefined
  });
}

async function gutachter(anf, env) {
  const wissen = [await env.SPEICHER.get('wissenskarten') || '', await env.SPEICHER.get('regeln') || ''].join('\n\n');
  const system = [
    { type: 'text', text: 'Du bist der Gutachter für Mehrstufenpressen-Anfragen von Hans Möhling (Jern Yao, deutscher Sprachraum). Antworte auf Deutsch, sachlich, ohne Gedankenstriche. Was die Unterlagen nicht hergeben, bleibt offen.' },
    { type: 'text', text: wissen, cache_control: { type: 'ephemeral' } }
  ];
  const inhalt = [];
  if (anf.datei && TYPEN[anf.datei.typ]) inhalt.push({ type: TYPEN[anf.datei.typ], source: { type: 'base64', media_type: anf.datei.typ, data: anf.datei.b64 } });
  inhalt.push({ type: 'text', text: 'Anfrage und Ergebnis der Browserrechnung:\n' + anf.text + '\n\nEingaben als JSON:\n' + JSON.stringify(anf.eingaben) +
    (anf.datei && !TYPEN[anf.datei.typ] ? '\n\nDie Zeichnung ' + anf.datei.name + ' liegt in einem Format vor, das Du nicht lesen kannst.' : '') +
    '\n\nAufgabe: Lies die Zeichnung, prüfe die Eingaben, rechne mit dem Werkzeug grobauslegung (auch mehrfach, mit korrigierten Maßen) und antworte mit genau zwei Abschnitten: «## Gutachten» für Hans Möhling und «## Kundentext» für den Kunden.' });
  const tools = [{
    name: 'grobauslegung',
    description: 'Rechenkern des Konfigurators: Stadienfolge, Kräfte, Werkzeuggrößen, Auswerferwege und passende Jern-Yao-Modelle mit Richtpreis 2026. Maße in mm, Masse in g.',
    input_schema: {
      type: 'object', required: ['typ', 'wst', 'd0'],
      properties: {
        typ: { type: 'string', enum: ['bolzen', 'formteil', 'mutter'] },
        wst: { type: 'integer', description: 'Index Werkstoff: ' + E.WERKSTOFFE.map((w, i) => i + '=' + w.id).join(', ') },
        rm: { type: 'number' }, d0: { type: 'number' },
        kopfForm: { type: 'string', enum: ['rund', 'sechskant', 'abgratet'] }, kD: { type: 'number' }, kSW: { type: 'number' }, kH: { type: 'number' },
        sD: { type: 'number' }, sL: { type: 'number' }, iSW: { type: 'number' }, iT: { type: 'number' },
        nD: { type: 'number' }, nT: { type: 'number' }, nDurch: { type: 'boolean' },
        mM: { type: 'number' }, mSW: { type: 'number' }, mH: { type: 'number' }, mLoch: { type: 'number' }, mFlansch: { type: 'number' }, mFlanschH: { type: 'number' },
        masse: { type: 'number' }, lStempel: { type: 'number' }, wenden: { type: 'boolean' },
        vorgaben: { type: 'object', properties: { ko: { type: 'number' }, pko: { type: 'number' }, matD: { type: 'number' }, matL: { type: 'number' }, stD: { type: 'number' }, stL: { type: 'number' }, stationen: { type: 'number' } } }
      }
    }
  }];
  const messages = [{ role: 'user', content: inhalt }];
  for (let runde = 0; runde < 6; runde++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.MODELL, max_tokens: 4000, system, tools, messages })
    });
    if (!r.ok) throw new Error('Claude ' + r.status + ' ' + (await r.text()).slice(0, 300));
    const a = await r.json();
    messages.push({ role: 'assistant', content: a.content });
    if (a.stop_reason !== 'tool_use') {
      const text = a.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      const i = text.indexOf('## Kundentext');
      return { gutachten: (i >= 0 ? text.slice(0, i) : text).replace('## Gutachten', '').trim(), kundentext: i >= 0 ? text.slice(i + 13).trim() : '' };
    }
    const ergebnisse = a.content.filter(b => b.type === 'tool_use').map(b => ({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(rechnen(b.input)) }));
    messages.push({ role: 'user', content: ergebnisse });
  }
  throw new Error('zu viele Werkzeugrunden');
}

function rechnen(e) {
  const a = E.auslegen(e);
  if (a.fehlt.length) return { fehlt: a.fehlt };
  const w = E.waehle(MASCHINEN, a, e);
  const kurz = r => ({ modell: r.o.m, gesamt: r.gesamt, richtpreis_eur: r.o.rp, spanne_eur: [r.o.lo, r.o.hi], auslastung: Math.round(r.ausl * 100), kriterien: r.k.map(k => k.krit + ': ' + k.status + ' (' + k.soll + ' / ' + k.ist + ')') });
  return { stufen: a.stufen.map(s => ({ vorgang: s.v, kraft_t: +s.t.toFixed(1), matrize_min: Math.round(s.matD) })), werte: a.werte, hinweise: a.hinweise, passend: w.passend.slice(0, 3).map(kurz), bedingt: w.bedingt.slice(0, 3).map(kurz), knapp_daneben: w.fast.slice(0, 2).map(kurz) };
}

async function freigabe(req, url, env) {
  const html = (t, s = 200) => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.5">' + t + '</body>', { status: s, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const id = url.searchParams.get('id') || '', sig = url.searchParams.get('sig') || '';
  if (!id || sig !== await signatur(env, id)) return html('Link ungültig.', 403);
  const roh = await env.SPEICHER.get('entwurf:' + id);
  if (!roh) return html('Entwurf nicht mehr vorhanden.', 404);
  const d = JSON.parse(roh);
  if (req.method === 'GET') {
    return html('<h2>' + esc(d.betreff) + '</h2><p>An ' + esc(d.email) + (d.gesendet ? ', <b>bereits gesendet</b>' : '') + '</p><form method="post"><textarea name="text" rows="22" style="width:100%">' + esc(d.kundentext) + '</textarea><p><button style="font-size:1rem;padding:.5rem 1rem">An den Kunden senden</button></p></form>');
  }
  if (req.method === 'POST') {
    if (d.gesendet) return html('Bereits gesendet.');
    const text = String((await req.formData()).get('text') || '').trim();
    if (!text) return html('Kein Text.', 400);
    await mail(env, { to: d.email, cc: [env.EMPFAENGER], subject: d.betreff.replace(/^Richtpreisanfrage/, 'Richtpreisangebot'), text, replyTo: env.EMPFAENGER });
    d.gesendet = true; d.kundentext = text;
    await env.SPEICHER.put('entwurf:' + id, JSON.stringify(d), { expirationTtl: 30 * 86400 });
    return html('Gesendet an ' + esc(d.email) + '.');
  }
  return html('Methode nicht erlaubt.', 405);
}

async function mail(env, { to, cc, subject, text, replyTo, attachments }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.ABSENDER, to: [to], cc, subject, text, reply_to: replyTo, attachments })
  });
  if (!r.ok) throw new Error('Mail ' + r.status + ' ' + (await r.text()).slice(0, 300));
}

async function signatur(env, id) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.FREIGABE_SCHLUESSEL), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(id));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
function b64(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function sicherJSON(x) { try { return JSON.parse(String(x || '{}')); } catch { return {}; } }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
