import assert from 'node:assert/strict';
import { MAX_SAMPLES, readTimings, writeTimings, histogram } from './metrics.mjs';

assert.deepEqual(histogram([]), { bins: [], average: 0 });
assert.deepEqual(histogram([0, 99, 100, 199, 200]), {
  average: 120,
  bins: [
    { from: 0, to: 99, count: 2 },
    { from: 100, to: 199, count: 2 },
    { from: 200, to: 299, count: 1 }
  ]
});
for (const samples of [[0], [500, 500, 500], [999, 1000, 14999]]) {
  const { bins } = histogram(samples);
  assert.ok(bins.length <= 10);
  assert.equal(bins.reduce((count, bin) => count + bin.count, 0), samples.length);
  for (const bin of bins) assert.equal(bin.count, samples.filter(value => value >= bin.from && value <= bin.to).length);
}

const originalStorage = globalThis.localStorage;
let stored = '[]';
try {
  globalThis.localStorage = {
    getItem: () => stored,
    setItem: (_, value) => { stored = value; }
  };
  assert.equal(writeTimings([125, 400]), true);
  assert.deepEqual(readTimings(), [125, 400]);
  stored = '[null, "10", -1, 2.5, 250]';
  assert.deepEqual(readTimings(), [250]);
  stored = JSON.stringify(Array.from({ length: MAX_SAMPLES + 2 }, (_, index) => index));
  assert.equal(readTimings().length, MAX_SAMPLES);
  assert.equal(readTimings()[0], 2);
  stored = 'invalid JSON';
  assert.deepEqual(readTimings(), []);
  stored = '{}';
  assert.deepEqual(readTimings(), []);
  assert.equal(writeTimings([]), true);
  assert.deepEqual(readTimings(), []);
  globalThis.localStorage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Full'); } };
  assert.deepEqual(readTimings(), []);
  assert.equal(writeTimings([125]), false);
} finally {
  if (originalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalStorage;
}
console.log('Metrics checks passed (bin boundaries, outliers, persistence, reset, and unavailable storage)');
