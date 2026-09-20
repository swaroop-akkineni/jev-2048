# jev-2048

A small local 2048 app for learning Jev: React for the UI, Node's built-in HTTP
server for API calls, and esbuild to bundle the browser code. No backend framework
or TypeSafe SDK.

## Run

Requires Node 22.9+ (Node 24 recommended).

```sh
npm install
cp .env.example .env  # first setup only; keep an existing .env
```

Set `TYPESAFE_API_KEY=your_key` in `.env`, then:

```sh
npm start
```

Open http://127.0.0.1:8048. Startup builds the UI and loads `.env` with Node's
native environment-file support. Restart after changing `.env` or code. Stop with
Ctrl+C. To use another port, add `PORT=8049` to `.env`.

Use arrow keys or swipe. Equal tiles merge once per move; your score is the highest
tile. Each valid move adds a tile (90% chance of 2, 10% chance of 4). Keep playing
past 2048, or refresh to start again.

## Ask Jev

Edit the instructions and inspect the read-only 4×4 board array, then Submit.
The browser sends the board and instructions to `/api/jev` on the same local
server. Node validates them, adds the key from `.env`, and calls TypeSafe with
`jev-latest` and a Choice question containing only legal moves. This avoids the
cross-origin browser call that TypeSafe rejects.

The Jev panel sits beside the board on desktop and below it on smaller screens.
State shows the current board as sent to the API. Question has editable instructions
and an expandable preview of the actual question JSON, including legal choices.
Answers shows the returned move, probabilities, and confidence as JSON, with request
time underneath.

Submit gets one suggestion without moving. Start repeatedly asks Jev and plays its
chosen move, sending the updated board each time. Only one request runs at a time.
Stop cancels the current request and discards any late response; Start resumes from
the current board. Autoplay also stops on game over, timeout, or error, without
retrying failed API calls. Keyboard/swipe moves and instruction edits pause while
Jev is running; manual moves or edits clear the result. The server cancels its
upstream fetch when the browser disconnects; an already-sent request may still be
processed by TypeSafe.

The server binds only to `127.0.0.1`, serves only the HTML and bundled assets, and
rejects requests from other website origins. The key stays server-side: it is
never included in the browser bundle, responses, or logs. `.env`, `node_modules/`,
and `dist/` are ignored by Git; `.env.example` is safe to commit.

This version runs locally with Node; it cannot run as a GitHub Pages static site.

## Metrics

The Metrics section below the game shows a histogram of successful Jev response
times from both Submit and autoplay, plus their count and average. Times are in
milliseconds as measured by the Node server around the TypeSafe request, excluding
the browser-to-local-server trip. Failed or cancelled calls are not counted.

The latest 10,000 timings are saved in this browser and survive game refreshes.
Clear metrics starts a new sample set. If browser storage is unavailable, timings
still accumulate for the current page. No API keys, prompts, or boards are saved.

## Checks

```sh
npm run build
npm test
```

Tests cover the engine, sequential autoplay and cancellation, TypeSafe
request/response handling, and the local HTTP endpoint (including blocked secret files, cross-origin requests, malformed inputs,
and simulated upstream success/failure). Tests use a fake key and make no live
TypeSafe calls.

Inspired by [2048 by Gabriele Cirulli and contributors](https://github.com/gabrielecirulli/2048).
This project implements its own engine and interface.
