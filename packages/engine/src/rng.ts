/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Son état est stocké dans la partie : une partie sauvegardée reprend
 * exactement là où elle en était, et les tests sont reproductibles.
 */
export function nextRandom(holder: { rng: number }): number {
  let a = (holder.rng + 0x6d2b79f5) | 0;
  holder.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(holder: { rng: number }, min: number, max: number): number {
  return min + Math.floor(nextRandom(holder) * (max - min + 1));
}

export function shuffle<T>(holder: { rng: number }, items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(holder, 0, i);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
