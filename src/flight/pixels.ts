/** Shared pixel-art toolkit: a tiny RGBA buffer, ordered dithering, and seeded noise. */

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
/** Ordered-dither threshold in (0, 1) for a pixel. */
export const bay = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;

/** Sunlight comes from the upper right, toward the viewer. Screen axes: x right, y down, z out. */
export const LIGHT: readonly [number, number, number] = (() => {
  const v = [0.55, -0.65, 0.52];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n] as const;
})();

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const mod = (a: number, n: number) => ((a % n) + n) % n;

export function rng(seed: number): () => number {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth value noise in [0, 1). */
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
  const c = (a: number, b: number, d: number) => hash3(xi + a, yi + b, zi + d);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/** Fractal noise, roughly centred on 0.5. */
export function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise3(x * f, y * f, z * f + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/** Fractal noise that repeats every (px, py) lattice cells, for seamless tiles. */
export function tileFbm(x: number, y: number, px: number, py: number, seed: number, octaves = 4): number {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const X = x * f, Y = y * f, wx = px * f, wy = py * f;
    const xi = Math.floor(X), yi = Math.floor(Y);
    const u = smooth(X - xi), v = smooth(Y - yi);
    const c = (a: number, b: number) => hash3(mod(xi + a, wx), mod(yi + b, wy), seed + o * 31);
    sum += amp * lerp(lerp(c(0, 0), c(1, 0), u), lerp(c(0, 1), c(1, 1), u), v);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

/**
 * Pick from a dark-to-light ramp, dithering between neighbouring steps.
 * `soft` is how much of each step is dithered: 1 blends everywhere, small values leave flat bands.
 */
export function shade(ramp: readonly string[], t: number, x: number, y: number, soft = 1): string {
  const f = clamp01(t) * (ramp.length - 1);
  const i = Math.floor(f);
  const edge = clamp01((f - i - 0.5) / soft + 0.5);
  return ramp[Math.min(ramp.length - 1, edge > bay(x, y) ? i + 1 : i)];
}

const parsed = new Map<string, number>();
function rgb(hex: string): number {
  let n = parsed.get(hex);
  if (n === undefined) parsed.set(hex, (n = parseInt(hex.slice(1), 16)));
  return n;
}

export class PixelBuf {
  private readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  /** Colour as 0xRRGGBB, or -1 where the buffer is empty or out of range. */
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    const i = (y * this.w + x) * 4;
    return this.data[i + 3] ? (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2] : -1;
  }

  putRgb(x: number, y: number, n: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = n >> 16;
    this.data[i + 1] = (n >> 8) & 255;
    this.data[i + 2] = n & 255;
    this.data[i + 3] = 255;
  }

  put(x: number, y: number, hex: string): void {
    this.putRgb(Math.round(x), Math.round(y), rgb(hex));
  }

  rect(x: number, y: number, w: number, h: number, hex: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, hex);
  }

  line(x0: number, y0: number, x1: number, y1: number, hex: string): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.put(x0, y0, hex);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Wrap everything drawn so far in a one-pixel outline. */
  outline(hex: string): void {
    const edge: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) >= 0) continue;
        if (this.get(x - 1, y) >= 0 || this.get(x + 1, y) >= 0 || this.get(x, y - 1) >= 0 || this.get(x, y + 1) >= 0) edge.push(x, y);
      }
    }
    for (let i = 0; i < edge.length; i += 2) this.put(edge[i], edge[i + 1], hex);
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(this.w, this.h);
    img.data.set(this.data);
    g.putImageData(img, 0, 0);
    return cv;
  }
}

/* ---------- recolouring: one drawing, many places ---------- */

/** Rotate an 0xRRGGBB colour's hue by `deg` degrees, keeping its lightness and saturation. */
function shiftRgb(n: number, deg: number): number {
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d < 1e-6) return n;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = mod(h * 60 + deg, 360);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (ch(r1) << 16) | (ch(g1) << 8) | ch(b1);
}

export function shiftHex(hex: string, deg: number): string {
  return deg ? `#${shiftRgb(rgb(hex), deg).toString(16).padStart(6, '0')}` : hex;
}

/** A copy of a sprite with every colour's hue rotated. */
export function hueShifted(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  if (!deg) return src;
  const cv = document.createElement('canvas');
  cv.width = src.width;
  cv.height = src.height;
  const g = cv.getContext('2d')!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
  const memo = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const n = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let out = memo.get(n);
    if (out === undefined) memo.set(n, (out = shiftRgb(n, deg)));
    d[i] = out >> 16;
    d[i + 1] = (out >> 8) & 255;
    d[i + 2] = out & 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** The hue turn for a generated port's art. 0 for the core ports, which are shown as drawn. */
export function hueFor(look: number, spread: readonly number[]): number {
  return look ? spread[look % spread.length] : 0;
}
