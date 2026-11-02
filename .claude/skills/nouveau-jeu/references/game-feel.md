# Game feel pour les jeux de plateau Lalao

Le « juice » sert à **rendre l'état lisible**, pas à décorer. Si un effet cache le prochain choix du joueur, c'est un bug.

Par ordre de priorité :

1. **Réponse immédiate (< 100 ms).** Toucher une case, une colonne ou un pion doit produire une réaction visible tout de suite (survol, fantôme, léger soulèvement), avant même la réponse du serveur.
2. **Mouvement avec du poids.** Rien ne se téléporte. Une chute avec gravité et un petit rebond, un déplacement avec `easeOutCubic`, une apparition avec `easeOutBack` (léger dépassement).
3. **Contact.** Au moment où une pièce arrive : un petit écrasement-étirement (`scale` 1.15 / 0.85 sur 120 ms), une poussière, un son.
4. **Caméra.** Une secousse brève et proportionnelle à l'événement : discrète pour un coup normal, plus forte pour une victoire. Ne jamais sortir le plateau du cadre.
5. **Son.** Il part sur la même frame que le visuel, avec une légère variation de hauteur (±5 %) pour que les répétitions ne lassent pas.

Hiérarchie des événements, du plus discret au plus marqué : survol < coup joué < capture ou bonus < fin de partie.

Pièges fréquents :
- animer **toute** la scène quand l'état change, au lieu de la seule pièce jouée ;
- rejouer les animations de toutes les pièces après une reconnexion ;
- une animation plus longue que le délai avant le tour suivant (le joueur suivant attend) ; viser **moins de 600 ms** ;
- allouer des objets three.js dans `useFrame` : les créer une fois avec `useMemo` ou `useRef`.

Petit utilitaire d'easing, à mettre en commun dans `apps/client/src/fx/` quand un deuxième jeu en a besoin :

```ts
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
```
