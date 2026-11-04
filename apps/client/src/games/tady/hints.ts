import { gustAt, MOUNTAIN, PHYS, stageAt, type TadyState } from '@game/games/tady';
import type { Shown } from './draw';

const STAGE_TIPS = [
  'Trop haut pour un saut ? Monte sur la tête de ton partenaire.',
  'Une planche à mi-hauteur : la tête de ton partenaire, puis la corde.',
  'Plus de planche : l’un tient la paroi, l’autre grimpe au-dessus, et on échange. Gare au vent !',
  'Les blocs suspendus : la tête, puis la corde, et vite, le froid use les forces. On ne tient pas sur la glace.',
];

/** What to do now, for this climber. */
export function hintFor(s: TadyState, me: Shown, partner: Shown): string {
  if (s.won) return 'Le soleil se lève sur le Pic Boby : vous y êtes, ensemble !';
  if (me.tired) return 'À bout de forces : pose les pieds quelque part pour récupérer.';
  if (me.grab && me.stamina < 0.3) return partner.hanging ? 'Tes forces lâchent : qu’il grimpe, vite !' : 'Tes forces lâchent : trouve où poser les pieds.';
  if (me.hanging && partner.stamina < 0.3) return 'Ton partenaire faiblit : grimpe, vite !';
  if (me.dragged) return 'Il t’entraîne dans sa chute : agrippe-toi !';
  if (partner.hanging && me.grab) return 'Tu retiens ton partenaire ! Pousse vers le haut pour le remonter.';
  if (me.hanging && !partner.grab) return 'Personne ne tient la corde : vous tombez !';
  if (me.hanging) return s.rope <= PHYS.ropeMin + 0.3 ? 'Encore vers le haut : tu te hisses !' : 'Tu pends : vers le haut pour grimper à la corde, gauche et droite pour te balancer.';
  if (!partner.ground && !partner.grab && !partner.hanging && partner.vy > PHYS.jump * 0.6 && !me.grab) return 'Ton partenaire tombe : agrippe-toi !';
  if (!me.grab && (gustAt(s.time, me.y) || gustAt(s.time + 1000, me.y))) return 'Rafale ! Agrippe-toi à la roche.';
  // One up, one down: the one up grips, the one down climbs the rope.
  if (partner.y < me.y - 1.5) {
    return partner.grab ? 'On te tient : pousse vers le haut pour grimper à la corde.' : 'Quand ton partenaire s’agrippe là-haut, tu peux grimper à la corde.';
  }
  if (partner.y > me.y + 1.5) return me.grab ? 'Pousse vers le haut pour hisser ton partenaire.' : 'Ton partenaire est en bas : agrippe-toi pour l’aider à monter.';
  return STAGE_TIPS[stageAt(MOUNTAIN, Math.min(me.y, partner.y))];
}
