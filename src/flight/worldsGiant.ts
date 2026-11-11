import { LIGHT, PixelBuf, bay } from './pixels';
import { type Frame, type Ramp, type Vec, clamp, dot, fbm, gnoise, norm, paintGlobe, pick, ramp, step, toFrame } from './worldsKit';

/**
 * The relay's neighbour: a ringed gas giant in lilac and dusk rose. Belts and zones of uneven width with
 * ragged edges, one great storm and a string of pale ovals, dusky polar hoods. The rings pass behind the
 * globe and in front of it, throw their shadow across the cloud tops, and are cut by the globe's own shadow.
 * A small moon keeps it company.
 */

const LILAC = ramp('#1a1230', '#2f2150', '#4c3478', '#7350a0', '#9f78bd', '#cba6d6', '#eed4ea');
const DUSK = ramp('#17102b', '#281b47', '#3f2b69', '#5d428c', '#8263a8', '#ab8cc4', '#d4bbdc');
const ROSE = ramp('#1f1230', '#3a1f4c', '#5f2f66', '#8a4a7c', '#b46f8f', '#d99aa6', '#f2c8c0');
const CREAM = ramp('#221634', '#40285a', '#6a4580', '#9a6c9c', '#c99cb4', '#ecc8c8', '#fdeedd');
const M_LILAC = 0, M_DUSK = 1, M_ROSE = 2, M_CREAM = 3;

const RING_WARM = ramp('#241a3a', '#3f2f5c', '#6a557f', '#9a829f', '#c9b0b8', '#eddcd0', '#fff6e6');
const RING_COOL = ramp('#221a3c', '#392f60', '#5c5288', '#857cae', '#b0a8cf', '#dad4ea');
const MOON = ramp('#221c30', '#3d3548', '#5f566a', '#8a8090', '#b8aeb4', '#e6ddd6');

export const GIANT_R = 90;
/** How far the rings reach, in globe radii. */
const RING_IN = 1.24, RING_OUT = 2.34;

/** Belts from the north pole (-1) to the south (1): where each ends, its ramp, and how bright it is. */
const BELTS: readonly (readonly [number, number, number])[] = [
  [-0.86, M_DUSK, 0.78], [-0.74, M_LILAC, 0.86], [-0.66, M_DUSK, 0.9], [-0.5, M_LILAC, 1], [-0.42, M_ROSE, 0.92],
  [-0.2, M_CREAM, 1.04], [-0.12, M_ROSE, 1], [-0.04, M_LILAC, 0.94], [0.14, M_CREAM, 1.06], [0.24, M_ROSE, 0.95],
  [0.3, M_DUSK, 0.92], [0.46, M_LILAC, 1], [0.54, M_ROSE, 0.9], [0.7, M_LILAC, 0.9], [0.8, M_DUSK, 0.85], [2, M_DUSK, 0.74],
];

/** How much ring there is at a radius, in globe radii: 0 is a gap, 1 is dense. */
function ringDensity(rho: number): number {
  if (rho < RING_IN || rho > RING_OUT) return 0;
  const fine = gnoise(rho * 36, 3.1, 7.7) * 0.5 + gnoise(rho * 90, 1.7, 2.9) * 0.25;
  if (rho < 1.5) return (0.14 + 0.2 * ((rho - RING_IN) / 0.26)) * (1 + fine * 1.4); // the thin inner ring
  if (rho < 1.94) return clamp(0.86 + fine * 0.5 - (rho < 1.53 ? 0.3 : 0) - (Math.abs(rho - 1.72) < 0.012 ? 0.45 : 0));
  if (rho < 2.02) return 0.03; // the wide gap
  if (rho < 2.27) return Math.abs(rho - 2.2) < 0.012 ? 0.05 : clamp(0.6 + fine * 0.4);
  if (rho > 2.305 && rho < 2.325) return 0.32; // a stray outer ringlet
  return 0;
}

export function paintGiant(buf: PixelBuf, cx: number, cy: number): void {
  const r = GIANT_R;
  const phi = (-20 * Math.PI) / 180, k = 0.3; // ring tilt on screen, and how edge-on we see it
  const a: Vec = [Math.cos(phi), Math.sin(phi), 0];
  const b: Vec = [-Math.sin(phi) * k, Math.cos(phi) * k, Math.sqrt(1 - k * k)];
  const N: Vec = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // the north pole
  const F: Frame = [a, [-N[0], -N[1], -N[2]], b];
  const LN = dot(LIGHT, N);
  const at = (x: number, y: number): Vec => toFrame(F, norm([x, y, Math.sqrt(Math.max(0.01, 1 - x * x - y * y))]));
  const storm = at(0.22, -0.16);
  const ovals = [at(-0.42, 0.36), at(-0.2, 0.47), at(0.04, 0.52), at(0.27, 0.5)];

  /** A ring pixel: its colour, or -1 where there is none (or it dithers away). */
  const ringPixel = (x: number, y: number, dx: number, dy: number): number => {
    const u = dx * a[0] + dy * a[1], v = -dx * a[1] + dy * a[0];
    // three samples across the pixel, the way the rings are squeezed, so fine ringlets do not shimmer
    let dens = 0, rho = 0;
    for (let i = -1; i <= 1; i++) {
      const rr = Math.hypot(u, (v + i * 0.34) / k) / r;
      dens += ringDensity(rr);
      if (i === 0) rho = rr;
    }
    dens /= 3;
    if (dens < 0.04) return -1;
    const solid = dens > 0.62 || (dens > 0.34 && ((x + y) & 1) === 0) || dens * 1.5 > bay(x, y);
    if (!solid) return -1;
    const w = v / k, P: Vec = [u * a[0] + w * b[0], u * a[1] + w * b[1], w * b[2]];
    const along = dot(P, LIGHT), off = Math.sqrt(Math.max(0, dot(P, P) - along * along));
    // the globe's shadow, with a dithered edge
    const dark = along < 0 ? clamp((r - off) / 3 + 0.5) : 0;
    const grain = gnoise(rho * 36, 3.1, 7.7);
    const cool = rho > 2.0 || rho < 1.5;
    let t = (cool ? 0.42 : 0.62) + dens * 0.36 + grain * 0.12;
    if (dark > bay(x + 2, y + 1)) t = t * 0.24 + 0.04;
    return pick(cool ? RING_COOL : RING_WARM, t, x, y, 0.5);
  };

  // the far half of the rings, behind the globe
  const reach = Math.ceil(r * RING_OUT) + 2;
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
    for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (-dx * a[1] + dy * a[0] > 0) continue;
      const c = ringPixel(x, y, dx, dy);
      if (c >= 0) buf.putRgb(x, y, c);
    }
  }

  paintGlobe(buf, cx, cy, {
    r, frame: F, ramps: [LILAC, DUSK, ROSE, CREAM], soft: 0.6, ambient: 0.1,
    air: { rim: [0xeed4ea, 0xab8cc4], haze: [0x7350a0, 0x3f2b69], reach: 4, strength: 0.9 },
    nightRim: 0x3a2560,
    sample(s, px, py, pz, nx, ny, nz) {
      // py is latitude (north is negative); (px, pz) run round the globe
      const lon = Math.atan2(px, pz);
      const turb = fbm(px * 2 + 4, py * 7 + 1, pz * 2 + 6, 4) - 0.5;
      const curl = fbm(px * 7 + 2, py * 22 + 5, pz * 7 + 8, 3) - 0.5;
      let lat = py + turb * 0.07 + curl * 0.028 + Math.sin(lon * 13 + py * 31) * 0.008;

      // the great storm: the belts bend round it
      const ds: Vec = [px - storm[0], py - storm[1], pz - storm[2]];
      const dLat = ds[1], dLon = Math.sqrt(Math.max(0, dot(ds, ds) - dLat * dLat)) * (px * storm[2] - pz * storm[0] > 0 ? 1 : -1);
      const q = Math.hypot(dLat / 0.085, dLon / 0.2);
      if (q < 2.2) lat += Math.sign(dLat) * 0.03 * Math.exp(-((q - 1) * (q - 1)) * 2.5);

      let i = 0;
      while (lat > BELTS[i][0]) i++;
      let mat = BELTS[i][1], tone = BELTS[i][2];
      // streaks drawn out along each belt, and a soft darkening toward a belt's southern edge
      const streak = fbm(px * 3.4 + 7, lat * 34, pz * 3.4 + 3, 4) - 0.5;
      tone += streak * 0.3;
      const prev = i ? BELTS[i - 1][0] : -1, depth = (lat - prev) / (BELTS[i][0] - prev);
      tone -= step(0.55, 1, depth) * 0.07;
      // wisps of the next belt's colour dragged across the boundary
      if (depth > 0.72 && streak > 0.1 && i + 1 < BELTS.length) mat = BELTS[i + 1][1];

      if (q < 1) {
        const th = Math.atan2(dLat / 0.085, dLon / 0.2);
        const swirl = Math.sin(th * 2 + q * 7 + curl * 6);
        mat = q < 0.42 ? M_CREAM : M_ROSE;
        tone = q > 0.8 ? 0.78 : 0.98 + swirl * 0.1 + (q < 0.42 ? 0.06 : 0);
      } else if (q < 1.25) tone *= 1.08;

      // a string of pale ovals in a southern belt
      for (const o of ovals) {
        const e: Vec = [px - o[0], py - o[1], pz - o[2]], eLat = e[1];
        const qo = Math.hypot(eLat / 0.034, Math.sqrt(Math.max(0, dot(e, e) - eLat * eLat)) / 0.062);
        if (qo < 1) { mat = M_CREAM; tone = qo > 0.72 ? 0.84 : 1.08; }
      }

      // the rings' shadow across the cloud tops
      const tHit = (py * r) / LN; // py is minus the height above the ring plane
      if (tHit > 0) {
        const Q: Vec = [nx * r + LIGHT[0] * tHit, ny * r + LIGHT[1] * tHit, nz * r + LIGHT[2] * tHit];
        s.shadow = ringDensity(Math.sqrt(dot(Q, Q)) / r) * 0.6;
      }
      s.mat = mat; s.tone = tone;
    },
  });

  // the near half of the rings, across the face of the globe
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
    for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (-dx * a[1] + dy * a[0] <= 0) continue;
      const c = ringPixel(x, y, dx, dy);
      if (c >= 0) buf.putRgb(x, y, c);
    }
  }
}

/** A small cratered moon, lit like everything else. */
export function paintMoon(buf: PixelBuf, cx: number, cy: number, r: number): void {
  const F: Frame = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const marks: Vec[] = [norm([0.3, -0.2, 0.9]), norm([-0.25, 0.3, 0.9]), norm([0.1, 0.55, 0.8]), norm([-0.5, -0.3, 0.8])];
  const moonRamps: readonly Ramp[] = [MOON];
  paintGlobe(buf, cx, cy, {
    r, frame: F, ramps: moonRamps, soft: 0.5, ambient: 0.1, bump: 1.2,
    sample(s, px, py, pz) {
      s.tone = 0.9 + (fbm(px * 2.2 + 5, py * 2.2 + 5, pz * 2.2 + 5, 3) - 0.5) * 0.5;
      marks.forEach((m, i) => {
        const d = Math.sqrt(2 * (1 - (px * m[0] + py * m[1] + pz * m[2]))) / (0.2 + (i % 2) * 0.1);
        if (d < 1) { s.h -= (1 - d * d) * 1.6; s.tone *= 0.88; }
      });
    },
  });
}
