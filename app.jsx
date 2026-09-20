import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { boardRows, newGame, move, isGameOver } from './engine.mjs';
import './style.css';

const defaultInstructions = 'Choose the best next move to reach the highest tile in 2048. `board` is a 4×4 array: rows run top to bottom, columns left to right, and 0 means empty. Equal tiles merge once per move. A random 2 or 4 appears after each move. Only legal moves are offered.';

function App() {
  const [board, setBoard] = useState(newGame);
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const gesture = useRef(null);
  const score = Math.max(...board);
  const over = isGameOver(board);

  function clearResult() {
    setResult(null);
    setError('');
  }

  function play(direction) {
    if (over || pending.current) return;
    const next = move(board, direction);
    if (!next.moved) return;
    setBoard(next.board);
    clearResult();
  }

  useEffect(() => {
    function onKey(event) {
      const direction = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }[event.key];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      play(direction);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [board]);

  async function submit(event) {
    event.preventDefault();
    if (over || pending.current) return;
    pending.current = true;
    setBusy(true);
    clearResult();
    try {
      const response = await fetch('/api/jev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board, instructions }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The request failed. Try again.');
      setResult(data);
    } catch (error) {
      setError(error.name === 'TimeoutError' ? 'The request timed out. Try again.' :
        error instanceof TypeError ? 'Could not reach the local server. Check that npm start is running.' : error.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function startSwipe(event) {
    if (!event.isPrimary || event.button !== 0 || pending.current) return;
    gesture.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function endSwipe(event) {
    if (!event.isPrimary || !gesture.current) return;
    const dx = event.clientX - gesture.current.x;
    const dy = event.clientY - gesture.current.y;
    gesture.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }

  return <>
    <main>
      <h1>jev-2048</h1>
      <p>Score: <output>{score}</output></p>
      <p id="instructions">Use arrow keys or swipe. Merge equal tiles to reach 2048.</p>
      <div id="board" role="group" aria-label="2048 board" aria-describedby="instructions" tabIndex="0"
        onPointerDown={startSwipe} onPointerUp={endSwipe} onPointerCancel={() => { gesture.current = null; }}>
        {board.map((value, index) => <div key={index} className={value >= 128 ? 'tile high' : 'tile'} data-value={value}
          aria-label={`Row ${Math.floor(index / 4) + 1}, column ${index % 4 + 1}: ${value || 'empty'}`}>
          {value || ''}
        </div>)}
      </div>
      <p id="status" role="status">{over ? `Game over. Final score: ${score}. Refresh to start again.` :
        score >= 2048 ? 'You reached 2048! Keep playing or refresh to start again.' : 'Reach 2048!'}</p>
      <section aria-labelledby="jev-heading">
        <h2 id="jev-heading">Ask Jev</h2>
        <p>Get one move recommendation. Play it yourself with arrow keys or a swipe.</p>
        <form onSubmit={submit} aria-busy={busy}>
          <label htmlFor="jev-instructions">Instructions</label>
          <textarea id="jev-instructions" rows="5" maxLength="8000" required disabled={busy} value={instructions}
            onChange={event => { setInstructions(event.target.value); clearResult(); }} />
          <p id="board-input-label">Board input (read-only)</p>
          <pre id="board-input" role="region" aria-labelledby="board-input-label">
            {'[\n' + boardRows(board).map(row => '  ' + JSON.stringify(row)).join(',\n') + '\n]'}
          </pre>
          <button type="submit" disabled={busy || over}>{busy ? 'Asking Jev…' : 'Submit'}</button>
        </form>
        <p id="jev-status" role="status">{error || (result ? `Jev suggests ${result.answer.choice}. The board has not moved.` : '')}</p>
        {result && <pre>{[
          `Suggested move: ${result.answer.choice}`,
          ...Object.entries(result.answer.probabilities).map(([direction, value]) => `${direction}: ${(value * 100).toFixed(1)}%`),
          `Confidence: ${(result.answer.confidence * 100).toFixed(1)}%`,
          `Response time: ${result.elapsed} ms`
        ].join('\n')}</pre>}
      </section>
    </main>
    <footer>Inspired by <a href="https://github.com/gabrielecirulli/2048">2048 by Gabriele Cirulli and contributors</a>.</footer>
  </>;
}

createRoot(document.querySelector('#root')).render(<App />);
