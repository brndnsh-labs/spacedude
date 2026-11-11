import { nextStop } from '../sim/nav';
import type { GameState, Port, PortType } from '../sim/types';
import { port } from '../sim/world';
import { PixelBuf, bay, hueFor, hueShifted, mod } from './pixels';
import { FRAME_PIVOT_X, FRAME_PIVOT_Y, SHIP_FRAMES, SHIP_POINTS, makeShipFrames } from './ship';
import { makeNebula, makeStarLayers, type SkyTile } from './sky';
import { makeStation, type StationSprite } from './stations';
import { ROCK_PIT, makeGiant, makeMarrow, makeOssa, makeRock, type WorldSprite } from './worlds';

export const VIEW_W = 320, VIEW_H = 180;

/**
 * Where a port's neighbouring world sits, relative to the port. The first of each is the core port's;
 * generated ports of that type pick one by their look.
 */
const WORLD_OFFSET: Record<PortType, readonly { dx: number; dy: number }[]> = {
  ring: [{ dx: -205, dy: 88 }, { dx: 150, dy: 96 }, { dx: -170, dy: -110 }],
  farm: [{ dx: 96, dy: -62 }, { dx: -110, dy: -70 }, { dx: 100, dy: 80 }],
  mine: [{ dx: 66 - ROCK_PIT.x, dy: 32 - ROCK_PIT.y }], // so the rig's conveyor lands in the strip mine
  relay: [{ dx: 140, dy: -90 }, { dx: -150, dy: -80 }, { dx: 130, dy: 100 }],
};
const WORLD_BUILD: Record<PortType, () => WorldSprite> = { ring: makeOssa, farm: makeMarrow, mine: makeRock, relay: makeGiant };
const WORLD_HUES = [-55, 40, -30, 70, 150, -95, 25];

interface Ember { x: number; y: number; vx: number; vy: number; life: number }

const PLUME = ['#fff3c4', '#ffd27a', '#eab668', '#cf8048', '#8a4238'];

function makeArrow(colour: string): HTMLCanvasElement {
  const buf = new PixelBuf(7, 7);
  ['.#.....', '.##....', '.###...', '.####..', '.###...', '.##....', '.#.....'].forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '#') buf.put(i, j, colour);
  }));
  buf.outline('#15121f');
  return buf.toCanvas();
}

export class FlightView {
  private readonly g: CanvasRenderingContext2D;
  private readonly nebula = makeNebula();
  private readonly stars = makeStarLayers();
  private readonly ship = makeShipFrames();
  /** Sprites are painted the first time a port comes into view, and kept by type and look. */
  private readonly stations = new Map<string, StationSprite>();
  private readonly worlds = new Map<string, WorldSprite>();
  private readonly worldBase = new Map<PortType, WorldSprite>();
  private readonly arrow = makeArrow('#eab668');
  private embers: Ember[] = [];
  private thrust = 0;
  private frame = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
  }

  private station(p: Port): StationSprite {
    const key = `${p.type}:${p.look}`;
    let st = this.stations.get(key);
    if (!st) this.stations.set(key, (st = makeStation(p.type, p.look)));
    return st;
  }

  private world(p: Port): WorldSprite & { dx: number; dy: number } {
    const key = `${p.type}:${p.look}`;
    let w = this.worlds.get(key);
    if (!w) {
      let base = this.worldBase.get(p.type);
      if (!base) this.worldBase.set(p.type, (base = WORLD_BUILD[p.type]()));
      w = { ...base, canvas: hueShifted(base.canvas, hueFor(p.look, WORLD_HUES)) };
      this.worlds.set(key, w);
    }
    const spots = WORLD_OFFSET[p.type];
    return { ...w, ...spots[p.look % spots.length] };
  }

  /** Draw a repeating tile scrolled by (ox, oy); returns where its origin landed. */
  private tiled(t: SkyTile, camX: number, camY: number): { x0: number; y0: number } {
    const x0 = -Math.round(mod(camX * t.parallax, t.w)), y0 = -Math.round(mod(camY * t.parallax, t.h));
    for (let x = x0; x < VIEW_W; x += t.w) for (let y = y0; y < VIEW_H; y += t.h) this.g.drawImage(t.canvas, x, y);
    return { x0, y0 };
  }

  draw(state: GameState, thrusting: boolean, dt: number, time: number): void {
    const g = this.g, s = state.ship;
    const camX = Math.round(s.x - VIEW_W / 2), camY = Math.round(s.y - VIEW_H / 2);
    g.imageSmoothingEnabled = false;
    if (dt > 0) this.frame++;

    // sky
    this.tiled(this.nebula, camX, camY);
    for (const layer of this.stars) {
      const { x0, y0 } = this.tiled(layer, camX, camY);
      for (const tw of layer.twinkles) {
        const x = mod(tw.x + x0, layer.w), y = mod(tw.y + y0, layer.h);
        if (x >= VIEW_W || y >= VIEW_H) continue;
        const beat = Math.sin(time * tw.speed + tw.phase);
        if (beat > 0.55) {
          g.fillStyle = tw.glow;
          g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y - 1, 1, 1); g.fillRect(x, y + 1, 1, 1);
        } else if (beat < -0.7) {
          g.fillStyle = '#4f4863';
          g.fillRect(x, y, 1, 1);
        }
      }
    }

    // worlds, then the stations in front of them
    // Only ports near the view are worth a look: nothing drawn for one reaches farther than this.
    const near = state.ports.filter(p => Math.abs(p.x - s.x) < 520 && Math.abs(p.y - s.y) < 440);
    for (const p of near) {
      const w = this.world(p);
      const x = p.x + w.dx - w.cx - camX, y = p.y + w.dy - w.cy - camY;
      if (x < VIEW_W && y < VIEW_H && x + w.canvas.width > 0 && y + w.canvas.height > 0) g.drawImage(w.canvas, x, y);
    }
    for (const p of near) {
      const st = this.station(p), sx = p.x - camX, sy = p.y - camY;
      if (sx < -st.half || sy < -st.half || sx > VIEW_W + st.half || sy > VIEW_H + st.half) continue;
      if (st.lamp) this.drawBeam(sx + st.lamp.x, sy + st.lamp.y, time);
      g.drawImage(st.canvas, sx - st.half, sy - st.half);
      this.drawStationLife(st, sx, sy, time);
    }

    this.drawCourse(state, camX, camY);
    this.drawShip(state, thrusting, dt, time, camX, camY);
  }

  /** Blinking nav lights, the Lantern's lamp, welding sparks and ore on the belt. */
  private drawStationLife(st: StationSprite, sx: number, sy: number, time: number): void {
    const g = this.g;
    for (const l of st.lights) {
      if (mod(time + l.phase, l.period) > l.duty * l.period) continue;
      g.fillStyle = l.colour;
      g.fillRect(sx + l.x, sy + l.y, 1, 1);
      if (l.halo) {
        g.globalAlpha = 0.35;
        g.fillRect(sx + l.x - 1, sy + l.y, 3, 1);
        g.fillRect(sx + l.x, sy + l.y - 1, 1, 3);
        g.globalAlpha = 1;
      }
    }
    if (st.lamp) {
      const lx = sx + st.lamp.x, ly = sy + st.lamp.y;
      const glow = 6.5 + Math.sin(time * 2.2) * 1.5;
      for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          const d = Math.hypot(dx, dy);
          if (d > glow) continue;
          if (d < 2.3) g.fillStyle = '#ffffff';
          else if ((1 - d / glow) * 1.5 > bay(lx + dx, ly + dy)) g.fillStyle = d < 4 ? '#fff3c4' : '#eab668';
          else continue;
          g.fillRect(lx + dx, ly + dy, 1, 1);
        }
      }
    }
    if (st.sparks) {
      const t = time * 9;
      if (mod(time, 5) < 1.6 && Math.floor(t) % 3 !== 0) {
        const j = Math.floor(t) * 7;
        g.fillStyle = '#ffffff';
        g.fillRect(sx + st.sparks.x, sy + st.sparks.y, 1, 1);
        g.fillStyle = '#ffd27a';
        g.fillRect(sx + st.sparks.x + (j % 3) - 1, sy + st.sparks.y - 1 - (j % 2), 1, 1);
        g.fillRect(sx + st.sparks.x + ((j >> 1) % 3) - 1, sy + st.sparks.y + 1, 1, 1);
      }
    }
    if (st.belt) {
      const b = st.belt, n = 6;
      for (let i = 0; i < n; i++) {
        const t = 1 - mod(time * 0.12 + i / n, 1); // ore rides in from the rock toward the hoppers
        g.fillStyle = i % 2 ? '#dba85e' : '#84766a';
        g.fillRect(sx + Math.round(b.x0 + (b.x1 - b.x0) * t), sy + Math.round(b.y0 + (b.y1 - b.y0) * t), 1, 1);
      }
    }
  }

  /** The Lantern's sweep: two dithered beams turning slowly, drawn under the station. */
  private drawBeam(lx: number, ly: number, time: number): void {
    const g = this.g, ang = time * 0.45, cos = Math.cos(ang), sin = Math.sin(ang), reach = 78;
    const x0 = Math.max(0, lx - reach), x1 = Math.min(VIEW_W - 1, lx + reach);
    const y0 = Math.max(0, ly - reach), y1 = Math.min(VIEW_H - 1, ly + reach);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - lx, dy = y - ly;
        const along = Math.abs(dx * cos + dy * sin), across = Math.abs(-dx * sin + dy * cos);
        const spread = along * 0.2 + 1;
        if (along < 9 || along > reach || across > spread) continue;
        const power = (1 - along / reach) ** 1.5 * (1 - across / spread);
        if (power * 1.1 <= bay(x, y)) continue;
        g.fillStyle = power > 0.55 ? '#fff3c4' : power > 0.3 ? '#eab668' : '#7a4a4a';
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  private drawShip(state: GameState, thrusting: boolean, dt: number, time: number, camX: number, camY: number): void {
    const g = this.g, s = state.ship;
    const sx = Math.round(s.x - camX), sy = Math.round(s.y - camY);
    // snap to the nearest pre-rendered heading, and fire the exhaust along that same heading
    const index = mod(Math.round((s.angle / (Math.PI * 2)) * SHIP_FRAMES), SHIP_FRAMES);
    const heading = (index / SHIP_FRAMES) * Math.PI * 2;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    const at = (p: { x: number; y: number }) => ({ x: sx + p.x * cos - p.y * sin, y: sy + 0.5 + p.x * sin + p.y * cos });

    this.thrust += ((thrusting ? 1 : 0) - this.thrust) * Math.min(1, dt * 12);

    // embers shed from the plume, left behind as a fading trail
    if (thrusting && dt > 0 && this.frame % 2 === 0) {
      const tail = at({ x: SHIP_POINTS.mainNozzle.x - 9, y: (Math.random() - 0.5) * 3 });
      this.embers.push({
        x: tail.x + camX, y: tail.y + camY,
        vx: s.vx * 0.35 - cos * 26 + (Math.random() - 0.5) * 8,
        vy: s.vy * 0.35 - sin * 26 + (Math.random() - 0.5) * 8,
        life: 1,
      });
    }
    this.embers = this.embers.filter(e => (e.life -= dt * 1.5) > 0);
    for (const e of this.embers) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      g.fillStyle = e.life > 0.6 ? '#cf8048' : e.life > 0.3 ? '#8a4238' : '#57293a';
      g.fillRect(Math.floor(e.x - camX), Math.floor(e.y - camY), 1, 1);
    }

    if (this.thrust > 0.08) {
      const flick = [0, 1, 2, 1][this.frame >> 1 & 3];
      this.drawPlume(at(SHIP_POINTS.mainNozzle), cos, sin, (12 + flick) * this.thrust, 1.9);
      for (const n of SHIP_POINTS.nacelleNozzles) this.drawPlume(at(n), cos, sin, (4 + (flick & 1)) * this.thrust, 0.6);
    }

    g.drawImage(this.ship[index], sx - FRAME_PIVOT_X, sy - FRAME_PIVOT_Y);

    // running lights: red to port, green to starboard
    if (mod(time, 1.6) < 1.1) {
      const port = at(SHIP_POINTS.portLight), star = at(SHIP_POINTS.starboardLight);
      g.fillStyle = '#ff6b5a';
      g.fillRect(Math.floor(port.x), Math.floor(port.y), 1, 1);
      g.fillStyle = '#7df0b0';
      g.fillRect(Math.floor(star.x), Math.floor(star.y), 1, 1);
    }
  }

  /** A tapering flame: white-hot at the nozzle, cooling through amber to rust, breaking up at the tip. */
  private drawPlume(from: { x: number; y: number }, cos: number, sin: number, length: number, halfWidth: number): void {
    const g = this.g;
    for (let i = 0; i < length; i++) {
      const t = i / length, hw = halfWidth * (1 - t * 0.75);
      for (let j = -Math.round(hw); j <= Math.round(hw); j++) {
        if (t > 0.65 && ((i + j + (this.frame >> 1)) & 1)) continue;
        const heat = t + Math.abs(j) / (halfWidth + 1) * 0.5;
        g.fillStyle = PLUME[Math.min(PLUME.length - 1, Math.floor(heat * PLUME.length))];
        g.fillRect(Math.floor(from.x - cos * i - sin * j), Math.floor(from.y - sin * i + cos * j), 1, 1);
      }
    }
  }

  /**
   * Brackets around where we are headed when it is on screen, a chevron at the screen edge when it is not.
   * On a long course that is the next stop on the way, not the far end.
   */
  private drawCourse(state: GameState, camX: number, camY: number): void {
    const stop = nextStop(state);
    if (!stop) return;
    const g = this.g, p = port(state, stop);
    const tx = p.x - camX, ty = p.y - camY;
    if (tx > 0 && ty > 0 && tx < VIEW_W && ty < VIEW_H) {
      const reach = this.station(p).extent + 6;
      g.fillStyle = '#eab668';
      for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = tx + ax * reach, cy = ty + ay * reach;
        g.fillRect(Math.min(cx, cx - ax * 6), cy, 7, 1);
        g.fillRect(cx, Math.min(cy, cy - ay * 6), 1, 7);
      }
      return;
    }
    const dx = tx - VIEW_W / 2, dy = ty - VIEW_H / 2;
    // Inset far enough to clear the HUD boxes along the top and bottom edges.
    const k = Math.min((VIEW_W / 2 - 12) / Math.abs(dx || 1e-6), (VIEW_H / 2 - 34) / Math.abs(dy || 1e-6));
    g.setTransform(1, 0, 0, 1, Math.round(VIEW_W / 2 + dx * k), Math.round(VIEW_H / 2 + dy * k));
    g.rotate(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)); // eight clean directions
    g.drawImage(this.arrow, -3, -3);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
