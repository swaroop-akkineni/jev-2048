import assert from 'node:assert/strict';
import { runJev } from './player.mjs';
import { directions, slide } from './engine.mjs';

const originalFetch = globalThis.fetch;
const initial = [2, ...Array(15).fill(0)];
const response = choice => new Response(JSON.stringify({ answer: { choice }, elapsed: 1 }));
try {
  let calls = 0;
  let expectedBoard = initial;
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/jev');
    const { board, instructions } = JSON.parse(options.body);
    assert.deepEqual(board, expectedBoard, 'each request uses the board from the previous completed move');
    assert.equal(instructions, 'Play.');
    assert.equal(options.signal.aborted, false);
    calls++;
    return response(directions.find(direction => slide(board, direction).moved));
  };
  await assert.rejects(runJev(initial, 'Play.', {
    signal: controller.signal, continuous: true,
    onAnswer(board) {
      assert.notDeepEqual(board, expectedBoard);
      expectedBoard = board;
      if (calls === 3) controller.abort();
    }
  }), { name: 'AbortError' });
  assert.equal(calls, 3);

  // Stop while a request is pending: even a late successful response cannot move.
  const stopped = new AbortController();
  let requestSignal;
  globalThis.fetch = async (_, options) => {
    requestSignal = options.signal;
    stopped.abort();
    return response('right');
  };
  await assert.rejects(runJev(initial, 'Play.', {
    signal: stopped.signal, continuous: true,
    onAnswer() { assert.fail('applied a late answer after Stop'); }
  }), { name: 'AbortError' });
  assert.equal(requestSignal.aborted, true);

  // A new session can ask once without moving or looping.
  calls = 0;
  globalThis.fetch = async () => { calls++; return response('right'); };
  await runJev(initial, 'Play.', {
    signal: new AbortController().signal, continuous: false,
    onAnswer(board) { assert.deepEqual(board, initial); }
  });
  assert.equal(calls, 1);

  calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ error: 'Rate limit reached.' }), { status: 429 }); };
  await assert.rejects(runJev(initial, 'Play.', {
    signal: new AbortController().signal, continuous: true,
    onAnswer() { assert.fail('moved after a failed request'); }
  }), /Rate limit/);
  assert.equal(calls, 1, 'errors are not retried');

  calls = 0;
  await runJev([2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2], 'Play.', {
    signal: new AbortController().signal, continuous: true,
    onAnswer() { assert.fail('moved after game over'); }
  });
  assert.equal(calls, 0);
} finally {
  globalThis.fetch = originalFetch;
}
console.log('Player checks passed (updated boards, Stop, late answers, single requests, errors, and game over)');
