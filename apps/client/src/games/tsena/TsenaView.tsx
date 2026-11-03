import { CELL_COUNT, CELLS, TAXI_RANGE, type TsenaAction, type TsenaView as View } from '@game/games/tsena';
import { useState } from 'react';
import { ErrorBoundary, hasWebGL } from '../../ui/ErrorBoundary';
import type { GameViewProps } from '../types';
import { Hud } from './Hud';
import { useReplay, type Shown } from './replay';
import { Scene } from './Scene';
import { island } from './theme';
import { pawnImage, pawnLabel, pawnsOf } from './pawns';
import { KIND_ICON, SITES } from './texts';

/** Without WebGL: the road as a plain list, still playable through the HUD. */
function FlatBoard({ display, pawns, onCell }: { display: Shown; pawns: string[]; onCell: (cell: number) => void }) {
  return (
    <ol className="tsena-flat">
      {CELLS.map((c, i) => (
        <li
          key={i}
          onClick={() => onCell(i)}
          style={{
            ['--seat' as string]: display.owner[i] === null ? 'transparent' : island.players[display.owner[i]!],
            ['--region' as string]: c.kind === 'site' ? island.regions[c.region!] : 'transparent',
          }}
        >
          <span>{c.kind === 'site' ? `${SITES[c.name].icon} ${c.name}` : `${KIND_ICON[c.kind]} ${c.name}`}</span>
          <span className="tsena-flat-pawns">
            {pawns.map((pawn, s) => (display.pos[s] === i && !display.out[s] ? <img key={s} src={pawnImage(pawn)} alt={pawnLabel(pawn)} /> : null))}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function TsenaView({ view, me, room, act }: GameViewProps) {
  const target = view as View;
  const replay = useReplay(target);
  const s = replay.shown;
  const seat = s.players.indexOf(me);
  const [overview, setOverview] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const play = (a: TsenaAction) => act(a);
  const myChoice = !replay.busy && !s.over && seat === s.turn ? s.pending : null;

  // Taxi destinations light up, and can be tapped directly.
  const hops = myChoice?.kind === 'taxi' ? Array.from({ length: TAXI_RANGE }, (_, i) => (s.pos[seat] + i + 1) % CELL_COUNT) : [];

  const onCell = (cell: number) => {
    if (hops.includes(cell)) return play({ type: 'ride', steps: hops.indexOf(cell) + 1 });
    setOverview(false);
    setSelected((c) => (c === cell ? null : cell));
  };

  const acting = replay.playback ? replay.playback.log.player : null;
  const pawns = pawnsOf(s.players, room);
  const flat = <FlatBoard display={replay.display} pawns={pawns} onCell={onCell} />;

  return (
    <div className="game-stage tsena">
      {hasWebGL() ? (
        <ErrorBoundary fallback={flat}>
          <Scene
            display={replay.display}
            playback={replay.playback}
            current={replay.current}
            turn={s.turn}
            players={s.players.length}
            pawns={pawns}
            overview={overview}
            highlight={hops}
            selected={selected}
            onCell={onCell}
          />
        </ErrorBoundary>
      ) : (
        flat
      )}
      <Hud
        shown={s}
        display={replay.display}
        current={replay.current}
        acting={acting}
        busy={replay.busy}
        me={me}
        room={room}
        act={play}
        selected={selected}
        pawns={pawns}
        onSelect={(cell) => {
          setOverview(false);
          setSelected(cell);
        }}
        overview={overview}
        onOverview={() => setOverview((o) => !o)}
      />
    </div>
  );
}
