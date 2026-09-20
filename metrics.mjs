export const MAX_SAMPLES = 10000;
const storageKey = 'jev-2048-response-times';

export function readTimings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(saved) ? saved.filter(value => Number.isSafeInteger(value) && value >= 0).slice(-MAX_SAMPLES) : [];
  } catch {
    return [];
  }
}

export function writeTimings(samples) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(samples));
    return true;
  } catch {
    return false;
  }
}

export function histogram(samples) {
  if (!samples.length) return { bins: [], average: 0 };
  const max = Math.max(...samples);
  // At most ten equal-width bins, rounded to whole 100 ms intervals.
  const width = Math.max(100, Math.ceil((max + 1) / 1000) * 100);
  const bins = Array.from({ length: Math.floor(max / width) + 1 }, (_, index) => ({
    from: index * width, to: (index + 1) * width - 1, count: 0
  }));
  for (const sample of samples) bins[Math.floor(sample / width)].count++;
  return { bins, average: Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) };
}
