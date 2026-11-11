import { PixelBuf } from './pixels';

/**
 * The player's freighter: a boxy hauler with a cargo-bay hatch, a glazed nose,
 * and two engine nacelles on outriggers. Drawn nose-right, then pre-rotated.
 */

const C = {
  h1: '#f6efd9', h2: '#e3d5b8', h3: '#c2ad90', h4: '#94806f', // bone hull, light to shadow
  r: '#c8553d', R: '#8f3b33', q: '#e07a5f', // rust hatch
  t: '#3f8f8a', T: '#8fd6cb', w: '#e6fbf5', // canopy glass
  G: '#eef0f5', g: '#b5b9c9', m: '#8a8fa3', M: '#5f647c', k: '#3a3d55', // engine metal
  n: '#2a2338', a: '#eab668', o: '#15121f',
};

const W = 36, H = 25, CY = 12;
/** Point of the base sprite that sits on the ship's position (a pixel edge in x, a pixel centre in y). */
const PIVOT_X = 18, PIVOT_Y = 12.5;

/**
 * Screen pixels per pixel of this art: 1.5 because it was drawn for the old 320x180 frame and the renderer
 * stretches it. Native art says 1. Everything exported below is in the art's own pixels.
 */
export const SHIP_SCALE = 1.5;

/** The engine flame, in screen pixels: colours from the nozzle outward, and how long and wide each plume is. */
export const EXHAUST = {
  plume: ['#fff3c4', '#ffd27a', '#eab668', '#cf8048', '#8a4238'],
  embers: ['#cf8048', '#8a4238', '#57293a'],
  main: { length: 18, halfWidth: 2.8 },
  nacelle: { length: 6, halfWidth: 0.9 },
} as const;

export const SHIP_FRAMES = 64;
/** Rotated frames are square; the ship's position maps to this point within them. */
export const FRAME_SIZE = 46, FRAME_PIVOT_X = 23, FRAME_PIVOT_Y = 22;

/** Offsets from the ship's position with the nose pointing right. */
export const SHIP_POINTS = {
  mainNozzle: { x: -16.5, y: 0 },
  nacelleNozzles: [{ x: -12.5, y: -10 }, { x: -12.5, y: 10 }],
  portLight: { x: 2.5, y: -10 },
  starboardLight: { x: 2.5, y: 10 },
} as const;

function drawShip(): PixelBuf {
  const b = new PixelBuf(W, H);
  // Everything is mirrored about the centre line, so the lighting survives rotation.
  const sym = (x: number, dy: number, c: string) => { b.put(x, CY - dy, c); b.put(x, CY + dy, c); };

  // hull and tapering nose
  const NOSE = [5, 5, 4, 4, 3, 2, 2, 1]; // half-height for x = 26..33
  const half = (x: number) => (x < 26 ? 5 : NOSE[x - 26]);
  for (let x = 9; x <= 33; x++) {
    const h = half(x);
    for (let dy = 0; dy <= h; dy++) sym(x, dy, dy === h ? C.h4 : dy === h - 1 ? C.h3 : C.h2);
  }
  for (const x of [10, 23]) for (let dy = 0; dy <= 3; dy++) sym(x, dy, C.h3); // plate seams
  for (let x = 24; x <= 26; x++) sym(x, 0, C.h1); // spine highlight ahead of the hatch
  sym(22, 3, C.h4); sym(11, 3, C.h4); // rivets

  // cargo-bay doors
  for (let x = 12; x <= 21; x++) {
    for (let dy = 0; dy <= 3; dy++) {
      const border = x === 12 || x === 21 || dy === 3;
      sym(x, dy, border || dy === 0 ? C.R : dy === 2 ? C.q : C.r);
    }
  }
  for (const x of [15, 18]) for (let dy = 1; dy <= 2; dy++) sym(x, dy, C.R); // door ribs

  // canopy
  for (let dy = 0; dy <= 3; dy++) sym(27, dy, C.k);
  for (let x = 28; x <= 31; x++) for (let dy = 0; dy <= half(x) - 2; dy++) sym(x, dy, x >= 30 ? C.T : C.t);
  b.put(29, CY - 1, C.T);
  b.put(30, CY - 1, C.w);

  // engine block and main nozzle
  for (let x = 4; x <= 8; x++) for (let dy = 0; dy <= (x === 4 ? 4 : 5); dy++) sym(x, dy, dy <= 1 ? C.g : dy <= 3 ? C.m : C.M);
  for (const x of [5, 7]) for (let dy = 1; dy <= 3; dy++) sym(x, dy, C.M); // cooling vents
  for (let dy = 0; dy <= 5; dy++) sym(8, dy, C.k);
  for (let x = 2; x <= 3; x++) for (let dy = 0; dy <= 2; dy++) sym(x, dy, dy === 2 ? C.k : C.n);
  sym(3, 3, C.k);

  // manoeuvring thruster pods on the hull flanks
  sym(19, 6, C.M); sym(20, 6, C.g); sym(21, 6, C.m);

  // nacelles on outriggers
  for (const x of [11, 12]) for (let dy = 6; dy <= 8; dy++) sym(x, dy, x === 11 ? C.m : C.M);
  for (let dy = 6; dy <= 8; dy++) sym(16, dy, C.M);
  for (let x = 6; x <= 18; x++) {
    sym(x, 11, C.m);
    sym(x, 10, C.g);
    sym(x, 9, C.M);
  }
  for (let dy = 9; dy <= 11; dy++) {
    sym(6, dy, C.k); // nozzle
    sym(7, dy, C.M);
    sym(10, dy, C.M); // clamp band
    sym(15, dy, C.a); // amber stripe
    sym(18, dy, C.k); // intake lip
  }
  for (let x = 11; x <= 13; x++) sym(x, 10, C.G);
  sym(19, 10, C.M);
  return b;
}

/**
 * Rotate by supersampling: each output pixel takes the most common source colour
 * under it, so the palette stays exact and edges stay clean (no canvas smoothing).
 */
function rotate(src: PixelBuf, angle: number): PixelBuf {
  const out = new PixelBuf(FRAME_SIZE, FRAME_SIZE);
  const cos = Math.cos(angle), sin = Math.sin(angle), SS = 4;
  const fx = FRAME_PIVOT_X, fy = FRAME_PIVOT_Y + 0.5;
  const tally = new Map<number, number>();
  for (let y = 0; y < FRAME_SIZE; y++) {
    for (let x = 0; x < FRAME_SIZE; x++) {
      tally.clear();
      let empty = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const rx = x + (i + 0.5) / SS - fx, ry = y + (j + 0.5) / SS - fy;
          const c = src.get(Math.floor(PIVOT_X + rx * cos + ry * sin), Math.floor(PIVOT_Y - rx * sin + ry * cos));
          if (c < 0) empty++;
          else tally.set(c, (tally.get(c) ?? 0) + 1);
        }
      }
      if (empty > (SS * SS) / 2) continue;
      let best = -1, bestN = 0;
      for (const [c, n] of tally) if (n > bestN) { best = c; bestN = n; }
      if (best >= 0) out.putRgb(x, y, best);
    }
  }
  return out;
}

/** One canvas per heading, evenly spaced around the circle, each with a fresh clean outline. */
export function makeShipFrames(): HTMLCanvasElement[] {
  const base = drawShip();
  return Array.from({ length: SHIP_FRAMES }, (_, i) => {
    const frame = rotate(base, (i / SHIP_FRAMES) * Math.PI * 2);
    frame.outline(C.o);
    return frame.toCanvas();
  });
}
