export const directions = ['up', 'right', 'down', 'left'];

// Return the board before spawning, so callers can inspect each possible move.
export function slide(board, direction) {
  if (!directions.includes(direction)) throw new Error('Unknown direction');
  const next = board.slice();
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, offset) => {
      if (direction === 'left') return line * 4 + offset;
      if (direction === 'right') return line * 4 + 3 - offset;
      if (direction === 'up') return offset * 4 + line;
      return (3 - offset) * 4 + line;
    });
    const values = indices.map(index => board[index]).filter(Boolean);
    const merged = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        merged.push(values[i] * 2);
        i++;
      } else {
        merged.push(values[i]);
      }
    }
    indices.forEach((index, i) => { next[index] = merged[i] || 0; });
  }
  return { board: next, moved: next.some((value, i) => value !== board[i]) };
}

export function spawn(board, random = Math.random) {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  const next = board.slice();
  if (empty.length) next[empty[Math.floor(random() * empty.length)]] = random() < 0.9 ? 2 : 4;
  return next;
}

export function newGame() {
  return spawn(spawn(Array(16).fill(0)));
}

export function move(board, direction, random = Math.random) {
  const result = slide(board, direction);
  return { ...result, board: result.moved ? spawn(result.board, random) : result.board };
}

export function isGameOver(board) {
  return directions.every(direction => !slide(board, direction).moved);
}

export function boardRows(board) {
  return Array.from({ length: 4 }, (_, row) => board.slice(row * 4, row * 4 + 4));
}
