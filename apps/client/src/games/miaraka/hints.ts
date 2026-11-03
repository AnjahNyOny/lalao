import { cellIndex, cellsWith, charAt, LEVELS, type MiarakaState, type Role } from '@game/games/miaraka';

type Text = string | ((s: MiarakaState) => string);

/** One stage of a level: what each animal should do until `done` holds. */
interface Stage {
  done: (s: MiarakaState) => boolean;
  maki: Text;
  zebu: Text;
}

const cell = (level: number, cx: number, cz: number) => cellIndex(LEVELS[level], cx, cz);
const who = (s: MiarakaState, role: Role) => s.avatars.find((a) => a.role === role)!;
const picked = (level: number, cx: number, cz: number) => (s: MiarakaState) => s.picked.includes(cell(level, cx, cz));
/** Plates of a group pressed right now, out of how many. */
const plates = (s: MiarakaState, g: string) => {
  const cells = cellsWith(LEVELS[s.level], g).map(([cx, cz]) => cell(s.level, cx, cz));
  return `${cells.filter((c) => s.pressed.includes(c)).length}/${cells.length}`;
};
const crateOn = (s: MiarakaState, g: string) => s.crates.some((c) => charAt(LEVELS[s.level], c.x, c.z) === g);

const DOOR = 'Apportez la clé à la porte du trésor.';
const PADS = 'Chacun sur un socle, en même temps : le trésor s’ouvre !';

const STAGES: Stage[][] = [
  // 1. Le trésor des Tsingy
  [
    {
      done: (s) => s.broken.includes(cell(0, 7, 7)),
      zebu: 'Fonce dans le mur fissuré pour ouvrir le passage.',
      maki: 'Seul le zébu casse le mur fissuré. En attendant, saute cueillir la vanille sur les rochers !',
    },
    {
      done: (s) => s.levers.includes('b'),
      zebu: 'Monte sur la dalle aux cornes et restes-y : la palissade s’ouvre pour le maki.',
      maki: (s) =>
        s.open.includes('a') ? 'Passe la palissade, puis grimpe tirer le levier sur les rochers.' : 'La palissade ne s’ouvre que sous le poids du zébu, sur la dalle aux cornes.',
    },
    {
      done: (s) => s.open.includes('c'),
      zebu: 'Fonce dans la caisse pour la pousser sur la dalle : le pont descendra.',
      maki: 'Tiens la dalle près de la rivière pour le zébu, ou saute par-dessus l’eau !',
    },
    { done: (s) => s.keys > 0 || s.doors.length > 0, maki: 'Une clé brille en haut des rochers : saute la chercher !', zebu: 'Une clé brille en haut des rochers : seul le maki peut sauter la chercher.' },
    { done: (s) => s.doors.length > 0, maki: DOOR, zebu: DOOR },
  ],
  // 2. La grotte de l'Ankarana
  [
    {
      done: (s) => s.levers.includes('a'),
      zebu: (s) =>
        crateOn(s, 'a')
          ? `Monte sur une autre dalle ; le maki prend la dernière. Dalles : ${plates(s, 'a')}`
          : 'Fonce dans la caisse pour la pousser sur une dalle : il en faut trois pressées en même temps.',
      maki: (s) => `Trois dalles en même temps : toi, le zébu et la caisse. Éclaire-le ! Dalles : ${plates(s, 'a')}`,
    },
    {
      done: (s) => who(s, 'maki').x > 18,
      zebu: (s) => {
        const z = who(s, 'zebu');
        if (z.x < 12) return (s.timers.b ?? 0) > 0 ? 'Vite, fonce vers la grille avant qu’elle se referme !' : 'Tire le levier tout au nord, puis fonce vers la grille du sud avant qu’elle se referme.';
        return 'Monte sur la dalle aux cornes : la grille du maki s’ouvre, là-haut.';
      },
      maki: (s) =>
        who(s, 'maki').y > 1
          ? 'Le zébu doit tenir la dalle aux cornes pour t’ouvrir la grille. Gare à la chauve-souris !'
          : 'Saute sur le chemin de pierre, à l’est. La chauve-souris frappe ceux qui sont en hauteur.',
    },
    {
      done: (s) => s.broken.includes(cell(1, 19, 10)),
      zebu: (s) => (s.open.includes('c') ? 'Le pont est là : traverse et fonce dans le mur fissuré !' : 'Le maki doit tenir la dalle du pont, de son côté.'),
      maki: 'Tiens la dalle près de toi : un pont descend pour le zébu. Restes-y jusqu’à ce qu’il casse le mur.',
    },
    {
      done: (s) => s.keys > 0 || s.doors.length > 0,
      maki: 'La clé est au bout des planches pourries : elles ne tiennent que toi.',
      zebu: 'Les planches pourries cèdent sous ton poids : la clé, c’est pour le maki.',
    },
    { done: (s) => s.doors.length > 0, maki: DOOR, zebu: DOOR },
  ],
  // 3. Les gorges du Manambolo
  [
    {
      done: (s) => s.levers.includes('a'),
      zebu: 'Mets-toi au pied du grand rocher, sous le levier : le maki va grimper sur ton dos.',
      maki: 'Le rocher est trop haut : saute sur le dos du zébu, puis sur le rocher, et tire le levier !',
    },
    {
      done: (s) => s.crates.every((c) => c.sunk),
      zebu: 'Pousse les deux caisses dans les roseaux, au milieu de la rivière : elles feront un gué.',
      maki: (s) =>
        picked(2, 19, 3)(s) ? 'Le zébu construit son gué. Va tenir la dalle près de la deuxième rivière.' : 'Saute par-dessus la rivière : une clé t’attend sur l’île de la deuxième.',
    },
    {
      done: (s) => picked(2, 19, 3)(s),
      zebu: 'Traverse le gué quand le crocodile est loin. Le maki va chercher la clé sur l’île.',
      maki: 'La clé est sur l’île : saute, et lâche tout pour atterrir dessus.',
    },
    {
      done: (s) => who(s, 'zebu').x > 21,
      zebu: (s) => (s.open.includes('d') ? 'Le pont est là : traverse quand le crocodile est loin.' : 'Attends que le maki tienne la dalle du pont.'),
      maki: 'Tiens la dalle près de la deuxième rivière : le pont descend pour le zébu.',
    },
    { done: (s) => s.doors.length > 0, maki: DOOR, zebu: DOOR },
  ],
  // 4. La forêt de Kirindy
  [
    {
      done: (s) => crateOn(s, 'a'),
      zebu: 'Pousse la caisse sur la dalle aux cornes : la grille restera ouverte.',
      maki: 'La grille ne s’ouvre que sous un gros poids : le zébu et sa caisse.',
    },
    {
      done: (s) => s.levers.includes('b'),
      zebu: (s) => `Fonce sur le fosa pour l’étourdir, puis chacun sur une dalle en même temps. Dalles : ${plates(s, 'b')}`,
      maki: (s) => `Un fosa rôde ! Laisse le zébu l’étourdir, puis chacun sur une dalle. Dalles : ${plates(s, 'b')}`,
    },
    {
      done: picked(3, 17, 1),
      zebu: 'Protège le maki : fonce sur le fosa s’il approche.',
      maki: 'Une clé brille sur les rochers du nord : grimpe la chercher, le fosa ne grimpe pas.',
    },
    {
      done: (s) => s.levers.includes('d'),
      zebu: 'Les planches ne te tiendraient pas : le maki va t’ouvrir le grand pont.',
      maki: 'Traverse le pont de planches et tire le levier : le grand pont descendra pour le zébu.',
    },
    {
      done: picked(3, 27, 14),
      zebu: 'La deuxième clé est derrière le mur fissuré, au sud : fonce !',
      maki: 'Ouvre ta porte avec ta clé. La deuxième est pour le zébu, derrière un mur fissuré.',
    },
    { done: (s) => s.doors.length > 1, maki: 'Chacun sa porte, chacun sa clé.', zebu: 'Chacun sa porte, chacun sa clé.' },
  ],
];

const FOE_HINT: Record<string, Record<Role, string>> = {
  croc: { zebu: 'Le crocodile ! Fonce sur lui pour l’étourdir.', maki: 'Le crocodile ! Attends qu’il s’éloigne, ou que le zébu l’étourdisse.' },
  fosa: { zebu: 'Le fosa ! Fonce sur lui pour l’étourdir.', maki: 'Le fosa ! Monte sur un rocher, ou sur le dos du zébu.' },
  bat: { zebu: '', maki: 'La chauve-souris ! Reste au sol quand elle passe.' },
};

/** What to do next, for this animal, from where the pair has got to. */
export function hintFor(s: MiarakaState, role: Role): string {
  if (s.won) return 'Tous les trésors sont à vous deux !';
  if (s.lost) return 'Le temps est écoulé… On réessaie ?';
  if (s.cleared !== null) return 'Trésor trouvé ! En route pour la suite…';
  const me = who(s, role);
  const l = LEVELS[s.level];
  // A foe close to this animal, awake.
  const near = l.foes.findIndex((def, k) => {
    const f = s.foes[k];
    return f.stun <= 0 && Math.hypot(f.x - me.x, f.z - me.z) < 3 && FOE_HINT[def.kind][role];
  });
  if (near >= 0) return FOE_HINT[l.foes[near].kind][role];
  const stage = STAGES[s.level].find((st) => !st.done(s));
  if (!stage) return PADS;
  const text = stage[role];
  return typeof text === 'string' ? text : text(s);
}
