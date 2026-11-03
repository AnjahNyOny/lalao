# Lalao

Plateforme de mini-jeux multijoueur (2 à 4 joueurs) : jeux de plateau au tour par tour surtout, quelques jeux en temps réel. Rendu 3D low-poly. En ligne, et en local sans internet : un appareil hôte fait serveur, les autres le rejoignent par QR code, dans leur navigateur et sans installer l'app. Web d'abord ; Capacitor (iOS/Android) et Tauri (desktop) viendront plus tard sur le même code.

L'interface, les textes du jeu et la documentation sont en **français**. Le code et ses commentaires sont en anglais.

## Commandes

```bash
npm run dev          # serveur :3000 + Vite :5173 (exposé sur le Wi-Fi)
npm test             # vitest : règles des jeux + salons
npm run typecheck
npm run verify       # build + vraie partie dans Chrome, captures mobile/desktop -> artifacts/verify/
npm run build && npm start   # un seul serveur :3000 = mode hôte local
scripts/deploy.sh    # mise en ligne sur https://lalao.anjahnyony.com (--rollback pour revenir en arrière)
npm run verify:online   # les mêmes vraies parties, contre le site en ligne
```

## Architecture

```
packages/core     protocole, Lobby/Session/Room — indépendants du transport (WebSocket aujourd'hui, téléphone hôte demain)
packages/games    règles des jeux : une GameDefinition pure par dossier, + tests
apps/server       Node + ws ; sert aussi le client compilé ; /api/lan donne l'IP locale
apps/client       React + React Three Fiber ; net/connection.ts = client WS + reconnexion
scripts/verify    vérification de bout en bout (playwright-core + Chrome installé)
deploy            VPS : site nginx, config PM2, préparation unique du serveur (setup-server.sh)
```

En ligne, le serveur tourne sur un VPS IONOS (Debian, 1 cœur, 845 Mo de mémoire, d'autres sites à côté). nginx sert le client ; PM2 lance `apps/server/dist/server.mjs` (le serveur regroupé par esbuild) sur 127.0.0.1:5004. On compile sur le Mac, jamais sur le VPS. Les salons vivent en mémoire : chaque déploiement coupe les parties en cours.

Règles qui tiennent l'architecture :

- **Les règles d'un jeu sont du code pur.** Pas d'import de React, three, ws ni du DOM dans `packages/games`. Tout le hasard passe par le `seed` de `setup` (`mulberry32` dans core), jamais `Math.random`.
- **Le serveur fait autorité.** Le client n'envoie que des intentions (`act(action)`) ; `validate` vérifie aussi la *forme* de l'action, puisqu'elle arrive du réseau. Exception, le temps réel coopératif (Miaraka) : chaque appareil déplace son propre avatar avec la même fonction `step` que les règles, et envoie sa position environ 12 fois par seconde. Le serveur la vérifie (vitesse, murs, ce que l'animal peut atteindre) et gère tout le reste. Il n'y a pas d'adversaire à tromper, et un serveur lointain rendrait les sauts injouables.
- **Information cachée** (mains, pioches) : filtrer avec `viewFor`. Une vue ne doit jamais contenir ce que le joueur n'a pas le droit de voir.
- Le client ne réimplémente pas les règles : il affiche la vue reçue. Pour un retour immédiat, préférer une anticipation visuelle (jeton fantôme…) à une prédiction d'état.
- `window.__lalao` (client) expose l'état et `act` pour les tests automatisés.
- **Bots** : `GameDefinition.bot(view, me, level, rand)`, joués par `Room` après un délai (700 à 1200 ms, ou `botDelayMs`, qui peut dépendre de l'état : Tsena attend la fin du rejeu avec `replayMs`). Ce sont des membres sans transport : ils ne gardent pas un salon vivant à eux seuls.
- **Options de partie** : un jeu déclare ses choix dans `GameDefinition.options` (mode, durée…). L'hôte les règle dans le salon et `setup` les reçoit. Un jeu avec des options passe par le salon même en solo. `clock(state, ms)` sert aux jeux au tour par tour qui suivent le temps réel (le mode « temps limité » de Tsena), environ une fois par seconde.
- **Pions** : `GameDefinition.pieces` liste les pions qu'un joueur choisit dans le salon, chacun pris une seule fois par salon. `setup` reçoit le pion de chaque siège : dans Miaraka, c'est le rôle (maki ou zébu). La vue les lit dans `room.players[].piece`, et le client du jeu fournit leur image (`pieceImage`).
- **Temps réel** : `tick(state, dt)` tourne à 20 Hz et l'état part à chaque tick. Une action d'un jeu en temps réel ne déclenche pas d'envoi en plus.
- **Niveaux de Miaraka** : des cartes en texte dans `miaraka/level.ts`, jouées à la suite à partir de celle que l'hôte choisit. Chaque niveau a son parcours de solution (`miaraka/solution.ts`) : les tests prouvent qu'on peut le finir, et `verify` rejoue la partie entière dans deux navigateurs, avec une capture par niveau. Une énigme ne doit jamais pouvoir se bloquer : une caisse qui bute revient à sa place, un levier minuté se réarme, et chaque zone a un point de retour. La caméra regarde du sud : un passage juste au nord d'une rangée de murs est caché, il faut un gouffre ou de l'eau à la place. Les conseils de chaque niveau sont dans `games/miaraka/hints.ts`.
- **Solo hors ligne** : `connection.playSolo` fait tourner un `Lobby` dans la page (aucun serveur). Les messages passent quand même par un aller-retour JSON asynchrone, pour se comporter comme le réseau.

## Ajouter un jeu

Utiliser la skill `/nouveau-jeu`. Elle couvre les règles, les tests, le bot, la vue (2D par défaut), le thème, l'enregistrement et la vérification.

## Style visuel

- **Jeux en 2D par défaut** (SVG + React), chacun avec un style fort : 4 en ligne en jouet cartoon, Serpents & échelles en papier, stylo et crayon. **Tsena** (propriétés à Madagascar) et **Miaraka** (aventure coopérative à deux, de Bemaraha à Kirindy) sont en 3D, à la demande de l'utilisateur : React Three Fiber, caméra qui suit le pion, modèles Blender. Pour la 3D : `flatShading`, 8 à 14 segments, modèles faits par script ou assets CC0.
- Tout ce qui demande WebGL passe par `hasWebGL()` / `ErrorBoundary` (`ui/ErrorBoundary.tsx`) : sans WebGL, l'app doit rester utilisable.
- Animations 2D : rejouer le `last` / journal envoyé par les règles (voir `useReplay` dans `games/snakes`), sauter au présent si on a pris du retard.
- Menu principal : **rétro arcade** (`apps/client/src/theme/arcade.ts` et `ArcadeBackdrop.tsx`). Chaque jeu a son propre thème, appliqué dès l'entrée dans son salon. Tous les styles passent par les variables CSS de `ThemeVar` (`theme/theme.ts`) : aucune couleur codée en dur dans `styles.css` en dehors des décorations `[data-theme='…']`.
- Polices embarquées via `@fontsource` (jamais de CDN) : le mode local doit marcher sans internet. Pas d'emoji composé (🏴‍☠️) : son U+200D fait charger le sous-ensemble devanagari de Baloo 2, ce qui échoue hors ligne.
- Modèles 3D : sources `.blend` dans `assets/blender/`, exports `.glb` dans `apps/client/public/models/` (MCP Blender disponible). Ceux de Miaraka sortent de `assets/blender/miaraka_assets.py`, qui reprend les outils du script de Tsena. Ceux de Tsena sortent de `assets/blender/tsena_assets.py` (un monument par site, 16 pions) : le relancer dans Blender puis appeler `export(...)`. `render_icons(...)` rend les vignettes des pions dans `games/tsena/pawns/`. Un `.glb` de jeu se précharge au démarrage (`useLoader.preload`), sinon le solo hors ligne n'a pas ses modèles.
- Tsena : l'ordre des cases (`packages/games/src/tsena/board.ts`) et la route sur l'île (`games/tsena/map.ts`) vont ensemble. Après un changement de l'un ou de l'autre, vérifier sur la carte qu'aucune tuile n'en chevauche une autre, que rien ne tombe dans la mer et que chaque site reste près de sa vraie ville.
- Animations CSS : ne jamais faire partir un texte utile de `opacity: 0`. Sur un appareil lent (ou en WebGL logiciel), l'animation n'avance pas et le texte reste invisible.
- Toujours penser **mobile portrait d'abord** : zones tactiles ≥ 44 px, `env(safe-area-inset-*)`, caméra qui cadre le plateau quel que soit le ratio.

## Vérifier avant de dire « c'est fait »

1. `npm run typecheck && npm test` (un hook Stop le relance automatiquement).
2. Pour tout changement visible : `npm run verify`, puis **regarder** les captures mobile et desktop. Le statut PASS ne garantit pas que c'est beau.
3. Dire ce qui a été lancé et ce qui a été vu ; si quelque chose n'a pas pu être vérifié, le dire.
