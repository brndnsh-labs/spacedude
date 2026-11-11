import { PixelBuf, bay, rng, tileFbm } from './pixels';

/**
 * The backdrop: a far nebula that hardly moves, and layers of stars that drift past it at different rates.
 * Every tile repeats seamlessly, is bigger than the frame, and is a different size from the others so their
 * repeats never line up. It is a backdrop: nothing here is as bright or as sharp as a ship or a station.
 */

export interface SkyTile {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** How much of the camera's movement the tile follows, in screen pixels. */
  parallax: number;
}

export interface Twinkle { x: number; y: number; phase: number; speed: number; glow: string }
export interface StarLayer extends SkyTile { twinkles: Twinkle[] }

const hex = (h: string) => parseInt(h.slice(1), 16);
const clamp = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const step = (a: number, b: number, t: number) => {
  const u = clamp((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/* ---------- repeating noise, quick enough for half a million pixels ---------- */

type Noise = (x: number, y: number) => number;

/** One octave of smooth noise on a lattice that wraps every (nx, ny) cells. */
function lattice(nx: number, ny: number, seed: number): Noise {
  const v = new Float32Array(nx * ny), r = rng(seed);
  for (let i = 0; i < v.length; i++) v[i] = r();
  return (x, y) => {
    const xf = Math.floor(x), yf = Math.floor(y), a = x - xf, b = y - yf;
    const u = a * a * (3 - 2 * a), w = b * b * (3 - 2 * b);
    let x0 = xf % nx, y0 = yf % ny;
    if (x0 < 0) x0 += nx;
    if (y0 < 0) y0 += ny;
    const x1 = x0 + 1 === nx ? 0 : x0 + 1, r0 = y0 * nx, r1 = (y0 + 1 === ny ? 0 : y0 + 1) * nx;
    const p = v[r0 + x0], q = v[r0 + x1], s = v[r1 + x0], t = v[r1 + x1];
    return p + (q - p) * u + (s - p) * w + (p - q - s + t) * u * w;
  };
}

/** Fractal noise over a lattice of (nx, ny) cells, each octave twice as fine: about 0 to 1. */
function fractal(nx: number, ny: number, seed: number, octaves: number): Noise {
  const layers = Array.from({ length: octaves }, (_, o) => lattice(nx << o, ny << o, seed + o * 31));
  const norm = 2 - 2 / (1 << octaves);
  return (x, y) => {
    let sum = 0, amp = 1, f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * layers[o](x * f, y * f);
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

/** Ridged fractal noise: bright threads where each octave crosses its middle. Filaments and dust lanes. */
function ridged(nx: number, ny: number, seed: number, octaves: number): Noise {
  const layers = Array.from({ length: octaves }, (_, o) => lattice(nx << o, ny << o, seed + o * 31));
  const norm = 2 - 2 / (1 << octaves);
  return (x, y) => {
    let sum = 0, amp = 1, f = 1;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(layers[o](x * f, y * f) * 2 - 1) * 1.8;
      if (n > 0) sum += amp * n * n;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

/* ---------- the nebula ---------- */

const NEB_W = 960, NEB_H = 640;
/** The whole sky leans this way: every row is slid along by this much, so the drifts run up to the right. */
const LEAN = NEB_H / NEB_W;

// Each ramp starts with two shades of dust (darker than open sky), then open sky, then the glow.
const VIOLET = ['#110e18', '#15121f', '#1a1423', '#1f1730', '#261b3a', '#2e2046', '#392a55', '#47376a'].map(hex);
const TEAL = ['#110e18', '#15121f', '#1a1423', '#19192c', '#192235', '#1b2e3f', '#1f3d49', '#285254'].map(hex);
const ROSE = ['#110e18', '#15121f', '#1a1423', '#211428', '#2c1730', '#3a1b38', '#4b2140', '#5e2c48'].map(hex);
const OPEN_SKY = 2 / 7;

/** A slowly varying field worked out on a coarse grid and read back smoothly: cheap to sample at every pixel. */
function coarse(fn: Noise): Noise {
  const G = 8, cw = NEB_W / G, ch = NEB_H / G, v = new Float32Array(cw * ch);
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) v[j * cw + i] = fn(i * G, j * G);
  return (x, y) => {
    const gx = x / G, gy = y / G, x0 = gx | 0, y0 = gy | 0, u = gx - x0, w = gy - y0;
    const x1 = x0 + 1 === cw ? 0 : x0 + 1, r0 = y0 * cw, r1 = (y0 + 1 === ch ? 0 : y0 + 1) * cw;
    const p = v[r0 + x0], q = v[r0 + x1], s = v[r1 + x0], t = v[r1 + x1];
    return p + (q - p) * u + (s - p) * w + (p - q - s + t) * u * w;
  };
}

function pick(ramp: readonly number[], t: number, x: number, y: number): number {
  const n = ramp.length - 1, f = clamp(t) * n, i = f | 0;
  if (i >= n) return ramp[n];
  return ramp[(f - i - 0.5) / 0.7 + 0.5 > bay(x, y) ? i + 1 : i];
}

/**
 * The far sky: a river of gas running up to the right, in violet with teal reaches and a little rose where it
 * is thickest, combed into filaments and cut by lanes of dark dust. A spiral galaxy and two star clusters sit
 * in it, placed where the core ports will show them.
 */
export function makeNebula(): SkyTile {
  const w = NEB_W, h = NEB_H, buf = new PixelBuf(w, h);
  // where the gas is, in long drifts; how thick its glow; which colour; and a push to bend the threads
  const drift = fractal(3, 4, 101, 3), glowN = fractal(6, 8, 202, 2), hueN = fractal(4, 3, 303, 2);
  const pushA = fractal(6, 4, 404, 2), pushB = fractal(6, 4, 505, 2);
  const gas = coarse((x, y) => drift(x / 320, (y + x * LEAN) / 160));
  const glow = coarse((x, y) => glowN(x / 160, (y + x * LEAN) / 80));
  const hue = coarse((x, y) => hueN(x / 240, y / 213.34));
  const bendX = coarse((x, y) => pushA(x / 160, y / 160) - 0.5), bendY = coarse((x, y) => pushB(x / 160, y / 160) - 0.5);
  const threads = ridged(8, 10, 606, 4), lanes = ridged(6, 8, 707, 3);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const g = gas(x, y), bx = bendX(x, y), by = bendY(x, y);
      const lean = y + x * LEAN;
      const cloud = step(0.44, 0.7, g);
      let e = 0;
      if (cloud > 0) {
        const th = threads((x + bx * 90) / 120, (lean + by * 90) / 64);
        e = cloud * (0.06 + glow(x, y) * 0.34 + step(0.1, 0.55, th) * 0.62);
      }
      // dust runs with the drift, through the gas and along its edges
      let dust = 0;
      if (g > 0.34) {
        const ln = lanes((x + by * 70) / 160, (lean + bx * 70) / 80);
        dust = step(0.3, 0.62, ln) * step(0.34, 0.5, g);
      }
      const t = OPEN_SKY + e * 0.62 * (1 - dust * 0.9) - dust * 0.2;
      const hv = hue(x, y) + (bay(x + 1, y + 2) - 0.5) * 0.05;
      const ramp = hv > 0.57 ? TEAL : hv < 0.41 && e > 0.3 ? ROSE : VIOLET;
      buf.putRgb(x, y, pick(ramp, t, x, y));
    }
  }

  paintGalaxy(buf, 346, 56);
  paintGlobular(buf, 18, 226);
  paintOpenCluster(buf, 700, 420);
  return { canvas: buf.toCanvas(), w, h, parallax: 0.06 };
}

const GALAXY = ['#2e2046', '#3d3058', '#544670', '#74668f', '#9d90b4', '#cfc4d8', '#f4ecea'].map(hex);

/** A spiral galaxy seen at a slant: two arms winding out of a bright core, a dust lane across the near side. */
function paintGalaxy(buf: PixelBuf, cx: number, cy: number): void {
  const tilt = -0.5, squash = 0.42, R = 24, cos = Math.cos(tilt), sin = Math.sin(tilt);
  for (let y = -R; y <= R; y++) {
    for (let x = -R - 4; x <= R + 4; x++) {
      const u = x * cos + y * sin, v = (-x * sin + y * cos) / squash, r = Math.hypot(u, v) / R;
      if (r > 1.05) continue;
      const th = Math.atan2(v, u);
      const arm = Math.cos(2 * (th - Math.log(r + 0.08) * 2.6)) * 0.5 + 0.5;
      let b = Math.exp(-r * 3.2) * 0.9 + arm * arm * (1 - r) * 0.5 * step(0.12, 0.3, r) + Math.exp(-((r / 0.13) ** 2)) * 0.6;
      // the dust lane: a dark chord just below the core
      const lane = Math.abs(v * squash - 2.2 - u * u * 0.004);
      if (lane < 1 && Math.abs(u) < R * 0.6) b *= 0.45;
      b *= step(1.05, 0.7, r);
      const f = clamp(b) * (GALAXY.length - 1), i = f | 0;
      if (f < 0.35 && f <= bay(x + cx, y + cy) * 0.9) continue; // the faint rim dithers into the sky
      buf.putRgb(cx + x, cy + y, GALAXY[Math.min(GALAXY.length - 1, f - i > bay(x + cx, y + cy) ? i + 1 : i)]);
    }
  }
}

/** A globular cluster: a round swarm of old warm stars, packed to a glow at the middle. */
function paintGlobular(buf: PixelBuf, cx: number, cy: number): void {
  const rnd = rng(77), haze = ['#2e2046', '#473a5c', '#7a6a80'].map(hex), cols = ['#5d5570', '#8a7f9a', '#c9b89a'].map(hex);
  for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
    const v = 1 - Math.hypot(x, y) / 8.5;
    if (v * v * 2.2 > bay(cx + x, cy + y)) buf.putRgb(cx + x, cy + y, haze[v > 0.74 ? 2 : v > 0.45 ? 1 : 0]);
  }
  // outliers thin out with distance
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, d = 4.5 + rnd() * rnd() * 7;
    buf.putRgb(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), cols[d < 7 ? 1 + (i & 1) : i % 3 ? 0 : 1]);
  }
  buf.putRgb(cx, cy, hex('#f2e2c0'));
  buf.putRgb(cx - 1, cy, cols[2]);
  buf.putRgb(cx, cy - 1, cols[2]);
}

/** A young open cluster: a handful of blue-white stars still wrapped in a wisp of their own gas. */
function paintOpenCluster(buf: PixelBuf, cx: number, cy: number): void {
  const wisp = [hex('#1f3d49'), hex('#285254')], dim = hex('#5f8fa8'), bright = hex('#cfe3f5');
  const stars: readonly (readonly [number, number, number])[] = [[0, 0, 1], [7, -4, 1], [-6, 3, 0], [11, 5, 0], [3, 8, 1], [-10, -5, 0], [-2, -9, 0], [15, -8, 0]];
  for (let y = -14; y <= 14; y++) for (let x = -20; x <= 22; x++) {
    let near = 9;
    for (const [sx, sy] of stars) near = Math.min(near, Math.hypot(x - sx, (y - sy) * 1.3));
    const v = (1 - near / 7) * 0.8;
    if (v > bay(cx + x, cy + y)) buf.putRgb(cx + x, cy + y, wisp[v > 0.55 ? 1 : 0]);
  }
  for (const [sx, sy, big] of stars) {
    buf.putRgb(cx + sx, cy + sy, bright);
    if (big) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) buf.putRgb(cx + sx + a, cy + sy + b, dim);
  }
}

/* ---------- stars ---------- */

/** A star's colours by temperature: its core, the shade beside it, and the faint end of a spike. */
const TEMPER: readonly (readonly [string, string, string])[] = [
  ['#cfe3f5', '#7f9cc0', '#46557a'], // blue-white
  ['#f2f0ea', '#9a98a8', '#544f68'], // white
  ['#fff3c4', '#c9a878', '#6a5350'], // yellow
  ['#f6c890', '#b5804f', '#5e4040'], // amber
  ['#f2a58a', '#a8584c', '#57293a'], // red
];

interface StarSpec {
  w: number; h: number; seed: number; parallax: number;
  /** How many stars, and how far apart they must keep. */
  count: number; gap: number;
  /** Colours for plain one-pixel stars. */
  plain: readonly string[];
  /** Out of the count: stars with a soft four-point glint, and bright ones with long spikes. */
  glints?: number; bright?: number;
  /** The share of plain stars that twinkle. */
  twinkle?: number;
}

function starLayer(s: StarSpec): StarLayer {
  const { w, h } = s, buf = new PixelBuf(w, h), rnd = rng(s.seed), twinkles: Twinkle[] = [];
  const taken: number[] = [];
  /** A free spot at least `gap` from every star so far (across the tile's seams too), or null. */
  const place = (gap: number, margin: number, drifts: boolean): [number, number] | null => {
    for (let tries = 0; tries < 60; tries++) {
      const x = margin + Math.floor(rnd() * (w - margin * 2)), y = margin + Math.floor(rnd() * (h - margin * 2));
      // stars gather in drifts and leave voids, so the field has a grain to it
      if (drifts && rnd() > 0.12 + Math.max(0, tileFbm(x / (w / 4), y / (h / 3), 4, 3, s.seed, 3) - 0.36) * 3.4) continue;
      let ok = true;
      for (let i = 0; i < taken.length && ok; i += 2) {
        const dx = Math.abs(taken[i] - x), dy = Math.abs(taken[i + 1] - y);
        if (Math.min(dx, w - dx) < gap && Math.min(dy, h - dy) < gap) ok = false;
      }
      if (!ok) continue;
      taken.push(x, y);
      return [x, y];
    }
    return null;
  };
  const temper = () => { const r = rnd(); return TEMPER[r < 0.28 ? 0 : r < 0.56 ? 1 : r < 0.76 ? 2 : r < 0.9 ? 3 : 4]; };

  // the bright few first, so they get the room they need
  for (let i = 0; i < (s.bright ?? 0); i++) {
    const at = place(46, 8, false);
    if (!at) break;
    const [x, y] = at, [core, mid, faint] = temper(), long = 3 + (i % 3 === 0 ? 2 : i % 2);
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 1; k <= long; k++) buf.put(x + a * k, y + b * k, k === 1 ? core : k <= (long + 1) >> 1 ? mid : faint);
    }
    for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) buf.put(x + a, y + b, mid);
    if (long > 3) for (const [a, b] of [[2, 1], [1, 2], [-2, 1], [-1, 2], [2, -1], [1, -2], [-2, -1], [-1, -2]]) if (bay(x + a, y + b) > 0.5) buf.put(x + a, y + b, faint);
    buf.put(x, y, '#ffffff');
  }
  for (let i = 0; i < (s.glints ?? 0); i++) {
    const at = place(Math.max(s.gap, 14), 3, false);
    if (!at) break;
    const [x, y] = at, [core, mid, faint] = temper();
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) buf.put(x + a, y + b, i % 3 ? faint : mid);
    buf.put(x, y, core);
  }
  const plain = s.count - (s.bright ?? 0) - (s.glints ?? 0);
  for (let i = 0; i < plain; i++) {
    const at = place(s.gap, 2, true);
    if (!at) continue;
    const [x, y] = at, c = s.plain[Math.floor(rnd() * s.plain.length)];
    buf.put(x, y, c);
    if (rnd() < (s.twinkle ?? 0)) twinkles.push({ x, y, phase: rnd() * 6.28, speed: 1.1 + rnd() * 2.1, glow: '#5d5570' });
  }
  return { canvas: buf.toCanvas(), w, h, parallax: s.parallax, twinkles };
}

export function makeStarLayers(): StarLayer[] {
  return [
    // the far field: dim, cool and plentiful, gathered into drifts
    starLayer({ w: 592, h: 400, seed: 11, parallax: 0.09, count: 300, gap: 4, plain: ['#3a2f45', '#4f4863', '#4f4863', '#5d5570', '#465a6a', '#54687a', '#6a5560'] }),
    // the middle field, in a spread of colour temperatures
    starLayer({
      w: 704, h: 464, seed: 23, parallax: 0.15, count: 130, gap: 9, glints: 14, twinkle: 0.3,
      plain: ['#8a8fa3', '#8a8fa3', '#9a98a8', '#a89a8f', '#9fb4cc', '#c9a27a', '#c08a7a', '#d8d4dc'],
    }),
    // the near few: bright neighbours with spikes of glare
    starLayer({
      w: 848, h: 544, seed: 37, parallax: 0.24, count: 44, gap: 22, glints: 12, bright: 7, twinkle: 0.5,
      plain: ['#f2f0ea', '#cfe3f5', '#fff3c4', '#f6c890', '#c3c6d4'],
    }),
  ];
}
