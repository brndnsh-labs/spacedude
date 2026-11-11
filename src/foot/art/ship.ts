/**
 * The freighter's deck. For now it is baked from the first-pass 16-pixel art in legacy.ts;
 * the contract it has to meet is AreaArt in types.ts.
 */
import { AREAS, COLS, CRATE_SLOTS, ROWS, TILE, isFloor, tileAt } from '../world';
import { OBJECTS, SHIP_THEME, drawCrate, drawCrateSlot, drawFloor, drawWall, type FloorKind } from './legacy';
import type { AreaArt, LiveFrame } from './types';

const FLOORS: Record<string, FloorKind> = { '.': 'wood', ',': 'metal', ':': 'bridge', ';': 'grate' };

/** The floor an object or crate slot sits on: whatever floor is next to it. */
function floorUnder(tx: number, ty: number): FloorKind {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const kind = FLOORS[tileAt('ship', tx + dx, ty + dy)];
    if (kind) return kind;
  }
  return 'metal';
}

function bake(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = COLS * TILE;
  cv.height = ROWS * TILE;
  const g = cv.getContext('2d')!;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = tileAt('ship', tx, ty), ox = tx * TILE, oy = ty * TILE;
      if (ch === ' ') continue;
      if (ch === '#' || ch === 'w') {
        const below = tileAt('ship', tx, ty + 1);
        drawWall(g, ox, oy, below !== '#' && below !== 'w' && below !== ' ' && below !== 'A', SHIP_THEME, ch === 'w');
        continue;
      }
      drawFloor(g, floorUnder(tx, ty), ox, oy, tx, ty, SHIP_THEME);
      if (ch === 'c') drawCrateSlot(g, ox, oy);
      else if (!isFloor(ch)) OBJECTS[ch]?.(g, ox, oy);
    }
  }
  return cv;
}

/** Crates in the bay, engine cores that brighten under thrust, the airlock lamp and the computer's cursor. */
function live(g: CanvasRenderingContext2D, f: LiveFrame): void {
  CRATE_SLOTS.slice(0, f.crates).forEach((s, i) => drawCrate(g, s.x * TILE, s.y * TILE, i));
  AREAS.ship.rows.forEach((row, ty) => [...row].forEach((ch, tx) => {
    const ox = tx * TILE, oy = ty * TILE;
    if (ch === 'e' && f.thrusting) {
      g.fillStyle = Math.floor(f.time * 12 + tx + ty) % 2 ? '#fff3c4' : '#ffd27a';
      g.fillRect(ox + 6, oy + 6, 4, 4);
    } else if (ch === 'A') {
      g.fillStyle = f.docked ? '#8fc47a' : '#e07a5f'; // green when there is a station outside
      g.fillRect(ox + 7, oy + 13, 2, 2);
    } else if (ch === 'T' && Math.floor(f.time * 1.5) % 2) {
      g.fillStyle = '#ffb000';
      g.fillRect(ox + 9, oy + 7, 2, 1);
    }
  }));
}

export function shipArt(): AreaArt {
  return { tile: TILE, back: bake(), live };
}
