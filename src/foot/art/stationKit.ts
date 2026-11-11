/**
 * The station painter's toolkit: rectangles, sprites written as rows of letters, two small pixel fonts,
 * and the passes that put shadow and coloured light onto a finished surface. Shared by station.ts and the
 * four station types.
 */
import { bay, fbm3, hueFor, rng, shade, shiftHex } from '../../flight/pixels';
import { PAL } from '../../art/palette';

export type G = CanvasRenderingContext2D;
export type Ramp = readonly string[];

/** Pixels per map tile, and the size of a station's canvases (20 x 11 tiles). */
export const T = 24, W = 480, H = 264;

export function px(g: G, c: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

export function layer(): G {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  return cv.getContext('2d')!;
}

/** A steady pseudo-random number in [0, 1) for a tile or pixel: the same every time the room is painted. */
export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const parsed = new Map<string, readonly [number, number, number]>();
function rgbOf(hex: string): readonly [number, number, number] {
  let v = parsed.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    parsed.set(hex, (v = [n >> 16, (n >> 8) & 255, n & 255]));
  }
  return v;
}

/** A colour part of the way from one to another. */
export function mix(a: string, b: string, t: number): string {
  const p = rgbOf(a), q = rgbOf(b);
  const ch = (i: number) => Math.round(p[i] + (q[i] - p[i]) * t).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/**
 * Draw a sprite written as rows of letters. `pal` maps each letter to a colour; anything not in it
 * (use `.`) is left clear.
 */
export function sprite(g: G, x: number, y: number, rows: readonly string[], pal: Readonly<Record<string, string>>, flip = false): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length;) {
      const ch = row[i];
      let n = 1;
      while (i + n < row.length && row[i + n] === ch) n++;
      const c = pal[ch];
      if (c) px(g, c, flip ? x + row.length - i - n : x + i, y + j, n, 1);
      i += n;
    }
  }
}

/** A filled ellipse. The centre is a point between pixels, so (12, 12) with radius 4 covers pixels 8 to 15. */
export function oval(g: G, c: string, cx: number, cy: number, rx: number, ry: number): void {
  g.fillStyle = c;
  for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) >= 1) continue;
    const hw = rx * Math.sqrt(1 - dy * dy), x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
  }
}

/** Fill the part of a rectangle that an ordered dither lets through: `level` 0 is none of it, 1 all of it. */
export function dith(g: G, c: string, x: number, y: number, w: number, h: number, level: number): void {
  g.fillStyle = c;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bay(x + i, y + j) < level) g.fillRect(x + i, y + j, 1, 1);
}

/** The shadow something standing on the floor casts: the same ink and strength the renderer puts under people. */
export const SHADOW = 'rgba(21,18,31,0.35)';
export const SHADOW_SOFT = 'rgba(21,18,31,0.18)';

/** A contact shadow under a round-footed thing, falling a little down and to the left. */
export function groundShadow(g: G, cx: number, cy: number, rx: number, ry: number): void {
  oval(g, SHADOW_SOFT, cx - 1, cy + 0.5, rx + 1.5, ry + 1);
  oval(g, SHADOW, cx, cy, rx, ry);
}

/** Draw into `g` with everything outside a rectangle masked off. */
export function clipped(g: G, x: number, y: number, w: number, h: number, draw: () => void): void {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  draw();
  g.restore();
}

/** How far round a generated port's colours are turned, by its look. */
const LOOK_HUES = [-55, 40, 150, -110, 95, 180];

type Turn = (hex: string) => string;

/**
 * Recolouring for a port's look: `all` turns a colour the whole way (paint, livery, neon), `some` a quarter of
 * it (big plain surfaces, which should only lean that way) and `faint` a tenth (stone). Timber, plants and
 * brass are left alone. A type can give its own `spread` of turns to keep clear of colours that do not suit it.
 */
export function hues(look: number, spread: readonly number[] = LOOK_HUES): { all: Turn; some: Turn; faint: Turn } {
  const deg = hueFor(look, spread);
  return { all: hex => shiftHex(hex, deg), some: hex => shiftHex(hex, Math.round(deg / 4)), faint: hex => shiftHex(hex, Math.round(deg / 10)) };
}

/* ---------- lettering ---------- */

const SMALL: Record<string, readonly string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['###', '#.#', '#.#', '#.#', '###'], P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'], ' ': ['..', '..', '..', '..', '..'], ':': ['.', '#', '.', '#', '.'],
  '-': ['...', '...', '###', '...', '...'], '.': ['.', '.', '.', '.', '#'], '!': ['#', '#', '#', '.', '#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'], '/': ['..#', '..#', '.#.', '#..', '#..'],
};

/** Width in pixels of a line of small lettering. */
export function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += (SMALL[ch] ?? SMALL[' '])[0].length + 1;
  return w - 1;
}

/** Small lettering, five pixels tall. Returns the x just past the last letter. */
export function text(g: G, s: string, x: number, y: number, c: string): number {
  const ink = { '#': c };
  for (const ch of s) {
    const glyph = SMALL[ch] ?? SMALL[' '];
    sprite(g, x, y, glyph, ink);
    x += glyph[0].length + 1;
  }
  return x - 1;
}

/** The bold seven-pixel face on the signs over the counters: only the letters those signs need. */
const BOLD: Record<string, readonly string[]> = {
  W: ['##...##', '##...##', '##...##', '##.#.##', '##.#.##', '#######', '.##.##.'],
  O: ['.###.', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  R: ['####.', '##.##', '##.##', '####.', '##.#.', '##.##', '##.##'],
  K: ['##.##', '##.##', '####.', '###..', '####.', '##.##', '##.##'],
  F: ['#####', '##...', '##...', '####.', '##...', '##...', '##...'],
  U: ['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '.###.'],
  E: ['#####', '##...', '##...', '####.', '##...', '##...', '#####'],
  L: ['##...', '##...', '##...', '##...', '##...', '##...', '#####'],
  Y: ['##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..'],
  A: ['.###.', '##.##', '##.##', '#####', '##.##', '##.##', '##.##'],
  B: ['####.', '##.##', '##.##', '####.', '##.##', '##.##', '####.'],
  D: ['####.', '##.##', '##.##', '##.##', '##.##', '##.##', '####.'],
};

export function boldWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += BOLD[ch][0].length + 1;
  return w - 1;
}

/** Sign lettering. `under`, if given, is drawn one pixel down as the letter's shaded edge. */
export function bold(g: G, s: string, x: number, y: number, c: string, under?: string): number {
  for (const ch of s) {
    const glyph = BOLD[ch];
    if (under) sprite(g, x, y + 1, glyph, { '#': under });
    sprite(g, x, y, glyph, { '#': c });
    x += glyph[0].length + 1;
  }
  return x - 1;
}

/* ---------- light on a painted surface ---------- */

/** How each step of shade or light changes a colour: three multipliers, then three amounts added. */
const STEPS: readonly (readonly number[])[] = [
  [0.5, 0.46, 0.6, 0, 0, 2],
  [0.67, 0.63, 0.75, 0, 0, 1],
  [0.83, 0.8, 0.88, 0, 0, 0],
  [1, 1, 1, 0, 0, 0],
  [1.07, 1.05, 1, 6, 4, 0],
  [1.14, 1.1, 1.02, 12, 8, 2],
];

/**
 * Shade or light the pixels already painted in a rectangle. `fn` gives a level for each pixel: -1 is one
 * step darker (and a little more violet), +1 one step lighter (and warmer); it is rounded to the nearest step.
 */
export function relight(g: G, x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => number): void {
  const img = g.getImageData(x0, y0, w, h), d = img.data;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      if (!d[k + 3]) continue;
      const v = fn(x0 + i, y0 + j);
      if (!v) continue;
      // flat bands with a narrow dithered seam between them: a wide one turns a patterned floor to grit
      const step = Math.max(-3, Math.min(2, Math.floor(v + 0.5 + (bay(x0 + i, y0 + j) - 0.5) * 0.14)));
      if (!step) continue;
      const m = STEPS[step + 3];
      d[k] = Math.min(255, d[k] * m[0] + m[3]);
      d[k + 1] = Math.min(255, d[k + 1] * m[1] + m[4]);
      d[k + 2] = Math.min(255, d[k + 2] * m[2] + m[5]);
    }
  }
  g.putImageData(img, x0, y0);
}

/**
 * A pool of coloured light on whatever is already painted: an ellipse, strongest in the middle, dithered
 * out in three steps. `strength` is how far the middle moves toward the light's colour (0 to 1).
 */
export function glow(g: G, cx: number, cy: number, rx: number, ry: number, hex: string, strength: number): void {
  const x0 = Math.max(0, Math.floor(cx - rx)), y0 = Math.max(0, Math.floor(cy - ry));
  const w = Math.min(W, Math.ceil(cx + rx)) - x0, h = Math.min(H, Math.ceil(cy + ry)) - y0;
  if (w <= 0 || h <= 0) return;
  const img = g.getImageData(x0, y0, w, h), d = img.data, c = rgbOf(hex);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4;
      if (!d[k + 3]) continue;
      const dx = (x0 + i + 0.5 - cx) / rx, dy = (y0 + j + 0.5 - cy) / ry, r2 = dx * dx + dy * dy;
      if (r2 >= 1) continue;
      const t = (Math.floor((1 - r2) * 3 + bay(x0 + i, y0 + j)) / 3) * strength;
      if (t <= 0) continue;
      d[k] += (c[0] - d[k]) * t;
      d[k + 1] += (c[1] - d[k + 1]) * t;
      d[k + 2] += (c[2] - d[k + 2]) * t;
    }
  }
  g.putImageData(img, x0, y0);
}

/* ---------- the view out of a window ---------- */

/** Night sky behind glass: a faint drift of nebula and a scatter of stars. The same for a given seed. */
export function sky(g: G, x: number, y: number, w: number, h: number, seed: number): void {
  px(g, PAL.night[0], x, y, w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const n = fbm3((x + i) / 34, (y + j) / 15, seed * 3.7, 3) + (bay(x + i, y + j) - 0.5) * 0.12;
      if (n > 0.6) px(g, n > 0.69 ? PAL.night[3] : PAL.night[2], x + i, y + j);
    }
  }
  const r = rng(seed * 7919 + 13);
  for (let n = Math.round((w * h) / 46); n > 0; n--) {
    const sx = x + Math.floor(r() * w), sy = y + Math.floor(r() * h), k = r();
    px(g, k > 0.9 ? '#fff6e0' : k > 0.55 ? '#8fa3a8' : '#6a5f78', sx, sy);
    if (k > 0.965 && sx > x && sx < x + w - 1 && sy > y && sy < y + h - 1) {
      px(g, '#8fa3a8', sx - 1, sy, 3, 1);
      px(g, '#8fa3a8', sx, sy - 1, 1, 3);
      px(g, '#fff6e0', sx, sy);
    }
  }
}

/**
 * Part of a lit globe seen through a window: the disc at (cx, cy) with radius r, drawn only inside the
 * rectangle. `band`, if given, picks a ramp for a latitude so the globe can have belts.
 */
export function globe(
  g: G, x: number, y: number, w: number, h: number, cx: number, cy: number, r: number, ramp: Ramp,
  band?: (lat: number, lon: number) => number,
): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dx = (x + i + 0.5 - cx) / r, dy = (y + j + 0.5 - cy) / r, d2 = dx * dx + dy * dy;
      if (d2 >= 1) continue;
      const dz = Math.sqrt(1 - d2);
      // lit from the upper right, like everything in flight
      let t = 0.12 + 0.88 * Math.max(0, dx * 0.55 - dy * 0.65 + dz * 0.52);
      if (band) t = Math.max(0, Math.min(1, t + band(dy, dx)));
      if (d2 > 0.9) t *= 0.75;
      px(g, shade(ramp, t, x + i, y + j, 0.7), x + i, y + j);
    }
  }
}

/** Streaks of reflection across a pane, running down to the left. */
export function glints(g: G, x: number, y: number, w: number, h: number, c: string, at: readonly number[]): void {
  g.fillStyle = c;
  for (const a of at) {
    for (let j = 0; j < h; j++) {
      const i = a - j;
      if (i >= 0 && i < w && bay(x + i, y + j) < 0.6) g.fillRect(x + i, y + j, 1, 1);
    }
  }
}

/* ---------- the room every station shares, and what a station type has to paint ---------- */

/** The three counters, by what they sell. */
export type Service = 'jobs' | 'fuel' | 'yard';

/**
 * The colour each counter is known by: its sign, the badge on its front and the mark on the floor before it.
 * Dark to hot. These never turn with a port's hue: they mean something.
 */
export const SERVICE: Record<Service, { dark: string; mid: string; lit: string; hot: string }> = {
  jobs: { dark: '#7a4a2a', mid: '#cf8048', lit: '#eab668', hot: '#fff3c4' },
  fuel: { dark: '#24504a', mid: '#3f8f8a', lit: '#7fd1c7', hot: '#d7f5ee' },
  yard: { dark: '#6b2e3c', mid: '#c8553d', lit: '#e07a5f', hot: '#f2a58a' },
};

/*
 * Heights, in pixels down from the top of the map. The walls stand 44 pixels tall, so the wall along the
 * back of the concourse (map row 1) shows its face from y = 4 to 48, and the three back rooms behind the
 * counters are bays set into it.
 */
/** The sign over a bay fills rows 0 to SIGN_H - 1. */
export const SIGN_H = 11;
/** Shelving in a bay stands from here down to the counter. */
export const SHELF_Y = 11;
/** The counter's top surface starts here (its far edge), and its front face here. Its foot is at y = 72. */
export const COUNTER_TOP = 33, COUNTER_FRONT = 54, COUNTER_FOOT = 72;

/** Which side of a wall top faces into the room. */
export type Lip = 'n' | 's' | 'e' | 'w';

/**
 * A station type: its materials, and how it paints each part of the shared floor plan. station.ts decides
 * where everything goes and adds what every station has (the counters' wares, the airlock, the shutter).
 */
export interface Theme {
  /** Shelving and boards in the back rooms: deep shadow, dark, mid, light. */
  shelf: Ramp;
  /** The back rooms' walls: deep, dark, mid, light. */
  recess: Ramp;
  /** Plain metal fittings (shutter, airlock frame): deep, dark, mid, light, glint. */
  metal: Ramp;
  /** Paint for marks on the floor. */
  paint: string;
  /** The concourse floor: every tile from (1, 2) to (18, 7), and anything laid flat on it. */
  floor(g: G): void;
  /** The mark on the floor in front of a counter's service point, centred on x. */
  mat(g: G, cx: number, kind: Service): void;
  /** The top of a wall, seen from above. */
  cap(g: G, x: number, y: number, w: number, h: number, lip: Lip): void;
  /** A run of wall face, 44 tall, standing on y = foot. */
  wall(g: G, x: number, w: number, foot: number): void;
  /** Everything on the wall faces: the windows, lamps, the pillar and the stretch between fuel and yard. */
  dress(g: G): void;
  /** A counter, 72 wide from x0: its top and front. An end is open when the counter does not meet a wall there. */
  counter(g: G, x0: number, openLeft: boolean, openRight: boolean): void;
  /** The sign over a bay, in rows 0 to SIGN_H - 1. Unlit when the counter is shut. */
  sign(g: G, x0: number, kind: Service, lit: boolean): void;
  /** A bar table on the tile at (ox, oy). It may stand taller than its tile. */
  table(g: G, ox: number, oy: number, n: number): void;
  /** A plant on the tile at (ox, oy); `byWall` when it stands against the back wall. */
  plant(g: G, ox: number, oy: number, n: number, byWall: boolean): void;
  /** Paint a bay's back room yourself; return false to get the usual one. */
  backRoom?(g: G, x0: number, kind: Service): boolean;
  /** Anything more on or about a counter, drawn after its usual wares. */
  extras?(g: G, x0: number, kind: Service, open: boolean): void;
  /** Coloured light over the finished room. Called for the back layer and again for the front. */
  glows?(g: G, yardOpen: boolean): void;
  /** Extra light (+) or shade (-) on the floor, in steps. */
  light?(x: number, y: number): number;
  /** What moves. It is drawn under the people and under `front`. */
  live?(g: G, time: number, yardOpen: boolean): void;
  /**
   * Rectangles (x, y, w, h) that `live` paints in and that lie where the room's front layer would cover
   * them (a sign, the far side of a counter top): they are left out of the front layer.
   */
  liveRects?: readonly (readonly [number, number, number, number])[];
}

/** The edges of a wall top that is more than a sliver: a lit coping toward the room, a dark outer skin, seams. */
export function capEdges(g: G, cap: readonly string[], x: number, y: number, w: number, h: number, lip: Lip, seams = true): void {
  const along = lip === 'n' || lip === 's';
  // seams across the wall's thickness, a tile apart
  if (!seams) {
    // none: this wall is not built of panels
  } else if (along) for (let sx = Math.ceil(x / T) * T + 12; sx < x + w; sx += T) px(g, cap[0], sx, y, 1, h);
  else for (let sy = Math.ceil(y / T) * T + 12; sy < y + h; sy += T) px(g, cap[0], x, sy, w, 1);
  if (lip === 'n') {
    px(g, cap[0], x, y + h - 4, w, 4);
    px(g, cap[2], x, y + 1, w, 3);
    px(g, cap[3], x, y + 1, w, 1);
    px(g, cap[0], x, y, w, 1);
  } else if (lip === 's') {
    px(g, cap[2], x, y + h - 4, w, 3);
    px(g, cap[3], x, y + h - 4, w, 1);
    px(g, cap[0], x, y + h - 1, w, 1);
  } else if (lip === 'e') {
    px(g, cap[0], x, y, 4, h);
    px(g, cap[2], x + w - 4, y, 3, h);
    px(g, cap[3], x + w - 2, y, 1, h);
    px(g, cap[0], x + w - 1, y, 1, h);
  } else {
    px(g, cap[0], x + w - 4, y, 4, h);
    px(g, cap[2], x + 1, y, 3, h);
    px(g, cap[0], x, y, 1, h);
  }
}

/* ---------- what the counters are called ---------- */

export const WORDS: Record<Service, string> = { jobs: 'WORK', fuel: 'FUEL', yard: 'YARD' };

/** A picture for each counter, seven pixels tall: a crate, a drop of fuel, a cog. */
export const ICONS: Record<Service, readonly string[]> = {
  jobs: ['#########', '#.......#', '#########', '#..#.#..#', '#..#.#..#', '#..#.#..#', '#########'],
  fuel: ['...#...', '..###..', '..###..', '.#####.', '#######', '#######', '.#####.'],
  yard: ['#.###.#', '.#####.', '###.###', '##...##', '###.###', '.#####.', '#.###.#'],
};

/** A sign's picture and word, centred in a bay's 72 pixels. `under` shades the lower edge of each stroke. */
export function signWords(g: G, x0: number, kind: Service, c: string, under?: string, y = 2): void {
  const icon = ICONS[kind], word = WORDS[kind];
  const x = x0 + Math.round((72 - (icon[0].length + 4 + boldWidth(word))) / 2);
  if (under) sprite(g, x, y + 1, icon, { '#': under });
  sprite(g, x, y, icon, { '#': c });
  bold(g, word, x + icon[0].length + 4, y, c, under);
}
