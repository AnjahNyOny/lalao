import { BOT_LEVELS, type GameResult, type PlayerId, type RoomInfo } from '@game/core';
import { games } from '@game/games';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { BOT_LABELS } from '../botLabels';
import { gameClients } from '../games';
import { connection } from '../net/connection';

/** A link other devices can open: swaps localhost for this machine's LAN address. */
function useShareLink(code: string): string {
  const [base, setBase] = useState(location.origin);
  useEffect(() => {
    if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
    fetch('/api/lan')
      .then((r) => r.json())
      .then(({ addresses }: { addresses: string[] }) => {
        if (addresses[0]) setBase(`${location.protocol}//${addresses[0]}${location.port ? `:${location.port}` : ''}`);
      })
      .catch(() => {});
  }, []);
  return `${base}/?room=${code}`;
}

function QrCode({ text }: { text: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 240, color: { dark: '#1d2b4f', light: '#ffffff' } }).then(setSrc);
  }, [text]);
  return src ? <img className="qr" src={src} alt="QR code pour rejoindre" /> : <div className="qr" />;
}

function Waiting({ room, me }: { room: RoomInfo; me: PlayerId }) {
  const game = games[room.gameId];
  const link = useShareLink(room.code);
  const isHost = room.hostId === me;
  const canStart = room.players.length >= game.minPlayers;

  return (
    <main className="screen lobby">
      <p className="muted">{game.name}</p>
      <div className="room-code">{room.code}</div>
      <QrCode text={link} />
      <p className="muted small">Scanne ou ouvre {link}</p>

      <ul className="players">
        {room.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'offline'}>
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

export function RoomScreen({ room, me, game }: { room: RoomInfo; me: PlayerId; game: { view: unknown; result: GameResult | null } | null }) {
  const client = gameClients[room.gameId];
  return (
    <>
      <button className="leave" onClick={() => connection.leave()} aria-label="Quitter le salon">
        ✕
      </button>
      {game && client ? (
        <>
          <client.View view={game.view} me={me} room={room} act={(a) => connection.act(a)} />
          {game.result && <ResultBanner result={game.result} room={room} me={me} />}
        </>
      ) : (
        <Waiting room={room} me={me} />
      )}
    </>
  );
}
