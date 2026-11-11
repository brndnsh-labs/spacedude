import { PixelBuf } from './pixels';
import { paintGiant, paintMoon } from './worldsGiant';
import { MARROW_R, paintMarrow } from './worldsMarrow';
import { OSSA_R, paintOssa } from './worldsOssa';
import { paintRock } from './worldsRock';

/**
 * The worlds that hang behind each port. Each is painted once, the first time it comes into view, at the
 * frame's own size. One world per file (worldsOssa.ts and so on); what they share is in worldsKit.ts.
 */

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

export { ROCK_PIT } from './worldsRock';

/** Room round a globe for the haze at its limb. */
const PAD = 7;

function globe(r: number, paint: (buf: PixelBuf, cx: number, cy: number) => void): WorldSprite {
  const S = (r + PAD) * 2, buf = new PixelBuf(S, S);
  paint(buf, S / 2, S / 2);
  return { canvas: buf.toCanvas(), scale: 1, cx: S / 2, cy: S / 2 };
}

/** The dry, banded desert world behind the ring stations. */
export const makeOssa = (): WorldSprite => globe(OSSA_R, paintOssa);

/** The farm moon. */
export const makeMarrow = (): WorldSprite => globe(MARROW_R, paintMarrow);

/** The asteroid the mining rigs work. */
export function makeRock(): WorldSprite {
  return { ...paintRock(), scale: 1 };
}

/** The ringed gas giant behind the relays, with its moon. */
export function makeGiant(): WorldSprite {
  const W = 412, H = 204, cx = W / 2, cy = H / 2;
  const buf = new PixelBuf(W, H);
  paintGiant(buf, cx, cy);
  paintMoon(buf, 66, 34, 8);
  return { canvas: buf.toCanvas(), scale: 1, cx, cy };
}
