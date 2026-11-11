import { LIGHT, PixelBuf, bay, clamp01, fbm3, noise3, rng, shade } from './pixels';

/** The worlds that hang behind each port. All are painted once into canvases. */

export interface WorldSprite {
  canvas: HTMLCanvasElement;
  /**
   * Screen pixels per pixel of this art. Leave it out for art drawn at the old 320x180 size, which the renderer
   * stretches; native art says 1.
   */
  scale?: number;
  /** Where the body's centre sits within the canvas. */
  cx: number;
  cy: number;
}

type Vec = readonly [number, number, number];
type Ramp = readonly string[];
interface Surface { ramp: Ramp; bias: number }

const rotZ = (n: Vec, a: number): Vec => {
  const c = Math.cos(a), s = Math.sin(a);
  return [n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
};

/**
 * Paint a lit sphere: `surface` picks a colour ramp and brightness offset for each
 * point of the unit sphere; `atmo` adds a haze just outside the sunlit limb and a rim inside it.
 */
function paintSphere(
  buf: PixelBuf, cx: number, cy: number, r: number,
  surface: (n: Vec) => Surface,
  atmo?: { haze: string; rim: string },
  soft = 0.55,
): void {
  const reach = r + 3;
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
    for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d <= r) {
        const nx = dx / r, ny = dy / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const l = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const s = surface([nx, ny, nz]);
        const t = clamp01(l * 1.12 + 0.06) * (0.82 + 0.18 * nz) + s.bias * clamp01(l * 3 + 0.25);
        if (atmo && nz < 0.3 && l > 0.05 && ((0.3 - nz) / 0.3) * l * 1.3 > bay(x, y)) buf.put(x, y, atmo.rim);
        else buf.put(x, y, shade(s.ramp, t, x, y, soft));
      } else if (atmo && d <= r + 2.5) {
        const lit = (dx * LIGHT[0] + dy * LIGHT[1]) / d;
        if ((1 - (d - r) / 2.5) * clamp01(lit + 0.25) * 0.9 > bay(x, y)) buf.put(x, y, atmo.haze);
      }
    }
  }
}

/* ---------- Ossa: the dry world under Kestrel Station ---------- */
const OSSA_PALE = ['#2a1a2e', '#4d2439', '#7d3640', '#ab553f', '#cf8048', '#eab668', '#f8dc98'];
const OSSA_RUST = ['#24172b', '#431f35', '#6b2e3c', '#94463c', '#b96c44', '#d99a58', '#efc885'];
const OSSA_DEEP = ['#1f1428', '#391a31', '#592738', '#7a3838', '#9a5540', '#b97c4c', '#d9a868'];

export function makeOssa(): WorldSprite {
  const r = 88, S = (r + 3) * 2, buf = new PixelBuf(S, S);
  paintSphere(buf, S / 2, S / 2, r, n => {
    const p = rotZ(n, 0.25);
    const lat = p[1] * 6.5 + (fbm3(p[0] * 2, p[1] * 2, p[2] * 2) - 0.5) * 2.6;
    const band = Math.sin(lat * 2.1), streak = Math.sin(lat * 6.3 + 1);
    const basin = fbm3(p[0] * 1.5 + 20, p[1] * 1.5, p[2] * 1.5);
    const grain = (fbm3(p[0] * 6 + 7, p[1] * 12, p[2] * 6, 3) - 0.5) * 0.1;
    const ramp = basin > 0.62 ? OSSA_DEEP : band > 0.2 ? OSSA_PALE : OSSA_RUST;
    return { ramp, bias: (band > 0.2 ? 0.05 : -0.07) + streak * 0.035 + grain + (Math.abs(p[1]) > 0.9 ? 0.1 : 0) };
  }, { haze: '#7a3f48', rim: '#f8cf98' });
  return { canvas: buf.toCanvas(), cx: S / 2, cy: S / 2 };
}

/* ---------- Marrow: a green farm moon ---------- */
const SEA = ['#141a33', '#1d2c57', '#27477d', '#2f6a9c', '#4f9cb8', '#8fd0d6'];
const SHALLOWS = ['#152038', '#20385f', '#2c5c88', '#3f8aa8', '#6fbcc4', '#b0e4de'];
const FARMLAND = ['#162428', '#1f3f3c', '#2f6a4e', '#52955c', '#8fc47a', '#d0e3a0'];
const UPLAND = ['#24202a', '#463a38', '#75603f', '#a88b52', '#d6bd78', '#efe0a8'];
const CLOUD = ['#33395a', '#66749a', '#a9b9c8', '#dfe9ea', '#ffffff', '#ffffff'];

export function makeMarrow(): WorldSprite {
  const r = 64, S = (r + 3) * 2, buf = new PixelBuf(S, S);
  paintSphere(buf, S / 2, S / 2, r, n => {
    const p = rotZ(n, -0.35);
    const cloud = fbm3(p[0] * 2.6 + 9, p[1] * 6.5 + 4, p[2] * 2.6, 4);
    if (cloud > 0.61) return { ramp: CLOUD, bias: 0.12 + (cloud - 0.61) * 1.2 };
    if (Math.abs(p[1]) > 0.9) return { ramp: CLOUD, bias: 0.1 };
    const h = fbm3(p[0] * 2.3 + 3, p[1] * 2.3 + 1, p[2] * 2.3 + 5, 5);
    const grain = (fbm3(p[0] * 9, p[1] * 9, p[2] * 9 + 2, 2) - 0.5) * 0.18;
    if (h > 0.64) return { ramp: UPLAND, bias: grain };
    if (h > 0.52) return { ramp: FARMLAND, bias: grain + (h - 0.52) * 0.6 };
    if (h > 0.49) return { ramp: SHALLOWS, bias: 0.06 };
    return { ramp: SEA, bias: (h - 0.4) * 0.5 };
  }, { haze: '#2f6a9c', rim: '#a8e0e6' });
  return { canvas: buf.toCanvas(), cx: S / 2, cy: S / 2 };
}

/* ---------- Dry Hollow's rock: a cratered asteroid with a strip mine ---------- */
const ROCK = ['#1c1724', '#352c38', '#574a4c', '#7d6e64', '#a39280', '#cdbfa5', '#ebe0c4'];

/**
 * Where the strip mine sits relative to the rock's centre, in the rock's own pixels. The renderer places the rock
 * so this point lands on the far end of the mining rig's conveyor (MINE_BELT_END in render.ts).
 */
export const ROCK_PIT = { x: -27, y: -9 };

export function makeRock(): WorldSprite {
  const S = 136, c = S / 2, buf = new PixelBuf(S, S);
  const rnd = rng(41);
  const craters = Array.from({ length: 11 }, () => {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 40;
    return { x: Math.cos(a) * d * 1.15, y: Math.sin(a) * d * 0.85, r: 3 + rnd() * rnd() * 11 };
  }).filter(k => Math.hypot(k.x - ROCK_PIT.x, k.y - ROCK_PIT.y) > k.r + 9);
  const cos = Math.cos(0.4), sin = Math.sin(0.4);

  /** Surface height at a point, or null outside the rock's lumpy outline. */
  const height = (x: number, y: number): number | null => {
    const u = (x * cos + y * sin) / 1.24, v = (-x * sin + y * cos) / 0.9;
    const th = Math.atan2(v, u), d = Math.hypot(u, v);
    const R = 45 * (0.84 + 0.5 * (noise3(Math.cos(th) * 1.3 + 5, Math.sin(th) * 1.3 + 5, 3.3) - 0.5)
      + 0.16 * (noise3(Math.cos(th) * 4 + 2, Math.sin(th) * 4 + 2, 9.1) - 0.5));
    if (d >= R) return null;
    let h = Math.sqrt(1 - (d / R) ** 2) * 22;
    h += (fbm3(x * 0.055, y * 0.055, 1.7) - 0.5) * 15 + (fbm3(x * 0.3, y * 0.3, 4.2, 2) - 0.5) * 2;
    for (const k of craters) {
      const q = Math.hypot(x - k.x, y - k.y) / k.r;
      if (q < 1) h -= k.r * 0.55 * (1 - q * q);
      h += k.r * 0.2 * Math.exp(-(((q - 1) / 0.22) ** 2));
    }
    return h;
  };

  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const x = px + 0.5 - c, y = py + 0.5 - c;
      const h = height(x, y);
      if (h === null) continue;
      const at = (ax: number, ay: number) => height(ax, ay) ?? h - 3; // the surface falls away at the edge
      const gx = (at(x + 1, y) - at(x - 1, y)) / 2, gy = (at(x, y + 1) - at(x, y - 1)) / 2;
      const len = Math.hypot(gx, gy, 1);
      const l = (-gx * LIGHT[0] - gy * LIGHT[1] + LIGHT[2]) / len;
      const tone = (fbm3(x * 0.05 + 8, y * 0.05, 2.2, 2) - 0.5) * 0.18;
      buf.put(px, py, shade(ROCK, clamp01(l * 1.15 - 0.16) + tone, px, py, 0.6));
    }
  }

  // strip mine: three terraces cut into the face nearest the rig, with work lights
  const px0 = Math.round(c + ROCK_PIT.x), py0 = Math.round(c + ROCK_PIT.y);
  const carve = (x: number, y: number, w: number, h: number, col: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (buf.get(x + i, y + j) >= 0) buf.put(x + i, y + j, col);
  };
  ([[9, 6, ROCK[3]], [6, 4, ROCK[2]], [3, 2, ROCK[1]]] as const).forEach(([w, hgt, col], k) => {
    carve(px0 - w, py0 - hgt, w * 2, hgt * 2, col);
    carve(px0 - w, py0 + hgt - 1, w * 2, 1, ROCK[5 - k]); // sunlit lower wall
    carve(px0 - w, py0 - hgt, 1, hgt * 2, ROCK[5 - k]);
    carve(px0 - w, py0 - hgt, w * 2, 1, ROCK[0]); // shadowed upper wall
    carve(px0 + w - 1, py0 - hgt, 1, hgt * 2, ROCK[0]);
  });
  buf.put(px0 - 7, py0 + 3, '#ffd27a');
  buf.put(px0 + 5, py0 - 4, '#ffd27a');
  buf.rect(px0 + 11, py0 + 2, 4, 3, '#94806f');
  buf.rect(px0 + 11, py0 + 2, 4, 1, '#e3d5b8');
  buf.put(px0 + 12, py0 + 3, '#ffd27a');

  return { canvas: buf.toCanvas(), cx: c, cy: c };
}

/* ---------- The Lantern's neighbour: a ringed gas giant ---------- */
const GAS_LILAC = ['#1a1230', '#2f2150', '#4c3478', '#7350a0', '#9f78bd', '#cba6d6', '#eed4ea'];
const GAS_DUSK = ['#17102b', '#281b47', '#3f2b69', '#5d428c', '#8263a8', '#ab8cc4', '#d4bbdc'];
const GAS_ROSE = ['#1f1230', '#3a1f4c', '#5f2f66', '#8a4a7c', '#b46f8f', '#d99aa6', '#f2c8c0'];
const RING = ['#2a2340', '#4a3f6b', '#7a6da0', '#b0a4cf', '#e0d6ee'];

/** How much ring material there is at a radius (in planet radii): 0 = gap, 1 = dense. */
function ringDensity(rho: number): number {
  if (rho < 1.22 || rho > 1.92) return 0;
  if (rho < 1.36) return 0.35;
  if (rho < 1.6) return 0.95;
  if (rho < 1.66) return 0.06;
  if (rho < 1.84) return rho > 1.75 && rho < 1.775 ? 0.12 : 0.7;
  if (rho < 1.88) return 0;
  return 0.4;
}

export function makeGiant(): WorldSprite {
  const r = 84, W = 336, H = 184, cx = W / 2, cy = H / 2;
  const buf = new PixelBuf(W, H);
  const phi = (-20 * Math.PI) / 180, k = 0.3; // ring tilt on screen, and how edge-on we see it
  const a: Vec = [Math.cos(phi), Math.sin(phi), 0];
  const b: Vec = [-Math.sin(phi) * k, Math.cos(phi) * k, Math.sqrt(1 - k * k)];
  const N: Vec = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // the planet's axis
  const dot = (p: Vec, q: Vec) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const LN = dot(LIGHT, N);
  const storm: Vec = (() => { const v = [0.3, 0.42, 0.86], n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n] as const; })();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;

      // ring: undo the tilt to find this pixel's radius within the ring plane
      const u = dx * a[0] + dy * a[1], v = -dx * Math.sin(phi) + dy * Math.cos(phi), w = v / k;
      const rho = Math.hypot(u, w) / r, dens = ringDensity(rho);
      const ringHere = dens >= 0.6 || (dens > 0.2 && ((x + y) & 1) === 0) || (dens > 0 && dens * 2 > bay(x, y)); // dense bands solid, faint ones see-through
      let ringColour = '';
      if (ringHere) {
        const P: Vec = [u * a[0] + w * b[0], u * a[1] + w * b[1], w * b[2]];
        const along = dot(P, LIGHT);
        const shadowed = along < 0 && dot(P, P) - along * along < r * r; // in the planet's shadow
        const t = (0.3 + dens * 0.55 + Math.sin(rho * 140) * 0.07) * (shadowed ? 0.2 : 1);
        ringColour = shade(RING, t, x, y, 0.3);
      }

      const d = Math.hypot(dx, dy);
      if (ringHere && v > 0) {
        buf.put(x, y, ringColour); // near side of the ring passes in front
      } else if (d <= r) {
        const n: Vec = [dx / r, dy / r, Math.sqrt(Math.max(0, 1 - (dx * dx + dy * dy) / (r * r)))];
        const lat = dot(n, N), pa = dot(n, a), pb = dot(n, b);
        const turb = fbm3(pa * 1.6 + 4, lat * 6, pb * 1.6) - 0.5;
        const band = Math.sin((lat * 8 + turb * 1.5) * 2.4);
        let ramp = band > 0.35 ? GAS_LILAC : band < -0.4 ? GAS_ROSE : GAS_DUSK;
        let bias = band * 0.05 + (fbm3(pa * 4, lat * 16, pb * 4 + 3, 3) - 0.5) * 0.2;
        // one long-lived storm
        const off: Vec = [n[0] - storm[0], n[1] - storm[1], n[2] - storm[2]];
        const dLat = dot(off, N), dAlong = Math.sqrt(Math.max(0, dot(off, off) - dLat * dLat));
        const q = Math.hypot(dLat / 0.075, dAlong / 0.17);
        if (q < 1) { ramp = GAS_ROSE; bias += q > 0.7 ? -0.08 : 0.16 * (1 - q); }
        // shadow the rings cast on the cloud tops
        const tHit = -(lat * r) / LN;
        let shadow = 0;
        if (tHit > 0) {
          const Q: Vec = [n[0] * r + LIGHT[0] * tHit, n[1] * r + LIGHT[1] * tHit, n[2] * r + LIGHT[2] * tHit];
          shadow = ringDensity(Math.sqrt(dot(Q, Q)) / r) * 0.32;
        }
        const l = dot(n, LIGHT);
        // a touch of ambient light keeps the night side readable against the sky
        const t = clamp01(l * 1.05 + 0.14) * (0.82 + 0.18 * n[2]) + (bias - shadow) * clamp01(l * 3 + 0.25);
        if (n[2] < 0.3 && l > 0.05 && ((0.3 - n[2]) / 0.3) * l * 1.2 > bay(x, y)) buf.put(x, y, '#e8cdf0');
        else buf.put(x, y, shade(ramp, t, x, y, 0.55));
      } else if (ringHere) {
        buf.put(x, y, ringColour); // far side of the ring, where the planet doesn't hide it
      } else if (d <= r + 2.5) {
        const lit = (dx * LIGHT[0] + dy * LIGHT[1]) / d;
        if ((1 - (d - r) / 2.5) * clamp01(lit + 0.25) * 0.9 > bay(x, y)) buf.put(x, y, '#5f3d86');
      }
    }
  }
  return { canvas: buf.toCanvas(), cx, cy };
}
