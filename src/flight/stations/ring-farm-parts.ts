import { LIGHT, shade } from '../pixels';
import type { Art } from './kit';

/**
 * Building blocks shared by the ring and the farm dock: tubes, lattice girders, plated boxes, glazing, and a
 * way to lay one part over another so it casts a shadow. Everything is lit from the upper right.
 */

export type Ramp = readonly string[];

/** The sun's direction across the picture plane (x right, y down), unit length. */
export const SUN: readonly [number, number] = (() => {
  const n = Math.hypot(LIGHT[0], LIGHT[1]);
  return [LIGHT[0] / n, LIGHT[1] / n] as const;
})();

/** The dark seen through a lattice or down a hatch. */
export const VOID = '#1d1730';

/** A fixed scatter in [0, 1) for a pixel or a part number: grime, lit windows, odd plates. Never Math.random. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const hexOf = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const rgbOf = (hex: string) => parseInt(hex.slice(1), 16);

/** A colour part of the way from one to another. */
export function mix(a: string, b: string, t: number): string {
  const p = rgbOf(a), q = rgbOf(b);
  const ch = (s: number) => Math.round(((p >> s) & 255) + ((((q >> s) & 255) - ((p >> s) & 255)) * t));
  return hexOf((ch(16) << 16) | (ch(8) << 8) | ch(0));
}

/** A colour in shadow: darker, and leaning violet like the palette's own shadows. */
function inShadow(n: number): number {
  const r = Math.round((n >> 16) * 0.56 + 4), g = Math.round(((n >> 8) & 255) * 0.52 + 2), b = Math.round((n & 255) * 0.66 + 10);
  return (r << 16) | (g << 8) | b;
}

/** Darken what is already drawn at a pixel, as if something stood over it. */
export function dim(a: Art, x: number, y: number): void {
  const c = a.buf.get(a.half + x, a.half + y);
  if (c >= 0) a.buf.putRgb(a.half + x, a.half + y, inShadow(c));
}

/** Lighten what is already drawn at a pixel toward a colour: glass, a glint, a wash of grime. */
export function wash(a: Art, x: number, y: number, colour: string, amount: number): void {
  const c = a.buf.get(a.half + x, a.half + y);
  if (c >= 0) a.put(x, y, mix(hexOf(c), colour, amount));
}

/**
 * Lay one drawing over another. The upper part throws a short shadow down and to the left onto whatever is
 * already there, which is what makes it read as passing over rather than butting against.
 */
export function stamp(base: Art, top: Art, depth = 2): void {
  const b = base.buf, t = top.buf, w = b.w, h = b.h;
  const done = new Uint8Array(w * h);
  for (let k = 1; k <= depth; k++) {
    for (let y = 0; y < h - k; y++) {
      for (let x = k; x < w; x++) {
        if (t.get(x, y) < 0) continue;
        const sx = x - k, sy = y + k, i = sy * w + sx;
        if (done[i] || t.get(sx, sy) >= 0) continue;
        const c = b.get(sx, sy);
        if (c < 0) continue;
        done[i] = 1;
        b.putRgb(sx, sy, inShadow(c));
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = t.get(x, y);
      if (c >= 0) b.putRgb(x, y, c);
    }
  }
}

/** Where across a round tube a row or column sits, as a place on its ramp. `u` runs 0 at the lit side to 1. */
function round(u: number, sun: number): number {
  const n = u * 2 - 1, nz = Math.sqrt(Math.max(0, 1 - n * n));
  return clamp01((-n * sun + nz * LIGHT[2] + 0.42) / 1.3);
}

/** A tube lying along x, lit along its upper side. `ribs` is the spacing of its joint rings, 0 for none. */
export function hTube(a: Art, x: number, y: number, w: number, h: number, ramp: Ramp, ribs = 0, ribAt = 0): void {
  for (let j = 0; j < h; j++) {
    let t = round((j + 0.5) / h, -LIGHT[1]);
    if (j === 0 && h > 3) t -= 0.14;
    const k = Math.round(t * (ramp.length - 1));
    for (let i = 0; i < w; i++) {
      const rib = ribs > 0 && (i + ribAt) % ribs === 0, after = ribs > 0 && (i + ribAt) % ribs === 1;
      a.put(x + i, y + j, ramp[Math.max(0, Math.min(ramp.length - 1, rib ? k - 2 : after ? k + 1 : k))]);
    }
  }
}

/** A tube standing along y, lit down its right side. */
export function vTube(a: Art, x: number, y: number, w: number, h: number, ramp: Ramp, ribs = 0, ribAt = 0): void {
  for (let i = 0; i < w; i++) {
    let t = round(1 - (i + 0.5) / w, LIGHT[0]);
    if (i === w - 1 && w > 3) t -= 0.14;
    const k = Math.round(t * (ramp.length - 1));
    for (let j = 0; j < h; j++) {
      const rib = ribs > 0 && (j + ribAt) % ribs === 0, after = ribs > 0 && (j + ribAt) % ribs === 1;
      a.put(x + i, y + j, ramp[Math.max(0, Math.min(ramp.length - 1, rib ? k - 2 : after ? k - 1 : k))]);
    }
  }
}

/**
 * A lattice girder lying along x: a lit top chord, a shaded bottom chord, posts, and zigzag bracing over the dark.
 * `cols` = shadow, mid, light.
 */
export function hTruss(a: Art, x: number, y: number, w: number, h: number, cols: Ramp, lean = 0): void {
  const inner = h - 2, span = Math.max(1, inner - 1) * 2;
  a.rect(x, y + 1, w, inner, VOID);
  for (let i = 0; i < w; i++) {
    const p = (i + lean) % span, row = p < inner ? p : span - p;
    a.put(x + i, y + 1 + Math.min(inner - 1, row), cols[1]);
    if ((i + lean) % span === 0) a.rect(x + i, y + 1, 1, inner, cols[0]);
  }
  a.rect(x, y, w, 1, cols[2]);
  a.rect(x, y + h - 1, w, 1, cols[0]);
}

/** A lattice girder standing along y: lit down its right chord. */
export function vTruss(a: Art, x: number, y: number, w: number, h: number, cols: Ramp, lean = 0): void {
  const inner = w - 2, span = Math.max(1, inner - 1) * 2;
  a.rect(x + 1, y, inner, h, VOID);
  for (let j = 0; j < h; j++) {
    const p = (j + lean) % span, col = p < inner ? p : span - p;
    a.put(x + 1 + Math.min(inner - 1, col), y + j, cols[1]);
    if ((j + lean) % span === 0) a.rect(x + 1, y + j, inner, 1, cols[0]);
  }
  a.rect(x, y, 1, h, cols[0]);
  a.rect(x + w - 1, y, 1, h, cols[2]);
}

/**
 * A flat-topped box seen from above: a lit top and right edge, a shaded bottom and left, and a face between.
 * `ramp` runs dark to light and needs at least four shades.
 */
export function plate(a: Art, x: number, y: number, w: number, h: number, ramp: Ramp, face = ramp.length - 2): void {
  const hi = ramp[Math.min(ramp.length - 1, face + 1)], lo = ramp[Math.max(0, face - 2)], mid = ramp[Math.max(0, face - 1)];
  a.rect(x, y, w, h, ramp[face]);
  a.rect(x, y + h - 1, w, 1, lo);
  a.rect(x, y, 1, h, mid);
  a.rect(x, y, w, 1, hi);
  a.rect(x + w - 1, y, 1, h - 1, hi);
  a.put(x, y + h - 1, lo);
}

/** A shipping container or crate lying along x: ribbed sides, a lit top edge, a door end. */
export function container(a: Art, x: number, y: number, w: number, h: number, ramp: Ramp): void {
  const [d, m, l, hl] = [ramp[0], ramp[1], ramp[2], ramp[3] ?? ramp[2]];
  a.rect(x, y, w, h, m);
  for (let i = 2; i < w - 2; i += 2) a.rect(x + i, y + 1, 1, h - 2, l);
  a.rect(x, y, w, 1, hl);
  a.rect(x, y + h - 1, w, 1, d);
  a.rect(x, y + 1, 1, h - 1, d);
  a.rect(x + w - 1, y, 1, h - 1, hl);
  a.put(x + w - 2, y + (h >> 1), d); // door latch
}

/**
 * A solar array: a framed grid of cells with a streak of reflected sun lying diagonally across it. The streak is
 * placed by position on the canvas, so the panels of one wing share it. `blue` runs dark to light;
 * `frame` = shadow, light.
 */
export function solar(a: Art, x: number, y: number, w: number, h: number, blue: Ramp, frame: readonly [string, string], cw = 5, ch = 4, seed = 0): void {
  a.rect(x, y, w, h, blue[0]);
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const u = (i - 1) % (cw + 1), v = (j - 1) % (ch + 1);
      if (u === cw || v === ch) continue; // the gap between cells
      const ci = Math.floor((i - 1) / (cw + 1)), cj = Math.floor((j - 1) / (ch + 1));
      if (hash2(ci + x, cj + y, seed) < 0.04) { a.put(x + i, y + j, blue[1]); continue; } // a dead cell
      const across = ((x + i) * 0.62 - (y + j)) / 34 + seed * 0.21;
      const streak = Math.max(0, Math.cos((across - Math.floor(across) - 0.5) * Math.PI * 2));
      let t = 0.2 + streak ** 3 * 0.75 + (hash2(ci + x, cj + y, seed + 9) - 0.5) * 0.07;
      if (v === 0) t += 0.1; // each cell's top edge catches the light
      a.put(x + i, y + j, shade(blue.slice(1), t, a.half + x + i, a.half + y + j, 0.25));
    }
  }
  a.rect(x, y, w, 1, frame[1]);
  a.rect(x + w - 1, y, 1, h, frame[1]);
  a.rect(x, y + h - 1, w - 1, 1, frame[0]);
  a.rect(x, y + 1, 1, h - 1, frame[0]);
}

/** Paint a small hand-drawn sprite from rows of characters. `turn` is quarter turns clockwise. */
export function sprite(a: Art, x: number, y: number, rows: readonly string[], key: Readonly<Record<string, string>>, turn = 0): void {
  const h = rows.length, w = rows[0].length;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = key[rows[j][i]];
      if (!c) continue;
      const [dx, dy] = turn === 0 ? [i, j] : turn === 1 ? [h - 1 - j, i] : turn === 2 ? [w - 1 - i, h - 1 - j] : [j, w - 1 - i];
      a.put(x + dx, y + dy, c);
    }
  }
}

/** A filled circle shaded as a ball, with flat bands and a little dither where they meet. */
export function ball(a: Art, cx: number, cy: number, r: number, ramp: Ramp, soft = 0.35): void {
  a.disc(cx, cy, r, (dx, dy, d, x, y) => {
    const q = r + 0.5, nz = Math.sqrt(Math.max(0, 1 - (d / q) ** 2));
    const l = (dx / q) * LIGHT[0] + (dy / q) * LIGHT[1] + nz * LIGHT[2];
    return shade(ramp, 0.16 + l * 0.86, x, y, soft);
  });
}
