import { LIGHT, PixelBuf, shade } from '../pixels';

/**
 * The shared kit for station art: the sprite contract, a drawing surface centred on the port, and a few
 * building blocks. One station design per port type lives in its own file beside this one.
 *
 * This file is shared by every station: add helpers a single station needs to that station's own file.
 * Each has a docking arm pointing left whose collar ends where a berthed ship's
 * nose sits (the ship itself is centred ARM = 58 px left of the port).
 */

export interface StationLight {
  x: number;
  y: number;
  colour: string;
  /** Seconds per blink cycle. */
  period: number;
  /** Offset into the cycle, in seconds. */
  phase: number;
  /** Fraction of the cycle the light is on. */
  duty: number;
  halo?: boolean;
}

export interface StationSprite {
  canvas: HTMLCanvasElement;
  /**
   * Screen pixels per pixel of this art. Leave it out for art drawn at the old 320x180 size, which the renderer
   * stretches; native art says 1. Every position below is in the art's own pixels.
   */
  scale?: number;
  /** Half the canvas size; the port sits at (half, half). */
  half: number;
  /** Rough radius, for the course brackets. */
  extent: number;
  lights: StationLight[];
  /** A rotating beacon lamp, if the station has one. */
  lamp?: { x: number; y: number };
  /** Where a welder occasionally sparks. */
  sparks?: { x: number; y: number };
  /** A conveyor whose ore the renderer animates. */
  belt?: { x0: number; y0: number; x1: number; y1: number };
}

/** Half the canvas of a station drawn at the old 320x180 size. Native art picks its own (see docs/art-style.md). */
export const HALF = 88;
export const OL = '#15121f';
export const METAL = ['#2f3148', '#555a72', '#8a8fa3', '#c3c6d4', '#eef0f5'];
export const AMBER = '#eab668', RED = '#ff6b5a', GREEN = '#7df0b0', TEAL = '#7fd1c7', WHITE = '#fff6e0';

export type Ramp3 = readonly [string, string, string]; // dark, mid, light
export const STEEL: Ramp3 = [METAL[1], METAL[2], METAL[3]];
export const BONE: Ramp3 = ['#94806f', '#c2ad90', '#e3d5b8'];
export const RUST: Ramp3 = ['#8f3b33', '#c8553d', '#e07a5f'];
export const TEALS: Ramp3 = ['#24504a', '#3f8f8a', '#7fd1c7'];

/** A drawing surface whose origin is the port's position. */
export class Art {
  readonly buf: PixelBuf;
  /** `half` is half the canvas size; the port sits at the centre. */
  constructor(readonly half: number = HALF) {
    this.buf = new PixelBuf(half * 2, half * 2);
  }
  put(x: number, y: number, c: string): void { this.buf.put(this.half + x, this.half + y, c); }
  rect(x: number, y: number, w: number, h: number, c: string): void { this.buf.rect(this.half + x, this.half + y, w, h, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: string): void { this.buf.line(this.half + x0, this.half + y0, this.half + x1, this.half + y1, c); }
  /** A plate lit from the upper right: light top and right edges, dark bottom and left. */
  box(x: number, y: number, w: number, h: number, [d, m, l]: Ramp3): void {
    this.rect(x, y, w, h, m);
    this.rect(x, y + h - 1, w, 1, d);
    this.rect(x, y, 1, h, d);
    this.rect(x, y, w, 1, l);
    this.rect(x + w - 1, y, 1, h - 1, l);
  }
  /** A horizontal tube: light along the top, dark underneath. */
  hbar(x: number, y: number, w: number, h: number, [d, m, l]: Ramp3): void {
    this.rect(x, y, w, h, m);
    this.rect(x, y, w, 1, l);
    this.rect(x, y + h - 1, w, 1, d);
  }
  /** A vertical tube: light down the right, dark down the left. */
  vbar(x: number, y: number, w: number, h: number, [d, m, l]: Ramp3): void {
    this.rect(x, y, w, h, m);
    this.rect(x + w - 1, y, 1, h, l);
    this.rect(x, y, 1, h, d);
  }
  disc(cx: number, cy: number, r: number, fn: (dx: number, dy: number, d: number, x: number, y: number) => string | null): void {
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r + 0.3) continue;
        const c = fn(dx, dy, d, this.half + cx + dx, this.half + cy + dy);
        if (c) this.put(cx + dx, cy + dy, c);
      }
    }
  }
  /** A dither-shaded ball (tank, dome cap). */
  ball(cx: number, cy: number, r: number, ramp: readonly string[]): void {
    this.disc(cx, cy, r, (dx, dy, d, x, y) => {
      const nz = Math.sqrt(Math.max(0, 1 - (d / (r + 0.5)) ** 2));
      const l = (dx / (r + 0.5)) * LIGHT[0] + (dy / (r + 0.5)) * LIGHT[1] + nz * LIGHT[2];
      return shade(ramp, 0.12 + l * 0.9, x, y, 0.5);
    });
  }
  finish(): HTMLCanvasElement {
    this.buf.outline(OL);
    return this.buf.toCanvas();
  }
}

/** A solar array in 5px cells with a diagonal sheen. `cols` = frame, dark, base, light. */
export function panel(a: Art, x: number, y: number, w: number, h: number, cols: readonly [string, string, string, string]): void {
  a.rect(x, y, w, h, cols[0]);
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const u = (i - 1) % 6, v = (j - 1) % 6;
      if (u === 5 || v === 5) continue;
      a.put(x + i, y + j, u - v >= 2 ? cols[3] : u - v >= -2 ? cols[2] : cols[1]);
    }
  }
}

/** Where a berthed ship's nose ends: every docking arm stops here. */
export const TIP = -42;

/**
 * The same two numbers for a station drawn at native size (480x270 frame, scale 1): a 264-pixel canvas, and a
 * docking collar 63 pixels left of the port. The berthed ship sits centred 87 pixels left of the port.
 */
export const NATIVE = { half: 132, tip: -63 } as const;

/** The docking collar at the end of an arm, with a pair of approach lights. */
export function collar(a: Art, lights: StationLight[], ramp: Ramp3, halfHeight: number, period: number, tip: number = TIP): void {
  a.box(tip, -halfHeight, 3, halfHeight * 2 + 1, ramp);
  for (const s of [-1, 1]) {
    lights.push({ x: tip + 1, y: s * (halfHeight + 1), colour: AMBER, period, phase: s > 0 ? period / 2 : 0, duty: 0.5, halo: true });
  }
}
