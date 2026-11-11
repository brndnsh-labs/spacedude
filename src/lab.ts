/**
 * The art lab: every sprite and room on one page, enlarged, for looking at art without playing to it.
 * Dev only (open /lab.html on the dev server). Pick a section with ?show=ship|stations|worlds|sky|deck|rooms|people
 * and a magnification with &zoom=4. Everything is shown at the size it has in the game's 480x270 frame, times zoom.
 */
import { FRAME_PIVOT_X, FRAME_PIVOT_Y, SHIP_FRAMES, SHIP_SCALE, makeShipFrames } from './flight/ship';
import { makeNebula, makeStarLayers } from './flight/sky';
import { makeStation } from './flight/stations';
import { ROCK_PIT, makeGiant, makeMarrow, makeOssa, makeRock, type WorldSprite } from './flight/worlds';
import { MINE_BELT_END } from './flight/render';
import { OUTFITS, PERSON, makePerson } from './foot/art/people';
import { shipArt } from './foot/art/ship';
import { stationArt } from './foot/art/station';
import type { AreaArt } from './foot/art/types';
import { CRATE_SLOTS } from './foot/world';
import { ARM } from './sim/game';
import type { PortType } from './sim/types';
import { LEGACY_SCALE, TILE_PX, VIEW_H, VIEW_W, ZOOM } from './view';

const params = new URLSearchParams(location.search);
const show = params.get('show') ?? 'all';
const zoomParam = Number(params.get('zoom')) || 0;
const root = document.getElementById('lab')!;
const TYPES: readonly PortType[] = ['ring', 'farm', 'mine', 'relay'];
const SECTIONS = ['ship', 'stations', 'worlds', 'sky', 'deck', 'rooms', 'people'];
document.getElementById('nav')!.innerHTML = ['all', ...SECTIONS].map(s => `<a href="?show=${s}">${s}</a>`).join('');

/** Things redrawn every frame. */
const animated: ((time: number) => void)[] = [];

function section(name: string, title: string): HTMLElement | null {
  if (show !== 'all' && show !== name) return null;
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  root.append(h, row);
  return row;
}

/** A canvas of w x h frame pixels shown at `zoom`, with a caption. Draw into it in frame pixels. */
function panel(row: HTMLElement, w: number, h: number, zoom: number, caption: string): CanvasRenderingContext2D {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w);
  cv.height = Math.ceil(h);
  cv.style.width = `${cv.width * zoom}px`;
  cv.style.height = `${cv.height * zoom}px`;
  const fig = document.createElement('figure'), cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.append(cv, cap);
  row.append(fig);
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return g;
}

const native = (scale: number) => (scale === 1 ? 'native' : `legacy, stretched x${scale}`);

/* ---------- flight ---------- */

const frames = makeShipFrames();
function drawShipAt(g: CanvasRenderingContext2D, index: number, x: number, y: number): void {
  const f = frames[index], k = SHIP_SCALE;
  g.drawImage(f, Math.round(x - FRAME_PIVOT_X * k), Math.round(y - FRAME_PIVOT_Y * k), f.width * k, f.height * k);
}

const ship = section('ship', `Ship: ${SHIP_FRAMES} headings (${native(SHIP_SCALE)})`);
if (ship) {
  const size = Math.ceil(frames[0].width * SHIP_SCALE);
  const big = panel(ship, size, size, zoomParam || 8, 'heading 0 (nose right)');
  drawShipAt(big, 0, FRAME_PIVOT_X * SHIP_SCALE, FRAME_PIVOT_Y * SHIP_SCALE);
  const strip = panel(ship, size * 8, size * 2, zoomParam || 3, 'every fourth heading, clockwise from nose-right');
  for (let i = 0; i < 16; i++) drawShipAt(strip, i * (SHIP_FRAMES / 16), (i % 8) * size + FRAME_PIVOT_X * SHIP_SCALE, Math.floor(i / 8) * size + FRAME_PIVOT_Y * SHIP_SCALE);
  const turn = panel(ship, size, size, zoomParam || 6, 'turning');
  animated.push(t => {
    turn.clearRect(0, 0, size, size);
    drawShipAt(turn, Math.floor(t * 12) % SHIP_FRAMES, FRAME_PIVOT_X * SHIP_SCALE, FRAME_PIVOT_Y * SHIP_SCALE);
  });
}

const WORLDS: Record<PortType, () => WorldSprite> = { ring: makeOssa, farm: makeMarrow, mine: makeRock, relay: makeGiant };

const stations = section('stations', 'Stations, with the ship at its berth');
if (stations) {
  for (const type of TYPES) {
    for (const look of [0, 3]) {
      const st = makeStation(type, look), k = st.scale, half = st.half * k;
      const g = panel(stations, half * 2, half * 2, zoomParam || (look ? 2 : 3), `${type}${look ? ' (a generated port\'s colours)' : ''}: ${native(k)}`);
      animated.push(t => {
        g.clearRect(0, 0, half * 2, half * 2);
        g.drawImage(st.canvas, 0, 0, half * 2, half * 2);
        const dot = Math.max(1, Math.round(k));
        for (const l of st.lights) {
          if ((((t + l.phase) % l.period) + l.period) % l.period > l.duty * l.period) continue;
          g.fillStyle = l.colour;
          g.fillRect(Math.round(half + l.x * k), Math.round(half + l.y * k), dot, dot);
        }
        drawShipAt(g, 0, half - ARM * ZOOM, half); // berthed: nose against the docking collar
      });
    }
  }
}

const worlds = section('worlds', 'Worlds');
if (worlds) {
  for (const type of TYPES) {
    const w = WORLDS[type](), k = w.scale ?? LEGACY_SCALE;
    const g = panel(worlds, w.canvas.width * k, w.canvas.height * k, zoomParam || 2, `${type}'s neighbour: ${native(k)}`);
    g.drawImage(w.canvas, 0, 0, w.canvas.width * k, w.canvas.height * k);
  }
  // The mining rig and its rock together, placed as the game places them: the conveyor must land in the pit.
  const st = makeStation('mine', 0), rock = makeRock(), rk = rock.scale ?? LEGACY_SCALE, half = st.half * st.scale;
  const W = half * 2 + 160, g = panel(worlds, W, half * 2 + 60, zoomParam || 3, 'mine + rock: the belt ends in the strip mine');
  const px = half, py = half;
  const rx = px + MINE_BELT_END.x * ZOOM - ROCK_PIT.x * rk, ry = py + MINE_BELT_END.y * ZOOM - ROCK_PIT.y * rk;
  g.drawImage(rock.canvas, Math.round(rx - rock.cx * rk), Math.round(ry - rock.cy * rk), rock.canvas.width * rk, rock.canvas.height * rk);
  g.drawImage(st.canvas, 0, 0, half * 2, half * 2);
}

const sky = section('sky', 'Sky: one frame of the nebula and star layers');
if (sky) {
  const g = panel(sky, VIEW_W, VIEW_H, zoomParam || 3, 'as the flight view shows it; it scrolls slowly here');
  const neb = makeNebula(), layers = makeStarLayers();
  animated.push(t => {
    for (const tile of [neb, ...layers]) {
      const x0 = -Math.round((t * 40 * tile.parallax) % tile.w);
      for (let x = x0; x < VIEW_W; x += tile.w) for (let y = 0; y < VIEW_H; y += tile.h) g.drawImage(tile.canvas, x, y);
    }
  });
}

/* ---------- on foot ---------- */

const people = Object.fromEntries(Object.entries(OUTFITS).map(([name, o]) => [name, makePerson(o)]));
function drawPerson(g: CanvasRenderingContext2D, frame: HTMLCanvasElement, fx: number, fy: number): void {
  const k = PERSON.scale;
  g.drawImage(frame, Math.round(fx - PERSON.footX * k), Math.round(fy - PERSON.footY * k), PERSON.w * k, PERSON.h * k);
}

function room(row: HTMLElement, art: AreaArt, zoom: number, caption: string, who: { name: string; tx: number; ty: number }[]): void {
  const k = TILE_PX / art.tile, W = art.back.width * k, H = art.back.height * k;
  const g = panel(row, W, H, zoom, `${caption}: ${art.tile === TILE_PX ? 'native' : `legacy ${art.tile}px tiles, stretched`}`);
  animated.push(t => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#1a1423';
    g.fillRect(0, 0, W, H);
    g.drawImage(art.back, 0, 0, W, H);
    if (art.live) {
      g.setTransform(k, 0, 0, k, 0, 0);
      art.live(g, { time: t, thrusting: Math.floor(t / 3) % 2 === 0, docked: Math.floor(t / 5) % 2 === 0, crates: Math.floor(t / 2) % (CRATE_SLOTS.length + 1) });
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
    for (const p of who) {
      const s = people[p.name], f = s.idle ? s.idle[Math.floor(t * 3) % s.idle.length] : s.down[0];
      drawPerson(g, f, (p.tx + 0.5) * TILE_PX, (p.ty * 16 + 11) * ZOOM);
    }
    if (art.front) g.drawImage(art.front, 0, 0, W, H);
  });
}

const deck = section('deck', 'The ship\'s deck (crates, thrust and docking cycle so every state shows)');
if (deck) room(deck, shipArt(), zoomParam || 3, 'ship', [{ name: 'player', tx: 12, ty: 4 }]);

const rooms = section('rooms', 'Station concourses');
if (rooms) {
  const staff = [{ name: 'broker', tx: 2, ty: 1 }, { name: 'clerk', tx: 12, ty: 1 }, { name: 'yardBoss', tx: 17, ty: 1 }, { name: 'player', tx: 8, ty: 5 }];
  for (const type of TYPES) room(rooms, stationArt({ type, look: 0, yard: true }), zoomParam || 2, type, staff);
  room(rooms, stationArt({ type: 'farm', look: 3, yard: false }), zoomParam || 2, 'a generated farm port with no yard', staff.filter(s => s.name !== 'yardBoss'));
}

const folk = section('people', `People (${native(PERSON.scale)})`);
if (folk) {
  const k = PERSON.scale, w = PERSON.w * k, h = PERSON.h * k;
  for (const [name, s] of Object.entries(people)) {
    const dirs = ['down', 'left', 'right', 'up'] as const, n = Math.max(...dirs.map(d => s[d].length), s.idle?.length ?? 0);
    const g = panel(folk, (w + 4) * n, (h + 4) * (dirs.length + (s.idle ? 1 : 0)), zoomParam || 5, `${name}: rows down, left, right, up${s.idle ? ', idle' : ''}; first frame standing`);
    [...dirs.map(d => s[d]), ...(s.idle ? [s.idle] : [])].forEach((row, j) => row.forEach((f, i) => g.drawImage(f, i * (w + 4) + 2, j * (h + 4) + 2, w, h)));
    const walk = panel(folk, w * 4 + 16, h + 4, zoomParam || 5, `${name} walking`);
    animated.push(t => {
      walk.clearRect(0, 0, w * 4 + 16, h + 4);
      dirs.forEach((d, i) => {
        const cycle = s[d].length - 1;
        walk.drawImage(cycle > 0 ? s[d][1 + (Math.floor(t * 7) % cycle)] : s[d][0], i * (w + 4) + 2, 2, w, h);
      });
    });
  }
}

function loop(now: number): void {
  for (const draw of animated) draw(now / 1000);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
