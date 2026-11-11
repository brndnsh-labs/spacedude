/**
 * What moves on the freighter's deck, or depends on the game: cargo crates, the engines' fire, the airlock's
 * lamp, the computer's screen, and small signs of life. Everything costly is baked to canvases once by
 * `makeLive`; each frame only blits those and fills a few rectangles.
 */
import { INK, PAL, SIGNAL } from '../../art/palette';
import { CRATE_SLOTS } from '../world';
import { T, alpha, at, glow, hash, hazard, isOpen, makeCanvas, px, shadow, type G } from './shipKit';
import {
  AIRLOCK_LAMP, BRIDGE_LAMPS, CORE, ENGINE_LAMPS, FANS, GRILLES, LANTERN, NAV_LIGHTS, POT, SCOPES, SCREEN, STRING_LAMPS, disc,
} from './shipThings';
import type { LiveFrame } from './types';

const { steel, bone, wood, rust, amber, teal, night, violet, phosphor } = PAL;

/* ---------- crates ---------- */

interface Crate {
  canvas: HTMLCanvasElement;
  /** How far it stands above its tile's top edge. */
  rise: number;
  /** For a sealed container: where its status light is within the canvas. */
  light?: { x: number; y: number };
}

/** Start a crate 22 wide and `rise` taller than a tile: the outline, and the shadow at its foot. */
function crateCanvas(rise: number): [HTMLCanvasElement, G, number] {
  const [cv, g] = makeCanvas(T, T + rise);
  px(g, INK, 1, 0, 22, 23 + rise);
  shadow(g, 0.4, 1, 23 + rise, 22, 1);
  return [cv, g, 13 + rise];
}

/** A timber crate: battens round planks, a brace across the front, a stencil. `pale` is new pine. */
function woodCrate(rise: number, pale: boolean): Crate {
  const [canvas, g, h] = crateCanvas(rise);
  const top = pale ? [wood[7], '#d4b488', wood[6]] : [wood[6], '#b98f62', wood[5]];
  const side = pale ? [wood[6], '#b98f62', wood[5], wood[4]] : [wood[5], '#96704f', wood[4], wood[3]];
  // lid: three planks between two battens
  px(g, top[1], 2, 1, 20, 8);
  px(g, top[0], 2, 1, 20, 1);
  px(g, top[2], 2, 3, 20, 1);
  px(g, top[2], 2, 6, 20, 1);
  for (const x of [2, 19]) {
    px(g, top[0], x, 1, 3, 8);
    px(g, top[2], x + (x === 2 ? 2 : 0), 2, 1, 7);
    px(g, wood[2], x + 1, 2);
    px(g, wood[2], x + 1, 7);
  }
  // front: planks, battens top, bottom and sides, and a brace
  px(g, side[2], 2, 9, 20, h);
  for (const x of [8, 12, 16]) px(g, side[3], x, 12, 1, h - 6);
  for (let i = 0; i < 12; i++) {
    const y = 9 + h - 4 - Math.round((i * (h - 7)) / 11);
    px(g, side[0], 6 + i, y, 1, 2);
    px(g, side[3], 6 + i, y + 2, 1, 1);
  }
  px(g, side[1], 2, 9, 20, 3);
  px(g, side[0], 2, 9, 20, 1);
  px(g, side[3], 2, 12, 20, 1);
  px(g, side[2], 2, 9 + h - 3, 20, 3);
  px(g, side[1], 2, 9 + h - 3, 20, 1);
  px(g, wood[2], 2, 9 + h - 1, 20, 1);
  px(g, side[2], 2, 9, 3, h);
  px(g, side[3], 2, 9, 1, h);
  px(g, side[1], 19, 9, 3, h);
  px(g, side[0], 21, 9, 1, h - 1);
  for (const [x, y] of [[3, 10], [20, 10], [3, 9 + h - 2], [20, 9 + h - 2]]) px(g, wood[1], x, y);
  if (pale) { // a shipping label
    px(g, bone[6], 9, 14, 7, 4);
    px(g, rust[4], 10, 15, 5, 1);
    px(g, steel[4], 10, 16, 3, 1);
  } else { // a stencilled "this way up"
    for (const [x, y, w] of [[16, 9 + h - 8, 1], [15, 9 + h - 7, 3], [16, 9 + h - 6, 1], [16, 9 + h - 5, 1]]) px(g, rust[3], x, y, w, 1);
  }
  return { canvas, rise };
}

/** A steel transit case: a lid with a recessed handle, corner guards, a brass latch and a band of paint. */
function steelCase(rise: number, band: 'hazard' | 'rust'): Crate {
  const [canvas, g, h] = crateCanvas(rise);
  px(g, steel[6], 2, 1, 20, 8);
  px(g, steel[7], 2, 1, 20, 1);
  px(g, steel[5], 2, 7, 20, 2);
  for (const x of [5, 18]) px(g, steel[4], x, 2, 1, 5);
  px(g, steel[3], 9, 3, 6, 3);
  px(g, steel[2], 9, 3, 6, 1);
  px(g, steel[8], 10, 5, 4, 1);
  px(g, steel[4], 2, 9, 20, h);
  px(g, steel[6], 2, 9, 20, 1);
  px(g, steel[5], 2, 10, 20, 1);
  px(g, steel[3], 2, 9 + h - 3, 20, 3);
  px(g, steel[2], 2, 9 + h - 1, 20, 1);
  if (band === 'hazard') hazard(g, 4, 15, 16, 3, steel[1]);
  else {
    px(g, rust[4], 4, 15, 16, 3);
    px(g, rust[5], 4, 15, 16, 1);
  }
  for (const x of [2, 20]) {
    px(g, steel[x === 2 ? 2 : 6], x, 9, 2, h);
    px(g, steel[7], x, 9, 2, 1);
    px(g, steel[7], x, 9 + h - 4, 2, 1);
  }
  px(g, INK, 10, 9, 4, 5);
  px(g, amber[4], 11, 9, 2, 4);
  px(g, amber[6], 11, 9, 2, 1);
  return { canvas, rise };
}

/** A sealed container: dark composite with a status light that hums along its front. */
function sealedCrate(rise: number): Crate {
  const [canvas, g, h] = crateCanvas(rise);
  px(g, violet[4], 2, 1, 20, 8);
  px(g, violet[5], 2, 1, 20, 1);
  px(g, violet[5], 21, 1, 1, 8);
  px(g, violet[2], 6, 2, 12, 6);
  px(g, violet[3], 7, 3, 10, 4);
  px(g, teal[3], 11, 4, 2, 2);
  px(g, teal[5], 12, 4);
  px(g, violet[3], 2, 9, 20, h);
  px(g, violet[5], 2, 9, 20, 1);
  px(g, violet[2], 2, 10, 2, h - 1);
  px(g, violet[4], 20, 10, 2, h - 1);
  px(g, night[4], 2, 9 + h - 2, 20, 2);
  px(g, INK, 5, 12, 14, 4);
  px(g, teal[1], 6, 13, 12, 2);
  for (let j = 18; j < 9 + h - 3; j += 2) px(g, night[2], 6, j, 9, 1);
  for (const [x, y, w] of [[17, 17, 1], [16, 18, 3], [16, 19, 3]]) px(g, amber[4], x, y, w, 1); // a warning mark
  return { canvas, rise, light: { x: 6, y: 13 } };
}

/** Two drums strapped together: one rust red, one sea green. */
function drums(rise: number): Crate {
  const [canvas, g, h] = crateCanvas(rise);
  for (const [x0, r] of [[2, rust], [12, teal]] as const) {
    const body = r === rust ? [rust[2], rust[3], rust[4], rust[4], rust[5], rust[5], rust[6], rust[5], rust[4], rust[3]]
      : [teal[1], teal[1], teal[2], teal[2], teal[3], teal[3], teal[4], teal[3], teal[2], teal[1]];
    body.forEach((c, i) => px(g, c, x0 + i, 4, 1, 5 + h));
    for (const j of [10, 9 + h - 5]) {
      px(g, body[1], x0, j, 10, 1);
      px(g, body[6], x0 + 2, j + 1, 7, 1);
    }
    px(g, body[0], x0, 9 + h - 1, 10, 1);
    // the lid, seen from above
    px(g, body[4], x0, 2, 10, 4);
    px(g, body[6], x0 + 1, 1, 8, 1);
    px(g, body[5], x0 + 1, 2, 8, 3);
    px(g, body[2], x0 + 1, 5, 8, 1);
    px(g, steel[7], x0 + 6, 2, 2, 1);
    px(g, steel[2], x0 + 6, 3, 2, 1);
    px(g, INK, x0, 1);
    px(g, INK, x0 + 9, 1);
  }
  px(g, INK, 11, 1, 1, 21 + rise);
  px(g, bone[4], 2, 14, 20, 1); // the strap
  px(g, bone[2], 2, 15, 20, 1);
  px(g, INK, 11, 14, 1, 2);
  return { canvas, rise };
}

/**
 * One crate per slot, in the order the bay fills. Only a crate with nothing walkable behind it may stand
 * taller than its tile (people are drawn over crates), so the two bays beside the gangway get the low ones.
 */
function makeCrates(): Crate[] {
  return [woodCrate(3, false), steelCase(0, 'hazard'), sealedCrate(5), woodCrate(2, true), steelCase(0, 'rust'), woodCrate(0, false), drums(5), sealedCrate(3)];
}

/* ---------- engines ---------- */

/** Where the engine room's baked glow layers sit on the deck. */
const ENGINE_BOX = { x: 40, y: 24, w: 86, h: 148 };

/** The drive's fire at one of four strengths: two for idling, two for a burn. Baked whole, blitted in one go. */
function engineLayer(level: number): HTMLCanvasElement {
  const [cv, g] = makeCanvas(ENGINE_BOX.w, ENGINE_BOX.h);
  g.translate(-ENGINE_BOX.x, -ENGINE_BOX.y);
  const body = [amber[2], amber[3], amber[4], amber[5]][level], hot = [amber[3], amber[4], amber[6], '#ffffff'][level];
  if (level >= 2) { // a burn lights the whole room
    const strength = level === 3 ? 1 : 0.8;
    glow(g, amber[4], 100, 108, 30, 70, 0.26 * strength, 4);
    glow(g, amber[5], CORE.x, CORE.y, 30, 30, 0.42 * strength, 4);
    for (const f of FANS) glow(g, amber[5], f.x, f.y, 15, 13, 0.3 * strength);
    for (const gr of GRILLES) glow(g, amber[5], gr.x + 7, gr.y + 8, 20, 16, 0.36 * strength);
  }
  disc(g, body, CORE.x, CORE.y, CORE.r);
  disc(g, alpha(INK, 0.22), CORE.x - 1, CORE.y + 1, CORE.r - 2);
  disc(g, body, CORE.x + 1, CORE.y - 1, CORE.r - 3);
  disc(g, hot, CORE.x + 1, CORE.y - 1, level >= 2 ? 3 : 2);
  px(g, alpha('#ffffff', 0.8), CORE.x + 2, CORE.y - 5, 2, 1);
  px(g, alpha('#ffffff', 0.8), CORE.x + 4, CORE.y - 4, 1, 2);
  for (const f of FANS) {
    for (const j of [-3, 0, 3]) px(g, body, f.x - (j ? 3 : 4), f.y + j, j ? 7 : 9, 1);
    px(g, hot, f.x - 2, f.y, 5, 1);
    px(g, steel[3], f.x, f.y - 4, 1, 9);
  }
  for (const gr of GRILLES) {
    for (let i = 0; i < 4; i++) {
      px(g, body, gr.x + i * 4, gr.y, 2, 5);
      px(g, hot, gr.x + i * 4, gr.y + 2, 2, 2);
    }
  }
  for (const l of ENGINE_LAMPS) px(g, hot, l.x, l.y, 2, 2);
  return cv;
}

/** The three bells: where each one's mouth is (the exhaust runs from there to the canvas edge) and its half height. */
const BELLS = [{ y: 108, x: 6, half: 12 }, { y: 74, x: 9, half: 6 }, { y: 142, x: 9, half: 6 }];
const FLAME = ['#8a4238', amber[3], amber[4], amber[6]];

/** One frame of exhaust for a bell: a plume that narrows aft, hottest in the middle. Three frames flicker. */
function flame(len: number, half: number, frame: number): HTMLCanvasElement {
  const [cv, g] = makeCanvas(len, half * 2 + 1);
  for (let x = 0; x < len; x++) {
    // how far from the bell's mouth, 0 to 1, and the plume's half height there
    const far = (len - 1 - x) / len, reach = half - 1 - Math.round(far * half * 0.7) - ((x + frame) % 3 === 0 ? 1 : 0);
    for (let dy = -reach; dy <= reach; dy++) {
      const t = Math.abs(dy) / (reach + 1) + far * 0.5 + (frame === 1 ? 0.08 : 0);
      px(g, FLAME[t < 0.3 ? 3 : t < 0.55 ? 2 : t < 0.85 ? 1 : 0], x, half + dy);
    }
  }
  return cv;
}

/* ---------- the computer's screen ---------- */

/** Lines of amber text, twice over so a window on it can scroll round without a seam. */
function screenText(): HTMLCanvasElement {
  const rows = 24, [cv, g] = makeCanvas(SCREEN.w, rows * 2);
  for (let r = 0; r < rows * 2; r += 2) {
    const n = (r / 2) % (rows / 2), len = 3 + Math.floor(hash(n, 31) * 8), indent = hash(n, 37) < 0.3 ? 2 : 0;
    if (hash(n, 41) < 0.15) continue; // a blank line now and then
    for (let i = 0; i < len && indent + 1 + i < SCREEN.w - 1; i++) {
      if (hash(n * 13 + i, 43) < 0.2) continue; // gaps between words
      px(g, hash(n, 47) < 0.25 ? phosphor[5] : phosphor[4], indent + 1 + i, r);
    }
  }
  return cv;
}

/* ---------- putting it together ---------- */

const WHITE = '#ffffff';
const STEAM = [0.5, 0.42, 0.34, 0.26, 0.18, 0.1].map(a => alpha(WHITE, a));
const STEAM_DRIFT = [0, 1, 1, 0, -1, -1, 0, 1];
const LAMP_HALO = { on: alpha(SIGNAL.green, 0.3), off: alpha(SIGNAL.red, 0.3) };
const NAV_HALO = NAV_LIGHTS.map(l => alpha(l.c, 0.35));
const STRING_HALO = STRING_LAMPS.map(l => alpha(l.c, 0.3));
const SWEEP = [alpha(teal[6], 0.9), alpha(teal[5], 0.5), alpha(teal[4], 0.3)];
const HUM = [teal[3], teal[4], teal[5], teal[6], teal[5], teal[4]];

/** Bake what live needs and return the per-frame painter. */
export function makeLive(): (g: G, f: LiveFrame) => void {
  const crates = makeCrates(), fire = [0, 1, 2, 3].map(engineLayer), text = screenText();
  const flames = BELLS.map(b => [0, 1, 2].map(n => flame(b.x, b.half, n)));
  const slotIndex = (x: number, y: number) => CRATE_SLOTS.findIndex(s => s.x === x && s.y === y);
  /** For each slot: whether the tile below it is open deck, and which slot (if any) that tile is. */
  const below = CRATE_SLOTS.map(s => ({ open: isOpen(at(s.x, s.y + 1)), slot: slotIndex(s.x, s.y + 1) }));

  return (g, f) => {
    const t = f.time;

    // --- cargo: each crate, and the shade it throws on open deck below it ---
    const filled = Math.min(f.crates, crates.length, CRATE_SLOTS.length);
    for (let i = 0; i < filled; i++) {
      const s = CRATE_SLOTS[i], c = crates[i], x = s.x * T, y = s.y * T;
      g.drawImage(c.canvas, x, y - c.rise);
      if (c.light) { // the sealed ones hum: a light runs along the strip
        const at = Math.floor(t * 6 + i) % 12;
        px(g, HUM[Math.floor(t * 3 + i) % HUM.length], x + c.light.x, y - c.rise + c.light.y, 12, 2);
        px(g, teal[6], x + c.light.x + at, y - c.rise + c.light.y, 2, 2);
      }
      const b = below[i];
      if (b.open && (b.slot < 0 || b.slot >= filled)) {
        shadow(g, 0.34, x, y + T, T, 2);
        shadow(g, 0.16, x, y + T + 2, T, 2);
      }
    }

    // --- engines: idling they breathe, burning they flicker and light the room ---
    const level = f.thrusting ? 2 + (Math.floor(t * 14) % 3 === 0 ? 0 : 1) : Math.sin(t * 2.2) > 0.3 ? 1 : 0;
    g.drawImage(fire[level], ENGINE_BOX.x, ENGINE_BOX.y);
    if (f.thrusting) {
      const flick = Math.floor(t * 16) % 3;
      BELLS.forEach((b, i) => {
        g.drawImage(flames[i][(flick + i) % 3], 0, b.y - b.half);
        px(g, amber[5], b.x, b.y - b.half - 1, 1, b.half * 2 + 3); // the bell's rim, lit from inside
      });
    }

    // --- the airlock's lamp: green when there is a station outside, red when it is space ---
    const lamp = f.docked ? SIGNAL.green : SIGNAL.red;
    const blink = f.docked || Math.floor(t * 2) % 2 === 0;
    px(g, f.docked ? LAMP_HALO.on : LAMP_HALO.off, AIRLOCK_LAMP.x - 1, AIRLOCK_LAMP.y - 1, 6, 4);
    px(g, blink ? lamp : rust[3], AIRLOCK_LAMP.x, AIRLOCK_LAMP.y, 4, 2);
    if (blink) px(g, WHITE, AIRLOCK_LAMP.x + 1, AIRLOCK_LAMP.y, 1, 1);

    // --- the ship computer: its log scrolls, and a cursor waits at the prompt ---
    const scroll = (Math.floor(t / 0.6) * 2) % (text.height / 2);
    g.drawImage(text, 0, scroll, SCREEN.w, SCREEN.h - 2, SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h - 2);
    px(g, phosphor[4], SCREEN.x + 1, SCREEN.y + SCREEN.h - 2, 1, 1);
    if (Math.floor(t * 2.5) % 2) px(g, phosphor[5], SCREEN.x + 3, SCREEN.y + SCREEN.h - 2, 2, 1);

    // --- the bridge: lamps blink, the scopes sweep ---
    for (const l of BRIDGE_LAMPS) if ((t + l.x * 0.37) % l.period < l.duty * l.period) px(g, l.c, l.x, l.y, 2, 2);
    for (const s of SCOPES) {
      const a = t * 1.7 + s.x;
      for (let k = 0; k < 3; k++) {
        const cos = Math.cos(a - k * 0.35), sin = Math.sin(a - k * 0.35);
        g.fillStyle = SWEEP[k];
        for (let d = 1; d <= s.r - 1; d++) g.fillRect(Math.round(s.x + cos * d - 0.5), Math.round(s.y + sin * d - 0.5), 1, 1);
      }
    }

    // --- the cabin: the string of lamps twinkles, the lantern's flame wavers, the coffee steams ---
    STRING_LAMPS.forEach((l, i) => {
      if (hash(Math.floor(t * 1.5), i) < 0.12) return;
      px(g, STRING_HALO[i], l.x - 1, l.y - 1, 4, 4);
      px(g, l.c, l.x, l.y, 2, 2);
    });
    const waver = Math.floor(t * 5) % 3;
    px(g, amber[4], LANTERN.x, LANTERN.y + 1, 3, 3);
    px(g, amber[6], LANTERN.x + (waver === 2 ? 0 : 1), LANTERN.y + (waver ? 1 : 0), waver === 2 ? 2 : 1, 3);
    const step = Math.floor(t * 4);
    for (let k = 0; k < STEAM.length; k++) {
      px(g, STEAM[k], POT.x + STEAM_DRIFT[(k + step) % STEAM_DRIFT.length], POT.y - k * 2 - (step % 2), 1, 2);
    }

    // --- outside: running lights, red to port and green to starboard ---
    if (t % 1.6 < 0.25) {
      NAV_LIGHTS.forEach((l, i) => {
        px(g, NAV_HALO[i], l.x - 1, l.y - 1, 4, 4);
        px(g, l.c, l.x, l.y, 2, 2);
      });
    }
  };
}
