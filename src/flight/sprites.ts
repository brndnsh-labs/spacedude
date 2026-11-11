/**
 * Procedural pixel art. Everything here is placeholder-grade on purpose:
 * each function returns a small canvas that a hand-drawn sprite can replace later.
 */

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bay = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;

// Sunlight comes from the upper right, toward the viewer.
const LIGHT = (() => {
  const v = [0.55, -0.65, 0.52];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map(c => c / n);
})();

function rng(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

class PixelBuf {
  private readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  put(x: number, y: number, hex: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, n = parseInt(hex.slice(1), 16);
    this.data[i] = n >> 16;
    this.data[i + 1] = (n >> 8) & 255;
    this.data[i + 2] = n & 255;
    this.data[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, hex: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, hex);
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

export type Ramp = readonly string[];
export type Band = (nx: number, ny: number) => boolean;

/** A dither-shaded sphere, 2r x 2r. `ramps[1]` is used where `band` is true. */
export function makePlanet(r: number, ramps: readonly Ramp[], band?: Band): HTMLCanvasElement {
  const buf = new PixelBuf(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++) {
    for (let x = 0; x < r * 2; x++) {
      const nx = (x + 0.5 - r) / r, ny = (y + 0.5 - r) / r, q = nx * nx + ny * ny;
      if (q > 1) continue;
      const nz = Math.sqrt(1 - q);
      const l = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const ramp = band && ramps[1] && band(nx, ny) ? ramps[1] : ramps[0];
      const k = Math.floor(l * ramp.length * 1.05 + (bay(x, y) - 0.5) * 0.9);
      buf.put(x, y, ramp[Math.max(0, Math.min(ramp.length - 1, k))]);
    }
  }
  return buf.toCanvas();
}

export interface StationLook {
  /** Solar panel colour, or null for a station without panels. */
  panels: string | null;
  lights: string;
  windows: string;
}

export const STATION_SIZE = 100;

/** A ring station seen from above, centred in a 100x100 canvas, docking arm pointing left. */
export function makeStation(look: StationLook): HTMLCanvasElement {
  const buf = new PixelBuf(STATION_SIZE, STATION_SIZE);
  const c = STATION_SIZE / 2;
  const OL = '#15121f', M1 = '#c3c6d4', M2 = '#8a8fa3', M3 = '#555a72';
  if (look.panels) {
    for (const py of [c - 46, c + 30]) {
      buf.rect(c - 10, py - 1, 20, 18, OL);
      buf.rect(c - 9, py, 18, 16, look.panels);
      for (let i = 0; i < 18; i++) for (let j = 0; j < 16; j++) if (i % 6 === 5 || j % 8 === 7) buf.put(c - 9 + i, py + j, '#1c2f4a');
    }
    buf.rect(c - 1, c - 30, 3, 6, M3);
    buf.rect(c - 1, c + 25, 3, 6, M3);
  }
  // docking arm
  buf.rect(c - 45, c - 3, 23, 7, OL);
  buf.rect(c - 44, c - 2, 21, 5, M2);
  buf.rect(c - 44, c - 2, 21, 1, M1);
  buf.rect(c - 44, c + 2, 21, 1, M3);
  for (let i = 0; i < 5; i++) buf.put(c - 41 + i * 4, c, look.lights);
  // spokes, ring and hub
  buf.rect(c - 20, c - 1, 40, 3, M2);
  buf.rect(c - 20, c + 1, 40, 1, M3);
  buf.rect(c - 1, c - 20, 3, 40, M2);
  buf.rect(c + 1, c - 20, 1, 40, M3);
  for (let y = c - 27; y <= c + 27; y++) {
    for (let x = c - 27; x <= c + 27; x++) {
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      if (d >= 18.5 && d <= 26.5) {
        if (d < 19.6 || d > 25.4) buf.put(x, y, OL);
        else {
          const l = ((dx * LIGHT[0] + dy * LIGHT[1]) / d) * 0.5 + 0.5 + (bay(x, y) - 0.5) * 0.35;
          buf.put(x, y, l > 0.66 ? M1 : l > 0.33 ? M2 : M3);
        }
      } else if (d <= 8.5) {
        if (d > 7.4) buf.put(x, y, OL);
        else {
          const l = ((dx * LIGHT[0] + dy * LIGHT[1]) / 8) * 0.5 + 0.5 + (bay(x, y) - 0.5) * 0.3;
          buf.put(x, y, l > 0.62 ? M1 : l > 0.3 ? M2 : M3);
        }
      }
    }
  }
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI) / 12 + 0.13;
    buf.put(c + Math.cos(a) * 22.5, c + Math.sin(a) * 22.5, k % 3 ? look.windows : look.lights);
  }
  buf.rect(c - 2, c - 2, 4, 4, look.windows);
  buf.rect(c - 1, c - 1, 2, 2, '#7fd1c7');
  buf.put(c, c - 1, '#d7f5ee');
  return buf.toCanvas();
}

const SHIP_PALETTE: Record<string, string> = {
  o: '#15121f', h: '#eadfc6', H: '#b9a58c', D: '#857670', d: '#7d3a36', r: '#c8553d',
  w: '#3f8f8a', W: '#b8ece2', g: '#9a9fb3', G: '#5f647c',
};
const SHIP_ROWS = [
  '....oooooooo',
  '...oggggggggo',
  '...oGggggggGo',
  '...oooooGooo',
  '.......oGo',
  '....oooooooooooooooo',
  '...ohhhhhhhhhhhhhhhhooo',
  '..oHhhhhddddddhhhhhhhhhoo',
  '..oHhhhhdrrrrdhhhhhhwwWho',
  '..oHhhhhdrrrrdhhhhhwwwwWho',
  '..oHHhhhdrrrrdhhhhhhwwwHo',
  '..oHHHHHddddddHHHHHHHHHoo',
  '...oDDDDDDDDDDDDDDDHooo',
  '....oooooooooooooooo',
  '.......oGo',
  '...oooooGooo',
  '...oGggggggGo',
  '...oGGGGGGGGo',
  '....oooooooo',
];
export const SHIP_W = 26, SHIP_H = 19;

/** The player's freighter, nose pointing right. */
export function makeShip(): HTMLCanvasElement {
  const buf = new PixelBuf(SHIP_W, SHIP_H);
  SHIP_ROWS.forEach((row, j) => [...row].forEach((ch, i) => {
    if (SHIP_PALETTE[ch]) buf.put(i, j, SHIP_PALETTE[ch]);
  }));
  return buf.toCanvas();
}

/** A transparent tile of stars that repeats seamlessly. */
export function makeStars(w: number, h: number, seed: number, count: number, colours: readonly string[], sparkle = 0): HTMLCanvasElement {
  const buf = new PixelBuf(w, h), r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = 2 + Math.floor(r() * (w - 4)), y = 2 + Math.floor(r() * (h - 4));
    const c = colours[Math.floor(r() * colours.length)];
    buf.put(x, y, c);
    if (r() < sparkle) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) buf.put(x + a, y + b, '#a89a8f');
  }
  return buf.toCanvas();
}

/** An opaque sky tile with a faint dithered nebula; the pattern wraps at the tile edges. */
export function makeNebula(w: number, h: number): HTMLCanvasElement {
  const buf = new PixelBuf(w, h), T = Math.PI * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const n = 0.5 + 0.25 * Math.sin(T * (u + v)) + 0.25 * Math.sin(T * (2 * u - v) + 2);
      buf.put(x, y, n > bay(x, y) * 0.5 + 0.62 ? '#2a1f38' : n > bay(x, y) * 0.4 + 0.45 ? '#211930' : '#1a1423');
    }
  }
  return buf.toCanvas();
}

/** A 5x5 chevron pointing right, for the off-screen course marker. */
export function makeArrow(colour: string): HTMLCanvasElement {
  const buf = new PixelBuf(5, 5);
  ['#....', '##...', '###..', '##...', '#....'].forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '#') buf.put(i + 1, j, colour);
  }));
  return buf.toCanvas();
}
