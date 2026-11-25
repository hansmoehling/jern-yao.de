import { analyse, publicResult, loadKnowledge, MODEL, providerFailure, recordServiceDiagnostic } from './analysis.js';
import I18N from '../i18n.js';
import { geometryContext } from './geometry-context.js';
import {DRAWING_DEFAULTS_VERSION,validateMaterialChoice,materialText,CHOICE_ERROR} from './material-choice.js';
import {prepareDecision,recordDecision} from './decision-log.js';
const {t,normalizeLanguage}=I18N;

const TTL = 30 * 86400;
const MAX_FILE = 15 * 1024 * 1024;
const ORIGINS = ['https://jern-yao.de', 'https://jernyao.de', 'https://www.jernyao.de'];
const TECHNICAL_ONLY='technical-only',WITH_PRICES='with-prices';
const pricedOrigin=origin=>['https://jern-yao.de','https://www.jern-yao.de'].includes(origin);
// Publication gate: main-site requests and old saved requests keep their
// existing behaviour, regardless of a client-supplied version or Origin later.
const packageOneOrigin=origin=>origin==='https://jern-yao.de';
const storedFeatures=record=>packageOneOrigin(record?.siteOrigin)&&record?.featureVersion===DRAWING_DEFAULTS_VERSION?{featureVersion:DRAWING_DEFAULTS_VERSION,materialChoice:record.materialChoice||null}:{};
const originPricePolicy=req=>pricedOrigin(req.headers.get('Origin'))?WITH_PRICES:TECHNICAL_ONLY;
const storedPricePolicy=record=>record?.pricePolicy===WITH_PRICES&&pricedOrigin(record.siteOrigin)?WITH_PRICES:TECHNICAL_ONLY;
// Client values may only restrict. A linked request also keeps its original
// policy when revisited from another origin or processed without HTTP headers.
const requestPricePolicy=(req,requested,record)=>originPricePolicy(req)===TECHNICAL_ONLY||requested===TECHNICAL_ONLY||record&&storedPricePolicy(record)===TECHNICAL_ONLY?TECHNICAL_ONLY:WITH_PRICES;
const EXT = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', tif:'image/tiff',tiff:'image/tiff',igs:'model/iges',iges:'model/iges',step: 'application/step', stp: 'application/step', dxf: 'image/vnd.dxf', dwg: 'image/vnd.dwg' };
const enc = new TextEncoder();
const json = (value, status = 200, cors = {}) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const txt = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const get = async (env, key) => { const raw = await env.SPEICHER.get(key); return raw ? JSON.parse(raw) : null; };
const put = (env, key, value) => env.SPEICHER.put(key, JSON.stringify(value), { expirationTtl: TTL });
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? enc.encode(value) : value)); }
function hex(b) { return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join(''); }
function secret(env) { return env.ZUGRIFF_SCHLUESSEL || env.FREIGABE_SCHLUESSEL; }
export async function tokenFor(env, id) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode('jy-request-v1:' + id)));
}
function equal(a, b) { if (typeof a !== 'string' || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
function configured(env) { return { storage: !!env.SPEICHER, queue: !!env.ANFRAGEN, files: !!env.DATEIEN, model: !!env.ANTHROPIC_API_KEY && !!(env.MODELL || MODEL), mail: !!env.RESEND_API_KEY && !!env.EMPFAENGER && !!env.ABSENDER, access: typeof secret(env) === 'string' && secret(env).length >= 32 }; }
async function readiness(env) {
  const checks = configured(env); let knowledgeStatus = 'missing';
  if (checks.storage) { try { knowledgeStatus = (await loadKnowledge(env)).status; } catch { knowledgeStatus = 'invalid'; } }
  checks.knowledge = ['versioned', 'legacy'].includes(knowledgeStatus);
  return { ready: Object.values(checks).every(Boolean), checks, knowledgeStatus, credentialsVerified: false, model: env.MODELL || MODEL };
}
async function requireReady(env) { if (!Object.entries(configured(env)).filter(([name])=>name!=='model').every(([,ready])=>ready)) throw new HttpError(503, 'Der Anfragedienst wird noch eingerichtet. Bitte wenden Sie sich direkt an Hans.'); }
async function requirePreviewReady(env,{geometry=false}={}) {
  const {checks}=await readiness(env);
  if (!Object.entries(checks).filter(([name])=>name!=='mail'&&(!geometry||name!=='files')).every(([,ready])=>ready)) throw new HttpError(503, 'Die Zeichnungsanalyse wird noch eingerichtet. Bitte versuchen Sie es später erneut.');
}
async function readBounded(req, max) {
  if (Number(req.headers.get('content-length')) > max) throw new HttpError(413, 'Die Anfrage ist zu groß.');
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader(), parts = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new HttpError(413, 'Die Anfrage ist zu groß.'); } parts.push(value); }
  const all = new Uint8Array(size); let at = 0; for (const part of parts) { all.set(part, at); at += part.length; } return all;
}
async function throttle(req, env, bucket, limit) {
  // KV is an approximate daily limit. Use the Cloudflare WAF rate limiter for an atomic edge quota.
  const key = 'rate:' + bucket + ':' + new Date().toISOString().slice(0, 10) + ':' + await digest(req.headers.get('CF-Connecting-IP') || 'unknown');
  const n = Number(await env.SPEICHER.get(key) || 0);
  if (n >= limit) throw new HttpError(429, 'Für heute sind zu viele Anfragen eingegangen. Bitte versuchen Sie es später erneut.');
  await env.SPEICHER.put(key, String(n + 1), { expirationTtl: 86400 });
}
async function authorised(env, id, token) {
  if (!secret(env) || !/^[a-f0-9-]{36}$/.test(id || '') || !equal(token, await tokenFor(env, id))) throw new HttpError(403, 'Dieser Anfragelink ist ungültig.');
  const intake = await get(env, 'anfrage:' + id);
  if (!intake || Date.parse(intake.createdAt) + TTL * 1000 < Date.now()) throw new HttpError(404, 'Diese Anfrage ist nicht mehr abrufbar.');
  return intake;
}
async function snapshot(env, id, pricePolicy,kind) {
  const [a, n] = await Promise.all([get(env, 'analyse:' + id), get(env, 'nachricht:' + id)]);
  if(kind==='enquiry')return {status:'received',kind,analysisStatus:'not_requested',...publicResult(null,{pricePolicy}),notificationStatus:n?.status||'pending'};
  return { status: a?.status || 'queued', ...publicResult(a?.result,{pricePolicy}), notificationStatus: n?.status || 'pending' };
}
function signatureOK(bytes, ext) {
  const b = Array.from(bytes.slice(0, 16)), ascii = new TextDecoder().decode(bytes.slice(0, 16));
  if (ext === 'pdf') return new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-');
  if (ext === 'png') return b.slice(0, 8).join() === '137,80,78,71,13,10,26,10';
  if (['jpg', 'jpeg'].includes(ext)) return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (ext === 'webp') return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
  if(['tif','tiff'].includes(ext))return b[0]===73&&b[1]===73&&[42,43].includes(b[2])&&b[3]===0||b[0]===77&&b[1]===77&&b[2]===0&&[42,43].includes(b[3]);
  return true; // CAD is not parsed or executed.
}
async function enqueue(env, id) {
  await env.ANFRAGEN.sendBatch([{ body: { kind: 'intake_mail', id } }]);
  await put(env, 'versandauftrag:' + id, { queuedAt: new Date().toISOString() });
}
async function enqueuePreview(env,id) {
  await env.ANFRAGEN.sendBatch([{body:{kind:'preview_analysis',id}}]);
  await put(env,'vorschauauftrag:'+id,{queuedAt:new Date().toISOString()});
}
async function preview(req,env,cors,locale) {
  const bytes=await readBounded(req,MAX_FILE+128*1024);
  let form;try{form=await new Request(req.url,{method:'POST',headers:req.headers,body:bytes}).formData();}catch{throw new HttpError(400,'Das Formular konnte nicht gelesen werden.');}
  const language=normalizeLanguage(form.get('language')||locale.value);
  locale.value=language;
  await requirePreviewReady(env);
  const upload=form.get('datei')||form.get('zeichnung');
  if(!upload||typeof upload!=='object'||!upload.size)throw new HttpError(400,'Bitte wählen Sie eine PDF-Zeichnung oder ein Bild für die KI-Auswertung aus.');
  if(upload.size>MAX_FILE)throw new HttpError(413,'Die Datei darf höchstens 15 MB groß sein.');
  const filename=String(upload.name).split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,'').slice(0,160),ext=filename.split('.').pop().toLowerCase();
  if(!['pdf','png','jpg','jpeg','webp'].includes(ext))throw new HttpError(415,'Für die KI-Auswertung benötigen wir eine PDF-Ansicht oder ein Bild. CAD-Dateien können Sie mit Ihrer Anfrage als Original versenden.');
  const fileBytes=new Uint8Array(await upload.arrayBuffer());
  if(!signatureOK(fileBytes,ext))throw new HttpError(415,'Dateiendung und Dateiinhalt passen nicht zusammen.');
  const idem=txt(form.get('idempotency_key'),160);
  if(!/^[\w-]{16,160}$/.test(idem))throw new HttpError(400,'Die Anfragekennung ist ungültig.');
  const siteOrigin=req.headers.get('Origin')||null,pricePolicy=requestPricePolicy(req,form.get('pricePolicy'));
  let materialChoice=null;
  if(packageOneOrigin(siteOrigin)){try{materialChoice=validateMaterialChoice(form.get('materialChoice'));}catch{throw new HttpError(400,materialText(CHOICE_ERROR,language));}}
  const features=packageOneOrigin(siteOrigin)?{featureVersion:DRAWING_DEFAULTS_VERSION,...(materialChoice?{materialChoice}:{})}:{};
  const note=txt(form.get('notiz')||form.get('text'),20000),file={name:filename,type:EXT[ext],size:fileBytes.length,hash:await digest(fileBytes),readable:true};
  const fingerprint=await digest(JSON.stringify({note,file,language,siteOrigin,pricePolicy,...(materialChoice?{materialChoice}:{})}));
  // The opaque client key belongs only to this preview. Contact submissions use
  // their existing, separate namespace and are never triggered by this route.
  const idemKey='vorschau-idempotenz:'+await digest(siteOrigin+':'+idem),old=await get(env,idemKey);
  if(old){
    if(old.fingerprint!==fingerprint)throw new HttpError(409,'Diese Anfragekennung gehört bereits zu anderen Angaben. Bitte senden Sie eine neue Anfrage.');
    const saved=await get(env,'anfrage:'+old.id);
    if(saved?.kind!=='preview')throw new HttpError(503,'Die Vorschau konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.');
    if(!await get(env,'vorschauauftrag:'+old.id))await enqueuePreview(env,old.id);
    const state=await snapshot(env,old.id,requestPricePolicy(req,pricePolicy,saved));
    if(!state.answer)state.language=language;
    return json({id:old.id,token:await tokenFor(env,old.id),...state,kind:'preview',notificationStatus:'not_requested'},200,cors);
  }
  await throttle(req,env,'preview',10);
  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  file.key='anfragen/'+id+'/original';
  await env.DATEIEN.put(file.key,fileBytes,{httpMetadata:{contentType:file.type},customMetadata:{expiresAt:String(Date.now()+TTL*1000)}});
  await put(env,'anfrage:'+id,{id,kind:'preview',createdAt,note,file,language,siteOrigin,pricePolicy,...features});
  await put(env,'analyse:'+id,{status:'queued',updatedAt:createdAt});
  await put(env,'nachricht:'+id,{status:'not_requested',updatedAt:createdAt});
  await put(env,idemKey,{id,fingerprint});
  try{await enqueuePreview(env,id);}catch{throw new HttpError(503,'Die Übertragung wurde unterbrochen. Bitte senden Sie dieselbe Anfrage erneut.');}
  return json({id,token:await tokenFor(env,id),kind:'preview',status:'queued',notificationStatus:'not_requested',language,pricePolicy},202,cors);
}
async function geometryPreview(req,env,cors,locale) {
  let body;try{body=JSON.parse(new TextDecoder().decode(await readBounded(req,64000)));}catch(error){if(error instanceof HttpError)throw error;throw new HttpError(400,'Die Nachricht konnte nicht gelesen werden.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Die Nachricht konnte nicht gelesen werden.');
  const language=normalizeLanguage(body.language||locale.value);locale.value=language;
  await requirePreviewReady(env,{geometry:true});
  const geometry=geometryContext(body.geometrySpec,body);
  if(!geometry.ok)return json({error:t('Bitte die strukturierte Geometrie und den Drahtprozess prüfen.',language),issues:geometry.errors,language},400,cors);
  const idem=txt(body.idempotency_key,160);
  if(!/^[\w-]{16,160}$/.test(idem))throw new HttpError(400,'Die Anfragekennung ist ungültig.');
  const siteOrigin=req.headers.get('Origin')||null,pricePolicy=requestPricePolicy(req,body.pricePolicy),note=txt(body.note,20000);
  const geometrySpec=geometry.spec,geometryProcess=geometry.process;
  const fingerprint=await digest(JSON.stringify({geometrySpec,geometryProcess,note,language,siteOrigin,pricePolicy}));
  const idemKey='geometrie-idempotenz:'+await digest(siteOrigin+':'+idem),old=await get(env,idemKey);
  if(old){
    if(old.fingerprint!==fingerprint)throw new HttpError(409,'Diese Anfragekennung gehört bereits zu anderen Angaben. Bitte senden Sie eine neue Anfrage.');
    const saved=await get(env,'anfrage:'+old.id);
    if(saved?.kind!=='preview'||saved.previewSource!=='structured_geometry')throw new HttpError(503,'Die Vorschau konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.');
    if(!await get(env,'vorschauauftrag:'+old.id))await enqueuePreview(env,old.id);
    const state=await snapshot(env,old.id,requestPricePolicy(req,pricePolicy,saved));if(!state.answer)state.language=language;
    return json({id:old.id,token:await tokenFor(env,old.id),...state,kind:'preview',previewSource:'structured_geometry',notificationStatus:'not_requested'},200,cors);
  }
  // Geometry and file previews share the same cost budget. A second route must
  // not double the number of newly accepted analysis jobs.
  await throttle(req,env,'preview',10);
  const id=crypto.randomUUID(),createdAt=new Date().toISOString();
  await put(env,'anfrage:'+id,{id,kind:'preview',previewSource:'structured_geometry',createdAt,note,geometrySpec,geometryProcess,language,siteOrigin,pricePolicy});
  await put(env,'analyse:'+id,{status:'queued',updatedAt:createdAt});
  await put(env,'nachricht:'+id,{status:'not_requested',updatedAt:createdAt});
  await put(env,idemKey,{id,fingerprint});
  try{await enqueuePreview(env,id);}catch{throw new HttpError(503,'Die Übertragung wurde unterbrochen. Bitte senden Sie dieselbe Anfrage erneut.');}
  return json({id,token:await tokenFor(env,id),kind:'preview',previewSource:'structured_geometry',status:'queued',notificationStatus:'not_requested',language,pricePolicy},202,cors);
}
async function intake(req, env, cors, locale) {
  const bytes = await readBounded(req, MAX_FILE + 128 * 1024);
  let form; try { form = await new Request(req.url, { method: 'POST', headers: req.headers, body: bytes }).formData(); } catch { throw new HttpError(400, 'Das Formular konnte nicht gelesen werden.'); }
  const language = normalizeLanguage(form.get('language') || locale.value);
  const siteOrigin=req.headers.get('Origin')||null,pricePolicy=requestPricePolicy(req,form.get('pricePolicy'));
  locale.value = language;
  await requireReady(env);
  const email = txt(form.get('email'), 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Bitte geben Sie Ihre E-Mail-Adresse an.');
  // Published older forms enforce the checkbox locally but omit this field.
  if(form.has('consent')&&form.get('consent')!=='true')throw new HttpError(400,'Bitte stimmen Sie der Verarbeitung Ihrer Anfrage zu.');
  const note = txt(form.get('notiz') || form.get('text'), 20000), name = txt(form.get('name'), 120), company = txt(form.get('firma'), 160);
  const subject=txt(form.get('betreff'),500).replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
  const upload = form.get('datei') || form.get('zeichnung'); let file = null, fileBytes;
  if (upload && typeof upload === 'object' && upload.size) {
    if (upload.size > MAX_FILE) throw new HttpError(413, 'Die Datei darf höchstens 15 MB groß sein.');
    const filename = String(upload.name).split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160), ext = filename.split('.').pop().toLowerCase();
    if (!EXT[ext]) throw new HttpError(415, 'Bitte laden Sie PDF, PNG, JPG, WebP oder eine STEP-, DXF- oder DWG-Datei hoch.');
    fileBytes = new Uint8Array(await upload.arrayBuffer());
    if (!signatureOK(fileBytes, ext)) throw new HttpError(415, 'Dateiendung und Dateiinhalt passen nicht zusammen.');
    file = { name: filename, type: EXT[ext], size: fileBytes.length, hash: await digest(fileBytes), readable: ['pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext) };
  }
  if (!note && !file) throw new HttpError(400, 'Bitte laden Sie eine Zeichnung hoch oder beschreiben Sie Ihr Teil.');
  const idem = txt(form.get('idempotency_key'), 160);
  if (idem && !/^[\w-]{8,160}$/.test(idem)) throw new HttpError(400, 'Die Anfragekennung ist ungültig.');
  const decision=packageOneOrigin(siteOrigin)?prepareDecision(form.get('decisionContext'),{hasFile:!!file}):null;
  const fingerprint = await digest(JSON.stringify({ email, note, name, company, file, language,siteOrigin,pricePolicy,...(subject?{subject}:{}),...(decision?{decision}:{}) }));
  const idemKey = idem ? 'idempotenz:' + await digest(email.toLowerCase() + ':' + siteOrigin + ':' + idem) : null;
  if (idemKey) {
    const old = await get(env, idemKey);
    if (old) {
      if (old.fingerprint !== fingerprint) throw new HttpError(409, 'Diese Anfragekennung gehört bereits zu anderen Angaben. Bitte senden Sie eine neue Anfrage.');
      if (!await get(env, 'versandauftrag:' + old.id)) await enqueue(env, old.id);
      const saved=await get(env,'anfrage:'+old.id);
      const state = await snapshot(env, old.id,requestPricePolicy(req,pricePolicy,saved),saved?.kind);
      if (!state.answer) state.language = language;
      return json({ id: old.id, token: await tokenFor(env, old.id), ...state }, 200, cors);
    }
  }
  await throttle(req, env, 'intake', 10);
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  if (file) { file.key = 'anfragen/' + id + '/original'; await env.DATEIEN.put(file.key, fileBytes, { httpMetadata: { contentType: file.type }, customMetadata: { expiresAt: String(Date.now() + TTL * 1000) } }); }
  await put(env, 'anfrage:' + id, { id, kind:'enquiry',createdAt, email, name, company, note, file, language,siteOrigin,pricePolicy,...(subject?{subject}:{}),consent:form.get('consent')==='true',consentSource:form.has('consent')?'submitted':'legacy-ui' });
  await put(env, 'nachricht:' + id, { status: 'pending', updatedAt: createdAt });
  if (idemKey) await put(env, idemKey, { id, fingerprint });
  // Optional learning intake cannot prevent the explicitly requested email.
  // No decision ID is attached to the customer record or public response.
  if(decision){try{await recordDecision(env,decision);}catch(error){await recordServiceDiagnostic(env,error,'request');}}
  try { await enqueue(env, id); } catch { throw new HttpError(503, 'Die Übertragung wurde unterbrochen. Bitte senden Sie dieselbe Anfrage erneut.'); }
  return json({ id, token: await tokenFor(env, id), kind:'enquiry',status: 'received',analysisStatus:'not_requested', notificationStatus: 'pending', language,pricePolicy }, 202, cors);
}
async function chat(req, env, cors, locale) {
  let body; try { body = JSON.parse(new TextDecoder().decode(await readBounded(req, 64000))); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'Die Nachricht konnte nicht gelesen werden.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Die Nachricht konnte nicht gelesen werden.');
  if (typeof body.language === 'string') locale.value = normalizeLanguage(body.language);
  if (!env.SPEICHER || !env.ANTHROPIC_API_KEY) throw new HttpError(503, 'Der Fachchat wird noch eingerichtet.');
  const message = txt(body.message, 8000);
  if (!message) throw new HttpError(400, 'Bitte schreiben Sie Ihre Frage.');
  let request = null, history = [];
  if (body.requestId || body.token) { request = await authorised(env, body.requestId, body.token); history = await get(env, 'chat:' + request.id) || []; if (typeof body.language !== 'string' && !locale.explicit) locale.value = normalizeLanguage(request.language); }
  else if (Array.isArray(body.history)) history = body.history.slice(-12).filter(x => x && ['user', 'assistant'].includes(x.role)).map(x => ({ role: x.role, content: txt(x.content || x.message, 4000) }));
  const pricePolicy=requestPricePolicy(req,body.pricePolicy,request);
  await throttle(req, env, 'chat', 40);
  const file = request?.file?.readable ? await readFile(env, request.file) : null;
  let result;
  try { result = await analyse({ note: request?.note || '', message, history, file, filename: request?.file?.name, unreadableFile: !!request?.file && !request.file.readable, geometrySpec:request?.geometrySpec,geometryProcess:request?.geometryProcess, language: locale.value,pricePolicy,...storedFeatures(request) }, env, { timeoutMs: 120000, maxRounds: 5 }); }
  catch (error) { await recordServiceDiagnostic(env, error, 'chat'); throw new HttpError(503, 'Die Antwort konnte gerade nicht fertiggestellt werden. Ihre bisherige Anfrage bleibt erhalten. Bitte versuchen Sie es erneut.'); }
  if (request) {
    await put(env, 'chat:' + request.id, [...history, { role: 'user', content: message }, { role: 'assistant', content: result.answer }].slice(-20));
    await put(env, 'analyse:' + request.id, { status: result.questions.length ? 'needs_info' : 'ready', result, updatedAt: new Date().toISOString() });
  }
  return json({ ...publicResult(result,{pricePolicy}), status: result.questions.length ? 'needs_info' : 'ready' }, 200, cors);
}
async function readFile(env, file) { const object = await env.DATEIEN.get(file.key); if (!object) throw new Error('original_missing'); return { type: file.type, bytes: new Uint8Array(await object.arrayBuffer()) }; }
function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
async function notifyHans(env, record) {
  if(record.kind==='preview')return;
  const current = await get(env, 'nachricht:' + record.id); if (current?.status === 'sent') return;
  const attachment = record.file ? await readFile(env, record.file) : null;
  const language = normalizeLanguage(record.language);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(25000), headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'jy-intake-' + record.id },
    body: JSON.stringify({ from: env.ABSENDER, to: [env.EMPFAENGER], reply_to: record.email, subject: (record.subject||t('Neue Umformanfrage', language)) + ' · ' + record.id,
      text: [t('Neue Anfrage eingegangen.', language), t('Kontakt:', language) + ' ' + record.email, record.name, record.company, '', record.note, '', ...(record.kind==='enquiry'?[]:[t(record.file && !record.file.readable ? 'CAD-Datei im Anhang. Automatische Bildanalyse liest dieses Format nicht.' : 'Die technische Analyse läuft unabhängig von dieser Eingangsmitteilung.', language)])].join('\n'),
      attachments: attachment ? [{ filename: record.file.name, content: b64(attachment.bytes) }] : undefined })
  });
  if (!response.ok) throw await providerFailure(response, 'resend');
  const provider = await response.json();
  await put(env, 'nachricht:' + record.id, { status: 'sent', providerId: provider.id, updatedAt: new Date().toISOString() });
}
async function queued(message, env) {
  const { id, kind } = message.body || {};
  if (!/^[a-f0-9-]{36}$/.test(id || '') || !['analysis', 'preview_analysis', 'intake_mail'].includes(kind)) { message.ack(); return; }
  const isPreview=kind==='preview_analysis',isAnalysis=kind!=='intake_mail';
  const key = (isAnalysis ? 'analyse:' : 'nachricht:') + id;
  let record;
  try {
    record = await get(env, 'anfrage:' + id);
    if (!record) throw new Error('intake_not_yet_visible');
    if((record.kind==='preview')!==isPreview){message.ack();return;}
    if(record.kind==='enquiry'&&isAnalysis){message.ack();return;}
    if (Date.parse(record.createdAt) + TTL * 1000 < Date.now()) { message.ack(); return; }
    if (kind === 'intake_mail') await notifyHans(env, record);
    else {
      const old = await get(env, key);
      if (['ready', 'needs_info'].includes(old?.status)||isPreview&&old?.status==='failed') { message.ack(); return; }
      await put(env, key, { status: 'processing', updatedAt: new Date().toISOString() });
      const file = record.file?.readable ? await readFile(env, record.file) : null;
      const result = await analyse({ note: record.note, file, filename: record.file?.name, unreadableFile: !!record.file && !record.file.readable, geometrySpec:record.geometrySpec,geometryProcess:record.geometryProcess, language: normalizeLanguage(record.language),pricePolicy:storedPricePolicy(record),...storedFeatures(record) }, env, { timeoutMs: 240000, maxRounds: 7 });
      const latest = await get(env, key);
      if (!['ready', 'needs_info'].includes(latest?.status)) await put(env, key, { status: result.questions.length ? 'needs_info' : 'ready', result, updatedAt: new Date().toISOString() });
    }
    message.ack();
  } catch (error) {
    await recordServiceDiagnostic(env, error, 'queue');
    const final = (message.attempts || 1) >= (isPreview?2:4);
    const latest = await get(env, key);
    if (isAnalysis && ['ready', 'needs_info'].includes(latest?.status) || kind === 'intake_mail' && latest?.status === 'sent') { message.ack(); return; }
    const language = normalizeLanguage(record?.language);
    await put(env, key, { status: final ? 'failed' : isAnalysis ? 'queued' : 'pending', updatedAt: new Date().toISOString(), ...(isAnalysis && final ? { result: { answer: t(record?.previewSource==='structured_geometry'?'Die strukturierte Geometrie konnte nicht vollständig ausgearbeitet werden. Ihre Eingaben bleiben gespeichert.':isPreview?'Die Zeichnung konnte nicht vollständig ausgewertet werden. Bitte prüfen Sie die Datei oder ergänzen Sie eine lesbare PDF-/Bildansicht.':'Die automatische Ausarbeitung konnte nicht abgeschlossen werden. Ihre Anfrage ist gespeichert.', language), questions: [], proposal: null, sources: [], language } } : {}) });
    if(isPreview&&final){message.ack();return;}
    message.retry({ delaySeconds: 60 }); // Exhausted jobs reach the configured dead-letter queue.
  }
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin');
    const locale = { value: normalizeLanguage(url.searchParams.get('language')), explicit: url.searchParams.has('language') };
    const allowed = [...ORIGINS, ...String(env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)];
    const cors = origin && allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } : {};
    if (origin && !allowed.includes(origin)) return json({ error: t('Diese Herkunft ist nicht freigegeben.', locale.value), language: locale.value }, 403);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/health' && req.method === 'GET') return json(await readiness(env), 200, cors);
      if (url.pathname === '/anfrage' && req.method === 'POST') return await intake(req, env, cors, locale);
      if (url.pathname === '/preview' && req.method === 'POST') return await preview(req, env, cors, locale);
      if (url.pathname === '/geometry-preview' && req.method === 'POST') return await geometryPreview(req, env, cors, locale);
      if (url.pathname === '/chat' && req.method === 'POST') return await chat(req, env, cors, locale);
      if (url.pathname === '/status' && req.method === 'GET') { const a = await authorised(env, url.searchParams.get('id'), url.searchParams.get('token')); const state = await snapshot(env, a.id,requestPricePolicy(req,url.searchParams.get('pricePolicy'),a),a.kind); if (!state.answer) state.language = normalizeLanguage(a.language); return json({...state,...(a.kind==='preview'?{kind:'preview',notificationStatus:'not_requested',...(a.previewSource==='structured_geometry'?{previewSource:a.previewSource}:{})}:{})}, 200, cors); }
      return json({ error: t('Nicht gefunden.', locale.value), language: locale.value }, 404, cors);
    } catch (e) { if (!(e instanceof HttpError)) await recordServiceDiagnostic(env, e, url.pathname === '/chat' ? 'chat' : 'request'); return json({ error: t(e instanceof HttpError ? e.message : 'Der Dienst konnte die Anfrage gerade nicht abschließen.', locale.value), language: locale.value }, e.status || 503, cors); }
  },
  async queue(batch, env) { await Promise.all(batch.messages.map(message => queued(message, env))); }
};
