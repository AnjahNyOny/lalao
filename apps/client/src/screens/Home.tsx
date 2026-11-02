import { games } from '@game/games';
import { useState } from 'react';
import { gameClients } from '../games';
import { connection } from '../net/connection';

const NAME_KEY = 'playerName';

function storedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function Home() {
  const [name, setName] = useState(storedName);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '');
  const ready = name.trim().length > 0;

  const remember = () => {
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Not critical.
    }
  };

  return (
    <main className="screen home">
      <h1 className="logo">Salle de jeux</h1>

      <label className="field">
        <span>Ton pseudo</span>
        <input value={name} maxLength={16} placeholder="Ex. Mia" onChange={(e) => setName(e.target.value)} />
      </label>

      <section className="card">
        <h2>Rejoindre un salon</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            remember();
            connection.join(code, name);
          }}
        >
          <input
            className="code-input"
            value={code}
            maxLength={4}
            placeholder="CODE"
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <button disabled={!ready || code.length !== 4}>Rejoindre</button>
        </form>
      </section>

      <section className="card">
        <h2>Créer une partie</h2>
        <div className="game-grid">
          {Object.values(games).map((g) => (
            <button
              key={g.id}
              className="game-tile"
              disabled={!ready}
              onClick={() => {
                remember();
                connection.create(name, g.id);
              }}
            >
              <span className="game-emoji">{gameClients[g.id]?.emoji ?? '🎲'}</span>
              <span className="game-name">{g.name}</span>
              <span className="game-players">
                {g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`} joueurs
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
