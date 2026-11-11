import { PixelBuf, bay, rng, tileFbm } from './pixels';

/** The backdrop: a slow-drifting nebula and three parallax layers of stars. All tiles repeat seamlessly. */

export interface SkyTile {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  parallax: number;
}

export interface Twinkle { x: number; y: number; phase: number; speed: number; glow: string }
export interface StarLayer extends SkyTile { twinkles: Twinkle[] }

const SKY = ['#1a1423', '#1e1730', '#241a35', '#2b1f3b'];

/**
 * The far sky. It moves so slowly that over the whole system you only ever see
 * part of one tile, so the galaxy and cluster painted here stay in fixed places.
 */
export function makeNebula(): SkyTile {
  const w = 720, h = 360, cell = 120, buf = new PixelBuf(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / cell, v = y / cell, px = w / cell, py = h / cell;
      const plum = (tileFbm(u, v, px, py, 1) - 0.4) * 3.2;
      const f = Math.max(0, Math.min(0.999, plum)) * (SKY.length - 1);
      let c = SKY[Math.min(SKY.length - 1, f - Math.floor(f) > bay(x, y) ? Math.floor(f) + 1 : Math.floor(f))];
      const teal = tileFbm(u + 0.5, v + 0.5, px, py, 2);
      if (teal > 0.58 && (teal - 0.58) * 4.5 > bay(x + 2, y + 1)) c = teal > 0.7 ? '#1f2c3d' : '#1b2334';
      const warm = tileFbm(u * 2, v * 2, px * 2, py * 2, 3, 3);
      if (warm > 0.64 && (warm - 0.64) * 5 > bay(x + 1, y + 3)) c = '#321c2e';
      buf.put(x, y, c);
    }
  }

  // a far-off galaxy
  const gx = 30, gy = 120, ga = -0.5;
  for (let y = -12; y <= 12; y++) {
    for (let x = -18; x <= 18; x++) {
      const u = x * Math.cos(ga) + y * Math.sin(ga), v = -x * Math.sin(ga) + y * Math.cos(ga);
      const q = Math.hypot(u / 16, v / 5);
      if (q < 1 && (1 - q) ** 1.4 * 1.1 > bay(gx + x, gy + y)) buf.put(gx + x, gy + y, q < 0.22 ? '#a79fc4' : q < 0.55 ? '#6b5f8f' : '#3a2f55');
    }
  }
  buf.put(gx, gy, '#e4def2');

  // a loose star cluster
  const rnd = rng(77);
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * rnd() * 11;
    buf.put(320 + Math.cos(a) * d, 20 + Math.sin(a) * d, i % 3 ? '#8fa3a8' : '#cfe3f5');
  }
  return { canvas: buf.toCanvas(), w, h, parallax: 0.04 };
}

function starLayer(
  w: number, h: number, seed: number, count: number, colours: readonly string[], parallax: number,
  opts: { cross?: number; flare?: number; twinkle?: number } = {},
): StarLayer {
  const buf = new PixelBuf(w, h), rnd = rng(seed), twinkles: Twinkle[] = [];
  let placed = 0, tries = 0;
  while (placed < count && tries++ < count * 30) {
    const x = 3 + Math.floor(rnd() * (w - 6)), y = 3 + Math.floor(rnd() * (h - 6));
    // thin the stars out in patches so the field has drifts and voids
    const density = tileFbm(x / (w / 4), y / (h / 3), 4, 3, seed, 3);
    if (rnd() > 0.2 + Math.max(0, density - 0.38) * 3.2) continue;
    placed++;
    const c = colours[Math.floor(rnd() * colours.length)];
    buf.put(x, y, c);
    const roll = rnd();
    if (roll < (opts.flare ?? 0)) {
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        buf.put(x + a, y + b, c);
        buf.put(x + a * 2, y + b * 2, '#8a7f8f');
      }
    } else if (roll < (opts.cross ?? 0)) {
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) buf.put(x + a, y + b, '#8a7f8f');
    } else if (rnd() < (opts.twinkle ?? 0)) {
      twinkles.push({ x, y, phase: rnd() * 6.28, speed: 1.2 + rnd() * 2.2, glow: '#8a7f8f' });
    }
  }
  return { canvas: buf.toCanvas(), w, h, parallax, twinkles };
}

export function makeStarLayers(): StarLayer[] {
  return [
    // distant dust: dim, cool, plentiful
    starLayer(400, 240, 11, 190, ['#4f4863', '#5d5570', '#6a5f78', '#4c6470', '#56707a'], 0.08),
    // the main field, in a spread of colour temperatures
    starLayer(480, 270, 23, 95, ['#8fa3a8', '#8fa3a8', '#a89a8f', '#bcd0e6', '#c9a27a', '#d98f7a', '#f2e9dc'], 0.16, { twinkle: 0.25 }),
    // a few bright neighbours
    starLayer(560, 320, 37, 26, ['#f2e9dc', '#fff6e0', '#cfe3f5', '#f6d28a', '#f2b08a'], 0.3, { flare: 0.12, cross: 0.5, twinkle: 0.6 }),
  ];
}
