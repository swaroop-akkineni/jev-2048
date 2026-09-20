import { directions, slide, boardRows } from './engine.mjs';

export function createRequest(board, instructions) {
  if (!Array.isArray(board) || board.length !== 16 || board.some(value =>
    !Number.isSafeInteger(value) || value < 0 || (value !== 0 && (value < 2 || !Number.isInteger(Math.log2(value)))))) {
    throw new Error('Expected a 4×4 board of empty cells or powers of two.');
  }
  if (typeof instructions !== 'string' || !instructions.trim() || instructions.length > 8000) {
    throw new Error('Enter instructions between 1 and 8000 characters.');
  }
  const legal = directions.filter(direction => slide(board, direction).moved);
  if (!legal.length) throw new Error('Game over: no legal moves to ask Jev about.');
  return {
    model: 'jev-latest',
    state: { board: boardRows(board) },
    questions: {
      move: {
        type: 'choice',
        instructions: instructions.trim(),
        criteria: Object.fromEntries(legal.map(direction => [direction, `Slide the tiles ${direction}.`]))
      }
    }
  };
}

export function readAnswer(data, request) {
  const answer = data?.answers?.move;
  const options = Object.keys(request.questions.move.criteria);
  const probability = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  if (answer?.type !== 'choice' || !options.includes(answer.choice) || !probability(answer.confidence) ||
      !answer.probabilities || Object.keys(answer.probabilities).length !== options.length ||
      options.some(option => !probability(answer.probabilities[option])) ||
      Math.abs(Object.values(answer.probabilities).reduce((sum, value) => sum + value, 0) - 1) > 0.01) {
    throw new Error('Jev returned an unexpected response. Please try again.');
  }
  return answer;
}

export async function askJev(request, apiKey) {
  if (!apiKey.trim()) throw new Error('Add TYPESAFE_API_KEY to .env, then restart npm start.');
  let response;
  try {
    response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15000),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error'
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('Jev did not respond within 15 seconds. Try again.');
    }
    throw new Error('The local server could not reach TypeSafe. Check your connection and try again.');
  }
  if (!response.ok) {
    const messages = {
      401: 'The API key was rejected. Check your key.',
      403: 'TypeSafe denied access. Check your account permissions.',
      422: 'TypeSafe rejected the request format.',
      429: 'Rate limit reached. Wait a moment before trying again.',
      529: 'TypeSafe is busy. Try again shortly.'
    };
    throw new Error(messages[response.status] || `TypeSafe returned HTTP ${response.status}. Try again later.`);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Could not read the TypeSafe response. Try again.');
  }
  return readAnswer(data, request);
}
