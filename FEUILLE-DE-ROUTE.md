# Feuille de route de Lalao

C'est le chat principal qui tient ce fichier, celui qui est ouvert dans le dossier principal (`/Users/mac/Projects/game`). Les autres chats le lisent à cet endroit, sans le modifier.

Dernière mise à jour : 2026-11-04.

## En cours

| Chantier | Dossier | Branche | État |
|---|---|---|---|
| **Kalesa** : nouveau jeu (description à compléter) | `../game-kalesa` | `jeu/kalesa` | Démarré le 2026-11-04. À fusionner dès qu'il est fini. |

## Jeux finis

| Jeu | Genre | Rendu |
|---|---|---|
| 4 en ligne | plateau, au tour par tour | 2D, jouet cartoon |
| Serpents & échelles | plateau, au tour par tour | 2D, papier, stylo et crayon |
| Tsena | propriétés à Madagascar, 48 cases | 3D, modèles Blender |
| Miaraka | coopératif à deux, en temps réel, 4 niveaux de Bemaraha à Kirindy | 3D, modèles Blender |
| Tady | coopératif à deux encordés, escalade du Pic Boby, plus dur vers le sommet | pixel art |

## Plateforme : ce qui est fait

- Menu rétro arcade, un thème par jeu.
- Bots à trois niveaux, solo hors ligne.
- Options de partie et choix du pion dans le salon.
- En ligne sur https://lalao.anjahnyony.com depuis le 2026-11-03. Version en ligne : à vérifier (`readlink /var/www/lalao/current` sur le VPS).
- Plusieurs chats en même temps, un chantier par jeu (`scripts/worktree.sh`) : depuis le 2026-11-04.

## À faire et à décider

- **`main` est resté au premier commit.** Tout le travail est sur `feat/menu-arcade-themes`. Tady est commité : on peut fusionner dans `main` quand on veut.
- Pousser sur GitHub : les commits du 2026-11-04 n'y sont pas encore.
- Déployer la reprise de Tady (`a03cea4`, 2026-11-04), puis Kalesa une fois fusionné.
- Plus tard (décidé le 2026-11-02) : Capacitor (iOS, Android), Tauri (desktop), un téléphone qui fait serveur hôte.

## Idées pour la suite

(à remplir)

## Décisions

- 2026-11-02 : le web d'abord (TypeScript, React Three Fiber, Node et ws). Godot et React Native sont écartés.
- 2026-11-02 : jeux en 2D par défaut, chacun avec son style. La 3D, seulement sur demande (Tsena, Miaraka).
- 2026-11-02 : menu principal en rétro arcade.
- Toujours : un jeu original du genre demandé, jamais une copie. Tsena n'est pas le Monopoly, Tady n'est pas Chained Together.
- 2026-11-03 : mise en ligne sur le VPS IONOS (nginx et PM2). On compile sur le Mac, jamais sur le VPS.
- 2026-11-04 : un chantier par jeu (worktree et chat). Le chat principal relit, fusionne, vérifie l'ensemble, pousse et déploie.

## Quand un chantier est fini

1. Son chat commite dans son chantier.
2. Le chat principal relit la branche, la fusionne, lance `npm run typecheck && npm test` et `npm run verify` sur tous les jeux.
3. Il supprime le chantier, met à jour ce fichier, puis pousse et déploie si on le décide.
