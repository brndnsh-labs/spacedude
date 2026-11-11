/**
 * A relay station: a lonely repeater with a bar attached. Dim and violet, lit by neon. The broker works
 * out of the bar, with the bottles and the mirror behind; there is worn carpet, a jukebox, a sign in the
 * window and a candle on every table.
 */
import { PAL } from '../../art/palette';
import { bay, fbm3 } from '../../flight/pixels';
import {
  COUNTER_FRONT, COUNTER_TOP, ICONS, SERVICE, SHADOW, SHADOW_SOFT, SHELF_Y, SIGN_H, T,
  bold, capEdges, glints, globe, glow, groundShadow, hash, hues, mix, oval, px, signWords, sky, sprite,
  type G, type Service, type Theme,
} from './stationKit';

const STEEL = PAL.steel, WOOD = PAL.wood, RUST = PAL.rust, BRASS = PAL.amber, LEAF = PAL.leaf, TEAL = PAL.teal, VIOLET = PAL.violet;

const COCKTAIL = ['bbbbbbbbbbb', '.b.......b.', '..b..a..b..', '...b...b...', '....b.b....', '.....b.....', '.....b.....', '.....b.....', '.....b.....', '...bbbbb...'];
const NOTE = ['...aaaaaa', '...aaaaaa', '...a....a', '...a....a', '...a....a', '...a....a', '.aaa..aaa', 'aaaa.aaaa', 'aaaa.aaaa', '.aa...aa.'];
const GLASS = ['g.g', 'ggg', '.g.', 'ggg'];

/** The jukebox: its top-left corner and size. */
const JUKE = { x: 348, y: 11, w: 24, h: 37 };
/** Where the candles on the four tables burn, relative to a table's tile. */
const FLAME = { dx: 11, dy: -6 };
const TABLES = [[2, 4], [5, 4], [2, 6], [5, 6]] as const;
/** The sign in the window. */
const BAR = { x: 207, y: 15 };

export function relay(look: number): Theme {
  // a relay stays in the dusk colours: its carpet and neon turn only as far as blue one way and crimson the other
  const { all, some } = hues(look, [-40, 35, -70, 60, -20, 80]);
  const WALL = [VIOLET[0], VIOLET[1], VIOLET[2], VIOLET[3], VIOLET[4]].map(some);
  /** Two colours of neon, each dim, lit, bright, core. */
  const PINK = [VIOLET[3], VIOLET[5], VIOLET[6], VIOLET[7]].map(all);
  const AQUA = [TEAL[2], TEAL[4], TEAL[5], TEAL[6]].map(all);
  /** The carpet: shadow, pile, the lattice woven into it, its flowers, and two depths of wear. */
  const CARPET = ['#2a2040', '#372a4d', '#463760', '#6b2e3c', '#51476a', '#655c7c'].map(all);
  const BOTTLES = [
    [TEAL[1], TEAL[3], TEAL[5]], [BRASS[1], BRASS[3], BRASS[5]], [RUST[2], RUST[4], RUST[6]],
    [LEAF[1], LEAF[3], LEAF[5]], [VIOLET[3], VIOLET[5], VIOLET[7]], [PAL.bone[2], PAL.bone[4], PAL.bone[6]],
  ] as const;

  /** A neon tube in a sprite's shape, with its halo on whatever is behind it. */
  function neon(g: G, x: number, y: number, rows: readonly string[], pal: Record<string, readonly string[]>): void {
    const lit: Record<string, string> = {};
    for (const k in pal) lit[k] = pal[k][2];
    sprite(g, x, y, rows, lit);
  }

  function bottle(g: G, x: number, base: number, h: number, [dark, mid, light]: readonly string[]): void {
    px(g, mid, x, base - h + 2, 3, h - 2);
    px(g, dark, x + 2, base - h + 2, 1, h - 2);
    px(g, light, x, base - h + 3, 1, 2);
    px(g, mid, x + 1, base - h, 1, 2);
    px(g, PAL.bone[4], x + 1, base - h, 1, 1);
  }

  /** The jukebox with its tubes in one of three colourings. */
  function jukebox(g: G, x: number, y: number, k: number): void {
    const cx = x + 12, tubes = [PINK, [BRASS[2], BRASS[3], BRASS[4], BRASS[6]], AQUA];
    const outer = tubes[k % 3], inner = tubes[(k + 1) % 3];
    // cabinet: an arched top on a square body
    oval(g, WOOD[0], cx, y + 12, 12, 12);
    px(g, WOOD[0], x, y + 12, 24, 25);
    oval(g, outer[1], cx, y + 12, 11, 11);
    px(g, outer[1], x + 1, y + 12, 22, 12);
    oval(g, outer[3], cx, y + 12, 10, 10);
    px(g, outer[3], x + 2, y + 12, 1, 12);
    px(g, outer[3], x + 21, y + 12, 1, 12);
    oval(g, inner[1], cx, y + 12, 9, 9);
    px(g, inner[1], x + 3, y + 12, 18, 12);
    oval(g, inner[2], cx, y + 12, 8, 8);
    oval(g, WOOD[1], cx, y + 12, 7, 7);
    px(g, WOOD[1], x + 5, y + 12, 14, 12);
    // the record on show
    px(g, WOOD[0], x + 6, y + 8, 12, 9);
    oval(g, PAL.night[0], cx, y + 12.5, 5, 3.5);
    oval(g, STEEL[1], cx, y + 12.5, 3.5, 2.5);
    oval(g, RUST[5], cx, y + 12.5, 1.5, 1);
    px(g, STEEL[5], x + 14, y + 11, 2, 1);
    // the selector strip
    px(g, PAL.bone[5], x + 5, y + 18, 14, 3);
    px(g, PAL.bone[3], x + 5, y + 20, 14, 1);
    for (let i = 0; i < 6; i++) px(g, [RUST[5], TEAL[3], BRASS[3]][i % 3], x + 6 + i * 2, y + 19, 1, 1);
    // the speaker cloth, behind chrome bars
    px(g, WOOD[0], x + 1, y + 24, 22, 11);
    px(g, BRASS[1], x + 3, y + 25, 18, 9);
    for (let j = 0; j < 9; j++) for (let i = 0; i < 18; i++) if ((i + j) % 4 === 0 || (i - j + 16) % 4 === 0) px(g, BRASS[0], x + 3 + i, y + 25 + j);
    for (const bx of [7, 12, 16]) {
      px(g, STEEL[6], x + bx, y + 25, 1, 9);
      px(g, STEEL[3], x + bx + 1, y + 25, 1, 9);
    }
    px(g, STEEL[5], x + 2, y + 24, 20, 1);
    px(g, WOOD[2], x, y + 35, 24, 2);
    px(g, PAL.night[1], x, y + 36, 24, 1);
  }

  const jukeFrames = [0, 1, 2].map(k => {
    const cv = document.createElement('canvas');
    cv.width = JUKE.w;
    cv.height = JUKE.h;
    jukebox(cv.getContext('2d')!, 0, 0, k);
    return cv;
  });

  /** A snake plant: stiff banded blades standing out of a glazed pot. They need no light, which is as well. */
  function snakePlant(g: G, ox: number, oy: number, tall: boolean): void {
    const cx = ox + 12, k = tall ? 1.3 : 1;
    groundShadow(g, cx - 2, oy + 21.5, 7, 2.5);
    for (const [dx, h, lean] of [[-6, 13, -5], [6, 15, 5], [-4, 20, -3], [4, 22, 3], [-1, 25, -1], [2, 27, 1]]) {
      const H = Math.round(h * k);
      for (let t = 0; t < H; t++) {
        const u = t / H, x = Math.round(cx + dx + lean * u * u), y = oy + 14 - t, w = u > 0.88 ? 1 : u > 0.66 ? 2 : 3;
        px(g, LEAF[1], x - 1, y, w, 1);
        if (w > 1) px(g, t % 4 === 1 ? LEAF[1] : LEAF[2], x, y, w - 1, 1);
        if (w > 2 || (w === 2 && t % 4 !== 1)) px(g, t % 4 === 1 ? LEAF[3] : LEAF[4], x + w - 2, y, 1, 1);
      }
    }
    // the pot, catching both colours of neon
    px(g, WALL[0], cx - 6, oy + 13, 12, 9);
    px(g, WALL[2], cx - 5, oy + 13, 10, 8);
    px(g, WALL[3], cx - 6, oy + 13, 12, 2);
    px(g, WALL[4], cx - 6, oy + 13, 12, 1);
    px(g, AQUA[1], cx + 2, oy + 16, 1, 4);
    px(g, PINK[1], cx - 4, oy + 16, 1, 3);
    px(g, PAL.night[0], cx - 5, oy + 21, 10, 1);
  }

  return {
    shelf: [WOOD[0], WOOD[1], WOOD[2], WOOD[4]],
    recess: [WALL[0], WALL[1], WALL[2], WALL[3]],
    metal: [STEEL[0], STEEL[1], STEEL[3], STEEL[4], STEEL[6]],
    paint: mix(CARPET[1], BRASS[3], 0.55),

    floor(g) {
      const X0 = T, X1 = 456, Y0 = 48, Y1 = 192;
      // how worn the carpet is: along the way in from the airlock, and along the counters
      const wear = (x: number, y: number) => {
        const lane = Math.max(1 - Math.abs(x - 204) / 20, 0) * (y > 84 ? 1 : 0);
        const front = Math.max(1 - Math.abs(y - 86) / 16, 0) * (x > 30 ? 1 : 0);
        return Math.max(lane, front) * (0.55 + fbm3(x / 16, y / 12, 7, 2) * 0.9);
      };
      for (let y = Y0; y < Y1; y++) {
        for (let x = X0; x < X1; x++) {
          const u = (x + y) & 15, v = (x - y) & 15, w = wear(x, y);
          let c = u === 0 || v === 0 ? CARPET[2] : CARPET[1];
          // a little flower in every diamond
          const fx = (x + 8) & 15, fy = y & 15, gx = x & 15, gy = (y + 8) & 15;
          if ((fx === 8 && fy >= 7 && fy <= 9) || (fy === 8 && fx >= 7 && fx <= 9) || (gx === 8 && gy >= 7 && gy <= 9) || (gy === 8 && gx >= 7 && gx <= 9)) c = CARPET[3];
          // worn through to the weave: every other thread shows, then all of them
          if (w > 1.05) c = (x + y) & 1 ? CARPET[5] : CARPET[4];
          else if (w > 0.6 && (x + y) & 1 && !(u === 0 || v === 0)) c = CARPET[4];
          px(g, c, x, y);
        }
      }
      // a border band against the side walls and the wall with the airlock in it
      for (const [bx, by, bw, bh] of [[X0, Y0, 5, Y1 - Y0], [X1 - 5, Y0, 5, Y1 - Y0], [X0, Y1 - 5, X1 - X0, 5]]) px(g, CARPET[0], bx, by, bw, bh);
      px(g, BRASS[1], X0 + 5, Y0, 1, Y1 - Y0 - 5);
      px(g, BRASS[1], X1 - 6, Y0, 1, Y1 - Y0 - 5);
      px(g, BRASS[1], X0 + 5, Y1 - 6, X1 - X0 - 10, 1);
    },

    mat(g, cx, kind) {
      // light falls here from the sign; under it, a ribbed rubber mat
      const s = SERVICE[kind], icon = ICONS[kind];
      glow(g, cx, 86, 38, 15, s.lit, 0.28);
      px(g, WALL[0], cx - 12, 76, 24, 13);
      px(g, WALL[2], cx - 11, 77, 22, 11);
      for (let j = 0; j < 11; j += 2) px(g, WALL[1], cx - 11, 77 + j, 22, 1);
      px(g, s.mid, cx - 11, 77, 22, 1);
      px(g, s.dark, cx - 11, 87, 22, 1);
      sprite(g, cx - Math.floor(icon[0].length / 2), 79, icon, { '#': s.lit });
    },

    cap(g, x, y, w, h, lip) {
      const CAP = [PAL.night[0], WALL[0], WALL[1], WALL[2]];
      px(g, CAP[1], x, y, w, h);
      if (h <= 4) {
        px(g, CAP[0], x, y + h - 1, w, 1);
        return;
      }
      // cable trays along the wall top, strapped down every tile
      const along = lip === 'n' || lip === 's';
      for (const off of [9, 13]) {
        if (along) px(g, off === 9 ? CAP[2] : CAP[0], x, y + off, w, 2);
        else px(g, off === 9 ? CAP[2] : CAP[0], x + off, y, 2, h);
      }
      if (along) for (let sx = Math.ceil(x / T) * T + 5; sx < x + w - 1; sx += T) px(g, CAP[3], sx, y + 8, 2, 8);
      else for (let sy = Math.ceil(y / T) * T + 5; sy < y + h - 1; sy += T) px(g, CAP[3], x + 8, sy, 8, 2);
      capEdges(g, CAP, x, y, w, h, lip);
    },

    wall(g, x, w, foot) {
      const top = foot - 44;
      // dark slatted panelling
      px(g, WALL[2], x, top, w, 44);
      for (let sx = x - (x % 8); sx < x + w; sx += 8) {
        if (sx >= x) px(g, WALL[1], sx, top + 3, 1, 25);
        if (sx + 1 >= x && sx + 1 < x + w) px(g, WALL[3], sx + 1, top + 8, 1, 20);
      }
      px(g, WALL[1], x, top + 3, w, 3);
      for (let i = 0; i < w; i++) if (bay(x + i, top + 6) < 0.5) px(g, WALL[1], x + i, top + 6);
      px(g, WALL[0], x, top, w, 3);
      px(g, WALL[3], x, top + 1, w, 1);
      // a neon tube along the rail, and its light on the wall either side
      px(g, mix(WALL[2], PINK[1], 0.3), x, top + 27, w, 1);
      px(g, mix(WALL[2], PINK[1], 0.55), x, top + 28, w, 1);
      px(g, WALL[0], x, top + 29, w, 3);
      px(g, PINK[2], x, top + 30, w, 1);
      for (let sx = Math.ceil(x / T) * T + 11; sx < x + w - 1; sx += T) px(g, WALL[3], sx, top + 29, 2, 3);
      // a buttoned, padded dado
      px(g, WALL[1], x, top + 32, w, 9);
      px(g, mix(WALL[1], PINK[1], 0.45), x, top + 32, w, 1);
      px(g, mix(WALL[1], PINK[1], 0.2), x, top + 33, w, 1);
      for (let j = 1; j < 9; j++) {
        for (let i = 0; i < w; i++) {
          const X = x + i, Y = top + 32 + j;
          if ((X + Y) % 8 === 0 || (X - Y + 800) % 8 === 0) px(g, WALL[0], X, Y);
          if ((X + Y) % 8 === 0 && (X - Y + 800) % 8 === 0) px(g, BRASS[2], X, Y);
        }
      }
      px(g, PAL.night[0], x, top + 41, w, 3);
      px(g, WALL[0], x, top + 41, w, 1);
    },

    dress(g) {
      // one wide window on the gas giant the relay keeps station over, ringed with a neon tube
      const wx = 146, wy = 8, ww = 92, wh = 26;
      glow(g, wx + ww / 2, wy + wh / 2, ww / 2 + 9, wh / 2 + 8, AQUA[1], 0.3);
      px(g, WALL[0], wx, wy, ww, wh);
      px(g, AQUA[2], wx, wy, ww, wh);
      px(g, AQUA[3], wx + 1, wy, ww - 2, 1);
      px(g, PAL.night[0], wx + 1, wy + 1, ww - 2, wh - 2);
      sky(g, wx + 2, wy + 2, ww - 4, wh - 4, 71 + look);
      const belts = [PAL.night[2], VIOLET[2], VIOLET[3], VIOLET[4], VIOLET[5], RUST[6], RUST[7]];
      globe(g, wx + 2, wy + 2, ww - 4, wh - 4, wx + 22, wy + 52, 46, belts, lat => Math.sin(lat * 19) * 0.13 + Math.sin(lat * 47 + 1) * 0.05);
      glints(g, wx + 2, wy + 2, ww - 4, wh - 4, PAL.night[5], [30, 34, 70]);
      px(g, WALL[0], wx + 45, wy + 1, 2, wh - 2);
      // the sign hung in it
      glow(g, BAR.x + 9, BAR.y + 4, 15, 9, PINK[1], 0.4);
      bold(g, 'BAR', BAR.x, BAR.y, PINK[2]);
      for (const cx of [BAR.x + 2, BAR.x + 14]) px(g, WALL[3], cx, wy + 2, 1, BAR.y - wy - 2);

      // neon either side: a glass, and a tune
      glow(g, 132, 16, 13, 13, AQUA[1], 0.4);
      neon(g, 127, 9, COCKTAIL, { b: AQUA, a: PINK });
      glow(g, 252, 16, 13, 13, PINK[1], 0.4);
      neon(g, 248, 9, NOTE, { a: PINK });

      // the pillar: a poster for a band nobody remembers
      px(g, PAL.bone[2], 100, 33, 16, 21);
      px(g, PAL.bone[4], 100, 33, 15, 20);
      px(g, RUST[2], 101, 34, 13, 11);
      oval(g, BRASS[3], 107.5, 40, 4, 4);
      oval(g, BRASS[5], 108, 39.5, 2.5, 2.5);
      px(g, RUST[0], 101, 42, 13, 3);
      px(g, RUST[0], 104, 40, 2, 2);
      px(g, RUST[0], 110, 39, 3, 3);
      for (const [lx, ly, lw] of [[2, 14, 11], [3, 16, 9], [5, 18, 5]]) px(g, ly === 14 ? RUST[3] : PAL.bone[2], 100 + lx, 33 + ly, lw, 1);
      px(g, PAL.bone[6], 100, 33, 2, 2);
      px(g, PAL.bone[6], 113, 33, 2, 2);

      // the jukebox, and a couple of pictures by it
      glow(g, JUKE.x + 12, JUKE.y + 14, 25, 24, PINK[1], 0.35);
      jukebox(g, JUKE.x, JUKE.y, 0);
      for (const [fx, fy, c] of [[338, 14, TEAL[2]], [375, 12, RUST[3]], [376, 24, BRASS[2]]] as const) {
        px(g, BRASS[1], fx, fy, 8, 9);
        px(g, BRASS[3], fx, fy, 8, 1);
        px(g, PAL.bone[4], fx + 1, fy + 1, 6, 7);
        px(g, c, fx + 2, fy + 2, 4, 5);
        px(g, PAL.bone[5], fx + 3, fy + 3, 2, 2);
      }
    },

    counter(g, x0, openLeft, openRight) {
      // a dark bar top, polished enough to hold a reflection
      px(g, WOOD[2], x0, COUNTER_TOP, 72, 21);
      px(g, WOOD[0], x0, COUNTER_TOP, 72, 1);
      px(g, WOOD[1], x0, COUNTER_TOP + 1, 72, 2);
      for (let i = 0; i < 8; i++) {
        const sx = x0 + 3 + Math.floor(hash(x0, i, 28) * 56), sy = COUNTER_TOP + 5 + Math.floor(hash(x0, i, 29) * 11);
        px(g, i % 4 === 0 ? mix(WOOD[2], AQUA[1], 0.4) : i % 4 === 2 ? mix(WOOD[2], PINK[1], 0.4) : WOOD[3], sx, sy, 6 + Math.floor(hash(x0, i, 30) * 8), 1);
      }
      px(g, WOOD[4], x0, COUNTER_FRONT - 4, 72, 1);
      px(g, BRASS[4], x0, COUNTER_FRONT - 2, 72, 1);
      px(g, BRASS[2], x0, COUNTER_FRONT - 1, 72, 1);
      // a buttoned leather front, and a tube under the lip of the plinth
      px(g, RUST[1], x0, COUNTER_FRONT, 72, 15);
      px(g, WOOD[0], x0, COUNTER_FRONT, 72, 1);
      px(g, RUST[2], x0, COUNTER_FRONT + 1, 72, 1);
      for (let j = 2; j < 14; j++) {
        for (let i = 0; i < 72; i++) {
          const X = x0 + i, Y = COUNTER_FRONT + j;
          if ((X + Y) % 12 === 0 || (X - Y + 1200) % 12 === 0) px(g, RUST[0], X, Y);
          else if ((X + Y) % 12 === 1 || (X - Y + 1200) % 12 === 11) px(g, RUST[2], X, Y);
          if ((X + Y) % 12 === 0 && (X - Y + 1200) % 12 === 0) px(g, BRASS[3], X, Y);
        }
      }
      px(g, WOOD[0], x0, COUNTER_FRONT + 14, 72, 1);
      px(g, AQUA[1], x0 + 1, COUNTER_FRONT + 15, 70, 1);
      px(g, AQUA[3], x0 + 1, COUNTER_FRONT + 16, 70, 1);
      px(g, AQUA[0], x0, COUNTER_FRONT + 17, 72, 1);
      if (openLeft) px(g, WOOD[0], x0, COUNTER_FRONT, 1, 15);
      if (openRight) px(g, RUST[3], x0 + 71, COUNTER_FRONT + 2, 1, 12);
    },

    sign(g, x0, kind, lit) {
      const s = SERVICE[kind];
      px(g, WALL[3], x0 + 2, 0, 68, SIGN_H);
      px(g, PAL.night[0], x0 + 3, 1, 66, SIGN_H - 2);
      if (!lit) {
        signWords(g, x0, kind, WALL[2]);
        return;
      }
      // tubes: a halo of their own colour round each stroke, and a hot core
      const halo = mix(PAL.night[0], s.mid, 0.45);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) signWords(g, x0 + dx, kind, halo, undefined, 2 + dy);
      signWords(g, x0, kind, s.lit);
    },

    backRoom(g, x0, kind: Service) {
      if (kind !== 'jobs') return false;
      // the back bar: a mirror, three glass shelves and what is left of the stock
      px(g, WALL[1], x0, 0, 72, COUNTER_TOP);
      px(g, WALL[3], x0 + 2, SHELF_Y, 68, 22);
      px(g, WALL[4], x0 + 3, SHELF_Y + 1, 66, 20);
      glints(g, x0 + 3, SHELF_Y + 1, 66, 20, mix(WALL[4], STEEL[7], 0.5), [14, 17, 49, 60, 63]);
      for (const sy of [18, 25, 32]) {
        px(g, AQUA[2], x0 + 2, sy, 68, 1);
        px(g, mix(WALL[4], AQUA[1], 0.5), x0 + 2, sy - 1, 68, 1);
      }
      for (let r = 0; r < 3; r++) {
        for (let bx = x0 + 4, i = 0; bx < x0 + 66; i++) {
          const k = hash(x0 + r, i, 33);
          if (k > 0.2) bottle(g, bx, 17 + r * 7, 5 + Math.floor(hash(r, i, 34) * 2), BOTTLES[Math.floor(hash(r, i, 35) * BOTTLES.length)]);
          bx += k > 0.2 ? 4 : 3;
          if (hash(r, i, 36) > 0.75) bx += 2;
        }
      }
      px(g, SHADOW, x0, SIGN_H, 2, COUNTER_TOP - SIGN_H);
      px(g, SHADOW_SOFT, x0 + 2, SIGN_H, 2, COUNTER_TOP - SIGN_H);
      px(g, SHADOW_SOFT, x0, SIGN_H, 72, 2);
      return true;
    },

    table(g, ox, oy, n) {
      const cx = ox + 12;
      groundShadow(g, cx - 2, oy + 21.5, 7, 2.5);
      oval(g, STEEL[0], cx, oy + 21, 5.5, 2);
      oval(g, STEEL[2], cx, oy + 20.5, 4.5, 1.5);
      px(g, STEEL[0], cx - 1, oy + 4, 3, 16);
      px(g, STEEL[3], cx, oy + 4, 1, 16);
      // a small dark top with a brass edge
      oval(g, BRASS[0], cx, oy + 2.5, 10, 5);
      oval(g, BRASS[2], cx, oy + 1.5, 10, 5);
      oval(g, WOOD[1], cx, oy + 0.5, 10, 5);
      oval(g, WOOD[2], cx + 1, oy, 7, 3);
      // the candle, in a red glass
      px(g, RUST[2], cx - 2, oy - 3, 4, 4);
      px(g, RUST[5], cx - 1, oy - 3, 2, 3);
      px(g, BRASS[6], cx + FLAME.dx - 12, oy + FLAME.dy + 1, 2, 2);
      if (n % 2 === 0) sprite(g, cx + 4, oy - 2, GLASS, { g: TEAL[6] });
      else {
        bottle(g, cx - 7, oy + 2, 7, BOTTLES[n % BOTTLES.length]);
        sprite(g, cx + 4, oy - 1, GLASS, { g: TEAL[6] });
      }
      glow(g, cx, oy - 1, 11, 8, BRASS[4], 0.3);
    },

    plant(g, ox, oy, _n, byWall) {
      snakePlant(g, ox, oy, byWall);
    },

    glows(g) {
      for (const x0 of [24, 264, 384]) {
        // the tube under each bar lights the carpet in front of it
        glow(g, x0 + 36, 73, 42, 7, AQUA[1], 0.4);
      }
    },

    light(x, y) {
      // the jukebox and the window spill a little light; the rest is dim
      const dx = (x - 360) / 40, dy = (y - 50) / 26, d = dx * dx + dy * dy;
      return (d < 1 ? (1 - d) * 1.2 : 0) - 0.3;
    },

    liveRects: TABLES.map(([tx, ty]) => [tx * T + FLAME.dx, ty * T + FLAME.dy, 2, 3] as const),

    live(g, time) {
      // the jukebox's tubes chase
      g.drawImage(jukeFrames[Math.floor(time * 1.5) % 3], JUKE.x, JUKE.y);
      // candles
      TABLES.forEach(([tx, ty], i) => {
        const k = Math.floor(time * 6 + i * 1.7) % 4, x = tx * T + FLAME.dx, y = ty * T + FLAME.dy;
        px(g, k === 1 ? BRASS[4] : BRASS[6], x, y + 1, 2, 2);
        if (k === 2) px(g, BRASS[5], x, y, 1, 1);
        if (k === 3) px(g, BRASS[5], x + 1, y, 1, 1);
      });
      // the sign in the window has a bad tube: now and then it drops out
      const t = time % 11;
      if ((t > 9.2 && t < 9.32) || (t > 9.5 && t < 9.9)) bold(g, 'BAR', BAR.x, BAR.y, PINK[0]);
      // the cherry in the cocktail blinks
      if (Math.floor(time * 1.2) % 2) px(g, PINK[3], 132, 11, 1, 1);
    },
  };
}
