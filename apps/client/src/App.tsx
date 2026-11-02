import { useEffect } from 'react';
import { useClient } from './net/connection';
import { Home } from './screens/Home';
import { RoomScreen } from './screens/RoomScreen';

export function App() {
  const { connected, me, room, game, error } = useClient();

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
