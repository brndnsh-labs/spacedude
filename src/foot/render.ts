import { cargoMax, holdTons } from '../sim/game';
import type { GameState, Port } from '../sim/types';
import { port } from '../sim/world';
import { INK, PAL, SIGNAL } from '../art/palette';
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
  /** The station's hull along the bottom of the frame and the boarding tube up to the airlock. Painted once. */
  private readonly dock = paintDock();
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
      g.drawImage(this.dock, 0, VIEW_H - this.dock.height);
      // guide lamps chase along the station's lip toward the tube
      const step = Math.floor(f.time * 4);
      for (let i = 0, lx = DOCK.lampFirst; lx < VIEW_W; lx += DOCK.lampGap, i++) {
        const away = Math.abs(lx - (DOCK.tubeX + TILE_PX / 2)) / DOCK.lampGap;
        g.fillStyle = (Math.round(away) + step) % 4 === 0 ? SIGNAL.white : PAL.amber[3];
        g.fillRect(lx + 1, VIEW_H - DOCK.band + 4, 3, 2);
      }
    }
  }
}

/** Where the dock sits: a band of station hull along the bottom, and the tube from the airlock down into it. */
const DOCK = {
  band: 39,
  tubeX: OFFSET.ship.x + AREAS.ship.door.x * TILE_PX,
  tubeTop: OFFSET.ship.y + (AREAS.ship.door.y + 2) * TILE_PX,
  lampFirst: 10, lampGap: 36,
};

function paintDock(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  // tall enough to hold the stretch of tube above the band
  const rise = VIEW_H - DOCK.band - DOCK.tubeTop, top = Math.max(0, rise);
  c.width = VIEW_W;
  c.height = DOCK.band + top;
  const g = c.getContext('2d')!, st = PAL.steel;
  const px = (x: number, y: number, w: number, h: number, colour: string) => { g.fillStyle = colour; g.fillRect(x, y + top, w, h); };

  // the hull: a lit lip, a plated wall, a darker skirt
  px(0, 0, VIEW_W, DOCK.band, st[2]);
  px(0, 0, VIEW_W, 1, INK);
  px(0, 1, VIEW_W, 1, st[6]);
  px(0, 2, VIEW_W, 1, st[5]);
  px(0, 3, VIEW_W, 4, st[4]);
  px(0, 7, VIEW_W, 1, st[1]);
  px(0, 8, VIEW_W, 15, st[3]);
  px(0, 8, VIEW_W, 1, st[4]);
  px(0, 23, VIEW_W, 1, st[1]);
  px(0, 24, VIEW_W, 1, st[3]);
  // the skirt falls into shadow: a checker of the two darkest steels
  for (let y = 31; y < DOCK.band; y++) for (let x = (y & 1); x < VIEW_W; x += 2) px(x, y, 1, 1, st[y > 34 ? 0 : 1]);
  for (let x = 0; x < VIEW_W; x++) if (x % 3 === 0) px(x, DOCK.band - 1, 1, 1, st[0]);

  // plate seams, with a rivet either side, and the odd plate that was replaced
  for (let x = 22, i = 0; x < VIEW_W; x += 48, i++) {
    px(x, 9, 1, 14, st[1]);
    px(x + 1, 9, 1, 14, st[4]);
    for (const y of [11, 20]) { px(x - 3, y, 1, 1, st[5]); px(x - 3, y + 1, 1, 1, st[1]); px(x + 4, y, 1, 1, st[5]); px(x + 4, y + 1, 1, 1, st[1]); }
    if (i % 4 === 1) { px(x + 2, 9, 46, 14, st[2]); px(x + 2, 9, 46, 1, st[3]); px(x + 30, 13, 12, 5, PAL.rust[3]); px(x + 30, 13, 12, 1, PAL.rust[5]); }
  }
  // portholes: most lamplit, a few dark
  for (let x = 44, i = 0; x < VIEW_W; x += 48, i++) {
    px(x - 1, 12, 9, 8, st[1]);
    px(x, 13, 7, 6, INK);
    const lit = i % 5 !== 3;
    px(x + 1, 14, 5, 4, lit ? PAL.amber[3] : PAL.teal[0]);
    px(x + 1, 14, 5, 1, lit ? PAL.amber[5] : PAL.teal[1]);
    px(x + 3, 14, 1, 4, INK);
    if (lit) px(x + 1, 20, 5, 1, PAL.amber[1]);
  }
  // lamp housings on the lip
  for (let x = DOCK.lampFirst; x < VIEW_W; x += DOCK.lampGap) { px(x, 3, 5, 4, INK); px(x + 1, 4, 3, 2, PAL.amber[3]); }
  // a service pipe along the skirt, strapped down every so often
  px(0, 26, VIEW_W, 1, st[5]);
  px(0, 27, VIEW_W, 2, st[4]);
  px(0, 29, VIEW_W, 1, st[1]);
  for (let x = 8; x < VIEW_W; x += 60) { px(x, 25, 3, 6, st[1]); px(x, 25, 3, 1, st[6]); px(x + 1, 26, 1, 4, PAL.amber[2]); }

  // the boarding tube: a ribbed sleeve, lit from the left, running down into the hull
  const x0 = DOCK.tubeX, w = TILE_PX, y0 = -top, y1 = DOCK.band;
  const rib = [st[6], st[5], st[3], st[2]];
  for (let y = y0; y < y1; y++) {
    const base = rib[((y - y0) % 4 + 4) % 4], n = st.indexOf(base);
    px(x0, y, w, 1, base);
    px(x0 + 1, y, 2, 1, st[Math.max(0, n - 1)]);
    px(x0 + 5, y, 4, 1, st[Math.min(st.length - 1, n + 1)]);
    px(x0 + w - 6, y, 3, 1, st[Math.max(0, n - 1)]);
    px(x0 + w - 3, y, 2, 1, st[Math.max(0, n - 2)]);
    px(x0, y, 1, 1, INK);
    px(x0 + w - 1, y, 1, 1, INK);
  }
  // a clamp ring under the ship's hull, and a hazard-painted collar where the tube enters the station
  px(x0 - 2, y0, w + 4, 4, INK);
  px(x0 - 1, y0, w + 2, 1, st[7]);
  px(x0 - 1, y0 + 1, w + 2, 2, st[5]);
  px(x0 - 4, -1, w + 8, 9, INK);
  px(x0 - 3, 0, w + 6, 7, PAL.amber[4]);
  px(x0 - 3, 0, w + 6, 1, PAL.amber[6]);
  px(x0 - 3, 6, w + 6, 1, PAL.amber[2]);
  for (let x = -3; x < w + 3; x++) for (let y = 1; y < 6; y++) if (((x + y) >> 1) % 3 === 0) px(x0 + x, y, 1, 1, INK);
  // its shadow on the plating to the right
  for (let y = 8; y < 23; y++) for (let x = (y & 1); x < 5; x += 2) px(x0 + w + x, y, 1, 1, st[1]);
  return c;
}
