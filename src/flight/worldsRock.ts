import { LIGHT, PixelBuf, rng } from './pixels';
import { clamp, fbm, gnoise, pick, ramp, step } from './worldsKit';

/**
 * Dry Hollow's rock: a two-lobed asteroid, cratered and grooved, with a strip mine cut into the face nearest
 * the rig. It is modelled as a height map seen from above, lit from the upper right, with cast shadows.
 */

const REGOLITH = ramp('#241d2e', '#352b3a', '#4c4048', '#695a54', '#897a6a', '#a99a84', '#cdbfa5', '#ebe0c4');
const BEDROCK = ramp('#221c2e', '#30283a', '#443a4a', '#5c5260', '#7a6f76', '#9a908c', '#bcb3a6');
const SPOIL = ramp('#2a1f2a', '#443038', '#644c46', '#866a56', '#a88a6a', '#cbb08a', '#ecd8b0');
const ORE = ramp('#2e1a24', '#552836', '#84403c', '#b06040', '#d48a4c', '#eebc70');
const M_REGOLITH = 0, M_BEDROCK = 1, M_SPOIL = 2, M_ORE = 3;
const RAMPS = [REGOLITH, BEDROCK, SPOIL, ORE];

const W = 212, H = 204, CX = 100, CY = 102;

/**
 * Where the rig's conveyor lands, relative to the rock's centre, in the rock's own pixels: the near lip of the
 * strip mine. The renderer places the rock so this point meets the conveyor's far end, and the rig's loader
 * stands just beyond it (about 20 pixels right, 16 up and down), so there is firm ground kept under all of that.
 */
export const ROCK_PIT = { x: -42, y: -27 };
/** The middle of the pit: the loader stands on its near lip, so the pit lies beyond the conveyor's end. */
const PIT = { x: ROCK_PIT.x + 40, y: ROCK_PIT.y + 7, a: 25, b: 18, turn: 0.3 };
const DROP = 2.3, LEVELS = 4;
/** The haul road climbs out of the pit this way (radians, screen axes). */
const ROAD = 0.5;

export function paintRock(): { canvas: HTMLCanvasElement; cx: number; cy: number } {
  const buf = new PixelBuf(W, H);
  const hgt = new Float32Array(W * H).fill(-1), tone = new Float32Array(W * H).fill(1), mat = new Uint8Array(W * H);

  // the body: one big lobe standing steeply, its long face toward the rig, and a smaller one fused to its flank
  const ax = 0.34, ay = -0.94;
  const main = { a: 84, b: 71, c: 42 }, flank = { u: -22, v: 64, a: 43, b: 38, c: 26 };
  const rnd = rng(4107);
  // old breaks: flat faces struck off the big lobe, so it reads as chipped rock and not as a ball of dough
  const faces = Array.from({ length: 11 }, () => {
    const a = rnd() * Math.PI * 2, d = 0.25 + rnd() * 0.6, u0 = Math.cos(a) * d * main.a, v0 = Math.sin(a) * d * main.b;
    const h0 = main.c * Math.sqrt(1 - d * d);
    const nu = u0 / main.a ** 2, nv = v0 / main.b ** 2, nh = h0 / main.c ** 2, keep = 0.88 + rnd() * 0.08;
    return { nu: nu / nh, nv: nv / nh, d: ((nu * u0 + nv * v0 + nh * h0) * keep) / nh };
  });
  const body = (x: number, y: number): number => {
    const wx = (fbm(x * 0.012 + 3, y * 0.012 + 7, 1.5, 3) - 0.5) * 22, wy = (fbm(x * 0.012 + 9, y * 0.012 + 1, 4.5, 3) - 0.5) * 22;
    const X = x + wx, Y = y + wy, u = X * ax + Y * ay, v = -X * ay + Y * ax;
    let h = -1;
    const q = 1 - (u / main.a) ** 2 - (v / main.b) ** 2;
    if (q > 0) {
      h = main.c * Math.sqrt(q);
      for (const f of faces) h = Math.min(h, f.d - f.nu * u - f.nv * v);
    }
    const q2 = 1 - ((u - flank.u) / flank.a) ** 2 - ((v - flank.v) / flank.b) ** 2;
    if (q2 > 0) h = Math.max(h, flank.c * Math.sqrt(q2));
    return h;
  };

  interface Crater { x: number; y: number; r: number; gx: number; gy: number; squash: number }
  const craters: Crater[] = [];
  const sizes = [17, 13, 11, 9, 8, 8, 7, 6, 6, 5, 5, 5, 4.5, 4, 4, 4, 3.5, 3.5, 3.5, 3, 3, 3, 3, 3, 2.6, 2.6, 2.6, 2.6, 2.4, 2.4, 2.4, 2.4, 2.2, 2.2, 2.2, 2.2, 2, 2, 2, 2, 2, 2];
  for (const r of sizes) {
    for (let tries = 0; tries < 200; tries++) {
      const x = (rnd() - 0.5) * 190, y = (rnd() - 0.5) * 190, h0 = body(x, y);
      if (h0 < (r > 8 ? 20 : 7)) continue;
      if (Math.hypot(x - PIT.x + 8, y - PIT.y) < r + PIT.a + 20) continue;
      if (craters.some(k => Math.hypot(k.x - x, k.y - y) < (k.r + r) * (r > 7 && k.r > 7 ? 2.2 : 1.15))) continue;
      // craters on ground that slopes away from us are seen at a slant
      const sx = (body(x + 2, y) - body(x - 2, y)) / 4, sy = (body(x, y + 2) - body(x, y - 2)) / 4, sl = Math.hypot(sx, sy);
      craters.push({ x, y, r, gx: sl > 0.01 ? sx / sl : 1, gy: sl > 0.01 ? sy / sl : 0, squash: Math.max(0.45, 1 / Math.sqrt(1 + sl * sl)) });
      break;
    }
  }
  const boulders = Array.from({ length: 22 }, () => ({ x: (rnd() - 0.5) * 170, y: (rnd() - 0.5) * 170 }));
  const heaps = [
    { x: PIT.x + 35, y: PIT.y - 15, r: 6, h: 4.5 }, { x: PIT.x + 42, y: PIT.y - 7, r: 4.5, h: 3.4 },
    { x: PIT.x + 31, y: PIT.y + 25, r: 6.5, h: 5 }, { x: PIT.x + 21, y: PIT.y + 30, r: 5, h: 3.6 }, { x: PIT.x + 2, y: PIT.y + 29, r: 4, h: 3 },
  ];
  const pc = Math.cos(PIT.turn), ps = Math.sin(PIT.turn);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = px + 0.5 - CX, y = py + 0.5 - CY;
      const base = body(x, y);
      if (base <= 0) continue;
      const k = py * W + px;
      let h = base + (fbm(x * 0.03 + 5, y * 0.03 + 2, 1.7, 2) - 0.5) * 9 + (fbm(x * 0.09, y * 0.09, 4.2, 2) - 0.5) * 1.6;
      let t = 0.92 + (fbm(x * 0.022 + 8, y * 0.022, 2.2, 3) - 0.5) * 0.5 + (fbm(x * 0.11 + 1, y * 0.11 + 5, 6.1, 2) - 0.5) * 0.16;
      let m = M_REGOLITH;

      // grooves: long scratches across one lobe
      const gv = x * 0.82 + y * 0.57 + (fbm(x * 0.02, y * 0.02, 9.3, 2) - 0.5) * 30;
      const groove = Math.cos((gv * Math.PI * 2) / 31);
      if (groove > 0.93 && fbm(x * 0.02 + 4, y * 0.02 + 4, 3.3, 2) > 0.5) { h -= (groove - 0.93) * 16; t *= 0.93; }

      for (const c of craters) {
        const dx = x - c.x, dy = y - c.y;
        if (Math.abs(dx) > c.r * 1.7 || Math.abs(dy) > c.r * 1.7) continue;
        const along = dx * c.gx + dy * c.gy, across = -dx * c.gy + dy * c.gx;
        const q = Math.hypot(along / c.squash, across) / c.r;
        if (q < 1) {
          h -= Math.min(c.r * 0.5, 2 + c.r * 0.22) * (1 - q * q);
          t *= 0.9;
          if (c.r > 6 && q < 0.7) m = M_BEDROCK;
        }
        h += c.r * 0.24 * Math.exp(-(((q - 1) / 0.2) ** 2));
        if (q > 1 && q < 1.6) t *= 1.05;
      }
      for (const b of boulders) {
        const d = Math.hypot(x - b.x, y - b.y);
        if (d < 1.6) h += 1.6 * (1.6 - d);
      }

      // spoil heaps beside the pit: cones of paler waste
      for (const s of heaps) {
        const d = Math.hypot(x - s.x, y - s.y);
        if (d < s.r) {
          h += s.h * (1 - d / s.r);
          m = M_SPOIL;
          t = 0.86 + gnoise(x * 0.9, y * 0.9, 3) * 0.08;
        }
      }

      // the strip mine: benches stepping down to an ore floor, and a haul road climbing out
      const dx = x - PIT.x, dy = y - PIT.y, u = dx * pc + dy * ps, v = -dx * ps + dy * pc;
      const th = Math.atan2(dy, dx);
      const q = Math.hypot(u / PIT.a, v / PIT.b) * (1 + gnoise(Math.cos(th) * 1.6 + 4, Math.sin(th) * 1.6 + 4, 2.2) * 0.14);
      if (q < 1.12) {
        // smooth the ground the pit is cut into, so the benches read as level
        const smooth = base + (fbm(x * 0.03 + 5, y * 0.03 + 2, 1.7, 2) - 0.5) * 9;
        h = q < 1 ? smooth : h + (smooth - h) * step(1.12, 1, q);
        if (q < 1) {
          const level = (1 - q) * (LEVELS + 0.75);
          let turn = Math.abs(th - ROAD);
          if (turn > Math.PI) turn = Math.PI * 2 - turn;
          const onRoad = turn < 0.2 + 0.1 * q;
          const li = Math.min(LEVELS, Math.floor(level));
          h -= onRoad ? Math.min(LEVELS, level) * DROP : li * DROP;
          m = li >= LEVELS ? M_ORE : li >= 2 ? M_BEDROCK : M_REGOLITH;
          t = onRoad ? 1.12 : li >= LEVELS ? 1 + gnoise(x * 0.7, y * 0.7, 5) * 0.12 : 1.04 + (li & 1) * 0.08;
        } else {
          t *= 1.06; // the lip is trampled pale
        }
      }

      hgt[k] = h; tone[k] = t; mat[k] = m;
    }
  }

  // wheel tracks: from the head of the haul road out to the heaps
  const roadTop = { x: PIT.x + Math.cos(ROAD) * (PIT.a + 2), y: PIT.y + Math.sin(ROAD) * (PIT.b + 5) };
  const track = (pts: readonly (readonly [number, number])[]) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5);
      const len = Math.hypot(x1 - x0, y1 - y0), ox = -(y1 - y0) / len, oy = (x1 - x0) / len;
      for (let s = 0; s <= n; s++) {
        for (const side of [-1, 1]) {
          const x = Math.round(CX + x0 + ((x1 - x0) * s) / n + ox * side), y = Math.round(CY + y0 + ((y1 - y0) * s) / n + oy * side);
          if (x >= 0 && y >= 0 && x < W && y < H && hgt[y * W + x] > 0 && mat[y * W + x] !== M_SPOIL) tone[y * W + x] = Math.min(tone[y * W + x], 0.58);
        }
      }
    }
  };
  track([[roadTop.x, roadTop.y], [roadTop.x + 9, roadTop.y + 1], [heaps[1].x + 2, heaps[1].y + 8], [heaps[0].x + 9, heaps[0].y + 3]]);
  track([[roadTop.x, roadTop.y], [roadTop.x + 6, roadTop.y + 8], [heaps[2].x + 4, heaps[2].y - 11], [heaps[2].x + 12, heaps[2].y - 2]]);
  track([[roadTop.x + 6, roadTop.y + 8], [roadTop.x + 20, roadTop.y + 14], [roadTop.x + 34, roadTop.y + 30]]);

  // light it
  const at = (x: number, y: number, fallback: number) => (x >= 0 && y >= 0 && x < W && y < H && hgt[y * W + x] > 0 ? hgt[y * W + x] : fallback);
  const lxy = Math.hypot(LIGHT[0], LIGHT[1]), stepX = LIGHT[0] / lxy, stepY = LIGHT[1] / lxy, rise = LIGHT[2] / lxy;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const k = py * W + px, h = hgt[k];
      if (h <= 0) continue;
      const gx = (at(px + 1, py, h - 2.5) - at(px - 1, py, h - 2.5)) / 2, gy = (at(px, py + 1, h - 2.5) - at(px, py - 1, h - 2.5)) / 2;
      const l = (-gx * LIGHT[0] - gy * LIGHT[1] + LIGHT[2]) / Math.hypot(gx, gy, 1);
      // is anything between here and the sun?
      let shadow = 0;
      for (let s = 1.5; s < 26; s += 1.25) {
        const hx = Math.round(px + stepX * s), hy = Math.round(py + stepY * s);
        if (hx < 0 || hy < 0 || hx >= W || hy >= H) break;
        const over = hgt[hy * W + hx] - (h + rise * s);
        if (over > 0.4) { shadow = clamp(over * 0.6 + 0.4); break; }
      }
      let t = Math.pow(clamp(l * 1.12 - 0.04), 0.9) * tone[k];
      t = 0.07 + t * (1 - shadow * 0.55) * 0.93;
      buf.putRgb(px, py, pick(RAMPS[mat[k]], t, px, py, 0.4));
    }
  }

  // the works: lamps on masts round the lip, a digger on a bench, trucks, a hut and a fuel tank
  const P = (x: number, y: number) => [Math.round(CX + PIT.x + x), Math.round(CY + PIT.y + y)] as const;
  const lamp = (x: number, y: number) => {
    const [lx, ly] = P(x, y);
    buf.putRgb(lx, ly + 1, 0x241a26);
    buf.putRgb(lx - 1, ly, 0xb5683f);
    buf.putRgb(lx + 1, ly, 0xb5683f);
    buf.putRgb(lx, ly - 1, 0xeab668);
    buf.putRgb(lx, ly, 0xfff3c4);
  };
  lamp(-12, -19); lamp(10, -20); lamp(27, -3); lamp(-14, 18); lamp(13, 19);
  // digger: amber body, dark boom reaching to the face
  { const [x, y] = P(-9, -3); buf.rect(x, y, 3, 2, '#eab668'); buf.rect(x, y + 2, 3, 1, '#241a26'); buf.put(x + 2, y, '#fff3c4'); buf.line(x + 3, y, x + 5, y - 2, '#3a3140'); buf.put(x + 5, y - 1, '#3a3140'); }
  // trucks: one on the haul road, one out by the heaps
  for (const [tx, ty] of [[14, 8], [33, 6]] as const) {
    const [x, y] = P(tx, ty);
    buf.rect(x, y, 3, 2, '#cf8048'); buf.put(x + 2, y, '#f8dc98'); buf.rect(x, y + 2, 3, 1, '#1c1724');
  }
  // hut and tank on the lip, upper right
  { const [x, y] = P(14, -31); buf.rect(x, y, 7, 4, '#7a6b5c'); buf.rect(x, y, 7, 1, '#e3d5b8'); buf.rect(x + 6, y, 1, 4, '#c2ad90'); buf.rect(x, y + 4, 7, 1, '#1c1724'); buf.put(x + 2, y + 2, '#ffd27a'); buf.put(x + 4, y + 2, '#ffd27a');
    buf.rect(x + 9, y + 1, 3, 3, '#8a8fa3'); buf.rect(x + 9, y + 1, 3, 1, '#c3c6d4'); buf.rect(x + 9, y + 4, 3, 1, '#1c1724'); }

  return { canvas: buf.toCanvas(), cx: CX, cy: CY };
}
