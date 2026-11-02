import { useEffect, useLayoutEffect } from 'react';
import { gameClients } from './games';
import { useClient } from './net/connection';
import { Home } from './screens/Home';
import { RoomScreen } from './screens/RoomScreen';
import { arcadeTheme } from './theme/arcade';
import { applyTheme } from './theme/theme';

export function App() {
  const { connected, me, room, game, error } = useClient();

  // Lalao's arcade look on the menu; each game's own look once in a room.
  const theme = (room && gameClients[room.gameId]?.theme) || arcadeTheme;
  useLayoutEffect(() => applyTheme(theme), [theme]);

  // Keep ?room=CODE in the address bar so the page can be shared or reloaded.
  const code = room?.code;
  useEffect(() => {
    const url = new URL(location.href);
    if (code) url.searchParams.set('room', code);
    else url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }, [code]);

  return (
    <>
      {room && me ? <RoomScreen room={room} me={me} game={game} /> : <Home />}
      {!connected && <div className="toast warn">Connexion au serveur…</div>}
      {error && <div className="toast">{error}</div>}
    </>
  );
}
