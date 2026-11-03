export type PlayerId = string;

export const BOT_LEVELS = ['easy', 'medium', 'hard'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

export type GameResult =
  | { kind: 'win'; winners: PlayerId[] }
  | { kind: 'draw' }
  /** A cooperative game everyone lost together. */
  | { kind: 'lose' };

/** One choice the host makes in the lobby before starting: game mode, length… */
export interface GameOption {
  id: string;
  label: string;
  /** `hint` explains a choice once it is picked. */
  choices: { value: string; label: string; hint?: string }[];
  default: string;
  hint?: string;
  /** Only shown (and only meaningful) while another option has one of these values. */
  when?: { option: string; values: string[] };
}

/** A piece a player can pick in the lobby (a pawn, a token…): cosmetic, each one taken once per room. */
export interface GamePiece {
  id: string;
  label: string;
}

/** Option id → chosen value. Plain strings: they travel over the network. */
export type GameOptions = Record<string, string>;

export const defaultOptions = (game: { options?: GameOption[] }): GameOptions =>
  Object.fromEntries((game.options ?? []).map((o) => [o.id, o.default]));

/**
 * A mini-game's rules, with no knowledge of networking or rendering.
 * The same definition runs on the cloud server, on a local host device,
 * and in tests.
 */
export interface GameDefinition<State = unknown, Action = unknown, View = State> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /**
   * Players are given in seat order. `seed` drives all randomness. `options`
   * holds every declared option, `pieces` each seat's piece (for games whose
   * pieces are roles, not just looks).
   */
  setup(players: PlayerId[], seed: number, options?: GameOptions, pieces?: (string | undefined)[]): State;
  /** Choices offered in the lobby; `setup` receives them. */
  options?: GameOption[];
  /** Pieces players choose from in the lobby: `setup` gets each seat's, the view reads them from the room. */
  pieces?: GamePiece[];
  /** `action` comes straight off the network: check its shape too. */
  validate(state: State, action: unknown, by: PlayerId): action is Action;
  apply(state: State, action: Action, by: PlayerId): State;
  /** Real-time games only: advance the simulation by `dtMs`. */
  tick?(state: State, dtMs: number): State;
  /**
   * For a turn-based game that watches the wall clock (a time limit): called
   * about once a second with the time since the game started. Return the
   * same object when nothing changed, so nothing gets sent.
   */
  clock?(state: State, elapsedMs: number): State;
  /** Hide private information (hands, decks…) from a given player. */
  viewFor?(state: State, player: PlayerId): View;
  result(state: State): GameResult | null;
  /**
   * Computer player. Sees exactly what a human in that seat would (`viewFor`),
   * so it can't cheat. Returns null when it has nothing to do (not its turn).
   * `rand` is the only allowed source of randomness.
   */
  bot?(view: View, me: PlayerId, level: BotLevel, rand: () => number): Action | null;
  /**
   * How long bots wait before acting, so they don't outrun the game's animations.
   * A function lets the wait follow what just happened (a long walk, a short choice).
   */
  botDelayMs?: [number, number] | ((state: State) => [number, number]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDefinition<any, any, any>;

export type GameRegistry = Record<string, AnyGame>;
