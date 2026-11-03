import { BOT_LEVELS, type GameOption, type GameResult, type PlayerId, type RoomInfo } from '@game/core';
import { games } from '@game/games';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { BOT_LABELS } from '../botLabels';
import { gameClients } from '../games';
import { connection } from '../net/connection';
import { ErrorBoundary } from '../ui/ErrorBoundary';

/** A link other devices can open: swaps localhost for this machine's LAN address. Not for a solo game, which has no server. */
function useShareLink(code: string, solo: boolean): string {
  const [base, setBase] = useState(location.origin);
  useEffect(() => {
    if (solo || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
    fetch('/api/lan')
      .then((r) => r.json())
      .then(({ addresses }: { addresses: string[] }) => {
        if (addresses[0]) setBase(`${location.protocol}//${addresses[0]}${location.port ? `:${location.port}` : ''}`);
      })
      .catch(() => {});
  }, [solo]);
  return `${base}/?room=${code}`;
}

function QrCode({ text }: { text: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 240, color: { dark: '#1d2b4f', light: '#ffffff' } }).then(setSrc);
  }, [text]);
  return src ? <img className="qr" src={src} alt="QR code pour rejoindre" /> : <div className="qr" />;
}

/** The game's choices (mode, length…): the host picks, everyone sees. */
function Options({ room, isHost }: { room: RoomInfo; isHost: boolean }) {
  const all: GameOption[] = games[room.gameId].options ?? [];
  const shown = all.filter((o) => !o.when || o.when.values.includes(room.options[o.when.option]));
  if (!shown.length) return null;
  return (
    <div className="options">
      {shown.map((o) => {
        const value = room.options[o.id] ?? o.default;
        const hint = o.choices.find((c) => c.value === value)?.hint ?? o.hint;
        return (
          <div className="option" key={o.id}>
            <span className="muted">{o.label}</span>
            <div className="segmented" role="radiogroup" aria-label={o.label} style={{ ['--cols' as string]: o.choices.length === 4 ? 2 : o.choices.length }}>
              {o.choices.map((c) => (
                <button key={c.value} role="radio" aria-checked={c.value === value} disabled={!isHost} onClick={() => connection.setOption(o.id, c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
            {hint && <p className="muted small">{hint}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** Each player picks their own piece; the ones others took show who has them. */
function Pieces({ room, me }: { room: RoomInfo; me: PlayerId }) {
  const pieces = games[room.gameId].pieces;
  const image = gameClients[room.gameId]?.pieceImage;
  if (!pieces?.length || !image) return null;
  const mine = pieces.find((p) => p.id === room.players.find((pl) => pl.id === me)?.piece);
  return (
    <div className="pieces">
      <span className="muted">Ton pion{mine && ` : ${mine.label}`}</span>
      <div className="piece-grid" role="radiogroup" aria-label="Ton pion">
        {pieces.map((piece) => {
          const owner = room.players.find((p) => p.piece === piece.id);
          const isMine = owner?.id === me;
          return (
            <button
              key={piece.id}
              role="radio"
              aria-checked={isMine}
              aria-label={owner && !isMine ? `${piece.label}, pris par ${owner.name}` : piece.label}
              title={piece.label}
              disabled={!!owner && !isMine}
              onClick={() => connection.setPiece(piece.id)}
            >
              <img src={image(piece.id)} alt="" />
              {owner && !isMine && <span className="piece-owner">{owner.name}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Waiting({ room, me, solo }: { room: RoomInfo; me: PlayerId; solo: boolean }) {
  const game = games[room.gameId];
  const pieceImage = gameClients[room.gameId]?.pieceImage;
  const link = useShareLink(room.code, solo);
  const isHost = room.hostId === me;
  const canStart = room.players.length >= game.minPlayers;

  return (
    <main className="screen lobby">
      <p className="muted">{game.name}</p>
      {solo ? (
        <p className="muted small">Partie solo contre des bots, sans connexion.</p>
      ) : (
        <>
          <div className="room-code">{room.code}</div>
          <QrCode text={link} />
          <p className="muted small">Scanne ou ouvre {link}</p>
        </>
      )}

      <ul className="players">
        {room.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'offline'}>
            {p.piece && pieceImage && <img className="player-piece" src={pieceImage(p.piece)} alt="" />}
            {p.name}
            {p.id === room.hostId && <span className="tag">hôte</span>}
            {p.id === me && <span className="tag">toi</span>}
            {p.bot && <span className="tag">bot {BOT_LABELS[p.bot].toLowerCase()}</span>}
            {p.bot && isHost && (
              <button className="remove-bot" aria-label={`Retirer ${p.name}`} onClick={() => connection.removeBot(p.id)}>
                ✕
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: game.maxPlayers - room.players.length }, (_, i) => (
          <li key={`empty-${i}`} className="empty">
            En attente…
          </li>
        ))}
      </ul>

      {isHost && game.bot && room.players.length < game.maxPlayers && (
        <div className="add-bot">
          <span className="muted">Ajouter un bot</span>
          <div className="segmented">
            {BOT_LEVELS.map((level) => (
              <button key={level} onClick={() => connection.addBot(level)}>
                {BOT_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
      )}

      <Pieces room={room} me={me} />
      <Options room={room} isHost={isHost} />

      {isHost ? (
        <button className="primary" disabled={!canStart} onClick={() => connection.start()}>
          {canStart ? 'Lancer la partie' : `Il faut ${game.minPlayers} joueurs`}
        </button>
      ) : (
        <p className="muted">L'hôte va lancer la partie…</p>
      )}
    </main>
  );
}

function ResultBanner({ result, room, me }: { result: GameResult; room: RoomInfo; me: PlayerId }) {
  const names = (ids: PlayerId[]) => ids.map((id) => room.players.find((p) => p.id === id)?.name ?? '?').join(' et ');
  const title =
    result.kind === 'draw' ? 'Match nul !' : result.winners.includes(me) ? 'Victoire !' : `${names(result.winners)} gagne !`;
  return (
    <div className="result">
      <h2>{title}</h2>
      {room.hostId === me ? (
        <button className="primary" onClick={() => connection.start()}>
          Rejouer
        </button>
      ) : (
        <p className="muted">En attente de l'hôte…</p>
      )}
    </div>
  );
}

export function RoomScreen(props: { room: RoomInfo; me: PlayerId; game: { view: unknown; result: GameResult | null } | null; solo: boolean }) {
  const { room, me, game } = props;
  const client = gameClients[room.gameId];
  return (
    <>
      <button className="leave" onClick={() => connection.leave()} aria-label="Quitter le salon">
        ✕
      </button>
      {game && client ? (
        <>
          <ErrorBoundary
            fallback={
              <main className="screen lobby">
                <p>Ce jeu ne peut pas s'afficher sur cet appareil (affichage 3D indisponible).</p>
              </main>
            }
          >
            <client.View view={game.view} me={me} room={room} act={(a) => connection.act(a)} />
          </ErrorBoundary>
          {game.result && <ResultBanner result={game.result} room={room} me={me} />}
        </>
      ) : (
        <Waiting room={room} me={me} solo={props.solo} />
      )}
    </>
  );
}
