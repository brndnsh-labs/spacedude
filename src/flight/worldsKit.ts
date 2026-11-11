import { LIGHT, PixelBuf, bay, rng } from './pixels';

/**
 * What the worlds share: colour ramps as numbers, quick gradient noise, and a painter for a lit globe with
 * relief, cloud, cloud shadow and air at the limb. Worlds are big, so nothing here builds strings or objects
 * per pixel.
 */

/** A colour ramp, dark to light, as 0xRRGGBB. */
export type Ramp = readonly number[];
export const ramp = (...hex: string[]): Ramp => hex.map(h => parseInt(h.slice(1), 16));

export const clamp = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
/** 0 below a, 1 above b, eased between. */
export const step = (a: number, b: number, t: number) => {
  const u = clamp((t - a) / (b - a));
  return u * u * (3 - 2 * u);
};

/** Pick from a ramp, dithering between neighbouring steps; `soft` is how much of each step is dithered. */
export function pick(r: Ramp, t: number, x: number, y: number, soft: number): number {
  const n = r.length - 1, f = clamp(t) * n, i = f | 0;
  if (i >= n) return r[n];
  return r[(f - i - 0.5) / soft + 0.5 > bay(x, y) ? i + 1 : i];
}

/* ---------- noise ---------- */

const PERM = new Uint8Array(512);
{
  const r = rng(90210), p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1)), t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

function grad(h: number, x: number, y: number, z: number): number {
  h &= 15;
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
}

/** Gradient noise, roughly -1 to 1. */
export function gnoise(x: number, y: number, z: number): number {
  const xf = Math.floor(x), yf = Math.floor(y), zf = Math.floor(z);
  const X = xf & 255, Y = yf & 255, Z = zf & 255;
  x -= xf; y -= yf; z -= zf;
  const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
  const A = PERM[X] + Y, B = PERM[X + 1] + Y;
  const AA = PERM[A] + Z, AB = PERM[A + 1] + Z, BA = PERM[B] + Z, BB = PERM[B + 1] + Z;
  const x1 = x - 1, y1 = y - 1, z1 = z - 1;
  const a = grad(PERM[AA], x, y, z), b = grad(PERM[BA], x1, y, z);
  const c = grad(PERM[AB], x, y1, z), d = grad(PERM[BB], x1, y1, z);
  const e = grad(PERM[AA + 1], x, y, z1), f = grad(PERM[BA + 1], x1, y, z1);
  const g = grad(PERM[AB + 1], x, y1, z1), h = grad(PERM[BB + 1], x1, y1, z1);
  const ab = a + u * (b - a), cd = c + u * (d - c), ef = e + u * (f - e), gh = g + u * (h - g);
  const lo = ab + v * (cd - ab), hi = ef + v * (gh - ef);
  return lo + w * (hi - lo);
}

/** Fractal noise, about 0 to 1 and centred on 0.5. */
export function fbm(x: number, y: number, z: number, octaves: number): number {
  let amp = 0.5, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * gnoise(x, y, z);
    norm += amp;
    amp *= 0.5;
    x = x * 2 + 13.7; y = y * 2 + 5.3; z = z * 2 + 9.1;
  }
  return 0.5 + (sum / norm) * 0.85;
}

/** Ridged fractal noise, 0 to 1: sharp crests where the noise crosses zero. Mountain chains, filaments. */
export function ridge(x: number, y: number, z: number, octaves: number): number {
  let amp = 0.5, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(gnoise(x, y, z)) * 1.6;
    sum += amp * (n < 0 ? 0 : n * n);
    norm += amp;
    amp *= 0.5;
    x = x * 2 + 13.7; y = y * 2 + 5.3; z = z * 2 + 9.1;
  }
  return sum / norm;
}

/** A small repeatable hash of two whole numbers, 0 to 1. */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ---------- globes ---------- */

export type Vec = readonly [number, number, number];
export const norm = (v: Vec): Vec => {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
};
export const dot = (p: Vec, q: Vec) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];

/** Rows of a rotation from screen axes to a planet's own: its x (east), y (south pole), z. */
export type Frame = readonly [Vec, Vec, Vec];

/**
 * A planet's frame from how it sits on screen: `roll` turns its axis clockwise on screen, `nod` tips its north
 * pole toward the viewer, so the bands curve and the globe reads as round.
 */
export function frame(roll: number, nod: number): Frame {
  const c = Math.cos(roll), s = Math.sin(roll), cn = Math.cos(nod), sn = Math.sin(nod);
  // screen -> undo roll about z -> undo nod about x
  return [
    [c, s, 0],
    [-s * cn, c * cn, -sn],
    [-s * sn, c * sn, cn],
  ];
}

/** The planet-frame direction of a point given in screen axes. */
export const toFrame = (f: Frame, n: Vec): Vec => [dot(f[0], n), dot(f[1], n), dot(f[2], n)];

/** What a world says about one point of its surface. The painter resets these before each call. */
export interface Sample {
  /** Which ramp. */
  mat: number;
  /** Albedo: 1 is the ramp as written; lower is darker ground. */
  tone: number;
  /** Relief, in pixels of height: its slope lights and shades the ground. */
  h: number;
  /** Cloud cover: 0 none, 1 thick. Thin cloud is dithered so the ground shows through. */
  cloud: number;
  /** How glossy: water takes a sun glint. */
  gloss: number;
  /** Extra shadow, 0 to 1 (a ring's shadow, say). */
  shadow: number;
}

export interface GlobeSpec {
  r: number;
  frame: Frame;
  ramps: readonly Ramp[];
  /** Describe the surface at planet-frame point (px, py, pz); (nx, ny, nz) is the same point in screen axes. */
  sample: (s: Sample, px: number, py: number, pz: number, nx: number, ny: number, nz: number) => void;
  /** How much of each ramp step is dithered. */
  soft?: number;
  /** Light on the night side, so it is never black. */
  ambient?: number;
  /** How strongly relief is lit. */
  bump?: number;
  /** Overall brightness of the day side; below 1 keeps the palest shades for highlights. */
  gain?: number;
  cloud?: { ramp: Ramp; shadow: number; reach: number };
  /** Air: colours for the glow inside the sunlit limb (bright, then dim) and the haze outside it (near, then far). */
  air?: { rim: readonly number[]; haze: readonly number[]; reach: number; strength: number };
  /** A thin line of back-light along the night limb. */
  nightRim?: number;
}

const L2 = Math.hypot(LIGHT[0], LIGHT[1]);
/** Halfway between the sun and the eye: where a glossy sea glints. */
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

export function paintGlobe(buf: PixelBuf, cx: number, cy: number, g: GlobeSpec): void {
  const r = g.r, R = Math.ceil(r) + 1, S = R * 2 + 1;
  const x0 = Math.floor(cx) - R, y0 = Math.floor(cy) - R;
  const inside = new Uint8Array(S * S), mat = new Uint8Array(S * S);
  const tone = new Float32Array(S * S), hgt = new Float32Array(S * S), cloud = new Float32Array(S * S);
  const gloss = new Float32Array(S * S), shadow = new Float32Array(S * S);
  const f = g.frame, s: Sample = { mat: 0, tone: 1, h: 0, cloud: 0, gloss: 0, shadow: 0 };

  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const dx = x0 + i + 0.5 - cx, dy = y0 + j + 0.5 - cy, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      const nx = dx / r, ny = dy / r, nz = Math.sqrt(1 - nx * nx - ny * ny);
      s.mat = 0; s.tone = 1; s.h = 0; s.cloud = 0; s.gloss = 0; s.shadow = 0;
      g.sample(
        s,
        f[0][0] * nx + f[0][1] * ny + f[0][2] * nz,
        f[1][0] * nx + f[1][1] * ny + f[1][2] * nz,
        f[2][0] * nx + f[2][1] * ny + f[2][2] * nz,
        nx, ny, nz,
      );
      const k = j * S + i;
      inside[k] = 1; mat[k] = s.mat; tone[k] = s.tone; hgt[k] = s.h; cloud[k] = s.cloud; gloss[k] = s.gloss; shadow[k] = s.shadow;
    }
  }

  const soft = g.soft ?? 0.6, amb = g.ambient ?? 0.08, bump = g.bump ?? 0, gain = g.gain ?? 1;
  const cl = g.cloud, reach = cl ? cl.reach : 0;
  // a cloud's shadow falls away from the sun: look toward the sun for the cloud that casts it
  const sx = Math.round((LIGHT[0] / L2) * reach), sy = Math.round((LIGHT[1] / L2) * reach);
  const slope = (a: Float32Array, k: number, i: number, j: number): number => {
    const e = i + 1 < S && inside[k + 1] ? a[k + 1] : a[k], w = i > 0 && inside[k - 1] ? a[k - 1] : a[k];
    const so = j + 1 < S && inside[k + S] ? a[k + S] : a[k], n = j > 0 && inside[k - S] ? a[k - S] : a[k];
    return -((e - w) * LIGHT[0] + (so - n) * LIGHT[1]) * 0.5;
  };

  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const k = j * S + i, x = x0 + i, y = y0 + j;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (!inside[k]) {
        const air = g.air;
        if (!air || buf.get(x, y) >= 0) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + air.reach) continue;
        const a = 1 - (d - r) / air.reach, lit = clamp(((dx * LIGHT[0] + dy * LIGHT[1]) / d) * 1.1 + 0.42);
        const v = a * a * lit * air.strength;
        if (v > bay(x, y)) buf.putRgb(x, y, air.haze[v > 0.62 ? 0 : 1]);
        continue;
      }
      const nx = dx / r, ny = dy / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      const day = clamp(l * 3 + 0.35), flat = 0.35 + 0.65 * nz;

      // cloud first: thin cloud is see-through
      const c = cloud[k];
      if (cl && c > 0 && c * 1.6 > bay(x + 1, y + 2)) {
        const lb = l + slope(cloud, k, i, j) * 2.2 * day * flat;
        const t = amb * 0.5 + (1 - amb) * Math.pow(clamp(lb * 1.05 + 0.1), 0.8) * (0.8 + 0.2 * nz) * (0.8 + 0.2 * clamp(c));
        buf.putRgb(x, y, pick(cl.ramp, t, x, y, soft));
        continue;
      }

      let lb = l;
      if (bump) lb += slope(hgt, k, i, j) * bump * day * flat;
      let alb = tone[k] * (1 - shadow[k]);
      if (cl) {
        const ii = i + sx, jj = j + sy;
        if (ii >= 0 && jj >= 0 && ii < S && jj < S) alb *= 1 - cl.shadow * clamp(cloud[jj * S + ii] * 2);
      }
      // the night side keeps a ghost of the ground, but only a ghost
      let t = amb * (0.6 + 0.4 * alb) + (1 - amb) * Math.pow(clamp(lb * 1.05 + 0.1), 0.85) * (0.8 + 0.2 * nz) * alb * gain;
      if (gloss[k]) {
        const h = nx * HALF[0] + ny * HALF[1] + nz * HALF[2];
        t += gloss[k] * Math.pow(clamp(h), 40) * alb;
      }

      const air = g.air;
      if (air) {
        const a = clamp((0.42 - nz) / 0.42), v = a * a * clamp(l * 2.2 + 0.15) * air.strength * 1.25;
        if (v > bay(x, y)) {
          buf.putRgb(x, y, air.rim[v > 0.7 ? 0 : 1]);
          continue;
        }
      }
      if (g.nightRim !== undefined && l < 0 && nz < 0.16 && (0.16 - nz) * 9 * clamp(-l * 3) > bay(x, y)) {
        buf.putRgb(x, y, g.nightRim);
        continue;
      }
      buf.putRgb(x, y, pick(g.ramps[mat[k]], t, x, y, soft));
    }
  }
}
