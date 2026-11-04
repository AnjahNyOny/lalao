import { gustAt, MOUNTAIN, PHYS, ropeFor, type TadyState } from '@game/games/tady';
import { stageOf } from './art';
import type { Shown } from './draw';

/** Hanging below a partner who grips, the rope taut. */
const hangs = (s: TadyState, c: Shown, under: Shown) =>
  under.grab && !c.ground && !c.grab && c.y > under.y + 0.3 && Math.hypot(c.x - under.x, c.y - under.y) >= ropeFor(s.rope, c.y, under.y) - 0.15;

const STAGE_TIPS = [
  'Trop haut pour un saut ? Monte sur la tête de ton partenaire.',
  'Une planche à mi-hauteur : la tête de ton partenaire, puis la corde.',
  'Agrippe-toi quand le vent se lève. La roche sableuse s’effrite : vite !',
  'La glace glisse, et on ne s’y agrippe pas : visez la roche et le bois.',
];

/** What to do now, for this climber. */
export function hintFor(s: TadyState, me: Shown, partner: Shown): string {
  if (s.won) return 'Le soleil se lève sur le Pic Boby : vous y êtes, ensemble !';
  if (hangs(s, partner, me)) return 'Tu retiens ton partenaire ! Pousse vers le haut pour le remonter.';
  if (hangs(s, me, partner)) return s.rope <= PHYS.ropeMin + 0.3 ? 'Presque ! Saute pour te hisser.' : 'Tu pends : pousse vers le haut pour grimper à la corde.';
  if (!partner.ground && !partner.grab && partner.vy > PHYS.jump * 0.6 && !me.grab) return 'Ton partenaire tombe : agrippe-toi !';
  if (!me.grab && (gustAt(s.time, me.y) || gustAt(s.time + 1000, me.y))) return 'Rafale ! Agrippe-toi à la roche.';
  // One up, one down: the one up grips, the one down climbs the rope.
  if (partner.y < me.y - 1.5) {
    return partner.grab ? 'On te tient : pousse vers le haut pour grimper à la corde.' : 'Quand ton partenaire s’agrippe là-haut, tu peux grimper à la corde.';
  }
  if (partner.y > me.y + 1.5) return me.grab ? 'Pousse vers le haut pour hisser ton partenaire.' : 'Ton partenaire est en bas : agrippe-toi pour l’aider à monter.';
  return STAGE_TIPS[stageOf(MOUNTAIN, Math.min(me.y, partner.y))];
}
