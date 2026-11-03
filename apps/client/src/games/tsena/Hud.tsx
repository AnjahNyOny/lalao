import type { PlayerId, RoomInfo } from '@game/core';
import {
  BAIL,
  canBuild,
  canManage,
  canMortgage,
  canOffer,
  CELL_COUNT,
  CELLS,
  fullRegion,
  houseCost,
  JAIL_TRIES,
  LAND_TAX,
  LEVEL_NAMES,
  majority,
  MAX_LEVEL,
  mortgageValue,
  priceOf,
  redeemCost,
  regionOf,
  rentAt,
  rentOf,
  SALARY,
  TAXI_RANGE,
  worthOf,
  type Pending,
  type TsenaAction,
  type TsenaEvent,
  type TsenaView as View,
} from '@game/games/tsena';
import { useEffect, useState, type ReactNode } from 'react';
import type { Shown } from './replay';
import { island } from './theme';
import { ar, CARD_TEXT, cellName, DECK_LABEL, describe, KIND_HELP, KIND_ICON, KIND_LABEL, regionName, siteOf } from './texts';

export interface HudProps {
  shown: View;
  display: Shown;
  current: TsenaEvent | null;
  /** Seat acting in the log being replayed, or null when idle. */
  acting: number | null;
  busy: boolean;
  me: PlayerId;
  room: RoomInfo;
  act: (action: TsenaAction) => void;
  selected: number | null;
  onSelect: (cell: number | null) => void;
  overview: boolean;
  onOverview: () => void;
}

type Sheet = 'assets' | 'rules' | null;
type Send = (a: TsenaAction) => void;

/** Where a taxi-brousse hop of `steps` would land, in a few words. */
export function hopInfo(s: View, seat: number, steps: number, name: (seat: number) => string): { cell: number; text: string } {
  const cell = (s.pos[seat] + steps) % CELL_COUNT;
  const c = CELLS[cell];
  const salary = s.pos[seat] + steps >= CELL_COUNT ? ` · +${ar(SALARY)}` : '';
  if (c.kind !== 'site') return { cell, text: `${KIND_LABEL[c.kind]}${salary}` };
  const owner = s.owner[cell];
  if (owner === null) return { cell, text: `à vendre ${ar(priceOf(cell))}${salary}` };
  if (owner === seat) return { cell, text: `à toi${salary}` };
  return { cell, text: `loyer ${ar(rentOf(s, cell))} · ${name(owner)}${salary}` };
}

/** « 2 sur 3 à toi » for a site's region. */
function regionShare(s: View, seat: number, cell: number): string {
  const cells = regionOf(cell);
  const mine = cells.filter((i) => s.owner[i] === seat).length;
  return `${regionName(cell)}\u00a0: ${mine} sur ${cells.length} à toi`;
}

export function Hud(p: HudProps) {
  const { shown: s, display, me, room } = p;
  const seat = s.players.indexOf(me);
  const name = (i: number) => room.players.find((pl) => pl.id === s.players[i])?.name ?? '?';
  const myTurn = !p.busy && !s.over && seat === s.turn && !s.out[seat];
  const [sheet, setSheet] = useState<Sheet>(null);
  // One tap per decision: wait for the answer before allowing another.
  const [sent, setSent] = useState(false);
  useEffect(() => setSent(false), [s]);
  const send: Send = (a) => {
    if (sent) return;
    setSent(true);
    p.act(a);
  };
  const toggle = (which: Sheet) => {
    p.onSelect(null);
    setSheet((open) => (open === which ? null : which));
  };
  const card = p.current?.t === 'card' ? p.current : null;

  let panel: ReactNode;
  if (p.busy && p.current && p.acting !== null) {
    panel = (
      <p className="tsena-caption" key={`${p.current.t}:${JSON.stringify(p.current)}`}>
        {describe(p.current, name(p.acting), p.acting === seat, name)}
      </p>
    );
  } else if (s.over) {
    panel = <Ranking s={s} name={name} />;
  } else if (s.pending?.kind === 'offer' && !p.busy) {
    panel = <Offer s={s} offer={s.pending} seat={seat} name={name} send={send} disabled={sent} />;
  } else if (p.selected !== null) {
    panel = <CellInfo cell={p.selected} s={s} seat={seat} name={name} onClose={() => p.onSelect(null)} send={send} disabled={sent} active={myTurn} />;
  } else if (sheet === 'rules') {
    panel = <Rules s={s} onClose={() => setSheet(null)} />;
  } else if (sheet === 'assets' && seat >= 0) {
    panel = <Assets s={s} seat={seat} onSelect={p.onSelect} onClose={() => setSheet(null)} />;
  } else if (myTurn) {
    panel = <Choice s={s} seat={seat} name={name} send={send} disabled={sent} onAssets={() => toggle('assets')} />;
  } else {
    panel = (
      <>
        {s.last && s.last.events.length > 0 && (
          <p className="tsena-caption muted">{describe(s.last.events[s.last.events.length - 1], name(s.last.player), s.last.player === seat, name)}</p>
        )}
        {!p.busy && <p className="tsena-wait">{s.out[seat] ? 'Tu es ruiné : tu regardes la fin de la partie.' : `Au tour de ${name(s.turn)}…`}</p>}
      </>
    );
  }

  return (
    <>
      <div className="tsena-top">
        <ul className="tsena-players">
          {s.players.map((id, i) => (
            <li
              key={id}
              className={`${(p.acting ?? s.turn) === i && !s.over ? 'active' : ''} ${display.out[i] ? 'out' : ''}`}
              style={{ ['--seat' as string]: island.players[i] }}
            >
              <span className="tsena-avatar" aria-hidden>
                {island.pawns[i].emoji}
              </span>
              <span className="tsena-name">
                {name(i)}
                {id === me && ' (toi)'}
              </span>
              <span className="tsena-money">
                {display.out[i] ? 'ruiné' : ar(display.money[i])}
                {display.jail[i] > 0 && <span title="Au fonja"> ⛓️</span>}
                {display.passes[i] > 0 && <span title="Laissez-passer"> 🎫{display.passes[i] > 1 ? display.passes[i] : ''}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="tsena-tools">
          <span className="tsena-round">
            Tour {Math.min(s.round, s.rounds)}/{s.rounds}
          </span>
          <button className="tsena-map" onClick={p.onOverview} aria-pressed={p.overview} aria-label="Vue d'ensemble">
            {p.overview ? '📍' : '🗺️'}
          </button>
          {seat >= 0 && (
            <button className="tsena-map" onClick={() => toggle('assets')} aria-pressed={sheet === 'assets'} aria-label="Mes biens">
              🏠
            </button>
          )}
          <button className="tsena-map" onClick={() => toggle('rules')} aria-pressed={sheet === 'rules'} aria-label="Règles">
            ❔
          </button>
        </div>
      </div>

      {card && (
        <div className={`tsena-card ${card.deck}`} key={`${card.deck}:${card.card}`}>
          <span className="tsena-card-kicker">
            {KIND_ICON[card.deck]} {DECK_LABEL[card.deck]}
          </span>
          <strong>{CARD_TEXT[card.card].title}</strong>
          <span>{CARD_TEXT[card.card].text}</span>
        </div>
      )}

      <div className="tsena-panel">{panel}</div>
    </>
  );
}

function RegionChip({ cell }: { cell: number }) {
  return (
    <span className="tsena-region" style={{ ['--region' as string]: island.regions[CELLS[cell].region!] }}>
      {regionName(cell)}
    </span>
  );
}

function Choice(props: { s: View; seat: number; name: (i: number) => string; send: Send; disabled: boolean; onAssets: () => void }) {
  const { s, seat, name, send, disabled } = props;
  const p = s.pending;
  const money = s.money[seat];
  const last = s.last && s.last.player === seat ? s.last.events[s.last.events.length - 1] : null;
  if (!p && s.jail[seat] > 0) {
    return (
      <>
        <p className="tsena-title">⛓️ Tu es au fonja</p>
        <p className="muted small">
          Fais un double pour sortir
          {s.jail[seat] === 1 ? ` : dernier essai, sinon tu paies ${ar(BAIL)} et tu repars.` : ` (${JAIL_TRIES} essais), ou paie la caution.`}
        </p>
        <div className="tsena-actions">
          <button className="primary" disabled={disabled} onClick={() => send({ type: 'roll' })}>
            🎲 Tenter un double
          </button>
          <button disabled={disabled || money < BAIL} onClick={() => send({ type: 'bail' })}>
            Caution · {ar(BAIL)}
          </button>
        </div>
        {s.passes[seat] > 0 && (
          <button className="tsena-stay" disabled={disabled} onClick={() => send({ type: 'pardon' })}>
            🎫 Montrer un laissez-passer
          </button>
        )}
      </>
    );
  }
  if (!p) {
    return (
      <>
        {last && <p className="tsena-caption muted">{describe(last, name(seat), true, name)}</p>}
        <p className="tsena-title">{s.doubles > 0 ? 'Double : tu rejoues !' : 'À toi de jouer !'}</p>
        <button className="primary tsena-roll" disabled={disabled} onClick={() => send({ type: 'roll' })}>
          🎲 Lancer les dés
        </button>
        <p className="tsena-hint">
          Avant de lancer : touche une case pour bâtir ou faire une offre, ou ouvre{' '}
          <button className="tsena-link" onClick={props.onAssets}>
            🏠 mes biens
          </button>
          .
        </p>
      </>
    );
  }
  switch (p.kind) {
    case 'buy': {
      const price = priceOf(p.cell);
      const info = siteOf(p.cell);
      return (
        <>
          <p className="tsena-title">
            {info.icon} {cellName(p.cell)} <RegionChip cell={p.cell} />
          </p>
          <p className="muted small">{info.famous}</p>
          <p className="small">
            Loyer {ar(rentAt(p.cell, 0, false))}, bien plus avec des maisons. {regionShare(s, seat, p.cell)}.
          </p>
          <div className="tsena-actions">
            <button className="primary" disabled={disabled || money < price} onClick={() => send({ type: 'buy' })}>
              Acheter · {ar(price)}
            </button>
            <button disabled={disabled} onClick={() => send({ type: 'pass' })}>
              Passer
            </button>
          </div>
          {money < price && (
            <p className="tsena-hint">
              Il te manque {ar(price - money)} : hypothèque un site depuis{' '}
              <button className="tsena-link" onClick={props.onAssets}>
                🏠 mes biens
              </button>
              .
            </p>
          )}
        </>
      );
    }
    case 'taxi':
      return (
        <>
          <p className="tsena-title">🚐 Taxi-brousse {p.fare ? `· billet ${ar(p.fare)}` : '· gratuit !'}</p>
          <div className="tsena-hops">
            {Array.from({ length: TAXI_RANGE }, (_, i) => {
              const { cell, text } = hopInfo(s, seat, i + 1, name);
              return (
                <button key={i} disabled={disabled} onClick={() => send({ type: 'ride', steps: i + 1 })}>
                  <b>
                    +{i + 1} {CELLS[cell].kind === 'site' ? cellName(cell) : KIND_ICON[CELLS[cell].kind]}
                  </b>
                  <span>{text}</span>
                </button>
              );
            })}
          </div>
          <button className="tsena-stay" disabled={disabled} onClick={() => send({ type: 'pass' })}>
            Rester ici
          </button>
        </>
      );
    case 'offer':
      return null;
  }
}

const LEVEL_ICON = ['', '🏠', '🏠🏠', '🏠🏠🏠', '🏨'];

/** Rent at every stage, the current one picked out. */
function RentTable({ cell, level, full, owned }: { cell: number; level: number; full: boolean; owned: boolean }) {
  const rows = [
    { label: 'Terrain', rent: rentAt(cell, 0, false), on: owned && level === 0 && !full },
    { label: 'Région', rent: rentAt(cell, 0, true), on: owned && level === 0 && full },
    ...[1, 2, 3, 4].map((l) => ({ label: LEVEL_ICON[l], rent: rentAt(cell, l, true), on: owned && level === l })),
  ];
  return (
    <ul className="tsena-rents">
      {rows.map((r) => (
        <li key={r.label} className={r.on ? 'on' : ''}>
          <span>{r.label}</span>
          <b>{ar(r.rent)}</b>
        </li>
      ))}
    </ul>
  );
}

const OFFER_FACTORS = [1, 1.5, 2, 3];

function CellInfo(props: {
  cell: number;
  s: View;
  seat: number;
  name: (i: number) => string;
  onClose: () => void;
  send: Send;
  disabled: boolean;
  /** It's this player's turn, with nothing else to answer first. */
  active: boolean;
}) {
  const { cell, s, seat, name, send, disabled } = props;
  const c = CELLS[cell];
  const close = (
    <button className="tsena-close" onClick={props.onClose} aria-label="Fermer">
      ✕
    </button>
  );
  if (c.kind !== 'site') {
    return (
      <div className="tsena-info">
        {close}
        <p className="tsena-title">
          {KIND_ICON[c.kind]} {c.kind === 'start' ? c.name : KIND_LABEL[c.kind]}
        </p>
        <p className="muted small">{KIND_HELP[c.kind]}</p>
      </div>
    );
  }
  const info = siteOf(cell);
  const owner = s.owner[cell];
  const level = s.level[cell];
  const money = s.money[seat];
  const mine = owner === seat;
  const manage = props.active && canManage(s);
  const status =
    owner === null
      ? `À vendre · ${ar(priceOf(cell))}`
      : `${mine ? 'À toi' : `À ${name(owner)}`} · ${LEVEL_NAMES[level]}${s.mortgaged[cell] ? ' · en gage, sans loyer' : ''}`;

  let actions: ReactNode = null;
  if (manage && mine) {
    const buttons: ReactNode[] = [];
    if (canBuild(s, seat, cell)) {
      buttons.push(
        <button key="build" className="primary" disabled={disabled} onClick={() => send({ type: 'build', cell })}>
          {level === MAX_LEVEL - 1 ? '🏨 Hôtel' : '🏠 Bâtir'} · {ar(houseCost(cell))}
        </button>,
      );
    }
    if (level > 0) {
      buttons.push(
        <button key="sell" disabled={disabled} onClick={() => send({ type: 'sell', cell })}>
          Vendre {level === MAX_LEVEL ? 'l’hôtel' : 'une maison'} · +{ar(Math.floor(houseCost(cell) / 2))}
        </button>,
      );
    }
    if (canMortgage(s, seat, cell)) {
      buttons.push(
        <button key="mortgage" disabled={disabled} onClick={() => send({ type: 'mortgage', cell })}>
          Hypothéquer · +{ar(mortgageValue(cell))}
        </button>,
      );
    }
    if (s.mortgaged[cell]) {
      buttons.push(
        <button key="redeem" className="primary" disabled={disabled || money < redeemCost(cell)} onClick={() => send({ type: 'redeem', cell })}>
          Lever l’hypothèque · {ar(redeemCost(cell))}
        </button>,
      );
    }
    actions = (
      <>
        {buttons.length > 0 && <div className="tsena-actions wrap">{buttons}</div>}
        {!canBuild(s, seat, cell) && level < MAX_LEVEL && !s.mortgaged[cell] && (
          <p className="tsena-hint">
            {level === MAX_LEVEL - 1
              ? 'L’hôtel demande toute la région.'
              : `Pour bâtir : la plupart des sites de la région. ${regionShare(s, seat, cell)}.`}
          </p>
        )}
      </>
    );
  } else if (props.active && s.pending === null && owner !== null && !mine && canOffer(s, seat, cell)) {
    actions = (
      <>
        <p className="small">
          <b>Proposer à {name(owner)} de lui racheter :</b>
        </p>
        <div className="tsena-offers">
          {OFFER_FACTORS.map((f) => {
            const price = Math.round((priceOf(cell) * f) / 10) * 10;
            return (
              <button key={f} disabled={disabled || money < price} onClick={() => send({ type: 'offer', cell, price })}>
                {ar(price)}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="tsena-info">
      {close}
      <p className="tsena-title">
        {info.icon} {c.name} <RegionChip cell={cell} />
      </p>
      <p className="tsena-monument">{info.monument}</p>
      <p className="muted small">{info.famous}</p>
      <p className="small">
        <b>{status}</b>
      </p>
      <RentTable cell={cell} level={level} full={fullRegion(s.owner, cell)} owned={owner !== null} />
      <p className="muted small">
        Maison {ar(houseCost(cell))} · hypothèque {ar(mortgageValue(cell))}
      </p>
      {actions}
    </div>
  );
}

function Offer({ s, offer, seat, name, send, disabled }: { s: View; offer: Extract<Pending, { kind: 'offer' }>; seat: number; name: (i: number) => string; send: Send; disabled: boolean }) {
  const site = cellName(offer.cell);
  if (seat === offer.to) {
    const after = s.owner.map((o, i) => (i === offer.cell ? offer.from : o));
    const gives = fullRegion(after, offer.cell) ? 'toute la région' : majority(after, offer.cell) ? 'de quoi bâtir dans la région' : null;
    return (
      <>
        <p className="tsena-title">🤝 Offre de {name(offer.from)}</p>
        <p>
          {name(offer.from)} veut te racheter <b>{site}</b> pour <b>{ar(offer.price)}</b> (prix d’achat {ar(priceOf(offer.cell))}).
        </p>
        {gives && <p className="tsena-hint">Attention : ça lui donne {gives}.</p>}
        <div className="tsena-actions">
          <button className="primary" disabled={disabled} onClick={() => send({ type: 'accept' })}>
            Accepter
          </button>
          <button disabled={disabled} onClick={() => send({ type: 'refuse' })}>
            Refuser
          </button>
        </div>
      </>
    );
  }
  if (seat === offer.from) {
    return (
      <>
        <p className="tsena-wait">
          Tu proposes {ar(offer.price)} à {name(offer.to)} pour {site}. En attente de sa réponse…
        </p>
        <button className="tsena-stay" disabled={disabled} onClick={() => send({ type: 'cancel' })}>
          Retirer l’offre
        </button>
      </>
    );
  }
  return (
    <p className="tsena-wait">
      {name(offer.from)} propose {ar(offer.price)} à {name(offer.to)} pour {site}…
    </p>
  );
}

function Assets({ s, seat, onSelect, onClose }: { s: View; seat: number; onSelect: (cell: number) => void; onClose: () => void }) {
  const mine = s.owner.flatMap((o, cell) => (o === seat ? [cell] : [])).sort((a, b) => CELLS[a].region! - CELLS[b].region! || a - b);
  return (
    <div className="tsena-info">
      <button className="tsena-close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
      <p className="tsena-title">🏠 Mes biens</p>
      {mine.length === 0 ? (
        <p className="muted small">Aucun site pour l’instant : arrête-toi sur un site libre pour l’acheter.</p>
      ) : (
        <ul className="tsena-assets">
          {mine.map((cell) => (
            <li key={cell}>
              <button onClick={() => onSelect(cell)} style={{ ['--region' as string]: island.regions[CELLS[cell].region!] }}>
                <span>
                  {siteOf(cell).icon} {cellName(cell)}
                </span>
                <span>{s.mortgaged[cell] ? 'en gage' : LEVEL_ICON[s.level[cell]] || 'terrain'}</span>
                <b>{s.mortgaged[cell] ? '—' : ar(rentOf(s, cell))}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Fortune : {ar(worthOf(s, seat))}. Touche un site pour y bâtir ou l’hypothéquer.
      </p>
    </div>
  );
}

function Rules({ s, onClose }: { s: View; onClose: () => void }) {
  return (
    <div className="tsena-info">
      <button className="tsena-close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
      <p className="tsena-title">❔ Règles de Tsena</p>
      <ul className="tsena-rules">
        <li>🎲 Lance les dés et fais le tour de l’île. Un double, et tu rejoues.</li>
        <li>🏷️ Achète les sites libres où tu t’arrêtes : les autres te paieront un loyer.</li>
        <li>🏠 Avec la plupart des sites d’une région, bâtis des maisons (trois au plus). Avec toute la région : l’hôtel, et le loyer des terrains nus double.</li>
        <li>🤝 À ton tour, touche le site d’un adversaire pour lui proposer de le racheter.</li>
        <li>📜 Hypothèque un site pour de l’argent frais : il ne rapporte plus rien tant que tu ne l’as pas racheté (10 % de plus).</li>
        <li>⛓️ Le barrage t’envoie au fonja : fais un double, paie {ar(BAIL)} ou montre un laissez-passer.</li>
        <li>💎 Vintana, la chance, et 🧺 Fihavanana, la solidarité : deux paquets de cartes.</li>
        <li>
          🏛️ Hetra prend 10 % de ton argent ; la taxe foncière, {ar(LAND_TAX.house)} par maison. 🏁 Chaque passage à Tana rapporte {ar(SALARY)}.
        </li>
        <li>🏆 Ruiné, on quitte la partie. Après {s.rounds} tours, le plus riche gagne : argent, sites et bâtiments.</li>
      </ul>
    </div>
  );
}

function Ranking({ s, name }: { s: View; name: (i: number) => string }) {
  const rows = s.players.map((_, i) => ({ i, worth: s.out[i] ? -1 : worthOf(s, i) })).sort((a, b) => b.worth - a.worth);
  return (
    <ol className="tsena-ranking">
      {rows.map(({ i, worth }) => (
        <li key={i} style={{ ['--seat' as string]: island.players[i] }}>
          <span>
            {island.pawns[i].emoji} {name(i)}
          </span>
          <b>{worth < 0 ? 'ruiné' : ar(worth)}</b>
        </li>
      ))}
    </ol>
  );
}
