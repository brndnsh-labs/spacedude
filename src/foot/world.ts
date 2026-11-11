/**
 * Walking around: the ship's deck and a station concourse as tile maps,
 * plus movement, collision and "what am I facing?" with no rendering.
 */

export const TILE = 16;
export const COLS = 20, ROWS = 11;

export type AreaId = 'ship' | 'station';
export type Facing = 'up' | 'down' | 'left' | 'right';
export type Kind =
  | 'seat' | 'terminal' | 'airlock' | 'bunk' | 'galley' | 'engine' | 'plant' | 'shelf'
  | 'jobs' | 'fuel' | 'yard';

export interface Pt { x: number; y: number }

interface Area {
  rows: readonly string[];
  /** Tile the walker starts on. */
  spawn: Pt;
  /** Tile just inside the airlock. */
  door: Pt;
}

/*
 * Legend. Floors: `.` living/concourse, `,` cargo deck, `:` bridge, `;` engine room.
 * `#` wall, `w` window, space = outside. Ship: e engine, c crate slot, b/B bunk, k shelf,
 * p plant, g galley, T ship computer, t helm console, s pilot seat, A airlock.
 * Station: n behind-the-counter floor, = counter, j work broker, f dock office, y yard, o table.
 */
export const AREAS: Record<AreaId, Area> = {
  // The freighter, nose to the right: engine room, cargo bay, living quarters, bridge.
  ship: {
    rows: [
      '                    ',
      '  ##########w##w##  ',
      ' ##e;#cc,,#b.k#:Tt# ',
      ' #ee;#cc,,#B..#:::t#',
      ' #e;;,,,,,....:::st#',
      ' #ee;#cc,,#...#:::t#',
      ' ##e;#cc,,#p.g#::t# ',
      '  ######A#########  ',
      '                    ',
      '                    ',
      '                    ',
    ],
    spawn: { x: 16, y: 4 },
    door: { x: 8, y: 6 },
  },
  station: {
    rows: [
      '####################',
      '#nnn##wwww#nnn##nnn#',
      '#=j=#p....p=f=..=y=#',
      '#..................#',
      '#.o..o.............#',
      '#..................#',
      '#.o..o.........p...#',
      '#..................#',
      '########A###########',
      '                    ',
      '                    ',
    ],
    spawn: { x: 8, y: 7 },
    door: { x: 8, y: 7 },
  },
};

const FLOORS = '.,:;';
const KINDS: Record<string, Kind> = {
  s: 'seat', T: 'terminal', A: 'airlock', b: 'bunk', B: 'bunk', g: 'galley', e: 'engine', p: 'plant', k: 'shelf',
  j: 'jobs', f: 'fuel', y: 'yard',
};

export function tileAt(area: AreaId, tx: number, ty: number): string {
  return AREAS[area].rows[ty]?.[tx] ?? ' ';
}

export const isFloor = (ch: string) => FLOORS.includes(ch);
export const kindOf = (ch: string): Kind | undefined => KINDS[ch];

/** Crate slots in the cargo bay, in the order they fill up. */
export const CRATE_SLOTS: readonly Pt[] = (() => {
  const slots: Pt[] = [];
  AREAS.ship.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'c') slots.push({ x, y }); }));
  return slots;
})();

/** How many crate slots a load fills: none when empty, all when the hold is full. */
export function cratesFor(tons: number, capacity: number): number {
  return tons <= 0 ? 0 : Math.max(1, Math.min(CRATE_SLOTS.length, Math.round((tons / capacity) * CRATE_SLOTS.length)));
}

/** Things outside the map that change what is solid. */
export interface Env {
  /** Number of filled crate slots aboard. */
  crates: number;
}

export function isSolid(area: AreaId, tx: number, ty: number, env: Env): boolean {
  const ch = tileAt(area, tx, ty);
  if (isFloor(ch)) return false;
  if (ch === 'c') return CRATE_SLOTS.findIndex(s => s.x === tx && s.y === ty) < env.crates;
  return true;
}

export interface Walker {
  area: AreaId;
  /** Position of the feet, in map pixels. */
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  /** Walk-cycle clock; 0 while standing. */
  phase: number;
}

const tileCentre = (t: Pt): Pt => ({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 + 2 });

export function newWalker(): Walker {
  return { area: 'ship', ...tileCentre(AREAS.ship.spawn), facing: 'right', moving: false, phase: 0 };
}

/** Step through the airlock into the other area. */
export function crossAirlock(w: Walker): void {
  w.area = w.area === 'ship' ? 'station' : 'ship';
  Object.assign(w, tileCentre(AREAS[w.area].door));
  w.facing = 'up';
  w.moving = false;
  w.phase = 0;
}

const SPEED = 58; // px/s
const HALF_W = 4, HALF_H = 3; // the feet's collision box

function blocked(area: AreaId, x: number, y: number, env: Env): boolean {
  for (const cx of [x - HALF_W, x + HALF_W - 0.01]) {
    for (const cy of [y - HALF_H, y + HALF_H - 0.01]) {
      if (isSolid(area, Math.floor(cx / TILE), Math.floor(cy / TILE), env)) return true;
    }
  }
  return false;
}

/** Move the walker; `dx`/`dy` are -1..1 from the keys. Slides along walls. */
export function stepWalk(w: Walker, input: { dx: number; dy: number }, dt: number, env: Env): void {
  const len = Math.hypot(input.dx, input.dy);
  w.moving = len > 0;
  if (!w.moving) {
    w.phase = 0;
    return;
  }
  const dx = input.dx / len, dy = input.dy / len;
  if (dx !== 0 && (dy === 0 || w.facing === 'left' || w.facing === 'right')) w.facing = dx > 0 ? 'right' : 'left';
  else if (dy !== 0) w.facing = dy > 0 ? 'down' : 'up';
  const nx = w.x + dx * SPEED * dt;
  if (!blocked(w.area, nx, w.y, env)) w.x = nx;
  const ny = w.y + dy * SPEED * dt;
  if (!blocked(w.area, w.x, ny, env)) w.y = ny;
  w.phase += dt * 7;
}

const DIRS: Record<Facing, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The interactable thing the walker is facing, if it is within arm's reach. */
export function reach(w: Walker): { kind: Kind; tx: number; ty: number } | null {
  const [fx, fy] = DIRS[w.facing];
  for (const d of [9, 14]) {
    const tx = Math.floor((w.x + fx * d) / TILE), ty = Math.floor((w.y + fy * d) / TILE);
    const kind = kindOf(tileAt(w.area, tx, ty));
    if (kind) return { kind, tx, ty };
  }
  return null;
}
