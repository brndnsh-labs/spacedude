import '@fontsource/pixelify-sans';
import '@fontsource/vt323';
import './style.css';
import { FlightView, VIEW_H, VIEW_W } from './flight/render';
import { atDock, autopilot, dock, dockable, launch, newGame, stepFlight } from './sim/game';
import { clearSave, loadGame, saveGame } from './sim/save';
import type { FlightInput, GameState, PortId } from './sim/types';
import { port } from './sim/world';
import { Console } from './ui/console';
import { Hud } from './ui/hud';

const stage = document.getElementById('stage') as HTMLDivElement;
const view = new FlightView(document.getElementById('view') as HTMLCanvasElement);
const hud = new Hud(document.getElementById('hud') as HTMLDivElement);

// `?new` in the URL throws away the save and starts over.
if (new URLSearchParams(location.search).has('new')) {
  clearSave();
  history.replaceState(null, '', location.pathname); // so a reload doesn't wipe the new game too
}
let state: GameState = loadGame() ?? newGame((Date.now() & 0x7fffffff) | 1);

let auto = false;
/** The port we just left; its dock prompt stays hidden until we have cleared it. */
let leaving: PortId | null = null;
const keys = new Set<string>();

const con = new Console(document.getElementById('console') as HTMLDivElement, {
  state: () => state,
  launch() {
    const from = state.docked;
    const r = launch(state);
    if (r.ok) {
      leaving = from;
      auto = false;
      con.close();
      saveGame(state);
    }
    return r;
  },
  resume: () => con.close(),
  changed: () => saveGame(state),
});

function arrive(id: PortId, msg = ''): void {
  dock(state, id);
  auto = false;
  keys.clear();
  saveGame(state);
  con.open('port', msg);
}

function fit(): void {
  const k = Math.min(innerWidth / VIEW_W, innerHeight / VIEW_H);
  const scale = k >= 2 ? Math.floor(k) : k; // whole-number scales keep the pixels square
  stage.style.width = `${VIEW_W * scale}px`;
  stage.style.height = `${VIEW_H * scale}px`;
}
addEventListener('resize', fit);
fit();

const FLIGHT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);
let notice = '';
let noticeUntil = 0;
function flash(text: string): void {
  notice = text;
  noticeUntil = performance.now() + 2500;
}

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (con.isOpen) {
    if (con.key(e)) e.preventDefault();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (FLIGHT_KEYS.has(k)) {
    keys.add(k);
    auto = false;
  } else if (k === 'Tab' || k === 'Escape') {
    keys.clear();
    con.open();
  } else if (k === 'q') {
    if (state.target) auto = !auto;
    else flash('No course set - Tab opens the console');
  } else if (k === 'e') {
    const id = dockable(state);
    if (id) arrive(id);
    else flash('Too far or too fast to dock');
  } else return;
  e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
addEventListener('blur', () => keys.clear());

function manualInput(): FlightInput {
  const left = keys.has('ArrowLeft') || keys.has('a'), right = keys.has('ArrowRight') || keys.has('d');
  return {
    turn: (right ? 1 : 0) - (left ? 1 : 0),
    thrust: keys.has('ArrowUp') || keys.has('w'),
    brake: keys.has('ArrowDown') || keys.has('s'),
  };
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const flying = !state.docked && !con.isOpen;
  let thrusting = false;

  if (flying) {
    const input = auto && state.target ? autopilot(state, state.target) : manualInput();
    thrusting = input.thrust && state.ship.fuel > 0;
    if (stepFlight(state, input, dt) === 'towed') {
      arrive(state.docked!, 'Next time, watch the gauge.');
    } else if (auto && state.target && atDock(state, state.target)) {
      arrive(state.target);
    }
  }

  if (!state.docked) {
    const near = dockable(state);
    if (near !== leaving) leaving = null;
    let prompt = '';
    if (now < noticeUntil) prompt = notice;
    else if (near && !leaving) prompt = `[E] Dock - ${port(near).name}`;
    else if (state.ship.fuel <= 0) prompt = 'Tank dry - drifting';
    view.draw(state, thrusting, flying ? dt : 0, now / 1000);
    hud.update(state, { autopilot: auto, prompt });
  }
  hud.show(!state.docked && !con.isOpen);
  requestAnimationFrame(frame);
}

if (state.docked) con.open('port');
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // Handy in the browser console while tuning: `spacedude.state`.
  (window as unknown as Record<string, unknown>).spacedude = { get state() { return state; } };
}
