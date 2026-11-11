import { describe, expect, it } from 'vitest';
import {
  AREAS, COLS, CRATE_SLOTS, ROWS, TILE, cratesFor, crossAirlock, isSolid, kindOf, newWalker, reach, stepWalk, tileAt,
  type AreaId, type Kind,
} from './world';

const NO_CARGO = { crates: 0 };
const FULL_HOLD = { crates: CRATE_SLOTS.length };

/** Every interactable kind that can be faced from a tile reachable on foot from the spawn point. */
function reachableKinds(area: AreaId, env: { crates: number }): Set<Kind> {
  const { spawn } = AREAS[area];
  const seen = new Set([`${spawn.x},${spawn.y}`]);
  const queue = [spawn];
  const kinds = new Set<Kind>();
  while (queue.length) {
    const t = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = t.x + dx, y = t.y + dy;
      const kind = kindOf(tileAt(area, x, y));
      if (kind) kinds.add(kind);
      if (!isSolid(area, x, y, env) && !seen.has(`${x},${y}`)) {
        seen.add(`${x},${y}`);
        queue.push({ x, y });
      }
    }
  }
  return kinds;
}

describe('maps', () => {
  it('are full-size rectangles', () => {
    for (const area of Object.values(AREAS)) {
      expect(area.rows).toHaveLength(ROWS);
      for (const row of area.rows) expect(row).toHaveLength(COLS);
    }
  });

  it('let you walk to everything on the ship, even with a full hold', () => {
    const all: Kind[] = ['seat', 'terminal', 'airlock', 'bunk', 'galley', 'engine', 'plant', 'shelf'];
    expect([...reachableKinds('ship', NO_CARGO)].sort()).toEqual([...all].sort());
    expect([...reachableKinds('ship', FULL_HOLD)].sort()).toEqual([...all].sort());
  });

  it('let you walk to every counter in the station', () => {
    expect([...reachableKinds('station', NO_CARGO)].sort()).toEqual(['airlock', 'fuel', 'jobs', 'plant', 'yard']);
  });
});

describe('walking', () => {
  it('cannot leave the ship through the hull', () => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      const w = newWalker();
      for (let i = 0; i < 600; i++) stepWalk(w, { dx, dy }, 1 / 60, NO_CARGO);
      expect(isSolid('ship', Math.floor(w.x / TILE), Math.floor(w.y / TILE), NO_CARGO)).toBe(false);
    }
  });

  it('faces the pilot seat from the spawn point', () => {
    const w = newWalker();
    expect(reach(w)?.kind).toBe('seat');
  });

  it('goes out through the airlock and back', () => {
    const w = newWalker();
    crossAirlock(w);
    expect(w.area).toBe('station');
    w.facing = 'down';
    expect(reach(w)?.kind).toBe('airlock');
    crossAirlock(w);
    expect(w.area).toBe('ship');
    w.facing = 'down';
    expect(reach(w)?.kind).toBe('airlock');
  });
});

describe('cargo crates', () => {
  it('show nothing for an empty hold and everything for a full one', () => {
    expect(cratesFor(0, 12)).toBe(0);
    expect(cratesFor(1, 12)).toBe(1);
    expect(cratesFor(12, 12)).toBe(CRATE_SLOTS.length);
  });
});
