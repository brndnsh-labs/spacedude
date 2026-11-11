import '@fontsource/pixelify-sans';
import '@fontsource/vt323';
import './style.css';
import { FlightView, VIEW_H, VIEW_W } from './flight/render';
import { FootView, walkerOnScreen } from './foot/render';
import { cratesFor, crossAirlock, newWalker, reach, stepWalk, type Kind } from './foot/world';
import { atDock, autopilot, cargoMax, dock, dockable, holdTons, launch, newGame, stepFlight } from './sim/game';
import { nextStop, planRoute, shortfall } from './sim/nav';
import { clearSave, loadGame, saveGame } from './sim/save';
import type { FlightInput, GameState, PortId } from './sim/types';
import { charted, port } from './sim/world';
import { Console } from './ui/console';
import { Hud } from './ui/hud';

const stage = document.getElementById('stage') as HTMLDivElement;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const flightView = new FlightView(canvas);
const footView = new FootView(canvas);
const hud = new Hud(document.getElementById('hud') as HTMLDivElement);

// `?new` in the URL throws away the save and starts over. `?seed=123` does the same in a sector of your choosing:
// the same seed always rolls the same map, so a sector can be shared or come back to.
const params = new URLSearchParams(location.search);
const wantSeed = params.has('seed') ? Number.parseInt(params.get('seed') ?? '', 10) : NaN;
if (params.has('new') || params.has('seed')) {
  clearSave();
  history.replaceState(null, '', location.pathname); // so a reload doesn't wipe the new game too
}
let state: GameState = loadGame() ?? newGame(Number.isFinite(wantSeed) ? wantSeed | 0 : (Date.now() & 0x7fffffff) | 1);

/** You are either on your feet (aboard or in a station) or sat at the helm flying. */
let mode: 'foot' | 'helm' = 'foot';
const walker = newWalker();
let auto = false;
/** Where the autopilot is flying to: the next stop on the course, fixed when it is engaged. */
let autoTo: PortId | null = null;
/** Set once the helm has warned about a short tank, so a second press casts off anyway. */
let warned = false;
/** The port we just left; its dock prompt stays hidden until we have cleared it. */
let leaving: PortId | null = null;
const keys = new Set<string>();

const con = new Console(document.getElementById('console') as HTMLDivElement, {
  state: () => state,
  changed: () => {
    saveGame(state);
    if (auto) autoTo = nextStop(state); // the course may have just changed under the autopilot
    warned = false;
  },
  closed: () => keys.clear(),
});

/* ---------- notices ---------- */

let notice: string[] = [];
let noticeUntil = 0;
function flash(lines: string | string[], seconds = 2.5): void {
  notice = typeof lines === 'string' ? [lines] : lines;
  noticeUntil = performance.now() + seconds * 1000;
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n).toLocaleString('en-US')}`;

/* ---------- docking and launching ---------- */

/** Housekeeping once the clamps are on, however we got here. */
function berthed(): void {
  const id = state.docked!;
  auto = false;
  mode = 'foot'; // you get up from the helm once the clamps are on
  keys.clear();
  saveGame(state);
  warned = false;
  flash([
    `Docked - ${port(state, id).name}`,
    ...state.report.map(l => (l.amount === undefined ? l.text : `${l.text} ${signed(l.amount)}`)),
    ...(state.target ? [`Stopover. Course still laid in for ${port(state, state.target).name}`] : []),
  ], 8);
}

function arrive(id: PortId): void {
  dock(state, id);
  berthed();
}

function takeHelm(): void {
  if (state.docked) {
    const from = state.docked;
    // Nobody should run dry by accident: say so once if the tank will not make the next stop.
    const gap = shortfall(state);
    if (gap && gap.short > 0 && state.ship.fuel >= 1 && !warned) {
      warned = true;
      return flash([
        `Tank won't reach ${port(state, gap.stop).name}`,
        `Needs ${gap.need} fuel, ${Math.floor(state.ship.fuel)} aboard`,
        '[E] again to cast off anyway',
      ], 6);
    }
    warned = false;
    const r = launch(state);
    if (!r.ok) return flash(r.msg);
    leaving = from;
    auto = false;
    saveGame(state);
    flash(r.msg);
  }
  mode = 'helm';
  keys.clear();
}

/* ---------- using things on foot ---------- */

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

const FLAVOUR: Partial<Record<Kind, string[]>> = {
  bunk: ['Not tired enough. Yet.', 'The blanket has seen three systems and one wash.'],
  galley: ["Coffee. Yesterday's, but coffee.", 'The mug says WORLD\'S OKAYEST CAPTAIN.'],
  engine: ["She's holding together.", 'It hums. Mostly in tune.'],
  plant: ['Still alive. Somehow.', 'You water it. It judges you less.'],
  shelf: ['Manuals, a deck of cards, somebody\'s harmonica.', 'A jar of bolts labelled SPARE. Spare what, nobody knows.'],
};

function promptFor(kind: Kind): string {
  switch (kind) {
    case 'seat': return state.docked ? '[E] Launch' : '[E] Take the helm';
    case 'terminal': return '[E] Ship computer';
    case 'airlock':
      if (walker.area === 'station') return '[E] Board your ship';
      return state.docked ? `[E] Airlock - ${port(state, state.docked).name}` : 'Airlock sealed';
    case 'jobs': return '[E] Ask about work';
    case 'fuel': return '[E] Dock office';
    case 'yard': return state.docked && port(state, state.docked).yard ? '[E] Shipyard counter' : 'Shipyard - shut';
    case 'bunk': return '[E] Bunk';
    case 'galley': return '[E] Coffee';
    case 'engine': return '[E] Check the engine';
    case 'plant': return '[E] Plant';
    case 'shelf': return '[E] Shelf';
  }
}

function use(): void {
  const target = reach(walker);
  if (!target) return;
  switch (target.kind) {
    case 'seat': return takeHelm();
    case 'terminal': return con.open(['nav', 'hold', 'log']);
    case 'airlock':
      if (walker.area === 'ship' && !state.docked) return flash('Sealed. Nothing out there but weather.');
      return crossAirlock(walker);
    case 'jobs': return con.open(['jobs', 'hold']);
    case 'fuel': return con.open(['port']);
    case 'yard': {
      if (port(state, state.docked!).yard) return con.open(['yard']);
      const here = state.docked!;
      const nearest = state.ports.filter(p => p.yard).sort((a, b) => charted(state, here, a.id).dist - charted(state, here, b.id).dist)[0];
      return flash(['No shipyard at this port', `Nearest is ${nearest.name}, in ${nearest.region}`], 4);
    }
    default: {
      const lines = FLAVOUR[target.kind];
      if (lines) flash(pick(lines), 3.5);
    }
  }
}

/* ---------- input ---------- */

function fit(): void {
  const k = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  const scale = k >= 2 ? Math.floor(k) : k; // whole-number scales keep the pixels square
  stage.style.width = `${VIEW_W * scale}px`;
  stage.style.height = `${VIEW_H * scale}px`;
}
addEventListener('resize', fit);
fit();

const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (con.isOpen) {
    if (con.key(e)) e.preventDefault();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (MOVE_KEYS.has(k)) {
    keys.add(k);
    if (mode === 'helm') auto = false;
  } else if (mode === 'foot') {
    if (k === 'e' || k === 'Enter' || k === ' ') use();
    else return;
  } else if (k === 'Tab') {
    keys.clear();
    con.open(['nav', 'hold', 'log']);
  } else if (k === 'x' || k === 'Escape') {
    mode = 'foot';
    keys.clear();
  } else if (k === 'q') {
    if (!state.target) flash('No course set - Tab opens the ship computer');
    else if (auto) auto = false;
    else {
      auto = true;
      autoTo = nextStop(state);
      if (autoTo && autoTo !== state.target) flash(`Autopilot: ${port(state, autoTo).name} first, on the way to ${port(state, state.target).name}`, 4);
    }
  } else if (k === 'e') {
    const id = dockable(state);
    if (id) arrive(id);
    else flash('Too far or too fast to dock');
  } else return;
  e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener('blur', () => keys.clear());

const held = (...names: string[]) => names.some(n => keys.has(n));
const axis = () => ({
  dx: (held('ArrowRight', 'd') ? 1 : 0) - (held('ArrowLeft', 'a') ? 1 : 0),
  dy: (held('ArrowDown', 's') ? 1 : 0) - (held('ArrowUp', 'w') ? 1 : 0),
});
const IDLE: FlightInput = { turn: 0, thrust: false, brake: false };

/* ---------- main loop ---------- */

let last = performance.now();
let sinceRefresh = 0;
function tick(now: number): void {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  let thrusting = false;

  // The ship keeps flying whether you are at the helm, at a terminal, or making coffee.
  if (!state.docked) {
    const atControls = mode === 'helm' && !con.isOpen;
    const a = axis();
    const input = auto && autoTo ? autopilot(state, autoTo)
      : atControls ? { turn: a.dx, thrust: a.dy < 0, brake: a.dy > 0 }
      : IDLE;
    thrusting = input.thrust && state.ship.fuel > 0;
    if (stepFlight(state, input, dt) === 'towed') berthed(); // the tow has already docked us
    else if (auto && autoTo && atDock(state, autoTo)) arrive(autoTo);
    sinceRefresh += dt;
    if (sinceRefresh > 1) {
      sinceRefresh = 0;
      con.refresh();
    }
  }

  const noticeLines = now < noticeUntil ? notice : [];
  if (mode === 'foot') {
    const env = { crates: cratesFor(holdTons(state), cargoMax(state)) };
    if (!con.isOpen) stepWalk(walker, axis(), dt, env);
    const target = reach(walker);
    footView.draw(walker, state, { dt, time: now / 1000, thrusting, mark: target });
    const place = walker.area === 'station' ? port(state, state.docked!).name
      : state.docked ? `Aboard, docked at ${port(state, state.docked).name}` : 'Aboard, under way';
    hud.update(state, {
      mode, autopilot: auto, place,
      prompt: noticeLines.length ? noticeLines : target ? [promptFor(target.kind)] : [],
      anchor: walkerOnScreen(walker),
    });
  } else {
    const near = dockable(state);
    if (near !== leaving) leaving = null;
    let prompt = noticeLines;
    if (!prompt.length) {
      if (near && !leaving) prompt = [`[E] Dock - ${port(state, near).name}`];
      else if (state.ship.fuel <= 0) prompt = ['Tank dry - drifting'];
    }
    flightView.draw(state, thrusting, dt, now / 1000);
    hud.update(state, { mode, autopilot: auto, place: 'At the helm', prompt });
  }
  hud.show(!con.isOpen);
}
function frame(now: number): void {
  tick(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // Handy in the browser console while tuning, and what the browser check (e2e/smoke.js) drives:
  // `spacedude.state`, `spacedude.walker`, `spacedude.route('hollow')` for the stops from here to a port,
  // and `spacedude.advance(30)` to run half a minute of game time at once.
  (window as unknown as Record<string, unknown>).spacedude = {
    get state() { return state; },
    walker,
    route: (to: PortId) => (state.docked ? planRoute(state, state.docked, to) : []),
    advance(seconds: number) {
      for (let t = 0; t < seconds; t += 0.05) tick(last + 50);
      last = performance.now(); // hand the clock back to the real frame loop
    },
  };
}
