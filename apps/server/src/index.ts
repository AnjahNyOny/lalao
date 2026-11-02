import { createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lobby } from '@game/core';
import { games } from '@game/games';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));
const HEARTBEAT_MS = 15_000;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
};

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = path.join(CLIENT_DIST, urlPath);
  if (path.relative(CLIENT_DIST, file).startsWith('..')) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error();
  } catch {
    // Single-page app: unknown paths get the index.
    file = path.join(CLIENT_DIST, 'index.html');
  }
  try {
    statSync(file);
  } catch {
    res.writeHead(404).end('Client non compilé : lance `npm run build`.');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/lan') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ addresses: lanAddresses() }));
    return;
  }
  serveStatic(req, res);
});

const lobby = new Lobby(games);
const wss = new WebSocketServer({ server, path: '/ws' });
const alive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws) => {
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));

  const session = lobby.connect({
    send: (msg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
  });

  ws.on('message', (data) => {
    let msg: unknown;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    session.receive(msg);
  });
  ws.on('close', () => session.close());
});

// Phones drop off Wi-Fi without closing the socket; ping to notice.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.get(ws)) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`Serveur de jeu sur le port ${PORT}`);
  for (const ip of lanAddresses()) console.log(`  réseau local : http://${ip}:${PORT}`);
});
