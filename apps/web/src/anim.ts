// Animations : données mutables lues image par image par la scène 3D,
// sans passer par React (pour rester fluide).

import type { GameEvent, GameState } from "@monopoly/engine";

export const DICE_DURATION = 0.9;
export const HOP_DURATION = 0.2;
export const GLIDE_DURATION = 0.7;

export interface Waypoint {
  pos: number;
  /** Saut d'une case (true) ou glissade directe (false). */
  hop: boolean;
  inJail: boolean;
}

export interface PawnAnim {
  queue: Waypoint[];
  /** Ne pas commencer avant cet instant (s, horloge performance). */
  startAt: number;
}

export const anim = {
  pawns: new Map<string, PawnAnim>(),
  dice: { a: 1, b: 1, rollId: 0, startedAt: -10 },
  /** Fin estimée de toutes les animations en cours. */
  busyUntil: 0,
};

export const nowSec = () => performance.now() / 1000;

/** Transforme les événements du moteur en animations. Renvoie l'heure de fin. */
export function playEvents(events: GameEvent[], state: GameState): number {
  const t0 = nowSec();
  let cursor = Math.max(t0, anim.busyUntil);
  const jailedAfter = new Map(state.players.map((p) => [p.id, p.inJail]));

  for (const e of events) {
    if (e.type === "diceRolled") {
      anim.dice = { a: e.dice.a, b: e.dice.b, rollId: anim.dice.rollId + 1, startedAt: cursor };
      cursor += DICE_DURATION;
    } else if (e.type === "moved") {
      const pa = anim.pawns.get(e.player) ?? { queue: [], startAt: 0 };
      if (pa.queue.length === 0) pa.startAt = cursor;
      const goingToJail = e.direct && e.to === 10 && e.steps === 0;
      if (!e.direct && Math.abs(e.steps) <= 12) {
        const dir = Math.sign(e.steps);
        for (let k = 1; k <= Math.abs(e.steps); k++) {
          pa.queue.push({ pos: (((e.from + dir * k) % 40) + 40) % 40, hop: true, inJail: false });
        }
        cursor += Math.abs(e.steps) * HOP_DURATION;
      } else {
        pa.queue.push({ pos: e.to, hop: false, inJail: goingToJail ? (jailedAfter.get(e.player) ?? true) : false });
        cursor += GLIDE_DURATION;
      }
      anim.pawns.set(e.player, pa);
    }
  }
  anim.busyUntil = cursor;
  return cursor;
}
