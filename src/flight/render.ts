import type { GameState, PortId } from '../sim/types';
import { PORTS, port } from '../sim/world';
import {
  SHIP_H, SHIP_W, STATION_SIZE, makeArrow, makeNebula, makePlanet, makeShip, makeStars, makeStation,
  type Band, type Ramp, type StationLook,
} from './sprites';

export const VIEW_W = 320, VIEW_H = 180;

interface PlanetLook { r: number; dx: number; dy: number; ramps: readonly Ramp[]; band?: Band }

/** What each port looks like from the cockpit: an optional neighbouring world, and its station. */
const LOOKS: Record<PortId, { planet: PlanetLook | null; station: StationLook }> = {
  kestrel: {
    planet: {
      r: 88, dx: -205, dy: 88,
      ramps: [['#33202f', '#6b3340', '#a3523f', '#cf8048', '#eab668'], ['#2c1c2b', '#57293a', '#8a4238', '#b5683f', '#d99a58']],
      band: (nx, ny) => Math.sin((ny * 8 + Math.sin(nx * 3.5 + ny * 2) * 0.8) * 2.2) > 0.3,
    },
    station: { panels: '#2b4a6b', lights: '#ffd27a', windows: '#3f8f8a' },
  },
  marrow: {
    planet: {
      r: 64, dx: 150, dy: -70,
      ramps: [['#1a2238', '#253a66', '#2f5f8f', '#4f9cb8', '#a8dbe0'], ['#1d2a33', '#24504a', '#3f8f6a', '#8fc47a', '#d9e6a0']],
      band: (nx, ny) => Math.sin(nx * 5 + Math.sin(ny * 6) * 1.4) + Math.sin(ny * 7 - nx * 2) > 0.5,
    },
    station: { panels: '#3d6b4a', lights: '#f2e9dc', windows: '#8fc47a' },
  },
  hollow: {
    planet: {
      r: 42, dx: 95, dy: 40,
      ramps: [['#2a2430', '#4a4048', '#75665f', '#a39280', '#cdbfa5'], ['#231e29', '#3b333c', '#5c504d', '#84766a', '#a89a85']],
      band: (nx, ny) => Math.sin(nx * 11) * Math.sin(ny * 9 + nx * 3) > 0.45,
    },
    station: { panels: null, lights: '#e07a5f', windows: '#cf8048' },
  },
  lantern: {
    planet: {
      r: 110, dx: 260, dy: -150,
      ramps: [['#1f1630', '#3a2757', '#5f3d86', '#8f62ab', '#c79bd1'], ['#1b1430', '#2f2452', '#4a3a7d', '#6f5aa6', '#a58fd0']],
      band: (_nx, ny) => Math.sin(ny * 14) > 0.2,
    },
    station: { panels: '#4a3a7d', lights: '#fff3c4', windows: '#c79bd1' },
  },
};

interface Particle { x: number; y: number; vx: number; vy: number; life: number }

const mod = (a: number, n: number) => ((a % n) + n) % n;

export class FlightView {
  private readonly g: CanvasRenderingContext2D;
  private readonly nebula = makeNebula(VIEW_W, VIEW_H);
  private readonly stars = [
    { tile: makeStars(VIEW_W, VIEW_H, 11, 70, ['#6a5f78', '#6a5f78', '#8fa3a8']), parallax: 0.08 },
    { tile: makeStars(VIEW_W, VIEW_H, 23, 40, ['#8fa3a8', '#f2e9dc']), parallax: 0.16 },
    { tile: makeStars(VIEW_W, VIEW_H, 37, 14, ['#f2e9dc', '#fff6e0'], 0.5), parallax: 0.3 },
  ];
  private readonly ship = makeShip();
  private readonly arrow = makeArrow('#eab668');
  private readonly sprites = new Map<PortId, { planet: HTMLCanvasElement | null; station: HTMLCanvasElement }>();
  private particles: Particle[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.g = canvas.getContext('2d')!;
    for (const p of PORTS) {
      const look = LOOKS[p.id];
      this.sprites.set(p.id, {
        planet: look.planet ? makePlanet(look.planet.r, look.planet.ramps, look.planet.band) : null,
        station: makeStation(look.station),
      });
    }
  }

  private tiled(img: HTMLCanvasElement, ox: number, oy: number): void {
    const x = -Math.round(mod(ox, VIEW_W)), y = -Math.round(mod(oy, VIEW_H));
    for (const dx of [0, VIEW_W]) for (const dy of [0, VIEW_H]) this.g.drawImage(img, x + dx, y + dy);
  }

  draw(state: GameState, thrusting: boolean, dt: number, time: number): void {
    const g = this.g, s = state.ship;
    const camX = Math.round(s.x - VIEW_W / 2), camY = Math.round(s.y - VIEW_H / 2);
    g.imageSmoothingEnabled = false;

    this.tiled(this.nebula, camX * 0.04, camY * 0.04);
    for (const layer of this.stars) this.tiled(layer.tile, camX * layer.parallax, camY * layer.parallax);

    for (const p of PORTS) {
      const look = LOOKS[p.id].planet, img = this.sprites.get(p.id)!.planet;
      if (look && img) g.drawImage(img, p.x + look.dx - look.r - camX, p.y + look.dy - look.r - camY);
    }
    for (const p of PORTS) {
      const sx = p.x - camX, sy = p.y - camY, half = STATION_SIZE / 2;
      if (sx < -half || sy < -half || sx > VIEW_W + half || sy > VIEW_H + half) continue;
      g.drawImage(this.sprites.get(p.id)!.station, sx - half, sy - half);
      if (Math.floor(time * 2) % 2 === 0) {
        g.fillStyle = LOOKS[p.id].station.lights;
        g.fillRect(sx - 47, sy - 1, 2, 3);
      }
    }

    this.drawCourse(state, camX, camY);

    // engine exhaust
    const cos = Math.cos(s.angle), sin = Math.sin(s.angle);
    if (thrusting) {
      for (let i = 0; i < 2; i++) {
        const j = Math.random() - 0.5;
        this.particles.push({
          x: s.x - cos * 13 - sin * j * 3, y: s.y - sin * 13 + cos * j * 3,
          vx: s.vx - cos * (40 + Math.random() * 30) - sin * j * 16,
          vy: s.vy - sin * (40 + Math.random() * 30) + cos * j * 16,
          life: 1,
        });
      }
    }
    this.particles = this.particles.filter(p => (p.life -= dt * 1.8) > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.fillStyle = p.life > 0.7 ? '#fff3c4' : p.life > 0.45 ? '#ffd27a' : p.life > 0.2 ? '#cf8048' : '#6b3340';
      g.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), 1, 1);
    }

    g.setTransform(1, 0, 0, 1, Math.round(s.x - camX), Math.round(s.y - camY));
    g.rotate(s.angle);
    g.drawImage(this.ship, -SHIP_W / 2, -Math.floor(SHIP_H / 2));
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Brackets around the destination when it is on screen, a chevron at the screen edge when it is not. */
  private drawCourse(state: GameState, camX: number, camY: number): void {
    if (!state.target) return;
    const g = this.g, p = port(state.target);
    const tx = p.x - camX, ty = p.y - camY;
    if (tx > 0 && ty > 0 && tx < VIEW_W && ty < VIEW_H) {
      g.fillStyle = '#eab668';
      for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const cx = tx + ax * 34, cy = ty + ay * 34;
        g.fillRect(Math.min(cx, cx - ax * 5), cy, 6, 1);
        g.fillRect(cx, Math.min(cy, cy - ay * 5), 1, 6);
      }
      return;
    }
    const dx = tx - VIEW_W / 2, dy = ty - VIEW_H / 2;
    // Inset far enough to clear the HUD boxes along the top and bottom edges.
    const k = Math.min((VIEW_W / 2 - 12) / Math.abs(dx || 1e-6), (VIEW_H / 2 - 34) / Math.abs(dy || 1e-6));
    g.setTransform(1, 0, 0, 1, Math.round(VIEW_W / 2 + dx * k), Math.round(VIEW_H / 2 + dy * k));
    g.rotate(Math.atan2(dy, dx));
    g.drawImage(this.arrow, -2, -2);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
}
