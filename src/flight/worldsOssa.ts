import { PixelBuf, rng } from './pixels';
import { type Vec, clamp, fbm, frame, gnoise, norm, paintGlobe, ramp, ridge, step, toFrame } from './worldsKit';

/**
 * Ossa: the dry world under the ring stations. Wind-banded dune seas in amber over rust plains, dark basalt
 * basins, a rift canyon, old craters, mountain chains, salt at the poles and a dust storm or two.
 */

const DUNE = ramp('#2a1a2e', '#4d2439', '#7d3640', '#ab553f', '#cf8048', '#e4a45c', '#f2c880', '#fbe4a8');
const RUST = ramp('#24172b', '#431f35', '#6b2e3c', '#94463c', '#b96c44', '#d99a58', '#efc885');
const BASALT = ramp('#1f1428', '#33192f', '#4c2236', '#69303a', '#85463c', '#a36444', '#c08a55');
const SALT = ramp('#2a1c30', '#4a2a40', '#7a4a50', '#b07a64', '#deb48c', '#f4dcb4', '#fff4d8');
const DUST = ramp('#3a2238', '#6a3a48', '#a0624e', '#d09860', '#f0cc90', '#fbeab8');
const M_DUNE = 0, M_RUST = 1, M_BASALT = 2, M_SALT = 3;

export const OSSA_R = 132;

export function paintOssa(buf: PixelBuf, cx: number, cy: number): void {
  const r = OSSA_R, F = frame(0.3, 0.42);
  /** A point given as it appears on screen (x right, y down), in the planet's frame. */
  const at = (x: number, y: number): Vec => toFrame(F, norm([x, y, Math.sqrt(Math.max(0.01, 1 - x * x - y * y))]));

  const rnd = rng(1207);
  // three craters placed where the eye will find them, and a scatter of small ones
  const craters = [{ p: at(-0.45, -0.38), size: 0.115 }, { p: at(0.62, 0.02), size: 0.07 }, { p: at(0.05, 0.42), size: 0.085 }, { p: at(0.3, -0.62), size: 0.05 }];
  for (let i = 0; i < 24; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.95;
    craters.push({ p: at(Math.cos(a) * d, Math.sin(a) * d), size: i < 5 ? 0.04 + rnd() * 0.025 : 0.016 + rnd() * 0.02 });
  }
  const rift = at(0.28, -0.12), storm = at(-0.2, 0.4), erg = at(0.5, 0.3);

  paintGlobe(buf, cx, cy, {
    r, frame: F, ramps: [DUNE, RUST, BASALT, SALT], bump: 0.9, soft: 0.62, ambient: 0.09, gain: 0.82,
    cloud: { ramp: DUST, shadow: 0.3, reach: 4 },
    air: { rim: [0xf8cf98, 0xd98a5c], haze: [0xa8584c, 0x6a3248], reach: 4.5, strength: 0.95 },
    nightRim: 0x3d2238,
    sample(s, px, py, pz) {
      const warp = fbm(px * 1.4 + 11, py * 1.4 + 3, pz * 1.4 + 7, 3) - 0.5;
      const lat = py + warp * 0.3;
      // wind belts: uneven widths, and long streaks drawn out along them
      const belt = gnoise(lat * 3.6 + 3.7, 1.3, 8.1) * 0.65 + gnoise(lat * 8.5 + 1.2, 5.5, 2.2) * 0.35;
      const streak = fbm(px * 2.6 + 5, lat * 20, pz * 2.6 + 9, 4) - 0.5;
      const elev = fbm(px * 2.1 + 31, py * 2.1 + 17, pz * 2.1 + 5, 5);
      const basin = fbm(px * 1.5 + 20, py * 2.1 + 2, pz * 1.5 + 40, 5);
      const grain = fbm(px * 14 + 3, py * 14 + 1, pz * 14 + 8, 2) - 0.5;

      let h = 0, tone = 0.92 + belt * 0.05 + streak * 0.3 + grain * 0.1;
      let mat = belt * 0.5 + streak * 1.7 > 0.06 ? M_DUNE : M_RUST;

      // dark basalt plains, with ragged shores
      if (basin + grain * 0.05 > 0.615) {
        mat = M_BASALT;
        const mottle = fbm(px * 6 + 12, py * 6 + 4, pz * 6 + 9, 3) - 0.5;
        tone = 0.9 + streak * 0.5 + mottle * 0.45 + grain * 0.15;
        h += mottle * 2.4 - 0.6;
      } else if (basin > 0.59) tone *= 0.9;

      // mountain chains where the ground is high
      const high = step(0.52, 0.66, elev);
      if (high > 0) {
        const crest = ridge(px * 5.5 + 3, py * 5.5 + 8, pz * 5.5 + 1, 4);
        h += high * crest * 7;
        tone *= 1 - high * 0.1 + crest * high * 0.12;
        if (mat === M_DUNE && high > 0.5) mat = M_RUST;
      }

      // the rift: a branching canyon running with the belts
      const dr = 1 - (px * rift[0] + py * rift[1] + pz * rift[2]);
      if (dr < 0.2) {
        const m = step(0.2, 0.07, dr);
        const cf = fbm(px * 1.7 + 50, py * 6.5 + 60, pz * 1.7 + 70, 4);
        const main = clamp(1 - Math.abs(cf - 0.5) / 0.02) * m;
        const cf2 = fbm(px * 5 + 90, py * 9 + 20, pz * 5 + 30, 3);
        const side = clamp(1 - Math.abs(cf2 - 0.5) / 0.012) * m * clamp(1 - Math.abs(cf - 0.5) / 0.09);
        const cut = Math.max(main, side * 0.7);
        if (cut > 0) {
          h -= cut * 5;
          if (cut > 0.45) { mat = M_BASALT; tone = 0.78; }
        }
      }

      // a dune sea: long crests, lit and shaded
      const de = 1 - (px * erg[0] + py * erg[1] + pz * erg[2]);
      if (de < 0.16 && mat === M_DUNE) {
        const lon = Math.atan2(px, pz);
        h += Math.sin(lon * 64 + lat * 30 + warp * 30) * 0.8 * step(0.16, 0.05, de);
      }

      // craters: a bowl, a raised rim, a paler apron
      for (const c of craters) {
        const d = 1 - (px * c.p[0] + py * c.p[1] + pz * c.p[2]);
        const lim = c.size * c.size * 1.3; // (1 - cos) of 1.6 crater radii
        if (d > lim) continue;
        const q = Math.sqrt(2 * d) / c.size, depth = c.size * r * 0.38;
        if (q < 1) {
          h -= depth * (1 - q * q);
          tone *= 0.9;
          if (c.size > 0.04 && q < 0.6) mat = mat === M_BASALT ? M_BASALT : M_RUST;
        }
        h += depth * 0.4 * Math.exp(-(((q - 1) / 0.2) ** 2));
        if (q >= 1 && q < 1.5) tone *= 1.06;
      }

      // salt: caps at the poles, and pans in the lowest ground
      const edge = (fbm(px * 6 + 1, py * 6 + 2, pz * 6 + 3, 3) - 0.5) * 0.14;
      if (lat < -0.9 + edge || lat > 0.92 + edge) {
        mat = M_SALT;
        tone = 0.95 + grain * 0.2;
      } else if (lat < -0.85 + edge) {
        tone *= 1.1;
      }

      // dust storms: pale streaks lifted off the plains
      const ds = 1 - (px * storm[0] + py * storm[1] + pz * storm[2]);
      const veil = fbm(px * 2.2 + 70, lat * 9 + 80, pz * 2.2 + 90, 4);
      s.cloud = clamp((veil - 0.63 + step(0.3, 0.02, ds) * 0.14) * 7);

      s.mat = mat; s.tone = tone; s.h = h;
    },
  });
}
