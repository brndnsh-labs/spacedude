import { LIGHT, bay, rng, shade } from '../pixels';
import {
  AMBER, Art, BONE, GREEN, HALF, METAL, OL, RED, RUST, STEEL, TEAL, TEALS, TIP, WHITE, collar, panel,
  type Ramp3, type StationLight, type StationSprite,
} from './kit';

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

export function mine(): StationSprite {
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
