/**
 * A ring station's concourse: the company's own. Terrazzo with a compass set into it, pale panelled walls
 * over a wainscot in the company's livery, brass on every edge, a departures board and potted palms.
 */
import { INK, PAL, SIGNAL } from '../../art/palette';
import {
  COUNTER_FRONT, COUNTER_TOP, ICONS, SERVICE, SIGN_H, T,
  capEdges, glints, globe, glow, groundShadow, hash, hues, mix, oval, px, signWords, sky, sprite, text,
  type G, type Theme,
} from './stationKit';

const BRASS = PAL.amber, WOOD = PAL.wood, STEEL = PAL.steel, LEAF = PAL.leaf;
const MARBLE = [PAL.bone[3], PAL.bone[4], PAL.bone[5], PAL.bone[6]] as const;

const INSET = ['..a..', '.aba.', 'abcba', '.aba.', '..a..'];
const SCONCE = ['.yyyyyy.', 'yhhhhhhy', '.bbbbbb.', '..bddb..', '...bb...', '...dd...'];
const POT = [
  '.hhbbbbbbbd.',
  'hhbbbbbbbbdd',
  '.kkkkkkkkkk.',
  '.hbbbbbbbbd.',
  '.hbbbbbbbdd.',
  '..hbbbbbbd..',
  '..hbbbbbdd..',
  '...bbbbdd...',
  '...kkkkkk...',
];
const CUP = ['.www.', 'wkkww', '.www.', 'sssss'];

/** Where the departures board is, and what is on it. */
const BOARD = { x: 338, y: 7, w: 44, h: 26 };
const SAILINGS = ['KST', 'OSA', 'MRW', 'TLN', 'VGA'];

export function ring(look: number): Theme {
  const { all, some } = hues(look);
  /** The company's livery. */
  const LIV = PAL.teal.map(all);
  const PANEL = [STEEL[3], STEEL[4], STEEL[5], STEEL[6], STEEL[7]].map(some);
  /** Terrazzo: the joint, two slab tones, and the light on it. Stone keeps its own colour whatever the livery. */
  const STONE = ['#8c7c6a', '#a99a84', '#b5a68f', '#cbbba0'];
  const CAP = [PAL.night[1], STEEL[0], STEEL[1], STEEL[2]].map(some);
  /** Terrazzo chips: a little darker and a little lighter than the slab. */
  const CHIP = [mix(STONE[1], STONE[0], 0.6), mix(STONE[2], STONE[3], 0.7)];

  /** One palm frond: a spine arching out from the crown, with leaflets hanging from it. */
  function frond(g: G, x0: number, y0: number, dx: number, len: number, rise: number, droop: number, far = false): void {
    const [a, b, tip, spine] = far ? [LEAF[1], LEAF[2], LEAF[0], LEAF[3]] : [LEAF[2], LEAF[3], LEAF[1], LEAF[5]];
    for (let t = 0; t <= len; t++) {
      const u = t / len, x = x0 + dx * t, y = Math.round(y0 - rise * u + droop * u * u);
      const leaf = Math.round((1 - Math.abs(u - 0.5) * 1.5) * 4);
      if (leaf > 0) px(g, t & 1 ? b : a, x, y + 1, 1, leaf);
      if (leaf > 1 && t & 1) px(g, tip, x, y + leaf, 1, 1);
      px(g, spine, x, y);
    }
  }

  function palm(g: G, ox: number, oy: number, tall: boolean): void {
    const cx = ox + 12, crown = tall ? oy - 8 : oy - 2;
    groundShadow(g, cx - 2, oy + 21.5, 7, 2.5);
    sprite(g, ox + 6, oy + 13, POT, { h: BRASS[5], b: BRASS[3], d: BRASS[1], k: BRASS[0] });
    // the trunk, ringed
    for (let y = crown + 2; y < oy + 15; y++) {
      px(g, WOOD[2], cx - 1, y, 3, 1);
      px(g, (y & 3) === 0 ? WOOD[1] : WOOD[4], cx, y, 1, 1);
    }
    // far fronds first, darker, then the near ones over them
    frond(g, cx - 1, crown + 2, -1, 12, 5, 8, true);
    frond(g, cx + 1, crown + 2, 1, 12, 5, 8, true);
    frond(g, cx - 1, crown + 4, -1, 11, 1, 10);
    frond(g, cx + 1, crown + 4, 1, 11, 1, 10);
    frond(g, cx - 1, crown + 1, -1, 9, 9, 6);
    frond(g, cx + 1, crown + 1, 1, 9, 9, 6);
    // the young frond standing straight up
    px(g, LEAF[2], cx - 1, crown - 7, 3, 9);
    px(g, LEAF[5], cx, crown - 9, 1, 11);
    px(g, LEAF[3], cx - 2, crown - 4, 1, 4);
    px(g, LEAF[3], cx + 2, crown - 5, 1, 4);
  }

  return {
    shelf: [WOOD[0], WOOD[2], WOOD[4], WOOD[6]],
    recess: [some(STEEL[0]), some(STEEL[1]), some(STEEL[2]), some(STEEL[4])],
    metal: [STEEL[1], STEEL[3], STEEL[5], STEEL[6], STEEL[8]],
    paint: BRASS[3],

    floor(g) {
      for (let ty = 2; ty < 8; ty++) {
        for (let tx = 1; tx < 19; tx++) {
          const x = tx * T, y = ty * T;
          px(g, (tx + ty) & 1 ? STONE[2] : STONE[1], x, y, T, T);
          // terrazzo chips, each two pixels long so none is a stray dot
          for (let i = 0; i < 5; i++) {
            const cx = x + 2 + Math.floor(hash(tx, ty, i * 2) * 19), cy = y + 2 + Math.floor(hash(tx, ty, i * 2 + 1) * 20);
            px(g, hash(tx * 7 + i, ty, 5) < 0.5 ? CHIP[0] : CHIP[1], cx, cy, 2, 1);
          }
          // polish: a streak of light across some slabs
          if (hash(tx, ty, 40) > 0.72) {
            const sx = x + 4 + Math.floor(hash(tx, ty, 41) * 8), sy = y + 12 + Math.floor(hash(tx, ty, 42) * 7);
            for (let i = 0; i < 6; i++) px(g, CHIP[1], sx + i, sy - i, 2, 1);
          }
          px(g, STONE[0], x, y, T, 1);
          px(g, STONE[0], x, y, 1, T);
        }
      }
      // a dark stone inset wherever four slabs meet
      for (let ty = 3; ty < 8; ty++) for (let tx = 2; tx < 19; tx++) sprite(g, tx * T - 2, ty * T - 2, INSET, { a: LIV[1], b: LIV[2], c: BRASS[4] });

      // the company's compass, set into the middle of the floor
      const cx = 252, cy = 132;
      oval(g, BRASS[1], cx, cy, 23, 23);
      oval(g, BRASS[4], cx, cy, 22, 22);
      oval(g, LIV[1], cx, cy, 20.5, 20.5);
      oval(g, LIV[2], cx, cy, 19.5, 19.5);
      oval(g, BRASS[3], cx, cy, 16, 16);
      oval(g, STONE[3], cx, cy, 15, 15);
      for (let d = 0; d < 14; d++) {
        const w = Math.max(1, Math.round((14 - d) / 4));
        // the four long points, each lit on one side
        px(g, LIV[4], cx - w, cy - d - 1, w, 1);
        px(g, LIV[1], cx, cy - d - 1, w, 1);
        px(g, LIV[4], cx - w, cy + d, w, 1);
        px(g, LIV[1], cx, cy + d, w, 1);
        px(g, LIV[4], cx - d - 1, cy - w, 1, w);
        px(g, LIV[1], cx - d - 1, cy, 1, w);
        px(g, LIV[4], cx + d, cy - w, 1, w);
        px(g, LIV[1], cx + d, cy, 1, w);
      }
      for (let d = 2; d < 8; d++) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) px(g, BRASS[3], cx + (sx > 0 ? d : -d - 1), cy + (sy > 0 ? d : -d - 1));
      oval(g, BRASS[4], cx, cy, 2, 2);
    },

    mat(g, cx, kind) {
      // a slab of coloured stone let into the floor, edged in brass
      const s = SERVICE[kind], icon = ICONS[kind], stone = mix(STONE[2], s.mid, 0.55);
      px(g, BRASS[2], cx - 12, 76, 24, 13);
      px(g, BRASS[4], cx - 12, 76, 24, 1);
      px(g, stone, cx - 11, 77, 22, 11);
      px(g, mix(stone, STONE[3], 0.4), cx - 11, 77, 22, 1);
      sprite(g, cx - Math.floor(icon[0].length / 2), 79, icon, { '#': s.dark });
    },

    cap(g, x, y, w, h, lip) {
      px(g, CAP[1], x, y, w, h);
      if (h <= 4) {
        px(g, CAP[2], x, y + 1, w, 1);
        px(g, CAP[0], x, y + h - 1, w, 1);
        return;
      }
      // a run of trunking down the middle of the wall top, with a lamp let into it every other tile
      const along = lip === 'n' || lip === 's';
      if (along) {
        px(g, CAP[2], x, y + 10, w, 3);
        px(g, CAP[3], x, y + 10, w, 1);
        for (let lx = Math.ceil(x / 48) * 48 + 23; lx < x + w - 2; lx += 48) px(g, BRASS[3], lx, y + 11, 3, 1);
      } else {
        px(g, CAP[2], x + 10, y, 3, h);
        px(g, CAP[3], x + 12, y, 1, h);
        for (let ly = Math.ceil(y / 48) * 48 + 23; ly < y + h - 2; ly += 48) px(g, BRASS[3], x + 11, ly, 1, 3);
      }
      capEdges(g, CAP, x, y, w, h, lip);
    },

    wall(g, x, w, foot) {
      const top = foot - 44;
      px(g, PANEL[2], x, top, w, 44);
      px(g, PANEL[4], x, top, w, 1);
      px(g, PANEL[3], x, top + 1, w, 1);
      px(g, PANEL[0], x, top + 2, w, 1);
      px(g, PANEL[1], x, top + 3, w, 2);
      for (let sx = Math.ceil(x / T) * T; sx < x + w; sx += T) {
        px(g, PANEL[1], sx, top + 3, 1, 27);
        px(g, PANEL[3], sx + 1, top + 5, 1, 25);
      }
      // the brass rail
      px(g, BRASS[5], x, top + 30, w, 1);
      px(g, BRASS[3], x, top + 31, w, 1);
      px(g, BRASS[1], x, top + 32, w, 1);
      // wainscot in the company's colour, panelled
      px(g, LIV[2], x, top + 33, w, 8);
      px(g, LIV[3], x, top + 33, w, 1);
      for (let sx = Math.floor(x / T) * T; sx < x + w; sx += T) {
        px(g, LIV[1], sx + 3, top + 35, 18, 5);
        px(g, LIV[2], sx + 4, top + 36, 17, 4);
        px(g, LIV[3], sx + 4, top + 39, 17, 1);
      }
      px(g, STEEL[1], x, top + 41, w, 3);
      px(g, STEEL[3], x, top + 41, w, 1);
    },

    dress(g) {
      // one long window, brass-framed
      const wx = 146, wy = 8, ww = 92, wh = 26;
      px(g, BRASS[3], wx, wy, ww, wh);
      px(g, BRASS[5], wx, wy, ww, 1);
      px(g, BRASS[1], wx + 1, wy + 1, ww - 2, wh - 2);
      sky(g, wx + 2, wy + 2, ww - 4, wh - 4, 11 + look);
      globe(g, wx + 2, wy + 2, ww - 4, wh - 4, wx + 64, wy + 54, 38, [PAL.night[1], LIV[0], LIV[1], LIV[2], LIV[4], LIV[6]]);
      glints(g, wx + 2, wy + 2, ww - 4, wh - 4, PAL.night[5], [14, 17, 52, 80]);
      for (const mx of [wx + 23, wx + 45, wx + 67]) {
        px(g, BRASS[1], mx, wy + 1, 1, wh - 2);
        px(g, BRASS[4], mx + 1, wy + 1, 1, wh - 2);
      }
      // a sconce either side of it
      for (const cx of [132, 252]) {
        glow(g, cx, 16, 13, 14, BRASS[5], 0.55);
        sprite(g, cx - 4, 15, SCONCE, { y: BRASS[6], h: BRASS[5], b: BRASS[3], d: BRASS[1] });
      }
      // the pillar's clock
      oval(g, BRASS[1], 108, 44, 7, 7);
      oval(g, BRASS[4], 108, 43.5, 6.5, 6.5);
      oval(g, PAL.bone[6], 108, 43.5, 5, 5);
      px(g, PAL.bone[4], 104, 46, 8, 1);
      for (const [dx, dy, w, h] of [[-1, -5, 2, 1], [-1, 3, 2, 1], [-5, -1, 1, 2], [4, -1, 1, 2]]) px(g, STEEL[2], 108 + dx, 43 + dy, w, h);
      px(g, INK, 108, 40, 1, 4);
      px(g, INK, 108, 43, 3, 1);
      px(g, BRASS[3], 101, 54, 14, 3);
      px(g, BRASS[5], 101, 54, 14, 1);

      // the departures board
      const { x, y, w, h } = BOARD;
      px(g, BRASS[1], x, y, w, h);
      px(g, BRASS[4], x, y, w, 1);
      px(g, BRASS[3], x + 1, y + 1, w - 2, 1);
      px(g, PAL.phosphor[0], x + 2, y + 2, w - 4, h - 4);
      text(g, 'DEPARTURES', x + 3, y + 3, PAL.phosphor[3]);
      px(g, PAL.phosphor[2], x + 3, y + 9, w - 6, 1);
      for (let r = 0; r < 2; r++) text(g, SAILINGS[r], x + 3, y + 11 + r * 6, PAL.phosphor[4]);
    },

    counter(g, x0, openLeft, openRight) {
      // a marble top, veined, with a brass nosing
      px(g, MARBLE[2], x0, COUNTER_TOP, 72, 21);
      px(g, MARBLE[0], x0, COUNTER_TOP, 72, 1);
      px(g, MARBLE[1], x0, COUNTER_TOP + 1, 72, 1);
      px(g, MARBLE[3], x0, COUNTER_FRONT - 5, 72, 3);
      for (let i = 0; i < 7; i++) {
        const vx = x0 + 3 + Math.floor(hash(x0, i, 20) * 60), vy = COUNTER_TOP + 3 + Math.floor(hash(x0, i, 21) * 11);
        for (let s = 0; s < 4; s++) px(g, MARBLE[1], vx + s * 2, vy + s, 2, 1);
      }
      px(g, BRASS[5], x0, COUNTER_FRONT - 2, 72, 1);
      px(g, BRASS[3], x0, COUNTER_FRONT - 1, 72, 1);
      // a dark timber front in three panels, with a foot rail
      px(g, WOOD[2], x0, COUNTER_FRONT, 72, 18);
      px(g, WOOD[0], x0, COUNTER_FRONT, 72, 1);
      for (let p = 0; p < 3; p++) {
        const bx = x0 + p * 24;
        px(g, WOOD[1], bx + 3, COUNTER_FRONT + 2, 18, 10);
        px(g, WOOD[3], bx + 4, COUNTER_FRONT + 3, 17, 9);
        px(g, WOOD[4], bx + 4, COUNTER_FRONT + 11, 17, 1);
        px(g, WOOD[4], bx + 20, COUNTER_FRONT + 3, 1, 8);
      }
      px(g, BRASS[5], x0 + 1, COUNTER_FRONT + 13, 70, 1);
      px(g, BRASS[2], x0 + 1, COUNTER_FRONT + 14, 70, 1);
      for (let bx = x0 + 11; bx < x0 + 72; bx += 24) px(g, BRASS[1], bx, COUNTER_FRONT + 15, 2, 2);
      px(g, WOOD[0], x0, COUNTER_FRONT + 16, 72, 2);
      if (openLeft) px(g, WOOD[0], x0, COUNTER_FRONT, 1, 18);
      if (openRight) px(g, WOOD[4], x0 + 71, COUNTER_FRONT + 1, 1, 15);
    },

    sign(g, x0, kind, lit) {
      px(g, BRASS[1], x0 + 2, 0, 68, SIGN_H);
      px(g, BRASS[4], x0 + 2, 0, 68, 1);
      px(g, BRASS[3], x0 + 3, SIGN_H - 1, 66, 1);
      px(g, STEEL[0], x0 + 3, 1, 66, SIGN_H - 2);
      if (lit) signWords(g, x0, kind, SERVICE[kind].lit, SERVICE[kind].dark);
      else signWords(g, x0, kind, STEEL[2]);
    },

    table(g, ox, oy, n) {
      const cx = ox + 12;
      groundShadow(g, cx - 2, oy + 21.5, 8, 2.5);
      // the foot and stem, brass
      oval(g, BRASS[1], cx, oy + 21, 5.5, 2);
      oval(g, BRASS[3], cx, oy + 20.5, 4.5, 1.5);
      px(g, BRASS[1], cx - 1, oy + 5, 3, 15);
      px(g, BRASS[4], cx, oy + 5, 1, 15);
      px(g, BRASS[6], cx, oy + 8, 1, 3);
      // the top: a brass rim under white marble
      oval(g, BRASS[0], cx, oy + 3, 11, 5.5);
      oval(g, BRASS[3], cx, oy + 2, 11, 5.5);
      oval(g, MARBLE[1], cx, oy + 0.5, 11, 5.5);
      oval(g, MARBLE[2], cx, oy + 0.5, 10, 4.5);
      oval(g, MARBLE[3], cx + 2, oy - 0.5, 6, 2.5);
      if (n % 2 === 0) sprite(g, cx - 6 + (n & 2) * 3, oy - 3, CUP, { w: PAL.bone[6], k: WOOD[1], s: PAL.bone[4] });
      else {
        // a folded paper and a glass
        px(g, PAL.bone[4], cx - 6, oy - 1, 7, 3);
        px(g, PAL.bone[6], cx - 6, oy - 2, 7, 3);
        px(g, PAL.bone[3], cx - 5, oy - 1, 5, 1);
        px(g, PAL.teal[6], cx + 4, oy - 3, 2, 4);
        px(g, PAL.teal[4], cx + 4, oy, 2, 1);
      }
    },

    plant(g, ox, oy, _n, byWall) {
      palm(g, ox, oy, byWall);
    },

    live(g, time) {
      // the board: sailings move up the list, and the next one out blinks
      const { x, y } = BOARD, first = Math.floor(time / 9);
      for (let r = 0; r < 2; r++) {
        const n = first + r, mins = 12 + ((n * 37) % 47);
        const row = y + 11 + r * 6;
        px(g, PAL.phosphor[0], x + 2, row, 40, 5);
        text(g, SAILINGS[n % SAILINGS.length], x + 3, row, PAL.phosphor[4]);
        text(g, `${Math.floor(mins / 10)}${mins % 10}M`, x + 19, row, PAL.phosphor[r ? 3 : 4]);
        if (r || Math.floor(time * 2) % 2) px(g, r ? SIGNAL.amber : SIGNAL.green, x + 37, row + 1, 3, 3);
      }
    },
  };
}
