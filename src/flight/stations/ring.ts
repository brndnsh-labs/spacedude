import { PAL, SIGNAL } from '../../art/palette';
import { LIGHT, bay, shade } from '../pixels';
import { Art, NATIVE, type StationLight, type StationSprite } from './kit';
import { SUN, VOID, ball, container, hTruss, hTube, hash2, plate, solar, sprite, stamp, vTruss, vTube } from './ring-farm-parts';

/* ---------- Kestrel Station: the big, polished ring ---------- */

const ST = PAL.steel;
/** Pressure tubes: spokes and the docking arm. */
const TUBE = [ST[2], ST[3], ST[5], ST[6], ST[7]];
const GIRDER = [ST[2], ST[4], ST[6]];
const BLUE = ['#16203f', '#1f335c', '#27477d', '#2f5c8c', '#4a80a8', '#7fb4c8', '#c4e6ea'];
const WARM = '#fff3c4';
const CRATES = {
  rust: [PAL.rust[2], PAL.rust[4], PAL.rust[5], PAL.rust[6]],
  bone: [PAL.bone[2], PAL.bone[3], PAL.bone[4], PAL.bone[5]],
  teal: [PAL.teal[0], PAL.teal[2], PAL.teal[3], PAL.teal[4]],
  amber: [PAL.amber[0], PAL.amber[2], PAL.amber[3], PAL.amber[4]],
  steel: [ST[2], ST[4], ST[5], ST[6]],
} as const;

/** The habitat ring: inner and outer radius, and how many hull sections go round it. */
const RI = 38, RO = 55, SECTIONS = 24, ARC = 360 / SECTIONS;

type Kind = 'hab' | 'glass' | 'service' | 'dock';
/** What each hull section is, by the angle of its middle (0 = right, 90 = down). */
function kindOf(section: number): Kind {
  const at = section * ARC;
  if (at === 180) return 'dock';
  if (at >= 210 && at <= 240) return 'glass'; // the promenade garden
  if (at >= 45 && at <= 60) return 'service'; // radiators, over the freight rack
  return 'hab';
}

const polar = (r: number, deg: number) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)] as const;

/** The ring itself, on its own layer so it can throw a shadow on the spokes and masts it passes over. */
function paintRing(a: Art, lights: StationLight[]): void {
  for (let y = -RO - 1; y <= RO + 1; y++) {
    for (let x = -RO - 1; x <= RO + 1; x++) {
      const d = Math.hypot(x, y);
      if (d < RI - 0.45 || d > RO + 0.45) continue;
      const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      const section = Math.floor(((deg + ARC / 2) % 360) / ARC), off = ((deg + ARC / 2) % ARC) - ARC / 2;
      const kind = kindOf(section);
      const g = (x * SUN[0] + y * SUN[1]) / d; // +1 on the sunward side of the ring
      const px = a.half + x, py = a.half + y;

      // a rounded hull: the outer shoulder faces outward, the inner one faces the hub
      const tilt = ((d - RI) / (RO - RI) - 0.5) * 1.9;
      let t = 0.24 + (Math.sin(tilt) * g * 0.86 + Math.cos(tilt) * LIGHT[2]) * 0.92;
      let c: string | null = null;

      const seam = Math.abs(off) > ARC / 2 - 0.62;
      const deck = d > 40.3 && d < 52.7; // the flat of the hull, between the shoulders
      if (seam) t -= 0.3;
      else if (off < -ARC / 2 + 1.7) t += 0.07; // the lip beside each seam catches the light
      else if (deck) t += (hash2(section, d > 48.5 ? 1 : 0, 23) - 0.5) * 0.1 + (d > 48.5 ? 0.06 : -0.02); // no two plates quite the same

      if (kind === 'glass' && d > 43.2 && d < 50.8) {
        // the promenade: hedges either side of a paved walk, under a long glazed roof
        const pane = ((deg + 3.75) % 7.5) - 3.75, mullion = Math.abs(pane) < 0.62;
        const step = Math.floor(deg / 1.25);
        if (seam || mullion || d < 43.9 || d > 50.1) c = g > -0.2 ? ST[4] : ST[3];
        else if (d > 45.5 && d < 48.5) c = (step + Math.round(d)) % 3 ? PAL.bone[4] : PAL.bone[3];
        else {
          const k = hash2(step, d < 47 ? 0 : 1, 31);
          c = k < 0.25 ? PAL.leaf[5] : k < 0.65 ? PAL.leaf[4] : PAL.leaf[3];
          if (d < 44.6 || d > 49.4) c = k < 0.5 ? PAL.leaf[2] : PAL.leaf[3];
        }
        // sky on the glass: a streak across each pane
        if (!seam && !mullion && d > 44 && d < 50 && Math.abs(pane * 0.85 - (d - 47) * 0.9 - 0.8) < 0.5) c = d < 47.6 ? PAL.teal[6] : PAL.teal[5];
      } else if (kind === 'service' && d > 43.2 && d < 50.8) {
        // radiator louvres, running with the hull
        t -= 0.1;
        if (!seam) t += Math.round(d) % 2 ? 0.06 : -0.2;
        if (Math.abs(off) < 0.7) t -= 0.12;
      } else if (kind === 'dock') {
        if (d > 49 && d < 52.3 && !seam) c = Math.floor((deg + d * 1.2) / 2.4) % 2 ? PAL.amber[4] : PAL.night[4]; // hazard band
      } else if (kind === 'hab') {
        if (Math.abs(d - 43.5) < 0.5 || Math.abs(d - 48.5) < 0.5) t -= 0.17; // trim either side of the window channel
        else if (d > 43.5 && d < 48.5) t = 0.3 + g * 0.07; // the channel the windows sit in
        else if (Math.abs(d - 51.6) < 0.55 && !seam) {
          // station livery, with a replacement plate or two where the paint is missing
          const patched = (section === 8 || section === 21 || section === 1) && off > -4 && off < 3;
          c = patched ? shade(PAL.bone, 0.62 + g * 0.2, px, py, 0.2) : g > 0.35 ? PAL.rust[6] : g > -0.4 ? PAL.rust[5] : PAL.rust[3];
        } else if (d > 49 && d < 51 && Math.abs(off) < 0.6) t -= 0.12; // a joint across each outer plate
        // grime trailing from some seams
        if (!c && hash2(section, 3, 11) < 0.45 && off > ARC / 2 - 3.4 && d > 49 && bay(px, py) < 0.4) t -= 0.14;
      }
      if (d > RO - 0.6 && g > 0.25) t = Math.max(t, 0.96); // a bright rim where the sun catches the edge
      // only the very edges go to white; the decks stop a shade short, so they stay flat rather than speckled
      a.put(x, y, c ?? shade(ST, Math.min(t, d > RO - 1.6 || d < RI + 1.2 ? 1 : 0.9), px, py, 0.3));
    }
  }

  // windows all the way round: three to a section on the main deck, most of them lit
  for (let s = 0; s < SECTIONS; s++) {
    if (kindOf(s) !== 'hab') continue;
    for (let k = -1; k <= 1; k++) {
      const [fx, fy] = polar(46, s * ARC + k * 4.7);
      const x = Math.round(fx - 0.5), y = Math.round(fy - 0.5), h = hash2(s, k, 5);
      if (h < 0.2) {
        a.rect(x, y, 2, 2, PAL.teal[0]);
        a.put(x + 1, y, PAL.teal[2]);
        continue;
      }
      const cool = h > 0.86;
      a.rect(x, y, 2, 2, cool ? PAL.teal[4] : PAL.amber[3]);
      a.put(x + 1, y, cool ? PAL.teal[6] : PAL.amber[5]);
      a.put(x, y + 1, cool ? PAL.teal[3] : PAL.amber[2]);
      // most stay on; a few are somebody coming and going
      const fickle = h > 0.5 && h < 0.62;
      lights.push({ x: x + 1, y, colour: cool ? SIGNAL.teal : WARM, period: fickle ? 9 + s : 1, phase: s * 1.7 + k, duty: fickle ? 0.7 : 1 });
    }
    // portholes on the inner deck
    for (const k of [-1, 1]) {
      const [fx, fy] = polar(41.7, s * ARC + k * 3.4);
      const x = Math.round(fx), y = Math.round(fy), lit = hash2(s, k, 17) < 0.6;
      a.put(x, y, lit ? PAL.amber[4] : PAL.teal[1]);
      if (lit && hash2(s, k, 19) < 0.5) lights.push({ x, y, colour: SIGNAL.amber, period: 1, phase: 0, duty: 1 });
    }
  }
  // lamps along the promenade
  for (const at of [206, 221, 229, 244]) {
    const [fx, fy] = polar(47, at);
    lights.push({ x: Math.round(fx), y: Math.round(fy), colour: WARM, period: 1, phase: 0, duty: 1 });
  }
}

/** The hub: a flanged drum with a glass dome over the arrivals hall. */
function paintHub(a: Art, lights: StationLight[]): void {
  const R = 16;
  a.disc(0, 0, R, (dx, dy, d, x, y) => {
    const g = d ? (dx * SUN[0] + dy * SUN[1]) / d : 0;
    const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    if (d > R - 1.8) return shade(ST, 0.5 + g * 0.42, x, y, 0.3); // the drum's wall
    if (d > R - 4.4) return Math.abs(((deg + 15) % 30) - 15) < 3.6 && d < R - 2.3 ? ST[4] : g > 0.6 ? ST[7] : ST[6]; // flange and its hatches
    if (d > R - 5.4) return ST[3];
    if (d > 8.6) return shade(ST, 0.62 + g * 0.3, x, y, 0.3); // the collar round the dome
    if (d > 7.6) return g > 0 ? ST[8] : ST[5];
    const nz = Math.sqrt(Math.max(0, 1 - (d / 8) ** 2));
    const l = (dx / 8) * LIGHT[0] + (dy / 8) * LIGHT[1] + nz * LIGHT[2];
    if (dx === 0 || dy === 0) return l > 0.55 ? PAL.teal[5] : PAL.teal[1]; // glazing bars
    return shade(PAL.teal, 0.1 + l * 0.82, x, y, 0.6);
  });
  a.rect(2, -5, 2, 1, '#ffffff');
  a.put(4, -4, '#ffffff');
  a.put(-3, 3, PAL.amber[4]); // lamps in the hall below
  a.put(2, 4, PAL.amber[3]);
  for (let k = 0; k < 8; k++) {
    const [fx, fy] = polar(R - 3.2, k * 45 + 22.5);
    lights.push({ x: Math.round(fx), y: Math.round(fy), colour: k % 2 ? WARM : SIGNAL.amber, period: 1, phase: 0, duty: 1 });
  }
  lights.push({ x: 0, y: 0, colour: SIGNAL.white, period: 3, phase: 0.5, duty: 0.08, halo: true });
}

/** A solar wing: a lattice mast with two pairs of panels. `s` is -1 for the upper wing, 1 for the lower. */
function wing(a: Art, lights: StationLight[], s: number): void {
  vTruss(a, -3, s < 0 ? -98 : 54, 7, 45, GIRDER, s < 0 ? 0 : 2);
  for (const row of [0, 1]) {
    const y = s < 0 ? -95 + row * 14 : 71 + row * 14;
    for (const side of [-1, 1]) {
      solar(a, side < 0 ? -42 : 6, y, 37, 11, BLUE, [ST[3], ST[6]], 5, 4, s < 0 ? 0 : 5);
      a.rect(side < 0 ? -5 : 4, y + 4, 2, 3, ST[5]); // the yoke each panel turns on
      a.rect(side < 0 ? -5 : 4, y + 6, 2, 1, ST[3]);
    }
    plate(a, -4, y + 3, 9, 5, ST, 6);
    a.rect(-1, y + 4, 3, 3, ST[3]);
    a.put(0, y + 5, PAL.amber[3]);
  }
  const tip = s < 0 ? -90 : 90;
  a.put(-43, tip, PAL.rust[3]);
  a.put(43, tip, PAL.leaf[2]);
  lights.push(
    { x: -43, y: tip, colour: SIGNAL.red, period: 2.4, phase: s < 0 ? 0 : 0.3, duty: 0.5, halo: true },
    { x: 43, y: tip, colour: SIGNAL.green, period: 2.4, phase: s < 0 ? 1.2 : 1.5, duty: 0.5, halo: true },
    { x: 0, y: s < 0 ? -99 : 99, colour: SIGNAL.white, period: 1.9, phase: s < 0 ? 0 : 0.95, duty: 0.07, halo: true },
  );
}

/** A shuttle seen from above, nose up. */
const SHUTTLE = [
  '....oo....',
  '...oHHo...',
  '..ohTWHo..',
  '..ohtTHo..',
  '..ohttHo..',
  '.oohhhHoo.',
  'ohhhhhhHHo',
  'orrhhhhrro',
  'osshhhhhho',
  'ossshhhsso',
  '.oosmmsoo.',
  '..omeemo..',
];
const SHUTTLE_KEY = {
  o: PAL.night[1], H: PAL.bone[6], h: PAL.bone[5], s: PAL.bone[3], r: PAL.rust[5],
  t: PAL.teal[2], T: PAL.teal[4], W: PAL.teal[6], m: ST[4], e: PAL.amber[4],
};

export function ring(): StationSprite {
  const a = new Art(NATIVE.half);
  const lights: StationLight[] = [];

  // ---- behind and below the ring ----
  wing(a, lights, -1);
  wing(a, lights, 1);

  // the berth cradle: a gantry either side of where a ship parks, with lights running in toward the ring
  for (const s of [-1, 1]) {
    const y = s < 0 ? -34 : 28, inner = s < 0 ? y + 6 : y;
    hTruss(a, -113, y, 70, 7, GIRDER, s < 0 ? 0 : 4);
    plate(a, -117, y - 1, 5, 9, ST, 6);
    a.rect(-116, y + 2, 2, 3, ST[3]);
    for (let i = 0; i < 7; i++) {
      const x = -108 + i * 9;
      a.put(x, inner, PAL.amber[1]);
      lights.push({ x, y: inner, colour: SIGNAL.amber, period: 2.1, phase: -i * 0.3, duty: 0.16 });
    }
    lights.push({ x: -118, y: y + 3, colour: SIGNAL.teal, period: 1.6, phase: s > 0 ? 0.8 : 0, duty: 0.35, halo: true });
  }
  // fuel: two tanks against the hull, and a line out along the lower gantry to a hose reel
  a.rect(-88, 35, 44, 1, PAL.teal[2]);
  for (let x = -84; x < -46; x += 8) a.put(x, 35, PAL.teal[4]);
  a.disc(-90, 37, 3, (dx, dy, d) => (d > 2.2 ? (dx - dy > 0 ? PAL.teal[4] : PAL.teal[2]) : d > 1 ? PAL.teal[1] : ST[6]));
  ball(a, -48, 41, 5, [PAL.teal[0], PAL.teal[1], PAL.teal[2], PAL.teal[3], PAL.teal[4], PAL.teal[6]]);
  ball(a, -38, 50, 5, [PAL.amber[0], PAL.amber[1], PAL.amber[2], PAL.amber[3], PAL.amber[4], PAL.amber[6]]);
  a.rect(-51, 41, 7, 1, ST[3]);
  a.rect(-41, 50, 7, 1, ST[3]);
  // a crane trolley on the upper gantry, and freight waiting beside it
  plate(a, -98, -39, 9, 5, PAL.amber, 4);
  a.rect(-96, -38, 5, 2, PAL.night[3]);
  a.put(-94, -38, PAL.amber[3]);
  container(a, -64, -40, 10, 6, CRATES.rust);
  container(a, -53, -40, 8, 6, CRATES.bone);
  container(a, -61, -45, 9, 5, CRATES.teal);

  // the freight rack, clamped under the ring's lower right: nine bays, two of them empty
  plate(a, 30, 40, 39, 27, ST, 5);
  const LOADS = [CRATES.rust, CRATES.bone, CRATES.teal, CRATES.amber, null, CRATES.rust, CRATES.teal, CRATES.steel, null];
  LOADS.forEach((load, i) => {
    const x = 32 + (i % 3) * 12, y = 42 + Math.floor(i / 3) * 8;
    a.rect(x, y, 11, 7, VOID);
    if (load) container(a, x + 1, y, 10, 6, load); // sat up and right in its bay, so the bay's dark reads as its shadow
    else {
      a.line(x, y + 6, x + 5, y + 1, ST[2]); // an empty bay's cross-brace
      a.line(x + 10, y + 6, x + 5, y + 1, ST[2]);
    }
  });
  lights.push(
    { x: 69, y: 67, colour: SIGNAL.amber, period: 2.8, phase: 0.4, duty: 0.5, halo: true },
    { x: 69, y: 40, colour: SIGNAL.amber, period: 2.8, phase: 1.8, duty: 0.5 },
  );

  // the comms boom: a big dish, a docked shuttle, whip aerials
  hTruss(a, 52, -2, 20, 5, GIRDER);
  a.disc(81, 0, 11, (dx, dy, d, x, y) => {
    if (d > 10.2) return (dx * SUN[0] + dy * SUN[1]) / d > 0 ? ST[8] : ST[5];
    const l = -(dx * LIGHT[0] + dy * LIGHT[1]) / 11; // a bowl: lit on the side away from the sun
    if (Math.abs(d - 6) < 0.5) return shade(ST, 0.4 + l * 0.4, x, y, 0.3);
    return shade(ST, 0.56 + l * 0.45, x, y, 0.4);
  });
  a.line(81, 0, 74, -7, ST[3]);
  a.line(81, 0, 88, -6, ST[3]);
  a.line(81, 0, 81, 10, ST[3]);
  plate(a, 80, -1, 3, 3, ST, 7);
  a.put(81, 0, PAL.amber[4]);
  lights.push({ x: 81, y: 0, colour: SIGNAL.amber, period: 1.3, phase: 0, duty: 0.5 });
  a.rect(61, -4, 3, 2, ST[4]); // docking stub on the boom
  sprite(a, 57, -16, SHUTTLE, SHUTTLE_KEY, 2);
  lights.push({ x: 62, y: -18, colour: SIGNAL.green, period: 2.2, phase: 0.2, duty: 0.25 });
  for (const [x0, y0, x1, y1] of [[38, -38, 50, -50], [29, -46, 34, -56], [46, -29, 58, -35]]) {
    a.line(x0, y0, x1, y1, ST[4]);
    lights.push({ x: x1, y: y1, colour: SIGNAL.red, period: 3.1, phase: x1 * 0.37, duty: 0.3, halo: true });
  }

  // the docking arm, with our own collar: a wide flange and an approach light at either end of it
  hTube(a, -61, -5, 9, 11, TUBE, 3, 1);
  plate(a, NATIVE.tip, -7, 3, 15, ST, 7);
  a.rect(NATIVE.tip + 1, -2, 1, 5, ST[4]);
  for (const s of [-1, 1]) {
    a.rect(NATIVE.tip, s < 0 ? -9 : 8, 3, 2, ST[3]);
    a.put(NATIVE.tip + 1, s * 9, PAL.amber[1]);
    lights.push({ x: NATIVE.tip + 1, y: s * 9, colour: SIGNAL.amber, period: 1, phase: s > 0 ? 0.5 : 0, duty: 0.5, halo: true });
  }

  // ---- inside the ring ----
  // stay cables, and a transit tube joining the spokes half way out
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (let i = 11; i <= 29; i++) a.put(sx * i, sy * i, sy < 0 === sx > 0 ? ST[4] : ST[3]);
  }
  for (let y = -30; y <= 30; y++) {
    for (let x = -30; x <= 30; x++) {
      const d = Math.hypot(x, y);
      if (Math.abs(d - 26.5) > 1.05) continue;
      const g = (x * SUN[0] + y * SUN[1]) / d;
      a.put(x, y, d > 26.5 ? (g > 0.2 ? ST[7] : g > -0.5 ? ST[5] : ST[3]) : g < -0.2 ? ST[6] : g < 0.5 ? ST[4] : ST[3]);
    }
  }
  hTube(a, -39, -3, 78, 7, TUBE, 8, 2);
  vTube(a, -3, -39, 7, 78, TUBE, 8, 2);
  for (const i of [19, 34]) {
    for (const s of [-1, 1]) {
      a.put(s * i, 0, PAL.amber[3]);
      a.put(0, s * i, PAL.amber[3]);
    }
  }
  // where the transit tube meets each spoke
  for (const [x, y] of [[26, 0], [-26, 0], [0, 26], [0, -26]]) {
    plate(a, x - 4, y - 4, 9, 9, ST, 6);
    a.rect(x - 1, y - 1, 3, 3, ST[3]);
    a.put(x, y, PAL.teal[4]);
  }

  // a landing pad off the transit tube, with a shuttle in
  const pad = new Art(a.half);
  plate(pad, 11, 11, 15, 15, ST, 4);
  pad.rect(13, 13, 11, 11, ST[2]);
  for (const [x, y] of [[13, 13], [23, 13], [13, 23], [23, 23]]) pad.put(x, y, PAL.amber[4]);
  sprite(pad, 14, 12, SHUTTLE, { ...SHUTTLE_KEY, r: PAL.teal[3] }, 0);
  stamp(a, pad, 2);
  lights.push(
    { x: 13, y: 13, colour: SIGNAL.green, period: 1.8, phase: 0, duty: 0.4 },
    { x: 23, y: 23, colour: SIGNAL.green, period: 1.8, phase: 0.9, duty: 0.4 },
  );

  // ---- the ring, over all of that ----
  const hull = new Art(a.half);
  paintRing(hull, lights);
  stamp(a, hull, 2);

  // clamps where the masts, the boom and the arm come through the hull
  const clamps = new Art(a.half);
  for (const [x, y, w, h] of [[-5, -59, 11, 7], [-5, 53, 11, 7], [51, -5, 7, 11], [-58, -6, 6, 13]]) {
    plate(clamps, x, y, w, h, ST, 7);
    clamps.rect(x + 2, y + 2, w - 4, h - 4, ST[4]); // the recess its bolts sit in
    clamps.rect(x + 2, y + 2, w - 4, 1, ST[3]);
    clamps.rect(x + 2, y + 2, 1, h - 4, ST[3]);
    clamps.put(x + 2, y + h - 3, PAL.amber[3]);
    clamps.put(x + w - 3, y + 2, PAL.amber[3]);
  }
  stamp(a, clamps, 1);
  for (const s of [-1, 1]) lights.push({ x: -55, y: s * 4, colour: SIGNAL.green, period: 2, phase: 0, duty: 0.6 });

  const hub = new Art(a.half);
  paintHub(hub, lights);
  stamp(a, hub, 2);

  return { canvas: a.finish(), scale: 1, half: a.half, extent: 99, lights, sparks: { x: -27, y: 45 } };
}
