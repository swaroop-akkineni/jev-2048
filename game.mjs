import { newGame, move, isGameOver } from './engine.mjs';
import { boardRows, maskKey, createRequest, askJev } from './jev.mjs';

const boardElement = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const statusElement = document.querySelector('#status');
const boardInput = document.querySelector('#board-input');
const keyInput = document.querySelector('#api-key');
const jevForm = document.querySelector('#jev-form');
const instructionsInput = document.querySelector('#jev-instructions');
const submitButton = document.querySelector('#jev-submit');
const jevStatus = document.querySelector('#jev-status');
const jevResult = document.querySelector('#jev-result');
keyInput.value = '';
let busy = false;
let apiKey = '';

// Keep the actual key separate from its display; never persist it.
keyInput.addEventListener('focus', () => {
  keyInput.type = 'password';
  keyInput.value = apiKey;
});
keyInput.addEventListener('input', () => { apiKey = keyInput.value.trim(); });
keyInput.addEventListener('blur', () => {
  keyInput.value = maskKey(apiKey);
  keyInput.type = 'text';
});

let board = newGame();
let over = false;

const tiles = Array.from({ length: 16 }, () => {
  const tile = document.createElement('div');
  boardElement.append(tile);
  return tile;
});

function render() {
  boardInput.textContent = '[\n' + boardRows(board).map(row => '  ' + JSON.stringify(row)).join(',\n') + '\n]';
  board.forEach((value, index) => {
    const tile = tiles[index];
    tile.className = value >= 128 ? 'tile high' : 'tile';
    tile.dataset.value = value;
    tile.textContent = value || '';
    tile.setAttribute('aria-label', `Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}: ${value || 'empty'}`);
  });
  const score = Math.max(...board);
  scoreElement.value = score;
  over = isGameOver(board);
  submitButton.disabled = over || busy;
  const won = board.some(value => value >= 2048);
  statusElement.textContent = over
    ? `Game over. Final score: ${score}.${won ? ' You reached 2048!' : ''}`
    : won ? 'You reached 2048! Keep playing or start a new game.' : 'Reach 2048!';
}

function play(direction) {
  if (over || busy) return;
  const result = move(board, direction);
  if (!result.moved) return;
  board = result.board;
  clearAnswer();
  render();
}

function clearAnswer() {
  jevResult.hidden = true;
  jevResult.textContent = '';
  jevStatus.textContent = '';
}

instructionsInput.addEventListener('input', clearAnswer);
jevForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || over) return;
  clearAnswer();
  try {
    const request = createRequest(board, instructionsInput.value);
    busy = true;
    submitButton.disabled = true;
    keyInput.disabled = true;
    instructionsInput.disabled = true;
    jevForm.setAttribute('aria-busy', 'true');
    jevStatus.textContent = 'Asking Jev…';
    const start = performance.now();
    const answer = await askJev(request, apiKey);
    const elapsed = Math.round(performance.now() - start);
    jevResult.textContent = [
      `Suggested move: ${answer.choice}`,
      ...Object.entries(answer.probabilities).map(([direction, probability]) => `${direction}: ${(probability * 100).toFixed(1)}%`),
      `Confidence: ${(answer.confidence * 100).toFixed(1)}%`,
      `Response time: ${elapsed} ms`
    ].join('\n');
    jevResult.hidden = false;
    jevStatus.textContent = `Jev suggests ${answer.choice}. The board has not moved.`;
  } catch (error) {
    jevStatus.textContent = error.message;
  } finally {
    busy = false;
    submitButton.disabled = over;
    keyInput.disabled = false;
    instructionsInput.disabled = false;
    jevForm.setAttribute('aria-busy', 'false');
  }
});

document.addEventListener('keydown', event => {
  const direction = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }[event.key];
  if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  event.preventDefault();
  play(direction);
});

let gesture;
boardElement.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  gesture = { x: event.clientX, y: event.clientY };
  boardElement.setPointerCapture(event.pointerId);
});
boardElement.addEventListener('pointerup', event => {
  if (!gesture || !event.isPrimary) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  gesture = undefined;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
boardElement.addEventListener('pointercancel', () => { gesture = undefined; });
render();
