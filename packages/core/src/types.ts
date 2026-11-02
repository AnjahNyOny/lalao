export type PlayerId = string;

export type GameResult =
  | { kind: 'win'; winners: PlayerId[] }
  | { kind: 'draw' };

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
  /** Players are given in seat order. `seed` drives all randomness. */
  setup(players: PlayerId[], seed: number): State;
  /** `action` comes straight off the network: check its shape too. */
  validate(state: State, action: unknown, by: PlayerId): action is Action;
  apply(state: State, action: Action, by: PlayerId): State;
  /** Real-time games only: advance the simulation by `dtMs`. */
  tick?(state: State, dtMs: number): State;
  /** Hide private information (hands, decks…) from a given player. */
  viewFor?(state: State, player: PlayerId): View;
  result(state: State): GameResult | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDefinition<any, any, any>;

export type GameRegistry = Record<string, AnyGame>;
