import { cargoMax, holdTons } from '../sim/game';
import type { GameState, PortId } from '../sim/types';
import {
  OBJECTS, OUTFITS, PERSON_H, PERSON_W, SHIP_THEME, STATION_THEMES, drawCrate, drawCrateSlot, drawFloor, drawWall,
  makePerson, type FloorKind, type Theme,
} from './art';
import { AREAS, COLS, CRATE_SLOTS, ROWS, TILE, cratesFor, isFloor, tileAt, type AreaId, type Walker } from './world';

const VIEW_W = 320, VIEW_H = 180;
/** Where each map sits in the 320x180 frame. */
const OFFSET: Record<AreaId, { x: number; y: number }> = { ship: { x: 0, y: 18 }, station: { x: 0, y: 20 } };

/** Where the walker's feet are in the 320x180 frame. */
export function walkerOnScreen(w: Walker): { x: number; y: number } {
  return { x: OFFSET[w.area].x + w.x, y: OFFSET[w.area].y + w.y };
}

const SHIP_FLOORS: Record<string, FloorKind> = { '.': 'wood', ',': 'metal', ':': 'bridge', ';': 'grate' };

/** The floor an object or crate slot sits on: whatever floor is next to it. */
function floorUnder(area: AreaId, tx: number, ty: number): FloorKind {
  if (area === 'station') return tileAt(area, tx, ty) === 'n' ? 'back' : 'tile';
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const kind = SHIP_FLOORS[tileAt(area, tx + dx, ty + dy)];
    if (kind) return kind;
  }
  return 'metal';
}

/** Everything that never changes in an area, drawn once. */
function bakeArea(area: AreaId, th: Theme): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = COLS * TILE;
  cv.height = ROWS * TILE;
  const g = cv.getContext('2d')!;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const ch = tileAt(area, tx, ty), ox = tx * TILE, oy = ty * TILE;
      if (ch === ' ') continue;
      if (ch === '#' || ch === 'w') {
        const below = tileAt(area, tx, ty + 1);
        drawWall(g, ox, oy, below !== '#' && below !== 'w' && below !== ' ' && below !== 'A', th, ch === 'w');
        continue;
      }
      drawFloor(g, floorUnder(area, tx, ty), ox, oy, tx, ty, th);
      if (ch === 'c') drawCrateSlot(g, ox, oy);
      else if (!isFloor(ch) && ch !== 'n') OBJECTS[ch]?.(g, ox, oy);
    }
  }
  return cv;
}

const NPCS: readonly { tx: number; ty: number; outfit: keyof typeof OUTFITS }[] = [
  { tx: 2, ty: 1, outfit: 'broker' },
  { tx: 12, ty: 1, outfit: 'clerk' },
  { tx: 17, ty: 1, outfit: 'yardBoss' },
];

interface Star { x: number; y: number; c: string; depth: number }

export interface FootFrame {
  dt: number;
  time: number;
  thrusting: boolean;
  /** Tile to mark as "you can use this". */
  mark: { tx: number; ty: number } | null;
}

/** Draws the on-foot view: the ship's deck with space going by, or a station concourse. */
export class FootView {
  private readonly g: CanvasRenderingContext2D;
  private readonly shipDeck = bakeArea('ship', SHIP_THEME);
  private readonly stations = new Map<PortId, HTMLCanvasElement>();
  private readonly people = {
    player: makePerson(OUTFITS.player),
    broker: makePerson(OUTFITS.broker),
    clerk: makePerson(OUTFITS.clerk),
    yardBoss: makePerson(OUTFITS.yardBoss),
  };
  private readonly stars: Star[] = [];
  private driftX = 0;
  private driftY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    let seed = 91;
    const r = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 110; i++) {
      const depth = r();
      this.stars.push({
        x: r() * VIEW_W, y: r() * VIEW_H, depth: 0.15 + depth * 0.6,
        c: depth > 0.8 ? '#fff6e0' : depth > 0.45 ? '#8fa3a8' : '#6a5f78',
      });
    }
  }

  private station(id: PortId): HTMLCanvasElement {
    let cv = this.stations.get(id);
    if (!cv) {
      cv = bakeArea('station', STATION_THEMES[id]);
      this.stations.set(id, cv);
    }
    return cv;
  }

  draw(w: Walker, state: GameState, f: FootFrame): void {
    const g = this.g, off = OFFSET[w.area];
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);

    if (w.area === 'ship') this.drawOutside(state, f);
    else {
      g.fillStyle = '#0d0b12';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    g.drawImage(w.area === 'ship' ? this.shipDeck : this.station(state.docked ?? 'kestrel'), off.x, off.y);

    if (w.area === 'ship') {
      const filled = cratesFor(holdTons(state), cargoMax(state));
      CRATE_SLOTS.slice(0, filled).forEach((s, i) => drawCrate(g, off.x + s.x * TILE, off.y + s.y * TILE, i));
      // engine cores brighten under thrust; the airlock lamp shows whether there is a station outside
      AREAS.ship.rows.forEach((row, ty) => [...row].forEach((ch, tx) => {
        const ox = off.x + tx * TILE, oy = off.y + ty * TILE;
        if (ch === 'e' && f.thrusting) {
          g.fillStyle = Math.floor(f.time * 12 + tx + ty) % 2 ? '#fff3c4' : '#ffd27a';
          g.fillRect(ox + 6, oy + 6, 4, 4);
        } else if (ch === 'A') {
          g.fillStyle = state.docked ? '#8fc47a' : '#e07a5f';
          g.fillRect(ox + 7, oy + 13, 2, 2);
        } else if (ch === 'T' && Math.floor(f.time * 1.5) % 2) {
          g.fillStyle = '#ffb000';
          g.fillRect(ox + 9, oy + 7, 2, 1);
        }
      }));
    } else {
      for (const n of NPCS) {
        const bob = Math.floor(f.time * 0.8 + n.tx) % 4 === 0 ? 1 : 0;
        g.drawImage(this.people[n.outfit].down[0], off.x + n.tx * TILE + 2, off.y + n.ty * TILE - 2 + bob);
      }
    }

    if (f.mark) {
      const x = off.x + f.mark.tx * TILE, y = off.y + f.mark.ty * TILE, pulse = Math.floor(f.time * 3) % 2;
      g.fillStyle = '#7fd1c7';
      for (const [ax, ay] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const cx = x - 1 - pulse + ax * (TILE + 1 + pulse * 2), cy = y - 1 - pulse + ay * (TILE + 1 + pulse * 2);
        g.fillRect(ax ? cx - 2 : cx, cy, 3, 1);
        g.fillRect(cx, ay ? cy - 2 : cy, 1, 3);
      }
    }

    // the walker, with a soft shadow at the feet
    const frames = this.people.player[w.facing];
    const frame = w.moving ? frames[Math.floor(w.phase) % frames.length] : frames[0];
    const sx = Math.round(off.x + w.x), sy = Math.round(off.y + w.y);
    g.fillStyle = 'rgba(21,18,31,0.35)';
    g.fillRect(sx - 4, sy + 1, 8, 2);
    g.drawImage(frame, sx - PERSON_W / 2, sy - PERSON_H + 3);
  }

  /** Space outside the hull: stars slide past with the ship's motion, and the dock shows when berthed. */
  private drawOutside(state: GameState, f: FootFrame): void {
    const g = this.g, s = state.ship;
    // The deck is always drawn nose-right, so turn the velocity into the ship's own frame.
    const cos = Math.cos(s.angle), sin = Math.sin(s.angle);
    this.driftX += (s.vx * cos + s.vy * sin) * f.dt;
    this.driftY += (-s.vx * sin + s.vy * cos) * f.dt;
    g.fillStyle = '#1a1423';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const st of this.stars) {
      const x = (((st.x - this.driftX * st.depth) % VIEW_W) + VIEW_W) % VIEW_W;
      const y = (((st.y - this.driftY * st.depth) % VIEW_H) + VIEW_H) % VIEW_H;
      g.fillStyle = st.c;
      g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    if (state.docked) {
      const off = OFFSET.ship, door = AREAS.ship.door, x = off.x + door.x * TILE, top = off.y + (door.y + 2) * TILE;
      g.fillStyle = '#15121f';
      g.fillRect(0, VIEW_H - 26, VIEW_W, 26);
      g.fillStyle = '#3a3448';
      g.fillRect(0, VIEW_H - 25, VIEW_W, 25);
      g.fillStyle = '#555a72';
      g.fillRect(0, VIEW_H - 25, VIEW_W, 2);
      for (let lx = 6; lx < VIEW_W; lx += 24) {
        g.fillStyle = Math.floor(f.time * 2 + lx) % 5 ? '#eab668' : '#fff3c4';
        g.fillRect(lx, VIEW_H - 18, 2, 2);
      }
      // docking tube from the airlock down to the station
      g.fillStyle = '#15121f';
      g.fillRect(x, top, TILE, VIEW_H - top);
      g.fillStyle = '#8a8fa3';
      g.fillRect(x + 1, top, TILE - 2, VIEW_H - top);
      g.fillStyle = '#555a72';
      for (let y = top + 2; y < VIEW_H; y += 4) g.fillRect(x + 1, y, TILE - 2, 1);
    }
  }
}
