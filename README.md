# jev-2048

A small 2048 game for learning how to use Jev. Currently manual play only.

Use arrow keys or swipe the board. Equal tiles merge once per move.
Your score is the highest tile currently on the board. Each valid move adds a tile
(90% chance of 2, 10% chance of 4). You can keep playing after reaching 2048. Refresh the page to start a new game.

Serve locally with `python3 -m http.server 8000`, then open http://localhost:8000.
Run engine checks with `node engine.test.mjs`. No dependencies or build step.
GitHub Pages publishes the root of `main` after a PR is merged.

Inspired by [2048 by Gabriele Cirulli and contributors](https://github.com/gabrielecirulli/2048).
This project implements its own engine and interface.
