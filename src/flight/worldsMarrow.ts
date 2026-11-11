import { LIGHT, PixelBuf, rng } from './pixels';
import { type Vec, clamp, dot, fbm, frame, hash2, norm, paintGlobe, ramp, ridge, step, toFrame } from './worldsKit';

/**
 * Marrow: a green and blue farm moon. Seas with pale shallows, a patchwork of fields on the lowlands, forest,
 * tan uplands with snow on the peaks, ice at the poles, and weather: bands of cloud and one slow cyclone.
 * The night side shows the lamps of a few farm towns.
 */

const SEA = ramp('#141a33', '#1b2850', '#234272', '#2c6294', '#3f8ab0', '#6fb8c8', '#b4e6e0');
const SHALLOWS = ramp('#152038', '#1f3660', '#2a5a88', '#3a86a6', '#62b6c0', '#a4e0d8', '#dcf6ea');
const FIELD = ramp('#162428', '#1f3f3c', '#2f6a4e', '#52955c', '#8fc47a', '#c6e09a', '#eef2c0');
const FOREST = ramp('#131f28', '#1a3338', '#22503f', '#2f6e4a', '#4a8e55', '#7fb46c');
const WHEAT = ramp('#2a2028', '#4f3d34', '#84693c', '#b89848', '#e0c868', '#f6eea8');
const UPLAND = ramp('#24202a', '#463a38', '#75603f', '#a88b52', '#d6bd78', '#efe0a8');
const SNOW = ramp('#2c3252', '#55628c', '#8e9fbc', '#c4d3dc', '#eef4f2', '#ffffff');
const CLOUD = ramp('#1a2140', '#2c3966', '#52639a', '#8598c0', '#b9cadb', '#e4eeee', '#ffffff');
const M_SEA = 0, M_SHALLOWS = 1, M_FIELD = 2, M_FOREST = 3, M_WHEAT = 4, M_UPLAND = 5, M_SNOW = 6;

export const MARROW_R = 96;

export function paintMarrow(buf: PixelBuf, cx: number, cy: number): void {
  const r = MARROW_R, F = frame(-0.38, 0.3);
  const at = (x: number, y: number): Vec => toFrame(F, norm([x, y, Math.sqrt(Math.max(0.01, 1 - x * x - y * y))]));

  // the cyclone: its eye, and two directions across it to measure the spiral by
  const eye = at(-0.34, -0.3);
  const e1 = norm([eye[1], -eye[0], 0.001]), e2: Vec = [eye[1] * e1[2] - eye[2] * e1[1], eye[2] * e1[0] - eye[0] * e1[2], eye[0] * e1[1] - eye[1] * e1[0]];

  /** Height of the land: above 0.5 is dry. */
  const elevation = (px: number, py: number, pz: number): number => {
    const wx = fbm(px * 1.3 + 3, py * 1.3 + 8, pz * 1.3 + 1, 3) - 0.5, wy = fbm(px * 1.3 + 40, py * 1.3 + 2, pz * 1.3 + 60, 3) - 0.5;
    return fbm((px + wx * 0.5) * 1.8 + 3.3, (py + wy * 0.5) * 1.8 + 1.1, (pz + wx * 0.5) * 1.8 + 5.2, 6);
  };
  const SEA_LEVEL = 0.485;

  paintGlobe(buf, cx, cy, {
    r, frame: F, ramps: [SEA, SHALLOWS, FIELD, FOREST, WHEAT, UPLAND, SNOW], bump: 1.0, soft: 0.6, ambient: 0.1,
    cloud: { ramp: CLOUD, shadow: 0.34, reach: 3 },
    air: { rim: [0xb4e6e0, 0x4f9cc0], haze: [0x3f8ab0, 0x234272], reach: 5.5, strength: 1.05 },
    nightRim: 0x1f3660,
    sample(s, px, py, pz, _nx, _ny, nz) {
      const e = elevation(px, py, pz);
      const grain = fbm(px * 11 + 2, py * 11 + 7, pz * 11 + 4, 2) - 0.5;
      const land = e - SEA_LEVEL;

      if (land < 0) {
        // sea: darker with depth, a pale shelf along the coast
        if (land > -0.022) { s.mat = M_SHALLOWS; s.tone = 0.95 + (land + 0.022) * 6; }
        else { s.mat = M_SEA; s.tone = 0.98 + land * 0.9 + grain * 0.05; }
        s.gloss = 0.9;
      } else {
        const wet = fbm(px * 2.6 + 15, py * 2.6 + 25, pz * 2.6 + 35, 4);
        s.h = land * 8;
        if (land > 0.13) {
          // uplands: bare ridges, snow on the tops
          const crest = ridge(px * 7 + 1, py * 7 + 2, pz * 7 + 3, 3), up = step(0.13, 0.18, land);
          s.h += (crest * 5 + (land - 0.13) * 30) * up;
          if (land + crest * 0.05 > 0.235) { s.mat = M_SNOW; s.tone = 1; }
          else { s.mat = M_UPLAND; s.tone = 0.85 + crest * 0.25 + grain * 0.12; }
        } else if (land < 0.006) {
          s.mat = M_WHEAT; s.tone = 1.1; // beaches
        } else if (wet > 0.44 && land < 0.1) {
          // farmland: a patchwork of fields, squared off along the lines of latitude
          const lon = Math.atan2(px, pz), la = Math.asin(clamp(py * 0.5 + 0.5) * 2 - 1);
          const skew = fbm(px * 3 + 9, py * 3 + 9, pz * 3 + 9, 2) - 0.5;
          const u = Math.floor(lon * 15 + skew * 5), v = Math.floor(la * 19 + skew * 4);
          const kind = hash2(u, v), fade = step(0.25, 0.6, nz);
          if (kind < 0.26) { s.mat = M_WHEAT; s.tone = 0.92 + kind * 0.5; }
          else if (kind < 0.5) { s.mat = M_FIELD; s.tone = 1.12; }
          else if (kind < 0.78) { s.mat = M_FIELD; s.tone = 0.8; }
          else { s.mat = M_FOREST; s.tone = 0.95; }
          if (fade < 1 && kind >= 0.26) { s.mat = M_FIELD; s.tone = 0.95 + (s.tone - 0.95) * fade; }
        } else if (wet > 0.38) {
          s.mat = M_FOREST; s.tone = 0.9 + grain * 0.35 + land;
        } else {
          s.mat = M_FIELD; s.tone = 0.82 + grain * 0.25 + land * 1.5; // open grassland
        }
      }

      // polar ice, ragged at the edge, with floes off the shore
      const ice = Math.abs(py) + (fbm(px * 5 + 4, py * 5 + 4, pz * 5 + 4, 3) - 0.5) * 0.16 + (land > 0 ? 0.04 : 0);
      if (ice > 0.9) { s.mat = M_SNOW; s.tone = 0.96 + grain * 0.1; s.gloss = 0; s.h = 0.5; }

      // weather: bands drawn out along the latitudes
      const wv = fbm(px * 2.1 + 9, py * 2.1 + 4, pz * 2.1 + 2, 3) - 0.5;
      let c = fbm(px * 2.4 + 9 + wv, (py + wv * 0.25) * 6.2 + 4, pz * 2.4 + wv, 5) - 0.585;
      c += 0.05 * step(0.3, 0.55, Math.abs(py + 0.1)) * step(0.95, 0.75, Math.abs(py)) - 0.035;
      // the cyclone: spiral arms winding into a clear eye
      const de = 1 - (px * eye[0] + py * eye[1] + pz * eye[2]);
      if (de < 0.09) {
        const rho = Math.sqrt(2 * de) / 0.42; // 0 at the eye, 1 at the rim
        const th = Math.atan2(px * e2[0] + py * e2[1] + pz * e2[2], px * e1[0] + py * e1[1] + pz * e1[2]);
        const arm = Math.sin(th * 2 - Math.log(rho + 0.05) * 3.4 + wv * 2);
        const body = (1 - rho) * (1 - rho);
        const spiral = (arm * 0.5 + 0.5) * (0.35 + body * 0.9) * step(1, 0.75, rho) - 0.12 + body * 0.25;
        c = Math.max(c * step(0.4, 1, rho), spiral * 0.35);
        if (rho < 0.09) c = -1;
      }
      s.cloud = clamp(c * 7.5);
    },
  });

  // farm towns: a few lamps on the night side, on low ground
  const rnd = rng(5150), lamps: [number, number][] = [];
  for (let i = 0; i < 900 && lamps.length < 22; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.93, nx = Math.cos(a) * d, ny = Math.sin(a) * d;
    const n: Vec = [nx, ny, Math.sqrt(1 - d * d)];
    if (dot(n, LIGHT) > -0.16) continue;
    const p = toFrame(F, n), land = elevation(p[0], p[1], p[2]) - SEA_LEVEL;
    if (land < 0.004 || land > 0.07 || Math.abs(p[1]) > 0.8) continue;
    const x = Math.floor(cx + nx * r), y = Math.floor(cy + ny * r);
    if (lamps.some(([lx, ly]) => Math.abs(lx - x) + Math.abs(ly - y) < 3)) continue;
    lamps.push([x, y]);
    buf.putRgb(x, y, lamps.length % 3 ? 0xeab668 : 0xf8dc98);
    // towns gather: the odd lamp has a neighbour
    if (lamps.length % 4 === 0) buf.putRgb(x + 1, y, 0xb5683f);
  }
}
