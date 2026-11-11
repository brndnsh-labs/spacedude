import { cargoMax, holdTons } from '../sim/game';
import type { GameState, Port } from '../sim/types';
import { port } from '../sim/world';
import { TILE_PX, VIEW_H, VIEW_W, ZOOM } from '../view';
import { OUTFITS, PERSON, makePerson } from './art/people';
import { shipArt } from './art/ship';
import { stationArt } from './art/station';
import type { AreaArt, LiveFrame } from './art/types';
import { AREAS, TILE, cratesFor, type AreaId, type Walker } from './world';

/** Where each map's top-left corner sits in the frame, in screen pixels. */
const OFFSET: Record<AreaId, { x: number; y: number }> = { ship: { x: 0, y: 27 }, station: { x: 0, y: 30 } };

/** Where the walker's feet are in the frame, in screen pixels. Map positions are in map units: ZOOM pixels each. */
export function walkerOnScreen(w: Walker): { x: number; y: number } {
  return { x: OFFSET[w.area].x + w.x * ZOOM, y: OFFSET[w.area].y + w.y * ZOOM };
}

/** Who stands behind which counter: the tile they stand on. */
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
  private readonly shipDeck = shipArt();
  private readonly stations = new Map<string, AreaArt>();
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
    for (let i = 0; i < 220; i++) {
      const depth = r();
      this.stars.push({
        x: r() * VIEW_W, y: r() * VIEW_H, depth: 0.15 + depth * 0.6,
        c: depth > 0.8 ? '#fff6e0' : depth > 0.45 ? '#8fa3a8' : '#6a5f78',
      });
    }
  }

  private station(p: Port): AreaArt {
    const key = `${p.type}:${p.look}:${p.yard}`;
    let art = this.stations.get(key);
    if (!art) this.stations.set(key, (art = stationArt(p)));
    return art;
  }

  /** Draw a person with their feet at a screen position. */
  private person(frame: HTMLCanvasElement, fx: number, fy: number): void {
    const k = PERSON.scale;
    this.g.drawImage(frame, Math.round(fx - PERSON.footX * k), Math.round(fy - PERSON.footY * k), PERSON.w * k, PERSON.h * k);
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

    const here = state.docked ? port(state, state.docked) : state.ports[0];
    const art = w.area === 'ship' ? this.shipDeck : this.station(here);
    // Art drawn at another tile size is stretched to the frame's; its own pixels are k screen pixels.
    const k = TILE_PX / art.tile;
    const live: LiveFrame = {
      time: f.time, thrusting: f.thrusting, docked: !!state.docked, crates: cratesFor(holdTons(state), cargoMax(state)),
    };
    g.drawImage(art.back, off.x, off.y, art.back.width * k, art.back.height * k);
    if (art.live) {
      g.setTransform(k, 0, 0, k, off.x, off.y);
      art.live(g, live);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }

    if (w.area === 'station') {
      for (const n of NPCS) {
        if (n.outfit === 'yardBoss' && !here.yard) continue; // nobody behind a shuttered counter
        const sprites = this.people[n.outfit];
        const idle = sprites.idle;
        const frame = idle ? idle[Math.floor(f.time * 3 + n.tx) % idle.length] : sprites.down[0];
        const bob = !idle && Math.floor(f.time * 0.8 + n.tx) % 4 === 0 ? 1 : 0;
        this.person(frame, off.x + (n.tx + 0.5) * TILE_PX, off.y + (n.ty * TILE + 11) * ZOOM + bob);
      }
    }

    if (f.mark) {
      const x = off.x + f.mark.tx * TILE_PX, y = off.y + f.mark.ty * TILE_PX, pulse = Math.floor(f.time * 3) % 2;
      g.fillStyle = '#7fd1c7';
      for (const [ax, ay] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const cx = x - 1 - pulse + ax * (TILE_PX + 1 + pulse * 2), cy = y - 1 - pulse + ay * (TILE_PX + 1 + pulse * 2);
        g.fillRect(ax ? cx - 4 : cx, cy, 5, 1);
        g.fillRect(cx, ay ? cy - 4 : cy, 1, 5);
      }
    }

    // the walker, with a soft shadow at the feet
    const frames = this.people.player[w.facing];
    const walk = frames.length - 1;
    const frame = w.moving && walk > 0 ? frames[1 + (Math.floor(w.phase) % walk)] : frames[0];
    const feet = walkerOnScreen(w), sx = Math.round(feet.x), sy = Math.round(feet.y);
    g.fillStyle = 'rgba(21,18,31,0.35)';
    g.fillRect(sx - 6, sy + 1, 12, 3);
    g.fillRect(sx - 4, sy + 4, 8, 1);
    this.person(frame, sx, sy);

    if (art.front) g.drawImage(art.front, off.x, off.y, art.front.width * k, art.front.height * k);
  }

  /** Space outside the hull: stars slide past with the ship's motion, and the dock shows when berthed. */
  private drawOutside(state: GameState, f: FootFrame): void {
    const g = this.g, s = state.ship;
    // The deck is always drawn nose-right, so turn the velocity into the ship's own frame.
    const cos = Math.cos(s.angle), sin = Math.sin(s.angle);
    this.driftX += (s.vx * cos + s.vy * sin) * f.dt * ZOOM;
    this.driftY += (-s.vx * sin + s.vy * cos) * f.dt * ZOOM;
    g.fillStyle = '#1a1423';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const st of this.stars) {
      const x = (((st.x - this.driftX * st.depth) % VIEW_W) + VIEW_W) % VIEW_W;
      const y = (((st.y - this.driftY * st.depth) % VIEW_H) + VIEW_H) % VIEW_H;
      g.fillStyle = st.c;
      g.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    if (state.docked) {
      const off = OFFSET.ship, door = AREAS.ship.door, x = off.x + door.x * TILE_PX, top = off.y + (door.y + 2) * TILE_PX;
      const band = 39;
      g.fillStyle = '#15121f';
      g.fillRect(0, VIEW_H - band, VIEW_W, band);
      g.fillStyle = '#3a3448';
      g.fillRect(0, VIEW_H - band + 1, VIEW_W, band - 1);
      g.fillStyle = '#555a72';
      g.fillRect(0, VIEW_H - band + 1, VIEW_W, 3);
      for (let lx = 9; lx < VIEW_W; lx += 36) {
        g.fillStyle = Math.floor(f.time * 2 + lx) % 5 ? '#eab668' : '#fff3c4';
        g.fillRect(lx, VIEW_H - 27, 3, 3);
      }
      // docking tube from the airlock down to the station
      g.fillStyle = '#15121f';
      g.fillRect(x, top, TILE_PX, VIEW_H - top);
      g.fillStyle = '#8a8fa3';
      g.fillRect(x + 2, top, TILE_PX - 4, VIEW_H - top);
      g.fillStyle = '#555a72';
      for (let y = top + 3; y < VIEW_H; y += 6) g.fillRect(x + 2, y, TILE_PX - 4, 2);
    }
  }
}
