import { fuelFor, fuelMax, inRange, topSpeed } from './game';
import type { GameState, Port, PortId } from './types';
import { port } from './world';

/**
 * Route finding for the nav computer. A course can be laid in for anywhere, but the ship can only fly legs its
 * tank covers, so a far port is reached by way of others. A stock ship ends up following the charted lanes;
 * a bigger tank cuts corners.
 */

/** What a stopover is worth avoiding, in pixels of extra flying: the docking fee, the parking and the pump. */
const STOP_COST = 700;

interface Table {
  key: string;
  ids: PortId[];
  cost: number[][];
  next: number[][];
}

const tables = new WeakMap<readonly Port[], Table>();

function table(s: GameState): Table {
  const key = `${fuelMax(s)}|${topSpeed(s)}`;
  let t = tables.get(s.ports);
  if (t && t.key === key) return t;
  const ids = s.ports.map(p => p.id), n = ids.length;
  const cost = ids.map(() => ids.map(() => Infinity)), next = ids.map(() => ids.map(() => -1));
  for (let i = 0; i < n; i++) {
    cost[i][i] = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = Math.hypot(s.ports[i].x - s.ports[j].x, s.ports[i].y - s.ports[j].y);
      if (!inRange(s, d)) continue;
      cost[i][j] = d + STOP_COST;
      next[i][j] = j;
    }
  }
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (cost[i][k] + cost[k][j] < cost[i][j]) {
          cost[i][j] = cost[i][k] + cost[k][j];
          next[i][j] = next[i][k];
        }
      }
    }
  }
  t = { key, ids, cost, next };
  tables.set(s.ports, t);
  return t;
}

/**
 * The stops from one port to another, ending at `to`, flying only legs a full tank covers.
 * Empty if you are already there; just `[to]` when it is in range (or when there is no way round at all).
 */
export function planRoute(s: GameState, from: PortId, to: PortId): PortId[] {
  if (from === to) return [];
  const t = table(s), j = t.ids.indexOf(to);
  let i = t.ids.indexOf(from);
  if (t.next[i][j] < 0) return [to];
  const out: PortId[] = [];
  while (i !== j) {
    i = t.next[i][j];
    out.push(t.ids[i]);
  }
  return out;
}

/** The legs of that route, with their lengths. */
export function routeLegs(s: GameState, from: PortId, to: PortId): { to: PortId; dist: number }[] {
  let at = port(s, from);
  return planRoute(s, from, to).map(id => {
    const p = port(s, id), dist = Math.hypot(p.x - at.x, p.y - at.y);
    at = p;
    return { to: id, dist };
  });
}

/**
 * Where to point the ship next for the course laid in. Docked, that is the first stop of the route (the pump is
 * right there, so the plan assumes a full tank). In flight it goes by the fuel actually aboard: straight to the
 * target if that will do, otherwise the best stop on the way. With nothing in reach it just says the target.
 */
export function nextStop(s: GameState): PortId | null {
  if (!s.target) return null;
  if (s.docked) return planRoute(s, s.docked, s.target)[0] ?? null;
  const t = table(s), j = t.ids.indexOf(s.target);
  let best: PortId | null = null, bestCost = Infinity;
  s.ports.forEach((p, i) => {
    const d = Math.hypot(p.x - s.ship.x, p.y - s.ship.y);
    if (fuelFor(s, d) > s.ship.fuel) return;
    const cost = i === j ? d : d + STOP_COST + t.cost[i][j];
    if (cost < bestCost) { best = p.id; bestCost = cost; }
  });
  return best ?? s.target;
}

/**
 * Docked with a course laid in: how much more fuel the leg to the next stop needs than is aboard.
 * Zero means good to go. This is what the helm warns about before casting off.
 */
export function shortfall(s: GameState): { stop: PortId; need: number; short: number } | null {
  const stop = s.docked ? nextStop(s) : null;
  if (!s.docked || !stop) return null;
  const a = port(s, s.docked), b = port(s, stop);
  const need = fuelFor(s, Math.hypot(a.x - b.x, a.y - b.y));
  return { stop, need, short: Math.max(0, need - s.ship.fuel) };
}
