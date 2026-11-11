/**
 * A station's concourse. For now it is baked from the first-pass 16-pixel art in legacy.ts, in the colours of
 * the port's type and look; the contract it has to meet is AreaArt in types.ts.
 */
import type { Port } from '../../sim/types';
import { COLS, ROWS, TILE, isFloor, tileAt } from '../world';
import { OBJECTS, drawFloor, drawWall, stationTheme } from './legacy';
import type { AreaArt } from './types';

/** The room for a port. What may differ between ports: its type, its look (a colour seed) and whether it has a yard. */
export function stationArt(port: Pick<Port, 'type' | 'look' | 'yard'>): AreaArt {
  const th = stationTheme(port.type, port.look);
  const cv = document.createElement('canvas');
  cv.width = COLS * TILE;
  cv.height = ROWS * TILE;
  const g = cv.getContext('2d')!;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = tileAt('station', tx, ty), ox = tx * TILE, oy = ty * TILE;
      if (ch === ' ') continue;
      if (ch === '#' || ch === 'w') {
        const below = tileAt('station', tx, ty + 1);
        drawWall(g, ox, oy, below !== '#' && below !== 'w' && below !== ' ' && below !== 'A', th, ch === 'w');
        continue;
      }
      drawFloor(g, ch === 'n' ? 'back' : 'tile', ox, oy, tx, ty, th);
      // a port without a shipyard has its yard counter shuttered
      if (!isFloor(ch) && ch !== 'n') OBJECTS[ch === 'y' && !port.yard ? 'Y' : ch]?.(g, ox, oy);
    }
  }
  return { tile: TILE, back: cv };
}
