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

Results show the suggested move, probabilities, confidence, and request time.
The game does not move automatically. Moves and instruction edits pause during
a request; subsequent moves or edits clear the result. Requests time out, and
errors are displayed without automatically retrying paid API calls.

The server binds only to `127.0.0.1`, serves only the HTML and bundled assets, and
rejects requests from other website origins. The key stays server-side: it is
never included in the browser bundle, responses, or logs. `.env`, `node_modules/`,
and `dist/` are ignored by Git; `.env.example` is safe to commit.

This version runs locally with Node; it cannot run as a GitHub Pages static site.

## Checks

```sh
npm run build
npm test
```

Tests cover the engine, TypeSafe request/response handling, and the local HTTP
endpoint (including blocked secret files, cross-origin requests, malformed inputs,
and simulated upstream success/failure). Tests use a fake key and make no live
TypeSafe calls.

Inspired by [2048 by Gabriele Cirulli and contributors](https://github.com/gabrielecirulli/2048).
This project implements its own engine and interface.
