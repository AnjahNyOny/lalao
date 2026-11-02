/**
 * End-to-end check: starts the built server, plays a full game per mini-game
 * in Chrome (mobile + desktop players), and saves screenshots.
 *
 *   npm run verify                # every game
 *   npm run verify -- connect4    # one game
 *
 * Output: artifacts/verify/<game>/*.png, one PASS/FAIL line per check, exit 1 on failure.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { games } from '@game/games';
import { chromium, type Browser, type Page } from 'playwright-core';
import { scenarios } from './scenarios';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const OUT = path.join(ROOT, 'artifacts/verify');
const PORT = 3199;
const URL_BASE = `http://localhost:${PORT}/`;
const MAX_TURNS = 400;

const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };

let failures = 0;
const report = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};

function startServer(): Promise<() => void> {
  const child = spawn('npx', ['tsx', 'apps/server/src/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Le serveur ne démarre pas')), 15_000);
    child.stdout.on('data', (d: Buffer) => {
      if (d.toString().includes('Serveur de jeu')) {
        clearTimeout(timer);
        resolve(() => child.kill());
      }
    });
    child.stderr.on('data', (d: Buffer) => process.stderr.write(d));
  });
}

/** Distinct-colour count on a downscaled screenshot: catches blank or single-colour canvases. */
async function pixelStats(browser: Browser, png: Buffer): Promise<{ colors: number; dominant: number }> {
  const page = await browser.newPage();
  const stats = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    const counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return { colors: counts.size, dominant: Math.max(...counts.values()) / (64 * 64) };
  }, `data:image/png;base64,${png.toString('base64')}`);
  await page.close();
  return stats;
}

interface Player {
  page: Page;
  label: string;
  errors: string[];
}

async function newPlayer(browser: Browser, label: string, mobile: boolean): Promise<Player> {
  const ctx = await browser.newContext(mobile ? MOBILE : DESKTOP);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url;
    errors.push(url ? `${m.text()} (${url.replace(URL_BASE, '/')})` : m.text());
  });
  return { page, label, errors };
}

const lalao = (p: Player) =>
  p.page.evaluate(() => {
    const s = window.__lalao!.state();
    return { me: s.me, room: s.room, game: s.game };
  });

/** Solo against bots with the browser offline: the room runs inside the page. */
async function verifySolo(browser: Browser, gameId: string): Promise<void> {
  const game = games[gameId];
  const choose = scenarios[gameId];
  if (!game.bot || !choose) return;
  const dir = path.join(OUT, gameId);
  const p = await newPlayer(browser, 'mobile', true);
  // Fonts load lazily: let everything arrive before cutting the network.
  await p.page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await p.page.context().setOffline(true);
  await p.page.fill('input', 'Solo');
  await p.page.click('button:has-text("Solo vs bots")');
  await p.page.click('.segmented.level button:has-text("Difficile")');
  await p.page.screenshot({ path: path.join(dir, '5-solo-menu-mobile.png') });
  await p.page.click(`.game-tile:has-text("${game.name}")`);
  await p.page.waitForSelector('canvas');

  let result = null;
  let mine = 0;
  for (let i = 0; i < MAX_TURNS * 4 && !result; i++) {
    const s = await lalao(p);
    result = s.game?.result ?? null;
    const action = !result && s.game && s.me ? choose(s.game.view, s.me) : null;
    if (action !== null) {
      await p.page.evaluate((a) => window.__lalao!.act(a), action);
      mine++;
    }
    await p.page.waitForTimeout(150);
  }
  report(!!result, 'solo hors ligne : partie terminée contre le bot', result ? `${JSON.stringify(result.kind)} après ${mine} coups du joueur` : 'bloqué');
  await p.page.waitForTimeout(1200);
  await p.page.screenshot({ path: path.join(dir, '5-solo-resultat-mobile.png') });
  report(p.errors.length === 0, 'solo : console sans erreur', p.errors.slice(0, 3).join(' | '));
  await p.page.context().close();
}

async function verifyGame(browser: Browser, gameId: string): Promise<void> {
  const game = games[gameId];
  const choose = scenarios[gameId];
  const dir = path.join(OUT, gameId);
  mkdirSync(dir, { recursive: true });
  console.log(`\n== ${game.name} (${gameId})`);
  if (!choose) {
    report(false, 'scénario', `ajouter ${gameId} dans scripts/verify/scenarios.ts`);
    return;
  }

  // Host on mobile, guests alternate desktop / mobile.
  const players: Player[] = [];
  for (let i = 0; i < game.minPlayers; i++) {
    players.push(await newPlayer(browser, i % 2 ? 'desktop' : 'mobile', i % 2 === 0));
  }
  const [host, ...guests] = players;
  const shot = (p: Player, name: string) => p.page.screenshot({ path: path.join(dir, `${name}-${p.label}.png`) });

  await host.page.goto(URL_BASE);
  await host.page.fill('input', 'Hôte');
  await host.page.waitForTimeout(800); // let the menu backdrop render
  await shot(host, '1-accueil');
  await host.page.click(`.game-tile:has-text("${game.name}")`);
  await host.page.waitForSelector('.room-code');
  const code = (await host.page.textContent('.room-code'))!.trim();

  if (game.bot) {
    const count = () => host.page.evaluate(() => window.__lalao!.state().room!.players.length);
    await host.page.click('.add-bot button:has-text("Moyen")');
    await host.page.waitForFunction(() => window.__lalao!.state().room!.players.some((p) => p.bot === 'medium'));
    await shot(host, '2-salon-bot');
    await host.page.click('.remove-bot');
    await host.page.waitForFunction(() => window.__lalao!.state().room!.players.length === 1);
    report((await count()) === 1, 'bot ajouté puis retiré dans le salon');
  }

  for (const [i, g] of guests.entries()) {
    await g.page.goto(`${URL_BASE}?room=${code}`);
    await g.page.fill('input >> nth=0', `Invité ${i + 1}`);
    if (i === 0) {
      await g.page.waitForTimeout(800);
      await shot(g, '1-accueil');
    }
    await g.page.click('button:has-text("Rejoindre")');
    await g.page.waitForSelector('.room-code');
  }
  await host.page.waitForFunction((n) => window.__lalao!.state().room?.players.length === n, players.length);
  await shot(host, '2-salon');
  report(true, 'salon', `code ${code}, ${players.length} joueurs`);

  await host.page.click('button:has-text("Lancer la partie")');
  for (const p of players) await p.page.waitForSelector('canvas');
  await host.page.waitForTimeout(1000);
  for (const p of players.slice(0, 2)) {
    await shot(p, '3-debut');
    const stats = await pixelStats(browser, await p.page.locator('canvas').screenshot());
    report(stats.colors >= 8 && stats.dominant < 0.95, `canvas non vide (${p.label})`, `${stats.colors} couleurs, dominante ${(stats.dominant * 100).toFixed(0)} %`);
  }

  let turns = 0;
  let result = null;
  while (!result && turns < MAX_TURNS) {
    let moved = false;
    for (const p of players) {
      const s = await lalao(p);
      if (s.game?.result) {
        result = s.game.result;
        break;
      }
      const action = s.game && s.me ? choose(s.game.view, s.me) : null;
      if (action === null) continue;
      await p.page.evaluate((a) => window.__lalao!.act(a), action);
      await p.page.waitForTimeout(120);
      moved = true;
      turns++;
    }
    if (!moved && !result) await host.page.waitForTimeout(100);
  }
  report(!!result, 'partie terminée', result ? `${JSON.stringify(result)} en ${turns} coups` : `aucun résultat après ${turns} coups`);

  await host.page.waitForTimeout(1200);
  for (const p of players.slice(0, 2)) await shot(p, '4-resultat');
  report(await host.page.isVisible('.result'), 'écran de résultat affiché');

  await host.page.click('button:has-text("Rejouer")');
  await host.page.waitForFunction(() => {
    const s = window.__lalao!.state();
    return s.room?.status === 'playing' && !s.game?.result;
  });
  report(true, 'revanche relancée');

  for (const p of players) report(p.errors.length === 0, `console sans erreur (${p.label})`, p.errors.slice(0, 3).join(' | '));
  for (const p of players) await p.page.context().close();
}

const requested = process.argv.slice(2);
const ids = requested.length ? requested : Object.keys(games);
for (const id of ids) if (!games[id]) throw new Error(`Jeu inconnu : ${id}`);

rmSync(OUT, { recursive: true, force: true });
const stopServer = await startServer();
const browser = await chromium.launch({
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  executablePath: process.env.CHROME_PATH,
  // Software WebGL so it also runs headless without a GPU.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  for (const id of ids) {
    try {
      await verifyGame(browser, id);
      await verifySolo(browser, id);
    } catch (e) {
      report(false, `${id} : exception`, (e as Error).message.split('\n')[0]);
    }
  }
} finally {
  await browser.close();
  stopServer();
}
console.log(`\n${failures ? `${failures} échec(s)` : 'Tout est vert'} — captures dans ${path.relative(ROOT, OUT)}/`);
process.exit(failures ? 1 : 0);
