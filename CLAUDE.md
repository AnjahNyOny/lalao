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
```

## Architecture

```
packages/core     protocole, Lobby/Session/Room — indépendants du transport (WebSocket aujourd'hui, téléphone hôte demain)
packages/games    règles des jeux : une GameDefinition pure par dossier, + tests
apps/server       Node + ws ; sert aussi le client compilé ; /api/lan donne l'IP locale
apps/client       React + React Three Fiber ; net/connection.ts = client WS + reconnexion
scripts/verify    vérification de bout en bout (playwright-core + Chrome installé)
```

Règles qui tiennent l'architecture :

- **Les règles d'un jeu sont du code pur.** Pas d'import de React, three, ws ni du DOM dans `packages/games`. Tout le hasard passe par le `seed` de `setup` (`mulberry32` dans core), jamais `Math.random`.
- **Le serveur fait autorité.** Le client n'envoie que des intentions (`act(action)`) ; `validate` vérifie aussi la *forme* de l'action, puisqu'elle arrive du réseau.
- **Information cachée** (mains, pioches) : filtrer avec `viewFor`. Une vue ne doit jamais contenir ce que le joueur n'a pas le droit de voir.
- Le client ne réimplémente pas les règles : il affiche la vue reçue. Pour un retour immédiat, préférer une anticipation visuelle (jeton fantôme…) à une prédiction d'état.
- `window.__lalao` (client) expose l'état et `act` pour les tests automatisés.

## Ajouter un jeu

Utiliser la skill `/nouveau-jeu`. Elle couvre les règles, les tests, la vue 3D, l'enregistrement et la vérification.

## Style visuel

- Low-poly : `flatShading`, peu de segments (8 à 14), formes générées en code en priorité ; assets CC0 (Kenney, Quaternius, Poly Pizza) pour les personnages et décors.
- Menu principal : **rétro arcade** (`apps/client/src/theme/arcade.ts` et `ArcadeBackdrop.tsx`). Chaque jeu a son propre thème, appliqué dès l'entrée dans son salon. Tous les styles passent par les variables CSS de `ThemeVar` (`theme/theme.ts`) : aucune couleur codée en dur dans `styles.css` en dehors des décorations `[data-theme='…']`.
- Polices embarquées via `@fontsource` (jamais de CDN) : le mode local doit marcher sans internet.
- Modèles 3D : sources `.blend` dans `assets/blender/`, exports `.glb` dans `apps/client/public/models/` (MCP Blender disponible).
- Toujours penser **mobile portrait d'abord** : zones tactiles ≥ 44 px, `env(safe-area-inset-*)`, caméra qui cadre le plateau quel que soit le ratio.

## Vérifier avant de dire « c'est fait »

1. `npm run typecheck && npm test` (un hook Stop le relance automatiquement).
2. Pour tout changement visible : `npm run verify`, puis **regarder** les captures mobile et desktop. Le statut PASS ne garantit pas que c'est beau.
3. Dire ce qui a été lancé et ce qui a été vu ; si quelque chose n'a pas pu être vérifié, le dire.
