/**
 * Small tools shared by the freighter's deck art (ship.ts and the ship*.ts files beside it): a pixel pen,
 * a position hash for picking tile variants, character-grid sprites, and dithered glows and shadows.
 */
import { bay } from '../../flight/pixels';
import { INK, PAL } from '../../art/palette';
import { TILE_PX } from '../../view';
import { AREAS, COLS, ROWS } from '../world';

export type G = CanvasRenderingContext2D;

/** Pixels per tile, and the size of the deck's canvases. */
export const T = TILE_PX;
export const DECK_W = COLS * T, DECK_H = ROWS * T;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, G] {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [cv, g];
}

export function px(g: G, c: string, x: number, y: number, w = 1, h = 1): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

/** A repeatable number in [0, 1) for a position: the same art every time, never Math.random. */
export function hash(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A hex colour at an opacity, for shadows, glass and glows. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A shadow: INK at an opacity. */
export const shadow = (g: G, a: number, x: number, y: number, w = 1, h = 1) => px(g, alpha(INK, a), x, y, w, h);

/** Draw a character grid: each character is a pixel, coloured by `pal`; anything not in `pal` is left clear. */
export function sprite(g: G, x: number, y: number, rows: readonly string[], pal: Record<string, string>): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = pal[row[i]];
      if (c) px(g, c, x + i, y + j);
    }
  });
}

/** Fill a rectangle with an ordered dither: `level` is the share of pixels painted, 0 to 1. */
export function dither(g: G, c: string, x: number, y: number, w: number, h: number, level: number): void {
  g.fillStyle = c;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (level > bay(x + i, y + j)) g.fillRect(x + i, y + j, 1, 1);
}

/**
 * A soft pool of light (or, with INK, of shade): an ellipse that fades outward in dithered steps.
 * `only`, if given, limits it to the pixels it accepts.
 */
export function glow(
  g: G, c: string, cx: number, cy: number, rx: number, ry: number, peak: number, steps = 3,
  only?: (x: number, y: number) => boolean,
): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const t = 1 - Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (t <= 0 || (only && !only(x, y))) continue;
      const level = Math.min(steps, Math.floor(t * steps + bay(x, y)));
      if (level > 0) px(g, alpha(c, (peak * level) / steps), x, y);
    }
  }
}

/** Worn yellow paint: bay markings, warning stripes, door signs. */
export const PAINT = PAL.amber[4];

/** Warning stripes, slanted: yellow paint over `dark`. */
export function hazard(g: G, x: number, y: number, w: number, h: number, dark: string = INK): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, (x + i + y + j) % 6 < 3 ? PAINT : dark, x + i, y + j);
}

/* ---------- the map, as the art needs it ---------- */

export const at = (tx: number, ty: number): string => AREAS.ship.rows[ty]?.[tx] ?? ' ';
export const isWall = (ch: string) => ch === '#' || ch === 'w';
/** Inside the hull and not a wall: floor, furniture, crate slots. */
export const isRoom = (ch: string) => ch !== ' ' && ch !== 'A' && !isWall(ch);
/** A wall whose near side shows: there is room, not more wall, directly below it. */
export const showsFace = (tx: number, ty: number) => isWall(at(tx, ty)) && isRoom(at(tx, ty + 1));
/** Deck a person can stand on. Whether a crate slot is filled is only known at draw time, so slots count as open. */
export const isOpen = (ch: string) => '.,:;c'.includes(ch);

/** Every tile holding one of these characters. */
export function tiles(chars: string): { tx: number; ty: number; ch: string }[] {
  const out: { tx: number; ty: number; ch: string }[] = [];
  AREAS.ship.rows.forEach((row, ty) => [...row].forEach((ch, tx) => { if (chars.includes(ch)) out.push({ tx, ty, ch }); }));
  return out;
}

/**
 * Draw something that stands taller than its tile: the part inside the tile (and below) goes on `back`, the part
 * that rises above the tile's top edge goes on `front`, so a person standing on the tile behind is hidden by it.
 */
export function standing(back: G, front: G, ty: number, draw: (g: G) => void): void {
  const top = ty * T;
  for (const [g, y, h] of [[back, top, DECK_H - top], [front, 0, top]] as const) {
    g.save();
    g.beginPath();
    g.rect(0, y, DECK_W, h);
    g.clip();
    draw(g);
    g.restore();
  }
}
