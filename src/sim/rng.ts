/** Seeded RNG whose state lives on the game state, so saves and tests replay exactly. */
export interface HasSeed {
  seed: number;
}

export function rand(s: HasSeed): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: HasSeed, lo: number, hi: number): number {
  return lo + Math.floor(rand(s) * (hi - lo + 1));
}

export function pick<T>(s: HasSeed, xs: readonly T[]): T {
  return xs[Math.floor(rand(s) * xs.length)];
}
