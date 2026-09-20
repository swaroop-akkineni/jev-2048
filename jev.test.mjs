import assert from 'node:assert/strict';
import { createRequest, readAnswer, askJev } from './jev.mjs';
import { boardRows } from './engine.mjs';

const board = [2, ...Array(15).fill(0)];
assert.deepEqual(boardRows(board), [[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
const request = createRequest(board, ' Pick a move. ');
assert.equal(request.model, 'jev-latest');
assert.equal(request.questions.move.instructions, 'Pick a move.');
assert.deepEqual(Object.keys(request.questions.move.criteria), ['right', 'down']);
assert.deepEqual(request.state.board, boardRows(board));
assert.throws(() => createRequest(board, ' '), /instructions/);
assert.throws(() => createRequest([3, ...board.slice(1)], 'Move'), /board/);
assert.throws(() => createRequest([2], 'Move'), /board/);
assert.throws(() => createRequest([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2], 'Move'), /Game over/);
const answer = { type: 'choice', choice: 'right', confidence: 0.5, probabilities: { right: 0.8, down: 0.2 } };
assert.deepEqual(readAnswer({ answers: { move: answer } }, request), answer);
for (const invalid of [null, {}, { ...answer, choice: 'left' }, { ...answer, confidence: 'high' }, { ...answer, probabilities: { right: 1, down: 1 } }]) {
  assert.throws(() => readAnswer({ answers: { move: invalid } }, request), /unexpected response/);
}
const originalFetch = globalThis.fetch;
let calls = 0;
try {
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer fake-test-key');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), request);
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ answers: { move: answer } }));
  };
  await assert.rejects(askJev(request, ' '), /TYPESAFE_API_KEY/);
  assert.equal(calls, 0);
  assert.deepEqual(await askJev(request, ' fake-test-key '), answer);
  assert.equal(calls, 1);
  for (const status of [401, 403, 422, 429, 500, 529]) {
    globalThis.fetch = async () => new Response('never display or log this body', { status });
    await assert.rejects(askJev(request, 'fake-test-key'), error => !error.message.includes('never display'));
  }
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(askJev(request, 'fake-test-key'), /could not reach TypeSafe/);
  globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
  await assert.rejects(askJev(request, 'fake-test-key'), /15 seconds/);
  globalThis.fetch = async () => new Response('not JSON');
  await assert.rejects(askJev(request, 'fake-test-key'), /Could not read/);
  globalThis.fetch = async () => new Response('{}');
  await assert.rejects(askJev(request, 'fake-test-key'), /unexpected response/);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Jev request, response, and network checks passed');
