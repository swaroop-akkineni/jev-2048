import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequest, askJev } from './jev.mjs';

// Only these public files are served; .env and server source are never exposed.
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['dist/app.js', 'text/javascript; charset=utf-8']],
  ['/app.css', ['dist/app.css', 'text/css; charset=utf-8']]
]);

export function createAppServer() {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    const port = req.socket.localPort;
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) {
      return send(403, { error: 'Local access only.' });
    }
    const pathname = req.url.split('?')[0];
    if (pathname !== '/api/jev') {
      const asset = assets.get(pathname);
      if (!asset || !['GET', 'HEAD'].includes(req.method)) return send(404, { error: 'Not found.' });
      try {
        const content = await readFile(new URL(asset[0], import.meta.url));
        res.writeHead(200, { 'Content-Type': asset[1] });
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch {
        send(500, { error: 'Could not load the app. Run npm run build, then restart.' });
      }
      return;
    }
    if (req.method !== 'POST') return send(405, { error: 'Use POST.' });
    if ((req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) ||
        req.headers['sec-fetch-site'] === 'cross-site') {
      return send(403, { error: 'Use the app from this local server.' });
    }
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
      return send(415, { error: 'Send application/json.' });
    }
    let request;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > 65536) {
          res.setHeader('Connection', 'close');
          return send(413, { error: 'Request is too large.' });
        }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      request = createRequest(body?.board, body?.instructions);
    } catch (error) {
      return send(400, { error: error instanceof SyntaxError ? 'Send valid JSON.' : 'Provide a valid 4×4 board, legal move, and 1–8000 character instructions.' });
    }
    const key = process.env.TYPESAFE_API_KEY?.trim();
    if (!key) return send(503, { error: 'Add TYPESAFE_API_KEY to .env, then restart npm start.' });
    const controller = new AbortController();
    res.once('close', () => controller.abort());
    if (res.destroyed) return;
    try {
      const start = performance.now();
      const answer = await askJev(request, key, controller.signal);
      send(200, { answer, elapsed: Math.round(performance.now() - start) });
    } catch (error) {
      // askJev exposes only fixed messages, never upstream bodies or credentials.
      send(502, { error: error.message });
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8048);
  const server = createAppServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Stop the old server or set PORT.` : 'Could not start the local server.');
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`jev-2048: http://127.0.0.1:${port}`));
}
