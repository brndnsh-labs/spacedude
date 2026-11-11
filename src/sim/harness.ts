/**
 * Headless balance harness: bots play whole seeded games through the real sim functions
 * (flying every leg with `stepFlight` + `autopilot`), and we keep score.
 *
 * Nothing here is used by the game itself. `npm run balance` prints the tables;
 * `balance.test.ts` asserts the invariants that matter.
 */
import {
  TUNING, UPGRADES, acceptJob, atDock, autopilot, buyFuel, buyUpgrade, dock, dockable, launch, newGame, speedOf,
  stepFlight, upgradeCost,
} from './game';
import type { UpgradeId } from './game';
import type { GameState, Job, JobKind, PortId } from './types';
import { PORTS, port } from './world';

// ---------------------------------------------------------------------------------------------
// Playing one game
// ---------------------------------------------------------------------------------------------

/** What a bot can do while docked. Every call goes through the real sim action and is logged. */
export interface Dockside {
  readonly state: GameState;
  accept(jobId: number): boolean;
  fuel(units: number | 'fill'): boolean;
  upgrade(id: UpgradeId): boolean;
  /** Cast off and dock again at once, without going anywhere (L then E in the game). */
  redock(): boolean;
  /** Cast off, drift until the calendar ticks over, and come back in. */
  layover(): boolean;
}

export interface Bot {
  name: string;
  about: string;
  /** Do business at the dock (jobs, fuel, upgrades), then say where to fly next. */
  visit(d: Dockside): PortId;
}

export interface PlayOptions {
  /** Stop once this many game-days have passed. */
  days: number;
  /** Fixed flight timestep in seconds. */
  dt?: number;
  /** Safety cap on dock visits. */
  maxStops?: number;
  /** Tweak the fresh game before play starts (used for upgrade what-ifs). */
  setup?: (state: GameState) => void;
}

export interface Delivery {
  kind: JobKind;
  listed: number;
  /** Credits actually received, net of any fine. */
  got: number;
  late: boolean;
  fined: boolean;
  /** Dockings between pick-up and drop-off: 1 is a direct trip, 2 means one other port on the way. */
  hops: number;
}

export interface UpgradeEvent {
  id: UpgradeId;
  cost: number;
  /** Deliveries made and game-days elapsed when it was fitted. */
  deliveries: number;
  day: number;
}

export interface GameLog {
  bot: string;
  seed: number;
  /** Game-days played (flight time only; the clock stops in dock). */
  days: number;
  trips: number;
  deliveries: Delivery[];
  upgrades: UpgradeEvent[];
  startCredits: number;
  endCredits: number;
  minCredits: number;
  upgradeSpend: number;
  fuelUnits: number;
  fuelCredits: number;
  tows: number;
  /** Charity received: debts waved off at the credit floor, plus the pump value of fuel fronted to a broke ship. */
  aid: number;
  /** Change in net worth (credits + money put into upgrades) over each dock-to-dock trip. */
  tripNets: number[];
  /** The port each of those trips set out from. */
  tripFrom: PortId[];
  visits: Record<PortId, number>;
  /** Times the balance was seen below the credit floor (should be zero). */
  belowFloor: number;
  /** Set if the player ended up docked with no way to leave. */
  stuck: string | null;
  /** Times the bot cast off and docked straight back in, or drifted a day outside the port. */
  redocks: number;
  layovers: number;
  /** Flights that never arrived (should be zero; a bug in the sim or autopilot if not). */
  lost: number;
  final: GameState;
}

const gameDays = (s: GameState) => s.day - 1 + s.dayFrac;

/**
 * True if a docked player has some way to get under way: launch as-is, or after buying fuel.
 * This is the definition of "not soft-locked" the guardrail tests use.
 */
export function canLeaveDock(state: GameState): boolean {
  if (!state.docked) return true;
  const probe: GameState = structuredClone(state);
  if (launch(probe).ok) return true;
  buyFuel(probe, 'fill');
  return launch(probe).ok;
}

type Arrival = 'arrived' | 'towed' | 'coasted' | 'lost';

/** Fly the autopilot to `target` and dock, however that ends up happening. */
export function flyTo(state: GameState, target: PortId, dt: number): Arrival {
  for (let t = 0; t < 400; t += dt) {
    if (stepFlight(state, autopilot(state, target), dt) === 'towed') return 'towed';
    if (atDock(state, target)) {
      dock(state, target);
      return 'arrived';
    }
    // Dry tank but drifting inside a port's dock radius: a player presses E.
    if (state.ship.fuel <= 0 && speedOf(state) < 6) {
      const near = dockable(state);
      if (near) {
        dock(state, near);
        return 'coasted';
      }
    }
  }
  return 'lost';
}

export function play(bot: Bot, seed: number, opts: PlayOptions): GameLog {
  const dt = opts.dt ?? 1 / 30;
  const state = newGame(seed);
  opts.setup?.(state);
  const log: GameLog = {
    bot: bot.name, seed, days: 0, trips: 0, deliveries: [], upgrades: [],
    startCredits: state.credits, endCredits: state.credits, minCredits: state.credits,
    upgradeSpend: 0, fuelUnits: 0, fuelCredits: 0, tows: 0, aid: 0, tripNets: [], tripFrom: [], belowFloor: 0,
    visits: { kestrel: 0, marrow: 0, hollow: 0, lantern: 0 }, stuck: null, redocks: 0, layovers: 0, lost: 0, final: state,
  };
  const seen = () => {
    log.minCredits = Math.min(log.minCredits, state.credits);
    if (state.credits < TUNING.creditFloor) log.belowFloor++;
  };

  const tally = () => {
    for (const line of state.report) if (line.tag === 'writeoff') log.aid += line.amount ?? 0;
  };
  const loadedAt = new Map<number, number>();
  let dockings = 0;

  const dockside: Dockside = {
    state,
    accept(id) {
      if (!acceptJob(state, id).ok) return false;
      loadedAt.set(id, dockings);
      return true;
    },
    fuel(units) {
      const credits = state.credits, fuel = state.ship.fuel;
      const r = buyFuel(state, units);
      const got = state.ship.fuel - fuel, spent = credits - state.credits;
      log.fuelUnits += got;
      log.fuelCredits += spent;
      // Anything pumped beyond what was paid for (bar the rounding) was fronted by the harbormaster.
      log.aid += Math.max(0, Math.floor(got * port(state.docked!).fuelPrice) - spent);
      seen();
      return r.ok;
    },
    upgrade(id) {
      const cost = upgradeCost(state, id);
      if (cost === null || !buyUpgrade(state, id).ok) return false;
      log.upgradeSpend += cost;
      log.upgrades.push({ id, cost, deliveries: state.stats.delivered, day: gameDays(state) });
      seen();
      return true;
    },
    redock() {
      const here = state.docked;
      if (!here || !launch(state).ok) return false;
      const near = dockable(state);
      if (near !== here) return false;
      dock(state, here);
      dockings++;
      tally();
      log.redocks++;
      seen();
      return true;
    },
    layover() {
      const here = state.docked, day = state.day;
      if (!here || !launch(state).ok) return false;
      while (state.day === day && !state.docked) stepFlight(state, { turn: 0, thrust: false, brake: true }, dt);
      if (!state.docked && flyTo(state, here, dt) === 'towed') log.tows++;
      dockings++;
      tally();
      log.layovers++;
      seen();
      return !!state.docked;
    },
  };

  const maxStops = opts.maxStops ?? 2000;
  let worth = state.credits;
  for (let stop = 0; stop < maxStops && gameDays(state) < opts.days; stop++) {
    const from = state.docked!;
    log.visits[from]++;
    const target = bot.visit(dockside);
    state.target = target;
    if (!launch(state).ok) {
      // The console says "Take on fuel first", so that is what anyone would try.
      dockside.fuel('fill');
      if (!launch(state).ok) {
        log.stuck = `docked at ${state.docked} with ${state.ship.fuel.toFixed(1)} fuel and ${state.credits} cr on day ${state.day}`;
        break;
      }
    }
    const carried: Job[] = state.hold;
    const how = flyTo(state, target, dt);
    if (how === 'lost') {
      log.lost++;
      break;
    }
    if (how === 'towed') log.tows++;
    log.trips++;
    dockings++;
    tally();

    const landed = carried.filter(j => j.to === state.docked);
    let i = 0;
    for (const line of state.report) {
      if (line.tag === 'pay') {
        const job = landed[i++];
        log.deliveries.push({
          kind: job.kind, listed: job.pay, got: line.amount ?? 0, late: !!line.late, fined: false,
          hops: dockings - (loadedAt.get(job.id) ?? dockings - 1),
        });
      } else if (line.tag === 'fine') {
        const d = log.deliveries[log.deliveries.length - 1];
        d.got += line.amount ?? 0;
        d.fined = true;
      }
    }
    seen();
    const now = state.credits + log.upgradeSpend;
    log.tripNets.push(now - worth);
    log.tripFrom.push(from);
    worth = now;
  }
  log.days = gameDays(state);
  log.endCredits = state.credits;
  return log;
}

// ---------------------------------------------------------------------------------------------
// Summarising many games
// ---------------------------------------------------------------------------------------------

export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
export function quantile(xs: readonly number[], q: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export interface Summary {
  bot: string;
  games: number;
  /** Net worth gained (credits + upgrades bought) per delivery and per game-day, averaged over games. */
  netPerDelivery: number;
  netPerDay: number;
  /** Spread of net/day across seeds: how different two players' luck can be. */
  netPerDayP10: number;
  netPerDayP90: number;
  /** Mean and standard deviation of the net change over one dock-to-dock trip, pooled over all games. */
  tripMean: number;
  tripSd: number;
  /** Share of trips that lost money. */
  losingTrips: number;
  deliveriesPerDay: number;
  /** Median deliveries / game-days until the Nth upgrade is fitted, among games that got there. */
  upgradeAtDelivery: number[];
  upgradeAtDay: number[];
  /** Share of games that fitted at least one upgrade. */
  reachedFirstUpgrade: number;
  upgradesAtEnd: number;
  lateShare: number;
  /** Late share of jobs flown straight to their port, and of jobs that went via somewhere else first. */
  lateDirect: number;
  lateDetour: number;
  /** Charity per game-day: debt waved off at the credit floor and fuel fronted to a broke ship. */
  aidPerDay: number;
  fuelCreditsPerDay: number;
  fuelUnitsPerTrip: number;
  towsPer100Trips: number;
  minCreditsMean: number;
  minCreditsWorst: number;
  /** Share of games that ended in debt. */
  endedInDebt: number;
  stuckShare: number;
  lost: number;
  belowFloor: number;
  visits: Record<PortId, number>;
  /** Average net of a trip by the port it set out from: is any port a bad place to wake up? */
  netFrom: Record<PortId, number>;
}

const netOf = (g: GameLog) => g.endCredits - g.startCredits + g.upgradeSpend;
const lateOf = (ds: readonly Delivery[]) => (ds.length ? ds.filter(d => d.late).length / ds.length : NaN);

export function summarise(logs: readonly GameLog[]): Summary {
  const perDay = logs.map(g => netOf(g) / Math.max(g.days, 1e-9));
  const trips = logs.flatMap(g => g.tripNets);
  const deliveries = logs.flatMap(g => g.deliveries);
  const totalTrips = logs.reduce((a, g) => a + g.trips, 0);
  const totalDays = logs.reduce((a, g) => a + g.days, 0);
  const totalVisits = logs.reduce((a, g) => a + PORTS.reduce((b, p) => b + g.visits[p.id], 0), 0);
  const nth = (n: number, pick: (u: UpgradeEvent) => number) =>
    quantile(logs.filter(g => g.upgrades.length > n).map(g => pick(g.upgrades[n])), 0.5);
  const maxUp = Math.max(0, ...logs.map(g => g.upgrades.length));
  const visits = {} as Record<PortId, number>, netFrom = {} as Record<PortId, number>;
  for (const p of PORTS) {
    visits[p.id] = logs.reduce((a, g) => a + g.visits[p.id], 0) / Math.max(totalVisits, 1);
    netFrom[p.id] = mean(logs.flatMap(g => g.tripNets.filter((_, i) => g.tripFrom[i] === p.id)));
  }
  return {
    bot: logs[0].bot,
    games: logs.length,
    netPerDelivery: logs.reduce((a, g) => a + netOf(g), 0) / Math.max(deliveries.length, 1),
    netPerDay: mean(perDay),
    netPerDayP10: quantile(perDay, 0.1),
    netPerDayP90: quantile(perDay, 0.9),
    tripMean: mean(trips),
    tripSd: sd(trips),
    losingTrips: trips.filter(t => t < 0).length / Math.max(trips.length, 1),
    deliveriesPerDay: deliveries.length / Math.max(totalDays, 1e-9),
    upgradeAtDelivery: Array.from({ length: maxUp }, (_, n) => nth(n, u => u.deliveries)),
    upgradeAtDay: Array.from({ length: maxUp }, (_, n) => nth(n, u => u.day)),
    reachedFirstUpgrade: logs.filter(g => g.upgrades.length > 0).length / logs.length,
    upgradesAtEnd: mean(logs.map(g => g.upgrades.length)),
    lateShare: deliveries.filter(d => d.late).length / Math.max(deliveries.length, 1),
    lateDirect: lateOf(deliveries.filter(d => d.hops <= 1)),
    lateDetour: lateOf(deliveries.filter(d => d.hops > 1)),
    aidPerDay: logs.reduce((a, g) => a + g.aid, 0) / Math.max(totalDays, 1e-9),
    fuelCreditsPerDay: logs.reduce((a, g) => a + g.fuelCredits, 0) / Math.max(totalDays, 1e-9),
    fuelUnitsPerTrip: logs.reduce((a, g) => a + g.fuelUnits, 0) / Math.max(totalTrips, 1),
    towsPer100Trips: (100 * logs.reduce((a, g) => a + g.tows, 0)) / Math.max(totalTrips, 1),
    minCreditsMean: mean(logs.map(g => g.minCredits)),
    minCreditsWorst: Math.min(...logs.map(g => g.minCredits)),
    endedInDebt: logs.filter(g => g.endCredits < 0).length / logs.length,
    stuckShare: logs.filter(g => g.stuck).length / logs.length,
    lost: logs.reduce((a, g) => a + g.lost, 0),
    belowFloor: logs.reduce((a, g) => a + g.belowFloor, 0),
    visits,
    netFrom,
  };
}

export function playMany(bot: Bot, seeds: readonly number[], opts: PlayOptions): GameLog[] {
  return seeds.map(seed => play(bot, seed, opts));
}

export const seedRange = (n: number, from = 1) => Array.from({ length: n }, (_, i) => from + i * 7919);

// ---------------------------------------------------------------------------------------------
// What each kind of job actually pays
// ---------------------------------------------------------------------------------------------

export interface KindStats {
  kind: JobKind;
  n: number;
  /** Mean and SD of credits received as a fraction of an equal-sized legit job's listed pay. */
  mean: number;
  sd: number;
  /** Worst and best single outcome, same units. */
  worst: number;
  best: number;
  lateShare: number;
  finedShare: number;
}

/** Outcomes per job kind, pooled over the given games, in units of "what a legit job of that size lists at". */
export function kindStats(logs: readonly GameLog[], legitEquivalent: (d: Delivery) => number): KindStats[] {
  return (['legit', 'grey', 'shady'] as const).map(kind => {
    const ds = logs.flatMap(g => g.deliveries).filter(d => d.kind === kind);
    const xs = ds.map(d => d.got / legitEquivalent(d));
    return {
      kind, n: ds.length, mean: mean(xs), sd: sd(xs),
      worst: xs.length ? Math.min(...xs) : NaN, best: xs.length ? Math.max(...xs) : NaN,
      lateShare: ds.filter(d => d.late).length / Math.max(ds.length, 1),
      finedShare: ds.filter(d => d.fined).length / Math.max(ds.length, 1),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Upgrade what-ifs
// ---------------------------------------------------------------------------------------------

export interface UpgradeWorth {
  id: UpgradeId;
  level: number;
  cost: number;
  /** Extra net credits per game-day (and per trip flown) from owning this level, upgrades otherwise frozen. */
  gainPerTrip: number;
  gainPerDay: number;
  /** Trips / game-days for the upgrade to earn back its price (Infinity if it never does). */
  paybackTrips: number;
  paybackDays: number;
}

/**
 * How much each upgrade level is worth to a bot: play the same seeds with and without it,
 * with the bot barred from buying anything, and compare income.
 */
export function upgradeWorth(
  makeBot: (buys: boolean) => Bot, seeds: readonly number[], opts: PlayOptions, levels: readonly number[] = [1, 2, 3],
): UpgradeWorth[] {
  const bot = makeBot(false);
  const run = (setup: (s: GameState) => void) => {
    const logs = playMany(bot, seeds, { ...opts, setup });
    const net = logs.reduce((a, g) => a + netOf(g), 0);
    const days = Math.max(logs.reduce((a, g) => a + g.days, 0), 1e-9);
    return { perDay: net / days, tripsPerDay: logs.reduce((a, g) => a + g.trips, 0) / days };
  };
  const out: UpgradeWorth[] = [];
  for (const u of UPGRADES) {
    for (let level = 1; level <= u.costs.length; level++) {
      if (!levels.includes(level)) continue;
      const base = run(s => { s.upgrades[u.id] = level - 1; });
      const with_ = run(s => { s.upgrades[u.id] = level; });
      const gainPerDay = with_.perDay - base.perDay;
      const cost = u.costs[level - 1];
      const paybackDays = gainPerDay > 0 ? cost / gainPerDay : Infinity;
      out.push({
        id: u.id, level, cost, gainPerDay,
        gainPerTrip: gainPerDay / with_.tripsPerDay,
        paybackDays,
        paybackTrips: paybackDays * with_.tripsPerDay,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------------------------

export function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = (r: readonly string[]) => r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ');
  return [line(head), w.map(n => '-'.repeat(n)).join('  '), ...rows.map(line)].join('\n');
}

const n0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : x === Infinity ? 'never' : '-');
const n1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : x === Infinity ? 'never' : '-');
const n2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pct = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(x > 0 && x < 0.0995 ? 1 : 0)}%` : '-');

export function summaryTable(rows: readonly Summary[]): string {
  return table(
    ['strategy', 'net/deliv', 'net/day', 'p10..p90', 'trip sd', 'lose%', 'deliv/day', 'late', 'direct', 'detour', 'fuel cr/day', 'tows/100', 'min cr avg', 'worst', 'in debt', 'aid/day', 'stuck'],
    rows.map(s => [
      s.bot, n0(s.netPerDelivery), n1(s.netPerDay), `${n0(s.netPerDayP10)}..${n0(s.netPerDayP90)}`, n0(s.tripSd), pct(s.losingTrips),
      n2(s.deliveriesPerDay), pct(s.lateShare), pct(s.lateDirect), pct(s.lateDetour), n1(s.fuelCreditsPerDay), n1(s.towsPer100Trips),
      n0(s.minCreditsMean), n0(s.minCreditsWorst), pct(s.endedInDebt), n1(s.aidPerDay), pct(s.stuckShare),
    ]),
  );
}

export function upgradeTable(rows: readonly Summary[]): string {
  const cell = (s: Summary, n: number) =>
    n < s.upgradeAtDelivery.length && Number.isFinite(s.upgradeAtDelivery[n]) ? `${n0(s.upgradeAtDelivery[n])} / ${n0(s.upgradeAtDay[n])}` : '-';
  return table(
    ['strategy', 'got 1st', '1st (deliv / day)', '2nd', '3rd', '5th', '9th', 'fitted at end'],
    rows.map(s => [s.bot, pct(s.reachedFirstUpgrade), cell(s, 0), cell(s, 1), cell(s, 2), cell(s, 4), cell(s, 8), n1(s.upgradesAtEnd)]),
  );
}

export function portsTable(rows: readonly Summary[]): string {
  return table(
    ['strategy', ...PORTS.map(p => `${p.id} visits`), ...PORTS.map(p => `net from ${p.id}`)],
    rows.map(s => [s.bot, ...PORTS.map(p => pct(s.visits[p.id])), ...PORTS.map(p => n0(s.netFrom[p.id]))]),
  );
}

export function kindTable(rows: readonly KindStats[]): string {
  return table(
    ['kind', 'jobs', 'avg', 'sd', 'worst', 'best', 'late', 'fined'],
    rows.map(k => [k.kind, String(k.n), n2(k.mean), n2(k.sd), n2(k.worst), n2(k.best), pct(k.lateShare), pct(k.finedShare)]),
  );
}

export function worthTable(bot: string, rows: readonly UpgradeWorth[]): string {
  return table(
    [`${bot}: upgrade`, 'cost', '+net/trip', '+net/day', 'payback trips', 'payback days'],
    rows.map(u => [`${u.id} Mk${u.level}`, n0(u.cost), n1(u.gainPerTrip), n1(u.gainPerDay), n0(u.paybackTrips), n0(u.paybackDays)]),
  );
}
