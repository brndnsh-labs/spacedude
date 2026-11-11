import { PAL, SIGNAL } from '../../art/palette';
import { LIGHT, bay, mod, shade } from '../pixels';
import { Art, NATIVE, type StationLight, type StationSprite } from './kit';
import { SUN, ball, container, dim, hTruss, hTube, mix, plate, solar, sprite, stamp, vTruss, vTube, wash, type Ramp } from './ring-farm-parts';

/* ---------- Marrow's Rest: a farm moon's orbital dock ---------- */

const BONE = PAL.bone, ST = PAL.steel, LEAF = PAL.leaf, WOOD = PAL.wood;
/** Painted pressure tube: the arm, the stalks, the outriggers. */
const TUBE = [BONE[1], BONE[2], BONE[4], BONE[5], BONE[6]];
const GIRDER = [BONE[1], BONE[3], BONE[5]];
const WHEAT = ['#8a7a3f', '#b9a652', '#e0cf7a', '#f2e6a0'];
const WATER = ['#1d2c57', '#27477d', '#2f6a9c', '#4f9cb8', '#a8dbe0'];
const PATH = WOOD[4];
const WARM = '#fff3c4';
const GROW = PAL.violet[6];

type Ground = (dx: number, dy: number) => string;

/** A fruit tree on a grid, or null between trees. `gap` is the spacing; grass shows through. */
function tree(dx: number, dy: number, gap: number): string | null {
  const u = mod(dx, gap), v = mod(dy, gap);
  if (u > 2 || v > 2) return v === 3 && u < 2 ? LEAF[2] : null; // its shadow on the grass
  if (u === 2 && v === 0) return LEAF[6];
  if ((u === 0 && v === 2) || (u === 0 && v === 1) || (u === 1 && v === 2)) return LEAF[1];
  return u + (2 - v) >= 3 ? LEAF[5] : LEAF[4];
}

/** The home farm under the big dome: a patchwork of plots round two lanes, a pond, and the farmhouse. */
const homeFarm: Ground = (dx, dy) => {
  if (dx === -8 || dx === -7 || dy === 5 || dy === 6) return PATH;
  if (dx < -8) {
    if (dy < -7) return tree(dx + 31, dy + 31, 6) ?? LEAF[3]; // orchard
    if (dy === -7 || dy === -6) return PATH;
    if (dy < 5) {
      // the pond, in a bank of reeds
      const q = Math.hypot((dx + 17) / 7.5, (dy + 0.5) / 4.6);
      if (q > 1) return (dx + dy * 2) % 5 === 0 ? LEAF[2] : LEAF[3];
      if (q > 0.78) return WATER[1];
      return dy < 0 && dx > -20 && dx - dy * 2 > -17 && dx - dy * 2 < -12 ? WATER[4] : dy < 0 ? WATER[3] : WATER[2];
    }
    // pasture, and the farmhouse with its red roof and a chimney
    if (dx >= -22 && dx <= -11 && dy >= 9 && dy <= 17) {
      if (dx === -22 || dy === 17) return PAL.rust[1];
      if (dx === -11) return BONE[6];
      if (dy === 13) return BONE[5]; // ridge
      if (dx >= -15 && dx <= -14 && dy >= 10 && dy <= 11) return dy === 10 ? ST[7] : ST[4];
      return dy < 13 ? (dy === 9 ? PAL.rust[7] : PAL.rust[5 + (mod(dx, 3) ? 0 : 1)]) : PAL.rust[mod(dx, 3) ? 3 : 2];
    }
    if (dx >= -23 && dx <= -12 && dy === 18) return LEAF[1];
    return (dx * 3 + dy * 5) % 11 === 0 ? LEAF[5] : LEAF[4];
  }
  if (dy < -14) return mod(dy, 3) === 0 ? WHEAT[0] : (dx + dy) % 7 === 0 ? WHEAT[3] : mod(dy, 3) === 1 ? WHEAT[2] : WHEAT[1]; // wheat, in furrows
  if (dy === -14 || dy === -13) return PATH;
  if (dy < 5) {
    if (dx === 10 || dx === 11) return PATH;
    if (dx < 10) return mod(dx, 4) === 1 ? WOOD[2] : mod(dy, 3) === 0 ? LEAF[6] : LEAF[5]; // cabbages in beds
    return mod(dx, 3) === 0 ? WOOD[1] : mod(dy, 4) === 0 && mod(dx, 3) === 1 ? PAL.rust[6] : mod(dx, 3) === 1 ? LEAF[4] : LEAF[2]; // vines, some in fruit
  }
  // fresh-turned soil with seedlings coming up in rows
  return mod(dy, 3) === 2 ? WOOD[1] : mod(dy, 3) === 0 && mod(dx, 3) === 0 ? LEAF[5] : mod(dy, 3) === 0 ? WOOD[3] : WOOD[2];
};

/** The upper nursery: young fruit trees round a tank. */
const orchard: Ground = (dx, dy) => {
  const d = Math.hypot(dx, dy);
  if (d < 2.3) return dx - dy > 0 ? WATER[4] : WATER[3];
  if (d < 3.6) return BONE[3];
  if (Math.abs(d - 9) < 0.8) return PATH;
  return tree(dx + 25, dy + 25, 6) ?? ((dx * 3 + dy * 5) % 11 === 0 ? LEAF[4] : LEAF[3]);
};

/** The lower nursery: market-garden beds in stripes, each a different crop. */
const beds: Ground = (dx, dy) => {
  if (dx === 0 || dx === -1) return PATH;
  const row = mod(dy + 15, 4), bed = Math.floor((dy + 15) / 4) + (dx > 0 ? 3 : 0);
  if (row === 3) return WOOD[2];
  const crop = [[LEAF[4], LEAF[5], LEAF[6]], [LEAF[2], LEAF[3], LEAF[4]], [LEAF[3], PAL.rust[5], PAL.rust[6]], [LEAF[3], WHEAT[2], WHEAT[3]], [LEAF[3], LEAF[4], PAL.violet[6]]][bed % 5];
  return row === 0 ? (dx % 2 ? crop[2] : crop[1]) : row === 1 ? crop[1] : crop[0];
};

/**
 * A greenhouse dome: what grows inside, seen through glass. The glazing bars run out from the crown, the glass
 * shows more sky toward its edge, and the sun leaves a glint on the side it comes from.
 */
function dome(a: Art, cx: number, cy: number, r: number, ground: Ground, diagonals: boolean, hoops: readonly number[], patch?: readonly [number, number, number, number]): void {
  a.disc(cx, cy, r + 2.4, (dx, dy, d, x, y) => {
    const g = d ? (dx * SUN[0] + dy * SUN[1]) / d : 0;
    if (d > r + 0.3) {
      // the kerb the glass sits on, with a bolt every so often
      const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      if (d < r + 1.4 && Math.abs((deg % 30) - 15) < 180 / r) return BONE[2];
      return shade(BONE, d > r + 1.4 ? 0.48 + g * 0.44 : 0.74 + g * 0.2, x, y, 0.25);
    }
    const s = (dx * SUN[0] + dy * SUN[1]) / r; // across the dome, toward the sun
    if (patch) {
      // a broken pane, boarded over
      const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      if (deg > patch[0] && deg < patch[1] && d > patch[2] && d < patch[3]) {
        return d > patch[3] - 1 || deg < patch[0] + 150 / d ? WOOD[3] : Math.round(d) % 3 === 0 ? WOOD[4] : WOOD[5];
      }
    }
    let c = ground(dx, dy);
    // the glass in three flat tones: sky on the sunward shoulder, clear in the middle, shade on the far side
    if (s < -0.6) c = mix(c, PAL.night[3], d > r - 2.2 ? 0.5 : 0.24);
    else if (d > r - 2.2) c = mix(c, s > 0.2 ? PAL.teal[6] : PAL.teal[3], 0.4);
    else if (s > 0.62) c = mix(c, PAL.teal[6], 0.16);
    const bar = dx === 0 || dy === 0 || (diagonals && Math.abs(dx) === Math.abs(dy)) || hoops.some(q => Math.abs(d - q) < 0.5);
    if (bar && d > 1.5) return s > -0.15 ? mix(c, '#f6efd9', 0.55) : mix(c, PAL.teal[0], 0.45);
    return c;
  });
  // the glint: a bright arc on the sunward shoulder, and a short one inside it
  const sun = Math.atan2(SUN[1], SUN[0]);
  for (let t = -0.55; t <= 0.55; t += 0.6 / r) {
    const q = r * 0.7, x = Math.round(cx + Math.cos(sun + t) * q), y = Math.round(cy + Math.sin(sun + t) * q);
    wash(a, x, y, '#ffffff', Math.abs(t) < 0.38 ? 0.85 : 0.5);
    if (Math.abs(t) < 0.22) wash(a, Math.round(cx + Math.cos(sun + t) * (q - 1)), Math.round(cy + Math.sin(sun + t) * (q - 1)), '#ffffff', 0.7);
    if (Math.abs(t - 0.1) < 0.12) wash(a, Math.round(cx + Math.cos(sun + t) * q * 0.55), Math.round(cy + Math.sin(sun + t) * q * 0.55), '#ffffff', 0.6);
  }
  // the crown where the bars meet
  plate(a, cx - 1, cy - 1, 3, 3, BONE, 5);
}

/** A grain silo from above: a ribbed cone roof in flat facets, a painted band at the eave, a ladder up to the cap. */
function silo(a: Art, cx: number, cy: number, r: number, facets: number): void {
  const step = 360 / facets;
  a.disc(cx, cy, r, (dx, dy, d, x, y) => {
    const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360 + step / 2) % 360;
    const g = d ? (dx * SUN[0] + dy * SUN[1]) / d : 0;
    if (d > r - 1.1) return shade(ST, 0.4 + g * 0.4, x, y, 0.2); // the wall
    if (d > r - 2.3) return g > 0.3 ? PAL.rust[6] : g > -0.4 ? PAL.rust[5] : PAL.rust[3]; // the band
    const facet = Math.floor(deg / step), mid = ((facet * step) * Math.PI) / 180;
    const gf = Math.cos(mid) * SUN[0] + Math.sin(mid) * SUN[1];
    const rib = Math.min(deg % step, step - (deg % step)) * (Math.PI / 180) * d < 0.5;
    return ST[Math.max(2, Math.min(8, Math.round(5.6 + gf * 1.9 - (rib ? 1 : 0))))];
  });
  a.disc(cx, cy, 1.6, (dx, dy) => (dx - dy > 0 ? ST[8] : dx - dy < 0 ? ST[4] : ST[6]));
  a.put(cx, cy, ST[2]);
  // the ladder, down the shaded side
  for (let i = 3; i < r - 2; i++) {
    a.put(cx - i, cy + 1, i % 2 ? ST[2] : ST[6]);
  }
}

/** A hydroponics pod: a capsule lying along x, with a glazed strip glowing with grow-lamps. */
function pod(a: Art, lights: StationLight[], x: number, y: number, w: number, h: number, ramp: Ramp, phase: number): void {
  const r = h / 2;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ex = i < r ? r - i - 0.5 : i >= w - r ? i - (w - r) + 0.5 : 0;
      if (Math.hypot(ex, j + 0.5 - r) > r + 0.1) continue;
      const n = ((j + 0.5) / h) * 2 - 1;
      let t = (-n * -LIGHT[1] + Math.sqrt(1 - n * n) * LIGHT[2] + 0.42) / 1.3 + (i >= w - r ? 0.08 : i < r ? -0.12 : 0);
      if (i > r && i < w - r && (i - 4) % 7 === 0) t -= 0.22; // hoops
      a.put(x + i, y + j, ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))]);
    }
  }
  // the glazed strip along the sunward shoulder
  for (let i = 5; i < w - 5; i++) {
    const frame = (i - 4) % 7 === 0;
    a.put(x + i, y + 2, frame ? ramp[1] : (i - 4) % 7 < 4 ? PAL.violet[5] : LEAF[5]);
    a.put(x + i, y + 3, frame ? ramp[1] : (i - 4) % 7 === 2 ? LEAF[6] : (i + 1) % 3 ? LEAF[4] : LEAF[3]);
    if ((i - 4) % 7 === 2) lights.push({ x: x + i, y: y + 2, colour: GROW, period: 7, phase: phase + i * 0.4, duty: 0.92 });
  }
}

/** The packing shed: a barn's red roof, pitched along the spine, corrugated, patched and trimmed in white. */
function shed(a: Art, x: number, y: number, w: number, h: number): void {
  const ridge = y + (h >> 1);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const up = y + j < ridge, sheet = (i + 1) % 3 === 0;
      let c: string = up ? (sheet ? PAL.rust[6] : PAL.rust[5]) : sheet ? PAL.rust[2] : PAL.rust[3];
      if (j === 0) c = PAL.rust[7];
      if (j === h - 1) c = PAL.rust[1];
      if (!up && j === h - 2 && bay(i, j) < 0.5) c = PAL.rust[2]; // weathering along the low eave
      a.put(x + i, y + j, c);
    }
  }
  a.rect(x, ridge, w, 1, BONE[6]); // ridge cap
  a.rect(x, ridge + 1, w, 1, PAL.rust[1]);
  a.rect(x, y, 1, h, BONE[3]); // bargeboards at the gable ends
  a.rect(x + w - 1, y, 1, h, BONE[6]);
  a.rect(x + w - 1, ridge + 1, 1, h - (ridge - y) - 1, BONE[4]);
}

/** A farm tug, nose left: a glazed cab and a flatbed with a crate of greens and a stack of sacks. */
const TUG = [
  '....ooooo..........',
  '..ooHHHHHoooooooooo',
  '.oTWhhhhHmGGGGmBBBo',
  'oTWthhhhHmGggGmBbBo',
  'oTtthrrhHmGggGmBbBo',
  'oTtthhhhhmGggGmBbBo',
  '.otthhhhsmggggmbbbo',
  '..oosssssoooooooooo',
  '....ooooo..........',
];
const TUG_KEY = {
  o: PAL.night[1], H: BONE[6], h: BONE[5], s: BONE[3], r: PAL.rust[5], T: PAL.teal[4], t: PAL.teal[2], W: PAL.teal[6],
  G: LEAF[5], g: LEAF[3], B: WOOD[6], b: WOOD[4], m: ST[3],
};

export function farm(): StationSprite {
  const a = new Art(NATIVE.half);
  const lights: StationLight[] = [];
  const TEALS = [PAL.teal[0], PAL.teal[1], PAL.teal[2], PAL.teal[3], PAL.teal[4], PAL.teal[5], PAL.teal[6]];

  // ---- the far end: a lattice tail carrying the solar array ----
  hTruss(a, 70, -3, 12, 7, GIRDER);
  for (const s of [-1, 1]) {
    solar(a, 82, s < 0 ? -25 : 5, 19, 21, ['#12282c', '#1f3f3c', '#2a5f56', '#38806e', '#5fa890', '#a0d8bc', '#e6fbf5'], [BONE[2], BONE[5]], 5, 4, s < 0 ? 2 : 3);
    a.rect(90, s < 0 ? -4 : 3, 3, 2, BONE[3]);
  }
  plate(a, 81, -4, 21, 9, BONE, 5);
  a.rect(84, -2, 15, 5, BONE[3]);
  a.rect(84, -2, 15, 1, BONE[2]);
  for (let x = 85; x < 98; x += 3) a.put(x, 0, PAL.amber[3]);
  lights.push(
    { x: 103, y: 0, colour: SIGNAL.red, period: 2.4, phase: 0.6, duty: 0.5, halo: true },
    { x: 91, y: -26, colour: SIGNAL.white, period: 2.1, phase: 0, duty: 0.07, halo: true },
    { x: 91, y: 26, colour: SIGNAL.white, period: 2.1, phase: 1.05, duty: 0.07, halo: true },
  );
  a.put(102, 0, BONE[3]);

  // ---- the spine: outriggers to the nursery domes, stalks to the water tank and the silos ----
  vTube(a, 58, -29, 5, 20, TUBE, 6, 2);
  vTube(a, 58, 10, 5, 19, TUBE, 6, 1);
  vTruss(a, -25, -27, 7, 20, GIRDER, 1);
  vTruss(a, -25, 8, 7, 22, GIRDER, 3);
  a.rect(-22, 8, 1, 22, ST[5]); // the grain chute down the middle of its lattice
  // water down from the tank and along to the domes, in a pipe clipped to the stalk
  a.rect(-22, -27, 1, 20, PAL.teal[3]);
  for (let y = -24; y < -9; y += 5) a.put(-22, y, PAL.teal[5]);

  // the docking arm: a walk-through tube with a few lit ports
  hTube(a, -60, -4, 31, 9, TUBE, 6, 3);
  for (const x of [-52, -46, -40]) {
    a.put(x, -1, PAL.amber[4]);
    lights.push({ x, y: -1, colour: SIGNAL.amber, period: 1, phase: 0, duty: 1 });
  }
  for (const x of [-56, -44, -38]) dim(a, x, 2); // scuffs under the joints
  for (const x of [-57, -50, -45, -39]) dim(a, x, -4);
  a.rect(-58, 3, 26, 1, PAL.teal[2]); // the water main, run along the arm
  for (let x = -55; x < -32; x += 6) a.put(x, 3, PAL.teal[4]);
  // our own collar: a flange with hazard paint and an approach light at each end
  plate(a, NATIVE.tip, -7, 3, 15, BONE, 5);
  for (let y = -5; y <= 5; y += 2) a.put(NATIVE.tip + 1, y, y % 4 ? PAL.amber[4] : PAL.night[4]);
  for (const s of [-1, 1]) {
    a.rect(NATIVE.tip, s < 0 ? -9 : 8, 3, 2, BONE[2]);
    a.put(NATIVE.tip + 1, s * 9, PAL.amber[1]);
    lights.push({ x: NATIVE.tip + 1, y: s * 9, colour: SIGNAL.amber, period: 1.2, phase: s > 0 ? 0.6 : 0, duty: 0.5, halo: true });
  }

  // hydroponics pods slung either side of the arm
  for (const s of [-1, 1]) {
    const y = s < 0 ? -18 : 10;
    for (const x of [-51, -37]) {
      a.rect(x, s < 0 ? -9 : 5, 2, 5, BONE[3]);
      a.rect(x + 1, s < 0 ? -9 : 5, 1, 5, BONE[5]);
    }
    pod(a, lights, -58, y, 30, 9, TEALS, s < 0 ? 0 : 3);
  }

  hTube(a, -14, -4, 6, 9, TUBE, 3, 0);

  // the node where the stalks meet the spine: an eight-sided junction with a hatch on top
  const node = new Art(a.half);
  for (let dy = -9; dy <= 9; dy++) {
    for (let dx = -9; dx <= 9; dx++) {
      const cut = Math.abs(dx) + Math.abs(dy);
      if (cut > 13) continue;
      const rim = Math.abs(dx) === 9 || Math.abs(dy) === 9 || cut === 13;
      const lit = dx - dy; // toward the sun
      node.put(-22 + dx, dy, rim ? (lit > 6 ? BONE[6] : lit > -6 ? BONE[4] : BONE[2]) : Math.abs(dx) === 5 || Math.abs(dy) === 5 ? BONE[4] : BONE[5]);
    }
  }
  node.disc(-22, 0, 3.6, (dx, dy, d) => (d > 2.7 ? (dx - dy > 0 ? BONE[6] : BONE[2]) : d > 1.2 ? BONE[3] : PAL.amber[4]));
  for (const [x, y] of [[-29, -7], [-15, -7], [-29, 7], [-15, 7]]) node.put(x, y, BONE[2]);
  stamp(a, node, 1);
  lights.push(
    { x: -29, y: -7, colour: WARM, period: 1, phase: 0, duty: 1 },
    { x: -15, y: 7, colour: WARM, period: 1, phase: 0, duty: 1 },
  );

  // the water tank: a banded ball with a red valve wheel on its cap
  const tank = new Art(a.half);
  ball(tank, -22, -37, 11, WATER, 0.5);
  for (let i = -10; i <= 10; i++) {
    if (Math.abs(i) < 3) continue;
    tank.put(-22 + i, -37, i > 0 ? WATER[2] : WATER[0]);
    tank.put(-22, -37 + i, i < 0 ? WATER[2] : WATER[0]);
  }
  tank.disc(-22, -37, 2.6, (dx, dy, d) => (d > 1.8 ? (dx - dy > 0 ? ST[7] : ST[4]) : ST[5]));
  for (const [x, y] of [[-23, -38], [-21, -38], [-22, -37], [-23, -36], [-21, -36]]) tank.put(x, y, PAL.rust[5]); // the valve wheel
  plate(tank, -30, -33, 5, 4, BONE, 4); // a plate welded over an old leak
  tank.put(-29, -32, BONE[2]);
  tank.put(-27, -31, BONE[2]);
  tank.rect(-17, -43, 3, 1, '#ffffff');
  tank.put(-15, -42, '#ffffff');
  stamp(a, tank, 2);
  lights.push({ x: -22, y: -49, colour: SIGNAL.teal, period: 3.2, phase: 0.4, duty: 0.5, halo: true });

  // two silos and the auger between them
  a.rect(-22, 36, 20, 3, ST[3]);
  a.rect(-22, 36, 20, 1, ST[5]);
  const silos = new Art(a.half);
  silo(silos, -22, 39, 10, 12);
  silo(silos, -5, 42, 7, 10);
  stamp(a, silos, 2);
  lights.push({ x: -22, y: 39, colour: SIGNAL.red, period: 2.6, phase: 1.1, duty: 0.3, halo: true });

  // the farm tug at the water point, with a hose across to the tank
  a.rect(-37, -37, 5, 1, PAL.teal[3]);
  sprite(a, -56, -41, TUG, TUG_KEY);
  lights.push({ x: -56, y: -37, colour: SIGNAL.green, period: 2.2, phase: 0.3, duty: 0.25 });

  // the packing shed, with a skylight, a vent and a patch of plain sheet
  hTube(a, 46, -4, 6, 9, TUBE, 3, 1);
  const barn = new Art(a.half);
  shed(barn, 51, -10, 20, 21);
  plate(barn, 55, -7, 6, 4, ST, 5);
  barn.rect(56, -6, 4, 2, PAL.amber[4]);
  barn.put(59, -6, PAL.amber[6]);
  barn.rect(63, 4, 4, 4, ST[5]);
  barn.rect(63, 4, 4, 1, ST[7]);
  barn.put(64, 6, ST[3]);
  plate(barn, 65, -1, 3, 3, ST, 6);
  barn.put(66, 0, PAL.night[2]);
  stamp(a, barn, 2);
  lights.push(
    { x: 57, y: -6, colour: WARM, period: 1, phase: 0, duty: 1 },
    { x: 58, y: -6, colour: WARM, period: 11, phase: 2, duty: 0.85 },
  );
  // the shed's aerial, of the kind every farmhouse has
  a.rect(68, -22, 1, 12, ST[4]);
  for (const [y, w] of [[-21, 5], [-18, 7], [-15, 5]]) a.rect(68 - (w >> 1), y, w, 1, ST[5]);
  lights.push({ x: 68, y: -23, colour: SIGNAL.red, period: 3.4, phase: 0.2, duty: 0.3, halo: true });
  // produce stacked on the shed's loading shelf
  container(a, 52, 12, 6, 4, [LEAF[1], LEAF[2], LEAF[4], LEAF[5]]);
  container(a, 64, 12, 7, 4, [BONE[2], BONE[3], BONE[4], BONE[5]]);

  // ---- the glass: two nurseries on their outriggers, and the big dome over the spine ----
  const glass = new Art(a.half);
  dome(glass, 60, -44, 15, orchard, false, [9]);
  dome(glass, 60, 42, 13, beds, false, [7], [182, 268, 7.5, 12.5]);
  dome(glass, 19, 0, 27, homeFarm, true, [10, 19], [47, 88, 19.5, 26.5]);
  stamp(a, glass, 2);
  lights.push(
    { x: 60, y: -62, colour: SIGNAL.green, period: 2, phase: 0, duty: 0.3, halo: true },
    { x: 60, y: 58, colour: SIGNAL.green, period: 2, phase: 1, duty: 0.3, halo: true },
    { x: 3, y: 14, colour: WARM, period: 1, phase: 0, duty: 1 }, // the farmhouse window
    { x: 11, y: 5, colour: WARM, period: 1, phase: 0, duty: 1 }, // lamps where the lanes cross
    { x: 30, y: 5, colour: WARM, period: 1, phase: 0, duty: 1 },
    { x: 11, y: -14, colour: WARM, period: 1, phase: 0, duty: 1 },
  );
  a.put(60, -62, LEAF[2]);
  a.put(60, 58, LEAF[2]);

  return { canvas: a.finish(), scale: 1, half: a.half, extent: 104, lights };
}
