/**
 * The contract between on-foot art and the renderer (../render.ts). Art modules paint; the renderer places
 * the result in the frame, draws people over it and scales anything not yet drawn at native size.
 */

/** What changes from frame to frame in a room. */
export interface LiveFrame {
  /** Seconds since the game started, for anything that blinks or turns. */
  time: number;
  /** The engines are burning. */
  thrusting: boolean;
  /** The ship is berthed at a port. */
  docked: boolean;
  /** Filled crate slots in the cargo bay, counted in the order of CRATE_SLOTS. */
  crates: number;
}

/**
 * One room, painted. The canvases cover the whole map: COLS x ROWS tiles of `tile` pixels each, with tile
 * (tx, ty) at pixel (tx * tile, ty * tile). Anything outside the hull or walls is left transparent.
 */
export interface AreaArt {
  /** Pixels per map tile in this art: 24 for native art. Art drawn at 16 is stretched by the renderer. */
  tile: number;
  /** Everything that never changes, under the people. */
  back: HTMLCanvasElement;
  /** Optional: things people walk behind (door lintels, overhead pipes, the near edge of tall furniture). */
  front?: HTMLCanvasElement;
  /**
   * Optional: whatever moves or depends on the game, drawn over `back` and under the people every frame.
   * Draw in this art's own pixels with the map's top-left at (0, 0); the renderer has set the transform.
   */
  live?(g: CanvasRenderingContext2D, f: LiveFrame): void;
}

/**
 * A person's frames for each way they can face. Frame 0 is standing still; the rest are a walk cycle of any
 * length. `idle`, if given, is a loop for someone standing behind a counter facing down (a breath, a blink).
 */
export interface PersonSprites {
  up: HTMLCanvasElement[];
  down: HTMLCanvasElement[];
  left: HTMLCanvasElement[];
  right: HTMLCanvasElement[];
  idle?: HTMLCanvasElement[];
}
