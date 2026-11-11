import { LIGHT, fbm3, rng, shade } from '../pixels';
import { Art } from './kit';

/**
 * Building blocks shared by the mining rig and the relay beacon: solids shaded for a sun at the upper right,
 * and a way to stack one part over another so the upper one drops a shadow on the lower.
 *
 * Every ramp here is five shades, dark to light: deep shadow, shade, body, lit, highlight.
 */
export type Ramp = readonly string[];

/** Five neighbouring steps of a palette ramp, starting at `from`. */
export const ramp5 = (pal: readonly string[], from: number): Ramp => pal.slice(from, from + 5);

/* ---------- layers and shadows ---------- */

/** An Art that remembers the box it has been drawn in, so stacking it does not scan the whole canvas. */
class Layer extends Art {
  x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
  touch(x: number, y: number): void {
    if (x < this.x0) this.x0 = x;
    if (y < this.y0) this.y0 = y;
    if (x > this.x1) this.x1 = x;
    if (y > this.y1) this.y1 = y;
  }
  override put(x: number, y: number, c: string): void { this.touch(x, y); super.put(x, y, c); }
  override rect(x: number, y: number, w: number, h: number, c: string): void { this.touch(x, y); this.touch(x + w, y + h); super.rect(x, y, w, h, c); }
  override line(x0: number, y0: number, x1: number, y1: number, c: string): void { this.touch(x0, y0); this.touch(x1, y1); super.line(x0, y0, x1, y1, c); }
}

const mixRgb = (n: number, to: number, k: number): number => {
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - k) + ((to >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const dimmed = new Map<number, number>();
/** A colour in shadow: pulled toward the deep violet of the sky. */
function dim(n: number): number {
  let out = dimmed.get(n);
  if (out === undefined) dimmed.set(n, (out = mixRgb(n, 0x171226, 0.46)));
  return out;
}

/** Which pixels of an Art are already in shadow, so two parts overhead do not darken a spot twice. */
const inShadow = new WeakMap<Art, Uint8Array>();

/**
 * Draw a part that sits `lift` pixels above what is already there: its shadow falls down and to the left
 * on whatever is beneath it (never on empty space), then the part itself goes on top.
 */
export function over(a: Art, lift: number, draw: (b: Art) => void): void {
  const b = new Layer(a.half);
  draw(b);
  if (b.x1 < b.x0) return;
  const n = a.half * 2;
  let mask = inShadow.get(a);
  if (!mask) inShadow.set(a, (mask = new Uint8Array(n * n)));
  const X0 = Math.max(0, Math.floor(b.x0) + a.half - 1), X1 = Math.min(n - 1, Math.ceil(b.x1) + a.half + 1);
  const Y0 = Math.max(0, Math.floor(b.y0) + a.half - 1), Y1 = Math.min(n - 1, Math.ceil(b.y1) + a.half + 1);
  if (a instanceof Layer) {
    a.touch(X0 - a.half - lift, Y0 - a.half);
    a.touch(X1 - a.half, Y1 - a.half + lift);
  }
  if (lift > 0) {
    for (let y = Y0; y <= Y1; y++) {
      for (let x = X0; x <= X1; x++) {
        if (b.buf.get(x, y) < 0) continue;
        const sx = x - lift, sy = y + lift;
        if (b.buf.get(sx, sy) >= 0) continue;
        const under = a.buf.get(sx, sy);
        if (under < 0 || mask[sy * n + sx]) continue;
        a.buf.putRgb(sx, sy, dim(under));
        mask[sy * n + sx] = 1;
      }
    }
  }
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const c = b.buf.get(x, y);
      if (c < 0) continue;
      a.buf.putRgb(x, y, c);
      mask[y * n + x] = 0;
    }
  }
}

/** Darken what is already drawn inside a rectangle (a recess, the lee of a wall). */
export function shadowRect(a: Art, x: number, y: number, w: number, h: number): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c = a.buf.get(a.half + x + i, a.half + y + j);
      if (c >= 0) a.buf.putRgb(a.half + x + i, a.half + y + j, dim(c));
    }
  }
}

/* ---------- solids ---------- */

export interface PlateLook {
  /** Seed for scuffs and stains; leave out for clean plate. */
  grime?: number;
  /** x offsets of vertical seams, y offsets of horizontal ones. */
  seamsX?: readonly number[];
  seamsY?: readonly number[];
  /** A rivet in each corner. */
  rivets?: boolean;
}

/** A raised plate: lit along the top and right, shaded along the bottom and left, with seams and wear. */
export function plate(a: Art, x: number, y: number, w: number, h: number, r: Ramp, look: PlateLook = {}): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let c = r[2];
      if (look.grime !== undefined) {
        // stains are soft blotches, wear is a lighter scuff: both in neighbouring shades, never speckle
        const g = fbm3((x + i) * 0.13, (y + j) * 0.13, look.grime, 2);
        if (g > 0.6) c = r[1];
        else if (g < 0.34) c = r[3];
      }
      a.put(x + i, y + j, c);
    }
  }
  for (const sx of look.seamsX ?? []) {
    a.rect(x + sx, y + 1, 1, h - 2, r[1]);
    a.rect(x + sx - 1, y + 1, 1, h - 2, r[3]);
  }
  for (const sy of look.seamsY ?? []) {
    a.rect(x + 1, y + sy, w - 2, 1, r[1]);
    a.rect(x + 1, y + sy + 1, w - 2, 1, r[3]);
  }
  a.rect(x, y, w, 1, r[3]);
  a.rect(x + w - 1, y, 1, h, r[3]);
  a.rect(x, y + h - 1, w - 1, 1, r[1]);
  a.rect(x, y + 1, 1, h - 1, r[1]);
  a.put(x + w - 1, y, r[4]);
  a.put(x, y + h - 1, r[0]);
  if (look.rivets && w > 6 && h > 6) {
    for (const [i, j] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) a.put(x + i, y + j, r[0]);
  }
}

/** Ramp step for a point `t` of the way across a tube (0 at the lit side, 1 at the far side). */
function tubeStep(t: number): number {
  const l = 1 - Math.abs(t - 0.3) * 1.9;
  return Math.max(0, Math.min(4, Math.round(1 + l * 3)));
}

/** A tank or pipe lying left to right, lit along its upper flank. `round` trims the corners into end caps. */
export function hcyl(a: Art, x: number, y: number, w: number, h: number, r: Ramp, round = 0): void {
  for (let j = 0; j < h; j++) {
    const inset = Math.max(0, round - Math.min(j, h - 1 - j));
    a.rect(x + inset, y + j, w - inset * 2, 1, r[tubeStep((j + 0.5) / h)]);
  }
}

/** A tank or pipe standing top to bottom, lit along its right flank. */
export function vcyl(a: Art, x: number, y: number, w: number, h: number, r: Ramp, round = 0): void {
  for (let i = 0; i < w; i++) {
    const inset = Math.max(0, round - Math.min(i, w - 1 - i));
    a.rect(x + i, y + inset, 1, h - inset * 2, r[tubeStep((w - 1 - i + 0.5) / w)]);
  }
}

/** A ball shaded in clean bands with a glint, for pressure tanks and domes. */
export function sphere(a: Art, cx: number, cy: number, r: number, ramp: Ramp): void {
  const q = r + 0.5;
  a.disc(cx, cy, r, (dx, dy, d, x, y) => {
    const nz = Math.sqrt(Math.max(0, 1 - (d / q) ** 2));
    const l = (dx / q) * LIGHT[0] + (dy / q) * LIGHT[1] + nz * LIGHT[2];
    return shade(ramp, 0.1 + l * 0.86, x, y, 0.25);
  });
}

/**
 * A lattice girder between two points. The second chord is the first moved by (ox, oy); posts and diagonals
 * lace the two together every `step` pixels. Keep slopes at 1:1 or 2:1 and the lines come out clean.
 */
export function truss(a: Art, x0: number, y0: number, x1: number, y1: number, ox: number, oy: number, r: Ramp, step = 6): void {
  const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), n = Math.max(1, Math.round(len / step));
  const at = (k: number) => [Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n)] as const;
  for (let k = 0; k < n; k++) {
    const [ax, ay] = at(k), [bx, by] = at(k + 1);
    if (k % 2 === 0) a.line(ax, ay, bx + ox, by + oy, r[1]);
    else a.line(ax + ox, ay + oy, bx, by, r[1]);
  }
  for (let k = 0; k <= n; k++) {
    const [ax, ay] = at(k);
    a.line(ax, ay, ax + ox, ay + oy, r[2]);
  }
  // the chord toward the sun (up, or right) catches the light
  const lit = ox - oy < 0;
  a.line(x0, y0, x1, y1, lit ? r[3] : r[1]);
  a.line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, lit ? r[1] : r[3]);
}

/** Black and yellow warning paint over a rectangle, in diagonal bars. */
export function hazard(a: Art, x: number, y: number, w: number, h: number, yellow: string, black: string, bar = 3): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) a.put(x + i, y + j, Math.floor((i + j) / bar) % 2 ? black : yellow);
  }
}

/**
 * Loose rock heaped in a bin: lumps lit from the upper right, piled into a mound whose sunward slope is
 * brighter. `stone` is a ramp of six or so; `rich` is three shades of the ore worth hauling, seen here and there.
 */
export function oreHeap(a: Art, x: number, y: number, w: number, h: number, stone: readonly string[], rich: readonly string[], seed: number, full = 1): void {
  const rnd = rng(seed), top = stone.length - 1;
  a.rect(x, y, w, h, stone[0]);
  const put = (px: number, py: number, c: string) => {
    if (px >= x && py >= y && px < x + w && py < y + h) a.put(px, py, c);
  };
  const lumps: { x: number; y: number; s: number; height: number; tone: number; rich: boolean }[] = [];
  for (let gy = -2; gy < h; gy += 3) {
    for (let gx = -2; gx < w; gx += 3) {
      const pick = rnd(), s = pick < 0.25 ? 4 : pick < 0.7 ? 3 : 2;
      const lx = gx + Math.floor(rnd() * 3), ly = gy + Math.floor(rnd() * 3);
      const u = (lx + s / 2 - w / 2) / (w / 2), v = (ly + s / 2 - h / 2) / (h / 2), height = 1 - (u * u + v * v);
      const jitter = rnd(), isRich = rnd() < 0.12;
      if (height < 1 - full * 1.25 + jitter * 0.3) continue; // a bin that is not full shows its floor round the edge
      lumps.push({ x: x + lx, y: y + ly, s, height, tone: 0.56 + (u * 0.55 - v * 0.65) * 0.24 + height * 0.1 + (jitter - 0.5) * 0.22, rich: isRich });
    }
  }
  lumps.sort((p, q) => p.height - q.height);
  for (const l of lumps) {
    const i = Math.max(1, Math.min(top - 1, Math.round(l.tone * top)));
    const [d, m, lt] = l.rich ? rich : [stone[i - 1], stone[i], stone[i + 1]];
    for (let j = 0; j < l.s; j++) {
      for (let k = 0; k < l.s; k++) {
        const corner = (k === 0 || k === l.s - 1) && (j === 0 || j === l.s - 1);
        if (l.s === 4 && corner) continue;
        const lit = j === 0 || k === l.s - 1, dark = j === l.s - 1 || k === 0;
        put(l.x + k, l.y + j, lit && !dark ? lt : dark && !lit ? d : m);
      }
    }
  }
}

/**
 * A dish seen down its axis: a bowl that is brightest on the side away from the sun, with the sunward lip
 * throwing a crescent of shade into it, a lit rim, eight petals, and a feed horn held over the middle on struts.
 */
export function dish(a: Art, cx: number, cy: number, R: number, r: readonly string[], feed: string): void {
  const top = r.length - 1;
  /** How bright the bowl is at an offset from its centre, 0 to 1. */
  const bowl = (dx: number, dy: number) => {
    const g = (dx * LIGHT[0] + dy * LIGHT[1]) / R;
    return 0.5 - g * 0.44 - (g > 0.5 ? 0.12 : 0);
  };
  a.disc(cx, cy, R, (dx, dy, d, x, y) => {
    const g = (dx * LIGHT[0] + dy * LIGHT[1]) / R;
    if (d > R - 1.3) return g > 0.25 ? r[top] : g > -0.35 ? r[top - 1] : r[top - 2];
    let t = bowl(dx, dy);
    if (R >= 8 && Math.abs(d - R * 0.55) < 0.55) t -= 0.14; // a ring where the panels join
    return shade(r, t, x, y, 0.3);
  });
  if (R >= 8) {
    // seams between the petals, on the eight clean directions
    for (let k = 0; k < 8; k++) {
      const ux = Math.round(Math.cos((k * Math.PI) / 4)), uy = Math.round(Math.sin((k * Math.PI) / 4));
      for (let n = 3; Math.hypot(ux * n, uy * n) < R - 1.5; n++) {
        const dx = ux * n, dy = uy * n;
        a.put(cx + dx, cy + dy, r[Math.max(0, Math.round(bowl(dx, dy) * top) - 1)]);
      }
    }
  }
  // the feed sits toward the sun of centre, as if the dish were tipped a little; its struts run to the rim
  const fx = cx + Math.round(R * 0.14), fy = cy - Math.round(R * 0.14);
  if (R >= 10) {
    for (const ang of [0.4, 2.75, 4.3]) a.line(cx + Math.round(Math.cos(ang) * (R - 2)), cy + Math.round(Math.sin(ang) * (R - 2)), fx, fy, r[0]);
  }
  const s = R >= 12 ? 3 : 2;
  a.rect(fx - 1, fy - 1, s, s, r[1]);
  a.rect(fx - 1, fy - 1, s - 1, s - 1, feed);
}
