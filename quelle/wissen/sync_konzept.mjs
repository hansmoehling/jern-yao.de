// Explicit operator command; reads secrets from the environment, never logs them.
// node sync_konzept.mjs publish /private/konzept-cache.json
// node sync_konzept.mjs export-learning /private/lernen-export.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [action, file] = process.argv.slice(2);
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const namespace = process.env.CF_KV_NAMESPACE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!['publish', 'export-learning'].includes(action) || !file) throw new Error('publish|export-learning DATEI erwartet');
const privatePath = path.resolve(file);
if (privatePath === root || privatePath.startsWith(root + path.sep)) throw new Error('Wissensdateien außerhalb des öffentlichen Repos ablegen.');
if (!account || !namespace || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID, CF_KV_NAMESPACE_ID und CLOUDFLARE_API_TOKEN fehlen.');
const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/storage/kv/namespaces/${encodeURIComponent(namespace)}`;
async function cf(route, options = {}) {
  const response = await fetch(base + route, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Cloudflare HTTP ${response.status}`);
  return response;
}
if (action === 'publish') {
  const snapshot = JSON.parse(await fs.readFile(privatePath, 'utf8'));
  if (!/^[a-f0-9]{20}$/.test(snapshot.version)) throw new Error('Snapshot-Version ungültig');
  for (const source of snapshot.sources) {
    const content = snapshot.texts[source.key];
    if (typeof content !== 'string' || createHash('sha256').update(content).digest('hex') !== source.sha256) throw new Error('Quellprüfsumme falsch: ' + source.key);
    if (snapshot.keys[source.key] !== `konzept:${snapshot.version}:${source.key}`) throw new Error('Wissensschlüssel passt nicht zur Version');
  }
  // All immutable bodies first, pointer last. Failed transfers keep the previous corpus.
  for (const source of snapshot.sources) {
    await cf('/values/' + encodeURIComponent(snapshot.keys[source.key]), { method: 'PUT', body: snapshot.texts[source.key] });
  }
  const { texts, ...manifest } = snapshot;
  await cf('/values/' + encodeURIComponent('konzept:manifest'), { method: 'PUT', body: JSON.stringify(manifest) });
  const readback = await (await cf('/values/' + encodeURIComponent('konzept:manifest'))).json();
  if (readback.version !== snapshot.version) throw new Error('Manifest-Prüfung fehlgeschlagen');
  console.log(JSON.stringify({ published: snapshot.version, sources: snapshot.sources.length }));
} else {
  const records = [];
  let cursor = '';
  do {
    const page = await (await cf('/keys?prefix=lernen%3A&limit=1000' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''))).json();
    if (!page.success) throw new Error('Wissenseingang konnte nicht gelesen werden');
    for (const key of page.result) {
      const record = await (await cf('/values/' + encodeURIComponent(key.name))).json();
      records.push({ key: key.name, ...record, status: 'ungeprueft' });
    }
    cursor = page.result_info?.cursor || '';
  } while (cursor);
  await fs.writeFile(privatePath, JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2), 'utf8');
  console.log(JSON.stringify({ exported: records.length, file: privatePath, promotedToRules: 0 }));
}
