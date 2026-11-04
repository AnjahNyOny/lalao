---
name: verifier
description: Vérifier Lalao comme un joueur le vivrait — vraie partie dans Chrome sur mobile et desktop, captures à inspecter, erreurs de console. À utiliser après tout changement visible (interface, 3D, thème, nouveau jeu) et avant d'annoncer qu'une fonctionnalité est terminée.
---

# Vérifier Lalao

## Lancer

```bash
npm run typecheck && npm test
npm run verify               # tous les jeux
npm run verify -- connect4   # un seul jeu
```

`verify` compile le client, démarre le serveur sur un port libre (plusieurs chantiers peuvent vérifier en même temps), ouvre Chrome (l'hôte en mobile 390×844, l'invité en desktop 1280×800), crée un salon, fait entrer les joueurs, joue une partie complète via `window.__lalao`, vérifie l'écran de résultat et la revanche, mesure que le canvas n'est pas vide et collecte les erreurs de console. Les lignes `PASS`/`FAIL` s'affichent, et le script sort en code 1 en cas d'échec.

Chrome doit être installé. Sinon : `CHROME_PATH=/chemin/vers/chrome npm run verify`.

## Regarder (obligatoire)

`PASS` prouve que ça fonctionne, pas que c'est réussi. Ouvrir avec Read les captures de `artifacts/verify/<jeu>/` :

| Capture | Ce qu'on vérifie |
| --- | --- |
| `1-accueil-mobile` | lisibilité, rien de coupé, thème appliqué |
| `2-salon-mobile` | code et QR lisibles, liste des joueurs |
| `3-debut-*` | le plateau entier est cadré dans les deux formats, le HUD ne masque rien d'important |
| `4-resultat-*` | la fin de partie est claire, le bouton est accessible au pouce |

Points à surveiller : texte qui déborde, éléments sous les zones sûres (encoche), cibles tactiles plus petites que 44 px, contraste faible, pièces trop petites sur mobile.

## Au-delà du script

- **Nouveau geste de jeu** : tester par un vrai clic ou tap (`page.mouse.click`), pas seulement via `act`.
- **Animation modifiée** : prendre 3 ou 4 captures espacées de 100 ms pendant le mouvement.
- **Réseau** : couper puis rouvrir un onglet en pleine partie ; le joueur doit retrouver sa place.
- **Vrai téléphone** : `npm run dev`, puis scanner le QR depuis un téléphone sur le même Wi-Fi. À proposer à l'utilisateur pour les changements d'entrée tactile.

## Rapporter

Dire ce qui a été lancé, le résultat (PASS/FAIL), ce qu'on a **vu** sur les captures, et ce qui n'a pas pu être vérifié.
