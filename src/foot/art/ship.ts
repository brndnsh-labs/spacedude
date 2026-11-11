/**
 * The inside of the player's freighter, seen on foot: engine room at the stern, cargo bay, living quarters,
 * and the bridge in the nose. Drawn natively at 24 pixels a tile; the contract is AreaArt in types.ts.
 * The shell (hull, floors, walls) is in shipRooms.ts, the furniture in shipThings.ts, and what moves in shipLive.ts.
 */
import { DECK_H, DECK_W, T, makeCanvas } from './shipKit';
import { makeLive } from './shipLive';
import { paintShell } from './shipRooms';
import { paintThings } from './shipThings';
import type { AreaArt } from './types';

export function shipArt(): AreaArt {
  const [back, b] = makeCanvas(DECK_W, DECK_H), [front, f] = makeCanvas(DECK_W, DECK_H);
  paintShell(b, f);
  paintThings(b, f);
  return { tile: T, back, front, live: makeLive() };
}
