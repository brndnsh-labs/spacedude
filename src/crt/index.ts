/**
 * The CRT filter: an optional picture-tube look for the whole stage (scanlines, a shadow mask, a little glow).
 *
 * This is the placeholder: it does nothing yet. The contract is what main.ts relies on.
 * `stage` is the element that holds the game canvas and the HUD and terminal drawn over it in the DOM;
 * `source` is the 480x270 game canvas, redrawn by the game every frame before `present` is called.
 */
export interface Crt {
  /** Turn the filter on or off. Off must leave the game looking exactly as it does without this module. */
  setEnabled(on: boolean): void;
  /** Called once per frame after the game has drawn `source`. `time` is in seconds. */
  present(time: number): void;
}

export function createCrt(_stage: HTMLElement, _source: HTMLCanvasElement): Crt {
  return {
    setEnabled() {},
    present() {},
  };
}
