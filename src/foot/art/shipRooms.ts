/**
 * The freighter's shell and rooms: the hull's outer skin, the four floors, the walls and their near faces,
 * windows, door sills and the shade walls throw on the deck. Furniture is in shipThings.ts.
 *
 * The view is a 16-bit RPG's: straight down on the floor, with anything upright showing its near (south) side.
 * A wall with room below it shows a face a tile tall; other walls show only their tops.
 */
import { bay, fbm3 } from '../../flight/pixels';
import { INK, PAL, SIGNAL } from '../../art/palette';
import { COLS, ROWS } from '../world';
import {
  DECK_H, DECK_W, PAINT, T, alpha, at, dither, glow, hash, hazard, isOpen, isRoom, isWall, px, shadow, showsFace, sprite, tiles, type G,
} from './shipKit';

const { steel, bone, wood, rust, amber, teal, night, violet } = PAL;

/* ---------- the hull's outline ---------- */

/** The hull seen from above is a long box with its corners cut: these are its edges, in deck pixels. */
const EDGE = { top: 3, bottom: 191, left: 15, right: 476 };
/** How thick the outer skin is drawn. */
export const SKIN = 9;
const R2 = Math.SQRT2;

/**
 * How far a pixel is inside the hull's outline (negative outside), and which edge it is nearest:
 * 0 top, 1 bottom, 2 stern, 3 nose, then the four cut corners (4 stern-top, 5 stern-bottom, 6 nose-top, 7 nose-bottom).
 */
export function hullDepth(x: number, y: number): [depth: number, side: number] {
  const v = [
    y - EDGE.top, EDGE.bottom - y, x - EDGE.left, EDGE.right - x,
    (x + y - 55) / R2, (156 - (y - x)) / R2, (420 - (x - y)) / R2, (636 - (x + y)) / R2,
  ];
  let side = 0;
  for (let i = 1; i < v.length; i++) if (v[i] < v[side]) side = i;
  return [Math.floor(v[side]), side];
}

/** Skin shades from the outline inward, for plating in the light and in the hull's own shade. */
const SKIN_LIT = [bone[1], bone[2], bone[3], bone[4], bone[4], bone[5], bone[5], bone[5], bone[0]];
const SKIN_SHADE = [bone[0], bone[1], bone[2], bone[2], bone[3], bone[3], bone[3], bone[4], bone[0]];
const STERN_LIT = [steel[1], steel[2], steel[3], steel[4], steel[4], steel[5], steel[5], steel[6], steel[0]];
const STERN_MID = [steel[0], steel[2], steel[3], steel[3], steel[4], steel[4], steel[4], steel[5], steel[0]];
const STERN_SHADE = [steel[0], steel[1], steel[2], steel[2], steel[3], steel[3], steel[3], steel[4], steel[0]];
const SKINS: readonly (readonly string[])[] = [SKIN_LIT, SKIN_SHADE, STERN_MID, SKIN_LIT, STERN_LIT, STERN_SHADE, SKIN_LIT, SKIN_SHADE];

const darker = (ramp: readonly string[], c: string) => ramp[Math.max(0, ramp.indexOf(c) - 1)];

/** What each pixel of the deck is, so later passes can ask about their neighbours. */
const Px = { Out: 0, Skin: 1, Cap: 2, Face: 3, Room: 4, Door: 5 } as const;

function classify(): Uint8Array {
  const m = new Uint8Array(DECK_W * DECK_H);
  for (let y = 0; y < DECK_H; y++) {
    for (let x = 0; x < DECK_W; x++) {
      const [d] = hullDepth(x, y);
      if (d < 0) continue;
      const tx = Math.floor(x / T), ty = Math.floor(y / T), ch = at(tx, ty);
      m[y * DECK_W + x] =
        ch === 'A' ? Px.Door : isRoom(ch) ? Px.Room : showsFace(tx, ty) ? Px.Face : d < SKIN ? Px.Skin : Px.Cap;
    }
  }
  return m;
}

/* ---------- floors ---------- */

const WOOD_TONES = [
  { base: '#7d5f48', dark: '#6e523d', light: '#8a6a52' },
  { base: wood[4], dark: '#7a5c45', light: '#9a7a5e' },
  { base: '#977556', dark: wood[4], light: '#a8845f' },
];

/** Timber planks running fore and aft, six pixels wide, in mixed lengths and tones. */
function woodAt(x: number, y: number): string {
  const r = Math.floor((y - 48) / 6), ly = (y - 48) % 6;
  let start = 216 - Math.floor(hash(r, 3) * 36), k = 0, len = 0;
  for (;;) {
    len = 30 + Math.floor(hash(r * 17 + k, 5) * 30);
    if (x < start + len) break;
    start += len;
    k++;
  }
  const lx = x - start, tone = hash(r * 17 + k, 9);
  const c = WOOD_TONES[tone < 0.3 ? 0 : tone < 0.75 ? 1 : 2];
  if (ly === 5 || lx === 0) return wood[2]; // the gaps between boards
  if ((lx === 2 || lx === len - 2) && ly === 2) return wood[1]; // nail heads at each end
  const grain = hash(Math.floor((x + r * 5) / 5) + k * 3, y * 7 + r);
  if (ly === 0) return grain < 0.7 ? c.light : c.base; // the lit edge of each board
  return grain < 0.16 ? c.dark : grain > 0.92 ? c.light : c.base;
}

/** Steel deck plate: staggered plates with seams and rivets, raised tread, worn where boots go. */
function deckAt(x: number, y: number): string {
  const row = Math.floor(y / T), ly = y % T, lx = (x + (row % 2 ? T : 0)) % (T * 2);
  if (ly === 0 || lx === 0) return '#3a3d55';
  const worn = (fbm3(x / 26, y / 20, 3, 3) - 0.53) * 16 > bay(x, y) - 0.5;
  const stain = (0.35 - fbm3(x / 15 + 40, y / 15, 9, 3)) * 18 > bay(x, y);
  if (ly === 1 || lx === 1) return worn ? steel[4] : '#62677f';
  if ((lx === 4 || lx === 44) && (ly === 4 || ly === 20)) return steel[5];
  if ((lx === 4 || lx === 44) && (ly === 5 || ly === 21)) return '#3a3d55';
  const u = x % 8, v = y % 8;
  const tread = (u === 1 && v === 2) || (u === 2 && v === 1) || (u === 5 && v === 5) || (u === 6 && v === 6);
  if (stain) return tread ? '#555a72' : '#4a4e67';
  if (tread) return worn ? '#777c93' : '#676c84';
  return worn ? '#5f647c' : steel[3];
}

/** The bridge: dark studded rubber, so the instruments are the brightest things in the room. */
function bridgeAt(x: number, y: number): string {
  const u = x % 12, v = (y - 48) % 12;
  if (u === 0 || v === 0) return '#12262d';
  if (u === 1 || v === 1) return '#234247';
  if (((u === 4 || u === 9) && (v === 4 || v === 9)) || (u === 6 && v === 6)) return '#2b5153';
  return (fbm3(x / 18, y / 18, 5, 2) - 0.5) * 5 > bay(x, y) - 0.25 ? '#1e3a40' : '#1a343b';
}

/** The engine room: open grating over the bilge, with pipes running underneath. */
function grateAt(x: number, y: number): string {
  const u = x % 4, v = (y - 48) % 8;
  if (v === 0) return steel[3];
  if (v === 1) return steel[1];
  if (u === 0) return v === 2 ? steel[3] : steel[2];
  // what shows through the gaps: two pipes fore-and-aft, one across, and the dark
  const across = y - 104;
  if (across >= 0 && across < 4 && x < 110) return [rust[4], rust[3], rust[2], rust[1]][across];
  const p = x - 101;
  if (p >= 0 && p < 5) return [amber[1], amber[2], amber[3], amber[1], amber[0]][p];
  const q = x - 113;
  if (q >= 0 && q < 3) return [teal[2], teal[3], teal[1]][q];
  return hash(x >> 2, y >> 3) < 0.25 ? night[2] : night[1];
}

const FLOOR_OF: Record<string, (x: number, y: number) => string> = {
  '.': woodAt, b: woodAt, B: woodAt, k: woodAt, p: woodAt, g: woodAt,
  ',': deckAt, c: deckAt,
  ':': bridgeAt, T: bridgeAt, t: bridgeAt, s: bridgeAt,
  ';': grateAt, e: grateAt,
};

function paintFloors(g: G): void {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const f = FLOOR_OF[at(tx, ty)];
      if (!f) continue;
      for (let y = ty * T; y < (ty + 1) * T; y++) for (let x = tx * T; x < (tx + 1) * T; x++) px(g, f(x, y), x, y);
    }
  }
}

/* ---------- paint and wear on the floors ---------- */

const PAINT_DIM = '#c99a52';
/** Worn yellow deck paint: most of a rectangle, with chips knocked out of it. */
function paint(g: G, x: number, y: number, w: number, h: number, wear = 0.14): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const n = hash(x + i + 7, y + j + 3);
      if (n > wear) px(g, n > 0.6 ? PAINT : PAINT_DIM, x + i, y + j);
    }
  }
}

const DIGITS: Record<string, string[]> = {
  1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '##.', '#.#', '.#.'],
  7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['.#.', '#.#', '.#.', '#.#', '.#.'],
};

function paintMarkings(g: G): void {
  // each cargo bay: corner brackets and a stencilled number, all flat on the deck
  tiles('c').forEach(({ tx, ty }, i) => {
    const x = tx * T, y = ty * T;
    for (const [cx, cy] of [[2, 2], [T - 3, 2], [2, T - 3], [T - 3, T - 3]]) {
      paint(g, x + (cx === 2 ? 2 : T - 8), y + (cy === 2 ? 2 : T - 4), 6, 2);
      paint(g, x + (cx === 2 ? 2 : T - 4), y + (cy === 2 ? 2 : T - 8), 2, 6);
    }
    sprite(g, x + 11, y + 10, DIGITS[i + 1], { '#': alpha(PAINT, 0.55) });
    // a tie-down ring let into the plate
    px(g, steel[1], x + 5, y + 16, 3, 1);
    px(g, steel[5], x + 5, y + 15, 3, 1);
  });
  // the walkway to the airlock: a warning strip at the hatch and a painted arrow
  const ax = 8 * T, ay = 6 * T;
  hazard(g, ax + 1, ay + T - 6, T - 2, 3, steel[1]);
  sprite(g, ax + 8, ay + 6, ['...##...', '...##...', '...##...', '#..##..#', '##.##.##', '.######.', '..####..', '...##...'], { '#': alpha(PAINT, 0.7) });
  // lane lines down the aisle side of the bays
  for (const ty of [2, 3, 5, 6]) paint(g, 8 * T + 1, ty * T + 4, 1, T - 8, 0.3);
}

/** Door sills: a flat steel plate in each opening in a bulkhead, cross-hatched for grip, with a painted box. */
function paintSills(g: G): void {
  for (const [tx, trim] of [[5, PAINT], [10, amber[3]], [14, teal[3]]] as const) {
    const x = tx * T, y = 4 * T;
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const edge = i === 0 || i === T - 1, hatch = (i + j) % 6 === 0 || (i - j + T) % 6 === 0;
        const box = (i === 3 || i === T - 4 || j === 3 || j === T - 4) && i >= 3 && i <= T - 4 && j >= 3 && j <= T - 4;
        px(g, edge ? '#3a3d55' : box && hash(x + i, y + j) > 0.25 ? trim : hatch ? '#747990' : '#5f647c', x + i, y + j);
      }
    }
  }
}

/** A woven rug and a doormat for the living quarters: flat, so they read as floor. */
function paintRug(g: G): void {
  const x0 = 289, y0 = 103, w = 42, h = 33;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = Math.min(i, j, w - 1 - i, h - 1 - j);
      const u = Math.abs(((i + 3) % 12) - 6), v = Math.abs(((j + 1) % 12) - 6);
      let c: string = (i + j) % 2 ? rust[3] : '#863a36';
      if (edge === 0) c = rust[1];
      else if (edge === 1 || edge === 4) c = amber[3];
      else if (edge < 4) c = (i + j) % 4 < 2 ? teal[2] : rust[2];
      else if (u + v === 5) c = amber[4];
      else if (u + v < 2) c = teal[3];
      else if (u + v < 5 && (i + j) % 2) c = rust[4];
      px(g, c, x0 + i, y0 + j);
    }
  }
  for (let j = 1; j < h; j += 2) { // the fringe at each end
    px(g, bone[4], x0 - 2, y0 + j, 2, 1);
    px(g, bone[4], x0 + w, y0 + j, 2, 1);
  }
  shadow(g, 0.3, x0 - 2, y0 + h, w + 3, 1);
  // a coir mat inside the door from the cargo bay
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 9; i++) {
      const rim = i === 0 || j === 0 || i === 8 || j === 15;
      px(g, rim ? wood[3] : (i + j * 2) % 3 ? '#b08e5c' : wood[5], 266 + i, 100 + j);
    }
  }
  shadow(g, 0.3, 266, 116, 9, 1);
}

/** Corners and wall feet are darker than the middle of a room; light falls from overhead and a little right. */
function paintShade(g: G): void {
  for (const { tx, ty } of tiles('.,:;c')) {
    const x = tx * T, y = ty * T;
    const solid = (dx: number, dy: number) => !isOpen(at(tx + dx, ty + dy));
    if (solid(0, -1)) {
      [0.42, 0.3, 0.2, 0.12].forEach((a, i) => shadow(g, a, x, y + i, T, 1));
      dither(g, alpha(INK, 0.12), x, y + 4, T, 2, 0.5);
    }
    if (solid(1, 0)) {
      [0.3, 0.2, 0.1].forEach((a, i) => shadow(g, a, x + T - 1 - i, y, 1, T));
      dither(g, alpha(INK, 0.1), x + T - 5, y, 2, T, 0.5);
    }
    if (solid(-1, 0)) shadow(g, 0.16, x, y, 1, T);
    if (solid(0, 1)) shadow(g, 0.14, x, y + T - 1, T, 1);
    if (!solid(0, -1) && !solid(1, 0) && solid(1, -1)) dither(g, alpha(INK, 0.22), x + T - 4, y, 4, 4, 0.6);
  }
}

/** Pools of lamplight on the floors, and the dark the lamps do not reach. */
function paintLight(g: G, m: Uint8Array): void {
  const room = (x: number, y: number) => m[y * DECK_W + x] === Px.Room;
  glow(g, amber[5], 302, 112, 44, 40, 0.13, 3, room); // the living quarters' lamp
  glow(g, steel[8], 210, 108, 40, 52, 0.07, 3, room); // the cargo bay's strip lights
  glow(g, amber[4], 396, 84, 20, 22, 0.14, 3, room); // the ship computer's screen
  glow(g, teal[5], 428, 108, 26, 34, 0.1, 3, room); // the helm's instruments
  glow(g, amber[3], 80, 108, 44, 60, 0.1, 3, room); // the engines' own glow
}

/* ---------- wall tops ---------- */

/** Cable trays run along the tops of the bulkheads and round the hull: two dull cables in a groove, clamped every so often. */
function cableTray(x: number, y: number): string | null {
  const tx = Math.floor(x / T), lx = x % T;
  let k = -1, along = 0;
  if ((tx === 5 || tx === 10 || tx === 14) && lx >= 10 && lx < 14 && y >= 16 && y < 177) [k, along] = [lx - 10, y];
  else if (y >= 16 && y < 20) [k, along] = [y - 16, x];
  else if (y >= 173 && y < 177) [k, along] = [y - 173, x];
  if (k < 0) return null;
  if (k === 0) return night[2];
  if (k === 3) return violet[3];
  if (along % 16 === 5) return steel[3]; // a clamp
  return k === 1 ? '#6b4455' : teal[1];
}

function paintCaps(g: G, m: Uint8Array): void {
  const get = (x: number, y: number): number => (x < 0 || y < 0 || x >= DECK_W || y >= DECK_H ? Px.Out : m[y * DECK_W + x]);
  const open = (p: number) => p === Px.Room || p === Px.Door;
  for (let y = 0; y < DECK_H; y++) {
    for (let x = 0; x < DECK_W; x++) {
      if (get(x, y) !== Px.Cap) continue;
      const up = get(x, y - 1), down = get(x, y + 1), left = get(x - 1, y), right = get(x + 1, y);
      let c: string = violet[2];
      if (down === Px.Face) c = violet[4]; // the wall's near top edge, catching the light
      else if (get(x, y + 2) === Px.Face) c = violet[3];
      else if (open(up) || open(right)) c = violet[3];
      else if (open(left) || open(down)) c = night[4];
      else if (left === Px.Face || right === Px.Face) c = night[4];
      else if (up === Px.Skin || down === Px.Skin || left === Px.Skin || right === Px.Skin) c = night[2];
      else if (cableTray(x, y)) c = cableTray(x, y)!;
      else if (at(Math.floor(x / T), Math.floor(y / T)) === ' ' && (y < 2 * T || y >= 7 * T ? x % 8 === 4 : y % 8 === 4)) c = night[4]; // the hull's frames, in the space between rooms and skin
      else if (at(Math.floor(x / T), Math.floor(y / T)) === ' ') c = (x + y) % 2 ? violet[2] : '#2f2842';
      else if (x % T === 0 || y % T === 12) c = night[4]; // seams in the structure
      else if (x % T === 1 || y % T === 13) c = (x + y) % 2 ? violet[2] : '#3d3552';
      px(g, c, x, y);
    }
  }
}

/* ---------- the outer skin ---------- */

function paintSkin(g: G, m: Uint8Array): void {
  for (let y = 0; y < DECK_H; y++) {
    for (let x = 0; x < DECK_W; x++) {
      if (m[y * DECK_W + x] !== Px.Skin) continue;
      const [d, side] = hullDepth(x, y);
      const ramp = SKINS[side], along = side < 2 ? x : side < 4 ? y : side === 4 || side === 7 ? x - y + 480 : x + y;
      let c: string = ramp[d];
      const metal = side === 2 || side === 4 || side === 5 ? steel : bone;
      if (d > 0 && d < SKIN - 1) {
        const s = along % 36;
        if (s === 14) c = darker(metal, c); // plate seams
        else if (s === 15 && d > 1) c = ramp[Math.min(SKIN - 2, d + 1)];
        else if ((s === 10 || s === 19) && d === 4) c = darker(metal, c); // rivets
        else if (hash(Math.floor(along / 9), d + side * 7) < 0.07 && d > 1) c = darker(metal, c); // scuffed plating
      }
      px(g, c, x, y);
    }
  }
}

/** The engine bells at the stern, outside the hull: steel cones seen from above, pointing aft. */
function paintBells(g: G): void {
  const bell = (cy: number, x0: number, h0: number, h1: number) => {
    for (let x = x0; x < EDGE.left; x++) {
      const t = (EDGE.left - 1 - x) / (EDGE.left - 1 - x0), half = Math.round(h0 + (h1 - h0) * t);
      for (let dy = -half; dy <= half; dy++) {
        const v = (dy + half) / (2 * half); // 0 at the top (lit), 1 at the bottom
        let c: string = v < 0.12 ? steel[4] : v < 0.3 ? steel[6] : v < 0.5 ? steel[5] : v < 0.75 ? steel[3] : steel[2];
        if (dy === -half || dy === half) c = steel[1];
        if (x === x0) c = dy === -half || dy === half ? steel[1] : v < 0.5 ? steel[7] : steel[4]; // the rim
        else if ((x - x0) % 4 === 2) c = darker(steel, c); // stiffening ribs
        px(g, c, x, cy + dy);
      }
    }
    px(g, steel[0], x0 - 1, cy - h1 + 1, 1, 2 * h1 - 1); // the dark throat
  };
  bell(108, 6, 9, 14);
  bell(74, 9, 5, 8);
  bell(142, 9, 5, 8);
  // radiator slats on the stern plate between the bells
  for (const y of [88, 91, 94, 122, 125, 128]) px(g, steel[1], EDGE.left + 2, y, 5, 1);
}

/* ---------- wall faces ---------- */

/** A run of wall face: 24 pixels tall from `y`. `at(i, j)` gives each pixel's colour. */
function face(g: G, x: number, y: number, w: number, colour: (i: number, j: number) => string): void {
  for (let j = 0; j < T; j++) for (let i = 0; i < w; i++) px(g, colour(i, j), x + i, y + j);
}

/** Painted steel panelling, as in the cargo bay and (darker, rustier) the engine room. */
function steelWall(g: G, x: number, y: number, w: number, engine: boolean): void {
  const s = engine ? 1 : 0; // the engine room's panels sit a shade down the ramp
  face(g, x, y, w, (i, j) => {
    const gx = x + i, seam = gx % T;
    if (j === 0) return steel[2 - s];
    if (j === 1) return steel[6 - s];
    if (j === 3) return hash(gx, 1) < 0.12 ? steel[4 - s] : rust[5]; // the orange trim line, chipped
    if (j === 4) return hash(gx, 2) < 0.12 ? steel[4 - s] : rust[3];
    if (j >= 21) return j === 23 ? steel[0] : j === 21 ? steel[3 - s] : steel[1];
    if (seam === 0) return steel[2 - s];
    if (seam === 1) return steel[6 - s];
    if ((j === 7 || j === 18) && seam % 6 === 4) return steel[6 - s];
    if ((j === 8 || j === 19) && seam % 6 === 4) return steel[2 - s];
    // grime gathers toward the floor; rust blooms in the engine room
    if (engine && (fbm3(gx / 9, (y + j) / 9, 21, 3) - 0.6) * 9 > bay(gx, y + j)) return '#5a4250';
    if ((j - 9) / 14 + (hash(gx >> 1, 5) - 0.5) * 0.5 > bay(gx, y + j)) return steel[3 - s];
    return j < 6 ? steel[5 - s] : steel[4 - s];
  });
}

/** The living quarters: painted plaster over a timber wainscot. */
function cabinWall(g: G, x: number, y: number, w: number): void {
  face(g, x, y, w, (i, j) => {
    const gx = x + i, board = gx % 6;
    if (j === 0) return bone[1];
    if (j === 1) return wood[3]; // a picture rail
    if (j === 2) return wood[5];
    if (j < 13) {
      if ((5 - j) / 4 > bay(gx, y + j)) return bone[3]; // shade under the rail
      return (fbm3(gx / 11, (y + j) / 7, 2, 2) - 0.5) * 6 > bay(gx, y + j) ? bone[5] : bone[4];
    }
    if (j === 13) return wood[7];
    if (j === 14) return wood[3];
    if (j >= 22) return j === 23 ? wood[0] : wood[2];
    if (board === 0) return wood[2];
    if (board === 1) return wood[6];
    return hash(gx, j * 3) < 0.14 ? wood[4] : hash(gx >> 1, 77) < 0.5 ? wood[5] : '#9a7350';
  });
}

/** The bridge: dark panels with a line of teal trim and small vents. */
function bridgeWall(g: G, x: number, y: number, w: number): void {
  face(g, x, y, w, (i, j) => {
    const gx = x + i, seam = gx % T;
    if (j === 0) return violet[1];
    if (j === 1) return violet[4];
    if (j === 3) return teal[4];
    if (j === 4) return teal[2];
    if (j >= 21) return j === 23 ? night[0] : j === 21 ? violet[2] : violet[1];
    if (seam === 0) return violet[1];
    if (seam === 1) return violet[4];
    if (j >= 14 && j <= 18 && seam >= 5 && seam <= 18) return j % 2 ? violet[1] : violet[3]; // vent slats
    if ((j - 8) / 16 > bay(gx, y + j)) return violet[2];
    return violet[3];
  });
}

/** The end of a bulkhead above a doorway: a heavy steel frame with a lamp to say the door is open. */
function jamb(g: G, tx: number, ty: number, icon: readonly string[], tint: string): void {
  const x = tx * T, y = ty * T;
  face(g, x, y, T, (i, j) => {
    if (j === 0) return steel[2];
    if (i === 0 || i === T - 1) return steel[1];
    if (j >= 20) return (i + j) % 6 < 3 ? PAINT : steel[0]; // the door head, striped
    if (j === 19) return steel[1];
    if (i === 1 || j === 1) return steel[6];
    if (i === T - 2 || j === 18) return steel[2];
    if (i >= 4 && i <= T - 5 && j >= 4 && j <= 15) {
      if (i === 4 || j === 4) return steel[1];
      if (i === T - 5 || j === 15) return steel[5];
      return steel[2];
    }
    return (j - 6) / 20 > bay(x + i, y + j) ? steel[3] : steel[4];
  });
  for (const [bx, by] of [[2, 2], [T - 4, 2], [2, 17], [T - 4, 17]]) {
    px(g, steel[7], x + bx, y + by);
    px(g, steel[1], x + bx + 1, y + by + 1);
  }
  sprite(g, x + 8, y + 6, icon, { '#': tint });
}

const ICON_ENGINE = ['..##....', '.###....', '.######.', '..####..', '.######.', '....###.', '....##..', '........'];
const ICON_CABIN = ['...##...', '..####..', '.######.', '########', '.#.##.#.', '.#.##.#.', '.######.', '........'];
const ICON_BRIDGE = ['...##...', '...##...', '.######.', '########', '.######.', '...##...', '...##...', '........'];

/** Window glass: space shows through a tint, with a streak of reflected light. */
function glass(g: G, x: number, y: number, w: number, h: number): void {
  g.clearRect(x, y, w, h);
  px(g, alpha(teal[1], 0.42), x, y, w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const band = (i + j * 2 + 400) % 17;
      if (band < 4 && bay(x + i, y + j) < 0.75) px(g, alpha(teal[6], band === 1 || band === 2 ? 0.34 : 0.18), x + i, y + j);
    }
  }
  px(g, alpha(INK, 0.5), x, y, w, 1); // the depth of the frame
  px(g, alpha(INK, 0.3), x, y + 1, 1, h - 1);
}

function windowIn(g: G, tx: number, frame: readonly string[]): void {
  const x = tx * T, y = T;
  // frame 22 x 17, glass 16 x 11, with the corners eased
  px(g, frame[0], x + 1, y + 2, 22, 17);
  px(g, frame[2], x + 2, y + 3, 20, 15);
  px(g, frame[3], x + 2, y + 3, 20, 1);
  px(g, frame[1], x + 3, y + 4, 18, 13);
  px(g, frame[0], x + 4, y + 5, 16, 11);
  glass(g, x + 4, y + 5, 16, 11);
  for (const [cx, cy] of [[4, 5], [19, 5], [4, 15], [19, 15]]) px(g, frame[0], x + cx, y + cy);
  for (const [cx, cy] of [[2, 3], [21, 3], [2, 17], [21, 17]]) px(g, frame[3], x + cx, y + cy); // bolts
  // a sill, lit from above
  px(g, frame[3], x, y + 19, 24, 1);
  px(g, frame[1], x, y + 20, 24, 1);
  shadow(g, 0.3, x + 1, y + 21, 22, 1);
}

function paintFaces(g: G): void {
  steelWall(g, 3 * T, T, 2 * T, true);
  steelWall(g, 2 * T, 2 * T, T, true);
  steelWall(g, 6 * T, T, 4 * T, false);
  cabinWall(g, 11 * T, T, 3 * T);
  bridgeWall(g, 15 * T, T, 3 * T);
  bridgeWall(g, 18 * T, 2 * T, T);
  jamb(g, 5, 3, ICON_ENGINE, amber[4]);
  jamb(g, 10, 3, ICON_CABIN, amber[4]);
  jamb(g, 14, 3, ICON_BRIDGE, amber[4]);
  windowIn(g, 12, [wood[1], wood[3], wood[5], wood[7]]);
  windowIn(g, 15, [steel[1], steel[3], steel[5], steel[7]]);
  // lamp on each door frame: lit green, the door is open
  for (const tx of [5, 10, 14]) {
    px(g, INK, tx * T + 10, 3 * T + 15, 4, 3);
    px(g, SIGNAL.green, tx * T + 11, 3 * T + 16, 2, 1);
  }
}

/* ---------- the nose ---------- */

/** The canopy round the bridge: glazing over the helm, seen from above, in a bone frame. */
function paintCanopy(g: G): void {
  const x = 19 * T, y0 = 3 * T, y1 = 6 * T;
  px(g, night[3], x, y0, 2, y1 - y0); // the coaming behind the consoles
  px(g, night[5], x, y0, 1, y1 - y0);
  glass(g, x + 2, y0, 13, y1 - y0);
  // the frame: an outer rim, and ribs between the panes
  px(g, bone[1], x + 15, y0, 1, y1 - y0);
  px(g, bone[5], x + 16, y0, 2, y1 - y0);
  px(g, bone[4], x + 18, y0, 1, y1 - y0);
  px(g, bone[3], x + 19, y0, 1, y1 - y0);
  px(g, bone[1], x + 20, y0, 1, y1 - y0);
  for (const y of [y0, 4 * T - 1, 5 * T - 1, y1 - 3]) {
    px(g, bone[1], x + 1, y, 15, 3);
    px(g, bone[5], x + 1, y + 1, 16, 1);
  }
}

/* ---------- the whole shell ---------- */

/** Paint the hull, floors and walls onto `back`, and the wall tops people can stand behind onto `front`. */
export function paintShell(back: G, front: G): void {
  const m = classify();
  paintFloors(back);
  paintMarkings(back);
  paintSills(back);
  paintRug(back);
  paintLight(back, m);
  paintShade(back);
  paintCaps(back, m);
  paintSkin(back, m);
  paintBells(back);
  paintFaces(back);
  paintCanopy(back);

  // Walls on the near side of a room stand up in front of whoever is against them: a lip of wall top, on `front`.
  for (const { tx, ty } of tiles('#wA')) {
    if (!isRoom(at(tx, ty - 1)) || !isWall(at(tx, ty))) continue;
    px(front, violet[3], tx * T, ty * T - 3, T, 1);
    px(front, violet[2], tx * T, ty * T - 2, T, 2);
  }
}
