/**
 * The rig every person is built on: a frame of pixels, the poses of a walk and how a body is put together
 * from parts for each way it can face. Who the people are (their parts and colours) is in people-cast.ts.
 *
 * A frame is painted as letters, one per pixel, each standing for a material and a shade (MATERIAL below).
 * Heads and torsos are drawn by hand as small grids of those letters, one per facing, because faces, hair and
 * clothes are what make someone a person. Arms, legs and coat skirts are drawn by the rig from a few
 * measurements, so a walk cycle stays consistent and a new person does not need thirty hand-drawn frames.
 * The dark outline is added last, by the rig, around whatever was painted.
 */
import { INK } from '../../art/palette';
import type { PersonSprites } from './types';

export const FRAME_W = 24, FRAME_H = 36;
/** The row the soles stand on. A step toward the camera lands a little below it, a step away a little above. */
export const GROUND = 32;
/** The figure is centred on the line between columns 11 and 12. */
const CX = 12;

export type Grid = readonly string[];
/** Four colours, dark to light. */
export type Ramp = readonly [string, string, string, string];

/**
 * The letters for each material, darkest to lightest. In a grid, `.` is empty, `o` is ink, `e` an eye and
 * `w` the white of one. A person may add letters of their own (Look.more).
 */
export const MATERIAL = {
  skin: 'ZzsS', hair: 'JjhH', coat: 'XxcC', shirt: 'YytT', pants: 'QqpP', boots: 'DdbB',
  trim: 'MmnN', metal: 'GgaA', extra: 'VvuU',
} as const;
export type Material = keyof typeof MATERIAL;

/** One shade darker, for the arm and leg on the far side of the body. */
const DIM: Record<string, string> = {};
for (const letters of Object.values(MATERIAL)) for (let i = 0; i < 4; i++) DIM[letters[i]] = letters[Math.max(0, i - 1)];

export type View = 'down' | 'up' | 'right' | 'left';
export type Eyes = 'open' | 'shut' | 'left' | 'right' | 'low';

/** How the body is held in one frame. Left and right are the person's own. */
export interface Pose {
  /** The body sinks this many pixels onto the legs. */
  bob: number;
  /** Where each leg (left, right) is in its stride: 0 to 5 (LEG_SIDE below), or -1 standing. */
  legs: readonly [number, number];
  /** How far each arm (left, right) has swung: -2 back to 2 forward. */
  arms: readonly [number, number];
  /** Seen from the front or back: which half of a coat's skirt hangs a pixel lower, as the leg under it
   *  steps toward the camera. 1 the person's left, -1 their right, 0 neither. */
  sway: number;
  /** Seen from the side: how far the coat's skirt is thrown out, 0 to 2. */
  spread: number;
  eyes?: Eyes;
  /** The head dips this many pixels more than the body. */
  nod?: number;
  /** A number the person's own `detail` can read: which step of a gesture this frame is. */
  act?: number;
  /** The rig leaves both arms out, because `detail` is drawing them doing something. */
  noArms?: boolean;
}

export const STAND: Pose = { bob: 0, legs: [-1, -1], arms: [0, 0], sway: 0, spread: 0 };

/**
 * The walk: six frames, two steps. Contact (legs widest), recoil (weight comes down, the body sinks a pixel),
 * passing (the free leg swings by), then the same on the other leg. Arms swing against the legs.
 */
export const WALK: readonly Pose[] = [0, 1, 2, 3, 4, 5].map(i => {
  const swing = [2, 1, 0, -2, -1, 0][i];
  return {
    bob: i % 3 === 1 ? 1 : 0,
    legs: [i, (i + 3) % 6] as const,
    arms: [-swing, swing] as const,
    sway: [1, 1, 0, -1, -1, 0][i],
    spread: [2, 1, 0, 2, 1, 0][i],
  };
});

/** Someone to draw. */
export interface Look {
  ramps: Partial<Record<Material, Ramp>>;
  /** Colours for any other letters this person's grids use. */
  more?: Record<string, string>;
  /** Rows, from the top of the frame: where the head grid, the torso grid and the legs start. */
  top: number;
  neck: number;
  hip: number;
  head: { down: Grid; up: Grid; side: Grid };
  /** Torsos have no arms: the rig hangs those. A torso may run on below the hip (a tool belt, a jacket hem). */
  torso: { down: Grid; up: Grid; side: Grid };
  /** Pixels: how thick an arm and a leg are, the gap between the legs, the arm's length with the hand. */
  arm: number;
  armLen: number;
  leg: number;
  stance: number;
  /** Rows of sleeve before bare arm. Leave out for sleeves to the wrist. */
  sleeve?: number;
  /** What the sleeve is made of, if not the coat; and the cuff, if it is not just the sleeve's edge. */
  sleeveOf?: Material;
  cuff?: Material;
  /** Gloves at the end of the arm, drawn in `trim`. */
  glove?: boolean;
  /** A coat that hangs below the hip, to the row `hem`; `open` shows the legs down the front. */
  coat?: { hem: number; open: boolean };
  /** An arm the rig leaves out because it is busy holding something; `detail` draws it instead. */
  holds?: 'left' | 'right';
  /** Anything the rig does not know about, drawn last: a clipboard, tools, a gesture. Side views are drawn
   *  facing right and flipped for `left`; `view` says which is being made. */
  detail?(s: Sheet, view: View, pose: Pose): void;
  /** The loop played while standing behind a counter, three frames a second. */
  idle: readonly Pose[];
}

/** One frame being painted: a letter per pixel. */
export class Sheet {
  readonly px = new Uint8Array(FRAME_W * FRAME_H);

  put(x: number, y: number, ch: string): void {
    if (ch !== '.' && ch !== ' ' && x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H) this.px[y * FRAME_W + x] = ch.charCodeAt(0);
  }

  at(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H ? this.px[y * FRAME_W + x] : 0;
  }

  /** Fill x0..x1 on row y. `chars` gives the left edge, the middle and the right edge: 'xcC'. */
  span(y: number, x0: number, x1: number, chars: string, dim = false): void {
    for (let x = x0; x <= x1; x++) {
      const ch = x === x0 && x1 > x0 ? chars[0] : x === x1 && x1 > x0 ? chars[chars.length - 1] : chars[Math.min(1, chars.length - 1)];
      this.put(x, y, dim ? DIM[ch] ?? ch : ch);
    }
  }

  /** Paint a grid with its top-left corner at (x, y). Rows above `clipTop` are left out. */
  stamp(grid: Grid, x: number, y: number, o: { dim?: boolean; clipTop?: number } = {}): void {
    grid.forEach((row, j) => {
      if (y + j < (o.clipTop ?? 0)) return;
      for (let i = 0; i < row.length; i++) this.put(x + i, y + j, o.dim ? DIM[row[i]] ?? row[i] : row[i]);
    });
  }

  mirrored(): Sheet {
    const m = new Sheet();
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) m.px[y * FRAME_W + x] = this.px[y * FRAME_W + FRAME_W - 1 - x];
    return m;
  }
}

/* ---------- legs ---------- */

/**
 * A leg seen from the side, facing right, at six moments of its stride. Each grid is 12 rows, hip to sole;
 * the hip is at columns 3 to 6. 0 heel down in front, 1 taking the weight, 2 upright, 3 pushing off behind,
 * 4 lifted behind, 5 swinging through. The far leg plays the same six, three frames out of step.
 */
const LEG_SIDE: readonly Grid[] = [
  [
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '....qppP...',
    '....qppP...',
    '....qppP...',
    '.....qppP..',
    '.....qppP..',
    '.....dbbB..',
    '......dbbB.',
    '......dbbbB',
    '......DDDDD',
  ],
  [
    '...........',
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '....qppP...',
    '....qppP...',
    '....qppP...',
    '....qppP...',
    '....dbbB...',
    '....dbbB...',
    '....dbbbB..',
    '....DDDDD..',
  ],
  [
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '...dbbB....',
    '...dbbB....',
    '...dbbbB...',
    '...DDDDD...',
  ],
  [
    '...qppP....',
    '...qppP....',
    '..qppP.....',
    '..qppP.....',
    '..qppP.....',
    '.qppP......',
    '.qppP......',
    '.qppP......',
    'dbbB.......',
    'dbbB.......',
    '.dbbB......',
    '..DDD......',
  ],
  [
    '...........',
    '...qppP....',
    '...qppP....',
    '...qppP....',
    '..qppP.....',
    '..qppP.....',
    '.qqpp......',
    'dbqp.......',
    'dbbB.......',
    'DdbB.......',
    '.DD........',
    '...........',
  ],
  [
    '...qppP....',
    '...qppP....',
    '....qppP...',
    '....qppP...',
    '.....qppP..',
    '....qppP...',
    '....qppP...',
    '...qppP....',
    '...dbbB....',
    '...dbbbB...',
    '...DDDDD...',
    '...........',
  ],
];
const LEG_SIDE_STAND = LEG_SIDE[2];

/**
 * A leg seen from the front or back is a column. Its stride shows as the foot landing lower on screen
 * (toward the camera) or higher (away), by this many pixels for each of the six moments.
 */
const DROP_TOWARD = [2, 1, 0, -1, -2, -1];
const DROP_AWAY = [-2, -1, 0, 1, 0, -1];

function legFront(s: Sheet, L: Look, side: -1 | 1, phase: number, back: boolean, bob: number): void {
  const w = L.leg, x0 = side < 0 ? CX - L.stance / 2 - w : CX + L.stance / 2, x1 = x0 + w - 1;
  const drop = phase < 0 ? 0 : (back ? DROP_AWAY : DROP_TOWARD)[phase];
  // A foot lifted behind is in the body's shadow when walking toward the camera, and shows its sole walking away.
  const lifted = phase === 4, dim = lifted && !back;
  const sole = GROUND + drop, top = L.hip + bob;
  const cloth = side < 0 ? 'qpp' : 'qpP', hide = side < 0 ? 'dbb' : 'dbB';
  for (let y = top; y <= sole - 4; y++) s.span(y, x0, x1, cloth, dim);
  if (lifted && back) {
    s.span(sole - 3, x0, x1, hide);
    for (let y = sole - 2; y <= sole; y++) s.span(y, x0, x1, 'DdD');
    return;
  }
  s.span(sole - 3, x0, x1, hide, dim);
  s.span(sole - 2, x0, x1, hide, dim);
  if (back) {
    s.span(sole - 1, x0, x1, hide, dim);
    s.span(sole, x0, x1, 'D');
  } else {
    // toes point a little outward
    const t0 = side < 0 ? x0 - 1 : x0, t1 = side < 0 ? x1 : x1 + 1;
    s.span(sole - 1, t0, t1, side < 0 ? 'dbb' : 'bbB', dim);
    s.span(sole, t0, t1, 'D');
  }
}

/* ---------- arms ---------- */

type ArmPart = 'sleeve' | 'cuff' | 'skin' | 'glove';

function armRow(L: Look, i: number, len: number): ArmPart {
  const hand = len - 2, sleeve = L.sleeve ?? hand;
  if (i >= hand) return L.glove ? 'glove' : 'skin';
  if (i === sleeve - 1) return 'cuff';
  return i < sleeve ? 'sleeve' : 'skin';
}

/** The three letters (shadow side, middle, lit side) for a row of arm. `lit` is the arm on the light's side. */
function armInk(L: Look, part: ArmPart, lit: boolean): string {
  const tones = (m: Material, drop: number) => {
    const l = MATERIAL[m], i = (lit ? 2 : 1) - drop;
    return l[Math.max(0, i)] + l[Math.max(0, i + (lit ? 0 : 1))] + l[Math.max(0, i + 1)];
  };
  if (part === 'skin') return tones('skin', 0);
  if (part === 'glove') return tones('trim', 0);
  if (part === 'cuff') return L.cuff ? tones(L.cuff, 0) : tones(L.sleeveOf ?? 'coat', 1);
  return tones(L.sleeveOf ?? 'coat', 0);
}

function armFront(s: Sheet, L: Look, side: -1 | 1, swing: number, back: boolean, bob: number, tx: number, tw: number): void {
  const w = L.arm, x0 = side < 0 ? tx - w : tx + tw, x1 = x0 + w - 1;
  // An arm swung toward the camera reads longer, one swung away shorter.
  const toward = back ? -swing : swing;
  const len = L.armLen + (toward > 0 ? 1 : toward < 0 ? -1 : 0), y0 = L.neck + 1 + bob;
  for (let i = 0; i < len; i++) {
    const part = armRow(L, i, len), y = y0 + i;
    // the shoulder is rounded off, and so is a bare fist
    const round = i === 0 || (i === len - 1 && w > 2 && part !== 'sleeve');
    s.span(y, round && side < 0 ? x0 + 1 : x0, round && side > 0 ? x1 - 1 : x1, armInk(L, part, side > 0));
  }
}

function armSide(s: Sheet, L: Look, swing: number, bob: number, far: boolean): void {
  const w = Math.max(3, L.arm), len = L.armLen, y0 = L.neck + 1 + bob - (far ? 1 : 0), xs = CX - 2 + (far ? 1 : 0);
  for (let i = 0; i < len; i++) {
    const part = armRow(L, i, len), y = y0 + i;
    const x0 = xs + Math.round((swing * 1.5 * i) / (len - 1)), x1 = x0 + w - 1;
    // seen side-on an arm is round: shadow behind, light in front
    const ink = armInk(L, part, false).slice(0, 2) + armInk(L, part, true)[2];
    s.span(y, i === len - 1 ? x0 + 1 : x0, x1, i === 0 ? ink[1] + ink[1] + ink[2] : ink, far);
    // the near arm throws a line of shadow on the body behind it
    if (!far && i > 0 && i < len - 1) s.put(x0 - 1, y, MATERIAL[part === 'skin' ? 'skin' : L.sleeveOf ?? 'coat'][0]);
  }
}

/* ---------- coat skirts ---------- */

function skirtFront(s: Sheet, L: Look, p: Pose, back: boolean, left: number, right: number): void {
  const c = L.coat!, y0 = L.hip + p.bob, split = c.open && !back;
  for (const side of [-1, 1] as const) {
    // the half on the side of the leg stepping toward the camera hangs a pixel lower, the other a pixel higher
    const end = c.hem + p.bob + side * p.sway, n = end - y0;
    for (let y = y0; y <= end; y++) {
      const i = y - y0, flare = c.open && i >= n - 3 ? 1 : 0, hem = y === end, gap = split ? (i >= 2 ? 3 : 2) : 0;
      if (side < 0) s.span(y, left - flare, CX - gap - 1, hem ? 'Xxx' : 'xcc');
      else {
        s.span(y, CX + gap, right + flare, hem ? 'xxc' : 'ccC');
        if (!hem && !split) s.put(right + flare - 1, y, 'C');
      }
      if (split) continue;
      // the vent up the back, or the closing down the front
      if (back && side < 0 && i >= n - 3) s.put(CX - 1, y, 'X');
      if (!back && side > 0 && !hem) s.put(CX, y, 'x');
    }
  }
}

function skirtSide(s: Sheet, L: Look, p: Pose, x0: number, x1: number): void {
  const c = L.coat!, y0 = L.hip + p.bob, y1 = c.hem + p.bob, n = y1 - y0;
  for (let y = y0; y <= y1; y++) {
    const i = y - y0, t = i / n;
    const a = x0 - Math.floor(t * (1 + p.spread * 0.6) + 0.4), b = x1 - 1 + Math.floor(t * (0.5 + p.spread * 0.6));
    const hem = y === y1;
    s.span(y, a, b, hem ? 'Xxc' : 'xcC');
    if (!hem) {
      s.put(a + 1, y, 'x');
      s.put(b - 1, y, 'C');
      if (i >= 2) s.put(x0 + 3 - Math.floor(t * p.spread), y, 'x');
    }
  }
}

/* ---------- eyes ---------- */

const isEye = (ch: string | undefined) => ch === 'e' || ch === 'w';

/** The head with its eyes shut, lowered or glancing aside. Works on any head whose eyes are `e` (and `w`). */
function withEyes(head: Grid, eyes: Eyes): Grid {
  if (eyes === 'open') return head;
  const rows = head.map(r => [...r]);
  head.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!isEye(row[x])) continue;
      if (eyes === 'shut') rows[y][x] = isEye(head[y + 1]?.[x]) ? 's' : 'Z';
      else if (eyes === 'low') {
        if (isEye(head[y + 1]?.[x])) rows[y][x] = 'z';
      } else if (row[x] === 'e') {
        const to = x + (eyes === 'left' ? -1 : 1);
        if (row[to] && row[to] !== '.' && row[to] !== 'e') {
          rows[y][to] = 'e';
          rows[y][x] = row[to];
        }
      }
    }
  });
  return rows.map(r => r.join(''));
}

/* ---------- putting a body together ---------- */

/** Facing the camera (`back` false) or away from it. */
export function frontView(L: Look, p: Pose, back: boolean): Sheet {
  const s = new Sheet(), b = p.bob;
  const torso = back ? L.torso.up : L.torso.down, tw = torso[0].length, tx = CX - tw / 2;
  const head = back ? L.head.up : withEyes(L.head.down, p.eyes ?? 'open');
  // The person's left is on our right when they face us.
  const ours = (mine: 'left' | 'right'): -1 | 1 => ((mine === 'left') !== back ? 1 : -1);
  if (L.coat?.open && !back) for (let y = L.hip + b; y <= L.coat.hem + b - Math.abs(p.sway); y++) s.span(y, tx + 1, tx + tw - 2, 'X');
  legFront(s, L, ours('left'), p.legs[0], back, b);
  legFront(s, L, ours('right'), p.legs[1], back, b);
  if (L.coat) skirtFront(s, L, p, back, tx - L.arm + 1, tx + tw + L.arm - 2);
  s.stamp(torso, tx, L.neck + b);
  if (L.holds !== 'left' && !p.noArms) armFront(s, L, ours('left'), p.arms[0], back, b, tx, tw);
  if (L.holds !== 'right' && !p.noArms) armFront(s, L, ours('right'), p.arms[1], back, b, tx, tw);
  s.stamp(head, CX - head[0].length / 2, L.top + b + (p.nod ?? 0));
  L.detail?.(s, back ? 'up' : 'down', p);
  return s;
}

/** Facing right. `near` is which of the person's own sides we are looking at: their right, unless this frame
 *  is going to be flipped to face left. */
export function sideView(L: Look, p: Pose, near: 'left' | 'right'): Sheet {
  const s = new Sheet(), b = p.bob, n = near === 'left' ? 0 : 1, f = 1 - n;
  const torso = L.torso.side, tw = torso[0].length, tx = CX - tw / 2;
  const leg = (phase: number) => (phase < 0 ? LEG_SIDE_STAND : LEG_SIDE[phase]);
  if (L.holds !== (near === 'left' ? 'right' : 'left')) armSide(s, L, p.arms[f], b, true);
  // a heavy leg is the same drawing laid down twice, a pixel apart
  for (let k = L.leg > 3 ? 1 : 0; k >= 0; k--) s.stamp(leg(p.legs[f]), CX - 5 - k + (p.legs[f] < 0 ? 1 : 0), GROUND - 12, { dim: true, clipTop: L.hip + b });
  for (let k = L.leg > 3 ? 1 : 0; k >= 0; k--) s.stamp(leg(p.legs[n]), CX - 5 - k, GROUND - 11, { clipTop: L.hip + b });
  if (L.coat) skirtSide(s, L, p, tx, tx + tw - 1);
  s.stamp(torso, tx, L.neck + b);
  s.stamp(L.head.side, CX - L.head.side[0].length / 2, L.top + b + (p.nod ?? 0));
  if (L.holds !== near) armSide(s, L, p.arms[n], b, false);
  L.detail?.(s, near === 'left' ? 'left' : 'right', p);
  return s;
}

/* ---------- from letters to a canvas ---------- */

type RGB = readonly [number, number, number];

function rgb(hex: string): RGB {
  const v = parseInt(hex.slice(1), 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
}

/** The colour of every letter a person uses, by character code. */
function colours(L: Look): (RGB | undefined)[] {
  const out: (RGB | undefined)[] = [];
  const set = (ch: string, hex: string) => (out[ch.charCodeAt(0)] = rgb(hex));
  set('o', INK);
  set('e', '#1a1423');
  set('w', '#f6efd9');
  for (const [name, ramp] of Object.entries(L.ramps)) ramp.forEach((hex, i) => set(MATERIAL[name as Material][i], hex));
  for (const [ch, hex] of Object.entries(L.more ?? {})) set(ch, hex);
  return out;
}

const INK_RGB = rgb(INK);
/** How much of its own colour an outline keeps where the light catches it (top and right edges). */
const LIT_EDGE = 0.22;
/** The contact shadow under someone the renderer gives none: rows below GROUND - 1, and how far each reaches. */
const SHADOW = [7, 7, 7, 5], SHADOW_ALPHA = 90;

/**
 * Turn a painted frame into a canvas, adding the outline: ink below and to the left of the figure, and a
 * dark shade of the colour beside it on the top and right, where the light falls. `shadow` adds a contact
 * shadow at the feet, for people the renderer does not give one.
 */
function toCanvas(s: Sheet, pal: (RGB | undefined)[], shadow: boolean): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = FRAME_W;
  cv.height = FRAME_H;
  const g = cv.getContext('2d')!, img = g.createImageData(FRAME_W, FRAME_H), d = img.data;
  const set = (x: number, y: number, c: RGB, alpha = 255) => {
    const i = (y * FRAME_W + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = alpha;
  };
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const here = s.at(x, y);
      if (here) {
        const c = pal[here];
        if (!c) throw new Error(`people: no colour for '${String.fromCharCode(here)}'`);
        set(x, y, c);
        continue;
      }
      const below = s.at(x, y + 1), left = s.at(x - 1, y), above = s.at(x, y - 1), right = s.at(x + 1, y);
      if (below || left || above || right) {
        const lit = !above && !right ? pal[below || left] : undefined;
        set(x, y, lit ? [0, 1, 2].map(i => Math.round(lit[i] * LIT_EDGE + INK_RGB[i] * (1 - LIT_EDGE))) as unknown as RGB : INK_RGB);
      } else if (shadow) {
        const reach = SHADOW[y - (GROUND - 1)];
        if (reach && x >= CX - reach && x < CX + reach) set(x, y, INK_RGB, SHADOW_ALPHA);
      }
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

function check(L: Look): void {
  for (const part of [L.head, L.torso]) {
    for (const grid of Object.values(part)) {
      if (grid.some((row: string) => row.length !== grid[0].length)) throw new Error(`people: ragged grid starting '${grid[0]}'`);
    }
  }
}

/** Every frame of one person. */
export function build(L: Look): PersonSprites {
  check(L);
  const pal = colours(L), frames = [STAND, ...WALK];
  const cv = (s: Sheet, shadow = false) => toCanvas(s, pal, shadow);
  return {
    down: frames.map(p => cv(frontView(L, p, false))),
    up: frames.map(p => cv(frontView(L, p, true))),
    right: frames.map(p => cv(sideView(L, p, 'right'))),
    left: frames.map(p => cv(sideView(L, p, 'left').mirrored())),
    idle: L.idle.map(p => cv(frontView(L, p, false), true)),
  };
}
