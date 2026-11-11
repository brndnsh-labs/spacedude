import { LIGHT, bay, rng, shade } from '../pixels';
import {
  AMBER, Art, BONE, GREEN, HALF, METAL, OL, RED, RUST, STEEL, TEAL, TEALS, TIP, WHITE, collar, panel,
  type Ramp3, type StationLight, type StationSprite,
} from './kit';

/* ---------- The Lantern: a lonely relay beacon ---------- */
export function relay(): StationSprite {
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
