import { pick, rand, randInt, type HasSeed } from './rng';
import type { Lane, Port, PortType } from './types';
import { CORE, CORE_REGION, type Sector } from './world';

/**
 * Sector generation. Every game gets the four core ports plus a few outlying "reaches": clusters of two to
 * four generated ports, each a long haul from its neighbours. The map is rolled once from the game's seed and
 * then kept on the save, so it is a place you can learn.
 *
 * The one hard promise is the lanes: every port is joined to the rest by charted runs short enough for a stock
 * tank. Anything farther is a job for an aux tank, or for hopping port to port.
 */
export const SECTOR = {
  reaches: 3,
  /** Ports per reach, and how many generated ports a sector has in all. */
  reachMin: 2,
  reachMax: 4,
  newMin: 8,
  newMax: 10,
  /** Longest charted lane, in pixels. A full stock tank covers it with a little to spare (game.test.ts checks). */
  laneMax: 4800,
  /** Ports in different regions are never closer than this, so each region reads as its own place. */
  regionGap: 3000,
  /** How far a reach's ports sit from its centre, and the least room between two of them. */
  ringMin: 650,
  ringMax: 1350,
  portGap: 1000,
} as const;

interface TypeDef {
  label: string;
  fuelPrice: number;
  dockFee: number;
  mix: readonly [number, number, number];
  /** Chance a generated port of this type has a shipyard. */
  yard: number;
  names: readonly string[];
  blurbs: readonly string[];
}

/** `$` in a name pattern is a place name, `@` a describing word. The numbers are the core port of each type. */
export const PORT_TYPES: Record<PortType, TypeDef> = {
  ring: {
    label: 'Ring station',
    fuelPrice: 2.4,
    dockFee: 20,
    mix: [70, 25, 5],
    yard: 1,
    names: ['$ Station', '$ Ring', '$ High', 'Port $'],
    blurbs: [
      'Company ring, all chrome and queue numbers. The noodles are worth the docking fee.',
      'Old transit ring. Half the lights work, all of the gossip does.',
      'Customs ring with a fresh coat of paint over the same old rust.',
      'A ring station that still thinks it is a capital. The fees agree.',
      'Trade ring. Three banks, two chapels and one decent mechanic.',
    ],
  },
  farm: {
    label: 'Farm moon',
    fuelPrice: 2.8,
    dockFee: 10,
    mix: [60, 30, 10],
    yard: 0.35,
    names: ["$'s Rest", '$ Grange', '$ Landing', 'New $', "$'s Acre"],
    blurbs: [
      'Orchard moon. They pay on time and send you off with a pie.',
      'Grain domes and church bells. Dull as dirt, and as honest.',
      'Homestead cluster. The harvest fair is the only traffic jam for a light-minute.',
      "Greenhouse colony. Don't track mud on the dock; they will know.",
      'Dairy moon. Yes, really. No, you may not see the cows.',
    ],
  },
  mine: {
    label: 'Mining camp',
    fuelPrice: 1.2,
    dockFee: 15,
    mix: [35, 45, 20],
    yard: 0.5,
    names: ['@ Hollow', '$ Dig', "$'s Claim", '@ Seam', '$ Cut'],
    blurbs: [
      'Ice quarry with a dock bolted on. Fuel is cheap, conversation is not.',
      'Strip mine run by three cousins and a grudge.',
      'Ore camp. Everything here is owed to somebody else.',
      'Company dig, minus the company. The crews kept working anyway.',
      'Deep-bore camp. They refine their own fuel and it mostly burns clean.',
    ],
  },
  relay: {
    label: 'Relay beacon',
    fuelPrice: 3.6,
    dockFee: 5,
    mix: [15, 35, 50],
    yard: 0,
    names: ['The %', '$ Relay', '$ Light', 'The %'],
    blurbs: [
      'Signal buoy with a bar attached. Or the other way round.',
      'Listening post nobody admits to owning.',
      'One lamp, one keeper, and a guest book full of false names.',
      'Relay mast at the end of a long quiet. Fuel comes in cans.',
      'A beacon that was meant to be temporary, forty years ago.',
    ],
  },
};

const PLACES = [
  'Tessaly', 'Orrin', 'Vesper', 'Calder', 'Brannock', 'Idris', 'Wren', 'Mora', 'Juno', 'Hale', 'Sable', 'Corvin', 'Pike',
  'Ansel', 'Thorne', 'Larkin', 'Odell', 'Quince', 'Rooke', 'Maren', 'Sorrel', 'Dunmore', 'Ketter', 'Ashby', 'Finch',
  'Garrow', 'Halloran', 'Ibsen', 'Lowry', 'Tamsin', 'Wick', 'Yarrow', 'Bellamy', 'Cask', 'Emmet',
];
const WORDS = ['Deep', 'Cold', 'Red', 'Black', 'Long', 'Hard', 'Iron', 'Salt', 'Tin', 'Pale', 'Low', 'Blind'];
const LAMPS = ['Candle', 'Porchlight', 'Watchfire', 'Nightlight', 'Ember', 'Lamp', 'Taper', 'Hearth', 'Match'];
const REGIONS = [
  'Tessaly Reach', 'The Orrin Drift', "Calder's Verge", 'Vesper Shoals', 'The Brannock Deep', 'Wren Narrows',
  'The Sable Marches', 'Juno Banks', 'The Long Quiet', 'Pilgrim Gap', 'The Tallow Reach', 'Idris Fold',
];

const TYPES: readonly PortType[] = ['ring', 'farm', 'mine', 'relay'];

/** Draw from a pool without repeats: removes and returns one entry. */
function take<T>(r: HasSeed, pool: T[]): T {
  return pool.splice(Math.floor(rand(r) * pool.length), 1)[0];
}

function shuffled<T>(r: HasSeed, xs: readonly T[]): T[] {
  const pool = [...xs], out: T[] = [];
  while (pool.length) out.push(take(r, pool));
  return out;
}

const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

interface Pools {
  places: string[];
  words: string[];
  lamps: string[];
  regions: string[];
  blurbs: Record<PortType, string[]>;
  used: Set<string>;
}

function newPools(): Pools {
  return {
    places: [...PLACES], words: [...WORDS], lamps: [...LAMPS], regions: [...REGIONS],
    blurbs: { ring: [...PORT_TYPES.ring.blurbs], farm: [...PORT_TYPES.farm.blurbs], mine: [...PORT_TYPES.mine.blurbs], relay: [...PORT_TYPES.relay.blurbs] },
    used: new Set(CORE.map(p => p.name)),
  };
}

function nameFor(r: HasSeed, type: PortType, pools: Pools): string {
  for (;;) {
    const pattern = pick(r, PORT_TYPES[type].names);
    const name = pattern.includes('$') ? pattern.replace('$', take(r, pools.places))
      : pattern.includes('@') ? pattern.replace('@', take(r, pools.words))
      : pattern.replace('%', take(r, pools.lamps));
    if (!pools.used.has(name)) {
      pools.used.add(name);
      return name;
    }
  }
}

function makePort(r: HasSeed, id: string, type: PortType, region: string, x: number, y: number, pools: Pools): Port {
  const def = PORT_TYPES[type];
  const mix = def.mix.map(w => Math.max(5, w + randInt(r, -8, 8))) as [number, number, number];
  return {
    id,
    name: nameFor(r, type, pools),
    type,
    region,
    x: Math.round(x),
    y: Math.round(y),
    blurb: take(r, pools.blurbs[type]),
    // Out past the core everything costs a little more to ship in, fuel included.
    fuelPrice: Math.round(def.fuelPrice * (0.9 + rand(r) * 0.4) * 10) / 10,
    dockFee: Math.max(5, def.dockFee + pick(r, [-5, 0, 0, 5])),
    mix,
    yard: rand(r) < def.yard,
    look: randInt(r, 1, 999_999),
  };
}

/** Lanes: every pair of ports within a region, plus the shortest hop between any two regions close enough. */
export function chartLanes(ports: readonly Port[]): Lane[] {
  const lanes: Lane[] = [];
  const regions = [...new Set(ports.map(p => p.region))];
  for (let i = 0; i < ports.length; i++) {
    for (let j = i + 1; j < ports.length; j++) {
      if (ports[i].region === ports[j].region) lanes.push([ports[i].id, ports[j].id]);
    }
  }
  for (let a = 0; a < regions.length; a++) {
    for (let b = a + 1; b < regions.length; b++) {
      let best: Lane | null = null, bestD: number = SECTOR.laneMax;
      for (const p of ports) {
        if (p.region !== regions[a]) continue;
        for (const q of ports) {
          if (q.region !== regions[b]) continue;
          const d = gap(p, q);
          if (d <= bestD) { best = [p.id, q.id]; bestD = d; }
        }
      }
      if (best) lanes.push(best);
    }
  }
  return lanes;
}

/** Try to lay out one reach hanging off `parent`. Returns the port positions, or null if this roll does not fit. */
function placeReach(r: HasSeed, n: number, parent: readonly Port[], all: readonly Port[]): { x: number; y: number }[] | null {
  const anchor = pick(r, parent);
  const bearing = rand(r) * Math.PI * 2, far = 3800 + rand(r) * 1800;
  const cx = anchor.x + Math.cos(bearing) * far, cy = anchor.y + Math.sin(bearing) * far;
  const spin = rand(r) * Math.PI * 2;
  const spots: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2 + (rand(r) - 0.5) * 0.7;
    const ring = SECTOR.ringMin + rand(r) * (SECTOR.ringMax - SECTOR.ringMin);
    spots.push({ x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring });
  }
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (gap(spots[i], spots[j]) < SECTOR.portGap) return null;
  if (spots.some(s => all.some(p => gap(s, p) < SECTOR.regionGap))) return null;
  // There has to be a lane home: some port here within a stock tank of some port in the parent region.
  if (!spots.some(s => parent.some(p => gap(s, p) <= SECTOR.laneMax - 50))) return null;
  return spots;
}

function build(r: HasSeed): Sector | null {
  const pools = newPools();
  const ports: Port[] = CORE.map(p => ({ ...p }));
  const regions: Port[][] = [ports.slice()];

  let sizes: number[];
  do sizes = Array.from({ length: SECTOR.reaches }, () => randInt(r, SECTOR.reachMin, SECTOR.reachMax));
  while (sizes.reduce((a, b) => a + b, 0) < SECTOR.newMin || sizes.reduce((a, b) => a + b, 0) > SECTOR.newMax);

  for (const n of sizes) {
    // Most reaches hang off the core; now and then one lies out beyond another reach.
    const parent = regions.length > 1 && rand(r) < 0.3 ? regions[randInt(r, 1, regions.length - 1)] : regions[0];
    let spots: { x: number; y: number }[] | null = null;
    for (let tries = 0; tries < 60 && !spots; tries++) spots = placeReach(r, n, parent, ports);
    if (!spots) return null;
    const region = take(r, pools.regions);
    const types = shuffled(r, TYPES);
    const made = spots.map((s, i) => makePort(r, `p${ports.length + i}`, types[i], region, s.x, s.y, pools));
    ports.push(...made);
    regions.push(made);
  }
  // Upgrades should never be a whole sector away: every game has a yard somewhere past the core.
  if (!ports.some(p => p.region !== CORE_REGION && p.yard)) ports[CORE.length].yard = true;
  return { ports, lanes: chartLanes(ports) };
}

/** A fixed layout that is known to be sound, for the rare seed where random placement keeps failing. */
export function fallbackSector(r: HasSeed): Sector {
  const pools = newPools();
  const ports: Port[] = CORE.map(p => ({ ...p }));
  for (const [cx, cy] of [[-4300, -1900], [6400, 1200], [300, 6600]]) {
    const region = take(r, pools.regions);
    const types = shuffled(r, TYPES);
    [90, 210, 330].forEach((deg, i) => {
      const a = (deg * Math.PI) / 180;
      ports.push(makePort(r, `p${ports.length}`, types[i], region, cx + Math.cos(a) * 900, cy + Math.sin(a) * 900, pools));
    });
  }
  if (!ports.some(p => p.region !== CORE_REGION && p.yard)) ports[CORE.length].yard = true;
  return { ports, lanes: chartLanes(ports) };
}

/** Everything wrong with a sector's layout; empty if it is sound. */
export function sectorProblems(s: Sector): string[] {
  const out: string[] = [];
  const ids = s.ports.map(p => p.id), names = s.ports.map(p => p.name);
  if (new Set(ids).size !== ids.length) out.push('duplicate port ids');
  if (new Set(names).size !== names.length) out.push('duplicate port names');
  for (let i = 0; i < s.ports.length; i++) {
    for (let j = i + 1; j < s.ports.length; j++) {
      const a = s.ports[i], b = s.ports[j], d = gap(a, b);
      if (d < (a.region === b.region ? SECTOR.portGap : SECTOR.regionGap)) out.push(`${a.id} and ${b.id} are only ${Math.round(d)} apart`);
    }
  }
  const at = (id: string) => s.ports.find(p => p.id === id)!;
  for (const [a, b] of s.lanes) {
    if (gap(at(a), at(b)) > SECTOR.laneMax) out.push(`lane ${a}-${b} is ${Math.round(gap(at(a), at(b)))} long`);
  }
  const seen = new Set([ids[0]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [a, b] of s.lanes) {
      if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
    }
  }
  if (seen.size !== ids.length) out.push(`${ids.length - seen.size} ports are off the chart`);
  return out;
}

export function generateSector(r: HasSeed): Sector {
  for (let attempt = 0; attempt < 40; attempt++) {
    const s = build(r);
    if (s && !sectorProblems(s).length) return s;
  }
  return fallbackSector(r);
}
