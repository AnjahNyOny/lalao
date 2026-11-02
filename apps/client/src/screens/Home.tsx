import { BOT_LEVELS, type BotLevel } from '@game/core';
import { games } from '@game/games';
import { useState } from 'react';
import { BOT_LABELS } from '../botLabels';
import { gameClients } from '../games';
import { connection } from '../net/connection';
import { ArcadeBackdrop } from '../theme/ArcadeBackdrop';

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
  const [solo, setSolo] = useState(false);
  const [level, setLevel] = useState<BotLevel>('medium');
  const ready = name.trim().length > 0;

  const remember = () => {
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Not critical.
    }
  };

  return (
    <>
      <ArcadeBackdrop />
      <main className="screen home">
        <header className="marquee">
          <h1 className="logo" data-text="LALAO">
            LALAO
          </h1>
          <p className="tagline">Salle d'arcade</p>
        </header>

        <label className="field">
          <span>Pseudo</span>
          <input value={name} maxLength={16} placeholder="Ton nom de joueur" onChange={(e) => setName(e.target.value)} />
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
              aria-label="Code du salon"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
            <button disabled={!ready || code.length !== 4}>Rejoindre</button>
          </form>
        </section>

        <section className="card">
          <h2>Choisis un jeu</h2>
          <div className="segmented mode" role="radiogroup" aria-label="Mode de jeu">
            <button role="radio" aria-checked={!solo} onClick={() => setSolo(false)}>
              Entre amis
            </button>
            <button role="radio" aria-checked={solo} onClick={() => setSolo(true)}>
              Solo vs bots
            </button>
          </div>
          {solo && (
            <div className="segmented level" role="radiogroup" aria-label="Niveau des bots">
              {BOT_LEVELS.map((l) => (
                <button key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)}>
                  {BOT_LABELS[l]}
                </button>
              ))}
            </div>
          )}
          <div className="game-grid">
            {Object.values(games)
              .filter((g) => !solo || g.bot)
              .map((g) => (
                <button
                  key={g.id}
                  className="game-tile"
                  disabled={!ready}
                  onClick={() => {
                    remember();
                    if (solo) connection.playSolo(name, g.id, level);
                    else connection.create(name, g.id);
                  }}
                >
                  <span className="game-emoji">{gameClients[g.id]?.emoji ?? '🎲'}</span>
                  <span className="game-name">{g.name}</span>
                  <span className="game-players">
                    {solo ? 'contre des bots' : `${g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`} joueurs`}
                  </span>
                </button>
              ))}
          </div>
        </section>

        <p className="press-start">{ready ? 'Choisis un jeu pour commencer' : 'Entre ton pseudo'}</p>
      </main>
    </>
  );
}
