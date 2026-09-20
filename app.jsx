import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { boardRows, newGame, move, isGameOver } from './engine.mjs';
import { createRequest } from './jev.mjs';
import { runJev } from './player.mjs';
import { MAX_SAMPLES, readTimings, writeTimings, histogram } from './metrics.mjs';
import './style.css';

const defaultInstructions = 'Choose the best next move to reach the highest tile in 2048. `board` is a 4×4 array: rows run top to bottom, columns left to right, and 0 means empty. Equal tiles merge once per move. A random 2 or 4 appears after each move. Only legal moves are offered.';

function App() {
  const [board, setBoard] = useState(newGame);
  const [instructions, setInstructions] = useState(defaultInstructions);
  const [activity, setActivity] = useState('');
  const busy = activity !== '';
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [timings, setTimings] = useState(readTimings);
  const [metricsSaved, setMetricsSaved] = useState(true);
  const pending = useRef(null);
  const gesture = useRef(null);
  const score = Math.max(...board);
  const over = isGameOver(board);
  const { bins, average } = histogram(timings);
  const largestBin = Math.max(1, ...bins.map(bin => bin.count));
  const request = !over && instructions.trim() ? createRequest(board, instructions) : null;

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

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { setMetricsSaved(writeTimings(timings)); }, [timings]);

  async function submit(event) {
    event.preventDefault();
    if (over || pending.current || !instructions.trim()) return;
    const continuous = event.nativeEvent.submitter?.value === 'start';
    const controller = new AbortController();
    pending.current = controller;
    setActivity(continuous ? 'loop' : 'once');
    clearResult();
    try {
      await runJev(board, instructions, {
        signal: controller.signal,
        continuous,
        onAnswer(nextBoard, data) {
          setBoard(nextBoard);
          setResult({ ...data, played: continuous });
          // ponytail: retain 10,000 timings; use a database only if longer history is needed.
          setTimings(previous => [...previous, data.elapsed].slice(-MAX_SAMPLES));
        }
      });
    } catch (error) {
      setError(controller.signal.aborted ? 'Stopped.' :
        error.name === 'TimeoutError' ? 'The request timed out. Try again.' :
        error instanceof TypeError ? 'Could not reach the local server. Check that npm start is running.' : error.message);
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setActivity('');
      }
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
    <h1>jev-2048</h1>
    <main>
      <section aria-label="Game">
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
      </section>
      <section aria-labelledby="jev-heading">
        <h2 id="jev-heading">Ask Jev</h2>
        <p>Submit for one suggestion, or Start to let Jev play until you press Stop.</p>
        <form onSubmit={submit}>
          <h3 id="board-input-label">State</h3>
          <pre id="board-input" role="region" aria-labelledby="board-input-label">
            {'{\n  "board": [\n' + boardRows(board).map(row => '    ' + JSON.stringify(row)).join(',\n') + '\n  ]\n}'}
          </pre>
          <h3>Question</h3>
          <label htmlFor="jev-instructions">Instructions</label>
          <textarea id="jev-instructions" rows="5" maxLength="8000" required disabled={busy} value={instructions}
            onChange={event => { setInstructions(event.target.value); clearResult(); }} />
          {request && <details>
            <summary>View question JSON</summary>
            <pre>{JSON.stringify(request.questions, null, 2)}</pre>
          </details>}
          <div className="actions">
            <button type="submit" value="once" disabled={busy || over || !instructions.trim()}>{activity === 'once' ? 'Asking Jev…' : 'Submit'}</button>
            {/* Keep Stop from becoming a submit button during its own click. */}
            {activity === 'loop' ?
              <button key="stop" type="button" onClick={() => pending.current?.abort()}>Stop</button> :
              <button key="start" type="submit" value="start" disabled={busy || over || !instructions.trim()}>Start</button>}
          </div>
        </form>
        <h3>Answers</h3>
        <p id="jev-status" role="status">{error || (result ?
          `Jev ${result.played ? 'played' : 'suggests'} ${result.answer.choice}.${activity === 'loop' ? ' Playing…' : ''}` :
          busy ? 'Asking Jev…' : 'No answer yet.')}</p>
        {result && <>
          <pre>{JSON.stringify({ move: result.answer }, null, 2)}</pre>
          <p>Response time: {result.elapsed} ms</p>
        </>}
      </section>
      <section id="metrics" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading">Metrics</h2>
        <p>Jev response times, measured by the server. Successful responses only.</p>
        <p>{metricsSaved ? 'Saved in this browser' : 'Browser storage unavailable; kept until refresh'} · Latest {MAX_SAMPLES.toLocaleString()} responses.</p>
        {timings.length ? <>
          <p>{timings.length.toLocaleString()} responses · Average: {average.toLocaleString()} ms</p>
          <figure className="histogram">
            <figcaption>Response time distribution</figcaption>
            <div className="histogram-labels" aria-hidden="true"><span>Time (ms)</span><span>Number of responses</span></div>
            <ol>
              {bins.map(bin => <li key={bin.from}>
                <span>{bin.from.toLocaleString()}–{bin.to.toLocaleString()}<span className="sr-only"> milliseconds:</span></span>
                <span className="histogram-track" aria-hidden="true"><span style={{ width: `${bin.count / largestBin * 100}%` }} /></span>
                <span>{bin.count}<span className="sr-only"> responses</span></span>
              </li>)}
            </ol>
          </figure>
          <button type="button" onClick={() => setTimings([])}>Clear metrics</button>
        </> : <p>Submit a question or start autoplay to collect response times.</p>}
      </section>
    </main>
    <footer>Inspired by <a href="https://github.com/gabrielecirulli/2048">2048 by Gabriele Cirulli and contributors</a>.</footer>
  </>;
}

createRoot(document.querySelector('#root')).render(<App />);
