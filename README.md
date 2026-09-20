# jev-2048

A small 2048 game for learning how to use Jev. Play manually and ask Jev for a move recommendation.

Use arrow keys or swipe the board. Equal tiles merge once per move.
Your score is the highest tile currently on the board. Each valid move adds a tile
(90% chance of 2, 10% chance of 4). You can keep playing after reaching 2048. Refresh the page to start a new game.

Serve locally with `python3 -m http.server 8000`, then open http://localhost:8000.
Run checks with `node engine.test.mjs` and `node jev.test.mjs`. No dependencies or build step.
GitHub Pages publishes the root of `main` after a PR is merged.

## Ask Jev

Enter your own TypeSafe API key and edit the instructions, then press Submit.
The board is shown as a read-only 4×4 array. Each request uses `jev-latest` with
a Choice question containing only legal moves. Results show the suggested move,
probabilities, confidence, and elapsed request time; the game does not move automatically.
Moves and form edits are paused during a request. Moving afterward or editing
instructions clears the old result.

The key is kept in memory only, masked except for the first 3 and last 4 characters
when the field is unfocused, and cleared on refresh. Short keys are fully masked.
It is sent directly to `https://api.typesafe.ai/v1/systemone` in the Authorization
header. No backend, SDK, analytics, or browser storage is used. Masking is visual;
the key is still accessible to your browser while the page is open.

This is a direct browser integration for testing TypeSafe access. The API must
permit the page's origin through CORS. A preflight with the GitHub Pages origin
returned `400 Disallowed CORS origin` on 2026-09-20; a live browser test from the
published site is still pending. The UI reports network/CORS failures without
claiming which occurred; check the browser console for the exact cause. No automatic
retries or paid requests are made before Submit. Tests use a fake API response;
successful live inference requires a valid key and an allowed origin.

Inspired by [2048 by Gabriele Cirulli and contributors](https://github.com/gabrielecirulli/2048).
This project implements its own engine and interface.
