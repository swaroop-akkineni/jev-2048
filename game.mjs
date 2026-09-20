import { newGame, move, isGameOver } from './engine.mjs';

const boardElement = document.querySelector('#board');
const scoreElement = document.querySelector('#score');
const statusElement = document.querySelector('#status');
let board = newGame();
let over = false;

const tiles = Array.from({ length: 16 }, () => {
  const tile = document.createElement('div');
  boardElement.append(tile);
  return tile;
});

function render() {
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
  const won = board.some(value => value >= 2048);
  statusElement.textContent = over
    ? `Game over. Final score: ${score}.${won ? ' You reached 2048!' : ''}`
    : won ? 'You reached 2048! Keep playing or start a new game.' : 'Reach 2048!';
}

function play(direction) {
  if (over) return;
  const result = move(board, direction);
  if (!result.moved) return;
  board = result.board;
  render();
}

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
