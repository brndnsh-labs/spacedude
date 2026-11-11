import { RISK, generateBoard, round5 } from './jobs';
import { rand } from './rng';
import { generateSector } from './sector';
import type { FlightInput, GameState, Job, PortId, ReportLine, Result } from './types';
import { distance, neighbours, port } from './world';

/**
 * Flight feel (turnRate, accel, drag, brakeDrag, dockRadius, dockSpeed) is tuned by hand: leave it alone.
 * Everything about money and fuel is tuned with the balance harness: run `npm run balance` after touching it.
 */
export const TUNING = {
  turnRate: 3.2, // rad/s
  accel: 60, // px/s^2; top speed is accel / drag
  drag: 0.5,
  brakeDrag: 2.2,
  /** Fuel per second of thrust. The longest charted lane (4800 px) takes about 80 of a stock 100 tank. */
  burn: 1.9,
  secondsPerDay: 10,
  /** Crew shares and air. With fuel, this is what a trip has to earn back: about 170 cr for an average leg. */
  upkeepPerDay: 20,
  dockRadius: 70,
  dockSpeed: 45,
  /** A tow costs this much, plus towPerPx for every pixel the hauler has to drag you. */
  towFee: 120,
  towPerPx: 0.04,
  /** px/s. A tow moves at stock cruising speed and the clock runs for it, so running dry is never a shortcut. */
  towSpeed: 120,
  strandedSeconds: 2.5,
  startCredits: 100,
  /** How far the tab stretches. Nothing ever takes the balance below this. */
  creditFloor: -500,
  lateFactor: 0.6,
  /** Spare fuel on top of the nav estimate when a port fronts a broke captain enough to leave. */
  limpMargin: 4,
  /** The stock ship, and what each upgrade level adds. */
  cargo: 12,
  cargoStep: 6,
  tank: 100,
  tankStep: 60,
  engineStep: 0.12,
} as const;

/** Ships berth at the tip of a station's docking arm, this far left of its centre. */
export const ARM = 58;

export type UpgradeId = 'cargo' | 'tank' | 'engine';
export const UPGRADES: readonly { id: UpgradeId; name: string; effect: string; costs: readonly number[] }[] = [
  // Priced by what the harness says each is worth: the dearer the fitting, the faster it earns its keep.
  { id: 'cargo', name: 'Cargo racks', effect: `+${TUNING.cargoStep} t hold`, costs: [1200, 1400, 1700] },
  { id: 'tank', name: 'Aux fuel tank', effect: `+${TUNING.tankStep} fuel`, costs: [600, 650, 700] },
  { id: 'engine', name: 'Engine tune', effect: `+${Math.round(TUNING.engineStep * 100)}% speed`, costs: [750, 900, 1100] },
];

export const cargoMax = (s: GameState) => TUNING.cargo + TUNING.cargoStep * s.upgrades.cargo;
export const fuelMax = (s: GameState) => TUNING.tank + TUNING.tankStep * s.upgrades.tank;
export const accelOf = (s: GameState) => TUNING.accel * (1 + TUNING.engineStep * s.upgrades.engine);
export const topSpeed = (s: GameState) => accelOf(s) / TUNING.drag;
export const holdTons = (s: GameState) => s.hold.reduce((t, j) => t + j.tons, 0);
export const speedOf = (s: GameState) => Math.hypot(s.ship.vx, s.ship.vy);
/** Fuel a cruise of this distance takes, with a little margin. */
export const fuelFor = (s: GameState, dist: number) => Math.ceil((dist / topSpeed(s)) * TUNING.burn * 1.1);

/** Whether a full tank covers a leg of this length with the usual margin. */
export const inRange = (s: GameState, dist: number) => fuelFor(s, dist) + TUNING.limpMargin <= fuelMax(s);
/** What a tow from this far out costs. */
export const towFee = (dist: number) => round5(TUNING.towFee + TUNING.towPerPx * dist);

/**
 * The least fuel that reaches every port a charted lane away from here. A docked ship can always get at least
 * this much, however deep its tab, and the lanes join every port, so there is always a way to take a job and
 * deliver it.
 */
export const limpFuel = (s: GameState, from: PortId) =>
  Math.min(fuelMax(s), Math.max(...neighbours(s, from).map(id => fuelFor(s, distance(s, from, id)))) + TUNING.limpMargin);

const ok = (msg: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export function newGame(seed: number): GameState {
  const state: GameState = {
    seed,
    startSeed: seed,
    nextJobId: 1,
    day: 1,
    dayFrac: 0,
    lastUpkeepDay: 1,
    credits: TUNING.startCredits,
    ports: [],
    lanes: [],
    docked: 'kestrel',
    target: null,
    ship: { x: 0, y: 0, vx: 0, vy: 0, angle: 0, fuel: TUNING.tank },
    upgrades: { cargo: 0, tank: 0, engine: 0 },
    boards: {} as Record<PortId, Job[]>,
    boardDay: {},
    hold: [],
    report: [
      { text: "She's not much, but she's yours. Tank's full." },
      { text: 'Pick up work on the JOBS board, set a course in NAV, then launch.' },
    ],
    stranded: 0,
    stats: { delivered: 0, earned: 0 },
  };
  const sector = generateSector(state);
  state.ports = [...sector.ports];
  state.lanes = [...sector.lanes];
  const home = port(state, 'kestrel');
  state.ship.x = home.x - ARM;
  state.ship.y = home.y;
  for (const p of state.ports) postBoard(state, p.id);
  return state;
}

function postBoard(state: GameState, id: PortId): void {
  state.boards[id] = generateBoard(state, id);
  (state.boardDay ??= {})[id] = state.day;
}

export function acceptJob(state: GameState, jobId: number): Result {
  if (!state.docked) return fail('No dock link.');
  const board = state.boards[state.docked];
  const job = board.find(j => j.id === jobId);
  if (!job) return fail('That job is gone.');
  const free = cargoMax(state) - holdTons(state);
  if (job.tons > free) return fail(`Won't fit: needs ${job.tons} t, ${free} t free.`);
  state.boards[state.docked] = board.filter(j => j !== job);
  state.hold.push(job);
  if (!state.target) state.target = job.to;
  return ok(`Loaded ${job.cargo.toLowerCase()} for ${port(state, job.to).name}.`);
}

/** What asking the pump for this much would really get you: fuel paid for, fuel fronted, and the bill. */
export function fuelQuote(state: GameState, units: number | 'fill'): { paid: number; fronted: number; cost: number } {
  if (!state.docked) return { paid: 0, fronted: 0, cost: 0 };
  const price = port(state, state.docked).fuelPrice;
  const space = fuelMax(state) - state.ship.fuel;
  const want = Math.max(0, Math.min(units === 'fill' ? space : units, space));
  const tab = Math.max(0, state.credits - TUNING.creditFloor);
  const paid = Math.min(want, Math.floor(tab / price));
  // Nobody gets left on the dock. If the tab will not stretch to a tank that reaches the next port,
  // the harbormaster fronts the difference.
  const fronted = paid < want ? Math.min(space - paid, Math.max(0, limpFuel(state, state.docked) - state.ship.fuel - paid)) : 0;
  return { paid, fronted, cost: Math.min(Math.ceil(paid * price), tab) };
}

export function buyFuel(state: GameState, units: number | 'fill'): Result {
  if (!state.docked) return fail('No dock link.');
  const space = fuelMax(state) - state.ship.fuel;
  if (space < 0.5) return fail('Tank is full.');
  if (!(Math.min(units === 'fill' ? space : units, space) > 0)) return fail('Nothing to pump.');
  const { paid, fronted, cost } = fuelQuote(state, units);
  if (paid + fronted <= 0) return fail("The harbormaster won't extend your tab any further.");
  state.credits -= cost;
  state.ship.fuel += paid + fronted;
  if (fronted > 0) {
    const bought = paid > 0 ? `Took on ${Math.round(paid)} fuel for ${cost} cr, and that's the tab maxed. ` : "Tab's maxed. ";
    return ok(`${bought}The harbormaster fronts you ${Math.round(fronted)} more to reach the next port. "Pay it forward."`);
  }
  return ok(`Took on ${Math.round(paid)} fuel for ${cost} cr.${state.credits < 0 ? ' It goes on your tab.' : ''}`);
}

export function upgradeCost(state: GameState, id: UpgradeId): number | null {
  const def = UPGRADES.find(u => u.id === id)!;
  return def.costs[state.upgrades[id]] ?? null;
}

export function buyUpgrade(state: GameState, id: UpgradeId): Result {
  if (!state.docked) return fail('No dock link.');
  if (!port(state, state.docked).yard) return fail('No shipyard here.');
  const def = UPGRADES.find(u => u.id === id)!;
  const cost = upgradeCost(state, id);
  if (cost === null) return fail(`${def.name}: nothing left to fit.`);
  if (state.credits < cost) return fail(`${def.name} costs ${cost} cr. You're ${cost - state.credits} short.`);
  state.credits -= cost;
  state.upgrades[id]++;
  return ok(`${def.name} fitted (${def.effect}).`);
}

export function launch(state: GameState): Result {
  if (!state.docked) return fail('Already under way.');
  if (state.ship.fuel < 1) return fail("Tank's dry. Take on fuel first.");
  const p = port(state, state.docked);
  state.docked = null;
  state.stranded = 0;
  state.ship.x = p.x - ARM;
  state.ship.y = p.y;
  state.ship.angle = Math.PI;
  state.ship.vx = -30;
  state.ship.vy = 0;
  return ok('Clamps released.');
}

/** The fine an inspection of this shady job would cost. */
export const fineFor = (job: Job) => round5(RISK.fineFlat + RISK.finePay * job.pay);

/** Average credits a delivery brings in, net of fines, tips and short-changing clients. */
export function expectedPay(job: Job, late: boolean): number {
  const pay = late ? round5(job.pay * TUNING.lateFactor) : job.pay;
  if (job.kind === 'legit') return pay + RISK.tipChance * round5(job.pay * RISK.tipFrac);
  if (job.kind === 'grey') return pay - RISK.shortChance * (pay - round5(pay * RISK.shortKeep));
  return pay - RISK.fineChance * fineFor(job);
}

function settle(state: GameState, job: Job): ReportLine[] {
  const lines: ReportLine[] = [];
  let pay = job.pay;
  let note = '';
  const late = state.day > job.due;
  if (late) {
    pay = round5(pay * TUNING.lateFactor);
    note = ' (late)';
  }
  const roll = rand(state);
  if (job.kind === 'legit' && roll < RISK.tipChance) {
    pay += round5(job.pay * RISK.tipFrac);
    note += ' (tipped)';
  } else if (job.kind === 'grey' && roll < RISK.shortChance) {
    pay = round5(pay * RISK.shortKeep);
    note += ' (client came up short)';
  }
  lines.push({ text: `Delivered ${job.cargo.toLowerCase()}${note}`, amount: pay, tag: 'pay', job: job.kind, late });
  if (job.kind === 'shady' && roll < RISK.fineChance) {
    lines.push({ text: 'Port authority "inspection fee"', amount: -fineFor(job), tag: 'fine', job: job.kind });
  }
  state.stats.delivered++;
  state.stats.earned += pay;
  return lines;
}

/**
 * Dock at a port: deliver anything bound here, pay the fees, and post a new job board if a day has turned.
 * Docking where we are already berthed does nothing, so a caller that docks again after a tow
 * (which has already berthed us) does not charge a second fee or wipe the tow off the arrival report.
 */
export function dock(state: GameState, id: PortId): void {
  if (state.docked === id) return;
  arrive(state, id, []);
}

function arrive(state: GameState, id: PortId, report: ReportLine[]): void {
  const p = port(state, id);
  state.docked = id;
  state.stranded = 0;
  state.ship.x = p.x - ARM;
  state.ship.y = p.y;
  state.ship.vx = state.ship.vy = 0;
  state.ship.angle = 0;
  if (state.target === id) state.target = null;

  const arriving = state.hold.filter(j => j.to === id);
  state.hold = state.hold.filter(j => j.to !== id);
  for (const job of arriving) report.push(...settle(state, job));
  report.push({ text: 'Docking fee', amount: -p.dockFee, tag: 'fee' });
  const days = state.day - state.lastUpkeepDay;
  if (days > 0) {
    report.push({ text: `Crew shares and air, ${days} day${days > 1 ? 's' : ''}`, amount: -days * TUNING.upkeepPerDay, tag: 'upkeep' });
    state.lastUpkeepDay = state.day;
  }
  for (const line of report) state.credits += line.amount ?? 0;
  // The tab only stretches so far. Past that the port eats the difference rather than bury a captain.
  if (state.credits < TUNING.creditFloor) {
    report.push({ text: `Tab's at its limit. The harbormaster waves off the rest`, amount: TUNING.creditFloor - state.credits, tag: 'writeoff' });
    state.credits = TUNING.creditFloor;
  }
  if (!state.target && state.hold.length) state.target = state.hold[0].to;

  // Boards turn over with the calendar, not with the airlock: casting off and docking again shows the same jobs.
  if (state.boardDay?.[id] !== state.day) postBoard(state, id);
  state.report = report;
}

export function nearestPort(state: GameState): PortId {
  let best = state.ports[0], bestD = Infinity;
  for (const p of state.ports) {
    const d = Math.hypot(p.x - state.ship.x, p.y - state.ship.y);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best.id;
}

/** The port we are close and slow enough to dock at, if any. */
export function dockable(state: GameState): PortId | null {
  if (state.docked || speedOf(state) > TUNING.dockSpeed) return null;
  const p = port(state, nearestPort(state));
  return Math.hypot(p.x - state.ship.x, p.y - state.ship.y) <= TUNING.dockRadius ? p.id : null;
}

/** True once the ship is parked at a port's docking arm. */
export function atDock(state: GameState, id: PortId): boolean {
  const p = port(state, id);
  return Math.hypot(p.x - ARM - state.ship.x, p.y - state.ship.y) < 16 && speedOf(state) < 20;
}

function passTime(state: GameState, seconds: number): void {
  state.dayFrac += seconds / TUNING.secondsPerDay;
  while (state.dayFrac >= 1) {
    state.dayFrac -= 1;
    state.day++;
  }
}

function tow(state: GameState): void {
  const p = port(state, nearestPort(state));
  const far = Math.hypot(p.x - state.ship.x, p.y - state.ship.y);
  passTime(state, far / TUNING.towSpeed);
  arrive(state, p.id, [{ text: 'Ran dry. Towed in by a passing hauler', amount: -towFee(far), tag: 'tow' }]);
}

/** Advance the flight by dt seconds. Returns 'towed' if we ran dry and got hauled to port. */
export function stepFlight(state: GameState, input: FlightInput, dt: number): 'towed' | null {
  if (state.docked) return null;
  const s = state.ship;
  s.angle += Math.max(-1, Math.min(1, input.turn)) * TUNING.turnRate * dt;
  if (input.thrust && s.fuel > 0) {
    const a = accelOf(state);
    s.vx += Math.cos(s.angle) * a * dt;
    s.vy += Math.sin(s.angle) * a * dt;
    s.fuel = Math.max(0, s.fuel - TUNING.burn * dt);
  }
  const k = Math.exp(-(input.brake ? TUNING.brakeDrag : TUNING.drag) * dt);
  s.vx *= k;
  s.vy *= k;
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  passTime(state, dt);

  // Nobody dies out here: an empty tank just means an embarrassing tow.
  if (s.fuel <= 0 && speedOf(state) < 6 && !dockable(state)) {
    state.stranded += dt;
    if (state.stranded >= TUNING.strandedSeconds) {
      tow(state);
      return 'towed';
    }
  } else {
    state.stranded = 0;
  }
  return null;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Flight input that cruises to a port's docking arm and stops there. */
export function autopilot(state: GameState, id: PortId): FlightInput {
  const p = port(state, id), s = state.ship;
  const dx = p.x - ARM - s.x, dy = p.y - s.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const speed = speedOf(state);
  if (d < 14 && speed < 12) return { turn: 0, thrust: false, brake: true };

  const want = Math.min(topSpeed(state), d * 0.6 + 6);
  const ex = (dx / d) * want - s.vx, ey = (dy / d) * want - s.vy;
  const needPush = ex * dx + ey * dy > 0 && Math.hypot(ex, ey) > 4;
  // Burn toward the velocity we lack; when we only need to shed speed, face the port and let drag work.
  const heading = needPush ? Math.atan2(ey, ex) : Math.atan2(dy, dx);
  const diff = wrapAngle(heading - s.angle);
  return {
    turn: Math.max(-1, Math.min(1, diff * 6)),
    thrust: needPush && Math.abs(diff) < 0.5,
    brake: speed > want + 10,
  };
}
