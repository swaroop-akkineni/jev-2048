import { isGameOver, move } from './engine.mjs';

export async function runJev(board, instructions, { signal, continuous, onAnswer }) {
  do {
    signal.throwIfAborted();
    if (isGameOver(board)) return;
    const response = await fetch('/api/jev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, instructions }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)])
    });
    const data = await response.json();
    // Stop also discards a response that arrived just before cancellation.
    signal.throwIfAborted();
    if (!response.ok) throw new Error(data.error || 'The request failed. Try again.');
    if (continuous) {
      const next = move(board, data.answer.choice);
      if (!next.moved) throw new Error('Jev returned a move that does not change the board.');
      board = next.board;
    }
    onAnswer(board, data);
  } while (continuous);
}
