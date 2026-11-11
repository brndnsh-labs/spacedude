/**
 * Bot players for the balance harness. Each is a caricature of a way people play;
 * together they bracket what the economy has to survive. None of this ships in the game.
 */
import { TUNING, UPGRADES, cargoMax, expectedPay, fuelFor, fuelMax, holdTons, topSpeed, upgradeCost } from './game';
import type { UpgradeId } from './game';
import type { Bot, Dockside } from './harness';
import { planRoute, routeLegs } from './nav';
import { rand } from './rng';
import type { GameState, Job, PortId } from './types';
import { distance, neighbours, port } from './world';

/** Seconds the autopilot spends getting up to speed and parking, on top of distance / top speed (measured). */
const LEG_OVERHEAD_S = 5.4;
export const legDays = (s: GameState, dist: number) => (dist / topSpeed(s) + LEG_OVERHEAD_S) / TUNING.secondsPerDay;

const avgFuelPrice = (s: GameState) => s.ports.reduce((a, p) => a + p.fuelPrice, 0) / s.ports.length;

const others = (s: GameState, here: PortId) => s.ports.filter(p => p.id !== here).map(p => p.id);
const nearest = (s: GameState, here: PortId, ids: readonly PortId[]) =>
  [...ids].sort((a, b) => distance(s, here, a) - distance(s, here, b))[0];
const free = (s: GameState) => cargoMax(s) - holdTons(s);
/** The first stop on the way to `goal`: the goal itself when the tank reaches, otherwise a port on the way. */
const hop = (s: GameState, goal: PortId) => planRoute(s, s.docked!, goal)[0] ?? goal;

/**
 * A prudent captain does not set out on a run of several lanes without the money to get there:
 * a next-door job is always fine, a long haul only when cash in hand covers the fuel, fees and crew on the way.
 */
function withinMeans(s: GameState, j: Job): boolean {
  const legs = routeLegs(s, s.docked!, j.to);
  if (legs.length <= 1) return true;
  const cost = legs.reduce((a, l) => a + fuelFor(s, l.dist) * avgFuelPrice(s) + port(s, l.to).dockFee + legDays(s, l.dist) * TUNING.upkeepPerDay, 0);
  return cost <= s.credits;
}

/** Take jobs in the given order, skipping any that will not fit. */
function load(d: Dockside, jobs: readonly Job[]): void {
  for (const j of jobs) if (j.tons <= free(d.state)) d.accept(j.id);
}

/** Buy the cheapest upgrade going whenever it leaves `reserve` credits in hand. */
function shop(d: Dockside, reserve: number, allowed: boolean): void {
  if (!allowed) return;
  for (;;) {
    const options = UPGRADES
      .map(u => ({ id: u.id as UpgradeId, cost: upgradeCost(d.state, u.id) }))
      .filter((u): u is { id: UpgradeId; cost: number } => u.cost !== null && d.state.credits - u.cost >= reserve)
      .sort((a, b) => a.cost - b.cost);
    if (!options.length || !d.upgrade(options[0].id)) return;
  }
}

/**
 * Buy fuel the way a penny-pincher would: brim the tank at the cheapest pump for a lane in any direction,
 * carry enough past a dearer next stop to skip buying there, and otherwise take what the leg needs.
 */
function thriftyFuel(d: Dockside, next: PortId): void {
  const s = d.state, here = s.docked!, price = port(s, here).fuelPrice;
  const leg = fuelFor(s, distance(s, here, next)) + 6;
  let want = leg;
  if (neighbours(s, here).every(id => port(s, id).fuelPrice >= price)) want = fuelMax(s);
  else if (port(s, next).fuelPrice > price) {
    want = leg + Math.max(...neighbours(s, next).filter(id => id !== here).map(id => fuelFor(s, distance(s, next, id))), 0);
  }
  const buy = Math.min(want, fuelMax(s)) - s.ship.fuel;
  if (buy > 0) d.fuel(buy);
}

/** Fill the tank, except at a pump dearer than most, where it is enough to cover the next leg with a fat reserve. */
function carefulFuel(d: Dockside, next: PortId): void {
  const s = d.state, here = s.docked!;
  if (port(s, here).fuelPrice <= avgFuelPrice(s)) {
    d.fuel('fill');
    return;
  }
  const buy = Math.min(fuelFor(s, distance(s, here, next)) + 20, fuelMax(s)) - s.ship.fuel;
  if (buy > 0) d.fuel(buy);
}

/**
 * The best-paying load on the board that is all bound for one port. With cargo already aboard (a stopover on
 * a long run), only ports still ahead on the way count: nobody sensible picks up work for the other direction.
 */
function bestBundle(s: GameState, kinds: (j: Job) => boolean): Job[] {
  const here = s.docked!;
  let best: { jobs: Job[]; pay: number } | null = null;
  for (const to of s.hold.length ? planRoute(s, here, s.hold[0].to) : others(s, here)) {
    let room = free(s);
    const jobs: Job[] = [];
    for (const j of s.boards[here].filter(j => kinds(j) && j.to === to).sort((a, b) => b.pay - a.pay)) {
      if (j.tons <= room) {
        jobs.push(j);
        room -= j.tons;
      }
    }
    const pay = jobs.reduce((a, j) => a + j.pay, 0);
    if (jobs.length && (!best || pay > best.pay)) best = { jobs, pay };
  }
  return best?.jobs ?? [];
}

/** Legit work only, one destination per trip, never short of fuel. The player the game should be kind to. */
export function cautious(buys = true): Bot {
  return {
    name: 'cautious',
    about: 'legit only, one destination a trip, keeps the tank well filled, no long hauls it cannot pay the fuel for',
    visit(d) {
      const s = d.state, here = s.docked!;
      shop(d, 150, buys);
      load(d, bestBundle(s, j => j.kind === 'legit' && withinMeans(s, j)));
      const next = hop(s, s.hold[0]?.to ?? nearest(s, here, others(s, here)));
      carefulFuel(d, next);
      return next;
    },
  };
}

/** Grabs whatever pays best per ton, wherever it is going, then drops it off nearest-first. */
export function greedy(buys = true): Bot {
  return {
    name: 'greedy',
    about: 'best pay per ton of any kind, any destination; delivers nearest first',
    visit(d) {
      const s = d.state, here = s.docked!;
      shop(d, 50, buys);
      load(d, [...s.boards[here]].sort((a, b) => b.pay / b.tons - a.pay / a.tons));
      const next = hop(s, nearest(s, here, s.hold.length ? s.hold.map(j => j.to) : others(s, here)));
      thriftyFuel(d, next);
      return next;
    },
  };
}

/** Takes every shady job going. With none on the board it hauls the best other load rather than fly empty. */
export function shady(buys = true): Bot {
  return {
    name: 'shady',
    about: 'every shady job that fits, nearest drop first; any other single-port load when there is no shady work',
    visit(d) {
      const s = d.state, here = s.docked!;
      shop(d, 100, buys);
      load(d, s.boards[here].filter(j => j.kind === 'shady').sort((a, b) => b.pay - a.pay));
      if (!s.hold.length) load(d, bestBundle(s, () => true));
      const next = hop(s, nearest(s, here, s.hold.length ? s.hold.map(j => j.to) : others(s, here)));
      carefulFuel(d, next);
      return next;
    },
  };
}

/** Only ever carries shady cargo; flies empty to where the shady work is when there is none. */
export function shadyOnly(buys = true): Bot {
  return {
    name: 'shady-only',
    about: 'shady cargo or nothing; flies empty to the shadiest board a lane away when this one has none',
    visit(d) {
      const s = d.state, here = s.docked!;
      shop(d, 100, buys);
      load(d, s.boards[here].filter(j => j.kind === 'shady').sort((a, b) => b.pay - a.pay));
      const shadiness = (id: PortId) => port(s, id).mix[2] / port(s, id).mix.reduce((a, b) => a + b, 0);
      const next = s.hold.length ? hop(s, nearest(s, here, s.hold.map(j => j.to)))
        : neighbours(s, here).sort((a, b) => shadiness(b) - shadiness(a))[0];
      carefulFuel(d, next);
      return next;
    },
  };
}

interface Plan {
  take: Job[];
  route: PortId[];
  rate: number;
}

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p]));
}

/** Expected profit per game-day of carrying `jobs` around `route`, counting fuel, fees, upkeep and lateness. */
function routeRate(s: GameState, jobs: readonly Job[], route: readonly PortId[]): number {
  let at = s.docked!, t = s.day + s.dayFrac, profit = 0;
  const fuelPrice = avgFuelPrice(s), aboard = new Set(jobs);
  for (const stop of route) {
    // A far stop is flown in legs the tank can cover, and anything bound for a port on the way gets dropped there.
    for (const leg of routeLegs(s, at, stop)) {
      const days = legDays(s, leg.dist);
      t += days;
      profit -= fuelFor(s, leg.dist) * fuelPrice + port(s, leg.to).dockFee + days * TUNING.upkeepPerDay;
      for (const j of aboard) {
        if (j.to !== leg.to) continue;
        profit += expectedPay(j, Math.floor(t) > j.due);
        aboard.delete(j);
      }
    }
    at = stop;
  }
  return profit / (t - s.day - s.dayFrac);
}

/** Every order of a few stops; with many, just nearest-first (trying every order of six ports is 720 routes a load). */
function orders(s: GameState, stops: readonly PortId[]): PortId[][] {
  if (stops.length <= 4) return permutations(stops);
  const left = [...stops], route: PortId[] = [];
  let at = s.docked!;
  while (left.length) {
    at = nearest(s, at, left);
    route.push(left.splice(left.indexOf(at), 1)[0]);
  }
  return [route];
}

function bestPlan(s: GameState, kinds: (j: Job) => boolean): Plan | null {
  const board = s.boards[s.docked!].filter(kinds).slice(0, 8);
  let best: Plan | null = null;
  for (let mask = 0; mask < 1 << board.length; mask++) {
    const take = board.filter((_, i) => mask & (1 << i));
    if (take.reduce((a, j) => a + j.tons, 0) > free(s)) continue;
    const jobs = [...s.hold, ...take];
    if (!jobs.length) continue;
    for (const route of orders(s, [...new Set(jobs.map(j => j.to))])) {
      const rate = routeRate(s, jobs, route);
      if (!best || rate > best.rate) best = { take, route, rate };
    }
  }
  return best;
}

/**
 * Plans multi-drop routes: weighs every load the board offers against every order of stops,
 * using the real expected payouts, and takes the best profit per day. The strongest honest play.
 */
export function planner(buys = true): Bot {
  return {
    name: 'planner',
    about: 'any kind of work; picks the load and stop order with the best expected profit per day',
    visit(d) {
      const s = d.state, here = s.docked!;
      shop(d, 100, buys);
      const plan = bestPlan(s, () => true);
      if (plan) load(d, plan.take);
      const next = hop(s, plan?.route[0] ?? nearest(s, here, others(s, here)));
      thriftyFuel(d, next);
      return next;
    },
  };
}

/** The same route planner, restricted to legit work: honest play at its sharpest. */
export function legitPlanner(buys = true): Bot {
  return {
    name: 'legit-planner',
    about: 'the planner, but legit work only, and no long hauls it cannot pay the fuel for',
    visit(d) {
      const s = d.state, here = s.docked!;
      shop(d, 100, buys);
      const plan = bestPlan(s, j => j.kind === 'legit' && withinMeans(s, j));
      if (plan) load(d, plan.take);
      const next = hop(s, plan?.route[0] ?? nearest(s, here, others(s, here)));
      thriftyFuel(d, next);
      return next;
    },
  };
}

/**
 * Takes the fattest jobs, spends every credit the moment it can, and never looks at the fuel gauge.
 * The helm warns before casting off without the fuel to reach the next stop; this player heeds that
 * and nothing else, and then buys exactly what the nav computer asks for.
 */
export function careless(buys = true): Bot {
  return {
    name: 'careless',
    about: 'fattest jobs first, buys upgrades with its last credit, refuels only when the helm warns, and then the bare minimum',
    visit(d) {
      const s = d.state, here = s.docked!;
      shop(d, 0, buys);
      load(d, [...s.boards[here]].sort((a, b) => b.pay - a.pay));
      const top = [...s.hold].sort((a, b) => b.pay - a.pay)[0];
      const next = hop(s, top?.to ?? nearest(s, here, others(s, here)));
      const need = fuelFor(s, distance(s, here, next));
      if (s.ship.fuel < need) d.fuel(need - s.ship.fuel);
      return next;
    },
  };
}

/**
 * Presses buttons at random: random jobs, random splashes of fuel (often too little), random courses,
 * straight at the port whether or not the tank reaches. Not a strategy; it is here to find states nobody planned for.
 */
export function monkey(buys = true): Bot {
  return {
    name: 'monkey',
    about: 'random jobs, random fuel, random course',
    visit(d) {
      const s = d.state, here = s.docked!;
      const roll = () => rand(s);
      if (buys) for (const u of UPGRADES) if (roll() < 0.3) d.upgrade(u.id);
      for (const j of [...s.boards[here]]) if (roll() < 0.5) d.accept(j.id);
      const r = roll();
      if (r < 0.25) d.fuel('fill');
      else if (r < 0.6) d.fuel(1 + Math.floor(roll() * 30));
      const dests = s.hold.length && roll() < 0.6 ? s.hold.map(j => j.to) : others(s, here);
      return dests[Math.floor(roll() * dests.length)];
    },
  };
}

/**
 * Exploit probe: the planner, but it rerolls a board it does not fancy.
 * `how` is the trick: cast off and dock straight back in, or drift outside for a day.
 */
export function reroller(how: 'redock' | 'layover', buys = true): Bot {
  let seen = 0, total = 0;
  return {
    name: `reroll-${how}`,
    about: `the planner, but ${how === 'redock' ? 'casts off and re-docks at once' : 'drifts outside for a day'} to reroll any board not well above its running average`,
    visit(d) {
      const s = d.state, here = s.docked!;
      if (s.stats.delivered === 0 && s.day === 1 && s.dayFrac === 0) seen = total = 0; // new game
      shop(d, 100, buys);
      let plan = bestPlan(s, () => true);
      for (let tries = 0; tries < 6 && !s.hold.length; tries++) {
        if (plan) {
          seen++;
          total += plan.rate;
        }
        if (seen < 3 || (plan && plan.rate >= (total / seen) * 1.25)) break;
        if (!(how === 'redock' ? d.redock() : d.layover())) break;
        plan = bestPlan(s, () => true);
      }
      if (plan) load(d, plan.take);
      const next = hop(s, plan?.route[0] ?? nearest(s, here, others(s, here)));
      thriftyFuel(d, next);
      return next;
    },
  };
}

/**
 * Exploit probe: the cautious player, except it buys just enough fuel to get past halfway
 * and lets the tow truck carry it the rest of the way.
 */
export function towHopper(buys = true): Bot {
  const honest = cautious(buys);
  return {
    name: 'tow-hopper',
    about: 'cautious jobs, but buys fuel for just over half the leg and gets towed the rest',
    visit(d) {
      const s = d.state, here = s.docked!;
      // Reuse the cautious job choice, but stop it filling the tank.
      const next = honest.visit({ ...d, state: s, fuel: () => false });
      const half = ((0.5 * distance(s, here, next)) / topSpeed(s) + 2.5) * TUNING.burn;
      if (s.ship.fuel < half) d.fuel(half - s.ship.fuel);
      return next;
    },
  };
}

export const PROBES = [
  (buys = true) => reroller('redock', buys),
  (buys = true) => reroller('layover', buys),
  towHopper,
] as const;

export const STRATEGIES = [cautious, legitPlanner, greedy, planner, shady, shadyOnly, careless] as const;
