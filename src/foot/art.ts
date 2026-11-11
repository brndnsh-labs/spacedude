/**
 * Pixel art for walking around: floor and wall tiles, furniture, and people.
 * Tiles are drawn with small procedures; people are ASCII grids with palette maps.
 * First-pass art in the dusty-pixel style, meant to be refined later.
 */
import { hueFor, shiftHex } from '../flight/pixels';
import type { PortType } from '../sim/types';
import { TILE } from './world';

type G = CanvasRenderingContext2D;

const px = (g: G, c: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

function hash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const OL = '#15121f';

export interface Theme {
  wallTop: string;
  wallFace: string;
  wallHi: string;
  wallBase: string;
  trim: string;
  /** Concourse floor, two alternating shades and the grout between them. */
  floorA: string;
  floorB: string;
  grout: string;
}

export const SHIP_THEME: Theme = {
  wallTop: '#2b2636', wallFace: '#655a72', wallHi: '#7d7388', wallBase: '#3d3550', trim: '#b5683f',
  floorA: '#8a6a52', floorB: '#8a6a52', grout: '#75573f',
};

export const STATION_THEMES = {
  ring: { wallTop: '#262a38', wallFace: '#5f6a7a', wallHi: '#7b8797', wallBase: '#3a4250', trim: '#eab668', floorA: '#9c8672', floorB: '#8f7a68', grout: '#7d6a5a' },
  farm: { wallTop: '#252c28', wallFace: '#5c6b58', wallHi: '#788a72', wallBase: '#3a4638', trim: '#8fc47a', floorA: '#a08e6c', floorB: '#93815f', grout: '#7f6e50' },
  mine: { wallTop: '#2c2423', wallFace: '#6b5248', wallHi: '#876a5e', wallBase: '#45342e', trim: '#e07a5f', floorA: '#7d6e66', floorB: '#72635c', grout: '#5f524c' },
  relay: { wallTop: '#241f33', wallFace: '#4f4668', wallHi: '#6a6086', wallBase: '#332c47', trim: '#c79bd1', floorA: '#75708a', floorB: '#6a657f', grout: '#57526b' },
} satisfies Record<PortType, Theme>;

const THEME_HUES = [-48, 34, -26, 58, -62, 22];

/** A station's colours: its type's palette, turned to the port's own hue (the core ports are shown as drawn). */
export function stationTheme(type: PortType, look: number): Theme {
  const base: Theme = STATION_THEMES[type], deg = hueFor(look, THEME_HUES);
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, shiftHex(v as string, deg)])) as unknown as Theme;
}

/* ---------- floors ---------- */

export type FloorKind = 'wood' | 'metal' | 'bridge' | 'grate' | 'tile' | 'back';

export function drawFloor(g: G, kind: FloorKind, ox: number, oy: number, tx: number, ty: number, th: Theme): void {
  switch (kind) {
    case 'wood':
      px(g, '#8a6a52', ox, oy, TILE, TILE);
      for (let b = 0; b < 4; b++) {
        px(g, '#75573f', ox, oy + b * 4 + 3, TILE, 1);
        px(g, '#75573f', ox + ((tx * 3 + ty + b) % 2 ? 5 : 12), oy + b * 4, 1, 3);
      }
      for (let i = 0; i < 5; i++) {
        const hx = Math.floor(hash(tx * 16 + i, ty) * 16), hy = Math.floor(hash(tx, ty * 16 + i) * 16);
        if (hy % 4 !== 3) px(g, '#9a7a60', ox + hx, oy + hy);
      }
      break;
    case 'metal':
      px(g, '#5d5f70', ox, oy, TILE, TILE);
      px(g, '#4b4d5e', ox, oy, TILE, 1);
      px(g, '#4b4d5e', ox, oy, 1, TILE);
      for (let y = 2; y < TILE; y += 2) for (let x = 2; x < TILE; x += 2) if ((x + y) % 4 === 0) px(g, '#6c6e80', ox + x, oy + y);
      break;
    case 'bridge':
      px(g, '#3f5560', ox, oy, TILE, TILE);
      px(g, '#35474f', ox, oy, TILE, 1);
      px(g, '#35474f', ox, oy, 1, TILE);
      for (let y = 2; y < TILE; y += 4) for (let x = 2; x < TILE; x += 4) px(g, '#4d6875', ox + x, oy + y);
      break;
    case 'grate':
      px(g, '#3d3640', ox, oy, TILE, TILE);
      for (let x = 1; x < TILE; x += 3) px(g, '#2f2932', ox + x, oy, 1, TILE);
      px(g, '#4a4250', ox, oy + 7, TILE, 1);
      break;
    case 'tile':
      px(g, (tx + ty) % 2 ? th.floorA : th.floorB, ox, oy, TILE, TILE);
      px(g, th.grout, ox, oy, TILE, 1);
      px(g, th.grout, ox, oy, 1, TILE);
      if (hash(tx, ty) > 0.7) px(g, th.grout, ox + 4 + Math.floor(hash(ty, tx) * 8), oy + 5 + Math.floor(hash(tx + 9, ty) * 7), 2, 1);
      break;
    case 'back':
      px(g, '#4a3f45', ox, oy, TILE, TILE);
      px(g, '#3d3439', ox, oy + 7, TILE, 1);
      px(g, '#3d3439', ox, oy + 15, TILE, 1);
      break;
  }
}

/* ---------- walls ---------- */

/** A wall tile. `face` is true when there is floor directly below, so its front side shows. */
export function drawWall(g: G, ox: number, oy: number, face: boolean, th: Theme, window = false): void {
  px(g, th.wallTop, ox, oy, TILE, TILE);
  if (!face) {
    px(g, th.wallBase, ox + 3, oy + 3);
    px(g, th.wallBase, ox + 12, oy + 11);
    return;
  }
  px(g, th.wallFace, ox, oy + 4, TILE, 10);
  px(g, th.wallHi, ox, oy + 4, TILE, 1);
  px(g, th.trim, ox, oy + 10, TILE, 1);
  px(g, th.wallBase, ox, oy + 14, TILE, 2);
  px(g, th.wallBase, ox, oy + 5, 1, 9);
  if (window) {
    px(g, OL, ox + 1, oy + 5, 14, 8);
    px(g, '#1a1f38', ox + 2, oy + 6, 12, 6);
    px(g, '#f2e9dc', ox + 5, oy + 8);
    px(g, '#8fa3a8', ox + 10, oy + 7);
    px(g, '#8fa3a8', ox + 8, oy + 10);
    px(g, '#3d5a80', ox + 3, oy + 8);
    px(g, '#3d5a80', ox + 4, oy + 7);
    px(g, '#3d5a80', ox + 5, oy + 6);
  }
}

/* ---------- furniture and fittings (each fills one 16x16 tile over its floor) ---------- */

function box(g: G, ox: number, oy: number, x: number, y: number, w: number, h: number, fill: string): void {
  px(g, OL, ox + x, oy + y, w, h);
  px(g, fill, ox + x + 1, oy + y + 1, w - 2, h - 2);
}

export const OBJECTS: Record<string, (g: G, ox: number, oy: number) => void> = {
  // engine block
  e(g, ox, oy) {
    box(g, ox, oy, 0, 0, 16, 16, '#555a72');
    px(g, '#8a8fa3', ox + 1, oy + 1, 14, 1);
    px(g, '#2f2932', ox + 4, oy + 4, 8, 8);
    px(g, '#a3523f', ox + 5, oy + 5, 6, 6);
    px(g, '#cf8048', ox + 6, oy + 6, 4, 4);
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(g, '#c3c6d4', ox + x, oy + y);
  },
  // helm console along the nose
  t(g, ox, oy) {
    box(g, ox, oy, 0, 0, 16, 16, '#3a3448');
    px(g, '#0b0803', ox + 2, oy + 2, 8, 12);
    px(g, '#ffb000', ox + 3, oy + 4, 5, 1);
    px(g, '#b37b00', ox + 3, oy + 7, 6, 1);
    px(g, '#ffb000', ox + 3, oy + 10, 3, 1);
    px(g, '#7fd1c7', ox + 12, oy + 3, 2, 2);
    px(g, '#e07a5f', ox + 12, oy + 7, 2, 2);
    px(g, '#eab668', ox + 12, oy + 11, 2, 2);
  },
  // the ship's computer
  T(g, ox, oy) {
    box(g, ox, oy, 1, 0, 14, 11, '#4a4048');
    px(g, '#0b0803', ox + 3, oy + 2, 10, 7);
    px(g, '#ffb000', ox + 4, oy + 3, 6, 1);
    px(g, '#b37b00', ox + 4, oy + 5, 8, 1);
    px(g, '#ffb000', ox + 4, oy + 7, 4, 1);
    box(g, ox, oy, 2, 11, 12, 5, '#2f2932');
    for (let x = 4; x < 12; x += 2) px(g, '#8a8fa3', ox + x, oy + 13);
  },
  // pilot seat, facing the nose (right)
  s(g, ox, oy) {
    box(g, ox, oy, 2, 2, 12, 12, '#7d3a36');
    px(g, '#a3523f', ox + 6, oy + 4, 7, 8);
    px(g, '#5e2b29', ox + 3, oy + 3, 3, 10);
    px(g, '#3a3448', ox + 6, oy + 2, 7, 1);
    px(g, '#3a3448', ox + 6, oy + 13, 7, 1);
  },
  // bunk: pillow end, then blanket end
  b(g, ox, oy) {
    box(g, ox, oy, 1, 1, 14, 15, '#5e3d2b');
    px(g, '#d9cfb8', ox + 3, oy + 3, 10, 13);
    px(g, '#f2e9dc', ox + 4, oy + 4, 8, 5);
    px(g, '#c9bfa8', ox + 4, oy + 8, 8, 1);
    px(g, OL, ox + 1, oy + 15, 14, 1);
    px(g, '#5e3d2b', ox + 2, oy + 15, 1, 1);
    px(g, '#5e3d2b', ox + 13, oy + 15, 1, 1);
    px(g, '#a3523f', ox + 3, oy + 13, 10, 3);
    px(g, '#c8553d', ox + 3, oy + 13, 10, 1);
  },
  B(g, ox, oy) {
    box(g, ox, oy, 1, -1, 14, 15, '#5e3d2b');
    px(g, '#a3523f', ox + 3, oy, 10, 11);
    px(g, '#8f3b33', ox + 3, oy + 4, 10, 1);
    px(g, '#8f3b33', ox + 3, oy + 8, 10, 1);
    px(g, '#5e3d2b', ox + 2, oy, 12, 0);
  },
  // shelf with a few belongings
  k(g, ox, oy) {
    box(g, ox, oy, 1, 1, 14, 14, '#6b5a4a');
    px(g, '#4f4236', ox + 2, oy + 7, 12, 1);
    px(g, '#c8553d', ox + 3, oy + 3, 2, 4);
    px(g, '#3f8f8a', ox + 5, oy + 4, 2, 3);
    px(g, '#eab668', ox + 7, oy + 3, 1, 4);
    px(g, '#d9cfb8', ox + 10, oy + 5, 3, 2);
    px(g, '#8a8fa3', ox + 3, oy + 10, 4, 3);
    px(g, '#a8794a', ox + 9, oy + 9, 4, 4);
  },
  // galley counter with yesterday's coffee
  g(g, ox, oy) {
    box(g, ox, oy, 1, 1, 14, 14, '#8a8fa3');
    px(g, '#c3c6d4', ox + 2, oy + 2, 12, 1);
    box(g, ox, oy, 8, 3, 5, 7, '#2a2430');
    px(g, '#a3523f', ox + 9, oy + 6, 3, 3);
    px(g, '#8a8fa3', ox + 13, oy + 5, 1, 3);
    box(g, ox, oy, 3, 8, 4, 5, '#f2e9dc');
    px(g, '#6b3340', ox + 4, oy + 9, 2, 1);
  },
  // potted plant
  p(g, ox, oy) {
    box(g, ox, oy, 5, 10, 6, 6, '#a3523f');
    px(g, '#cf8048', ox + 6, oy + 11, 4, 1);
    px(g, OL, ox + 3, oy + 2, 10, 9);
    px(g, '#3f8f6a', ox + 4, oy + 3, 8, 7);
    px(g, '#24504a', ox + 4, oy + 7, 3, 3);
    px(g, '#8fc47a', ox + 6, oy + 3, 3, 3);
    px(g, '#8fc47a', ox + 9, oy + 6, 2, 2);
    px(g, OL, ox + 2, oy + 5, 1, 3);
    px(g, '#3f8f6a', ox + 3, oy + 5, 1, 3);
    px(g, OL, ox + 13, oy + 4, 1, 3);
    px(g, '#3f8f6a', ox + 12, oy + 4, 1, 3);
  },
  // airlock hatch set into the lower wall
  A(g, ox, oy) {
    px(g, '#2b2636', ox, oy, TILE, TILE);
    box(g, ox, oy, 1, 0, 14, 14, '#8a8fa3');
    px(g, '#555a72', ox + 3, oy + 2, 10, 10);
    px(g, '#3a3448', ox + 7, oy + 2, 2, 10);
    for (let x = 1; x < 15; x += 4) {
      px(g, '#eab668', ox + x, oy, 2, 1);
      px(g, OL, ox + x + 2, oy, 2, 1);
    }
  },
  // station counter and its three service points
  '='(g, ox, oy) {
    px(g, OL, ox, oy + 2, TILE, 14);
    px(g, '#a8794a', ox, oy + 3, TILE, 9);
    px(g, '#c9a27a', ox, oy + 3, TILE, 1);
    px(g, '#8a5f38', ox, oy + 7, TILE, 1);
    px(g, '#75573f', ox, oy + 12, TILE, 3);
  },
  j(g, ox, oy) {
    OBJECTS['='](g, ox, oy);
    box(g, ox, oy, 3, 4, 7, 6, '#f2e9dc'); // the job ledger
    px(g, '#8a8fa3', ox + 5, oy + 6, 3, 1);
    px(g, '#8a8fa3', ox + 5, oy + 8, 2, 1);
    px(g, '#eab668', ox + 11, oy + 5, 3, 3); // bell
    px(g, '#fff3c4', ox + 12, oy + 5);
  },
  f(g, ox, oy) {
    OBJECTS['='](g, ox, oy);
    box(g, ox, oy, 4, 3, 8, 8, '#3f8f8a'); // fuel gauge
    px(g, '#0b0803', ox + 6, oy + 5, 4, 4);
    px(g, '#7fd1c7', ox + 6, oy + 7, 4, 2);
    px(g, '#e07a5f', ox + 13, oy + 5, 2, 2);
  },
  y(g, ox, oy) {
    OBJECTS['='](g, ox, oy);
    box(g, ox, oy, 2, 5, 9, 6, '#cf8048'); // toolbox
    px(g, '#a3523f', ox + 3, oy + 8, 7, 1);
    px(g, '#c3c6d4', ox + 5, oy + 4, 3, 1);
    px(g, '#c3c6d4', ox + 12, oy + 5, 1, 5); // wrench
    px(g, '#c3c6d4', ox + 11, oy + 4, 3, 2);
  },
  // a counter with its shutter down: no shipyard at this port
  Y(g, ox, oy) {
    OBJECTS['='](g, ox, oy);
    px(g, OL, ox + 1, oy - 6, 14, 10);
    for (let y = -5; y < 3; y += 2) {
      px(g, '#8a8fa3', ox + 2, oy + y, 12, 1);
      px(g, '#555a72', ox + 2, oy + y + 1, 12, 1);
    }
    px(g, '#e07a5f', ox + 7, oy + 5, 2, 2); // padlock
  },
  // round bar table with stools
  o(g, ox, oy) {
    px(g, OL, ox + 3, oy + 2, 10, 12);
    px(g, OL, ox + 2, oy + 4, 12, 8);
    px(g, '#8a5f38', ox + 4, oy + 3, 8, 10);
    px(g, '#8a5f38', ox + 3, oy + 5, 10, 6);
    px(g, '#a8794a', ox + 4, oy + 4, 7, 5);
    px(g, '#f2e9dc', ox + 9, oy + 9, 2, 2);
  },
};

/** A cargo crate, drawn over a crate slot when the hold has cargo. */
export function drawCrate(g: G, ox: number, oy: number, variant: number): void {
  const wood = variant % 3 === 2 ? '#8a8fa3' : '#a8794a', dark = variant % 3 === 2 ? '#5f647c' : '#8a5f38';
  box(g, ox, oy, 1, 1, 14, 14, wood);
  px(g, dark, ox + 2, oy + 5, 12, 1);
  px(g, dark, ox + 2, oy + 10, 12, 1);
  px(g, dark, ox + 5, oy + 2, 1, 12);
  px(g, dark, ox + 10, oy + 2, 1, 12);
  px(g, variant % 2 ? '#c8553d' : '#eab668', ox + 7, oy + 7, 2, 2);
}

/** Painted corner marks for an empty crate slot. */
export function drawCrateSlot(g: G, ox: number, oy: number): void {
  for (const [x, y] of [[1, 1], [12, 1], [1, 12], [12, 12]]) {
    px(g, '#b08a4a', ox + x, oy + y, 3, 1);
    px(g, '#b08a4a', ox + (x === 1 ? 1 : 14), oy + y, 1, 3);
  }
}

/* ---------- people ---------- */

export const PERSON_W = 12, PERSON_H = 16;

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

export type PersonSprites = Record<'up' | 'down' | 'left' | 'right', HTMLCanvasElement[]>;

/** Four walk frames for each facing; frame 0 is standing still. */
export function makePerson(o: Outfit): PersonSprites {
  const frames = (head: string[], body: string[], legs: string[][], flip = false) =>
    legs.map(l => personFrame([...head, ...body, ...l], o, flip));
  return {
    down: frames(HEAD_DOWN, BODY_DOWN, LEGS_FRONT),
    up: frames(HEAD_UP, BODY_UP, LEGS_FRONT),
    right: frames(HEAD_SIDE, BODY_SIDE, LEGS_SIDE),
    left: frames(HEAD_SIDE, BODY_SIDE, LEGS_SIDE, true),
  };
}
