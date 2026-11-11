import { LIGHT, bay, rng, shade } from '../pixels';
import {
  AMBER, Art, BONE, GREEN, HALF, METAL, OL, RED, RUST, STEEL, TEAL, TEALS, TIP, WHITE, collar, panel,
  type Ramp3, type StationLight, type StationSprite,
} from './kit';

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

export function farm(): StationSprite {
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
