---
name: nouveau-jeu
description: Ajouter un mini-jeu à Lalao de bout en bout (règles pures + tests, bot, vue 2D par défaut ou 3D sur demande, thème, enregistrement, scénario de vérification). À utiliser dès qu'on crée un nouveau jeu ou qu'on reprend un jeu existant en profondeur.
---

# Nouveau jeu Lalao

Livrer un jeu **jouable de bout en bout et vérifié**, pas une scène 3D. L'ordre compte : les règles d'abord (testables sans écran), l'affichage ensuite.

## 0. Cadrer (5 lignes, dans la réponse et pas dans un fichier)

- **Promesse** : le plaisir du jeu en une phrase.
- **Verbe principal** : ce que fait le joueur à son tour (poser, lancer, déplacer…) et comment, au doigt sur mobile.
- **Joueurs** : `minPlayers` et `maxPlayers` (4 au maximum). Tour par tour ou temps réel ?
- **Information cachée ?** Si oui, il faut un `viewFor`.
- **Fin de partie** : victoire, égalité, durée visée (3 à 10 minutes).

Les jeux reprennent des mécaniques classiques ou originales, jamais la copie d'un jeu commercial existant (nom, plateau, illustrations).

## 1. Règles — `packages/games/src/<id>/index.ts`

Modèle de référence : `packages/games/src/connect4/index.ts`.

- Exporter `export const <id>: GameDefinition<State, Action>` ainsi que les constantes et fonctions utiles à la vue (`COLS`, `dropRow`…).
- `State` est un objet JSON simple (pas de `Map`, de classes ni de fonctions) : il passe par le réseau.
- `validate` vérifie le tour **et** la forme de l'action (`typeof`, `Number.isInteger`, bornes). Il renvoie `false` si la partie est finie.
- `apply` est pur : il copie et ne mute jamais `state`.
- Hasard : `mulberry32(seed)` de `@game/core`. Si le hasard intervient pendant la partie (dés…), stocker l'état du générateur dans `State`.
- Temps réel : `tick(state, dtMs)` est appelé à 20 Hz par le serveur ; le client interpole.
- Si le jeu a plusieurs façons de jouer ou de finir (durée, mode), les déclarer dans `options` : l'hôte les choisit dans le salon, `setup(players, seed, options)` les reçoit. Le modèle est `TSENA_OPTIONS`. Une limite de temps passe par `clock(state, ms)`, jamais par `Date.now()` dans les règles.
- Si les joueurs choisissent une pièce ou un pion, les lister dans `pieces` ; le client fournit `pieceImage` (voir Tsena et ses vignettes rendues dans Blender).
- Enregistrer le jeu dans `packages/games/src/index.ts`.

## 2. Tests — `packages/games/src/<id>/<id>.test.ts`

Au minimum : la mise en place, un coup normal, chaque condition de victoire, l'égalité si elle est possible, et les refus (hors tour, action malformée, coup illégal, coup après la fin). Ajouter `viewFor` (ce qui ne doit **pas** fuiter) si le jeu en a un. `npm test` doit passer avant de toucher à la vue.

## 2 bis. Bot — `packages/games/src/<id>/bot.ts`

Modèle : `connect4/bot.ts`. Se branche via `bot` sur la `GameDefinition` ; sans bot, le jeu n'apparaît pas en mode solo.

- Le bot reçoit **la vue du joueur** (`viewFor`), pas l'état complet : il ne triche pas. Il renvoie `null` quand ce n'est pas à lui de jouer.
- Hasard : uniquement le `rand` fourni.
- Trois niveaux qui se ressentent : `easy` (rate souvent l'évidence), `medium` (gagne et bloque, évite les pièges immédiats), `hard` (recherche : minimax ou heuristique forte). Viser moins de 50 ms par coup sur un Mac, soit environ 200 ms sur un téléphone.
- Tests : toujours un coup légal jusqu'à la fin de partie, à tous les niveaux ; prend une victoire immédiate ; bloque une menace ; `hard` bat nettement `easy` sur une dizaine de parties.

## 3. Vue — `apps/client/src/games/<id>/<Id>View.tsx`

Props : `GameViewProps` (`view`, `me`, `room`, `act`). **Par défaut en 2D** (choix de l'utilisateur pour l'instant) : modèle `apps/client/src/games/snakes/` (SVG). Autre modèle 2D, plus simple : `connect4/` (jetons qui tombent derrière un plateau masqué). La 3D reste possible sur demande : modèle `games/tsena/` (`Scene.tsx` : caméra et ombres qui suivent le pion, décor en `InstancedMesh` ; `assets.tsx` : `.glb` Blender préchargé, matériau `Owner` repeint à la couleur du joueur ; `replay.ts` : journal rejoué, lu à chaque frame).

- **2D (SVG)** : le décor statique dans un `memo` sur son propre calque, les pièces animées sur un calque au-dessus (pas de repaint des filtres). Un style dessiné et fort par jeu (filtres `feTurbulence`/`feDisplacementMap`, motifs, polices `@fontsource` ajoutées dans `main.tsx`, préchargement compris).
- **Cadrage** : le plateau tient en portrait **et** en paysage (`container-type: size` + unités `cq`, ou `CameraRig` en 3D). En portrait : infos en haut, plateau, commandes en bas sous le pouce.
- **Animations** : si les règles produisent plusieurs étapes par coup, mettre un journal (`last`, avec `seq`) dans l'état et le rejouer côté client ; régler `botDelayMs` sur la durée des animations.
- **3D** (si demandé) : `flatShading`, 8 à 14 segments, `hasWebGL()` + `ErrorBoundary`, et une vue de secours sans WebGL qui reste jouable (Tsena : la route en liste, le HUD inchangé). Modèles par script Blender versionné (`assets/blender/tsena_assets.py`), textes des cases en `CanvasTexture` (police chargée avant de dessiner).
- **Entrée** : zones cliquables généreuses (transparentes, pas `visible={false}`), avec un aperçu du coup avant validation (fantôme, surbrillance). N'envoyer `act` que si c'est le tour du joueur.
- **HUD** (HTML par-dessus le canvas) : joueurs avec leur couleur, à qui le tour, « À toi de jouer ! ». L'écran de résultat et « Rejouer » sont gérés par `RoomScreen`, pas à refaire.
- **Game feel** : voir `references/game-feel.md`. Au minimum : une animation de l'action jouée et une mise en valeur de la fin. Pas d'animation CSS qui part de `opacity: 0` sur un texte utile : sur un appareil lent, elle reste bloquée au début.
- **Thème** : `apps/client/src/games/<id>/theme.ts` exporte un `Theme` (toutes les variables `ThemeVar`, appliquées du salon jusqu'au résultat) et la palette du jeu (couleurs des joueurs, du décor). La vue n'a aucune couleur codée en dur. Décorations propres au thème dans `styles.css` sous `[data-theme='<id>']`. Modèle : `snakes/theme.ts`. Chaque jeu a sa propre ambiance, qui doit rester lisible : contraste du texte sur `--card` et `--bg`, et des couleurs de joueurs bien distinctes.
- Enregistrer la vue et le thème dans `apps/client/src/games/index.ts`, avec un emoji.

## 4. Vérifier

1. Ajouter un `Chooser` dans `scripts/verify/scenarios.ts` (coups légaux aléatoires, ou `null` si ce n'est pas le tour du joueur).
2. `npm run typecheck && npm test`
3. `npm run verify -- <id>`, puis **ouvrir et regarder** les captures `artifacts/verify/<id>/` (début et résultat, mobile et desktop). Corriger tout ce qui est coupé, illisible, trop petit ou caché par le HUD.
4. Si le geste de jeu est nouveau (glisser, viser…), le tester aussi par un vrai clic ou tap dans le navigateur, pas seulement via `window.__lalao.act`.

## Rapport final

Ce que fait le jeu, comment on joue, les résultats des tests et de verify, ce qu'on voit sur les captures, et les limites connues.
