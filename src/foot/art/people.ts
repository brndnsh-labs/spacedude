/**
 * People: the player and the folk behind station counters. First-pass art drawn for the old 320x180 frame,
 * as ASCII grids with palette maps. The contract the renderer relies on is in types.ts.
 */
import { LEGACY_SCALE } from '../../view';
import type { PersonSprites } from './types';

type G = CanvasRenderingContext2D;
const px = (g: G, c: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};
const OL = '#15121f';

const PERSON_W = 12, PERSON_H = 16;

/** How a person sprite sits on the map: its size, where the feet are within it, and its scale (see types.ts). */
export const PERSON = { w: PERSON_W, h: PERSON_H, footX: 6, footY: 13, scale: LEGACY_SCALE } as const;

const HEAD_DOWN = ['....oooo....', '...ohhhho...', '..ohhhhhho..', '..ohssssho..', '..osesseso..', '..osssssso..', '...osssso...'];
const HEAD_UP = ['....oooo....', '...ohhhho...', '..ohhhhhho..', '..ohhhhhho..', '..ohhhhhho..', '..oshhhhso..', '...osssso...'];
const HEAD_SIDE = ['....oooo....', '...ohhhho...', '..ohhhhhho..', '..ohhhssso..', '..ohhsseso..', '..ohhsssso..', '...ohssso...'];
const BODY_DOWN = ['..occttcco..', '.occcttccco.', '.ocCcttcCco.', '.oscCccCcso.', '..occcccco..', '..ocCccCco..'];
const BODY_UP = ['..occcccco..', '.occcccccco.', '.ocCccccCco.', '.oscCccCcso.', '..occcccco..', '..ocCccCco..'];
const BODY_SIDE = ['...occcto...', '..occccto...', '..ocCccco...', '..ocCscco...', '..occccco...', '..ocCccco...'];
const LEGS_FRONT = [
  ['...oppppo...', '...opoopo...', '...oboobo...'],
  ['...oppppo...', '...opoobo...', '...obo......'],
  ['...oppppo...', '...opoopo...', '...oboobo...'],
  ['...oppppo...', '...oboopo...', '......obo...'],
];
const LEGS_SIDE = [
  ['....oppo....', '....oppo....', '....obbbo...'],
  ['...oppppo...', '..opo.opo...', '..obo.obbo..'],
  ['....oppo....', '....oppo....', '....obbbo...'],
  ['...oppppo...', '..opo.opo...', '..obo.obbo..'],
];

export interface Outfit { hair: string; skin: string; coat: string; coatDark: string; shirt: string; pants: string }

/** Who there is to draw. The renderer asks for these four by name. */
export const OUTFITS = {
  player: { hair: '#3a2a2a', skin: '#e0b08a', coat: '#8a5a3c', coatDark: '#5e3d2b', shirt: '#d9cfb8', pants: '#4a4a5e' },
  broker: { hair: '#c9c2b8', skin: '#c98f6b', coat: '#3d3550', coatDark: '#2b2636', shirt: '#f2e9dc', pants: '#2a2430' },
  clerk: { hair: '#2a2430', skin: '#a8754f', coat: '#3f8f8a', coatDark: '#2f6f6a', shirt: '#eab668', pants: '#35474f' },
  yardBoss: { hair: '#b5683f', skin: '#e0b08a', coat: '#cf8048', coatDark: '#a3523f', shirt: '#555a72', pants: '#5e3d2b' },
} satisfies Record<string, Outfit>;

function personFrame(rows: string[], o: Outfit, flip: boolean): HTMLCanvasElement {
  const pal: Record<string, string> = {
    o: OL, h: o.hair, s: o.skin, e: '#2a2430', c: o.coat, C: o.coatDark, t: o.shirt, p: o.pants, b: '#2a2430',
  };
  const cv = document.createElement('canvas');
  cv.width = PERSON_W;
  cv.height = PERSON_H;
  const g = cv.getContext('2d')!;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (pal[ch]) px(g, pal[ch], flip ? PERSON_W - 1 - x : x, y);
  }));
  return cv;
}

/** Frame 0 is standing still; the rest are the walk cycle. */
export function makePerson(o: Outfit): PersonSprites {
  const frames = (head: string[], body: string[], legs: string[][], flip = false) => {
    const f = legs.map(l => personFrame([...head, ...body, ...l], o, flip));
    return [...f, f[0]]; // standing, then the cycle: step, pass, step, pass
  };
  return {
    down: frames(HEAD_DOWN, BODY_DOWN, LEGS_FRONT),
    up: frames(HEAD_UP, BODY_UP, LEGS_FRONT),
    right: frames(HEAD_SIDE, BODY_SIDE, LEGS_SIDE),
    left: frames(HEAD_SIDE, BODY_SIDE, LEGS_SIDE, true),
  };
}
