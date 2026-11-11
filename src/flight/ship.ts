import { INK, PAL, SIGNAL } from '../art/palette';
import { LIGHT, PixelBuf } from './pixels';

/**
 * The player's freighter, seen from above with the nose to the right: a bone-painted hauler with rust
 * cargo-bay doors, a glazed cab with a painted bumper, a bare-metal engine block and two nacelles on
 * outriggers. Our own design: scruffy on purpose (a strapped-on coolant tank, a whip antenna, a dish and a
 * lamplit skylight on the living section).
 *
 * It is not drawn as a sprite and then turned. The ship is modelled once as a small relief (a height and a
 * paint for every point of the hull), and each of the 64 headings is lit and rasterised from that model
 * directly. That is what keeps the sunlight fixed in the world (upper right) while the ship turns, keeps
 * edges as clean as a freshly drawn sprite at every angle, and lets thin things (seams, struts, the
 * antenna) be drawn as unbroken one-pixel lines in every frame.
 *
 * Ship coordinates: x runs forward, y to starboard, in screen pixels, from the ship's position. At heading 0
 * a pixel column i covers x in [i, i+1) and a pixel row j covers y in [j-0.5, j+0.5], so edges are written
 * as whole numbers in x and halves in y, and one-pixel lines as halves in x and whole numbers in y.
 */

/** Screen pixels per pixel of this art. Native. */
export const SHIP_SCALE = 1;

/** The engine flame, in screen pixels: colours from the nozzle outward, and how long and wide each plume is. */
export const EXHAUST = {
  plume: ['#fff3c4', '#ffd27a', '#eab668', '#cf8048', '#8a4238'],
  embers: ['#cf8048', '#8a4238', '#57293a'],
  main: { length: 26, halfWidth: 4.2 },
  nacelle: { length: 10, halfWidth: 1.5 },
} as const;

export const SHIP_FRAMES = 64;
/** Rotated frames are square; the ship's position maps to this point within them (a pixel edge in x, a pixel centre in y). */
export const FRAME_SIZE = 64, FRAME_PIVOT_X = 32, FRAME_PIVOT_Y = 31;

/** Offsets from the ship's position with the nose pointing right. */
export const SHIP_POINTS = {
  mainNozzle: { x: -28.5, y: 0 },
  nacelleNozzles: [{ x: -23.5, y: -16 }, { x: -23.5, y: 16 }],
  portLight: { x: -4.5, y: -19 },
  starboardLight: { x: -4.5, y: 19 },
} as const;

/* ---------- paints ---------- */

/** The hull's own ramp: the master bone ramp with two in-between shades, so a big pale surface can turn gently. */
const HULL = ['#4a4038', '#5e5347', '#7a6b5c', '#94806f', '#ab9780', '#c2ad90', '#d4c2a4', '#e3d5b8', '#f6efd9'];

/**
 * A paint is a ramp and the shade a flat, upward-facing surface takes. Light and shadow move the shade up
 * and down the ramp from there (`gain` shades per step of light); `lo` and `hi` stop it running off into
 * colours that read as another material.
 */
interface Paint { ramp: readonly string[]; flat: number; gain?: number; lo?: number; hi?: number; gloss?: boolean }
const PAINTS = {
  bone: { ramp: HULL, flat: 6, gain: 1.5, lo: 1 },
  steel: { ramp: PAL.steel, flat: 5, lo: 2 },
  gun: { ramp: PAL.steel, flat: 4, lo: 1, hi: 7 },
  iron: { ramp: PAL.steel, flat: 3, lo: 1, hi: 6 },
  rust: { ramp: PAL.rust, flat: 5, lo: 1 },
  amber: { ramp: PAL.amber, flat: 4, lo: 1 },
  glass: { ramp: PAL.teal, flat: 2, gloss: true },
  dark: { ramp: PAL.night, flat: 2, hi: 5 },
  copper: { ramp: PAL.amber, flat: 2, lo: 0, hi: 4 },
  coolant: { ramp: PAL.teal, flat: 3, lo: 1, hi: 5 },
} satisfies Record<string, Paint>;
type PaintName = keyof typeof PAINTS;
const PAINT_NAMES = Object.keys(PAINTS) as PaintName[];
const PAINT_LIST: Paint[] = PAINT_NAMES.map(n => PAINTS[n]);
const paintId = (n: PaintName) => PAINT_NAMES.indexOf(n) + 1; // 0 is "nothing here"

/* ---------- the model ---------- */

/** Samples per pixel in the model. Odd, so a pixel's centre at heading 0 is exactly a sample. */
const MS = 5;
const X0 = -32, Y0 = -24.5, MW = 64 * MS, MH = 49 * MS;

/** Named pieces, so details can say which piece they belong on and not spill onto its neighbours. */
const enum P { None, Bell, Engine, Hull, Hatch, Glass, Pylon, Nacelle, NacNozzle, Fitting, Dish, Reactor, Tank }

type Box = readonly [number, number, number, number];
type Height = (x: number, y: number) => number;

interface Model {
  part: Uint8Array; paint: Uint8Array; tint: Int8Array;
  h: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array;
}

/** A one-pixel line (or a single pixel) laid over the lit model in every frame. */
interface Stroke {
  ax: number; ay: number; bx: number; by: number;
  /** Pieces it may touch; empty means any piece. */
  on: readonly P[];
  /** Shades to move along the ramp of whatever is underneath. */
  d: number;
  /** Repaint instead (0 keeps the paint underneath). */
  paint: number;
  /** A fixed colour that ignores the light (lamps). */
  hex?: string;
  /** Draw over empty space too: struts, pipes, the antenna. */
  make: boolean;
}

/** How far a rounded edge of radius r has dropped, d pixels in from the edge. */
const roundOff = (d: number, r: number) => (d >= r ? 0 : r - Math.sqrt(r * r - (r - d) * (r - d)));

/** Inward distance from the edges of a convex polygon (negative outside). */
function polygon(pts: readonly (readonly [number, number])[]): Height {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    area += ax * by - bx * ay;
  }
  const sign = area > 0 ? 1 : -1;
  const edges = pts.map(([ax, ay], i) => {
    const [bx, by] = pts[(i + 1) % pts.length], len = Math.hypot(bx - ax, by - ay);
    return [ax, ay, (-(by - ay) / len) * sign, ((bx - ax) / len) * sign] as const;
  });
  return (x, y) => {
    let d = Infinity;
    for (const [ax, ay, nx, ny] of edges) d = Math.min(d, (x - ax) * nx + (y - ay) * ny);
    return d;
  };
}

/** Half-width of a body along its length, joined by straight runs. */
function profile(pts: readonly (readonly [number, number])[]): (x: number) => number {
  return x => {
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const [xa, wa] = pts[i - 1], [xb, wb] = pts[i];
        return xb === xa ? wb : wa + ((wb - wa) * (x - xa)) / (xb - xa);
      }
    }
    return pts[pts.length - 1][1];
  };
}

interface BodyShape { top: number; r?: number; crown?: number; flat?: number; tube?: boolean; base?: number; chamfer?: number }
/**
 * A body lying along x, centred on y = cy: `half` is its half-width along its length. `top` is the height of
 * its roof and `r` rounds its edges. A slab's roof is level across the middle `flat` of its width and falls
 * away by `crown` toward the sides; a `tube` is round in section, like a tank.
 */
function body(cy: number, xa: number, xb: number, half: (x: number) => number, o: BodyShape): Height {
  const r = o.r ?? 1, crown = o.crown ?? 0, base = o.base ?? 0, chamfer = o.chamfer ?? 0, flat = o.flat ?? 0;
  return (x, y) => {
    if (x < xa || x > xb) return -1;
    const w = half(x), dy = Math.abs(y - cy), side = w - dy, end = Math.min(x - xa, xb - x);
    if (side < 0 || side + end < chamfer) return -1;
    if (o.tube) return base + (o.top - base) * Math.sqrt(Math.max(0, 1 - (dy / w) * (dy / w))) - roundOff(end, r);
    const t = Math.max(0, dy / w - flat) / (1 - flat);
    return o.top - crown * t * t - roundOff(Math.min(side, end, (side + end - chamfer) * 0.7 + 0.3), r);
  };
}

function buildModel(): { model: Model; strokes: Stroke[] } {
  const n = MW * MH;
  const m: Model = {
    part: new Uint8Array(n), paint: new Uint8Array(n), tint: new Int8Array(n),
    h: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
  };
  const strokes: Stroke[] = [];

  /** Visit the model samples inside a box of ship coordinates. */
  const scan = (b: Box, fn: (i: number, x: number, y: number) => void) => {
    const u0 = Math.max(0, Math.floor((b[0] - X0) * MS)), u1 = Math.min(MW, Math.ceil((b[2] - X0) * MS));
    const v0 = Math.max(0, Math.floor((b[1] - Y0) * MS)), v1 = Math.min(MH, Math.ceil((b[3] - Y0) * MS));
    for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) fn(v * MW + u, X0 + (u + 0.5) / MS, Y0 + (v + 0.5) / MS);
  };
  const flip = (b: Box): Box => [b[0], -b[3], b[2], -b[1]];

  /** Add a solid piece: wherever it stands taller than what is already there, it is what you see. */
  const solid = (part: P, paint: PaintName, box: Box, height: Height) => {
    const p = paintId(paint);
    scan(box, (i, x, y) => {
      const hh = height(x, y);
      if (hh > m.h[i]) { m.h[i] = hh; m.part[i] = part; m.paint[i] = p; m.tint[i] = 0; }
    });
  };
  /** The same piece on both sides of the centre line. */
  const solids = (part: P, paint: PaintName, box: Box, height: Height) => {
    solid(part, paint, box, height);
    solid(part, paint, flip(box), (x, y) => height(x, -y));
  };

  interface Mark { paint?: PaintName; raise?: number; tint?: number; as?: P; where?: (x: number, y: number) => boolean }
  /** Repaint, raise, dirty or rename part of a piece. */
  const mark = (on: P | readonly P[], box: Box, o: Mark) => {
    const parts = typeof on === 'number' ? [on] : on;
    scan(box, (i, x, y) => {
      if (!parts.includes(m.part[i]) || (o.where && !o.where(x, y))) return;
      if (o.paint) m.paint[i] = paintId(o.paint);
      if (o.raise) m.h[i] += o.raise;
      if (o.tint) m.tint[i] += o.tint;
      if (o.as) m.part[i] = o.as;
    });
  };
  const marks = (on: P | readonly P[], box: Box, o: Mark) => {
    mark(on, box, o);
    mark(on, flip(box), { ...o, where: o.where && ((x, y) => o.where!(x, -y)) });
  };

  interface Ink { d?: number; paint?: PaintName; hex?: string; make?: boolean }
  const line = (on: P | readonly P[], ax: number, ay: number, bx: number, by: number, o: Ink) => {
    strokes.push({ ax, ay, bx, by, on: typeof on === 'number' ? [on] : on, d: o.d ?? 0, paint: o.paint ? paintId(o.paint) : 0, hex: o.hex, make: !!o.make });
  };
  const lines = (on: P | readonly P[], ax: number, ay: number, bx: number, by: number, o: Ink) => {
    line(on, ax, ay, bx, by, o);
    line(on, ax, -ay, bx, -by, o);
  };
  /** One pixel, by its column and row at heading 0. */
  const dot = (on: P | readonly P[], col: number, row: number, o: Ink) => line(on, col + 0.5, row, col + 0.5, row, o);
  const dots = (on: P | readonly P[], col: number, row: number, o: Ink) => { dot(on, col, row, o); dot(on, col, -row, o); };

  /* --- main engine nozzle: a stubby barrel --- */
  solid(P.Bell, 'iron', [-28, -5, -22, 5], body(0, -28, -21, () => 4.5, { top: 3.2, base: 1.4, tube: true, r: 0.8, chamfer: 1 }));
  mark(P.Bell, [-28, -6, -27, 6], { tint: 1 }); // the lip
  line(P.Bell, -24.5, -4, -24.5, 4, { d: -1 }); // a stiffening ring

  /* --- engine block: bare metal, lower than the hull --- */
  solid(P.Engine, 'gun', [-22, -8, -14, 8], body(0, -22, -13, () => 7.5, { top: 3.7, r: 0.9, chamfer: 1 }));
  // reactor cap: a pale dome with a pilot lamp
  solid(P.Reactor, 'steel', [-21, -3, -14, 3], (x, y) => {
    const d2 = ((x + 17.5) * (x + 17.5) + y * y) / (2.6 * 2.6);
    return d2 > 1 ? -1 : 3.9 + 1.4 * Math.sqrt(1 - d2);
  });
  mark(P.Reactor, [-21, -3, -14, 3], { tint: 1 });
  dot(P.Reactor, -18, 0, { hex: SIGNAL.amber });
  // starboard: a radiator grille; port: a coolant tank strapped on
  for (const col of [-21, -19, -17]) line(P.Engine, col + 0.5, 5, col + 0.5, 6, { d: -2 });
  solid(P.Tank, 'coolant', [-21, -6.5, -15, -3.5], body(-5, -21, -15, () => 1.5, { top: 4.9, base: 3.4, tube: true, r: 0.8 }));
  line(P.Tank, -18.5, -6, -18.5, -4, { d: -2 });

  /* --- hull: cargo section, shoulders, living section, cab --- */
  const hullHalf = profile([[-14, 9.5], [5, 9.5], [7, 7.5], [20, 7.5], [22, 6.5], [24, 5.5], [25, 4.5], [26, 3.5]]);
  solid(P.Hull, 'bone', [-14, -10, 26, 10], body(0, -14, 26, hullHalf, { top: 4.9, r: 1.8, crown: 2, flat: 0.5, chamfer: 1 }));

  // cargo-bay doors, proud of the deck and meeting at a shallow ridge, with hazard paint at either end
  mark(P.Hull, [-12, -5.5, 4, 5.5], { paint: 'rust', as: P.Hatch });
  scan([-12, -5.5, 4, 5.5], (i, _x, y) => { if (m.part[i] === P.Hatch) m.h[i] = 5.4 + 1.2 * (1 - Math.abs(y) / 5.5); });
  line(P.Hatch, -12, 0, 4, 0, { d: -2 });
  for (const col of [-8, -4, 0]) lines(P.Hatch, col + 0.5, 1, col + 0.5, 5.5, { d: -1 });
  for (const b of [[-14, -5.5, -12, 5.5], [4, -5.5, 6, 5.5]] as const) {
    mark(P.Hull, b, { paint: 'amber' });
    mark(P.Hull, b, { paint: 'dark', where: (x, y) => ((((x + y + 40) % 4) + 4) % 4) < 2 });
  }

  // plating: seams where the sections join and across the side decks, a panel from another ship, tie-down points
  line(P.Hull, 7.5, -7, 7.5, 7, { d: -1 });
  line(P.Hull, 13.5, -7, 13.5, 7, { d: -1 });
  lines(P.Hull, -4.5, 6, -4.5, 9, { d: -1 });
  mark(P.Hull, [-4, -8.5, 1, -5.5], { tint: -1 });
  mark(P.Hull, [24, -6, 26, 6], { paint: 'rust' }); // a painted bumper on the nose
  for (const col of [-10, -7, -2, 1]) dots(P.Hull, col, 7, { d: -2 });
  // grime: soot where the hull meets the engine, a streak aft of the dish
  marks(P.Hull, [-14, 5.5, -12.5, 10], { tint: -1 });

  /* --- cab: a glazed nose --- */
  const crownOfCab = polygon([[14, -2.5], [18, -2.5], [19, -1.5], [19, 1.5], [18, 2.5], [14, 2.5]]);
  solid(P.Glass, 'glass', [14, -7, 25, 7], (x, y) => {
    if (x < 14 || x > 24.5 || Math.abs(y) > hullHalf(x + 1.5) - 1) return -1;
    const out = Math.max(0, -crownOfCab(x, y));
    return 7.4 - 0.09 * out * out - 0.2 * out;
  });
  // glazing bars: one across the roof, one back along the spine
  line(P.Glass, 18.5, -6.5, 18.5, 6.5, { paint: 'bone', d: -1 });
  line(P.Glass, 14, 0, 18, 0, { paint: 'bone', d: -1 });

  /* --- outriggers and nacelles --- */
  const pylon = polygon([[-12, 9], [-4, 9], [-6, 13], [-12, 13]]);
  solids(P.Pylon, 'steel', [-12, 9, -4, 13], (x, y) => {
    const d = pylon(x, y);
    return d < 0 ? -1 : 2.3 - roundOff(d, 0.9);
  });
  lines(P.Pylon, -8.5, 9.5, -8.5, 12.5, { d: -1 });
  const nacHalf = profile([[-20, 3.5], [-1, 3.5], [1, 2.5]]);
  solids(P.Nacelle, 'steel', [-20, 12.5, 1, 19.5], body(16, -20, 1, nacHalf, { top: 3.8, base: 0.7, tube: true, r: 1 }));
  solids(P.NacNozzle, 'iron', [-23, 13.5, -20, 18.5], body(16, -23, -19, () => 2.5, { top: 3, base: 0.9, tube: true, r: 0.5 }));
  marks(P.Nacelle, [-9, 12, -1, 20], { paint: 'bone' });
  marks(P.Nacelle, [-11, 12, -9, 20], { paint: 'amber' });
  marks(P.Nacelle, [-1, 12, 1, 20], { paint: 'iron' });
  marks(P.Nacelle, [-20, 12, -18, 20], { tint: -1 }); // heat stain
  lines(P.Nacelle, -14.5, 12.5, -14.5, 19.5, { d: -1 });
  lines(P.Nacelle, -4.5, 12.5, -4.5, 19.5, { d: -1 });
  dots(P.Nacelle, -5, 19, { d: -3 }); // running-lamp housings: the renderer lights them red and green
  // a fuel line from the engine block out to each nacelle
  lines(P.None, -17.5, 7.5, -17.5, 12.5, { paint: 'copper', make: true });

  /* --- roof gear on the living section --- */
  solid(P.Dish, 'steel', [8, -5.5, 13, -0.5], (x, y) => {
    const d2 = ((x - 10.5) * (x - 10.5) + (y + 3) * (y + 3)) / (2.5 * 2.5);
    return d2 > 1 ? -1 : 5.4 + 1.2 * Math.sqrt(1 - d2);
  });
  dot(P.Dish, 10, -3, { d: -3 });
  // a skylight over the galley, lamplit from below
  mark(P.Hull, [9, 1.5, 13, 5.5], { tint: -2 });
  for (const col of [10, 11]) for (const row of [3, 4]) dot(P.Hull, col, row, { hex: row === 3 ? PAL.amber[5] : PAL.amber[4] });
  line(P.None, 11, -7.5, 16, -12.5, { paint: 'steel', make: true }); // whip antenna

  return { model: m, strokes };
}

/* ---------- lighting and rasterising one heading ---------- */

/** How far up or down its ramp a surface moves for the light falling on it (0 = a flat roof in full sun). */
const lightStep = (l: number) => (l < 0.52 ? (l - 0.52) / 0.22 : (l - 0.52) / 0.2);

/** Normals from the finished relief, so that every step between pieces gets a lit rim and a shaded one. */
function computeNormals(m: Model): void {
  const D = (MS + 1) / 2, span = (2 * D) / MS; // reaches just into the neighbouring pixel
  const at = (u: number, v: number, own: number) => {
    const hh = u < 0 || v < 0 || u >= MW || v >= MH ? 0 : m.h[v * MW + u];
    // A much taller neighbour is a wall beside us, not a slope under us; a drop counts for at most a bevel.
    return Math.max(own - 1.1, Math.min(own + 0.12, hh));
  };
  for (let v = 0; v < MH; v++) {
    for (let u = 0; u < MW; u++) {
      const i = v * MW + u;
      if (!m.part[i]) continue;
      const own = m.h[i];
      const gx = (at(u + D, v, own) - at(u - D, v, own)) / span, gy = (at(u, v + D, own) - at(u, v - D, own)) / span;
      const len = Math.hypot(gx, gy, 1);
      m.nx[i] = -gx / len; m.ny[i] = -gy / len; m.nz[i] = 1 / len;
    }
  }
}

function renderFrame(m: Model, strokes: readonly Stroke[], heading: number): PixelBuf {
  const S = FRAME_SIZE, cos = Math.cos(heading), sin = Math.sin(heading);
  // the sun, turned into the ship's own axes
  const lx = LIGHT[0] * cos + LIGHT[1] * sin, ly = -LIGHT[0] * sin + LIGHT[1] * cos, lz = LIGHT[2];
  const flatLen = Math.hypot(lx, ly), sx = lx / flatLen, sy = ly / flatLen, rise = lz / flatLen;
  // halfway between the sun and the eye, for glints on glass
  const hl = Math.hypot(lx, ly, lz + 1), hx = lx / hl, hy = ly / hl, hz = (lz + 1) / hl;

  const paint = new Uint8Array(S * S), shade = new Int8Array(S * S), part = new Uint8Array(S * S);
  const fixed = new Map<number, string>();
  const sample = (x: number, y: number) => {
    const u = Math.floor((x - X0) * MS), v = Math.floor((y - Y0) * MS);
    return u < 0 || v < 0 || u >= MW || v >= MH ? -1 : v * MW + u;
  };
  const clampTo = (p: Paint, idx: number) => Math.max(p.lo ?? 0, Math.min(p.hi ?? p.ramp.length - 1, idx));

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      // A hair off the pixel centre, so that at quarter turns (where centres land on the model's pixel edges) every pixel falls the same way.
      const rx = px + 0.5 - FRAME_PIVOT_X + 1e-3, ry = py - FRAME_PIVOT_Y + 1e-3;
      const x = rx * cos + ry * sin, y = -rx * sin + ry * cos;
      const i = sample(x, y);
      if (i < 0 || !m.part[i]) continue;
      const p = PAINT_LIST[m.paint[i] - 1], own = m.h[i];
      let step = lightStep(m.nx[i] * lx + m.ny[i] * ly + m.nz[i] * lz);
      // cast shadow: walk toward the sun and see whether anything stands in the way
      for (let k = 1; k <= 12; k++) {
        const d = k * 0.7, j = sample(x + sx * d, y + sy * d);
        if (j >= 0 && m.h[j] > own + d * rise + 0.45) { step = Math.min(step, 0) - 1; break; }
      }
      let idx = p.flat + Math.round(step * (p.gain ?? 1)) + m.tint[i];
      if (p.gloss) {
        const spec = m.nx[i] * hx + m.ny[i] * hy + m.nz[i] * hz;
        if (spec > 0.985) idx = p.ramp.length - 1;
        else if (spec > 0.955) idx = Math.max(idx, p.ramp.length - 2);
      }
      const o = py * S + px;
      paint[o] = m.paint[i];
      part[o] = m.part[i];
      shade[o] = clampTo(p, idx);
    }
  }

  // No orphans: a pixel that matches none of its neighbours is noise from the sampling, so it joins them.
  for (let py = 1; py < S - 1; py++) {
    for (let px = 1; px < S - 1; px++) {
      const o = py * S + px;
      if (!paint[o]) continue;
      const around = [o - 1, o + 1, o - S, o + S];
      if (around.some(q => paint[q] === paint[o] && shade[q] === shade[o])) continue;
      const kin = around.filter(q => paint[q] === paint[o]);
      const pool = kin.length ? kin : around.filter(q => paint[q]);
      if (!pool.length) continue;
      let best = pool[0], bestN = 0;
      for (const q of pool) {
        const count = pool.filter(r => paint[r] === paint[q] && shade[r] === shade[q]).length;
        if (count > bestN) { best = q; bestN = count; }
      }
      paint[o] = paint[best]; shade[o] = shade[best]; part[o] = part[best];
    }
  }

  // seams, struts and rivets, placed from the model and drawn fresh in this frame's own pixels
  const stamp = (px: number, py: number, s: Stroke) => {
    if (px < 0 || py < 0 || px >= S || py >= S) return;
    const o = py * S + px;
    if (!paint[o]) {
      if (!s.make) return;
      paint[o] = s.paint;
      shade[o] = clampTo(PAINT_LIST[s.paint - 1], PAINT_LIST[s.paint - 1].flat + s.d);
      part[o] = P.Fitting;
    } else {
      if (s.on.length && !s.on.includes(part[o])) return;
      const was = PAINT_LIST[paint[o] - 1];
      if (s.paint && s.paint !== paint[o]) {
        const now = PAINT_LIST[s.paint - 1];
        shade[o] = clampTo(now, now.flat + (shade[o] - was.flat) + s.d);
        paint[o] = s.paint;
      } else {
        shade[o] = clampTo(was, shade[o] + s.d);
      }
    }
    if (s.hex) fixed.set(o, s.hex); else fixed.delete(o);
  };
  const toFrame = (x: number, y: number) => [FRAME_PIVOT_X + x * cos - y * sin, FRAME_PIVOT_Y + 0.5 + x * sin + y * cos] as const;
  for (const s of strokes) {
    let [ax, ay] = toFrame(s.ax, s.ay), [bx, by] = toFrame(s.bx, s.by);
    const dx = bx - ax, dy = by - ay;
    if (Math.hypot(dx, dy) < 0.5) {
      stamp(Math.floor((ax + bx) / 2 + 1e-3), Math.floor((ay + by) / 2 + 1e-3), s);
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      if (ax > bx) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
      for (let px = Math.ceil(ax - 0.5 - 1e-3); px + 0.5 <= bx + 1e-3; px++) stamp(px, Math.floor(ay + ((px + 0.5 - ax) * (by - ay)) / (bx - ax) + 1e-3), s);
    } else {
      if (ay > by) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
      for (let py = Math.ceil(ay - 0.5 - 1e-3); py + 0.5 <= by + 1e-3; py++) stamp(Math.floor(ax + ((py + 0.5 - ay) * (bx - ax)) / (by - ay) + 1e-3), py, s);
    }
  }

  const out = new PixelBuf(S, S);
  for (let o = 0; o < S * S; o++) {
    if (paint[o]) out.put(o % S, Math.floor(o / S), fixed.get(o) ?? PAINT_LIST[paint[o] - 1].ramp[shade[o]]);
  }
  out.outline(INK);
  return out;
}

/** One canvas per heading, evenly spaced around the circle, clockwise from nose-right. */
export function makeShipFrames(): HTMLCanvasElement[] {
  const { model, strokes } = buildModel();
  computeNormals(model);
  return Array.from({ length: SHIP_FRAMES }, (_, i) => renderFrame(model, strokes, (i / SHIP_FRAMES) * Math.PI * 2).toCanvas());
}
