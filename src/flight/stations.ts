import type { PortType } from '../sim/types';
import { LIGHT, PixelBuf, bay, hueFor, hueShifted, rng, shade } from './pixels';

/**
 * One station design per port type, drawn from above and centred on the port's position.
 * The four core ports are shown as drawn; generated ports get the same build in other colours.
 * Each has a docking arm pointing left whose collar ends where a berthed ship's
 * nose sits (the ship itself is centred ARM = 58 px left of the port).
 */

export interface StationLight {
  x: number;
  y: number;
  colour: string;
  /** Seconds per blink cycle. */
  period: number;
  /** Offset into the cycle, in seconds. */
  phase: number;
  /** Fraction of the cycle the light is on. */
  duty: number;
  halo?: boolean;
}

export interface StationSprite {
  canvas: HTMLCanvasElement;
  /** Half the canvas size; the port sits at (half, half). */
  half: number;
  /** Rough radius, for the course brackets. */
  extent: number;
  lights: StationLight[];
  /** A rotating beacon lamp, if the station has one. */
  lamp?: { x: number; y: number };
  /** Where a welder occasionally sparks. */
  sparks?: { x: number; y: number };
  /** A conveyor whose ore the renderer animates. */
  belt?: { x0: number; y0: number; x1: number; y1: number };
}

const HALF = 88;
const OL = '#15121f';
const METAL = ['#2f3148', '#555a72', '#8a8fa3', '#c3c6d4', '#eef0f5'];
const AMBER = '#eab668', RED = '#ff6b5a', GREEN = '#7df0b0', TEAL = '#7fd1c7', WHITE = '#fff6e0';

type Ramp3 = readonly [string, string, string]; // dark, mid, light
const STEEL: Ramp3 = [METAL[1], METAL[2], METAL[3]];
const BONE: Ramp3 = ['#94806f', '#c2ad90', '#e3d5b8'];
const RUST: Ramp3 = ['#8f3b33', '#c8553d', '#e07a5f'];
const TEALS: Ramp3 = ['#24504a', '#3f8f8a', '#7fd1c7'];

/** A drawing surface whose origin is the port's position. */
class Art {
  readonly buf = new PixelBuf(HALF * 2, HALF * 2);
  put(x: number, y: number, c: string): void { this.buf.put(HALF + x, HALF + y, c); }
  rect(x: number, y: number, w: number, h: number, c: string): void { this.buf.rect(HALF + x, HALF + y, w, h, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: string): void { this.buf.line(HALF + x0, HALF + y0, HALF + x1, HALF + y1, c); }
  /** A plate lit from the upper right: light top and right edges, dark bottom and left. */
  box(x: number, y: number, w: number, h: number, [d, m, l]: Ramp3): void {
    this.rect(x, y, w, h, m);
    this.rect(x, y + h - 1, w, 1, d);
    this.rect(x, y, 1, h, d);
    this.rect(x, y, w, 1, l);
    this.rect(x + w - 1, y, 1, h - 1, l);
  }
  /** A horizontal tube: light along the top, dark underneath. */
  hbar(x: number, y: number, w: number, h: number, [d, m, l]: Ramp3): void {
    this.rect(x, y, w, h, m);
    this.rect(x, y, w, 1, l);
    this.rect(x, y + h - 1, w, 1, d);
  }
  /** A vertical tube: light down the right, dark down the left. */
  vbar(x: number, y: number, w: number, h: number, [d, m, l]: Ramp3): void {
    this.rect(x, y, w, h, m);
    this.rect(x + w - 1, y, 1, h, l);
    this.rect(x, y, 1, h, d);
  }
  disc(cx: number, cy: number, r: number, fn: (dx: number, dy: number, d: number, x: number, y: number) => string | null): void {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r + 0.3) continue;
        const c = fn(dx, dy, d, HALF + cx + dx, HALF + cy + dy);
        if (c) this.put(cx + dx, cy + dy, c);
      }
    }
  }
  /** A dither-shaded ball (tank, dome cap). */
  ball(cx: number, cy: number, r: number, ramp: readonly string[]): void {
    this.disc(cx, cy, r, (dx, dy, d, x, y) => {
      const nz = Math.sqrt(Math.max(0, 1 - (d / (r + 0.5)) ** 2));
      const l = (dx / (r + 0.5)) * LIGHT[0] + (dy / (r + 0.5)) * LIGHT[1] + nz * LIGHT[2];
      return shade(ramp, 0.12 + l * 0.9, x, y, 0.5);
    });
  }
  finish(): HTMLCanvasElement {
    this.buf.outline(OL);
    return this.buf.toCanvas();
  }
}

/** A solar array in 5px cells with a diagonal sheen. `cols` = frame, dark, base, light. */
function panel(a: Art, x: number, y: number, w: number, h: number, cols: readonly [string, string, string, string]): void {
  a.rect(x, y, w, h, cols[0]);
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const u = (i - 1) % 6, v = (j - 1) % 6;
      if (u === 5 || v === 5) continue;
      a.put(x + i, y + j, u - v >= 2 ? cols[3] : u - v >= -2 ? cols[2] : cols[1]);
    }
  }
}

/** Where a berthed ship's nose ends: every docking arm stops here. */
const TIP = -42;

/** The docking collar at the end of an arm, with a pair of approach lights. */
function collar(a: Art, lights: StationLight[], ramp: Ramp3, halfHeight: number, period: number): void {
  a.box(TIP, -halfHeight, 3, halfHeight * 2 + 1, ramp);
  for (const s of [-1, 1]) {
    lights.push({ x: TIP + 1, y: s * (halfHeight + 1), colour: AMBER, period, phase: s > 0 ? period / 2 : 0, duty: 0.5, halo: true });
  }
}

/* ---------- Kestrel Station: the big, polished ring ---------- */
function kestrel(): StationSprite {
  const a = new Art();
  const lights: StationLight[] = [];
  const BLUE = [OL, '#22395a', '#2f5580', '#5f9bb8'] as const;

  // solar wings above and below
  for (const s of [-1, 1]) {
    const y0 = s < 0 ? -54 : 42;
    panel(a, -21, y0, 43, 13, BLUE);
    a.vbar(-1, s < 0 ? -41 : 33, 3, 9, STEEL);
    lights.push(
      { x: -22, y: y0 + 6, colour: RED, period: 2.4, phase: 0, duty: 0.5 },
      { x: 22, y: y0 + 6, colour: GREEN, period: 2.4, phase: 1.2, duty: 0.5 },
    );
  }

  // berth cradle: two gantries either side of where a ship parks
  for (const s of [-1, 1]) {
    a.hbar(-74, s * 19 - 1, 50, 2, STEEL);
    for (const x of [-68, -58, -48]) a.put(x, s * 19 - (s > 0 ? 1 : 0), AMBER);
    lights.push({ x: -75, y: s * 19 - (s > 0 ? 1 : 0), colour: TEAL, period: 1.6, phase: s > 0 ? 0.8 : 0, duty: 0.35, halo: true });
  }

  // freight clamped to the ring, a comms mast and dish
  a.box(22, 27, 8, 5, RUST);
  a.rect(25, 28, 1, 3, RUST[0]);
  a.box(31, 24, 6, 5, TEALS);
  a.box(25, 33, 6, 4, BONE);
  a.hbar(33, -1, 8, 2, STEEL);
  a.disc(45, 0, 5, (dx, dy, d, x, y) => {
    if (d > 4.3) return METAL[3];
    const l = (-(dx * LIGHT[0] + dy * LIGHT[1]) / 5) * 0.5 + 0.5; // concave: lit on the far side
    return shade(METAL, 0.3 + l * 0.5, x, y, 0.4);
  });
  a.put(45, 0, METAL[0]);
  a.put(46, -1, AMBER);

  // docking arm
  a.hbar(TIP + 3, -3, 8, 7, STEEL);
  for (const x of [-37, -35, -33]) a.put(x, 0, AMBER);
  collar(a, lights, [METAL[1], METAL[3], METAL[4]], 4, 1);

  // spokes and stay cables
  a.hbar(-26, -2, 52, 4, STEEL);
  a.vbar(-2, -26, 4, 52, STEEL);
  for (const k of [-19, -13, 12, 18]) {
    a.rect(k, -2, 1, 4, METAL[1]);
    a.rect(-2, k, 4, 1, METAL[1]);
  }
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) a.line(sx * 8, sy * 8, sx * 19, sy * 19, METAL[1]);

  // the ring itself
  for (let y = -34; y <= 34; y++) {
    for (let x = -34; x <= 34; x++) {
      const d = Math.hypot(x, y);
      if (d < 25.6 || d > 33.4) continue;
      const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      let t = 0.32 + (((x * LIGHT[0] + y * LIGHT[1]) / d) * 0.5 + 0.5) * 0.6;
      if (Math.abs(d - 29.5) < 0.6) t -= 0.22; // service groove
      if (deg % 30 < 1.5 || deg % 30 > 28.5) t -= 0.3; // segment seams
      a.put(x, y, shade(METAL, t, HALF + x, HALF + y, 0.3));
    }
  }
  for (let k = 0; k < 36; k++) {
    const ang = ((k * 10 + 5) * Math.PI) / 180;
    const c = k % 4 === 0 ? AMBER : k % 4 === 2 ? '#3f8f8a' : k % 4 === 1 ? '#ffd27a' : null;
    if (c) a.put(Math.round(Math.cos(ang) * 31.6), Math.round(Math.sin(ang) * 31.6), c);
  }

  // hub with a glass dome
  a.disc(0, 0, 10, (dx, dy, d, x, y) => {
    const nz = Math.sqrt(Math.max(0, 1 - (d / 10.5) ** 2));
    let t = 0.25 + ((dx / 10.5) * LIGHT[0] + (dy / 10.5) * LIGHT[1] + nz * LIGHT[2]) * 0.7;
    if (Math.abs(d - 7) < 0.5) t -= 0.25;
    return shade(METAL, t, x, y, 0.4);
  });
  a.ball(0, 0, 4, ['#24504a', '#3f8f8a', '#7fd1c7', '#d7f5ee']);
  a.put(1, -2, '#ffffff');
  lights.push({ x: 0, y: -10, colour: WHITE, period: 3, phase: 0.5, duty: 0.1 });

  return { canvas: a.finish(), half: HALF, extent: 50, lights };
}

/* ---------- Marrow's Rest: a farm moon's orbital dock ---------- */
const FIELDS = [
  ['#1f3f3c', '#2f6a4e', '#52955c', '#8fc47a'],
  ['#2f6a4e', '#52955c', '#8fc47a', '#d0e3a0'],
  ['#5c4a2e', '#8a7a3f', '#b9a652', '#e0cf7a'],
  ['#3b2a2e', '#5c3d38', '#4f7a4a', '#8fc47a'],
];

/** A greenhouse dome: plots of crops in rows under glass. */
function dome(a: Art, cx: number, cy: number, r: number, seed: number): void {
  const frame = ['#94806f', '#c2ad90', '#f6efd9'];
  a.disc(cx, cy, r, (dx, dy, d, x, y) => {
    const g = (dx * LIGHT[0] + dy * LIGHT[1]) / r;
    if (d > r - 1.3) return g > 0.3 ? frame[2] : g > -0.3 ? frame[1] : frame[0];
    const gx = Math.floor((dx + r) / 7), gy = Math.floor((dy + r) / 7);
    const id = (gx * 3 + gy * 5 + seed) % FIELDS.length;
    const path = (dx + r) % 7 === 0 || (dy + r) % 7 === 0;
    let k = path ? 0 : ((id & 1 ? dx : dy) & 1) ? 2 : 1;
    if (g < -0.3 && bay(x, y) < (-g - 0.3) * 1.3) k = Math.max(0, k - 1); // glass in shade
    if (g > 0.35 && !path && bay(x, y) < (g - 0.35) * 0.9) k = Math.min(3, k + 1);
    return FIELDS[id][k];
  });
  // glint on the glass, toward the sun
  const sun = Math.atan2(LIGHT[1], LIGHT[0]);
  for (let t = -0.45; t <= 0.45; t += 0.06) a.put(cx + Math.cos(sun + t) * r * 0.62, cy + Math.sin(sun + t) * r * 0.62, '#e6fbf5');
  a.put(cx, cy, frame[2]);
}

/** A hydroponics pod: a rounded tank with a row of ports. */
function capsule(a: Art, x: number, y: number, w: number, h: number, ramp: readonly string[]): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      a.put(x + i, y + j, j === 0 ? ramp[3] : j === 1 ? ramp[2] : j === h - 1 ? ramp[0] : ramp[1]);
    }
  }
  for (let i = 2; i < w - 2; i += 3) a.put(x + i, y + 2, '#d7f5ee');
}

function marrow(): StationSprite {
  const a = new Art();
  const lights: StationLight[] = [];
  const POD = ['#24504a', '#3f8f8a', '#5fb3a8', '#a8e0d6'];

  // spine truss and docking arm in one long beam
  a.hbar(TIP + 3, -2, 81, 5, BONE);
  for (let x = -35; x < 42; x += 5) a.rect(x, -1, 1, 3, BONE[0]);
  collar(a, lights, ['#94806f', '#e3d5b8', '#f6efd9'], 4, 1.2);

  // hydroponic pods either side of the arm
  for (const s of [-1, 1]) {
    capsule(a, -35, s < 0 ? -10 : 5, 16, 6, POD);
    a.rect(-31, s < 0 ? -4 : 3, 2, 2, BONE[0]);
    a.rect(-24, s < 0 ? -4 : 3, 2, 2, BONE[0]);
  }

  // water and nutrient tanks
  a.vbar(-12, -15, 3, 13, BONE);
  a.vbar(-12, 3, 3, 13, BONE);
  a.ball(-11, -20, 6, ['#1d2c57', '#27477d', '#2f6a9c', '#4f9cb8', '#a8dbe0']);
  a.ball(-11, 20, 6, ['#5c4a2e', '#8a6a3f', '#b98a4f', '#dbb068', '#f2d898']);

  // two nursery domes on outriggers, and the main dome over the spine
  a.vbar(29, -16, 3, 14, BONE);
  a.vbar(29, 3, 3, 14, BONE);
  dome(a, 30, -26, 10, 1);
  dome(a, 30, 26, 10, 2);
  dome(a, 6, 0, 16, 3);
  lights.push(
    { x: 30, y: -37, colour: GREEN, period: 2, phase: 0, duty: 0.3 },
    { x: 30, y: 37, colour: GREEN, period: 2, phase: 1, duty: 0.3 },
  );

  // a solar array on the far end
  a.rect(43, -1, 1, 3, BONE[0]);
  panel(a, 44, -12, 13, 25, [OL, '#1f3f3c', '#2f6a5e', '#6fb39a']);
  lights.push({ x: 57, y: 0, colour: RED, period: 2.4, phase: 0.6, duty: 0.5 });

  return { canvas: a.finish(), half: HALF, extent: 46, lights };
}

/* ---------- Dry Hollow: a scrappy mining rig ---------- */
const ORE = ['#3b333c', '#5c504d', '#84766a', '#b5804f', '#dba85e'];

/** An open ore bin, heaped unevenly. */
function hopper(a: Art, x: number, y: number, w: number, h: number, seed: number): void {
  const rnd = rng(seed);
  a.box(x, y, w, h, [METAL[0], METAL[1], METAL[2]]);
  a.rect(x + 2, y + 2, w - 4, h - 4, '#1c1724');
  for (let j = 2; j < h - 2; j++) {
    for (let i = 2; i < w - 2; i++) {
      if (rnd() > 0.8) continue;
      const heap = 1 - Math.hypot(i - w / 2, j - h / 2) / (w / 2);
      a.put(x + i, y + j, shade(ORE, 0.15 + heap * 0.5 + ((i - j) / (w + h)) * 0.4 + (rnd() - 0.5) * 0.3, HALF + x + i, HALF + y + j));
    }
  }
}

function hollow(): StationSprite {
  const a = new Art();
  const lights: StationLight[] = [];
  const GREY: Ramp3 = [METAL[0], METAL[1], METAL[2]];
  const BROWN: Ramp3 = ['#3b2a2e', '#6b4a3c', '#96704f'];
  const DULL: Ramp3 = ['#6b2e2c', '#a3483a', '#c8684a'];
  const OCHRE: Ramp3 = ['#7a5a30', '#b5804f', '#dba85e'];
  const DARK = '#231e29';

  // docking arm: a patched girder in hazard stripes
  a.hbar(TIP + 3, -2, 25, 5, GREY);
  for (let x = -37; x < -26; x += 6) {
    a.rect(x, -1, 3, 3, AMBER);
    a.rect(x + 3, -1, 3, 3, DARK);
  }
  a.box(-25, -3, 7, 7, DULL);
  a.put(-24, -2, DARK); a.put(-20, 2, DARK);
  collar(a, lights, GREY, 3, 0.8);

  // crane boom reaching down and left, holding a lump of ore
  a.line(-11, 9, -38, 38, METAL[1]);
  a.line(-10, 10, -37, 39, METAL[2]);
  for (let k = 1; k < 5; k++) a.put(-11 - k * 5.4 + 1, 9 + k * 5.8, DARK);
  a.line(-38, 39, -38, 44, METAL[1]);
  a.rect(-40, 45, 5, 1, METAL[2]);
  a.put(-40, 46, METAL[2]); a.put(-36, 46, METAL[2]);
  a.rect(-39, 46, 3, 3, ORE[3]);
  a.put(-38, 46, ORE[4]); a.put(-39, 48, ORE[1]);

  // radio mast
  a.rect(4, 11, 1, 21, METAL[1]);
  a.rect(3, 18, 3, 1, METAL[2]);
  a.rect(2, 25, 5, 1, METAL[2]);
  lights.push({ x: 4, y: 32, colour: RED, period: 3, phase: 0, duty: 0.4, halo: true });

  // fuel tanks and their pipework
  a.rect(8, -15, 1, 5, METAL[1]);
  a.line(19, -14, 13, -10, METAL[1]);
  a.ball(8, -20, 5, ['#5c2a2a', '#8f3b33', '#c8553d', '#e07a5f', '#f2b08a']);
  a.ball(19, -18, 4, ['#4a3a2a', '#7a5a30', '#b5804f', '#dba85e', '#f2d898']);
  a.rect(4, -20, 9, 1, '#5c2a2a');

  // conveyor running out to the rock
  const belt = { x0: 29, y0: 13, x1: 66, y1: 32 };
  a.line(belt.x0, belt.y0 - 1, belt.x1, belt.y1 - 1, METAL[2]);
  a.line(belt.x0, belt.y0, belt.x1, belt.y1, DARK);
  a.line(belt.x0, belt.y0 + 1, belt.x1, belt.y1 + 1, METAL[0]);
  for (let k = 1; k < 4; k++) a.rect(belt.x0 + k * 9, belt.y0 + k * 4.6 + 2, 1, 3, METAL[1]);

  // ore hoppers
  hopper(a, 15, -8, 15, 13, 5);
  hopper(a, 19, 6, 12, 11, 9);

  // crew habitat, lit from inside
  a.vbar(-17, -15, 3, 5, GREY);
  a.box(-25, -24, 17, 9, BONE);
  a.rect(-24, -21, 15, 1, BONE[0]);
  for (const x of [-22, -19, -16, -12]) a.put(x, -19, '#ffd27a');

  // core: mismatched plates bolted together
  a.box(-14, -11, 28, 22, BROWN);
  a.box(-14, -11, 13, 10, DULL);
  a.box(1, 0, 13, 11, GREY);
  a.box(-9, 2, 8, 6, OCHRE);
  for (const [x, y] of [[-12, -9], [-4, -9], [-12, -4], [-4, -4], [3, 2], [11, 2], [3, 8], [11, 8], [0, -9], [11, -9]]) a.put(x, y, DARK);
  for (const y of [-8, -6, -4]) a.rect(3, y, 8, 1, BROWN[0]);
  a.rect(-7, 4, 4, 2, DARK);
  a.put(-6, 4, AMBER);

  return {
    canvas: a.finish(), half: HALF, extent: 44, lights,
    sparks: { x: -1, y: -1 },
    belt,
  };
}

/* ---------- The Lantern: a lonely relay beacon ---------- */
function lantern(): StationSprite {
  const a = new Art();
  const lights: StationLight[] = [];
  const VIO = ['#241d38', '#3f3560', '#6b5f8f', '#a79fc4', '#e4def2'];
  const V3: Ramp3 = [VIO[1], VIO[2], VIO[3]];

  // long thin docking arm
  a.hbar(TIP + 3, -1, 29, 3, V3);
  for (let x = -34; x < -10; x += 8) a.put(x, 0, VIO[0]);
  collar(a, lights, V3, 3, 1.4);

  // keel boom down to a pair of small arrays
  a.rect(0, 9, 1, 36, VIO[1]);
  a.rect(1, 9, 1, 36, VIO[2]);
  a.rect(-3, 21, 8, 1, VIO[2]);
  a.rect(-2, 33, 6, 1, VIO[2]);
  const PURPLE = [OL, '#2f2452', '#4a3a7d', '#8f7ac0'] as const;
  panel(a, -13, 45, 13, 7, PURPLE);
  panel(a, 2, 45, 13, 7, PURPLE);
  lights.push({ x: 1, y: 53, colour: RED, period: 2.6, phase: 0, duty: 0.4 });

  // sensor boom to the right
  a.line(9, 1, 39, 7, VIO[2]);
  a.line(9, 2, 39, 8, VIO[1]);
  a.box(39, 5, 5, 5, V3);
  lights.push({ x: 45, y: 7, colour: GREEN, period: 2.6, phase: 1.3, duty: 0.4 });

  // whip antenna
  a.line(-5, -8, -22, -34, VIO[2]);
  a.put(-12, -19, VIO[3]); a.put(-17, -27, VIO[3]);
  lights.push({ x: -23, y: -36, colour: RED, period: 2, phase: 0.7, duty: 0.2, halo: true });

  // relay dish on a short strut
  a.line(6, -7, 15, -16, VIO[1]);
  a.line(7, -7, 16, -16, VIO[2]);
  const dx0 = 20, dy0 = -22, R = 12;
  a.disc(dx0, dy0, R, (dx, dy, d, x, y) => {
    const g = (dx * LIGHT[0] + dy * LIGHT[1]) / R;
    if (d > R - 1.2) return g > 0.2 ? VIO[4] : g > -0.4 ? VIO[3] : VIO[2];
    let t = 0.3 + (-g * 0.5 + 0.5) * 0.5; // concave bowl: brightest on the side away from the sun
    if (Math.abs(d - 6) < 0.6) t -= 0.18;
    return shade(VIO, t, x, y, 0.4);
  });
  for (const ang of [0.6, 2.7, 4.8]) a.line(dx0 + Math.cos(ang) * 10, dy0 + Math.sin(ang) * 10, dx0 + 2, dy0 - 2, VIO[0]);
  a.rect(dx0 + 1, dy0 - 3, 2, 2, AMBER);

  // faceted core housing the lamp
  a.disc(0, 0, 10, (dx, dy, d, x, y) => {
    const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    let t = 0.3 + (Math.cos(sector) * LIGHT[0] + Math.sin(sector) * LIGHT[1]) * 0.42;
    if (d < 6.5) t = 0.28;
    if (Math.abs(d - 6.5) < 0.5) t = 0.1;
    return shade(VIO, t, x, y, 0.3);
  });
  a.ball(0, 0, 4, ['#8a5a2b', '#cf8048', '#eab668', '#fff3c4', '#ffffff']);

  return { canvas: a.finish(), half: HALF, extent: 48, lights, lamp: { x: 0, y: 0 } };
}

const BUILD: Record<PortType, () => StationSprite> = { ring: kestrel, farm: marrow, mine: hollow, relay: lantern };
const HUES = [-48, 34, -26, 58, -62, 22];

export function makeStation(type: PortType, look: number): StationSprite {
  const st = BUILD[type]();
  return { ...st, canvas: hueShifted(st.canvas, hueFor(look, HUES)) };
}
