/**
 * A farm moon's dock. Timber boards underfoot, whitewash between dark posts, a painted wainscot, lanterns,
 * a noticeboard thick with handbills, sacks and a crate of apples, herbs in every planter and a rag rug.
 */
import { PAL } from '../../art/palette';
import {
  COUNTER_FRONT, COUNTER_TOP, ICONS, SERVICE, SHADOW, SIGN_H, T,
  capEdges, globe, glow, groundShadow, hash, hues, mix, oval, px, signWords, sky, sprite,
  type G, type Theme,
} from './stationKit';

const WOOD = PAL.wood, LEAF = PAL.leaf, RUST = PAL.rust, BRASS = PAL.amber, STEEL = PAL.steel;
/** Whitewash, shadow to full light. */
const WASH = [PAL.bone[3], PAL.bone[4], PAL.bone[5], PAL.bone[6]] as const;
/** Floorboards: the gap between them, three board tones, and the light on an edge. */
const BOARD = ['#63483a', '#84654d', '#8a6a52', '#93714f', '#a68463'] as const;
const NAIL = '#4a3a30';

const LANTERN = ['..kkk..', '...k...', '.kkkkk.', 'kkyyykk', '.kyhyk.', '.kyhyk.', '.kyhyk.', '.kyyyk.', 'kkkkkkk', '.kdddk.'];
const HAT = ['.....hhhhhh.....', '....hsssssss....', '....hsssssss....', '....bbbbbbbb....', '..hhsssssssshh..', 'hhssssssssssssss', '.dddddddddddddd.'];
const SACK = [
  '....tt.......',
  '...tsst......',
  '..ssssss.....',
  '.sshssssss...',
  '.shssssssss..',
  'sshsssssssds.',
  'sshssssssdds.',
  'sssssssssdds.',
  'ssssssssddds.',
  '.sssssssddd..',
  '.kkkkkkkkkk..',
];
const CRATE = [
  '...aA.aA..aA....',
  '..aaaAaaaAaaaA..',
  '.aAaaaaAaaaaAaa.',
  'wwwwwwwwwwwwwwww',
  'wllllllllllllllw',
  'wddddddddddddddw',
  'wllllllllllllllw',
  'wllllllllllllllw',
  'wddddddddddddddw',
  'wllllllllllllllw',
  'kkkkkkkkkkkkkkkk',
];
const JUG = ['.ccc...', '.cdc...', 'ccccchh', 'cbbcd.h', 'cbbcdh.', 'ccccd..', '.ddd...'];
const BASKET = ['..aA.aA..', '.aaAaaaA.', 'wwwwwwwww', 'wdwdwdwdw', '.wdwdwdw.', '.kkkkkkk.'];
const MUG = ['ccc.', 'cdch', 'cdch', 'ddd.'];
const CANDLE = ['.y.', '.h.', 'ccc', 'cdc', 'kkk'];
const PIE = ['..pppppp..', '.pPpPpPpp.', 'tttttttttt', '.tddddddt.'];

/** The bills on the noticeboard: x, y, w, h and which paper, inside the frame. */
const BILLS: readonly (readonly number[])[] = [
  [1, 1, 9, 11, 3], [11, 0, 8, 7, 0], [20, 2, 10, 12, 2], [31, 0, 8, 9, 1], [3, 9, 8, 10, 2], [12, 8, 7, 11, 4],
  [27, 10, 9, 10, 3], [33, 11, 6, 9, 0], [18, 13, 8, 7, 1],
];

export function farm(look: number): Theme {
  // paint comes in blues, reds and slates; never the browns, which would vanish against the timber
  const { all } = hues(look, [60, -150, 100, 30, -140, 75]);
  /** The dock's paint: wainscot, trim, gingham. */
  const PAINT = [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]].map(all);
  const PAPERS = [WASH[3], mix(WASH[3], PAINT[4], 0.45), WASH[2], mix(WASH[3], RUST[6], 0.4), mix(WASH[3], PAL.teal[5], 0.4)];
  const CAP = [WOOD[0], WOOD[1], WOOD[2], WOOD[3]];

  /** A clump of leaves, lit from the upper right. */
  function bush(g: G, cx: number, cy: number, rx: number, ry: number, seed: number): void {
    oval(g, LEAF[1], cx, cy + 1, rx, ry);
    oval(g, LEAF[2], cx, cy, rx, ry);
    oval(g, LEAF[3], cx + rx * 0.2, cy - ry * 0.25, rx * 0.7, ry * 0.65);
    for (let i = 0; i < rx * 1.2; i++) {
      const lx = Math.round(cx - rx * 0.6 + hash(seed, i, 1) * rx * 1.4), ly = Math.round(cy - ry * 0.8 + hash(seed, i, 2) * ry * 1.1);
      px(g, i % 3 ? LEAF[4] : LEAF[5], lx, ly, 2, 1);
    }
  }

  function planter(g: G, ox: number, oy: number): void {
    px(g, SHADOW, ox - 1, oy + 21, 22, 2);
    // tomato canes up the wall
    for (const [cx, top] of [[ox + 6, oy - 20], [ox + 17, oy - 15]]) {
      px(g, WOOD[5], cx, top, 1, oy + 12 - top);
      for (let y = top + 2, i = 0; y < oy + 6; y += 4, i++) {
        const side = i & 1 ? 1 : -2;
        px(g, LEAF[2], cx + side, y, 2, 3);
        px(g, LEAF[4], cx + side + (i & 1 ? 1 : 0), y, 1, 2);
        if (i % 3 === 1) {
          px(g, RUST[5], cx - side - (i & 1 ? 1 : 0), y + 1, 2, 2);
          px(g, RUST[7], cx - side, y + 1, 1, 1);
        }
      }
    }
    // herbs, bushy, with lavender at one end
    bush(g, ox + 6, oy + 7, 6, 5, ox);
    bush(g, ox + 17, oy + 6, 6, 5.5, ox + 9);
    bush(g, ox + 12, oy + 9, 5, 4, ox + 5);
    for (const [fx, fy] of [[2, 1], [5, -1], [8, 2]]) {
      px(g, PAL.violet[5], ox + fx, oy + fy, 1, 3);
      px(g, PAL.violet[6], ox + fx, oy + fy, 1, 1);
    }
    for (const [fx, fy] of [[15, 3], [19, 6], [12, 7]]) px(g, WASH[3], ox + fx, oy + fy, 2, 1);
    // the trough
    px(g, WOOD[1], ox + 1, oy + 12, 22, 10);
    px(g, WOOD[4], ox + 2, oy + 12, 20, 9);
    px(g, WOOD[6], ox + 1, oy + 12, 22, 1);
    px(g, WOOD[2], ox + 2, oy + 16, 20, 1);
    px(g, WOOD[5], ox + 2, oy + 13, 20, 1);
    for (const nx of [3, 20]) for (const ny of [14, 18]) px(g, NAIL, ox + nx, oy + ny);
    px(g, WOOD[0], ox + 1, oy + 21, 22, 1);
  }

  function lemonTree(g: G, ox: number, oy: number): void {
    const cx = ox + 12;
    groundShadow(g, cx - 2, oy + 21.5, 8, 2.5);
    // half a barrel for a tub
    for (let y = 0; y < 10; y++) {
      const hw = 8 - Math.round((y / 9) * 2);
      px(g, WOOD[2], cx - hw, oy + 12 + y, hw * 2, 1);
      px(g, WOOD[4], cx - hw + 2, oy + 12 + y, hw * 2 - 3, 1);
      px(g, WOOD[5], cx + hw - 4, oy + 12 + y, 2, 1);
      for (let sx = cx - hw + 4; sx < cx + hw - 2; sx += 4) px(g, WOOD[3], sx, oy + 12 + y, 1, 1);
    }
    px(g, WOOD[6], cx - 8, oy + 12, 16, 1);
    px(g, STEEL[2], cx - 8, oy + 15, 16, 2);
    px(g, STEEL[5], cx + 2, oy + 15, 4, 1);
    px(g, WOOD[0], cx - 6, oy + 21, 12, 1);
    px(g, WOOD[1], cx - 6, oy + 11, 12, 1);
    // trunk and crown
    px(g, WOOD[2], cx - 1, oy, 3, 12);
    px(g, WOOD[4], cx, oy, 1, 12);
    oval(g, LEAF[1], cx, oy - 7, 12, 10.5);
    oval(g, LEAF[2], cx, oy - 8, 11.5, 10);
    // clumps of leaf break the outline, each lit on its upper right
    for (const [bx, by, r] of [[-9, -4, 3.5], [9, -3, 3.5], [-7, -15, 4], [8, -14, 3.5], [0, -18, 3.5], [-11, -10, 3], [11, -9, 3]]) {
      oval(g, LEAF[1], cx + bx, oy + by + 1, r, r);
      oval(g, LEAF[2], cx + bx, oy + by, r, r);
      oval(g, LEAF[3], cx + bx + 1, oy + by - 1, r - 1.5, r - 1.5);
    }
    oval(g, LEAF[3], cx + 2, oy - 10, 8.5, 7);
    oval(g, LEAF[4], cx + 4, oy - 12, 4.5, 3.5);
    for (let i = 0; i < 16; i++) {
      const lx = Math.round(cx - 9 + hash(ox, i, 3) * 17), ly = Math.round(oy - 16 + hash(ox, i, 4) * 15);
      px(g, i % 2 ? LEAF[1] : LEAF[5], lx, ly, 2, 1);
    }
    for (const [lx, ly] of [[-7, -6], [-2, -13], [4, -5], [7, -11], [-4, -1], [2, -9]]) {
      px(g, LEAF[1], cx + lx - 1, oy + ly + 1, 3, 2);
      px(g, BRASS[3], cx + lx, oy + ly, 2, 2);
      px(g, BRASS[5], cx + lx + 1, oy + ly, 1, 1);
    }
  }

  return {
    shelf: [WOOD[1], WOOD[3], WOOD[5], WOOD[7]],
    recess: [WOOD[0], WOOD[1], WOOD[2], WOOD[4]],
    metal: [STEEL[1], STEEL[3], STEEL[4], STEEL[6], STEEL[8]],
    paint: WASH[2],

    floor(g) {
      // boards run the length of the room, four to a tile, with staggered ends
      for (let r = 0; r < 24; r++) {
        const y = 48 + r * 6;
        let x = T - Math.floor(hash(r, 0, 1) * 40);
        for (let b = 0; x < 456; b++) {
          const len = 44 + Math.floor(hash(r, b, 2) * 40), x0 = Math.max(T, x), x1 = Math.min(456, x + len);
          const base = BOARD[1 + Math.floor(hash(r, b, 3) * 3)];
          px(g, base, x0, y, x1 - x0, 6);
          px(g, mix(base, BOARD[4], 0.45), x0, y + 1, x1 - x0, 1);
          // grain: a few long streaks, darker and lighter
          for (let i = 0; i < 3; i++) {
            const gx = x + 3 + Math.floor(hash(r, b, 10 + i) * (len - 16)), gl = 6 + Math.floor(hash(r, b, 20 + i) * 10);
            const gy = y + 2 + Math.floor(hash(r, b, 30 + i) * 3), a = Math.max(x0, gx), z = Math.min(x1, gx + gl);
            if (z > a) px(g, i ? mix(base, BOARD[0], 0.4) : mix(base, BOARD[4], 0.6), a, gy, z - a, 1);
          }
          px(g, BOARD[0], x0, y, x1 - x0, 1);
          if (x >= T) {
            px(g, BOARD[0], x, y + 1, 1, 5);
            if (x + 2 < 456) px(g, NAIL, x + 2, y + 3);
            if (x - 2 >= T) px(g, NAIL, x - 2, y + 3);
          }
          x += len;
        }
      }
      // a braided rag rug
      const cx = 268, cy = 131, rings = [RUST[2], PAINT[2], WASH[2], RUST[4], WASH[1], PAINT[3], WASH[2], RUST[3], PAINT[2]];
      rings.forEach((c, i) => oval(g, c, cx, cy, 46 - i * 5, 22 - i * 2.4));
      oval(g, WASH[2], cx, cy, 5, 2);
      // the braid: stitches slanting across each band
      for (let y = cy - 22; y < cy + 22; y++) {
        for (let x = cx - 46; x < cx + 46; x++) {
          const dx = (x + 0.5 - cx) / 46, dy = (y + 0.5 - cy) / 22;
          if (dx * dx + dy * dy < 0.96 && (x + y * 2) % 4 === 0) px(g, 'rgba(46,33,29,0.22)', x, y);
        }
      }
      // straw trodden in from the pads
      for (let i = 0; i < 16; i++) {
        const sx = 30 + Math.floor(hash(i, 1, 50) * 410), sy = hash(i, 2, 50) < 0.6 ? 168 + Math.floor(hash(i, 3, 50) * 20) : 54 + Math.floor(hash(i, 3, 50) * 130);
        const up = hash(i, 4, 50) > 0.5 ? 1 : -1;
        px(g, WOOD[7], sx, sy, 2, 1);
        px(g, WOOD[6], sx + 2, sy + up, 2, 1);
      }
    },

    mat(g, cx, kind) {
      // a coir mat with the counter's colour woven through it
      const s = SERVICE[kind], icon = ICONS[kind];
      px(g, WOOD[2], cx - 12, 76, 24, 13);
      for (let j = 0; j < 11; j++) px(g, j & 1 ? WOOD[5] : WOOD[4], cx - 11, 77 + j, 22, 1);
      px(g, s.mid, cx - 10, 78, 20, 1);
      px(g, s.mid, cx - 10, 86, 20, 1);
      px(g, s.mid, cx - 10, 78, 1, 9);
      px(g, s.mid, cx + 9, 78, 1, 9);
      sprite(g, cx - Math.floor(icon[0].length / 2), 79, icon, { '#': mix(s.dark, WOOD[0], 0.35) });
      for (let j = 0; j < 12; j += 2) {
        px(g, WOOD[5], cx - 13, 77 + j, 1, 1);
        px(g, WOOD[5], cx + 12, 77 + j, 1, 1);
      }
    },

    cap(g, x, y, w, h, lip) {
      px(g, CAP[1], x, y, w, h);
      if (h <= 4) {
        px(g, CAP[2], x, y + 1, w, 1);
        px(g, CAP[0], x, y + h - 1, w, 1);
        return;
      }
      // the grain of a heavy beam, running its length
      const along = lip === 'n' || lip === 's';
      for (let i = 0; i < (along ? w : h) / 9; i++) {
        const at = Math.floor(hash(x + i, y, 6) * ((along ? w : h) - 20)), off = 6 + Math.floor(hash(x + i, y, 7) * 12), len = 10 + Math.floor(hash(x + i, y, 8) * 14);
        if (along) px(g, i & 1 ? CAP[0] : CAP[2], x + at, y + off, len, 1);
        else px(g, i & 1 ? CAP[0] : CAP[2], x + off, y + at, 1, len);
      }
      capEdges(g, CAP, x, y, w, h, lip);
    },

    wall(g, x, w, foot) {
      const top = foot - 44;
      // whitewash, patched and marked by the trowel
      px(g, WASH[2], x, top + 4, w, 26);
      for (let i = 0; i < w / 5; i++) {
        const sx = x + Math.floor(hash(x, i, 11) * (w - 6)), sy = top + 7 + Math.floor(hash(x, i, 12) * 20);
        px(g, i % 3 ? WASH[3] : WASH[1], sx, sy, 3 + Math.floor(hash(x, i, 13) * 4), 1);
      }
      px(g, WASH[1], x, top + 4, w, 2);
      px(g, WASH[0], x, top + 4, w, 1);
      // the beam along the top, and a post every other tile
      px(g, WOOD[2], x, top, w, 4);
      px(g, WOOD[4], x, top, w, 1);
      px(g, WOOD[0], x, top + 3, w, 1);
      for (let sx = Math.ceil(x / 48) * 48; sx <= x + w; sx += 48) post(g, sx, top + 4, 26, x, x + w);
      // boarded wainscot in the dock's paint
      px(g, PAINT[2], x, top + 30, w, 11);
      for (let sx = x - (x % 6); sx < x + w; sx += 6) {
        if (sx >= x) px(g, PAINT[1], sx, top + 32, 1, 9);
        if (sx + 1 >= x && sx + 1 < x + w) px(g, PAINT[3], sx + 1, top + 32, 1, 9);
      }
      px(g, PAINT[4], x, top + 30, w, 1);
      px(g, PAINT[3], x, top + 31, w, 1);
      px(g, PAINT[0], x, top + 32, w, 1);
      px(g, WOOD[1], x, top + 41, w, 3);
      px(g, WOOD[3], x, top + 41, w, 1);
    },

    dress(g) {
      // four small windows between posts, each with a gingham valance and herbs on the sill
      for (let tx = 6; tx < 10; tx++) {
        const wx = tx * T + 2, wy = 9;
        post(g, tx * T, 8, 26, 120, 264);
        px(g, WOOD[3], wx, wy, 20, 23);
        px(g, WOOD[6], wx, wy, 20, 1);
        px(g, WOOD[1], wx + 1, wy + 1, 18, 21);
        sky(g, wx + 2, wy + 2, 16, 19, 31 + look + tx);
        // the world this moon goes round, behind the middle post
        globe(g, wx + 2, wy + 2, 16, 19, 192, 25, 15, [PAL.night[1], PAL.teal[0], PAL.teal[1], PAL.teal[2], PAL.teal[4], PAL.teal[6]]);
        px(g, WOOD[4], wx + 9, wy + 2, 2, 19);
        px(g, WOOD[4], wx + 2, wy + 11, 16, 1);
        px(g, WOOD[1], wx + 2, wy + 12, 16, 1);
        // gingham
        for (let j = 0; j < 4; j++) for (let i = 0; i < 16; i += 2) px(g, ((i >> 1) + (j >> 1)) & 1 ? PAINT[3] : WASH[3], wx + 2 + i, wy + 2 + j, 2, 1);
        px(g, PAINT[1], wx + 2, wy + 6, 16, 1);
        // the sill and what grows on it
        px(g, WOOD[6], wx - 1, wy + 23, 22, 1);
        px(g, WOOD[3], wx - 1, wy + 24, 22, 1);
        if (tx % 3 === 0) {
          px(g, RUST[3], wx + 3, wy + 19, 14, 4);
          px(g, RUST[5], wx + 3, wy + 19, 14, 1);
          for (let i = 0; i < 6; i++) {
            px(g, i & 1 ? LEAF[4] : LEAF[3], wx + 3 + i * 2 + (i & 1), wy + 15 + (i % 3), 2, 4 - (i % 3));
            if (i % 2 === 0) px(g, i % 4 ? BRASS[5] : RUST[6], wx + 4 + i * 2, wy + 14 + (i % 3), 1, 1);
          }
        }
      }
      post(g, 240, 8, 26, 120, 264);
      // a lantern either side
      for (const cx of [132, 252]) {
        glow(g, cx, 17, 12, 13, BRASS[3], 0.45);
        px(g, STEEL[1], cx - 1, 8, 5, 1);
        px(g, STEEL[1], cx + 3, 8, 1, 3);
        sprite(g, cx - 3, 10, LANTERN, { k: STEEL[0], y: BRASS[4], h: BRASS[6], d: STEEL[2] });
      }
      // the pillar: a slate with today's prices, and somebody's hat
      px(g, WOOD[3], 100, 33, 16, 13);
      px(g, WOOD[6], 100, 33, 16, 1);
      px(g, '#22332f', 101, 34, 14, 11);
      for (const [lx, ly, lw] of [[3, 2, 8], [2, 5, 5], [9, 5, 4], [2, 8, 6], [10, 8, 3]]) px(g, lw > 7 ? WASH[3] : WASH[1], 100 + lx, 33 + ly, lw, 1);
      px(g, WOOD[1], 107, 48, 2, 2);
      sprite(g, 100, 49, HAT, { h: WOOD[7], s: BRASS[5], b: PAINT[2], d: WOOD[4] });

      // the noticeboard, thick with handbills
      const bx = 339, by = 7;
      px(g, WOOD[2], bx, by, 42, 24);
      px(g, WOOD[5], bx, by, 42, 1);
      px(g, WOOD[3], bx + 1, by + 1, 40, 22);
      for (let i = 0; i < 20; i++) px(g, WOOD[4], bx + 2 + Math.floor(hash(i, 1, 90) * 37), by + 2 + Math.floor(hash(i, 2, 90) * 19), 2, 1);
      BILLS.forEach(([x, y, w, h, paper], n) => {
        const c = PAPERS[paper], X = bx + 1 + x, Y = by + 1 + y;
        px(g, mix(c, WOOD[1], 0.45), X + 1, Y + 1, w, h);
        px(g, c, X, Y, w, h);
        px(g, n % 3 ? RUST[3] : PAL.bone[1], X + 1, Y + 2, w - 3, 1);
        for (let r = 4; r < h - 1; r += 2) px(g, PAL.bone[2], X + 1, Y + r, w - 2 - Math.floor(hash(n, r, 91) * 3), 1);
        // tear-off tabs along the bottom of some
        if (n % 4 === 0) for (let i = 1; i < w; i += 2) px(g, mix(c, WOOD[1], 0.45), X + i, Y + h - 2, 1, 2);
        px(g, [RUST[5], BRASS[4], PAL.teal[4]][n % 3], X + (w >> 1), Y, 1, 1);
        px(g, PAL.bone[1], X + (w >> 1), Y + 1, 1, 1);
      });
      // sacks and a crate of apples against the wall below it
      sprite(g, 338, 36, SACK, { s: PAL.bone[4], h: PAL.bone[5], d: PAL.bone[3], t: WOOD[4], k: WOOD[0] });
      sprite(g, 347, 37, SACK, { s: PAL.bone[4], h: PAL.bone[5], d: PAL.bone[3], t: WOOD[4], k: WOOD[0] }, true);
      sprite(g, 363, 36, CRATE, { a: RUST[5], A: RUST[7], w: WOOD[6], l: WOOD[5], d: WOOD[3], k: WOOD[0] });
    },

    counter(g, x0, openLeft, openRight) {
      // a scrubbed plank top
      px(g, WOOD[6], x0, COUNTER_TOP, 72, 21);
      px(g, WOOD[3], x0, COUNTER_TOP, 72, 1);
      px(g, WOOD[5], x0, COUNTER_TOP + 1, 72, 1);
      for (const y of [COUNTER_TOP + 7, COUNTER_TOP + 13]) px(g, WOOD[5], x0, y, 72, 1);
      for (let i = 0; i < 9; i++) {
        const gx = x0 + 2 + Math.floor(hash(x0, i, 22) * 58), gy = COUNTER_TOP + 3 + Math.floor(hash(x0, i, 23) * 14);
        px(g, i % 3 ? WOOD[7] : WOOD[5], gx, gy, 5 + Math.floor(hash(x0, i, 24) * 6), 1);
      }
      px(g, WOOD[7], x0, COUNTER_FRONT - 3, 72, 2);
      px(g, WOOD[4], x0, COUNTER_FRONT - 1, 72, 1);
      // a boarded front under a painted rail
      px(g, WOOD[4], x0, COUNTER_FRONT, 72, 18);
      for (let bx = x0; bx < x0 + 72; bx += 8) {
        px(g, WOOD[2], bx, COUNTER_FRONT + 4, 1, 12);
        px(g, WOOD[5], bx + 1, COUNTER_FRONT + 4, 1, 12);
        px(g, hash(bx, 0, 25) > 0.5 ? WOOD[3] : WOOD[5], bx + 3 + Math.floor(hash(bx, 1, 25) * 3), COUNTER_FRONT + 6 + Math.floor(hash(bx, 2, 25) * 7), 1, 3);
        px(g, NAIL, bx + 4, COUNTER_FRONT + 5);
        px(g, NAIL, bx + 4, COUNTER_FRONT + 14);
      }
      px(g, PAINT[2], x0, COUNTER_FRONT, 72, 4);
      px(g, PAINT[4], x0, COUNTER_FRONT + 1, 72, 1);
      px(g, PAINT[0], x0, COUNTER_FRONT, 72, 1);
      px(g, PAINT[1], x0, COUNTER_FRONT + 3, 72, 1);
      px(g, WOOD[1], x0, COUNTER_FRONT + 16, 72, 2);
      if (openLeft) px(g, WOOD[1], x0, COUNTER_FRONT, 1, 18);
      if (openRight) px(g, WOOD[6], x0 + 71, COUNTER_FRONT + 4, 1, 12);
    },

    sign(g, x0, kind, lit) {
      // a painted board; where the counter is shut, the paint has been left to weather
      const s = SERVICE[kind];
      const [edge, face, light, letters] = lit ? [mix(s.dark, WOOD[0], 0.4), s.mid, s.lit, WASH[3]] : [WOOD[1], WOOD[3], WOOD[4], WOOD[5]];
      px(g, edge, x0 + 2, 0, 68, SIGN_H);
      px(g, face, x0 + 3, 1, 66, SIGN_H - 2);
      px(g, light, x0 + 3, 1, 66, 1);
      for (const nx of [4, 67]) for (const ny of [2, 8]) px(g, edge, x0 + nx, ny);
      signWords(g, x0, kind, letters, lit ? edge : undefined);
    },

    table(g, ox, oy, n) {
      // a barrel with a round of planks on top
      const cx = ox + 12;
      groundShadow(g, cx - 2, oy + 21.5, 8, 2.5);
      for (let y = 0; y < 17; y++) {
        const hw = 6 + Math.round(Math.sin((y / 16) * Math.PI) * 2);
        px(g, WOOD[1], cx - hw, oy + 5 + y, hw * 2, 1);
        px(g, WOOD[4], cx - hw + 2, oy + 5 + y, hw * 2 - 3, 1);
        px(g, WOOD[5], cx + hw - 5, oy + 5 + y, 3, 1);
        for (const sx of [-3, 1]) px(g, WOOD[3], cx + sx, oy + 5 + y, 1, 1);
      }
      for (const hy of [9, 18]) {
        px(g, STEEL[2], cx - 8, oy + hy, 16, 2);
        px(g, STEEL[5], cx + 2, oy + hy, 4, 1);
      }
      px(g, WOOD[0], cx - 6, oy + 22, 12, 1);
      oval(g, WOOD[1], cx, oy + 4, 11.5, 5.5);
      oval(g, WOOD[4], cx, oy + 3, 11.5, 5.5);
      oval(g, WOOD[6], cx, oy + 1.5, 11.5, 5.5);
      oval(g, WOOD[7], cx + 2, oy + 0.5, 7, 3);
      px(g, WOOD[5], cx - 10, oy + 1, 20, 1);
      px(g, WOOD[5], cx - 9, oy + 4, 18, 1);
      if (n === 0) {
        sprite(g, cx - 6, oy - 6, JUG, { c: WASH[3], d: WASH[1], b: PAINT[3], h: WASH[2] });
        sprite(g, cx + 3, oy - 1, MUG, { c: WASH[2], d: WASH[0], h: WASH[1] });
      } else if (n === 1) sprite(g, cx - 4, oy - 3, BASKET, { a: RUST[5], A: RUST[7], w: WOOD[6], d: WOOD[3], k: WOOD[2] });
      else if (n === 2) {
        sprite(g, cx - 5, oy - 2, PIE, { p: BRASS[3], P: RUST[4], t: WOOD[7], d: WOOD[5] });
        sprite(g, cx + 5, oy + 1, MUG, { c: WASH[2], d: WASH[0], h: WASH[1] });
      } else {
        sprite(g, cx - 1, oy - 4, CANDLE, { y: BRASS[6], h: BRASS[4], c: WASH[3], d: WASH[1], k: BRASS[2] });
        sprite(g, cx - 8, oy, MUG, { c: STEEL[6], d: STEEL[3], h: STEEL[4] });
      }
    },

    plant(g, ox, oy, _n, byWall) {
      if (byWall) planter(g, ox, oy);
      else lemonTree(g, ox, oy);
    },

    light(x, y) {
      // lamplight on the boards under each lantern
      let v = 0;
      for (const cx of [132, 252]) {
        const dx = (x - cx) / 34, dy = (y - 56) / 22, d = dx * dx + dy * dy;
        if (d < 1) v += (1 - d) * 1.6;
      }
      return v;
    },

    live(g, time) {
      // the lantern flames gutter
      for (const cx of [132, 252]) {
        const k = Math.floor(time * 7 + cx) % 5;
        px(g, k === 0 ? BRASS[4] : BRASS[6], cx, 14, 1, 3);
        if (k === 2) px(g, BRASS[6], cx - 1, 15, 1, 2);
      }
    },
  };

  /** A timber post on the wall, drawn only between x = from and x = to. */
  function post(g: G, x: number, y: number, h: number, from: number, to: number): void {
    const a = Math.max(from, x - 2), b = Math.min(to, x + 2);
    if (b <= a) return;
    px(g, WOOD[2], a, y, b - a, h);
    if (x - 2 >= from) px(g, WOOD[1], x - 2, y, 1, h);
    if (x + 1 < to) px(g, WOOD[4], x + 1, y, 1, h);
  }
}
