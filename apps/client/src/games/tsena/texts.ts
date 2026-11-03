import {
  BAIL,
  CARD_BONUS,
  CARD_CASH,
  CARD_GIFT,
  CARD_HELP,
  CARD_REPAIRS,
  CARD_STEPS,
  CELLS,
  FESTIVAL_GIFT,
  LAND_TAX,
  REGIONS,
  SALARY,
  TAXI_RANGE,
  type CardId,
  type CellKind,
  type Deck,
  type TsenaEvent,
} from '@game/games/tsena';

/** « 1 200 Ar », never split across two lines. */
export const ar = (n: number) => `${n.toLocaleString('fr-FR').replace(/\s/g, ' ')} Ar`;

export interface SiteInfo {
  /** Landmark model, from `assets/blender/tsena_assets.py`. */
  model: string;
  icon: string;
  monument: string;
  famous: string;
}

/**
 * What every site is known for, and the landmark standing beside its cell.
 * Icons are single emoji: a joined one (🏴‍☠️) contains U+200D, which sends the
 * browser after Baloo 2's Devanagari subset, and offline that request fails.
 */
export const SITES: Record<string, SiteInfo> = {
  Antsirabe: { model: 'pousse_pousse', icon: '🛺', monument: 'L’Hôtel des Thermes', famous: 'La ville d’eaux et ses pousse-pousse de toutes les couleurs.' },
  'Lac Tritriva': { model: 'crater_lake', icon: '💧', monument: 'Le lac de cratère', famous: 'Une eau vert émeraude au fond d’un volcan, et la légende de deux amants.' },
  Ambositra: { model: 'zafimaniry', icon: '🪵', monument: 'Les maisons zafimaniry', famous: 'Capitale de l’artisanat : marqueterie et sculpture zafimaniry, patrimoine de l’UNESCO.' },
  Ranomafana: { model: 'bamboo', icon: '♨️', monument: 'Le parc national', famous: 'Forêt humide, sources chaudes et le rare lémur bambou doré.' },
  Fianarantsoa: { model: 'train', icon: '🚂', monument: 'La haute-ville', famous: 'Le train FCE part d’ici vers la côte Est. Thé de Sahambavy et vignobles.' },
  Ambalavao: { model: 'zebu_market', icon: '🐂', monument: 'Le marché aux zébus', famous: 'Le plus grand marché aux zébus du pays, et le papier antemoro aux fleurs séchées.' },
  Isalo: { model: 'isalo_window', icon: '🌄', monument: 'La Fenêtre de l’Isalo', famous: 'Canyons de grès, piscines naturelles, et le soleil qui se couche dans la Fenêtre.' },
  Ilakaka: { model: 'sapphire_mine', icon: '💎', monument: 'Les mines de saphir', famous: 'La ruée vers le saphir a fait naître la ville en 1998.' },
  Taolagnaro: { model: 'fort', icon: '🦞', monument: 'Le fort Flacourt', famous: 'Fort-Dauphin, ses plages, le pic Saint-Louis et ses langoustes.' },
  Berenty: { model: 'sifaka', icon: '🐒', monument: 'La réserve de Berenty', famous: 'Les propithèques qui traversent en dansant, et les makis catta.' },
  Anakao: { model: 'vezo', icon: '🛶', monument: 'Le village vezo', famous: 'Pêcheurs vezo, pirogues à balancier et l’îlot de Nosy Ve.' },
  Toliara: { model: 'mahafaly_tomb', icon: '☀️', monument: 'Les tombeaux mahafaly', famous: 'La ville du soleil, et les tombeaux ornés d’aloalo sculptés et de cornes de zébu.' },
  Ifaty: { model: 'spiny_forest', icon: '🌵', monument: 'La forêt épineuse', famous: 'Baobabs bouteilles et arbres-pieuvres, qu’on ne trouve nulle part ailleurs.' },
  Morondava: { model: 'baobab_alley', icon: '🌳', monument: 'L’Allée des Baobabs', famous: 'Des baobabs géants, vieux de plusieurs siècles, au coucher du soleil.' },
  Kirindy: { model: 'fossa', icon: '🐾', monument: 'La forêt de Kirindy', famous: 'Forêt sèche où l’on croise le fossa, le grand prédateur de l’île.' },
  'Tsingy de Bemaraha': { model: 'tsingy_bridge', icon: '🪨', monument: 'Les Tsingy', famous: 'Une forêt d’aiguilles de calcaire et ses ponts suspendus, patrimoine de l’UNESCO.' },
  Mahajanga: { model: 'giant_baobab', icon: '🌅', monument: 'Le baobab géant', famous: 'Le baobab du front de mer, vieux de plusieurs siècles, et ses couchers de soleil.' },
  'Nosy Be': { model: 'ylang', icon: '🌼', monument: 'Le mont Passot', famous: 'L’île aux parfums : on y distille l’ylang-ylang.' },
  Ambanja: { model: 'cacao', icon: '🍫', monument: 'Les plantations du Sambirano', famous: 'Le cacao fin du Sambirano, parmi les plus réputés au monde.' },
  "Montagne d'Ambre": { model: 'waterfall', icon: '🦎', monument: 'Le parc national', famous: 'Cascades, forêt humide et caméléons minuscules.' },
  Antsiranana: { model: 'sugarloaf', icon: '⛵', monument: 'Le Pain de Sucre', famous: 'Diego-Suarez et sa baie immense, gardée par le Pain de Sucre.' },
  "Mer d'Émeraude": { model: 'dhow', icon: '🌊', monument: 'Le lagon', famous: 'Un lagon turquoise, des boutres et du kitesurf.' },
  Sambava: { model: 'vanilla', icon: '🌿', monument: 'Les vanilleraies', famous: 'La capitale de la vanille, la plus réputée du monde.' },
  Marojejy: { model: 'peaks', icon: '⛰️', monument: 'Le massif du Marojejy', famous: 'Des sommets dans les nuages et le propithèque soyeux.' },
  Masoala: { model: 'aye_aye', icon: '🌴', monument: 'Le parc de Masoala', famous: 'La plus grande forêt tropicale de l’île, royaume de l’aye-aye.' },
  'Nosy Boraha': { model: 'pirate_cemetery', icon: '☠️', monument: 'Le cimetière des pirates', famous: 'Sainte-Marie : les baleines à bosse en hiver austral, et l’ancien repaire des pirates.' },
  Toamasina: { model: 'port_crane', icon: '🚢', monument: 'Le grand port', famous: 'Premier port du pays, et capitale du litchi.' },
  Andasibe: { model: 'indri', icon: '🎶', monument: 'Le parc d’Andasibe', famous: 'Le chant de l’indri, le plus grand des lémuriens.' },
  'Lac Anosy': { model: 'anosy', icon: '💜', monument: 'Le monument aux morts', famous: 'Le lac en forme de cœur, son ange noir et les jacarandas en fleur.' },
  Ambohimanga: { model: 'stone_gate', icon: '👑', monument: 'La colline royale', famous: 'La ville sacrée, patrimoine de l’UNESCO, et ses portes fermées par un disque de pierre.' },
  Rova: { model: 'rova', icon: '🏰', monument: 'Le palais de la Reine', famous: 'Manjakamiadana domine Tana du haut de sa colline.' },
};

export const siteOf = (cell: number) => SITES[CELLS[cell].name];

export const DECK_LABEL: Record<Deck, string> = { vintana: 'Vintana', fihavanana: 'Fihavanana' };

const pay = (id: CardId) => ar(-CARD_CASH[id]!);
const earn = (id: CardId) => ar(CARD_CASH[id]!);

export const CARD_TEXT: Record<CardId, { title: string; text: string }> = {
  wind: { title: 'Bon vent', text: `Avance de ${CARD_STEPS} cases.` },
  flood: { title: 'Route inondée', text: `Recule de ${CARD_STEPS} cases.` },
  tana: { title: 'Retour à Tana', text: `Va à Antananarivo et touche ${ar(SALARY)}.` },
  taxi: { title: 'Taxi gratuit', text: 'Va à la prochaine gare : le trajet suivant est offert.' },
  rova: { title: 'Visite du Rova', text: 'Va au Rova. Si tu passes par Tana, touche ton salaire.' },
  whales: { title: 'Saison des baleines', text: 'Va voir les baleines à Nosy Boraha.' },
  tsingy: { title: 'Expédition aux Tsingy', text: 'Va aux Tsingy de Bemaraha.' },
  roadblock: { title: 'Contrôle surprise', text: 'Papiers pas en règle : va au fonja, sans toucher ton salaire.' },
  pass: { title: 'Laissez-passer', text: 'Garde cette carte : elle te fait sortir du fonja.' },
  pothole: { title: 'Nid-de-poule', text: `Le taxi-brousse casse un ressort : paie ${pay('pothole')}.` },
  rains: { title: 'Saison des pluies', text: `Les toits fuient : ${ar(CARD_REPAIRS.house)} par maison, ${ar(CARD_REPAIRS.hotel)} par hôtel.` },
  savika: { title: 'Savika', text: `Ton zébu gagne le combat : reçois ${earn('savika')}.` },
  vanilla: { title: 'Récolte de vanille', text: `Les gousses sont superbes : reçois ${earn('vanilla')}.` },
  wedding: { title: 'Mariage dans la famille', text: `Chaque joueur t’offre ${ar(CARD_GIFT)}.` },
  lemur: { title: 'Maki farceur', text: `Il chipe ta monnaie : donne ${ar(CARD_GIFT)} à chaque joueur.` },
  doctor: { title: 'Chez le médecin', text: `La consultation : paie ${pay('doctor')}.` },
  school: { title: 'Rentrée scolaire', text: `Fournitures et écolage : paie ${pay('school')}.` },
  inheritance: { title: 'Héritage', text: `Une tante de Fianarantsoa te lègue ${earn('inheritance')}.` },
  kabary: { title: 'Beau kabary', text: `Ton discours fait l’unanimité : reçois ${earn('kabary')}.` },
  independence: { title: 'Fête du 26 juin', text: `Jour de l’Indépendance : la banque offre ${ar(CARD_BONUS)} à tout le monde.` },
  lawyer: { title: 'Un cousin avocat', text: 'Garde cette carte : elle te fait sortir du fonja.' },
  rice: { title: 'Le prix du riz grimpe', text: `Paie ${pay('rice')}.` },
  market: { title: 'Bonne journée au marché', text: `Reçois ${earn('market')}.` },
  solidarity: { title: 'Fihavanana', text: `Donne ${ar(CARD_HELP)} au joueur le moins riche.` },
  family: { title: 'La famille t’aide', text: `Le joueur le plus riche te donne ${ar(CARD_HELP)}.` },
};

export const KIND_LABEL: Record<CellKind, string> = {
  start: 'Départ',
  site: '',
  taxi: 'Taxi-brousse',
  vintana: 'Vintana',
  fihavanana: 'Fihavanana',
  tax: 'Hetra',
  landtax: 'Taxe foncière',
  festival: 'Hira gasy',
  cyclone: 'Cyclone',
  jail: 'Fonja',
  roadblock: 'Barrage',
};

export const KIND_ICON: Record<CellKind, string> = {
  start: '🏁',
  site: '',
  taxi: '🚐',
  vintana: '💎',
  fihavanana: '🧺',
  tax: '🏛️',
  landtax: '📜',
  festival: '🥁',
  cyclone: '🌀',
  jail: '⛓️',
  roadblock: '🚧',
};

/** What a special cell does, for the cell info panel. */
export const KIND_HELP: Record<Exclude<CellKind, 'site'>, string> = {
  start: `Le marché d’Analakely. En passant par Tana, touche ${ar(SALARY)}.`,
  taxi: `Paie le billet pour sauter jusqu’à ${TAXI_RANGE} cases plus loin.`,
  vintana: 'Carte du destin : la route t’emmène ailleurs, ou la chance tourne.',
  fihavanana: 'Carte de la solidarité : on donne, on reçoit.',
  tax: 'Hetra : 10 % de ton argent pour l’impôt.',
  landtax: `${ar(LAND_TAX.site)} par site, ${ar(LAND_TAX.house)} par maison, ${ar(LAND_TAX.hotel)} par hôtel.`,
  festival: `Spectacle ! Chaque joueur te donne ${ar(FESTIVAL_GIFT)}.`,
  cyclone: 'Ton plus grand bâtiment perd un niveau.',
  jail: `Simple visite. Au fonja, fais un double, paie ${ar(BAIL)} ou montre un laissez-passer.`,
  roadblock: 'Contrôle de gendarmerie : direction le fonja !',
};

export const cellName = (cell: number) => CELLS[cell].name;
export const regionName = (cell: number) => REGIONS[CELLS[cell].region!];

/** Sites that don't take a plain « à ». */
const SITE_AT: Record<string, string> = {
  'Lac Tritriva': 'au lac Tritriva',
  Isalo: 'à l’Isalo',
  'Tsingy de Bemaraha': 'aux Tsingy de Bemaraha',
  "Montagne d'Ambre": 'à la Montagne d’Ambre',
  "Mer d'Émeraude": 'à la Mer d’Émeraude',
  Marojejy: 'au Marojejy',
  'Lac Anosy': 'au lac Anosy',
  Rova: 'au Rova',
};

/** « à Toliara », « à la gare »… for captions. */
const AT: Record<CellKind, (name: string) => string> = {
  start: (n) => `à ${n}`,
  site: (n) => SITE_AT[n] ?? `à ${n}`,
  taxi: () => 'à la gare du taxi-brousse',
  vintana: () => 'sur une case Vintana',
  fihavanana: () => 'sur une case Fihavanana',
  tax: () => 'au bureau des impôts',
  landtax: () => 'au cadastre',
  festival: () => 'au hira gasy',
  cyclone: () => 'dans le cyclone',
  jail: () => 'devant le fonja',
  roadblock: () => 'au barrage',
};
const at = (cell: number) => AT[CELLS[cell].kind](CELLS[cell].name);

/** A caption for one step of an action. `who` is the actor's name; `mine` switches to « tu ». */
export function describe(e: TsenaEvent, who: string, mine: boolean, name: (seat: number) => string): string {
  const v = (you: string, them: string) => (mine ? `Tu ${you}` : `${who} ${them}`);
  switch (e.t) {
    case 'dice':
      return `${v('lances', 'lance')} les dés : ${e.dice[0]} + ${e.dice[1]}${e.dice[0] === e.dice[1] ? ', double !' : ''}`;
    case 'move': {
      const to = e.path[e.path.length - 1];
      if (e.via === 'jail') return 'Direction le fonja !';
      if (e.via === 'taxi') return `${v('prends', 'prend')} le taxi-brousse, direction ${cellName(to)}`;
      if (e.via === 'back') return `${v('recules', 'recule')} ${at(to)}`;
      if (e.via === 'card') return `${v('files', 'file')} ${at(to)}`;
      return `${v('arrives', 'arrive')} ${at(to)}`;
    }
    case 'salary':
      return `Passage à Tana : +${ar(e.amount)}`;
    case 'again':
      return `Double : ${v('rejoues', 'rejoue')} !`;
    case 'buy':
      return `${v('achètes', 'achète')} ${cellName(e.cell)} !`;
    case 'rent':
      return `Loyer : ${ar(e.amount)} pour ${name(e.to)}`;
    case 'card':
      return `${DECK_LABEL[e.deck]} — ${CARD_TEXT[e.card].title}`;
    case 'cash':
      return e.amount >= 0 ? `+${ar(e.amount)}` : `−${ar(-e.amount)}`;
    case 'tax':
      if (e.kind === 'tax') return `Hetra : ${ar(e.amount)} d’impôt`;
      if (e.kind === 'landtax') return e.amount ? `Taxe foncière : ${ar(e.amount)}` : 'Taxe foncière : rien à payer';
      return e.amount ? `Réparations : ${ar(e.amount)}` : 'Pas de toit, pas de fuite !';
    case 'fare':
      return `Billet de taxi-brousse : −${ar(e.amount)}`;
    case 'gift':
      return `${name(e.from)} donne ${ar(e.amount)} à ${name(e.to)}`;
    case 'bonus':
      return `Tout le monde reçoit ${ar(e.amount)}`;
    case 'keep':
      return `${v('gardes', 'garde')} un laissez-passer`;
    case 'cyclone':
      return e.cell === null ? 'Le cyclone passe sans rien abîmer.' : `Le cyclone abîme ${cellName(e.cell)} !`;
    case 'jail':
      return mine ? 'Tu es au fonja !' : `${who} est au fonja !`;
    case 'free':
      if (e.how === 'doubles') return `Double : ${v('sors', 'sort')} du fonja !`;
      if (e.how === 'pass') return `${v('montres', 'montre')} un laissez-passer : libre !`;
      if (e.how === 'bail') return `${v('paies', 'paie')} la caution (${ar(e.amount)})`;
      return `Caution payée (${ar(e.amount)}) : ${v('reprends', 'reprend')} la route`;
    case 'stay':
      return `Pas de double : ${v('restes', 'reste')} au fonja`;
    case 'build':
      return e.level === 4 ? `Un hôtel s’élève à ${cellName(e.cell)} !` : `${v('construis', 'construit')} une maison à ${cellName(e.cell)}`;
    case 'sell':
      return `${v('revends', 'revend')} une maison à ${cellName(e.cell)}${e.forced ? ' pour payer' : ''} (+${ar(e.amount)})`;
    case 'mortgage':
      return `${v('hypothèques', 'hypothèque')} ${cellName(e.cell)}${e.forced ? ' pour payer' : ''} (+${ar(e.amount)})`;
    case 'redeem':
      return `${v('lèves', 'lève')} l’hypothèque de ${cellName(e.cell)}`;
    case 'offer':
      return `${v('proposes', 'propose')} ${ar(e.price)} à ${name(e.to)} pour ${cellName(e.cell)}`;
    case 'deal':
      return `${name(e.from)} vend ${cellName(e.cell)} à ${name(e.to)} pour ${ar(e.price)} !`;
    case 'refuse':
      return `${name(e.by)} refuse l’offre pour ${cellName(e.cell)}`;
    case 'cancel':
      return 'Offre retirée';
    case 'bankrupt':
      return mine ? 'Tu es ruiné !' : `${name(e.seat)} est ruiné !`;
    case 'pass':
      if (e.what === 'taxi') return `${v('restes', 'reste')} à la gare`;
      return mine ? 'Tu passes ton chemin' : `${who} passe son chemin`;
  }
}
