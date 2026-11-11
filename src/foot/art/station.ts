/**
 * A station's concourse, painted at 24 pixels a tile. Every station has the same floor plan (the map in
 * ../world.ts) but four different places are built on it: a company ring, a farm dock, a mining camp and a
 * relay bar (stationRing.ts and its neighbours). This file lays the room out, calls the port's type to paint
 * each part, and adds what every station has: the wares on and behind the three counters, the airlock, and
 * the shutter that comes down where a port has no shipyard.
 *
 * How the room stands. Walls are 44 pixels tall. The back wall of the concourse is map row 1, so its face
 * runs from y = 4 to 48; the three back rooms behind the counters are bays set into it, each under a sign.
 * The counters stand in row 2, 18 pixels high at the front, with their tops reaching back over the staff's
 * feet; the far strip of each top is repeated in the front layer so the staff stand behind it.
 */
import { INK, PAL, SIGNAL } from '../../art/palette';
import type { Port, PortType } from '../../sim/types';
import { AREAS, tileAt } from '../world';
import { farm } from './stationFarm';
import {
  COUNTER_FOOT, COUNTER_TOP, SERVICE, SHADOW, SHADOW_SOFT, SHELF_Y, SIGN_H, T, W,
  clipped, glow, hash, layer, oval, px, relight, signWords, sprite, text, type G, type Service, type Theme,
} from './stationKit';
import { mine } from './stationMine';
import { relay } from './stationRelay';
import { ring } from './stationRing';
import type { AreaArt } from './types';

const THEMES: Record<PortType, (look: number) => Theme> = { ring, farm, mine, relay };

/** Map letter of each counter's service point. */
const SERVICES: Record<string, Service> = { j: 'jobs', f: 'fuel', y: 'yard' };

/**
 * Above this line a counter and what stands on it are repeated in the front layer. The staff's feet are at
 * y = 40; a customer's head never comes higher than about y = 47.
 */
const COUNTER_CUT = 46;

const PAPER = [PAL.bone[4], PAL.bone[5], PAL.bone[6]] as const;
const STEEL = PAL.steel, BRASS = PAL.amber, TEAL = PAL.teal, RUST = PAL.rust, WOOD = PAL.wood;

/* ---------- the back rooms ---------- */

/** A shelving unit's carcass: 24 wide, from under the sign down to the counter. */
function carcass(g: G, th: Theme, x: number): void {
  const [deep, dark, mid, light] = th.shelf;
  px(g, dark, x, SHELF_Y, 24, 22);
  px(g, deep, x + 1, SHELF_Y + 1, 22, 20);
  px(g, light, x, SHELF_Y, 24, 1);
  px(g, mid, x + 23, SHELF_Y + 1, 1, 21);
  px(g, mid, x + 1, 18, 22, 1);
  px(g, mid, x + 1, 25, 22, 1);
  px(g, light, x + 1, 32, 22, 1);
}

/** The broker's pigeonholes: slips, envelopes and the odd rolled chart. */
function pigeonholes(g: G, th: Theme, x: number): void {
  carcass(g, th, x);
  const mid = th.shelf[2];
  px(g, mid, x + 7, 12, 1, 20);
  px(g, mid, x + 15, 12, 1, 20);
  const cols = [[1, 6], [8, 7], [16, 7]];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = x + cols[c][0], w = cols[c][1], cy = 12 + r * 7, k = hash(x + c, r, 3);
      if (k < 0.18) continue;
      if (k < 0.55) {
        // a stack lying flat
        px(g, PAPER[1], cx + 1, cy + 3, w - 2, 3);
        px(g, PAPER[2], cx + 1, cy + 3, w - 2, 1);
        px(g, PAPER[0], cx + 1, cy + 5, w - 2, 1);
      } else if (k < 0.85) {
        // envelopes stood on end
        px(g, PAPER[2], cx + 1, cy + 1, 2, 5);
        px(g, PAPER[0], cx + 3, cy + 2, 1, 4);
        px(g, c === 1 ? TEAL[5] : BRASS[4], cx + 4, cy + 1, 1, 5);
      } else {
        // a rolled chart tied with a ribbon
        px(g, PAPER[1], cx + 1, cy + 2, w - 2, 4);
        px(g, PAPER[2], cx + 1, cy + 2, w - 2, 1);
        px(g, RUST[5], cx + 3, cy + 2, 1, 4);
      }
    }
  }
}

const SPINES = [
  [RUST[2], RUST[4], RUST[6]], [TEAL[1], TEAL[3], TEAL[5]], [WOOD[2], WOOD[5], WOOD[7]],
  [PAL.violet[3], PAL.violet[4], PAL.violet[6]], [PAL.bone[2], PAL.bone[4], PAL.bone[6]], [STEEL[2], STEEL[4], STEEL[6]],
] as const;

/** A row of books standing on a shelf whose top is at `base`. */
function books(g: G, x: number, base: number, room: number, seed: number): void {
  let bx = x;
  for (let i = 0; bx < x + room - 1; i++) {
    const w = hash(seed, i, 7) > 0.55 ? 3 : 2, h = 4 + Math.floor(hash(seed, i, 8) * 2);
    const [d, m, l] = SPINES[Math.floor(hash(seed, i, 9) * SPINES.length)];
    px(g, m, bx, base - h, w, h);
    px(g, d, bx, base - h, 1, h);
    px(g, l, bx + w - 1, base - h, 1, 1);
    if (w === 3) px(g, PAPER[1], bx + 1, base - h + 1, 2, 1);
    bx += w;
    if (hash(seed, i, 10) > 0.8) bx += 2;
  }
}

/** Ledgers, box files and the strongbox. */
function ledgers(g: G, th: Theme, x: number): void {
  carcass(g, th, x);
  books(g, x + 1, 18, 21, x);
  books(g, x + 1, 25, 13, x + 5);
  // box files lying on the middle shelf
  px(g, PAL.bone[3], x + 15, 21, 7, 4);
  px(g, PAL.bone[5], x + 15, 21, 7, 1);
  px(g, PAL.bone[2], x + 15, 23, 7, 1);
  // the strongbox
  px(g, STEEL[2], x + 2, 26, 12, 6);
  px(g, STEEL[5], x + 2, 26, 12, 1);
  px(g, STEEL[1], x + 2, 31, 12, 1);
  px(g, BRASS[4], x + 7, 28, 2, 2);
  px(g, STEEL[4], x + 13, 27, 1, 4);
  px(g, PAPER[1], x + 16, 29, 6, 3);
  px(g, PAPER[2], x + 16, 29, 6, 1);
}

/** A hose wound on a reel, seen face on. */
function reel(g: G, cx: number, cy: number): void {
  oval(g, TEAL[0], cx, cy, 5.5, 5.5);
  oval(g, TEAL[3], cx, cy, 4.5, 4.5);
  oval(g, TEAL[1], cx, cy, 3.5, 3.5);
  oval(g, TEAL[2], cx, cy, 2.5, 2.5);
  oval(g, STEEL[6], cx, cy, 1.5, 1.5);
  px(g, TEAL[5], cx + 1, cy - 4, 2, 1);
  // the loose end and its nozzle
  px(g, TEAL[1], cx + 4, cy + 3, 1, 4);
  px(g, BRASS[4], cx + 3, cy + 7, 3, 2);
}

function jerrycan(g: G, x: number, y: number, [d, m, l]: readonly string[]): void {
  px(g, m, x, y + 1, 6, 6);
  px(g, l, x, y + 1, 5, 1);
  px(g, d, x, y + 6, 6, 1);
  px(g, d, x + 5, y + 2, 1, 4);
  px(g, d, x + 2, y + 3, 2, 2);
  px(g, l, x + 1, y, 2, 1);
  px(g, STEEL[1], x + 4, y, 1, 1);
}

/** Hose reels on the wall and cans of the three grades below. */
function reels(g: G, th: Theme, x: number): void {
  const [deep, dark, mid, light] = th.metal;
  px(g, dark, x, SHELF_Y, 24, 22);
  px(g, mid, x, SHELF_Y, 24, 1);
  px(g, deep, x, 24, 24, 1);
  for (const [rx, ry] of [[1, 12], [22, 12]]) px(g, light, x + rx, ry);
  reel(g, x + 6.5, 17.5);
  reel(g, x + 17.5, 17.5);
  px(g, light, x, 32, 24, 1);
  jerrycan(g, x + 1, 25, [RUST[2], RUST[5], RUST[7]]);
  jerrycan(g, x + 9, 25, [BRASS[1], BRASS[3], BRASS[5]]);
  jerrycan(g, x + 17, 25, [TEAL[1], TEAL[3], TEAL[5]]);
}

function dial(g: G, cx: number, cy: number, needle: number): void {
  oval(g, BRASS[1], cx, cy, 4.5, 4.5);
  oval(g, BRASS[4], cx, cy - 0.5, 4, 4);
  oval(g, PAL.bone[6], cx, cy, 3, 3);
  px(g, PAL.bone[4], cx - 3, cy + 1, 6, 1);
  // the needle, from the hub out
  for (let i = 0; i < 3; i++) px(g, RUST[4], Math.floor(cx) + needle * i, Math.floor(cy) - i);
  px(g, INK, Math.floor(cx), Math.floor(cy));
}

/** The dock office's gauge panel: two dials, the manifold and its valve wheels. */
function gauges(g: G, th: Theme, x: number): void {
  const [deep, dark, mid, light] = th.metal;
  px(g, dark, x, SHELF_Y, 24, 22);
  px(g, mid, x, SHELF_Y, 24, 1);
  px(g, mid, x + 23, SHELF_Y, 1, 22);
  dial(g, x + 6.5, 17, -1);
  dial(g, x + 17.5, 17, 1);
  px(g, SIGNAL.green, x + 11, 13, 2, 2);
  px(g, SIGNAL.amber, x + 11, 17, 2, 2);
  // the manifold
  px(g, TEAL[1], x + 1, 24, 22, 3);
  px(g, TEAL[4], x + 1, 24, 22, 1);
  px(g, TEAL[2], x + 1, 25, 22, 1);
  for (const dx of [4, 11, 18]) {
    px(g, TEAL[1], x + dx, 27, 3, 6);
    px(g, TEAL[3], x + dx + 1, 27, 1, 6);
    px(g, deep, x + dx - 1, 23, 5, 1);
    px(g, RUST[5], x + dx - 1, 29, 5, 2);
    px(g, RUST[7], x + dx, 29, 3, 1);
  }
  px(g, light, x + 1, 12, 1, 1);
  px(g, light, x + 22, 21, 1, 1);
}

const PEGBOARD = [
  '......................',
  '.ss.ss......mmmmmmk...',
  '.ss.ss......ssssssk...',
  '.sssssk.......wk......',
  '..sssk........wk......',
  '..ssk.........wk......',
  '..ssk.........wk......',
  '..ssk.........wk......',
  '..ssk.........wk......',
  '..ssk.................',
  '.sssss....rr..........',
  '.ss.ssk...rrssssssssk.',
  '..........rrsssssssk..',
  '..........rrkm.m.m....',
  '......................',
  '...ss.ss......mmmm....',
  '...ss.ssk....mk..mk...',
  '....sssk.....mk..mk...',
  '....r.r.......mmmmk...',
  '...rk..rk.............',
];

/** The yard's pegboard: spanner, hammer, saw, pliers and a coil of wire. */
function pegboard(g: G, th: Theme, x: number): void {
  const [, dark, mid, light] = th.shelf;
  px(g, dark, x, SHELF_Y, 24, 22);
  px(g, mid, x + 1, SHELF_Y + 1, 22, 20);
  px(g, light, x, SHELF_Y, 24, 1);
  sprite(g, x + 1, SHELF_Y + 1, PEGBOARD, { s: STEEL[7], m: STEEL[5], w: WOOD[5], r: RUST[5], k: dark });
}

/** Spares on shelves: a gear, cable, a thruster bell, crates and a bottle of welding gas. */
function parts(g: G, th: Theme, x: number): void {
  carcass(g, th, x);
  const deep = th.shelf[0];
  // top shelf: a gear and a box of fittings
  oval(g, STEEL[3], x + 5.5, 15, 3.5, 3.5);
  oval(g, STEEL[6], x + 5.5, 14.5, 3, 3);
  oval(g, deep, x + 5.5, 14.5, 1, 1);
  px(g, STEEL[6], x + 5, 11, 1, 1);
  px(g, STEEL[6], x + 1, 14, 1, 1);
  px(g, STEEL[6], x + 9, 14, 1, 1);
  px(g, WOOD[4], x + 11, 14, 5, 4);
  px(g, WOOD[6], x + 11, 14, 5, 1);
  px(g, WOOD[2], x + 13, 15, 1, 3);
  // middle shelf: a coil of cable and a thruster bell
  oval(g, BRASS[1], x + 5, 22, 4, 3);
  oval(g, BRASS[3], x + 5, 21.5, 3.5, 2.5);
  oval(g, deep, x + 5, 21.5, 1.5, 1);
  px(g, STEEL[5], x + 11, 20, 3, 1);
  px(g, STEEL[4], x + 10, 21, 5, 2);
  px(g, STEEL[3], x + 9, 23, 7, 2);
  px(g, STEEL[7], x + 13, 21, 1, 3);
  // bottom shelf: crates
  px(g, WOOD[3], x + 2, 27, 6, 5);
  px(g, WOOD[5], x + 2, 27, 6, 1);
  px(g, WOOD[2], x + 2, 29, 6, 1);
  px(g, STEEL[3], x + 9, 28, 6, 4);
  px(g, STEEL[5], x + 9, 28, 6, 1);
  // the gas bottle stands through two shelves
  px(g, deep, x + 17, 19, 5, 13);
  px(g, RUST[3], x + 17, 20, 5, 12);
  px(g, RUST[5], x + 18, 20, 3, 12);
  px(g, RUST[7], x + 20, 21, 1, 9);
  px(g, STEEL[6], x + 18, 18, 3, 2);
  px(g, STEEL[3], x + 19, 17, 1, 1);
  px(g, PAPER[1], x + 18, 24, 3, 2);
}

/** A bay behind a counter: its back wall, the door to the office, and shelving either side of the clerk. */
function backRoom(g: G, th: Theme, x0: number, kind: Service): void {
  const [deep, dark, mid, light] = th.recess;
  px(g, dark, x0, 0, 72, COUNTER_TOP);
  // the office door, dark behind the clerk's head so they stand out
  px(g, mid, x0 + 25, 8, 22, 25);
  px(g, light, x0 + 25, 8, 22, 1);
  px(g, deep, x0 + 27, 10, 18, 23);
  px(g, dark, x0 + 29, 12, 14, 9);
  px(g, dark, x0 + 29, 23, 14, 10);
  px(g, BRASS[3], x0 + 42, 22, 2, 2);
  if (kind === 'jobs') {
    pigeonholes(g, th, x0);
    ledgers(g, th, x0 + 48);
  } else if (kind === 'fuel') {
    reels(g, th, x0);
    gauges(g, th, x0 + 48);
  } else {
    pegboard(g, th, x0);
    parts(g, th, x0 + 48);
  }
  // the bay is set back: its sides fall into shadow
  px(g, SHADOW, x0, SIGN_H, 2, COUNTER_TOP - SIGN_H);
  px(g, SHADOW_SOFT, x0 + 2, SIGN_H, 2, COUNTER_TOP - SIGN_H);
  px(g, SHADOW_SOFT, x0, SIGN_H, 72, 2);
}

/* ---------- on the counters ---------- */

const LEDGER = [
  '.ccccccc.ccccccc.',
  'cwwwwwwwcwwwwwwwc',
  'cwllllwwcwlllllwc',
  'cwwwwwwwcwwwwwwwc',
  'cwlllllwcwllllwwc',
  'cwwwwwwwcwwwwwwwc',
  'cwllllwwcwlllwwwc',
  'csssssssssssssssc',
  '.ddddddd.ddddddd.',
];
const BELL = ['...k...', '..hbb..', '.hbbbd.', '.hbbbd.', 'hbbbbdd', 'kkkkkkk'];
const DESK_LAMP = [
  '..GGGGGGG..',
  '.GggggggGG.',
  'GGgggggGGDD',
  '.yyyyyyyyy.',
  '.....b.....',
  '.....b.....',
  '.....b.....',
  '.....b.....',
  '....bbb....',
  '..hbbbbbd..',
  '..ddddddd..',
];
const TRAY = [
  '.tttttttttttt.',
  'twwwwwwwwwwwwt',
  'twwlllllllwwwt',
  'twwwwwwwwwwwwt',
  'twwllllllwwwwt',
  'twwwwwwwwwwwwt',
  'tddddddddddddt',
  '.dddddddddddd.',
];
const HOSE = [
  '....kkkkkkk.....',
  '..kkhhhhhhhkk...',
  '.khhkkkkkkkhhk..',
  'khhk.......khhk.',
  'khk.........khk.',
  'khhk.......khhkb',
  '.khhkkkkkkkhhkbb',
  '..kkhhhhhhhkkbbn',
  '....kkkkkkk..bnn',
  '..............nn',
];
const CLIPBOARD = [
  '...sssss...',
  'wwwwssswwww',
  'wpppppppppw',
  'wpllllllppw',
  'wpppppppppw',
  'wplllllllpw',
  'wpppppppppw',
  'wpllllpppaw',
  'wpppppppppw',
  'ddddddddddd',
];
const TOOLBOX = [
  '.....ssssssss.....',
  '....s........s....',
  '.oooooooooooooooo.',
  'oOOOOOOOOOOOOOOOOo',
  'oOOOOOOOOOOOOOOOOo',
  'ooooooooyyoooooooo',
  'oRRRRRRRyyRRRRRRRo',
  'oRRRRRRRRRRRRRRRRo',
  'oRRRRRRRRRRRRRRRRo',
  'oRRRRRRRRRRRRRRRRo',
  'oddddddddddddddddo',
  '.kkkkkkkkkkkkkkkk.',
];
const BLUEPRINT = [
  'bbbbbbbbbbbbbbbbbb',
  'bBBBBBBBBBBBBBBBBb',
  'bBwwwwwBBBBwBBBBBb',
  'bBwBBBwBBBwwwBBBBb',
  'bBwBBBwwwwwBwBBBBb',
  'bBwwwwwBBBBBwBBBBb',
  'bBBBBBBBwwwwwBBBBb',
  'bBBBBBBBBBBBBBBBcc',
  'bbbbbbbbbbbbbbbccc',
];
const SPANNER = ['ss.......', 's.sss....', '.sssssss.', '....sss.s', '.......ss'];
const TENT_CARD = ['.wwwwwwwww.', 'wwwwwwwwwww', 'wrrrrrrrrrw', 'wwwwwwwwwww', 'dwwwwwwwwwd', 'ddddddddddd'];

/** What lies on a counter: the tools of its trade, or a card saying nobody is coming. */
function wares(g: G, x0: number, kind: Service, open: boolean): void {
  if (!open) {
    sprite(g, x0 + 30, 44, TENT_CARD, { w: PAPER[2], r: RUST[5], d: PAPER[0] });
    return;
  }
  if (kind === 'jobs') {
    sprite(g, x0 + 5, 40, TRAY, { t: WOOD[5], d: WOOD[2], w: PAPER[2], l: PAL.bone[3] });
    sprite(g, x0 + 27, 42, LEDGER, { c: RUST[3], d: RUST[1], w: PAPER[2], l: PAL.bone[3], s: PAPER[0] });
    sprite(g, x0 + 47, 44, BELL, { b: BRASS[4], h: BRASS[6], d: BRASS[2], k: BRASS[0] });
    sprite(g, x0 + 58, 35, DESK_LAMP, { G: PAL.leaf[4], g: PAL.leaf[5], D: PAL.leaf[2], y: BRASS[6], b: BRASS[4], h: BRASS[6], d: BRASS[1] });
  } else if (kind === 'fuel') {
    sprite(g, x0 + 5, 39, HOSE, { k: STEEL[0], h: STEEL[2], b: BRASS[3], n: BRASS[5] });
    sprite(g, x0 + 30, 42, CLIPBOARD, { w: WOOD[4], d: WOOD[2], p: PAPER[2], l: PAL.bone[3], s: STEEL[6], a: BRASS[3] });
    // the pump meter
    const mx = x0 + 50, my = 31;
    px(g, TEAL[0], mx, my, 15, 19);
    px(g, TEAL[2], mx + 1, my + 1, 13, 17);
    px(g, TEAL[4], mx + 1, my + 1, 13, 1);
    px(g, TEAL[3], mx + 13, my + 2, 1, 16);
    px(g, PAL.phosphor[0], mx + 2, my + 3, 11, 7);
    text(g, '42', mx + 3, my + 4, PAL.phosphor[4]);
    px(g, TEAL[5], mx + 11, my + 5, 1, 4);
    px(g, STEEL[6], mx + 2, my + 12, 2, 2);
    px(g, STEEL[6], mx + 5, my + 12, 2, 2);
    px(g, RUST[5], mx + 9, my + 12, 4, 2);
    px(g, RUST[7], mx + 9, my + 12, 4, 1);
    px(g, TEAL[0], mx + 3, my + 15, 9, 1);
    px(g, PAPER[2], mx + 5, my + 15, 5, 3);
    px(g, PAPER[0], mx + 5, my + 17, 5, 1);
    px(g, SHADOW, mx - 1, my + 19, 15, 1);
  } else {
    sprite(g, x0 + 5, 37, TOOLBOX, { s: STEEL[6], o: RUST[3], O: RUST[6], R: RUST[5], d: RUST[2], y: BRASS[4], k: RUST[0] });
    sprite(g, x0 + 27, 42, BLUEPRINT, { b: '#27395c', B: '#34507a', w: STEEL[7], c: PAPER[1] });
    sprite(g, x0 + 33, 45, SPANNER, { s: STEEL[8] });
    // a gear waiting to be fitted
    const cx = x0 + 59, cy = 43;
    oval(g, STEEL[2], cx, cy + 1.5, 6, 4.5);
    oval(g, STEEL[6], cx, cy, 6, 4.5);
    oval(g, STEEL[7], cx + 1, cy - 1, 3.5, 2.5);
    oval(g, STEEL[1], cx, cy, 2, 1.5);
    for (const [dx, dy, w, h] of [[-7, -1, 1, 3], [6, -1, 1, 3], [-1, -6, 2, 1], [-1, 5, 2, 2], [-5, -4, 2, 1], [3, -4, 2, 1], [-6, 3, 2, 2], [4, 3, 2, 2]]) {
      px(g, dy > 0 ? STEEL[3] : STEEL[6], cx + dx, cy + dy, w, h);
    }
  }
}

/**
 * The plate on the front of a counter: its picture and name again, in the counter's own colour. The sign
 * over the bay says the same, but the top of the room is where the game's HUD sits.
 */
function plate(g: G, x0: number, kind: Service): void {
  const s = SERVICE[kind];
  px(g, s.dark, x0 + 12, 56, 48, 12);
  px(g, s.mid, x0 + 12, 56, 48, 1);
  px(g, s.mid, x0 + 59, 57, 1, 11);
  px(g, INK, x0 + 13, 57, 46, 10);
  signWords(g, x0, kind, s.lit, s.dark, 58);
}

const PADLOCK = ['.ssss.', 's....s', 's....s', 'bbbbbb', 'bbbkbb', 'bbbbbb', 'dddddd'];

/** No shipyard here: a roller shutter down over the bay, padlocked, with a board hung on it. */
function shutter(g: G, th: Theme, x0: number): void {
  const [deep, dark, mid, light, glint] = th.metal;
  px(g, deep, x0, SIGN_H, 72, COUNTER_TOP - SIGN_H);
  for (let y = SIGN_H; y < 29; y += 3) {
    px(g, light, x0 + 3, y, 66, 1);
    px(g, mid, x0 + 3, y + 1, 66, 1);
    px(g, dark, x0 + 3, y + 2, 66, 1);
  }
  // runs of grime down the slats
  for (let i = 0; i < 7; i++) {
    const gx = x0 + 5 + Math.floor(hash(x0, i, 60) * 62), gy = SIGN_H + Math.floor(hash(x0, i, 61) * 3) * 3;
    px(g, dark, gx, gy, 1, 7 + Math.floor(hash(x0, i, 62) * 3) * 3);
  }
  // the bottom rail and the guides either side
  px(g, mid, x0 + 3, 29, 66, 4);
  px(g, glint, x0 + 3, 29, 66, 1);
  px(g, deep, x0 + 3, 32, 66, 1);
  for (const gx of [x0, x0 + 69]) {
    px(g, dark, gx, SIGN_H, 3, 22);
    px(g, light, gx + 2, SIGN_H, 1, 22);
  }
  // the board, on two chains
  const bx = x0 + 20;
  px(g, deep, bx + 4, SIGN_H, 1, 4);
  px(g, deep, bx + 27, SIGN_H, 1, 4);
  px(g, RUST[1], bx, 14, 32, 11);
  px(g, RUST[4], bx + 1, 15, 30, 9);
  px(g, RUST[6], bx + 1, 15, 30, 1);
  px(g, RUST[2], bx + 1, 23, 30, 1);
  text(g, 'CLOSED', bx + 5, 17, PAL.bone[6]);
  sprite(g, x0 + 33, 26, PADLOCK, { s: STEEL[7], b: BRASS[4], k: INK, d: BRASS[1] });
}

/* ---------- the airlock ---------- */

const CHEVRON = ['#.........#', '##.......##', '.##.....##.', '..##...##..', '...##.##...', '....###....', '.....#.....'];

/** The way back to the ship: a lit well through the bottom wall, hazard-striped, with a lamp on each post. */
function airlock(g: G, th: Theme): void {
  const [deep, dark, mid, light, glint] = th.metal, x = 192, y = 192;
  px(g, INK, x - 3, y - 1, 30, 25);
  // the floor of the lock: tread plate running down to the outer hatch
  px(g, dark, x + 1, y, 22, 24);
  for (let j = 6; j < 18; j += 3) {
    px(g, deep, x + 1, y + j, 22, 1);
    px(g, mid, x + 1, y + j + 1, 22, 1);
  }
  px(g, SHADOW, x + 1, y + 4, 22, 2);
  sprite(g, x + 6, y + 7, CHEVRON, { '#': BRASS[4] });
  sprite(g, x + 6, y + 12, CHEVRON, { '#': BRASS[3] });
  // the sill, in warning stripes
  for (let j = 0; j < 4; j++) for (let i = 0; i < 22; i++) px(g, ((i + j) >> 2) & 1 ? INK : BRASS[4], x + 1 + i, y + j);
  px(g, BRASS[6], x + 1, y, 22, 1);
  // the outer hatch
  px(g, mid, x + 1, y + 19, 22, 5);
  px(g, glint, x + 1, y + 19, 22, 1);
  px(g, deep, x + 12, y + 20, 1, 4);
  px(g, light, x + 4, y + 21, 5, 1);
  px(g, light, x + 16, y + 21, 5, 1);
  // the posts
  for (const p of [x - 2, x + 23]) {
    px(g, mid, p, y - 1, 3, 25);
    px(g, glint, p, y - 1, 3, 1);
    px(g, light, p + 2, y, 1, 24);
    px(g, dark, p, y, 1, 24);
    px(g, deep, p, y + 8, 3, 1);
    px(g, deep, p, y + 16, 3, 1);
    px(g, INK, p, y + 2, 3, 4);
    px(g, SIGNAL.green, p, y + 3, 3, 2);
  }
}

/** Paint on the floor leading to the airlock: two arrows between a pair of broken lines. */
function airlockApproach(g: G, th: Theme): void {
  const x = 192, y = 172;
  sprite(g, x + 6, y + 2, CHEVRON, { '#': th.paint });
  sprite(g, x + 6, y + 9, CHEVRON, { '#': th.paint });
  for (const bx of [x - 1, x + 23]) for (let j = 0; j < 18; j += 6) px(g, th.paint, bx, y + j, 2, 4);
}

/* ---------- light ---------- */

/** Where the floor starts under whatever stands at the top of a column: a counter (or the pillar), or the wall. */
const footAt = (x: number) => (x < 120 || (x >= 264 && x < 336) || x >= 384 ? COUNTER_FOOT : 48);

/**
 * The shade every concourse has, in steps: the walls and counters shade the floor at their feet, the right
 * wall throws a little shadow left, and the corners are darker than the middle.
 */
function roomShade(x: number, y: number): number {
  let v = 0;
  const below = y - footAt(x);
  if (below >= 0 && below < 6) v -= below < 2 ? 2 : below < 4 ? 1.2 : 0.6;
  if (x >= 449) v -= x >= 453 ? 1.2 : 0.6;
  // the open end of the yard counter shades the floor to its left
  if (x >= 380 && x < 384 && y >= 58 && y < 74) v -= 1;
  const ex = Math.min(x - 24, 455 - x), ey = Math.min(y - 48, 191 - y);
  v -= Math.max(0, 1 - ex / 70) * Math.max(0, 1 - ey / 70) * 1.5;
  return v;
}

/* ---------- the room ---------- */

/** The room for a port. What may differ between ports: its type, its look (a colour seed) and whether it has a yard. */
export function stationArt(port: Pick<Port, 'type' | 'look' | 'yard'>): AreaArt {
  const th = THEMES[port.type](port.look);
  const back = layer(), front = layer();
  const rows = AREAS.station.rows;

  // where the map puts things
  const bays: { x0: number; kind: Service; open: boolean }[] = [];
  const things: { ch: string; ox: number; oy: number; byWall: boolean }[] = [];
  rows.forEach((row, ty) => [...row].forEach((ch, tx) => {
    if (SERVICES[ch]) bays.push({ x0: (tx - 1) * T, kind: SERVICES[ch], open: SERVICES[ch] !== 'yard' || port.yard });
    if (ch === 'o' || ch === 'p') things.push({ ch, ox: tx * T, oy: ty * T, byWall: '#w'.includes(tileAt('station', tx, ty - 1)) });
  }));

  // floor, the marks on it, and the room's own shade
  th.floor(back);
  for (const b of bays) if (b.open) th.mat(back, b.x0 + 36, b.kind);
  airlockApproach(back, th);
  relight(back, T, 2 * T, 18 * T, 6 * T, (x, y) => roomShade(x, y) + (th.light?.(x, y) ?? 0));

  // walls: the back wall's face, the pillar by the broker, and the tops of the rest
  th.cap(back, 0, 0, W, 4, 's');
  th.wall(back, 120, 144, 48);
  th.wall(back, 336, 48, 48);
  for (const b of bays) {
    if (!b.open) shutter(back, th, b.x0);
    else if (!th.backRoom?.(back, b.x0, b.kind)) backRoom(back, th, b.x0, b.kind);
  }
  th.cap(back, 96, 4, T, 24, 's');
  th.wall(back, 96, T, 72);
  th.cap(back, 0, 0, T, 9 * T, 'e');
  th.cap(back, W - T, 0, T, 9 * T, 'w');
  th.cap(back, 0, 8 * T, W, T, 'n');
  airlock(back, th);
  th.dress(back);

  // furniture. Whatever stands taller than its own tile is repeated in the front layer, so that someone
  // walking behind it is hidden by it; nobody in front of it can reach that high.
  let tables = 0, plants = 0;
  for (const t of things) {
    const n = t.ch === 'o' ? tables++ : plants++;
    const draw = (g: G) => (t.ch === 'o' ? th.table(g, t.ox, t.oy, n) : th.plant(g, t.ox, t.oy, n, t.byWall));
    draw(back);
    if (!t.byWall) clipped(front, t.ox - 12, t.oy - 48, 48, 46, () => draw(front));
  }
  for (const b of bays) {
    const openLeft = tileAt('station', b.x0 / T - 1, 2) !== '#', openRight = tileAt('station', b.x0 / T + 3, 2) !== '#';
    const draw = (g: G) => {
      th.counter(g, b.x0, openLeft, openRight);
      if (b.open) plate(g, b.x0, b.kind);
      wares(g, b.x0, b.kind, b.open);
      th.extras?.(g, b.x0, b.kind, b.open);
    };
    draw(back);
    clipped(front, b.x0 - 4, 0, 80, COUNTER_CUT, () => draw(front));
    th.sign(back, b.x0, b.kind, b.open);
    th.sign(front, b.x0, b.kind, b.open);
    if (b.open && b.kind === 'jobs') for (const g of [back, front]) glow(g, b.x0 + 63, 44, 10, 7, BRASS[6], 0.45);
  }
  th.glows?.(back, port.yard);
  th.glows?.(front, port.yard);

  // what `live` animates has to show through the front layer
  const yardOpen = port.yard, fuel = bays.find(b => b.kind === 'fuel');
  const meter = fuel ? { x: fuel.x0 + 52, y: 34 } : null;
  if (meter) front.clearRect(meter.x, meter.y, 11, 7);
  for (const [x, y, w, h] of th.liveRects ?? []) front.clearRect(x, y, w, h);

  return {
    tile: T,
    back: back.canvas,
    front: front.canvas,
    live(g, f) {
      // the airlock's lamps take turns
      const beat = Math.floor(f.time * 1.5) % 2;
      px(g, beat ? SIGNAL.green : '#2f6a4e', 190, 195, 3, 2);
      px(g, beat ? '#2f6a4e' : SIGNAL.green, 215, 195, 3, 2);
      // the pump meter counts
      if (meter) {
        const n = 30 + (Math.floor(f.time / 2.5) % 60);
        px(g, PAL.phosphor[0], meter.x + 1, meter.y + 1, 8, 5);
        text(g, String(n), meter.x + 1, meter.y + 1, PAL.phosphor[Math.floor(f.time * 8) % 9 ? 4 : 3]);
      }
      th.live?.(g, f.time, yardOpen);
    },
  };
}
