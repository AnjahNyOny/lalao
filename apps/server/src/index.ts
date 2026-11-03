import { createReadStream, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lobby } from '@game/core';
import { games } from '@game/games';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 3000);
/** Behind nginx online: listen on 127.0.0.1 only. Locally: the whole Wi-Fi. */
const HOST = process.env.HOST ?? '0.0.0.0';
const CLIENT_DIST = process.env.CLIENT_DIST ?? fileURLToPath(new URL('../../client/dist', import.meta.url));
const HEARTBEAT_MS = 15_000;

// Guards for a public server. Messages are small JSON; many players can share
// one address (mobile carriers, a café's Wi-Fi), so the per-address cap is loose.
const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? Infinity);
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_CONNECTIONS_PER_IP = 40;
/** Token bucket: a burst of 30 messages, then 10 per second. */
const RATE_BURST = 30;
const RATE_PER_SECOND = 10;
/** A client that keeps flooding after this many dropped messages is cut off. */
const MAX_DROPPED = 100;

/** Written next to the bundle by scripts/deploy.sh. */
const VERSION = (() => {
  try {
    return readFileSync(new URL('./VERSION', import.meta.url), 'utf8').trim();
  } catch {
    return 'dev';
  }
})();

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
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, version: VERSION, rooms: lobby.roomCount }));
    return;
  }
  if (req.url === '/api/lan') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ addresses: lanAddresses() }));
    return;
  }
  serveStatic(req, res);
});

const lobby = new Lobby(games, undefined, undefined, MAX_ROOMS);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });
const alive = new WeakMap<WebSocket, boolean>();
const perIp = new Map<string, number>();

/** The player's address: nginx passes it along when it forwards the connection. */
function clientIp(req: http.IncomingMessage): string {
  const direct = req.socket.remoteAddress ?? '';
  const forwarded = req.headers['x-forwarded-for'];
  const loopback = direct === '127.0.0.1' || direct === '::1' || direct === '::ffff:127.0.0.1';
  if (loopback && typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return direct;
}

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  const count = (perIp.get(ip) ?? 0) + 1;
  if (count > MAX_CONNECTIONS_PER_IP) {
    ws.close(1013, 'Trop de connexions');
    return;
  }
  perIp.set(ip, count);
  ws.on('close', () => {
    const left = (perIp.get(ip) ?? 1) - 1;
    if (left > 0) perIp.set(ip, left);
    else perIp.delete(ip);
  });

  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));
  let tokens = RATE_BURST;
  let refilled = Date.now();
  let dropped = 0;

  const session = lobby.connect({
    send: (msg) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
  });

  ws.on('message', (data) => {
    const now = Date.now();
    tokens = Math.min(RATE_BURST, tokens + ((now - refilled) / 1000) * RATE_PER_SECOND);
    refilled = now;
    if (tokens < 1) {
      if (++dropped > MAX_DROPPED) ws.close(1008, 'Trop de messages');
      return;
    }
    tokens--;
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

server.listen(PORT, HOST, () => {
  console.log(`Serveur de jeu ${VERSION} sur ${HOST}:${PORT}`);
  if (HOST === '0.0.0.0') for (const ip of lanAddresses()) console.log(`  réseau local : http://${ip}:${PORT}`);
});
