import { PAL, SIGNAL } from '../../art/palette';
import { Art, NATIVE, OL, type StationLight, type StationSprite } from './kit';
import { hazard, hcyl, oreHeap, over, plate, ramp5, shadowRect, sphere, truss, vcyl } from './mine-relay-parts';

/* ---------- Dry Hollow: a scrappy mining rig ---------- */

const GIRDER = ramp5(PAL.steel, 0);
const PLATE = ramp5(PAL.steel, 2);
const BRIGHT = ramp5(PAL.steel, 3);
const HULL = ramp5(PAL.bone, 0);
const PALE = ramp5(PAL.bone, 2);
const SHADED = ramp5(PAL.bone, 1);
const RUSTY = ramp5(PAL.rust, 1);
const OCHRE = ramp5(PAL.amber, 0);
const CRANE = ramp5(PAL.amber, 1);
const TIMBER = ramp5(PAL.wood, 2);
const COOLANT = ramp5(PAL.teal, 0);
const TANK = ramp5(PAL.steel, 4);
const STONE = ['#231e29', '#3b333c', '#5c504d', '#84766a', '#a39280', '#cdbfa5'];
const RICH = ['#7a4a2a', '#b5804f', '#dba85e'] as const;
const DARK = PAL.night[2], PITCH = PAL.night[0];
const YELLOW = PAL.amber[4];
const WINDOW = '#ffd27a';

/** Where the conveyor meets the rock: fixed by the renderer, which puts the rock's pit under this point. */
const PIT = { x: 99, y: 48 };
/** Where it tips into the crusher. A clean 2:1 slope from the pit. */
const TIP_IN = { x: 55, y: 26 };
/** How the renderer moves ore: this fraction of the belt a second, this many lumps on it at once. */
const ORE_SPEED = 0.12, ORE_LUMPS = 6;
/** The belt's centre row at a column. */
const beltY = (x: number) => TIP_IN.y + Math.ceil((x - TIP_IN.x) / 2);

/** An open ore bin: thick walls, the far walls shading the heap inside. */
function hopper(a: Art, x: number, y: number, w: number, h: number, seed: number, full: number): void {
  plate(a, x, y, w, h, GIRDER);
  a.rect(x + 1, y + 1, w - 2, 1, GIRDER[3]);
  a.rect(x + w - 2, y + 1, 1, h - 2, GIRDER[3]);
  oreHeap(a, x + 3, y + 3, w - 6, h - 6, STONE, RICH, seed, full);
  // inside faces: the left and bottom walls face the sun, the top and right ones throw shade on the ore
  shadowRect(a, x + 3, y + 3, w - 6, 2);
  shadowRect(a, x + w - 5, y + 5, 2, h - 8);
  a.rect(x + 2, y + 2, w - 4, 1, GIRDER[0]);
  a.rect(x + w - 3, y + 2, 1, h - 4, GIRDER[0]);
  a.rect(x + 2, y + 3, 1, h - 5, GIRDER[4]);
  a.rect(x + 2, y + h - 3, w - 5, 1, GIRDER[4]);
  // stiffening ribs along the rim
  for (let i = 5; i < w - 3; i += 6) {
    a.put(x + i, y, GIRDER[1]);
    a.put(x + i, y + h - 1, GIRDER[0]);
  }
  for (let j = 5; j < h - 3; j += 6) {
    a.put(x, y + j, GIRDER[0]);
    a.put(x + w - 1, y + j, GIRDER[1]);
  }
}

/** A vent fan in a round housing. */
function fan(a: Art, cx: number, cy: number, r: number): void {
  a.disc(cx, cy, r, (dx, dy, d) => {
    if (d > r - 1.2) return dx - dy > 1 ? GIRDER[4] : dx - dy < -1 ? GIRDER[1] : GIRDER[3];
    if (d < 1) return GIRDER[4];
    return dx === 0 || dy === 0 ? GIRDER[2] : PITCH;
  });
}

export function mine(): StationSprite {
  const a = new Art(NATIVE.half);
  const lights: StationLight[] = [];
  const light = (x: number, y: number, colour: string, period = 1, duty = 1, phase = 0, halo = false) =>
    lights.push({ x, y, colour, period, phase, duty, halo });

  /* --- docking arm: a crew tube slung inside a girder, patched where something hit it --- */
  truss(a, -58, -7, -30, -7, 0, 14, GIRDER, 7);
  hcyl(a, -58, -3, 28, 7, PLATE);
  for (const x of [-49, -37]) {
    a.rect(x, -4, 2, 9, GIRDER[2]);
    a.rect(x, -4, 2, 1, GIRDER[4]);
    a.rect(x, 4, 2, 1, GIRDER[0]);
  }
  hazard(a, -57, -3, 7, 7, YELLOW, DARK, 2);
  a.rect(-57, -3, 7, 1, PAL.amber[5]);
  a.rect(-57, 3, 7, 1, PAL.amber[1]);
  over(a, 1, b => {
    plate(b, -46, -5, 8, 10, RUSTY, { rivets: true });
  });
  [-52, -44, -36].forEach((x, i) => {
    a.put(x, -8, GIRDER[3]);
    light(x, -9, SIGNAL.amber, 1.8, 0.25, i * 0.3);
  });
  // collar: its outer face is where a berthed ship's nose stops
  plate(a, NATIVE.tip, -11, 6, 23, PLATE);
  a.rect(NATIVE.tip, -11, 1, 23, GIRDER[1]);
  a.rect(NATIVE.tip + 1, -5, 3, 11, DARK);
  a.rect(NATIVE.tip + 1, -5, 1, 11, PAL.teal[1]);
  a.rect(NATIVE.tip + 3, -5, 1, 11, GIRDER[0]);
  hazard(a, NATIVE.tip + 1, -10, 4, 4, YELLOW, DARK, 2);
  hazard(a, NATIVE.tip + 1, 7, 4, 4, YELLOW, DARK, 2);
  for (const s of [-1, 1]) {
    a.rect(NATIVE.tip + 1, s < 0 ? -13 : 12, 2, 2, GIRDER[2]);
    light(NATIVE.tip + 1, s < 0 ? -13 : 13, SIGNAL.amber, 0.8, 0.5, s > 0 ? 0.4 : 0, true);
  }

  // a brace from the arm up to the shack, welded on after the shack started to drift
  for (let k = 0; k <= 30; k++) {
    const x = -40 - Math.floor(k / 2), y = -8 - k;
    a.put(x, y, GIRDER[3]);
    a.put(x - 1, y, GIRDER[1]);
  }

  /* --- radio mast hanging below the deck --- */
  truss(a, -8, 22, -8, 58, 4, 0, GIRDER, 6);
  a.rect(-14, 33, 17, 1, GIRDER[3]);
  a.rect(-11, 46, 11, 1, GIRDER[3]);
  a.rect(-7, 58, 3, 2, GIRDER[2]);
  a.rect(-6, 60, 1, 8, GIRDER[3]);
  light(-6, 68, SIGNAL.red, 3, 0.4, 0, true);
  light(-14, 32, SIGNAL.white, 3, 0.08, 1.5);
  light(2, 32, SIGNAL.white, 3, 0.08, 1.6);

  /* --- link tube up to the crew shack, and the cradle under the big tank --- */
  vcyl(a, -31, -40, 6, 17, PLATE);
  a.rect(-32, -33, 8, 2, GIRDER[2]);
  a.rect(-32, -33, 8, 1, GIRDER[4]);
  plate(a, -14, -30, 17, 7, GIRDER, { rivets: true });
  a.line(-20, -35, -14, -29, GIRDER[2]);
  a.line(8, -35, 2, -29, GIRDER[3]);

  /* --- the core: one old deck with newer bits bolted on --- */
  plate(a, -30, -24, 45, 47, HULL, { grime: 3.1, seamsX: [15, 31], seamsY: [15, 32], rivets: true });
  plate(a, 15, -16, 19, 31, GIRDER, { grime: 5.7, rivets: true });
  // radiator fins on the power block, and its vent
  for (let i = 0; i < 14; i += 2) {
    a.rect(18 + i, -3, 1, 15, GIRDER[4]);
    a.rect(19 + i, -3, 1, 15, GIRDER[0]);
  }
  a.rect(18, -4, 14, 1, GIRDER[0]);
  a.rect(18, 12, 14, 1, GIRDER[3]);
  fan(a, 27, -10, 4);
  light(18, -8, SIGNAL.green, 2.2, 0.9, 0);
  light(18, -6, SIGNAL.teal, 1.3, 0.5, 0.2);

  // a floor grating with the dark of the machine space under it
  a.rect(-28, -6, 12, 15, PITCH);
  for (let i = 0; i < 12; i += 2) a.rect(-28 + i, -6, 1, 15, HULL[1]);
  for (let j = 0; j < 15; j += 3) a.rect(-28, -6 + j, 12, 1, HULL[1]);
  a.rect(-28, -7, 13, 1, HULL[0]);
  a.rect(-16, -6, 1, 15, HULL[0]);
  a.rect(-29, 9, 13, 1, HULL[3]);

  over(a, 1, b => {
    // a rust-red plate over the corner that took the hit, and a fresh steel one still being welded down
    plate(b, -30, -24, 18, 15, RUSTY, { grime: 9.3, rivets: true, seamsX: [9] });
    plate(b, -9, 8, 14, 10, BRIGHT, { rivets: true });
    // brass pipe from the tank cradle across the deck to the power block
    vcyl(b, -7, -24, 2, 22, OCHRE);
    hcyl(b, -7, -3, 22, 2, OCHRE);
    b.rect(-8, -4, 4, 4, OCHRE[1]);
    b.rect(-7, -4, 3, 1, OCHRE[4]);
    b.rect(-8, -15, 4, 2, OCHRE[3]);
    b.rect(8, -4, 2, 4, OCHRE[3]);
  });
  over(a, 2, b => {
    // the pit boss's cab, with a window over the works
    plate(b, 0, -22, 13, 13, OCHRE, { rivets: true });
    b.rect(2, -20, 9, 4, PAL.teal[0]);
    b.rect(2, -20, 9, 1, PAL.teal[2]);
    b.rect(8, -19, 2, 1, PAL.teal[4]);
    b.rect(3, -13, 7, 1, OCHRE[1]);
    b.rect(3, -14, 7, 1, OCHRE[3]);
    // lashed-down crates and a drum
    plate(b, 6, 1, 7, 6, TIMBER);
    b.rect(9, 1, 1, 6, TIMBER[0]);
    b.rect(6, 3, 7, 1, TIMBER[0]);
    plate(b, 7, 9, 6, 5, PALE);
    b.rect(7, 11, 6, 1, PALE[0]);
    b.rect(8, 16, 4, 4, RUSTY[2]);
    b.rect(9, 16, 3, 1, RUSTY[4]);
    b.rect(8, 19, 3, 1, RUSTY[0]);
    b.put(10, 18, PITCH);
  });
  light(3, -18, WINDOW, 1, 1);
  light(5, -18, WINDOW, 7, 0.9, 2);

  // the welder at the new plate
  a.rect(-13, 10, 3, 3, PAL.bone[5]);
  a.put(-13, 12, PAL.bone[3]);
  a.rect(-12, 11, 2, 1, PAL.teal[3]);
  a.rect(-13, 13, 3, 2, PAL.amber[3]);
  a.put(-10, 13, PAL.amber[4]);
  a.put(-14, 13, PAL.steel[5]);
  a.put(-14, 14, PAL.steel[3]);
  a.put(-13, 15, PAL.steel[1]); a.put(-11, 15, PAL.steel[1]);
  shadowRect(a, -15, 15, 2, 2);

  /* --- crew shack: a pitched-roof cabin with a bunkroom bolted on behind --- */
  over(a, 2, b => {
    plate(b, -51, -66, 21, 9, PLATE, { grime: 4.4, rivets: true, seamsX: [10] });
    for (const x of [-48, -37]) {
      b.rect(x - 1, -64, 4, 4, GIRDER[0]);
      b.rect(x, -63, 2, 2, PAL.amber[2]);
    }
    // the roof: the slope toward the sun is pale, the other falls into shade, with a cap along the ridge
    plate(b, -60, -58, 35, 10, PALE, { grime: 12.4, seamsX: [7, 14, 21, 28] });
    plate(b, -60, -48, 35, 10, SHADED, { grime: 6.4, seamsX: [7, 14, 21, 28] });
    b.rect(-60, -49, 35, 1, PAL.bone[6]);
    b.rect(-60, -48, 35, 1, PAL.bone[2]);
    // skylights in the near slope
    for (const x of [-57, -50, -43]) {
      b.rect(x, -46, 4, 5, SHADED[0]);
      b.rect(x + 1, -45, 2, 3, PAL.amber[2]);
    }
    // a patch, a stove pipe and a water butt on the far slope
    plate(b, -40, -58, 11, 7, RUSTY, { rivets: true });
    b.rect(-57, -56, 4, 4, GIRDER[0]);
    b.rect(-56, -55, 2, 2, PITCH);
    b.rect(-57, -56, 4, 1, GIRDER[3]);
    b.rect(-54, -56, 1, 4, GIRDER[3]);
    hcyl(b, -50, -57, 8, 5, COOLANT, 1);
    b.rect(-47, -57, 1, 5, PAL.teal[0]);
    // a hatch in the end by the link tube
    b.rect(-35, -46, 6, 6, SHADED[0]);
    b.rect(-34, -45, 4, 4, GIRDER[2]);
    b.rect(-34, -45, 4, 1, GIRDER[4]);
    b.put(-32, -43, YELLOW);
  });
  [-56, -49, -42].forEach((x, i) => {
    // someone in the middle bunk keeps turning the light off
    const period = i === 1 ? 11 : 1, duty = i === 1 ? 0.85 : 1;
    for (let j = 0; j < 3; j++) {
      light(x, -45 + j, j ? PAL.amber[4] : WINDOW, period, duty, 3);
      light(x + 1, -45 + j, j === 2 ? PAL.amber[3] : PAL.amber[4], period, duty, 3);
    }
  });
  for (const [x, period, duty] of [[-48, 1, 1], [-37, 13, 0.5]] as const) {
    light(x, -63, WINDOW, period, duty, 4);
    light(x + 1, -63, PAL.amber[4], period, duty, 4);
    light(x, -62, PAL.amber[4], period, duty, 4);
  }
  // shack aerial
  a.rect(-54, -73, 1, 7, GIRDER[3]);
  a.rect(-56, -71, 5, 1, GIRDER[2]);
  a.rect(-55, -69, 3, 1, GIRDER[2]);
  light(-54, -74, SIGNAL.red, 2.4, 0.15, 1);

  /* --- tanks --- */
  over(a, 2, b => {
    hcyl(b, -26, -48, 10, 3, OCHRE);
    b.rect(-22, -49, 2, 5, OCHRE[1]);
    b.rect(-22, -49, 2, 1, OCHRE[4]);
  });
  over(a, 3, b => {
    const RED = ramp5(PAL.rust, 2);
    sphere(b, -6, -41, 13, RED);
    // straps round it, and a filler cap
    for (let dx = -12; dx <= 12; dx++) if (dx < 3 || dx > 9) b.put(-6 + dx, -38, PAL.rust[dx < -8 ? 1 : dx < 3 ? 2 : 4]);
    for (let dy = -12; dy <= 12; dy++) if (dy < -8 || dy > -3) b.put(-10, -41 + dy, PAL.rust[dy > 6 ? 1 : 2]);
    b.rect(-4, -49, 4, 4, PAL.rust[2]);
    b.rect(-4, -49, 4, 1, PAL.rust[7]);
    b.rect(-1, -49, 1, 4, PAL.rust[6]);
    b.rect(-3, -48, 2, 2, PITCH);
    sphere(b, 22, -27, 10, TANK);
    // a painted band and a weld seam
    for (let dx = -9; dx <= 9; dx++) {
      for (const dy of [2, 3]) if (Math.hypot(dx, dy) < 10) b.put(22 + dx, -27 + dy, OCHRE[dx < -5 ? 1 : dx < 3 ? 2 : 3]);
    }
    for (let dy = -9; dy <= 9; dy++) if (dy < -6 || dy > -1) b.put(19, -27 + dy, TANK[dy > 4 ? 0 : 1]);
    b.rect(25, -32, 2, 2, PAL.steel[8]);
  });
  light(-3, -55, SIGNAL.red, 1.8, 0.25, 0.6, true);

  /* --- ore side: hoppers, crusher, the long tank that feeds its hydraulics --- */
  hopper(a, 35, -34, 35, 29, 5, 1);
  hazard(a, 36, -34, 33, 1, YELLOW, DARK, 2);
  plate(a, 69, -20, 4, 7, GIRDER);
  // walls patched with whatever plate was lying about
  over(a, 1, b => {
    plate(b, 60, -8, 8, 3, RUSTY);
    plate(b, 35, -22, 3, 9, HULL);
  });
  hopper(a, 72, -28, 23, 23, 9, 0.62);
  over(a, 1, b => plate(b, 86, -28, 9, 3, PALE));
  plate(a, 45, -6, 10, 9, GIRDER);
  a.rect(47, -5, 6, 7, PITCH);
  a.rect(47, -5, 1, 7, GIRDER[3]);
  a.rect(49, -3, 3, 2, STONE[3]);
  a.put(51, -3, STONE[5]);
  a.rect(48, 0, 2, 2, RICH[1]);

  plate(a, 37, 2, 26, 29, GIRDER, { grime: 7.7, rivets: true });
  hazard(a, 41, 10, 19, 19, YELLOW, DARK, 2);
  a.rect(42, 11, 17, 17, PITCH);
  for (const y of [12, 20]) {
    hcyl(a, 43, y, 15, 6, PLATE);
    for (let i = y === 12 ? 0 : 2; i < 14; i += 4) {
      a.rect(43 + i, y + 1, 2, 2, PAL.steel[7]);
      a.rect(45 + i, y + 3, 2, 2, PAL.steel[1]);
    }
  }
  plate(a, 38, 3, 9, 6, RUSTY, { rivets: true });
  a.rect(47, 5, 4, 1, DARK);
  a.disc(53, 6, 3, (dx, dy, d) => (d < 1 ? PITCH : d > 2.3 ? (dx - dy > 0 ? OCHRE[4] : OCHRE[1]) : OCHRE[2]));
  light(61, 3, SIGNAL.amber, 1, 0.5, 0, true);
  light(38, 29, SIGNAL.amber, 1, 0.5, 0.5, true);

  a.rect(19, 14, 2, 6, GIRDER[2]);
  a.rect(28, 14, 2, 6, GIRDER[2]);
  over(a, 2, b => {
    hcyl(b, 3, 19, 31, 11, BRIGHT, 4);
    for (const x of [9, 26]) hcyl(b, x, 19, 2, 11, RUSTY);
    b.rect(14, 23, 9, 2, PAL.rust[5]);
    b.rect(16, 18, 4, 2, GIRDER[2]);
    b.rect(16, 18, 4, 1, GIRDER[4]);
  });
  hcyl(a, 34, 23, 3, 3, OCHRE);

  /* --- gantry crane across the big hopper --- */
  over(a, 3, b => {
    hcyl(b, 33, -23, 39, 4, PLATE);
    for (let x = 38; x < 70; x += 6) b.rect(x, -22, 1, 2, GIRDER[1]);
    plate(b, 33, -26, 4, 10, GIRDER);
    plate(b, 68, -26, 4, 10, GIRDER);
    plate(b, 48, -27, 9, 12, CRANE, { rivets: true });
    b.rect(50, -24, 5, 4, CRANE[0]);
    b.rect(52, -15, 1, 5, GIRDER[2]);
    b.rect(50, -10, 5, 1, GIRDER[3]);
    b.put(50, -9, GIRDER[3]); b.put(54, -9, GIRDER[3]);
  });
  light(52, -22, SIGNAL.amber, 1.4, 0.5, 0, true);

  /* --- conveyor out to the rock --- */
  const BELT = PAL.night[4], CLEAT = PAL.night[6];
  over(a, 2, b => {
    // outrigger and pylon that the stays hang from
    hcyl(b, 63, 6, 13, 3, GIRDER);
    plate(b, 75, 2, 8, 11, GIRDER, { rivets: true });
    b.rect(77, 5, 4, 4, RUSTY[2]);
    b.rect(77, 5, 4, 1, RUSTY[4]);
  });
  over(a, 2, b => {
    for (let x = TIP_IN.x - 3; x <= PIT.x; x++) {
      const yc = beltY(x), rung = (x - TIP_IN.x) % 2 === 0;
      b.put(x, yc - 6, GIRDER[4]);
      for (let j = -5; j <= -3; j++) b.put(x, yc + j, rung ? GIRDER[3] : GIRDER[1]);
      for (let j = -2; j <= 2; j++) b.put(x, yc + j, (x - TIP_IN.x) % 4 === 0 ? CLEAT : BELT);
      b.put(x, yc + 3, GIRDER[4]);
      b.put(x, yc + 4, GIRDER[2]);
    }
    // brackets where the stays and the walkway lamps fix on
    for (const x of [63, 77, 91]) {
      const yc = beltY(x);
      b.rect(x, yc - 8, 3, 2, GIRDER[3]);
      b.rect(x, yc + 5, 3, 3, GIRDER[2]);
      b.rect(x, yc + 7, 3, 1, GIRDER[0]);
    }
    // head drum over the crusher throat
    vcyl(b, TIP_IN.x - 6, TIP_IN.y - 7, 3, 12, PLATE);
    // loader at the pit: the ore comes out from under its hood
    plate(b, PIT.x + 1, PIT.y - 9, 11, 19, RUSTY, { rivets: true });
    b.rect(PIT.x + 1, PIT.y - 4, 2, 9, PITCH);
    hazard(b, PIT.x + 4, PIT.y - 7, 6, 2, YELLOW, DARK, 2);
    plate(b, PIT.x + 5, PIT.y - 2, 5, 6, GIRDER);
    b.rect(PIT.x + 6, PIT.y - 1, 2, 3, COOLANT[2]);
    // feet braced against the rock
    b.line(PIT.x + 11, PIT.y - 9, PIT.x + 16, PIT.y - 14, GIRDER[3]);
    b.rect(PIT.x + 15, PIT.y - 16, 5, 2, GIRDER[2]);
    b.line(PIT.x + 11, PIT.y + 9, PIT.x + 16, PIT.y + 14, GIRDER[2]);
    b.rect(PIT.x + 15, PIT.y + 14, 5, 2, GIRDER[2]);
    b.line(PIT.x + 2, PIT.y + 10, PIT.x - 1, PIT.y + 16, GIRDER[2]);
    b.rect(PIT.x - 3, PIT.y + 16, 5, 2, GIRDER[2]);
  });
  // a chase of lamps running in along the belt, and a floodlight on the loader
  [91, 77, 63].forEach((x, i) => light(x + 1, beltY(x) - 9, SIGNAL.amber, 2.4, 0.3, 2.4 - i * 0.5));
  light(PIT.x + 8, PIT.y - 10, SIGNAL.white, 1, 1, 0, true);
  // The renderer's ore is a single pixel a lump. Each lump here is a two-by-two of lamps under one of those
  // pixels, switched on column by column as it passes, so the belt is seen to carry rock.
  const lumpEvery = 1 / (ORE_SPEED * ORE_LUMPS), pace = (PIT.x - TIP_IN.x) * ORE_SPEED;
  for (let x = TIP_IN.x; x <= PIT.x; x++) {
    const phase = -(PIT.x - 0.5 - x) / pace;
    light(x, beltY(x) - 1, STONE[4], lumpEvery, 2 / (pace * lumpEvery), phase);
    light(x, beltY(x), STONE[3], lumpEvery, 2 / (pace * lumpEvery), phase);
  }

  /* --- slewing crane on the corner of the deck --- */
  over(a, 3, b => {
    truss(b, -27, 19, -57, 49, 4, 4, CRANE, 6);
    plate(b, -61, 50, 7, 6, GIRDER);
    b.rect(-59, 52, 2, 2, YELLOW);
    // counter-jib and its weight
    b.line(-19, 11, -15, 7, GIRDER[2]);
    b.line(-18, 12, -14, 8, GIRDER[1]);
    plate(b, -16, 3, 5, 5, GIRDER);
    // the cab on its slew ring, over the boom's foot
    b.disc(-23, 15, 7, (dx, dy, d) => (d > 5.8 ? (dx - dy > 2 ? GIRDER[4] : dx - dy < -2 ? GIRDER[0] : GIRDER[2]) : GIRDER[1]));
    plate(b, -28, 10, 11, 11, CRANE, { rivets: true });
    b.rect(-26, 12, 5, 4, PAL.teal[0]);
    b.rect(-26, 12, 5, 1, PAL.teal[2]);
    b.rect(-26, 18, 7, 1, CRANE[1]);
  });
  light(-25, 14, WINDOW, 1, 1);
  // hoist cable, grab and a lump of ore
  a.rect(-58, 56, 1, 8, GIRDER[2]);
  a.rect(-61, 64, 7, 1, GIRDER[3]);
  a.rect(-61, 65, 1, 2, GIRDER[3]); a.rect(-55, 65, 1, 2, GIRDER[3]);
  a.rect(-60, 65, 5, 5, STONE[3]);
  a.rect(-59, 65, 4, 1, STONE[5]);
  a.rect(-56, 65, 1, 4, STONE[4]);
  a.rect(-60, 68, 2, 2, STONE[2]);
  a.rect(-58, 67, 2, 2, RICH[1]);
  a.put(-57, 67, RICH[2]);
  light(-62, 50, SIGNAL.amber, 1.6, 0.5, 0.3, true);

  /* --- work lamps --- */
  ([[35, -36, 1, 1], [94, -5, 4.3, 0.93], [-30, 22, 1, 1]] as const).forEach(([x, y, period, duty]) => {
    a.rect(x, y, 2, 2, GIRDER[3]);
    light(x, y, SIGNAL.white, period, duty, 0, true); // one of them has a loose wire
  });

  a.buf.outline(OL);

  // stays, drawn after the outline so they stay hair-thin
  const WIRE = PAL.steel[3];
  a.line(77, 12, 65, 22, WIRE);
  a.line(81, 12, 92, 35, WIRE);
  a.line(-14, 34, -7, 57, WIRE);
  a.line(2, 34, -5, 57, WIRE);
  // a power line slung from the bunkroom to the big tank, sagging
  a.line(-30, -62, -18, -57, WIRE);
  a.line(-18, -57, -5, -56, WIRE);

  return {
    canvas: a.buf.toCanvas(), scale: 1, half: NATIVE.half, extent: 74, lights,
    sparks: { x: -9, y: 13 },
    // the renderer carries ore toward (x0, y0), so that end is the crusher and the far end is the pit
    belt: { x0: TIP_IN.x, y0: TIP_IN.y, x1: PIT.x, y1: PIT.y },
  };
}
