# Salle de jeux

Plateforme de mini-jeux multijoueur (2 à 4 joueurs), en ligne ou en réseau local.

## Commandes

```bash
npm install
npm run dev        # serveur (port 3000) + client Vite (port 5173), accessible sur le Wi-Fi
npm test           # tests de la logique des jeux et des salons
npm run typecheck
npm run verify     # vraie partie dans Chrome (mobile + desktop), captures dans artifacts/verify/
npm run build && npm start   # mode « hôte local » : un seul serveur sur le port 3000
```

En local, les autres appareils du même Wi-Fi scannent le QR code du salon.

## Structure

- `packages/core` : types communs, protocole, salons (`Lobby`, `Room`), indépendants du transport
- `packages/games` : règles de chaque mini-jeu, en code pur (`GameDefinition`)
- `apps/server` : serveur Node + WebSocket, sert aussi le client compilé
- `apps/client` : React + React Three Fiber (3D low-poly)

## Ajouter un jeu

1. `packages/games/src/<jeu>/index.ts` : une `GameDefinition` et ses tests
2. L'enregistrer dans `packages/games/src/index.ts`
3. `apps/client/src/games/<jeu>/` : la vue, enregistrée dans `apps/client/src/games/index.ts`
# lalao
