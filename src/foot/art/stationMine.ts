/**
 * A mining camp's dock, cut into the rock. Tread plate underfoot with dust walked in from the workings,
 * bare rock walls held by steel ribs, warning stripes, caged lamps, lockers with hard hats on top, cable
 * drums for tables and a cactus in an oil drum.
 */
import { INK, PAL } from '../../art/palette';
import { bay, fbm3 } from '../../flight/pixels';
import {
  COUNTER_FRONT, COUNTER_TOP, ICONS, SERVICE, SIGN_H, T,
  capEdges, glow, groundShadow, hash, hues, mix, oval, px, signWords, sky, sprite,
  type G, type Theme,
} from './stationKit';

const STEEL = PAL.steel, WOOD = PAL.wood, RUST = PAL.rust, BRASS = PAL.amber, LEAF = PAL.leaf, TEAL = PAL.teal;
/** Warning yellow. */
const HAZ: string = BRASS[4];

const CAGE_LAMP = ['...kkk...', '..kkkkk..', '.kyhyhyk.', '.khyhyhk.', '.kyhyhyk.', '.khyhyhk.', '..kkkkk..'];
const WARNING = [
  '......k......',
  '.....kyk.....',
  '....kyyyk....',
  '...kyykyyk...',
  '..kyyykyyyk..',
  '.kyyyykyyyyk.',
  'kyyyyykyyyyyk',
  '.kyyyyyyyyyk.',
  '..kyyykyyyk..',
  '...kyyyyyk...',
  '....kyyyk....',
  '.....kyk.....',
  '......k......',
];
const EXTINGUISHER = [
  '..kss..',
  '.kkkk..',
  '..rr.k.',
  '.rRrr.k',
  '.rRrr.k',
  '.rRrrk.',
  '.rwwr..',
  '.rRrr..',
  '.rRrr..',
  '.rRrr..',
  '.rRrr..',
  '.dddd..',
];
const HARD_HAT = ['...hhh...', '..hyyyy..', '.hyyyyyd.', '.yyyyyyd.', 'yyyyyyyyd', '.ddddddd.'];
const TIN_MUG = ['sss.', 'sdsh', 'sdsh', 'ddd.'];
const PAIL = ['..kkkk..', '.k....k.', 'ssssssss', 'sSSSSSSd', 'sSSSSSSd', 'sSSSSSSd', 'dddddddd'];

export function mine(look: number): Theme {
  // the camp's paint turns to greens, blues and ochres; the rock only leans
  const { all, faint } = hues(look, [40, 150, 190, 95, 215, 20]);
  const ROCK = ['#2c2423', '#3d2f2b', '#52403a', '#6b5248', '#876a5e', '#a08375'].map(faint);
  /** The camp's paint: lockers and the rails on the counters. */
  const COAT = RUST.map(all);
  /** Tread plate: seam, shadow, plate, tread, glint. */
  const PLATE = [STEEL[1], STEEL[2], mix(STEEL[2], STEEL[3], 0.75), STEEL[3], STEEL[4]];
  const DUST = mix(ROCK[4], PLATE[2], 0.35);

  /** Warning stripes filling a rectangle. */
  function stripes(g: G, x: number, y: number, w: number, h: number, a: string = HAZ, b: string = INK): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, ((x + i + y + j) >> 2) & 1 ? b : a, x + i, y + j);
  }

  /** Rock face, lit from above: ledges that face up are pale, overhangs dark. */
  function rock(g: G, x: number, y: number, w: number, h: number, seed: number): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const X = x + i, Y = y + j;
        // coarse lumps: the height is sampled on a two-pixel grid so faces come out as flat facets
        const qx = (X >> 1) / 7, qy = (Y >> 1) / 4;
        const n = fbm3(qx, qy, seed, 2), slope = fbm3(qx, qy + 0.45, seed, 2) - fbm3(qx, qy - 0.45, seed, 2);
        const t = 2.5 + (n - 0.5) * 2 + slope * 9;
        px(g, ROCK[Math.max(1, Math.min(5, Math.round(t)))], X, Y);
      }
    }
  }

  function rivets(g: G, x: number, y: number, w: number, step: number, c: string): void {
    for (let i = step >> 1; i < w; i += step) px(g, c, x + i, y);
  }

  function cactus(g: G, ox: number, oy: number): void {
    const cx = ox + 12;
    groundShadow(g, cx - 2, oy + 21.5, 8, 2.5);
    // the column and its two arms
    const limb = (x: number, top: number, bottom: number, w: number) => {
      px(g, LEAF[1], x, top + 1, w, bottom - top - 1);
      px(g, LEAF[1], x + 1, top, w - 2, 1);
      px(g, LEAF[2], x + 1, top + 1, w - 1, bottom - top - 1);
      px(g, LEAF[4], x + w - 2, top + 1, 1, bottom - top - 2);
      for (let y = top + 3; y < bottom - 1; y += 3) px(g, LEAF[5], x + 1, y);
    };
    px(g, LEAF[1], cx - 8, oy - 3, 6, 3);
    px(g, LEAF[2], cx - 7, oy - 3, 5, 2);
    limb(cx - 9, oy - 11, oy - 1, 4);
    px(g, LEAF[1], cx + 2, oy - 7, 6, 3);
    px(g, LEAF[2], cx + 2, oy - 7, 5, 2);
    limb(cx + 5, oy - 15, oy - 5, 4);
    limb(cx - 3, oy - 20, oy + 10, 6);
    px(g, RUST[7], cx - 1, oy - 21, 2, 2);
    px(g, RUST[5], cx + 1, oy - 20, 1, 1);
    drum(g, cx, oy + 8, 14, [TEAL[0], TEAL[1], TEAL[2], TEAL[4]]);
  }

  /** An oil drum (or the bottom of one) with earth in it. Its foot is at the bottom of the tile. */
  function drum(g: G, cx: number, y: number, h: number, [deep, dark, mid, light]: readonly string[]): void {
    px(g, dark, cx - 7, y + 1, 14, h - 1);
    px(g, mid, cx - 5, y + 1, 10, h - 1);
    px(g, light, cx + 2, y + 2, 2, h - 3);
    for (let ry = y + 5; ry < y + h - 2; ry += 5) {
      px(g, deep, cx - 7, ry, 14, 1);
      px(g, light, cx - 5, ry - 1, 10, 1);
    }
    px(g, deep, cx - 6, y + h, 12, 1);
    // the open top, full of earth
    oval(g, light, cx, y + 1, 7, 2.5);
    oval(g, WOOD[0], cx, y + 1, 6, 1.5);
  }

  function agave(g: G, ox: number, oy: number): void {
    const cx = ox + 12, by = oy + 13;
    groundShadow(g, cx - 2, oy + 21.5, 8, 2.5);
    // blades fan out from the heart, the far ones first
    for (const [ang, len] of [[-90, 20], [-118, 17], [-62, 17], [-145, 14], [-35, 14], [-168, 11], [-12, 11]]) {
      const a = (ang * Math.PI) / 180;
      for (let t = 0; t < len; t++) {
        const x = Math.round(cx + Math.cos(a) * t), y = Math.round(by + Math.sin(a) * t - (1 - Math.abs(Math.cos(a))) * 0), wide = t < len * 0.55 ? 3 : t < len * 0.85 ? 2 : 1;
        px(g, LEAF[1], x - 1, y, wide, 1);
        if (wide > 1) px(g, LEAF[3], x, y, wide - 1, 1);
        if (wide > 2 || t % 3 === 0) px(g, LEAF[5], x + wide - 2, y, 1, 1);
      }
    }
    drum(g, cx, oy + 12, 9, [COAT[0], COAT[2], COAT[3], COAT[5]]);
  }

  return {
    shelf: [STEEL[0], STEEL[2], STEEL[3], STEEL[5]],
    recess: [ROCK[0], ROCK[1], ROCK[2], ROCK[4]],
    metal: [STEEL[1], STEEL[2], STEEL[4], STEEL[5], STEEL[7]],
    paint: HAZ,

    floor(g) {
      const X0 = T, X1 = 456, Y0 = 48, Y1 = 192;
      px(g, PLATE[2], X0, Y0, X1 - X0, Y1 - Y0);
      // where boots go, the plate is polished paler
      const worn = (x: number, y: number) => fbm3(x / 60, y / 40, 9, 2) > 0.52;
      for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (worn(x, y) && bay(x, y) < 0.5) px(g, mix(PLATE[2], PLATE[3], 0.5), x, y);
      // the tread: raised bars, leaning one way then the other
      for (let ty = 0; ty * 8 < Y1 - Y0; ty++) {
        for (let tx = 0; tx * 8 < X1 - X0; tx++) {
          const x = X0 + tx * 8 + 2, y = Y0 + ty * 8 + 2, lean = (tx + ty) & 1;
          const faint = worn(x, y);
          for (let i = 0; i < 4; i++) {
            const bx = x + i, by = lean ? y + i : y + 3 - i;
            px(g, faint ? PLATE[3] : PLATE[4], bx, by);
            if (!faint) px(g, PLATE[1], bx, by + 1);
          }
        }
      }
      // sheets two tiles square, bolted at the corners
      for (let x = X0; x < X1; x += 48) {
        px(g, PLATE[0], x, Y0, 1, Y1 - Y0);
        px(g, PLATE[3], x + 1, Y0, 1, Y1 - Y0);
      }
      for (let y = Y0; y < Y1; y += 48) {
        px(g, PLATE[0], X0, y, X1 - X0, 1);
        px(g, PLATE[3], X0, y + 1, X1 - X0, 1);
      }
      for (let y = Y0; y < Y1; y += 48) {
        for (let x = X0; x < X1; x += 48) {
          for (const [dx, dy] of [[3, 3], [43, 3], [3, 43], [43, 43]]) {
            px(g, PLATE[0], x + dx, y + dy, 3, 3);
            px(g, STEEL[5], x + dx, y + dy, 2, 2);
            px(g, STEEL[7], x + dx + 1, y + dy, 1, 1);
          }
        }
      }
      // a drain
      px(g, PLATE[0], 270, 124, 18, 12);
      px(g, PLATE[3], 270, 135, 18, 1);
      px(g, STEEL[0], 271, 125, 16, 10);
      for (let i = 0; i < 16; i += 3) px(g, PLATE[2], 271 + i, 125, 2, 10);
      px(g, PLATE[1], 271, 129, 16, 2);
      // a warning strip along the wall with the airlock in it
      for (const [sx, sw] of [[X0, 190 - X0], [218, X1 - 218]]) {
        stripes(g, sx, 187, sw, 5);
        px(g, PLATE[0], sx, 186, sw, 1);
      }
      // dust: drifted against the back wall and into the corners, and walked in from the lock
      const drift = (x: number, y: number) => {
        const foot = x < 120 || (x >= 264 && x < 336) || x >= 384 ? 72 : 48;
        let d = Math.max(0, 1 - (y - foot) / (7 + fbm3(x / 14, 0, 3, 2) * 12));
        d = Math.max(d, 1 - (x - X0) / (5 + fbm3(0, y / 14, 4, 2) * 12), 1 - (X1 - x) / (5 + fbm3(1, y / 14, 5, 2) * 12));
        return d;
      };
      for (let y = Y0; y < 186; y++) {
        for (let x = X0; x < X1; x++) {
          const d = drift(x, y);
          if (d > 0 && d * 1.2 > bay(x, y)) px(g, d > 0.75 ? ROCK[4] : DUST, x, y);
        }
      }
    },

    mat(g, cx, kind) {
      // a box painted on the plate, and the counter's mark stencilled in it
      const s = SERVICE[kind], icon = ICONS[kind];
      for (let i = 0; i < 24; i++) {
        for (const y of [76, 77, 87, 88]) if (hash(cx + i, y, 70) > 0.2) px(g, HAZ, cx - 12 + i, y);
      }
      for (let j = 0; j < 13; j++) {
        for (const x of [cx - 12, cx - 11, cx + 10, cx + 11]) if (hash(x, j, 71) > 0.2) px(g, HAZ, x, 76 + j);
      }
      px(g, PLATE[1], cx - 10, 78, 20, 9);
      sprite(g, cx - Math.floor(icon[0].length / 2), 79, icon, { '#': s.lit });
    },

    cap(g, x, y, w, h, lip) {
      const CAP = [ROCK[0], ROCK[1], ROCK[2], STEEL[3]];
      px(g, CAP[1], x, y, w, h);
      if (h <= 4) {
        px(g, CAP[0], x, y + h - 1, w, 1);
        return;
      }
      // broken rock, in lumps
      for (let j = 0; j < h; j += 2) {
        for (let i = 0; i < w; i += 2) {
          const k = fbm3((x + i) / 12, (y + j) / 9, 2, 2);
          if (k < 0.42) px(g, CAP[0], x + i, y + j, 2, 2);
          else if (k > 0.6) px(g, CAP[2], x + i, y + j, 2, 2);
        }
      }
      capEdges(g, CAP, x, y, w, h, lip, false);
    },

    wall(g, x, w, foot) {
      const top = foot - 44;
      rock(g, x, top + 4, w, 26, 5);
      px(g, ROCK[0], x, top + 4, w, 1);
      px(g, ROCK[1], x, top + 5, w, 1);
      // a pipe run, bracketed to the rock
      px(g, RUST[1], x, top + 7, w, 4);
      px(g, RUST[3], x, top + 7, w, 3);
      px(g, RUST[5], x, top + 7, w, 1);
      for (let sx = Math.ceil(x / T) * T + 9; sx < x + w - 1; sx += T) {
        px(g, STEEL[1], sx, top + 6, 3, 6);
        px(g, STEEL[4], sx + 1, top + 6, 1, 5);
      }
      // the steel: a beam along the top, a rib every other tile
      px(g, STEEL[3], x, top, w, 4);
      px(g, STEEL[5], x, top, w, 1);
      px(g, STEEL[1], x, top + 3, w, 1);
      rivets(g, x, top + 2, w, 6, STEEL[6]);
      for (let sx = Math.ceil(x / 48) * 48; sx <= x + w; sx += 48) {
        const a = Math.max(x, sx - 2), b = Math.min(x + w, sx + 2);
        if (b <= a) continue;
        px(g, STEEL[2], a, top + 4, b - a, 26);
        if (sx + 1 < x + w) px(g, STEEL[4], sx + 1, top + 4, 1, 26);
        if (sx - 2 >= x) px(g, STEEL[1], sx - 2, top + 4, 1, 26);
        for (let ry = top + 7; ry < top + 30; ry += 6) if (sx < x + w) px(g, STEEL[6], sx, ry);
      }
      // warning stripes over a kick plate
      stripes(g, x, top + 30, w, 4);
      px(g, STEEL[3], x, top + 34, w, 7);
      px(g, STEEL[5], x, top + 34, w, 1);
      px(g, STEEL[2], x, top + 40, w, 1);
      rivets(g, x, top + 36, w, 8, STEEL[5]);
      for (let i = 0; i < w / 10; i++) px(g, STEEL[2], x + Math.floor(hash(x, i, 14) * (w - 5)), top + 37 + Math.floor(hash(x, i, 15) * 3), 4, 1);
      px(g, STEEL[1], x, top + 41, w, 3);
    },

    dress(g) {
      // four ports, heavy-framed, onto the rock field
      for (let tx = 6; tx < 10; tx++) sky(g, tx * T + 5, 12, 14, 17, 51 + look + tx);
      for (const [ax, ay, r] of [[158, 19, 4], [184, 23, 6.5], [231, 16, 4.5], [206, 26, 3.5], [213, 15, 2]]) {
        oval(g, ROCK[1], ax, ay, r, r * 0.85);
        oval(g, ROCK[3], ax + r * 0.2, ay - r * 0.2, r * 0.75, r * 0.6);
        oval(g, ROCK[5], ax + r * 0.4, ay - r * 0.4, r * 0.35, r * 0.25);
        px(g, ROCK[1], Math.round(ax - r * 0.2), Math.round(ay), 1, 1);
      }
      for (let tx = 6; tx < 10; tx++) {
        const fx = tx * T + 2, fy = 9;
        // the frame is drawn as a ring so the view shows through
        for (let j = 0; j < 23; j++) {
          for (let i = 0; i < 20; i++) {
            const ex = Math.min(i, 19 - i), ey = Math.min(j, 22 - j);
            if (ex + ey < 2) continue;
            const inner = ex >= 3 && ey >= 3 && ex + ey > 7;
            if (inner) continue;
            const rim = ex + ey === 2 || ex === 0 || ey === 0, reveal = (ex === 3 || ey === 3 || ex + ey === 7) && ex >= 2 && ey >= 2;
            px(g, reveal ? STEEL[0] : rim ? (j < 11 ? STEEL[5] : STEEL[2]) : STEEL[3], fx + i, fy + j);
          }
        }
        for (const [dx, dy] of [[9, 1], [9, 21], [1, 11], [18, 11], [4, 2], [15, 2], [4, 20], [15, 20]]) px(g, STEEL[7], fx + dx, fy + dy);
      }
      // a caged lamp either side
      for (const cx of [132, 252]) {
        glow(g, cx, 18, 11, 10, HAZ, 0.3);
        px(g, INK, cx, 14, 1, 2);
        sprite(g, cx - 4, 15, CAGE_LAMP, { k: STEEL[1], y: BRASS[5], h: BRASS[6] });
      }
      // the pillar: a warning, a beacon and the extinguisher
      sprite(g, 102, 37, WARNING, { k: INK, y: HAZ });
      px(g, STEEL[1], 105, 54, 2, 12);
      sprite(g, 106, 54, EXTINGUISHER, { k: INK, s: STEEL[6], r: RUST[3], R: RUST[5], w: PAL.bone[6], d: RUST[1] });

      // lockers, with the shift's hard hats on top
      for (let i = 0; i < 4; i++) {
        const lx = 340 + i * 10, odd = i === 2;
        const [edge, body, lit, dark] = odd ? [TEAL[0], TEAL[2], TEAL[4], TEAL[1]] : [COAT[1], COAT[4], COAT[6], COAT[2]];
        px(g, edge, lx, 13, 10, 34);
        px(g, body, lx + 1, 14, 8, 32);
        px(g, lit, lx + 1, 14, 8, 1);
        px(g, lit, lx + 8, 15, 1, 30);
        px(g, dark, lx + 1, 15, 1, 31);
        for (const vy of [17, 19, 21]) px(g, dark, lx + 3, vy, 5, 1);
        px(g, PAL.bone[5], lx + 3, 25, 4, 3);
        px(g, PAL.bone[2], lx + 4, 26, 2, 1);
        px(g, STEEL[7], lx + 7, 30, 1, 4);
        px(g, dark, lx + 3, 40, 5, 1);
        px(g, dark, lx + 3, 42, 5, 1);
      }
      px(g, INK, 340, 47, 40, 1);
      // a dent and a sticker
      px(g, COAT[2], 344, 34, 3, 2);
      px(g, HAZ, 353, 34, 3, 3);
      sprite(g, 340, 7, HARD_HAT, { y: HAZ, h: BRASS[6], d: BRASS[2] });
      sprite(g, 351, 7, HARD_HAT, { y: HAZ, h: BRASS[6], d: BRASS[2] });
      sprite(g, 368, 7, HARD_HAT, { y: PAL.bone[5], h: PAL.bone[6], d: PAL.bone[3] });
    },

    counter(g, x0, openLeft, openRight) {
      // a steel bench top, scratched, with a warning edge
      px(g, STEEL[5], x0, COUNTER_TOP, 72, 21);
      px(g, STEEL[3], x0, COUNTER_TOP, 72, 1);
      px(g, STEEL[4], x0, COUNTER_TOP + 1, 72, 1);
      for (let i = 0; i < 10; i++) {
        const sx = x0 + 2 + Math.floor(hash(x0, i, 26) * 62), sy = COUNTER_TOP + 3 + Math.floor(hash(x0, i, 27) * 12);
        for (let s = 0; s < 3; s++) px(g, i % 3 ? STEEL[6] : STEEL[4], sx + s * 2, sy + (i & 1 ? s : 2 - s), 2, 1);
      }
      px(g, STEEL[6], x0, COUNTER_FRONT - 5, 72, 2);
      stripes(g, x0, COUNTER_FRONT - 3, 72, 3);
      // a corrugated front under a painted angle iron
      for (let i = 0; i < 72; i++) px(g, [STEEL[4], STEEL[3], STEEL[2], STEEL[3]][i & 3], x0 + i, COUNTER_FRONT, 1, 16);
      px(g, COAT[2], x0, COUNTER_FRONT, 72, 4);
      px(g, COAT[4], x0, COUNTER_FRONT + 1, 72, 2);
      px(g, COAT[6], x0, COUNTER_FRONT + 1, 72, 1);
      px(g, INK, x0, COUNTER_FRONT, 72, 1);
      rivets(g, x0, COUNTER_FRONT + 2, 72, 8, STEEL[7]);
      px(g, STEEL[1], x0, COUNTER_FRONT + 4, 72, 1);
      px(g, STEEL[1], x0, COUNTER_FRONT + 15, 72, 3);
      px(g, STEEL[2], x0, COUNTER_FRONT + 15, 72, 1);
      if (openLeft) px(g, STEEL[1], x0, COUNTER_FRONT, 1, 18);
      if (openRight) px(g, STEEL[5], x0 + 71, COUNTER_FRONT + 4, 1, 11);
    },

    sign(g, x0, kind, lit) {
      // a steel plate with warning ends, the name stencilled on
      px(g, STEEL[0], x0 + 2, 0, 68, SIGN_H);
      px(g, STEEL[2], x0 + 3, 1, 66, SIGN_H - 2);
      px(g, STEEL[3], x0 + 3, 1, 66, 1);
      stripes(g, x0 + 3, 1, 8, SIGN_H - 2, lit ? HAZ : STEEL[4], STEEL[0]);
      stripes(g, x0 + 61, 1, 8, SIGN_H - 2, lit ? HAZ : STEEL[4], STEEL[0]);
      for (const nx of [12, 59]) for (const ny of [2, 8]) px(g, STEEL[5], x0 + nx, ny);
      if (lit) signWords(g, x0, kind, SERVICE[kind].lit, STEEL[0]);
      else signWords(g, x0, kind, STEEL[3]);
    },

    table(g, ox, oy, n) {
      // a cable drum on its side
      const cx = ox + 12;
      groundShadow(g, cx - 2, oy + 21.5, 9, 2.5);
      oval(g, WOOD[0], cx, oy + 20.5, 10.5, 3);
      oval(g, WOOD[3], cx, oy + 19.5, 10.5, 3);
      px(g, WOOD[1], cx - 6, oy + 6, 12, 13);
      for (let sx = -5; sx < 6; sx += 3) px(g, sx > 0 ? WOOD[5] : WOOD[3], cx + sx, oy + 6, 2, 13);
      // a few turns of cable still on it
      px(g, STEEL[0], cx - 7, oy + 10, 14, 6);
      for (let y = 10; y < 16; y += 2) px(g, STEEL[2], cx - 6, oy + y, 12, 1);
      px(g, STEEL[4], cx + 2, oy + 10, 3, 1);
      oval(g, WOOD[1], cx, oy + 5, 11.5, 5.5);
      oval(g, WOOD[3], cx, oy + 4, 11.5, 5.5);
      oval(g, WOOD[5], cx, oy + 2, 11.5, 5.5);
      oval(g, WOOD[6], cx + 2, oy + 1, 7.5, 3);
      px(g, WOOD[4], cx - 10, oy + 2, 20, 1);
      px(g, WOOD[4], cx - 8, oy + 5, 16, 1);
      px(g, WOOD[4], cx - 8, oy - 1, 16, 1);
      oval(g, STEEL[1], cx, oy + 2, 2.5, 1.5);
      px(g, STEEL[6], cx, oy + 1, 1, 1);
      for (const [dx, dy] of [[-7, 2], [6, 2], [-1, -2], [-1, 6]]) px(g, STEEL[2], cx + dx, oy + dy, 2, 1);
      if (n === 0) {
        sprite(g, cx - 9, oy - 4, HARD_HAT, { y: HAZ, h: BRASS[6], d: BRASS[2] });
        sprite(g, cx + 4, oy + 1, TIN_MUG, { s: STEEL[7], d: STEEL[4], h: STEEL[5] });
      } else if (n === 1) sprite(g, cx - 4, oy - 4, PAIL, { k: STEEL[2], s: STEEL[7], S: STEEL[5], d: STEEL[3] });
      else if (n === 2) {
        sprite(g, cx - 7, oy - 1, TIN_MUG, { s: STEEL[7], d: STEEL[4], h: STEEL[5] });
        sprite(g, cx + 2, oy, TIN_MUG, { s: STEEL[7], d: STEEL[4], h: STEEL[5] });
      } else {
        // a hand of cards, face down
        px(g, PAL.bone[6], cx - 6, oy - 1, 4, 3);
        px(g, RUST[4], cx - 5, oy, 2, 1);
        px(g, PAL.bone[6], cx + 2, oy + 3, 4, 3);
        px(g, RUST[4], cx + 3, oy + 4, 2, 1);
        sprite(g, cx + 4, oy - 2, TIN_MUG, { s: STEEL[7], d: STEEL[4], h: STEEL[5] });
      }
    },

    plant(g, ox, oy, _n, byWall) {
      if (byWall) cactus(g, ox, oy);
      else agave(g, ox, oy);
    },

    light(x, y) {
      // each caged lamp throws a pool on the plate
      let v = 0;
      for (const cx of [132, 252]) {
        const dx = (x - cx) / 32, dy = (y - 54) / 20, d = dx * dx + dy * dy;
        if (d < 1) v += (1 - d) * 1.5;
      }
      return v - 0.35;
    },

    live(g, time) {
      // the beacon on the pillar turns
      const k = Math.floor(time * 4) % 4;
      px(g, STEEL[1], 106, 31, 5, 1);
      px(g, k === 0 ? BRASS[6] : k === 2 ? BRASS[1] : BRASS[3], 106, 28, 5, 3);
      if (k === 0) {
        px(g, BRASS[5], 105, 29, 1, 1);
        px(g, BRASS[5], 111, 29, 1, 1);
        px(g, BRASS[5], 108, 27, 1, 1);
      } else px(g, BRASS[k === 2 ? 3 : 5], 106 + (k === 1 ? 3 : 1), 29, 1, 1);
      // and one of the lamps has a loose wire
      const blink = (time * 1.3) % 7;
      if (blink > 6.7 || (blink > 6.2 && blink < 6.35)) {
        for (let j = 0; j < 4; j++) px(g, BRASS[2], 249, 17 + j, 7, 1);
      }
    },
  };
}
