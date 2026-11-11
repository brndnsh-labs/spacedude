import { PAL, SIGNAL } from '../../art/palette';
import { LIGHT, shade } from '../pixels';
import { Art, NATIVE, OL, type StationLight, type StationSprite } from './kit';
import { dish, hcyl, over, plate, ramp5, truss, vcyl } from './mine-relay-parts';

/* ---------- The Lantern: a lonely relay beacon ---------- */

/** The beacon's own metal: a dusty grey-violet, nine steps dark to light. */
const VIO = ['#1d1730', '#2c2547', '#3f3560', '#554a78', '#6b5f8f', '#8a80ab', '#a79fc4', '#c9c2dc', '#e4def2'];
const SPAR = ramp5(VIO, 1);
const HULL = ramp5(VIO, 2);
const SKIN = ramp5(VIO, 3);
const GLASS = ['#5c3524', '#7a4a2a', '#b5683f', '#cf8048', '#eab668', '#f8dc98', '#fff3c4'];
const MAROON = ramp5(PAL.rust, 0);
const ROOF_LIT = ramp5(PAL.wood, 2);
const ROOF_SHADE = ramp5(PAL.wood, 1);
const CELL = ['#1d1730', '#2f2452', '#4a3a7d', '#6a58a0', '#8f7ac0'];
const PITCH = PAL.night[0];
const WINDOW = '#ffd27a';
/** How fast the renderer turns the beams, in radians a second: the gallery lamps keep time with them. */
const SWEEP = 0.45;

const GLYPHS: Record<string, readonly string[]> = {
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
};

/** Distance from the centre in the measure whose circles are octagons. */
const oct = (x: number, y: number) => Math.max(Math.abs(x), Math.abs(y), (Math.abs(x) + Math.abs(y)) * 0.7071);

/**
 * A tired solar array, 22 by 10: eight cells in a frame. `dead` lists cells that have gone dark;
 * `sag` drops the far end by a pixel every few columns, for one hanging off its mount.
 */
function array(a: Art, x: number, y: number, dead: readonly number[], sag = 0, flip = false): void {
  for (let i = 0; i < 22; i++) {
    const dy = sag ? Math.floor((flip ? 21 - i : i) / sag) : 0;
    for (let j = 0; j < 10; j++) {
      const u = (i - 1) % 5, v = (j - 1) % 4, cell = Math.floor((i - 1) / 5) + 4 * Math.floor((j - 1) / 4);
      let c: string;
      if (i === 0 || j === 0 || i === 21 || j === 9) c = j === 0 || i === 21 ? SPAR[3] : SPAR[1];
      else if (u === 4 || v === 3) c = SPAR[0];
      else if (dead.includes(cell)) c = u === v + 1 ? CELL[1] : CELL[0]; // a crack across the dark glass
      else c = u - v >= 2 ? CELL[cell % 3 === 1 ? 3 : 4] : u - v >= 0 ? CELL[3] : u - v >= -1 ? CELL[2] : CELL[1];
      a.put(x + i, y + j + dy, c);
    }
  }
}

export function relay(): StationSprite {
  const a = new Art(NATIVE.half);
  const lights: StationLight[] = [];
  const light = (x: number, y: number, colour: string, period = 1, duty = 1, phase = 0, halo = false) =>
    lights.push({ x, y, colour, period, phase, duty, halo });

  /* --- the long thin docking arm --- */
  hcyl(a, -58, -2, 40, 5, HULL);
  for (const x of [-50, -41, -32, -23]) {
    a.rect(x, -3, 2, 7, SPAR[2]);
    a.rect(x, -3, 2, 1, SPAR[4]);
    a.rect(x, 3, 2, 1, SPAR[0]);
  }
  // a cable run on posts along its back
  a.rect(-57, -6, 36, 1, SPAR[3]);
  for (const x of [-50, -41, -32, -23]) a.rect(x, -6, 1, 3, SPAR[2]);
  plate(a, -47, -2, 5, 5, ramp5(PAL.bone, 1)); // a patch in whatever was to hand
  plate(a, NATIVE.tip, -8, 5, 17, SKIN);
  a.rect(NATIVE.tip, -8, 1, 17, SPAR[1]);
  a.rect(NATIVE.tip + 1, -4, 2, 9, VIO[0]);
  a.rect(NATIVE.tip + 1, -4, 1, 9, PAL.teal[1]);
  for (const s of [-1, 1]) {
    a.rect(NATIVE.tip + 1, s < 0 ? -10 : 9, 2, 2, SPAR[2]);
    light(NATIVE.tip + 1, s < 0 ? -10 : 10, SIGNAL.amber, 1.4, 0.5, s > 0 ? 0.7 : 0, true);
  }
  light(-37, -4, SIGNAL.teal, 4.2, 0.12, 1);

  /* --- keel boom down to the arrays --- */
  truss(a, -2, 20, -2, 80, 4, 0, SPAR, 6);
  a.rect(-13, 40, 27, 1, SPAR[3]);
  a.rect(-13, 41, 27, 1, SPAR[1]);
  for (const y of [56, 70]) hcyl(a, -8, y, 17, 2, SPAR);
  a.rect(-1, 80, 3, 3, SPAR[2]);
  a.put(1, 80, SPAR[4]);
  light(0, 84, SIGNAL.red, 2.6, 0.4, 0, true);
  // battery house where the spreader crosses
  over(a, 1, b => {
    plate(b, -6, 36, 13, 9, HULL, { rivets: true });
    b.rect(-3, 39, 7, 3, VIO[1]);
    b.rect(-3, 39, 7, 1, VIO[0]);
  });
  light(-2, 40, SIGNAL.green, 3.1, 0.9, 0);
  light(0, 40, SIGNAL.amber, 0.9, 0.5, 0.3);
  light(2, 40, SIGNAL.green, 5.3, 0.6, 1);
  over(a, 1, b => {
    array(b, 6, 52, [5]);
    array(b, 6, 66, [0, 2, 3]);
    array(b, -28, 52, [1, 6], 6, true);
    // the fourth array is gone: a bent stub of frame and one cell still hanging on
    b.rect(-12, 69, 5, 1, SPAR[3]);
    b.rect(-12, 70, 1, 5, SPAR[1]);
    b.line(-12, 74, -16, 78, SPAR[2]);
    b.rect(-19, 78, 4, 3, CELL[1]);
    b.put(-17, 78, CELL[3]);
  });

  /* --- sensor boom out to the right, sloping away --- */
  for (let x = 19; x <= 61; x++) {
    const y = 7 + Math.floor((x - 19) / 3);
    a.put(x, y, SPAR[4]);
    a.put(x, y + 1, SPAR[2]);
    a.put(x, y + 2, SPAR[0]);
    if ((x - 19) % 12 === 9) a.rect(x, y - 1, 2, 5, SPAR[3]);
  }
  // a radiator on a stalk above the boom's root
  a.rect(21, -7, 4, 2, SPAR[2]);
  over(a, 1, b => {
    plate(b, 25, -11, 13, 9, SPAR);
    for (let i = 0; i < 10; i += 2) {
      b.rect(27 + i, -9, 1, 5, SPAR[4]);
      b.rect(28 + i, -9, 1, 5, SPAR[0]);
    }
  });
  over(a, 1, b => {
    plate(b, 60, 17, 10, 10, HULL, { rivets: true });
    b.rect(62, 19, 4, 3, PAL.teal[0]);
    b.rect(62, 19, 4, 1, PAL.teal[2]);
    b.rect(63, 24, 5, 1, HULL[1]);
    b.rect(70, 24, 9, 1, SPAR[3]);
    b.rect(65, 27, 1, 8, SPAR[3]);
    b.rect(63, 31, 5, 1, SPAR[2]);
    b.line(68, 17, 71, 14, SPAR[2]);
  });
  over(a, 2, b => dish(b, 75, 11, 6, VIO.slice(2, 8), GLASS[4]));
  light(80, 24, SIGNAL.green, 2.6, 0.4, 1.3, true);
  light(63, 20, SIGNAL.teal, 1.1, 0.6, 0);

  /* --- the strut that carries the big dish --- */
  truss(a, 12, -18, 32, -38, 3, 3, SPAR, 6);

  /* --- the bar slung under the arm: a tin can with a sign --- */
  vcyl(a, -41, 3, 3, 6, SPAR);
  vcyl(a, -28, 3, 3, 6, SPAR);
  // a skiff on the back door, engine cold, and a net of crates nobody has claimed
  vcyl(a, -40, 22, 3, 5, SPAR);
  over(a, 1, b => {
    const DULL = ramp5(PAL.steel, 0);
    hcyl(b, -49, 27, 15, 7, DULL, 3);
    b.rect(-51, 29, 2, 3, DULL[2]);
    b.put(-51, 29, DULL[4]);
    b.rect(-47, 29, 3, 3, PAL.teal[1]);
    b.rect(-46, 29, 2, 1, PAL.teal[3]);
    b.rect(-38, 26, 4, 1, DULL[3]);
    b.rect(-38, 34, 4, 1, DULL[1]);
    b.rect(-34, 28, 2, 5, VIO[1]);
    b.rect(-34, 28, 2, 1, VIO[4]);
    b.rect(-42, 30, 3, 1, MAROON[3]);
  });
  light(-32, 30, SIGNAL.red, 5, 0.1, 2);
  a.rect(-22, 22, 1, 3, SPAR[2]);
  plate(a, -25, 25, 5, 5, ramp5(PAL.wood, 2));
  plate(a, -20, 26, 4, 4, ramp5(PAL.bone, 1));
  over(a, 2, b => {
    hcyl(b, -49, 8, 31, 15, MAROON, 4);
    b.rect(-45, 8, 1, 15, MAROON[0]);
    b.rect(-23, 8, 1, 15, MAROON[0]);
    // portholes
    for (const x of [-43, -37, -31, -26]) {
      b.rect(x - 1, 17, 4, 4, MAROON[0]);
      b.rect(x, 18, 2, 2, GLASS[2]);
    }
    // the sign board
    b.rect(-43, 9, 17, 7, PAL.night[1]);
    b.rect(-43, 9, 17, 1, MAROON[4]);
    b.rect(-27, 9, 1, 7, MAROON[4]);
  });
  [...'BAR'].forEach((ch, n) => {
    GLYPHS[ch].forEach((row, j) => [...row].forEach((on, i) => {
      if (on !== '#') return;
      const x = -41 + n * 5 + i, y = 10 + j;
      a.put(x, y, PAL.teal[1]); // the tube when it is dark
      // the R has been on its way out for years
      if (ch === 'R') light(x, y, SIGNAL.teal, 3.7, 0.78, (i + j) % 2 ? 0 : 0.09);
      else light(x, y, SIGNAL.teal);
    }));
  });
  [-43, -37, -31, -26].forEach((x, i) => {
    const period = i === 2 ? 9 : 1, duty = i === 2 ? 0.6 : 1;
    light(x, 18, WINDOW, period, duty, 5);
    light(x + 1, 18, GLASS[4], period, duty, 5);
    light(x, 19, GLASS[4], period, duty, 5);
    light(x + 1, 19, GLASS[3], period, duty, 5);
  });
  light(-47, 12, SIGNAL.red, 1.9, 0.5, 0, true);

  /* --- keeper's cabin, shingled, on the shoulder of the lamp --- */
  plate(a, -23, -23, 8, 8, HULL);
  over(a, 2, b => {
    // a shingled roof: the slope toward the sun is warm, the near one in shade, courses staggered
    for (let j = 0; j < 17; j++) {
      const r = j < 8 ? ROOF_LIT : ROOF_SHADE, row = j < 8 ? j : j - 8, course = Math.floor(row / 3);
      for (let i = 0; i < 24; i++) {
        let c = row % 3 === 2 ? r[1] : row % 3 === 0 ? r[3] : r[2];
        if (row % 3 !== 2 && (i + course * 3) % 6 === 0) c = r[1];
        if (i === 0) c = r[0];
        if (i === 23) c = r[3];
        b.put(-42 + i, -37 + j, c);
      }
    }
    b.rect(-42, -37, 24, 1, ROOF_LIT[4]);
    b.rect(-42, -30, 24, 1, PAL.wood[7]);
    b.rect(-42, -29, 24, 1, PAL.wood[0]);
    b.rect(-42, -21, 24, 1, ROOF_SHADE[0]);
    // skylight, stove pipe
    b.rect(-38, -27, 6, 5, PAL.wood[0]);
    b.rect(-37, -26, 4, 3, GLASS[2]);
    b.rect(-26, -36, 4, 4, VIO[1]);
    b.rect(-26, -36, 4, 1, VIO[5]);
    b.rect(-23, -36, 1, 4, VIO[5]);
    b.rect(-25, -35, 2, 2, PITCH);
  });
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) light(-37 + i, -26 + j, j === 0 ? WINDOW : i < 2 ? GLASS[4] : GLASS[3]);
  }
  light(-25, -35, GLASS[3], 2.3, 0.7, 0);
  light(-18, -24, SIGNAL.amber, 1, 1, 0, true);

  // whip aerial off the cabin roof
  a.line(-39, -38, -53, -66, SPAR[4]);
  a.rect(-47, -46, 9, 1, SPAR[3]);
  a.rect(-50, -54, 7, 1, SPAR[3]);
  a.rect(-53, -62, 5, 1, SPAR[3]);
  light(-54, -68, SIGNAL.red, 2, 0.2, 0.7, true);

  /* --- the lamp housing: an eight-sided lantern with a gallery round the glass, on a wider plinth --- */
  over(a, 2, b => {
    for (let y = -26; y <= 26; y++) {
      for (let x = -26; x <= 26; x++) {
        const m = oct(x, y);
        if (m > 25.5) continue;
        const ang = Math.atan2(y, x), sector = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const facing = Math.cos(sector) * LIGHT[0] + Math.sin(sector) * LIGHT[1];
        const seam = Math.abs(ang - sector) > Math.PI / 8 - 0.04;
        b.put(x, y, m > 24.5 ? VIO[facing > 0.3 ? 5 : facing > -0.3 ? 3 : 1] : seam ? VIO[1] : VIO[Math.round(2.6 + facing * 1.5)]);
      }
    }
    // bolts where each face of the plinth is pinned down
    for (let k = 0; k < 8; k++) {
      const th = (k / 8) * Math.PI * 2;
      b.put(Math.round(Math.cos(th) * 23), Math.round(Math.sin(th) * 23), VIO[0]);
    }
  });
  over(a, 2, b => {
    for (let y = -22; y <= 22; y++) {
      for (let x = -22; x <= 22; x++) {
        const m = oct(x, y);
        if (m > 21.5) continue;
        const ang = Math.atan2(y, x), sector = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const facing = Math.cos(sector) * LIGHT[0] + Math.sin(sector) * LIGHT[1];
        const seam = Math.abs(ang - sector) > Math.PI / 8 - 0.05;
        const X = b.half + x, Y = b.half + y;
        let c: string;
        if (m > 19.5) c = VIO[facing > 0.3 ? 8 : facing > -0.3 ? 6 : 4]; // railing
        else if (m > 15.5) c = seam ? VIO[2] : VIO[Math.round(4.4 + facing * 2.2) - (m > 17 && m <= 18 ? 1 : 0)]; // gallery deck, two boards wide
        else if (m > 13.5) c = VIO[facing < -0.3 ? 3 : facing < 0.3 ? 2 : 1]; // the frame's inner wall
        else if (seam || Math.abs(m - 8.5) < 0.5) c = shade(GLASS, 0.5 - m / 28, X, Y, 0.3); // glazing bars
        else c = shade(GLASS, 1.02 - m / 17 + facing * 0.08, X, Y, 0.35);
        b.put(x, y, c);
      }
    }
    // a hatch down into the works, and the keeper's locker on the gallery
    b.rect(-19, -2, 3, 5, VIO[1]);
    b.rect(-19, -2, 3, 1, VIO[6]);
    plate(b, 4, 16, 5, 3, ramp5(PAL.bone, 1));
  });
  // gallery lamps at the eight corners, lit as a beam passes over them
  for (let k = 0; k < 8; k++) {
    const th = (k / 8) * Math.PI * 2 + Math.PI / 8;
    light(Math.round(Math.cos(th) * 21.5), Math.round(Math.sin(th) * 21.5), SIGNAL.white, Math.PI / SWEEP, 0.2, (Math.PI * 2 - th + 0.3) / SWEEP);
  }

  /* --- the big dish, patched --- */
  over(a, 3, b => {
    dish(b, 36, -40, 19, VIO.slice(1, 9), GLASS[4]);
    // a hole patched with plain steel that never matched
    plate(b, 22, -37, 7, 6, ramp5(PAL.steel, 2), { rivets: true });
  });
  light(38, -43, SIGNAL.amber, 4, 0.5, 0);

  /* --- a marker buoy on a tether, where the charts stop --- */
  for (let j = 0; j < 9; j++) {
    const w = j < 2 || j > 6 ? 3 : 5, band = j > 2 && j < 6;
    for (let i = 0; i < w; i++) {
      const r = band ? ramp5(PAL.bone, 2) : ramp5(PAL.rust, 2);
      a.put(55 - (w >> 1) + i, 58 + j, r[i === w - 1 ? 4 : i === 0 ? 1 : 2]);
    }
  }
  a.rect(55, 55, 1, 3, SPAR[3]);
  light(55, 54, SIGNAL.white, 3.4, 0.12, 0, true);

  a.buf.outline(OL);

  // guy wires, drawn after the outline so they stay hair-thin
  const WIRE = VIO[3];
  a.line(-13, -17, -59, -9, WIRE);
  a.line(-11, 19, -13, 39, WIRE);
  a.line(-13, 42, -3, 52, WIRE);
  a.line(11, 19, 13, 39, WIRE);
  a.line(13, 42, 3, 52, WIRE);
  a.line(20, -7, 60, 16, WIRE);
  a.line(-50, -60, -42, -38, WIRE);
  a.line(65, 36, 62, 48, VIO[2]);
  a.line(62, 48, 57, 57, VIO[2]);

  return { canvas: a.buf.toCanvas(), scale: 1, half: NATIVE.half, extent: 84, lights, lamp: { x: 0, y: 0 } };
}
