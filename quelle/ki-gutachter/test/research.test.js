import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPrimary } from '../research.js';

const config = { query: 'Kaltumformung Werkstoff-Fließkurve C10C', domains: ['jernyao.com', 'saarstahl.com'], model: 'claude-opus-5-5', key: 'fake-test-key-not-a-secret' };
const cite = (url = 'https://www.saarstahl.com/material', extra = {}) => ({ type: 'web_search_result_location', url, title: 'Werkstoffdaten', cited_text: 'Belegter kurzer Auszug.', encrypted_index: 'opaque-citation', ...extra });
const searchBlocks = (id = 'srvtoolu_search') => [
  { type: 'server_tool_use', id, name: 'web_search', input: { query: config.query } },
  { type: 'web_search_tool_result', tool_use_id: id, content: [{ type: 'web_search_result', title: 'Werkstoffdaten', url: 'https://www.saarstahl.com/material', encrypted_content: 'opaque-search-content' }] }
];
const answer = (citations = [cite()], extra = {}) => ({ stop_reason: 'end_turn', content: [...searchBlocks(), { type: 'text', text: 'Diese frei formulierte URL ist kein Beleg: https://www.saarstahl.com/invented', citations }], ...extra });
const reply = body => ({ ok: true, json: async () => body });
function mockFetch(t, responses) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, ...init, body: JSON.parse(init.body) });
    const item = responses[calls.length - 1];
    assert.ok(item, 'Unerwarteter zusätzlicher Provider-Aufruf');
    if (item instanceof Error) throw item;
    return item;
  });
  return calls;
}
const assertGap = result => { assert.deepEqual(result.results, []); assert.equal(typeof result.gap, 'string'); assert.ok(result.gap); };

test('native web search with explicit direct caller, domains, two uses and signal', async t => {
  const controller = new AbortController();
  const calls = mockFetch(t, [reply(answer())]);
  const result = await searchPrimary({ ...config, signal: controller.signal });
  assert.deepEqual(result, { results: [{ title: 'Werkstoffdaten', url: 'https://www.saarstahl.com/material', excerpt: 'Belegter kurzer Auszug.' }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.equal(calls[0].signal, controller.signal);
  assert.equal(calls[0].headers['x-api-key'], config.key);
  assert.deepEqual(calls[0].body.tools, [{ type: 'web_search_20260209', name: 'web_search', allowed_callers: ['direct'], max_uses: 2, allowed_domains: config.domains }]);
  assert.equal(JSON.stringify(calls[0].body).includes(config.key), false);
});

test('only typed citation URLs on allowed HTTPS hosts; prose and deceptive hosts excluded', async t => {
  const urls = ['https://saarstahl.com/data', 'https://docs.saarstahl.com/data', 'https://saarstahl.com.evil.test/a', 'https://evilsaarstahl.com/a', 'http://saarstahl.com/a', 'https://saarstahl.com@evil.test/a', 'https://user:pass@saarstahl.com/a', 'https://saarstahl.com:8443/a', 'javascript:alert(1)', 'https://saarstahl.com\\@evil.test/a'];
  mockFetch(t, [reply(answer([...urls.map(u => cite(u)), cite('https://jernyao.com/invented', { type: 'char_location' })]))]);
  const result = await searchPrimary(config);
  assert.deepEqual(result.results.map(x => x.url), urls.slice(0, 2));
  assert.ok(result.results.every(x => !x.excerpt.includes('frei formulierte')));
});

test('deduplicates sources and fragments, normalizes fragments, caps four results', async t => {
  const citations = [cite(), cite(), cite('https://www.saarstahl.com/material#section', { cited_text: 'Zweiter belegter Auszug.' }), ...Array.from({ length: 6 }, (_, i) => cite('https://jernyao.com/catalog/' + i))];
  mockFetch(t, [reply(answer(citations))]);
  const result = await searchPrimary(config);
  assert.equal(result.results.length, 4);
  assert.equal(result.results[0].excerpt, 'Belegter kurzer Auszug.\nZweiter belegter Auszug.');
  assert.equal(result.results[0].url, 'https://www.saarstahl.com/material');
});

test('no citation or no completed search is never presented as researched evidence', async t => {
  const calls = mockFetch(t, [reply(answer([])), reply({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Search completed', citations: [cite()] }] })]);
  assertGap(await searchPrimary(config));
  assertGap(await searchPrimary(config));
  assert.equal(calls.length, 2);
});

test('HTTP 200 tool error discards even superficially valid partial citations', async t => {
  const body = answer();
  body.content.push({ type: 'web_search_tool_result', tool_use_id: 'srvtoolu_error', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } });
  mockFetch(t, [reply(body)]);
  assertGap(await searchPrimary(config));
});

test('pause_turn preserves exact assistant blocks, tool state and earlier citations', async t => {
  const first = { stop_reason: 'pause_turn', content: [...searchBlocks(), { type: 'text', text: 'Zwischenergebnis', citations: [cite()] }, { type: 'server_tool_use', id: 'srvtoolu_second', name: 'web_search', input: { query: 'zweite Suche' } }] };
  const second = { stop_reason: 'pause_turn', content: [{ type: 'web_search_tool_result', tool_use_id: 'srvtoolu_second', content: [] }, { type: 'text', text: 'Fortsetzung' }] };
  const third = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Fertig' }] };
  const calls = mockFetch(t, [reply(first), reply(second), reply(third)]);
  const result = await searchPrimary(config);
  assert.equal(result.results.length, 1);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].body.messages[1], { role: 'assistant', content: first.content });
  assert.deepEqual(calls[2].body.messages.slice(1), [{ role: 'assistant', content: first.content }, { role: 'assistant', content: second.content }]);
  assert.deepEqual(calls[2].body.tools, calls[0].body.tools);
});

test('three paused responses stop after exactly two continuations with no evidence claim', async t => {
  const pause = answer([cite()], { stop_reason: 'pause_turn' });
  const calls = mockFetch(t, [reply(pause), reply(pause), reply(pause)]);
  assertGap(await searchPrimary(config));
  assert.equal(calls.length, 3);
});

test('HTTP, transport, malformed JSON and incomplete turns return sanitized gaps', async t => {
  const calls = mockFetch(t, [
    { ok: false, json: async () => { throw new Error('must not inspect error body'); } },
    new Error('secret-provider-detail-' + config.key),
    { ok: true, json: async () => { throw new Error(config.key); } },
    reply({ type: 'error', error: { message: config.key } }),
    reply(answer([cite()], { stop_reason: 'max_tokens' }))
  ]);
  for (let i = 0; i < 5; i++) {
    const result = await searchPrimary(config);
    assertGap(result);
    assert.equal(JSON.stringify(result).includes(config.key), false);
  }
  assert.equal(calls.length, 5);
});

test('missing key, invalid domain allowlists, absent query and pre-abort do not fetch', async t => {
  const calls = mockFetch(t, []);
  for (const override of [{ key: '' }, { domains: [] }, { domains: ['*'] }, { domains: ['https://saarstahl.com'] }, { domains: ['saarstahl.com/path'] }, { domains: ['127.0.0.1'] }, { query: '' }, { query: 'a'.repeat(1001) }, { signal: AbortSignal.abort() }]) assertGap(await searchPrimary({ ...config, ...override }));
  assert.equal(calls.length, 0);
});

test('in-flight abort is passed to fetch and becomes a soft gap', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_, init) => { assert.equal(init.signal, controller.signal); controller.abort(); throw new Error('aborted'); });
  const result = await searchPrimary({ ...config, signal: controller.signal });
  assertGap(result);
  assert.match(result.gap, /abgebrochen/);
});
