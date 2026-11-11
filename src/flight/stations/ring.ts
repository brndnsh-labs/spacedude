import { LIGHT, bay, rng, shade } from '../pixels';
import {
  AMBER, Art, BONE, GREEN, HALF, METAL, OL, RED, RUST, STEEL, TEAL, TEALS, TIP, WHITE, collar, panel,
  type Ramp3, type StationLight, type StationSprite,
} from './kit';

/* ---------- Kestrel Station: the big, polished ring ---------- */
export function ring(): StationSprite {
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
