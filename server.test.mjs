import assert from 'node:assert/strict';
import { get } from 'node:http';
import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { createAppServer } from './server.mjs';

const realFetch = globalThis.fetch;
const previousKey = process.env.TYPESAFE_API_KEY;
const secret = 'server-only-test-key';
process.env.TYPESAFE_API_KEY = secret;
let upstreamCalls = 0;
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(options.headers.Authorization, `Bearer ${secret}`);
  assert.equal(options.headers.Origin, undefined);
  const request = JSON.parse(options.body);
  assert.equal(request.model, 'jev-latest');
  const choices = Object.keys(request.questions.move.criteria);
  assert.deepEqual(choices, ['right', 'down']);
  upstreamCalls++;
  return new Response(JSON.stringify({ answers: { move: {
    type: 'choice', choice: 'right', confidence: 0.7,
    probabilities: { right: 0.9, down: 0.1 }
  } } }));
};
const server = createAppServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const payload = { board: [2, ...Array(15).fill(0)], instructions: 'Pick a move.' };
const post = (body, headers = {}) => realFetch(`${base}/api/jev`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});
try {
  const page = await realFetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /app.js/);
  for (const path of ['/.env', '/.env.example', '/server.mjs', '/jev.mjs', '/package.json', '/.git/config', '/%2eenv']) {
    assert.equal((await realFetch(base + path)).status, 404);
  }
  const bundle = await readFile(new URL('./dist/app.js', import.meta.url), 'utf8');
  assert.ok(!bundle.includes('api.typesafe.ai') && !bundle.includes('Bearer '));
  assert.equal((await realFetch(base + '/api/jev')).status, 405);
  assert.equal((await post(payload, { Origin: 'https://untrusted.example' })).status, 403);
  const wrongHost = await new Promise((resolve, reject) => {
    get(base, { headers: { Host: 'untrusted.example' } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(wrongHost, 403);
  assert.equal((await post(payload, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(null)).status, 400);
  assert.equal((await post({ ...payload, board: [3] })).status, 400);
  assert.equal((await post({ ...payload, instructions: '' })).status, 400);
  assert.equal((await post({ ...payload, instructions: 'x'.repeat(70000) })).status, 413);
  assert.equal(upstreamCalls, 0);
  delete process.env.TYPESAFE_API_KEY;
  const missing = await post(payload);
  assert.equal(missing.status, 503);
  assert.match((await missing.json()).error, /TYPESAFE_API_KEY/);
  process.env.TYPESAFE_API_KEY = secret;
  const success = await post(payload);
  assert.equal(success.status, 200);
  const text = await success.text();
  assert.ok(!text.includes(secret));
  const result = JSON.parse(text);
  assert.equal(result.answer.choice, 'right');
  assert.ok(Number.isFinite(result.elapsed));
  assert.equal(upstreamCalls, 1);
  globalThis.fetch = async () => new Response(secret, { status: 401 });
  const failed = await post(payload);
  assert.equal(failed.status, 502);
  assert.match((await failed.json()).error, /key was rejected/);
  globalThis.fetch = async () => { throw new Error(secret); };
  const networkError = await post(payload);
  assert.equal(networkError.status, 502);
  assert.ok(!(await networkError.text()).includes(secret));
  const started = Promise.withResolvers();
  const cancelled = Promise.withResolvers();
  globalThis.fetch = async (_, { signal }) => new Promise((resolve, reject) => {
    started.resolve();
    signal.addEventListener('abort', () => {
      cancelled.resolve();
      reject(signal.reason);
    }, { once: true });
  });
  const controller = new AbortController();
  const pending = realFetch(`${base}/api/jev`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: controller.signal
  });
  await started.promise;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await Promise.race([
    cancelled.promise,
    setTimeout(1000).then(() => { throw new Error('Disconnect did not cancel the upstream request'); })
  ]);
  console.log('Local server checks passed (routing, secret isolation, validation, API forwarding, and cancellation)');
} finally {
  globalThis.fetch = realFetch;
  if (previousKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = previousKey;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
