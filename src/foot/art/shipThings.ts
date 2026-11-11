/**
 * What stands on the freighter's deck: the bunk, shelf, plant and galley of the living quarters, the bridge's
 * computer, consoles and pilot seat, the engines, the airlock, and the things hung on the walls.
 * Each is drawn in place, in deck pixels. Anything that rises above its own tile is split by `standing`
 * so that a person on the tile behind is hidden by it. What moves is in shipLive.ts.
 */
import { INK, PAL, SIGNAL } from '../../art/palette';
import { T, alpha, dither, glow, hash, hazard, px, shadow, sprite, standing, type G } from './shipKit';

const { steel, bone, wood, rust, amber, teal, night, violet, leaf, phosphor } = PAL;

/** A filled circle, row by row. */
export function disc(g: G, c: string, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r + r * 0.8 - dy * dy) - 0.5);
    if (half >= 0) px(g, c, cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/* ---------- living quarters ---------- */

/** The bunk: a timber frame against the wall, a dented pillow, and a striped wool blanket left as it fell. */
function bunk(g: G): void {
  const x = 11 * T, y = 2 * T;
  // headboard and its posts, up the wall
  px(g, wood[1], x + 1, y - 7, 22, 7);
  px(g, wood[4], x + 2, y - 6, 20, 6);
  px(g, wood[6], x + 2, y - 6, 20, 1);
  px(g, wood[5], x + 2, y - 5, 20, 1);
  for (const i of [8, 15]) {
    px(g, wood[2], x + i, y - 3, 1, 3);
    px(g, wood[5], x + i + 1, y - 3, 1, 3);
  }
  for (const i of [1, 20]) {
    px(g, wood[1], x + i, y - 10, 3, 10);
    px(g, wood[5], x + i + 1, y - 9, 1, 9);
    px(g, wood[7], x + i + 1, y - 10, 1, 2);
  }
  // frame, rails and mattress
  px(g, wood[1], x + 1, y, 22, 47);
  px(g, wood[3], x + 2, y, 1, 46);
  px(g, wood[5], x + 21, y, 1, 46);
  px(g, bone[5], x + 3, y, 18, 43);
  px(g, bone[3], x + 3, y, 18, 1);
  px(g, bone[4], x + 3, y + 1, 1, 14);
  // pillow, with the dent a head left
  px(g, bone[2], x + 5, y + 2, 14, 9);
  px(g, bone[6], x + 5, y + 1, 14, 8);
  px(g, bone[5], x + 5, y + 7, 14, 2);
  px(g, bone[4], x + 6, y + 9, 12, 1);
  px(g, bone[5], x + 9, y + 3, 6, 3);
  px(g, bone[4], x + 10, y + 5, 4, 1);
  for (const [i, j] of [[5, 1], [18, 1]]) px(g, bone[5], x + i, y + j);
  // the sheet, turned down
  px(g, bone[6], x + 3, y + 12, 18, 2);
  px(g, bone[3], x + 3, y + 14, 18, 1);
  // the blanket: rust wool with cream stripes toward the foot, lit from the lamp side, creased where it was thrown back
  const bx = x + 3, by = y + 15;
  px(g, rust[4], bx, by, 18, 27);
  px(g, rust[5], bx + 12, by, 6, 27);
  dither(g, rust[5], bx + 7, by, 5, 27, 0.5);
  px(g, rust[3], bx, by, 2, 27);
  dither(g, rust[3], bx + 2, by, 2, 27, 0.5);
  px(g, rust[6], bx, by, 18, 1);
  for (let i = 0; i < 18; i++) {
    const dip = Math.round(Math.sin(i * 0.7) * 0.8);
    for (const [j, c] of [[19, bone[5]], [20, bone[4]], [23, bone[5]]] as const) px(g, i < 2 ? bone[3] : c, bx + i, by + j + dip);
  }
  const crease = (x0: number, y0: number, n: number, slope: number) => {
    for (let i = 0; i < n; i++) {
      const fy = by + y0 + Math.round(i * slope);
      px(g, rust[2], bx + x0 + i, fy);
      px(g, rust[6], bx + x0 + i, fy - 1);
    }
  };
  crease(1, 10, 8, -0.5);
  crease(8, 15, 9, -0.34);
  crease(3, 13, 5, 0.5);
  // one corner thrown back, and the blanket hanging over the rail
  sprite(g, x + 14, y + 15, ['wwwwwww', '.wwwwww', '..wwwws', '...wwws', '....wss', '.....ss'], { w: bone[4], s: bone[2] });
  px(g, rust[2], x + 21, y + 24, 1, 13);
  px(g, rust[3], x + 22, y + 26, 1, 9);
  // footboard
  px(g, wood[1], x + 1, y + 41, 22, 6);
  px(g, wood[6], x + 2, y + 41, 20, 1);
  px(g, wood[4], x + 2, y + 42, 20, 3);
  px(g, wood[3], x + 2, y + 45, 20, 1);
  for (const i of [1, 20]) {
    px(g, wood[1], x + i, y + 38, 3, 9);
    px(g, wood[5], x + i + 1, y + 39, 1, 7);
    px(g, wood[7], x + i + 1, y + 39);
  }
  px(g, INK, x + 1, y + 46, 22, 1);
  shadow(g, 0.35, x + 1, y + 47, 22, 1);
}

/** Things on the cabin wall over the bunk: a picture of somewhere green, and a string of lamps. */
function cabinWallThings(g: G): void {
  const x = 11 * T, y = T;
  // the picture
  px(g, amber[1], x + 6, y + 8, 11, 8);
  px(g, amber[4], x + 6, y + 8, 11, 1);
  px(g, amber[3], x + 6, y + 9, 1, 6);
  px(g, teal[5], x + 7, y + 9, 9, 3);
  px(g, teal[6], x + 13, y + 9, 2, 1);
  px(g, leaf[4], x + 7, y + 12, 9, 3);
  px(g, leaf[3], x + 7, y + 11, 3, 1);
  px(g, leaf[3], x + 11, y + 11, 5, 1);
  px(g, leaf[2], x + 7, y + 14, 9, 1);
  px(g, amber[5], x + 9, y + 10);
  shadow(g, 0.25, x + 7, y + 16, 11, 1);
  // the wire the lamps hang from, sagging between its nails (the bulbs are lit in live)
  for (const [x0, x1] of [[2, 22], [22, 46]]) {
    for (let i = x0; i <= x1; i++) {
      const t = (i - x0) / (x1 - x0), sag = Math.round(Math.sin(t * Math.PI) * 1.2);
      px(g, wood[0], x + i, y + 1 + sag);
    }
  }
}

/** Where the cabin's string lamps hang, in deck pixels, for live to light. */
export const STRING_LAMPS: readonly { x: number; y: number; c: string }[] = [6, 11, 16, 27, 32, 37, 42].map((i, n) => {
  const [x0, x1] = i < 22 ? [2, 22] : [22, 46];
  const sag = Math.round(Math.sin(((i - x0) / (x1 - x0)) * Math.PI) * 1.2);
  return { x: 11 * T + i, y: T + 2 + sag, c: [amber[5], SIGNAL.teal, amber[5], rust[6], amber[5], SIGNAL.teal, amber[5]][n] };
});

const BOOKS = [rust[5], teal[3], amber[3], violet[5], leaf[3], bone[4], rust[3], steel[5], amber[2], teal[2]];

/** The shelf: a tall bookcase of paperbacks and keepsakes, with a radio and a lantern. */
function shelf(g: G): void {
  const x = 13 * T + 2, top = 29, w = 20;
  shadow(g, 0.3, x - 2, 60, 2, 11); // it shades the wall and floor to its left
  px(g, wood[1], x, top, w, 42);
  px(g, wood[7], x + 1, top, w - 2, 1);
  px(g, wood[6], x + 1, top + 1, w - 2, 2);
  px(g, wood[3], x + 1, top + 3, w - 2, 37);
  px(g, wood[5], x + w - 2, top + 3, 1, 37);
  px(g, wood[2], x + 1, top + 3, 1, 37);
  for (let s = 0; s < 3; s++) {
    const y = top + 4 + s * 12;
    px(g, wood[0], x + 2, y, w - 4, 10);
    px(g, wood[1], x + 2, y + 1, w - 5, 9);
    px(g, wood[6], x + 2, y + 10, w - 4, 1);
    px(g, wood[4], x + 2, y + 11, w - 4, 1);
    if (s === 2) continue;
    // a row of books, some leaning
    let bx = x + 2;
    for (let n = 0; bx < x + (s ? 9 : w - 4); n++) {
      const bw = 2 + (hash(n, s * 5 + 1) < 0.35 ? 1 : 0), bh = 6 + Math.floor(hash(n, s * 5 + 2) * 3);
      const c = BOOKS[Math.floor(hash(n, s * 5 + 3) * BOOKS.length)];
      px(g, c, bx, y + 10 - bh, bw, bh);
      px(g, alpha(INK, 0.35), bx, y + 10 - bh, 1, bh);
      px(g, alpha(bone[6], 0.5), bx + bw - 1, y + 10 - bh, 1, 1);
      px(g, amber[4], bx + bw - 1, y + 13 - bh, 1, 1);
      bx += bw;
    }
  }
  // middle shelf: a radio beside the books
  const ry = top + 16 + 4;
  px(g, INK, x + 10, ry, 8, 6);
  px(g, bone[3], x + 10, ry, 8, 5);
  px(g, bone[5], x + 10, ry, 8, 1);
  px(g, wood[1], x + 11, ry + 2, 3, 2);
  px(g, steel[6], x + 16, ry + 2, 1, 1);
  px(g, steel[2], x + 17, ry - 3, 1, 3);
  // bottom shelf: a jar, a folded blanket, a tin
  const by = top + 28 + 4;
  px(g, teal[2], x + 3, by + 3, 4, 7);
  px(g, teal[4], x + 5, by + 4, 1, 5);
  px(g, bone[4], x + 3, by + 2, 4, 1);
  px(g, rust[3], x + 8, by + 6, 6, 4);
  px(g, rust[5], x + 8, by + 6, 6, 1);
  px(g, rust[2], x + 8, by + 8, 6, 1);
  px(g, amber[3], x + 15, by + 4, 3, 6);
  px(g, amber[5], x + 15, by + 4, 3, 1);
  px(g, amber[1], x + 15, by + 7, 3, 1);
  // foot
  px(g, wood[2], x + 1, top + 40, w - 2, 1);
  px(g, INK, x, top + 41, w, 1);
  shadow(g, 0.35, x, top + 42, w, 1);
  // on top: two books lying flat and a brass lantern (its flame is lit in live)
  px(g, INK, x + 2, top - 4, 9, 4);
  px(g, leaf[3], x + 2, top - 4, 9, 2);
  px(g, bone[5], x + 3, top - 3, 8, 1);
  px(g, rust[4], x + 3, top - 2, 8, 2);
  px(g, bone[5], x + 3, top - 1, 7, 1);
  px(g, amber[1], x + 13, top - 8, 5, 8);
  px(g, amber[4], x + 13, top - 8, 5, 1);
  px(g, amber[3], x + 14, top - 10, 3, 2);
  px(g, amber[2], x + 15, top - 12, 1, 2);
  px(g, night[2], x + 14, top - 6, 3, 4);
  px(g, amber[4], x + 13, top - 1, 5, 1);
}

/** The lantern's glass, for live to light. */
export const LANTERN = { x: 13 * T + 16, y: 23 };

/** The plant: a spindly thing in a clay pot, hanging on. Its top stands in front of whoever is behind it. */
function plant(back: G, front: G): void {
  const x = 11 * T, y = 6 * T;
  standing(back, front, 6, g => {
    shadow(g, 0.3, x + 4, y + 20, 5, 2);
    shadow(g, 0.2, x + 2, y + 19, 4, 2);
    sprite(g, x + 2, y - 10, [
      '..........lL........',
      '.........lLLl.......',
      '....lL...dlLl.......',
      '...lLLl...ds..lL....',
      '...dlLl...s..lLLl...',
      '....dd.s..s..dlLl...',
      '........s.s.s.dd....',
      '..lLl....sss........',
      '.lLLLl....s...lLl...',
      '.dlLLd....s..lLLLl..',
      '..ddd.s...s.sdlLld..',
      '.......s..ss..ddd...',
      '........s.s.........',
      '....lL...ss....y....',
      '...lLLl..s.s..yy....',
      '...dlLd..s..s.yyb...',
      '....dd.s.s...s.yb...',
      '........ss......b...',
      '.........s..........',
      '.........s..........',
      '.........s..........',
    ], { s: leaf[2], l: leaf[3], L: leaf[5], d: leaf[1], y: amber[4], b: wood[3] });
    // the pot: clay, wider at the rim, lit from the right
    sprite(g, x + 6, y + 10, [
      '.ooooooooo.',
      'oHsssssssHo',
      'olmmmmhhhmo',
      'oodddddddoo',
      '.olmmmhhmo.',
      '.olmmmhhmo.',
      '.olmmmhHmo.',
      '..olmmhmo..',
      '..olmmhmo..',
      '..odddddo..',
      '..ooooooo..',
    ], { o: INK, H: rust[6], h: rust[5], m: rust[4], l: rust[3], d: rust[2], s: wood[1] });
    // a saucer, and a leaf it has dropped
    px(g, bone[3], x + 6, y + 21, 11, 1);
    px(g, INK, x + 6, y + 22, 11, 1);
    px(g, amber[3], x + 19, y + 19, 3, 1);
    px(g, amber[4], x + 20, y + 18, 2, 1);
  });
}

/** The galley: a steel counter seen from behind, with a hot plate, a blue enamel coffee pot, a mug, a sink and a tea towel. */
function galley(back: G, front: G): void {
  const x = 13 * T, y = 6 * T;
  standing(back, front, 6, g => {
    shadow(g, 0.3, x - 1, y - 2, 2, 22);
    // counter: timber rail toward the room, steel top, its near side below
    px(g, INK, x + 1, y - 7, 23, 31);
    px(g, wood[6], x + 2, y - 6, 21, 1);
    px(g, wood[4], x + 2, y - 5, 21, 1);
    px(g, steel[6], x + 2, y - 4, 21, 20);
    px(g, steel[7], x + 2, y - 4, 21, 1);
    px(g, steel[7], x + 22, y - 4, 1, 18);
    px(g, steel[5], x + 2, y + 14, 21, 2);
    px(g, steel[3], x + 2, y + 16, 21, 7);
    px(g, steel[4], x + 2, y + 16, 21, 1);
    // the worktop's sheen and scratches
    for (const [i, j, w] of [[3, -2, 6], [5, 11, 4], [12, 9, 2]]) px(g, steel[7], x + i, y + j, w, 1);
    for (const [i, j, w] of [[2, 12, 2], [11, -1, 2], [20, 12, 2]]) px(g, steel[5], x + i, y + j, w, 1);
    // the sink: a basin let into the top, with a tap over it
    px(g, steel[8], x + 13, y - 2, 9, 10);
    px(g, steel[5], x + 13, y + 7, 9, 1);
    px(g, steel[2], x + 14, y - 1, 7, 8);
    px(g, steel[3], x + 14, y + 1, 7, 6);
    px(g, steel[4], x + 15, y + 3, 6, 4);
    px(g, steel[5], x + 16, y + 6, 4, 1);
    px(g, night[2], x + 17, y + 4, 2, 2);
    px(g, steel[3], x + 16, y - 5, 4, 2);
    px(g, steel[7], x + 16, y - 5, 4, 1);
    px(g, INK, x + 19, y - 3, 1, 5);
    px(g, steel[8], x + 17, y - 3, 2, 5);
    px(g, steel[5], x + 17, y + 1, 2, 1);
    // hot plate
    shadow(g, 0.25, x + 2, y + 1, 1, 10);
    px(g, steel[2], x + 3, y, 10, 10);
    px(g, night[1], x + 4, y + 1, 8, 8);
    px(g, rust[4], x + 5, y + 2, 6, 6);
    px(g, night[1], x + 6, y + 3, 4, 4);
    // the coffee pot, on the plate
    sprite(g, x + 2, y - 7, [
      '....ooo.....',
      '...ommmo....',
      '..ommhhmo...',
      '..oKKKKKo...',
      '.oommhhmmooo',
      'oomommhhmo.o',
      'omoommhhmo.o',
      'oo.ommhhmo.o',
      '...ommhhmooo',
      '...ommhhmo..',
      '...oKmmmKo..',
      '...ooooooo..',
    ], { o: INK, K: teal[1], m: teal[2], h: teal[4] });
    px(g, teal[6], x + 8, y - 2, 1, 2);
    // the mug
    shadow(g, 0.25, x + 13, y + 10, 1, 5);
    px(g, INK, x + 14, y + 8, 7, 7);
    px(g, bone[6], x + 15, y + 9, 4, 5);
    px(g, bone[4], x + 15, y + 9, 1, 5);
    px(g, wood[1], x + 15, y + 9, 4, 1);
    px(g, rust[5], x + 15, y + 11, 4, 1);
    px(g, bone[5], x + 19, y + 10, 1, 3);
    // a tea towel over the near edge
    px(g, bone[5], x + 5, y + 12, 6, 10);
    px(g, bone[3], x + 5, y + 12, 1, 10);
    px(g, bone[6], x + 5, y + 12, 6, 1);
    px(g, rust[4], x + 5, y + 15, 6, 1);
    px(g, rust[4], x + 5, y + 19, 6, 1);
  });
}

/** Where steam leaves the coffee pot. */
export const POT = { x: 13 * T + 6, y: 6 * T - 9 };

/* ---------- cargo bay ---------- */

/** Hung on the cargo bay's wall: a net, an extinguisher, the manifest on its clipboard, a strip lamp. */
function cargoWallThings(g: G): void {
  const y = T;
  // a cargo net on its hooks
  for (let j = 0; j < 13; j++) {
    for (let i = 0; i < 40; i++) {
      if ((i + j) % 5 === 0 || (i - j + 40) % 5 === 0) px(g, (i + j) % 2 ? bone[2] : bone[3], 148 + i, y + 6 + j);
    }
  }
  px(g, bone[1], 148, y + 5, 40, 1);
  for (const i of [148, 167, 187]) {
    px(g, steel[7], i, y + 4, 2, 2);
    px(g, steel[1], i, y + 6, 2, 1);
  }
  // the extinguisher
  const ex = 197;
  shadow(g, 0.25, ex - 1, y + 9, 1, 10);
  px(g, INK, ex, y + 7, 6, 13);
  px(g, rust[5], ex + 1, y + 9, 4, 10);
  px(g, rust[3], ex + 1, y + 9, 1, 10);
  px(g, rust[6], ex + 3, y + 10, 1, 8);
  px(g, bone[5], ex + 1, y + 12, 4, 3);
  px(g, steel[2], ex + 2, y + 6, 2, 3);
  px(g, steel[6], ex + 2, y + 6, 3, 1);
  // the strip lamp
  px(g, steel[1], 206, y + 6, 22, 4);
  px(g, amber[6], 207, y + 7, 20, 2);
  px(g, steel[8], 208, y + 7, 18, 1);
  glow(g, amber[6], 217, y + 10, 16, 9, 0.2, 3, (_, py) => py > y + 9);
  // the manifest
  const cx = 225;
  shadow(g, 0.25, cx - 1, y + 12, 1, 8);
  px(g, wood[1], cx, y + 11, 9, 10);
  px(g, wood[4], cx + 1, y + 11, 7, 9);
  px(g, bone[6], cx + 2, y + 13, 5, 6);
  px(g, steel[4], cx + 3, y + 15, 3, 1);
  px(g, steel[4], cx + 3, y + 17, 2, 1);
  px(g, amber[4], cx + 3, y + 11, 3, 2);
}

/* ---------- bridge ---------- */

/** The ship's computer: a bulky terminal on its own cabinet, amber screen toward the room. */
function computer(g: G): void {
  const x = 16 * T, y = 2 * T;
  shadow(g, 0.3, x, y - 14, 2, 36);
  // the cabinet and keyboard shelf
  px(g, INK, x + 1, y + 6, 22, 17);
  px(g, steel[3], x + 2, y + 13, 20, 9);
  px(g, steel[5], x + 2, y + 13, 20, 1);
  px(g, steel[2], x + 2, y + 20, 20, 2);
  px(g, steel[1], x + 5, y + 16, 14, 1);
  px(g, steel[1], x + 5, y + 18, 14, 1);
  px(g, amber[3], x + 17, y + 15, 3, 1);
  px(g, bone[3], x + 2, y + 7, 20, 6);
  px(g, bone[5], x + 2, y + 7, 20, 1);
  px(g, night[2], x + 3, y + 8, 18, 4);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 9; i++) px(g, (i + j) % 4 === 0 ? bone[6] : bone[4], x + 3 + i * 2 + j, y + 8 + j * 2, 1, 1);
  px(g, amber[4], x + 19, y + 8, 2, 1);
  // the monitor
  px(g, INK, x + 2, y - 22, 20, 28);
  px(g, bone[6], x + 3, y - 21, 18, 1);
  px(g, bone[5], x + 3, y - 20, 18, 2);
  px(g, bone[3], x + 3, y - 18, 18, 23);
  px(g, bone[4], x + 3, y - 18, 18, 1);
  px(g, bone[4], x + 20, y - 18, 1, 23);
  px(g, bone[2], x + 3, y - 18, 1, 23);
  px(g, bone[1], x + 4, y - 16, 16, 14);
  px(g, INK, x + 5, y - 15, 14, 12);
  px(g, phosphor[1], x + 6, y - 14, 12, 10);
  for (const [i, j] of [[6, -14], [17, -14], [6, -5], [17, -5]]) px(g, INK, x + i, y + j);
  // knobs, a brass maker's plate and the cooling slots under the screen
  px(g, steel[6], x + 5, y, 2, 2);
  px(g, steel[2], x + 5, y + 2, 2, 1);
  px(g, steel[6], x + 9, y, 2, 2);
  px(g, steel[2], x + 9, y + 2, 2, 1);
  px(g, amber[3], x + 13, y + 1, 6, 1);
  px(g, amber[5], x + 13, y, 6, 1);
  for (let i = 5; i < 19; i += 2) px(g, bone[1], x + i, y + 4, 1, 1);
  // a note stuck to the corner of the bezel
  px(g, amber[5], x + 17, y - 21, 4, 4);
  px(g, amber[3], x + 18, y - 19, 2, 1);
  shadow(g, 0.35, x + 1, y + 23, 22, 1);
}

/** The computer's screen, 12 x 10, for live to write on. */
export const SCREEN = { x: 16 * T + 6, y: 2 * T - 14, w: 12, h: 10 };

/** Lamps on the bridge that blink in live: position, colour, how long a cycle is and how much of it they are lit. */
export const BRIDGE_LAMPS: readonly { x: number; y: number; c: string; period: number; duty: number }[] = [
  { x: 17 * T + 14, y: 2 * T + 2, c: SIGNAL.green, period: 3.1, duty: 0.9 },
  { x: 17 * T + 20, y: 2 * T + 2, c: SIGNAL.amber, period: 1.3, duty: 0.5 },
  { x: 18 * T + 6, y: 3 * T, c: SIGNAL.teal, period: 2.3, duty: 0.7 },
  { x: 18 * T + 15, y: 3 * T, c: SIGNAL.amber, period: 0.9, duty: 0.5 },
  { x: 18 * T + 7, y: 4 * T + 18, c: SIGNAL.green, period: 4.1, duty: 0.95 },
  { x: 18 * T + 12, y: 4 * T + 18, c: SIGNAL.red, period: 1.7, duty: 0.2 },
  { x: 17 * T + 4, y: 6 * T + 13, c: SIGNAL.teal, period: 2.9, duty: 0.6 },
  { x: 17 * T + 9, y: 6 * T + 13, c: SIGNAL.amber, period: 1.1, duty: 0.5 },
];

/** A round scope: a bezel and a dark teal face; the sweep is drawn in live. */
function scope(g: G, cx: number, cy: number, r: number): void {
  disc(g, INK, cx, cy, r + 2);
  disc(g, steel[5], cx, cy, r + 1);
  px(g, steel[7], cx - 1, cy - r - 1, r + 1, 1);
  disc(g, teal[0], cx, cy, r);
  px(g, teal[1], cx - r + 1, cy, 2 * r - 1, 1);
  px(g, teal[1], cx, cy - r + 1, 1, 2 * r - 1);
  px(g, teal[3], cx - 2, cy - 2);
  px(g, teal[3], cx + 2, cy + 1);
}

/** The scopes on the bridge, for live to sweep. */
export const SCOPES = [{ x: 17 * T + 7, y: 2 * T - 7, r: 5 }, { x: 18 * T + 11, y: 3 * T + 11, r: 6 }];

/** The console in the bridge's upper corner: a radar scope, gauges and rows of switches, against the wall. */
function wallConsole(g: G): void {
  const x = 17 * T, y = 2 * T;
  px(g, INK, x, y - 19, 24, 42);
  px(g, violet[4], x + 1, y - 18, 22, 1);
  px(g, violet[3], x + 1, y - 17, 22, 2);
  px(g, night[4], x + 1, y - 15, 22, 21);
  px(g, night[5], x + 1, y - 15, 22, 1);
  px(g, night[3], x + 1, y - 15, 1, 21);
  scope(g, SCOPES[0].x, SCOPES[0].y, SCOPES[0].r);
  // two gauges and a column of lamps
  for (const gy of [y - 11, y - 3]) {
    disc(g, INK, x + 18, gy, 3);
    disc(g, bone[5], x + 18, gy, 2);
    px(g, rust[4], x + 18, gy - 1, 1, 2);
    px(g, rust[4], x + 19, gy - 2 + (gy === y - 3 ? 3 : 0));
  }
  // the desk: switches and buttons
  px(g, violet[3], x + 1, y + 6, 22, 7);
  px(g, violet[4], x + 1, y + 6, 22, 1);
  px(g, night[3], x + 2, y + 8, 20, 4);
  for (let i = 0; i < 6; i++) {
    px(g, steel[7], x + 3 + i * 2, y + 8 + (i % 3 === 1 ? 1 : 0), 1, 2);
    px(g, steel[2], x + 3 + i * 2, y + 10 + (i % 3 === 1 ? 1 : 0), 1, 1);
  }
  px(g, rust[5], x + 16, y + 9, 2, 2);
  px(g, teal[4], x + 19, y + 9, 2, 2);
  // the kick panel
  px(g, violet[2], x + 1, y + 13, 22, 9);
  px(g, violet[3], x + 1, y + 13, 22, 1);
  for (const j of [16, 18]) px(g, night[2], x + 5, y + j, 14, 1);
  px(g, night[1], x + 1, y + 21, 22, 1);
  shadow(g, 0.35, x, y + 23, 24, 1);
}

/** The helm: one long console under the canopy, seen from above, with the yoke reaching back to the seat. */
function helm(g: G): void {
  const x = 18 * T, y0 = 3 * T - 5, y1 = 6 * T;
  shadow(g, 0.3, x - 2, y0 + 6, 3, y1 - y0 - 6);
  px(g, INK, x, y0, 24, y1 - y0);
  // the padded rail nearest the pilot, the sloped panel, and the coaming under the glass
  px(g, wood[4], x + 1, y0 + 1, 3, y1 - y0 - 7);
  px(g, wood[6], x + 3, y0 + 1, 1, y1 - y0 - 7);
  px(g, wood[2], x + 1, y0 + 1, 1, y1 - y0 - 7);
  for (let j = y0 + 8; j < y1 - 8; j += 9) px(g, amber[4], x + 2, j);
  px(g, night[3], x + 4, y0 + 1, 15, y1 - y0 - 7);
  px(g, night[5], x + 4, y0 + 1, 15, 1);
  px(g, night[2], x + 4, y0 + 2, 1, y1 - y0 - 8);
  px(g, violet[3], x + 19, y0 + 1, 5, y1 - y0 - 7);
  px(g, violet[4], x + 19, y0 + 1, 5, 1);
  px(g, violet[4], x + 22, y0 + 2, 1, y1 - y0 - 8);
  px(g, violet[2], x + 19, y0 + 2, 1, y1 - y0 - 8);
  // its near end
  px(g, violet[2], x + 1, y1 - 6, 23, 5);
  px(g, violet[3], x + 1, y1 - 6, 23, 1);
  px(g, night[1], x + 1, y1 - 2, 23, 1);
  // section seams
  for (const j of [4 * T - 1, 5 * T - 1]) {
    px(g, night[1], x + 4, j, 15, 1);
    px(g, night[5], x + 4, j + 1, 15, 1);
  }
  // forward section: the navigation scope
  scope(g, SCOPES[1].x, SCOPES[1].y, SCOPES[1].r);
  // middle section: the heading display and the yoke
  const my = 4 * T;
  px(g, INK, x + 6, my + 2, 12, 13);
  px(g, steel[4], x + 6, my + 2, 12, 1);
  px(g, phosphor[1], x + 7, my + 3, 10, 11);
  px(g, phosphor[3], x + 8, my + 5, 8, 1);
  px(g, phosphor[4], x + 8, my + 8, 5, 1);
  px(g, phosphor[3], x + 8, my + 11, 7, 1);
  px(g, phosphor[4], x + 14, my + 7, 1, 3);
  px(g, steel[2], x - 3, my + 9, 9, 4);
  px(g, steel[5], x - 3, my + 9, 9, 1);
  px(g, steel[3], x - 3, my + 10, 9, 2);
  px(g, INK, x - 6, my + 3, 4, 16);
  px(g, wood[3], x - 5, my + 4, 2, 14);
  px(g, wood[6], x - 5, my + 4, 2, 4);
  px(g, wood[5], x - 5, my + 14, 2, 4);
  px(g, amber[4], x - 5, my + 10, 2, 2);
  // aft section: throttles in their slots, and two gauges
  const ay = 5 * T;
  for (const [j, at, c] of [[3, 5, rust[5]], [8, 9, amber[4]]] as const) {
    px(g, INK, x + 6, ay + j, 12, 3);
    px(g, steel[2], x + 7, ay + j + 1, 10, 1);
    px(g, INK, x + 6 + at, ay + j - 1, 4, 5);
    px(g, c, x + 7 + at, ay + j, 2, 3);
    px(g, alpha(bone[6], 0.5), x + 8 + at, ay + j);
  }
  for (const i of [8, 15]) {
    disc(g, INK, x + i, ay + 15, 3);
    disc(g, bone[5], x + i, ay + 15, 2);
    px(g, rust[4], x + i, ay + 14, 1, 2);
    px(g, rust[4], x + i + (i === 8 ? -1 : 1), ay + 13);
  }
}

/** The console along the bridge's near wall, seen from behind and above: comms, a keypad, a rolled chart. */
function nearConsole(back: G, front: G): void {
  const x = 17 * T, y = 6 * T;
  standing(back, front, 6, g => {
    shadow(g, 0.3, x - 2, y - 2, 3, 22);
    px(g, INK, x, y - 7, 24, 31);
    px(g, violet[4], x + 1, y - 6, 22, 1);
    px(g, violet[3], x + 1, y - 5, 22, 2);
    px(g, night[4], x + 1, y - 3, 22, 19);
    px(g, night[5], x + 22, y - 3, 1, 19);
    px(g, violet[2], x + 1, y + 16, 22, 7);
    px(g, violet[3], x + 1, y + 16, 22, 1);
    // the comms screen: a teal trace
    px(g, INK, x + 2, y - 2, 12, 9);
    px(g, teal[0], x + 3, y - 1, 10, 7);
    sprite(g, x + 3, y, ['....#.....', '#..#.#..#.', '.##...##.#', '..........', '######....'], { '#': teal[4] });
    // a keypad
    px(g, INK, x + 15, y - 2, 7, 8);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) px(g, i === 2 && j === 2 ? rust[5] : bone[4], x + 16 + i * 2, y - 1 + j * 2, 1, 1);
    // a row of switches, and a star chart rolled up and left here
    for (let i = 0; i < 5; i++) {
      px(g, steel[7], x + 3 + i * 2, y + 9, 1, 2);
      px(g, steel[2], x + 3 + i * 2, y + 11, 1, 1);
    }
    px(g, INK, x + 13, y + 9, 10, 5);
    px(g, bone[5], x + 14, y + 10, 8, 3);
    px(g, bone[6], x + 14, y + 10, 8, 1);
    px(g, bone[3], x + 14, y + 12, 8, 1);
    px(g, rust[4], x + 17, y + 10, 1, 3);
  });
}

/** The pilot's seat: worn red leather with brass studs, facing the nose. The one thing on the bridge built for comfort. */
function seat(back: G, front: G): void {
  const x = 17 * T, y = 4 * T;
  standing(back, front, 4, g => {
    shadow(g, 0.32, x + 5, y + 21, 15, 2);
    shadow(g, 0.22, x - 1, y + 10, 2, 9);
    sprite(g, x, y - 7, [
      '..oooooo................',
      '.oaaaaaao...............',
      '.obbbbbbo...............',
      '.obbybbbo...............',
      '.obbbbbbo...............',
      '.obbbbbbo...............',
      '.obbybbbo...............',
      '.obbbbbbo...............',
      '.occccccooooooooooo.....',
      '.oddddddoaaaaaaaabo.....',
      '.oedddddobbbbbbbbco.....',
      '.oedddcdobccccccccoo....',
      '.oedddcdoccecccecco.....',
      '.oedddcdoccecccecco.....',
      '.oedddcdoccecccecco.....',
      '.oedddcdoccccccccco.....',
      '.oedddcdoccccccccco.....',
      '.oedddcdodddddddddo.....',
      '.oedddcdooooooooooo.....',
      '.oedddddowwwwwwwwwo.....',
      '.oeeeeeeouuuuuuuuuo.....',
      '.offffffoeeeeeeeeeo.....',
      '.ooooooooffffffffffo....',
      '........oooSsstooooo....',
      '...........oSsto........',
      '...........oSsto........',
      '........oooSSsstooo.....',
      '........otttttttttto....',
      '........oSSSSSSSSSSo....',
      '........oooooooooooo....',
    ], {
      o: INK, a: rust[6], b: rust[5], c: rust[4], d: rust[3], e: rust[2], f: rust[1], y: amber[4],
      w: wood[6], v: wood[4], u: wood[2], s: steel[4], S: steel[2], t: steel[5],
    });
  });
}

/** The clock and fuse panel on the short wall beside the canopy. */
function bridgeWallThings(g: G): void {
  const x = 18 * T, y = 2 * T;
  disc(g, INK, x + 7, y + 10, 4);
  disc(g, bone[5], x + 7, y + 10, 3);
  px(g, INK, x + 7, y + 8, 1, 3);
  px(g, INK, x + 8, y + 10, 2, 1);
  px(g, INK, x + 13, y + 6, 8, 9);
  px(g, steel[3], x + 14, y + 7, 6, 7);
  px(g, steel[5], x + 14, y + 7, 6, 1);
  for (let i = 0; i < 3; i++) px(g, [SIGNAL.green, SIGNAL.green, SIGNAL.amber][i], x + 15 + i * 2, y + 9, 1, 1);
  for (let i = 0; i < 3; i++) px(g, steel[1], x + 15 + i * 2, y + 11, 1, 2);
}

/* ---------- engine room ---------- */

/** The drive's glowing parts, in deck pixels, for live: the core's dome, two fan grilles, two injector grilles and two lamps. */
export const CORE = { x: 60, y: 106, r: 6 };
export const FANS = [{ x: 60, y: 79 }, { x: 60, y: 129 }];
export const GRILLES = [{ x: 77, y: 85 }, { x: 77, y: 132 }];
export const ENGINE_LAMPS = [{ x: 89, y: 53 }, { x: 76, y: 148 }];

/** On the engine room's wall: brass pipework, a gauge and a warning plate. */
function engineWallThings(g: G): void {
  const y = T;
  for (const [py, c] of [[7, amber], [11, teal]] as const) {
    px(g, c[1], 72, y + py, 48, 3);
    px(g, c[4], 72, y + py, 48, 1);
    px(g, c[2], 72, y + py + 1, 48, 1);
    for (const fx of [78, 100, 116]) {
      px(g, c[0], fx, y + py - 1, 2, 5);
      px(g, c[3], fx, y + py - 1, 2, 1);
    }
    shadow(g, 0.3, 72, y + py + 3, 48, 1);
  }
  // gauge
  disc(g, INK, 109, y + 18, 3);
  disc(g, bone[5], 109, y + 18, 2);
  px(g, rust[4], 109, y + 17, 1, 2);
  px(g, rust[4], 110, y + 16);
  // warning plate on the short wall by the stern
  sprite(g, 54, 2 * T + 5, ['....y....', '...yyy...', '...yky...', '..yykyy..', '..yykyy..', '.yyyyyyy.', '.yyykyyy.', 'yyyyyyyyy'], { y: amber[4], k: INK });
}

/** A fan grille let into the top of the drive block. */
function fan(g: G, cx: number, cy: number): void {
  disc(g, steel[2], cx, cy, 8);
  disc(g, steel[6], cx, cy, 7);
  disc(g, steel[4], cx, cy + 1, 6);
  disc(g, INK, cx, cy, 5);
  disc(g, night[2], cx, cy, 4);
  for (const j of [-3, 0, 3]) px(g, amber[1], cx - (j ? 3 : 4), cy + j, j ? 7 : 9, 1);
  px(g, steel[3], cx, cy - 4, 1, 9);
}

/** The engines: a drive block along the stern with the core's dome set in its top, an injector either side, a coolant tank and a workbench. */
function engines(back: G, front: G): void {
  const g = back;
  // --- the coolant tank, against the wall ---
  const tx = 75;
  shadow(g, 0.3, tx - 3, 40, 3, 28);
  px(g, INK, tx - 1, 32, 20, 38);
  const band = [teal[1], teal[1], teal[2], teal[2], teal[2], teal[2], teal[3], teal[3], teal[3], teal[3], teal[4], teal[4], teal[3], teal[3], teal[2], teal[2], teal[1], teal[1]];
  band.forEach((c, i) => px(g, c, tx + i, 36, 1, 33));
  for (const sy of [43, 60]) {
    px(g, steel[2], tx, sy, 18, 2);
    px(g, steel[5], tx + 9, sy, 5, 1);
    for (let i = 0; i < 18; i++) if (hash(i, sy) < 0.4) px(g, rust[3], tx + i, sy + 2, 1, 1 + Math.floor(hash(i, sy + 1) * 3));
  }
  // its domed top, with the filler valve and a red hand wheel
  px(g, teal[4], tx, 33, 18, 4);
  px(g, teal[5], tx + 2, 33, 14, 1);
  px(g, teal[3], tx, 36, 18, 1);
  px(g, INK, tx - 1, 32, 2, 1);
  px(g, INK, tx + 17, 32, 2, 1);
  px(g, steel[2], tx + 7, 28, 4, 5);
  px(g, steel[5], tx + 8, 28, 1, 5);
  px(g, INK, tx + 4, 29, 10, 3);
  px(g, rust[5], tx + 5, 29, 8, 1);
  px(g, rust[3], tx + 5, 30, 8, 1);
  // a gauge and a stencilled band
  disc(g, INK, tx + 5, 51, 3);
  disc(g, bone[5], tx + 5, 51, 2);
  px(g, rust[4], tx + 5, 50, 1, 2);
  px(g, rust[4], tx + 4, 49);
  px(g, INK, ENGINE_LAMPS[0].x - 1, ENGINE_LAMPS[0].y - 1, 4, 4);
  hazard(g, tx, 64, 18, 3, teal[0]);

  // --- the drive block ---
  const bx = 48, top = 66, end = 136;
  px(g, INK, bx, top - 1, 24, 144 - top + 1);
  px(g, steel[4], bx, top, 23, end - top);
  px(g, steel[6], bx, top, 23, 1);
  px(g, steel[5], bx, top + 1, 23, 1);
  px(g, steel[6], bx + 22, top, 1, end - top);
  px(g, steel[3], bx, top, 2, end - top);
  for (const sy of [92, 119]) {
    px(g, steel[2], bx, sy, 23, 1);
    px(g, steel[6], bx + 2, sy + 1, 20, 1);
  }
  for (let j = top + 3; j < end; j += 1) if (hash(3, j) < 0.2) dither(g, steel[3], bx + 2, j, 20, 1, 0.5);
  for (const [i, j] of [[3, 69], [20, 69], [3, 89], [20, 89], [3, 122], [20, 122], [3, 133], [20, 133]]) {
    px(g, steel[7], bx + i, j);
    px(g, steel[2], bx + i, j + 1);
  }
  fan(g, FANS[0].x, FANS[0].y);
  fan(g, FANS[1].x, FANS[1].y);
  // the core: a bolted ring in a striped surround, glass over the fire
  hazard(g, bx + 1, 94, 21, 25, steel[1]);
  disc(g, INK, CORE.x, CORE.y, 10);
  disc(g, steel[5], CORE.x, CORE.y, 9);
  disc(g, steel[3], CORE.x, CORE.y + 1, 8);
  disc(g, steel[6], CORE.x, CORE.y - 1, 8);
  disc(g, steel[4], CORE.x, CORE.y, 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.39;
    px(g, steel[7], Math.round(CORE.x + Math.cos(a) * 8 - 0.5), Math.round(CORE.y + Math.sin(a) * 8 - 0.5));
  }
  disc(g, INK, CORE.x, CORE.y, CORE.r + 1);
  disc(g, amber[1], CORE.x, CORE.y, CORE.r);
  // its near side
  px(g, steel[3], bx, end, 23, 7);
  px(g, steel[5], bx, end, 23, 1);
  for (let i = 3; i < 21; i += 3) px(g, steel[1], bx + i, end + 2, 1, 3);
  px(g, steel[1], bx, end + 6, 23, 1);

  // --- the injectors, either side of the core ---
  const injector = (gg: G, y: number) => {
    shadow(gg, 0.3, 72, y + 14, 1, 13);
    px(gg, INK, 72, y - 1, 24, 28);
    px(gg, rust[4], 73, y, 22, 14);
    px(gg, rust[6], 73, y, 22, 1);
    px(gg, rust[5], 73, y + 1, 22, 1);
    px(gg, rust[5], 94, y, 1, 14);
    px(gg, rust[3], 73, y + 2, 1, 12);
    px(gg, rust[2], 73, y + 7, 22, 1);
    px(gg, rust[5], 74, y + 8, 20, 1);
    for (const i of [75, 92]) for (const j of [3, 11]) px(gg, rust[6], i, y + j);
    // filler cap and a brass feed pipe back to the block
    disc(gg, INK, 88, y + 4, 2);
    px(gg, steel[6], 87, y + 3, 3, 2);
    px(gg, steel[3], 87, y + 5, 3, 1);
    px(gg, amber[1], 72, y + 3, 9, 3);
    px(gg, amber[4], 72, y + 3, 9, 1);
    px(gg, amber[2], 72, y + 4, 9, 1);
    // its near side, with the grille the fire shows through
    px(gg, rust[3], 73, y + 14, 22, 12);
    px(gg, rust[4], 73, y + 14, 22, 1);
    px(gg, rust[2], 73, y + 14, 1, 12);
    px(gg, rust[1], 73, y + 25, 22, 1);
    px(gg, INK, 75, y + 16, 18, 7);
    px(gg, steel[2], 76, y + 16, 16, 1);
    for (let i = 0; i < 4; i++) px(gg, amber[1], 77 + i * 4, y + 17, 2, 5);
    shadow(gg, 0.35, 72, y + 27, 24, 1);
  };
  injector(g, 68);
  standing(back, front, 5, gg => injector(gg, 115));

  // --- the workbench, by the near wall ---
  const wx = 73, wy = 144;
  px(g, INK, 72, wy, 24, 24);
  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 22; i++) {
      const c = j % 5 === 4 ? wood[1] : hash(i >> 2, j + 40) < 0.3 ? wood[2] : wood[3];
      px(g, c, wx + i, wy + 1 + j);
    }
  }
  px(g, wood[5], wx, wy + 1, 22, 1);
  px(g, wood[2], wx, wy + 17, 22, 6);
  px(g, wood[4], wx, wy + 17, 22, 1);
  dither(g, night[1], wx + 6, wy + 9, 9, 6, 0.4); // old oil
  // the fuel pump at the back of it
  px(g, INK, 74, wy + 2, 9, 8);
  px(g, steel[4], 75, wy + 2, 7, 6);
  px(g, steel[6], 75, wy + 2, 7, 1);
  px(g, steel[2], 75, wy + 8, 7, 1);
  px(g, INK, ENGINE_LAMPS[1].x - 1, ENGINE_LAMPS[1].y - 1, 5, 4);
  // an open toolbox, a spanner and an oil can
  px(g, INK, 84, wy + 3, 11, 9);
  px(g, rust[5], 85, wy + 3, 9, 1);
  px(g, rust[3], 85, wy + 4, 9, 4);
  px(g, night[2], 86, wy + 5, 7, 2);
  px(g, steel[6], 86, wy + 5, 4, 1);
  px(g, steel[5], 91, wy + 6, 2, 1);
  px(g, rust[4], 85, wy + 8, 9, 3);
  px(g, amber[4], 89, wy + 9, 1, 1);
  sprite(g, 75, wy + 12, ['s.s....', '.sss...', '..sSs..', '...sSss', '....s.s'], { s: steel[6], S: steel[8] });
  px(g, INK, 88, wy + 12, 5, 5);
  px(g, amber[3], 89, wy + 13, 3, 3);
  px(g, amber[5], 89, wy + 13, 1, 3);
  px(g, steel[6], 92, wy + 11, 2, 1);
}

/* ---------- the airlock ---------- */

/** Where the airlock's lamp is, for live. */
export const AIRLOCK_LAMP = { x: 8 * T + 10, y: 7 * T + 4 };

/** The airlock: a heavy double hatch in the near wall with a hand wheel, striped all round. */
function airlock(back: G, front: G): void {
  const x = 8 * T, y = 7 * T;
  const g = back;
  px(g, INK, x, y, T, T);
  hazard(g, x + 1, y, T - 2, 21, steel[1]);
  // the two leaves
  px(g, INK, x + 3, y + 2, 18, 18);
  px(g, steel[4], x + 4, y + 3, 16, 16);
  px(g, steel[6], x + 4, y + 3, 16, 1);
  px(g, steel[6], x + 4, y + 3, 1, 16);
  px(g, steel[6], x + 13, y + 3, 1, 16);
  px(g, steel[2], x + 4, y + 18, 16, 1);
  px(g, steel[3], x + 10, y + 3, 1, 16);
  px(g, INK, x + 11, y + 3, 2, 16);
  for (const j of [9, 15]) {
    px(g, steel[3], x + 5, y + j, 5, 1);
    px(g, steel[3], x + 14, y + j, 5, 1);
  }
  // lamp housing over the wheel
  px(g, INK, x + 8, y + 3, 8, 5);
  px(g, steel[2], x + 9, y + 3, 6, 1);
  // the hand wheel
  disc(g, INK, x + 12, y + 13, 4);
  disc(g, amber[3], x + 12, y + 13, 3);
  disc(g, steel[3], x + 12, y + 13, 2);
  px(g, amber[5], x + 10, y + 10, 4, 1);
  px(g, amber[3], x + 9, y + 13, 6, 1);
  px(g, amber[3], x + 12, y + 10, 1, 6);
  px(g, amber[5], x + 12, y + 13);
  // the collar the docking tube meets
  px(g, steel[1], x, y + 20, T, 4);
  px(g, steel[5], x + 1, y + 20, T - 2, 1);
  px(g, steel[3], x + 1, y + 21, T - 2, 2);
  for (let i = 3; i < T - 2; i += 4) px(g, steel[6], x + i, y + 21);
  // its sill stands in front of whoever is at the door
  px(front, INK, x, y - 3, T, 1);
  hazard(front, x, y - 2, T, 2, steel[1]);
}

/** Running lights on the hull's skin: red to port (the top of the picture), green to starboard. */
export const NAV_LIGHTS = [{ x: 300, y: 6, c: SIGNAL.red }, { x: 300, y: 186, c: SIGNAL.green }] as const;

/** Everything fixed that stands on the deck or hangs on its walls. */
export function paintThings(back: G, front: G): void {
  for (const l of NAV_LIGHTS) {
    px(back, l.c === SIGNAL.red ? rust[2] : leaf[1], l.x, l.y, 2, 2);
  }
  engineWallThings(back);
  cargoWallThings(back);
  cabinWallThings(back);
  bridgeWallThings(back);
  engines(back, front);
  bunk(back);
  shelf(back);
  plant(back, front);
  galley(back, front);
  computer(back);
  wallConsole(back);
  seat(back, front);
  helm(back);
  nearConsole(back, front);
  for (const l of BRIDGE_LAMPS) { // unlit sockets; live lights them
    px(back, INK, l.x - 1, l.y - 1, 4, 4);
    px(back, night[4], l.x, l.y, 2, 2);
  }
  airlock(back, front);
}
