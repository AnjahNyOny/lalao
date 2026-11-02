import { Lobby, type BotLevel, type ClientMessage, type GameResult, type PlayerId, type RoomInfo, type ServerMessage, type Session } from '@game/core';
import { games } from '@game/games';
import { useSyncExternalStore } from 'react';

export interface ClientState {
  connected: boolean;
  me: PlayerId | null;
  room: RoomInfo | null;
  game: { view: unknown; result: GameResult | null } | null;
  error: string | null;
}

interface SavedSession {
  code: string;
  token: string;
  name: string;
}

const SESSION_KEY = 'session';
const RETRY_MS = 1000;

function load(): SavedSession | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function save(s: SavedSession | null): void {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Private mode: reconnection after reload just won't work.
  }
}

export class Connection {
  private state: ClientState = { connected: false, me: null, room: null, game: null, error: null };
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private queue: ClientMessage[] = [];
  private session = load();
  private pendingName = '';
  private errorTimer: ReturnType<typeof setTimeout> | undefined;
  private wsConnected = false;
  /** Solo games run a Lobby right here in the page: no server, no network. */
  private local: Session | null = null;
  private localLobby: Lobby | null = null;

  constructor(private url: string) {
    this.open();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = () => this.state;

  create(name: string, gameId: string): void {
    this.pendingName = name;
    this.send({ t: 'create', name, gameId });
  }

  join(code: string, name: string): void {
    this.pendingName = name;
    this.send({ t: 'join', code, name });
  }

  start(): void {
    this.send({ t: 'start' });
  }

  act(action: unknown): void {
    this.send({ t: 'action', action });
  }

  addBot(level: BotLevel): void {
    this.send({ t: 'addBot', level });
  }

  removeBot(playerId: PlayerId): void {
    this.send({ t: 'removeBot', playerId });
  }

  /** Starts a game against bots straight away, entirely offline. */
  playSolo(name: string, gameId: string, level: BotLevel): void {
    this.pendingName = name;
    this.localLobby ??= new Lobby(games);
    // Async and JSON round-tripped, like the network, so solo can't hide bugs online play would hit.
    this.local = this.localLobby.connect({
      send: (msg) => queueMicrotask(() => this.handle(JSON.parse(JSON.stringify(msg)))),
    });
    this.set({ connected: true });
    this.send({ t: 'create', name, gameId });
    for (let i = 1; i < games[gameId].minPlayers; i++) this.send({ t: 'addBot', level });
    this.send({ t: 'start' });
  }

  leave(): void {
    this.send({ t: 'leave' });
    if (this.local) {
      this.local.close();
      this.local = null;
    }
    this.forgetRoom();
    this.set({ connected: this.wsConnected });
  }

  private send(msg: ClientMessage): void {
    if (this.local) this.local.receive(JSON.parse(JSON.stringify(msg)));
    else if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  private open(): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.wsConnected = true;
      if (!this.local) this.set({ connected: true });
      // Resume our seat before anything else.
      if (this.session) {
        const { code, name, token } = this.session;
        ws.send(JSON.stringify({ t: 'join', code, name, token } satisfies ClientMessage));
      }
      for (const msg of this.queue.splice(0)) ws.send(JSON.stringify(msg));
    };
    ws.onmessage = (e) => {
      if (!this.local) this.handle(JSON.parse(e.data) as ServerMessage);
    };
    ws.onclose = () => {
      this.wsConnected = false;
      if (!this.local) this.set({ connected: false });
      setTimeout(() => this.open(), RETRY_MS);
    };
  }

  private handle(msg: ServerMessage): void {
    switch (msg.t) {
      case 'welcome':
        // Solo rooms die with the page, so there is nothing to resume after a reload.
        if (!this.local) {
          this.session = { code: msg.code, token: msg.token, name: this.session?.code === msg.code ? this.session.name : this.pendingName };
          save(this.session);
        }
        this.set({ me: msg.playerId });
        return;
      case 'room':
        this.set({ room: msg.room, game: msg.room.status === 'lobby' ? null : this.state.game });
        return;
      case 'game':
        this.set({ game: { view: msg.view, result: msg.result } });
        return;
      case 'left':
        return;
      case 'error':
        // Our saved room is gone (server restarted, expired): back to the menu.
        if (!this.state.room) this.forgetRoom();
        clearTimeout(this.errorTimer);
        this.errorTimer = setTimeout(() => this.set({ error: null }), 3000);
        this.set({ error: msg.message });
        return;
    }
  }

  private forgetRoom(): void {
    this.session = null;
    save(null);
    this.set({ me: null, room: null, game: null });
  }

  private set(patch: Partial<ClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }
}

const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
export const connection = new Connection(wsUrl);

// Test hook for scripts/verify. Grants nothing a player couldn't already send over the socket.
declare global {
  interface Window {
    __lalao?: { state: () => ClientState; act: (action: unknown) => void; start: () => void };
  }
}
window.__lalao = { state: connection.getState, act: (a) => connection.act(a), start: () => connection.start() };

export function useClient(): ClientState {
  return useSyncExternalStore(connection.subscribe, connection.getState);
}
