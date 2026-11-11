import type { Lane, Port, PortId } from './types';

/** Anything that carries a sector: a game state, or a freshly generated map. */
export interface Sector {
  ports: readonly Port[];
  lanes: readonly Lane[];
}

export const CORE_REGION = 'Halcyon Core';

/**
 * The Halcyon Core: the four hand-made ports every game starts among, and the pattern for each port type.
 * Positions are in flight-view pixels. Fuel is the biggest running cost, so pump prices are spread wide on
 * purpose: the mining camp is the place to brim the tank, and the relay charges for being the only pump around.
 * The rest of the sector is generated around these (see sector.ts).
 */
export const CORE: readonly Port[] = [
  {
    id: 'kestrel',
    name: 'Kestrel Station',
    type: 'ring',
    region: CORE_REGION,
    x: 0,
    y: 0,
    blurb: 'Ring station over Ossa. Customs is slow, the coffee is decent.',
    fuelPrice: 2.4,
    dockFee: 20,
    mix: [70, 25, 5],
    yard: true,
    look: 0,
  },
  {
    id: 'marrow',
    name: "Marrow's Rest",
    type: 'farm',
    region: CORE_REGION,
    x: 2400,
    y: -700,
    blurb: "Farm moon. Everyone knows everyone, and everyone's cargo.",
    fuelPrice: 2.8,
    dockFee: 10,
    mix: [60, 30, 10],
    yard: false,
    look: 0,
  },
  {
    id: 'hollow',
    name: 'Dry Hollow',
    type: 'mine',
    region: CORE_REGION,
    x: -900,
    y: 1900,
    blurb: 'Mining camp bolted to a rock. Pays in scrip when it can get away with it.',
    fuelPrice: 1.2,
    dockFee: 15,
    mix: [35, 45, 20],
    yard: true,
    look: 0,
  },
  {
    id: 'lantern',
    name: 'The Lantern',
    type: 'relay',
    region: CORE_REGION,
    x: 1900,
    y: 2300,
    blurb: "Relay beacon where the old charts end. Nobody asks what you're hauling.",
    fuelPrice: 3.6,
    dockFee: 5,
    mix: [15, 35, 50],
    yard: false,
    look: 0,
  },
];

export function port(s: Sector, id: PortId): Port {
  const p = s.ports.find(p => p.id === id);
  if (!p) throw new Error(`unknown port ${id}`);
  return p;
}

export function distance(s: Sector, a: PortId, b: PortId): number {
  const pa = port(s, a), pb = port(s, b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

/** The ports one charted lane away. */
export function neighbours(s: Sector, id: PortId): PortId[] {
  const out: PortId[] = [];
  for (const [a, b] of s.lanes) {
    if (a === id) out.push(b);
    else if (b === id) out.push(a);
  }
  return out;
}

export interface Charted {
  /** Length of the shortest way round by charted lanes. */
  dist: number;
  /** How many lanes that is: 1 for a neighbour. */
  hops: number;
}

const charts = new WeakMap<readonly Port[], Map<string, Charted>>();

/**
 * The charted way from a to b: what a stock ship has to fly, and so what freight rates and deadlines go by.
 * A ship with a bigger tank can cut the corner.
 */
export function charted(s: Sector, a: PortId, b: PortId): Charted {
  let table = charts.get(s.ports);
  if (!table) {
    table = new Map();
    const ids = s.ports.map(p => p.id), n = ids.length;
    const dist = ids.map((_, i) => ids.map((_, j) => (i === j ? 0 : Infinity)));
    const hops = ids.map((_, i) => ids.map((_, j) => (i === j ? 0 : Infinity)));
    for (const [p, q] of s.lanes) {
      const i = ids.indexOf(p), j = ids.indexOf(q);
      dist[i][j] = dist[j][i] = distance(s, p, q);
      hops[i][j] = hops[j][i] = 1;
    }
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (dist[i][k] + dist[k][j] < dist[i][j]) {
            dist[i][j] = dist[i][k] + dist[k][j];
            hops[i][j] = hops[i][k] + hops[k][j];
          }
        }
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) table.set(`${ids[i]}>${ids[j]}`, { dist: dist[i][j], hops: hops[i][j] });
    charts.set(s.ports, table);
  }
  const c = table.get(`${a}>${b}`);
  if (!c) throw new Error(`no chart for ${a} > ${b}`);
  return c;
}
