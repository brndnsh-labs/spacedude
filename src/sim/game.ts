import { generateBoard, round5 } from './jobs';
import { rand } from './rng';
import type { FlightInput, GameState, Job, PortId, ReportLine, Result } from './types';
import { PORTS, port } from './world';

export const TUNING = {
  turnRate: 3.2, // rad/s
  accel: 60, // px/s^2; top speed is accel / drag
  drag: 0.5,
  brakeDrag: 2.2,
  burn: 1.4, // fuel per second of thrust
  secondsPerDay: 10,
  upkeepPerDay: 10,
  dockRadius: 70,
  dockSpeed: 45,
  towFee: 120,
  strandedSeconds: 2.5,
  creditFloor: -500,
  lateFactor: 0.6,
} as const;

/** Ships berth at the tip of a station's docking arm, this far left of its centre. */
export const ARM = 58;

export type UpgradeId = 'cargo' | 'tank' | 'engine';
export const UPGRADES: readonly { id: UpgradeId; name: string; effect: string; costs: readonly number[] }[] = [
  { id: 'cargo', name: 'Cargo racks', effect: '+6 t hold', costs: [500, 900, 1500] },
  { id: 'tank', name: 'Aux fuel tank', effect: '+40 fuel', costs: [400, 700, 1100] },
  { id: 'engine', name: 'Engine tune', effect: '+12% speed', costs: [650, 1100, 1800] },
];

export const cargoMax = (s: GameState) => 12 + 6 * s.upgrades.cargo;
export const fuelMax = (s: GameState) => 100 + 40 * s.upgrades.tank;
export const accelOf = (s: GameState) => TUNING.accel * (1 + 0.12 * s.upgrades.engine);
export const topSpeed = (s: GameState) => accelOf(s) / TUNING.drag;
export const holdTons = (s: GameState) => s.hold.reduce((t, j) => t + j.tons, 0);
export const speedOf = (s: GameState) => Math.hypot(s.ship.vx, s.ship.vy);
/** Fuel a cruise of this distance takes, with a little margin. */
export const fuelFor = (s: GameState, dist: number) => Math.ceil((dist / topSpeed(s)) * TUNING.burn * 1.1);

const ok = (msg: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export function newGame(seed: number): GameState {
  const home = port('kestrel');
  const state: GameState = {
    seed,
    nextJobId: 1,
    day: 1,
    dayFrac: 0,
    lastUpkeepDay: 1,
    credits: 300,
    docked: 'kestrel',
    target: null,
    ship: { x: home.x - ARM, y: home.y, vx: 0, vy: 0, angle: 0, fuel: 100 },
    upgrades: { cargo: 0, tank: 0, engine: 0 },
    boards: {} as Record<PortId, Job[]>,
    hold: [],
    report: [
      { text: "She's not much, but she's yours. Tank's full." },
      { text: 'Pick up work on the JOBS board, set a course in NAV, then launch.' },
    ],
    stranded: 0,
    stats: { delivered: 0, earned: 0 },
  };
  for (const p of PORTS) state.boards[p.id] = generateBoard(state, p.id);
  return state;
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
  return ok(`Loaded ${job.cargo.toLowerCase()} for ${port(job.to).name}.`);
}

export function buyFuel(state: GameState, units: number | 'fill'): Result {
  if (!state.docked) return fail('No dock link.');
  const price = port(state.docked).fuelPrice;
  const space = fuelMax(state) - state.ship.fuel;
  if (space < 0.5) return fail('Tank is full.');
  const affordable = Math.floor((state.credits - TUNING.creditFloor) / price);
  if (affordable <= 0) return fail("The harbormaster won't extend your tab any further.");
  const u = Math.min(units === 'fill' ? space : units, space, affordable);
  const cost = Math.ceil(u * price);
  state.credits -= cost;
  state.ship.fuel += u;
  return ok(`Took on ${Math.round(u)} fuel for ${cost} cr.${state.credits < 0 ? ' It goes on your tab.' : ''}`);
}

export function upgradeCost(state: GameState, id: UpgradeId): number | null {
  const def = UPGRADES.find(u => u.id === id)!;
  return def.costs[state.upgrades[id]] ?? null;
}

export function buyUpgrade(state: GameState, id: UpgradeId): Result {
  if (!state.docked) return fail('No dock link.');
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
  const p = port(state.docked);
  state.docked = null;
  state.stranded = 0;
  state.ship.x = p.x - ARM;
  state.ship.y = p.y;
  state.ship.angle = Math.PI;
  state.ship.vx = -30;
  state.ship.vy = 0;
  return ok('Clamps released.');
}

function settle(state: GameState, job: Job): ReportLine[] {
  const lines: ReportLine[] = [];
  let pay = job.pay;
  let note = '';
  if (state.day > job.due) {
    pay = round5(pay * TUNING.lateFactor);
    note = ' (late)';
  }
  const roll = rand(state);
  if (job.kind === 'legit' && roll < 0.12) {
    pay += round5(job.pay * 0.15);
    note += ' (tipped)';
  } else if (job.kind === 'grey' && roll < 0.18) {
    pay = round5(pay * 0.7);
    note += ' (client came up short)';
  }
  lines.push({ text: `Delivered ${job.cargo.toLowerCase()}${note}`, amount: pay });
  if (job.kind === 'shady' && roll < 0.22) lines.push({ text: 'Port authority "inspection fee"', amount: -150 });
  state.stats.delivered++;
  state.stats.earned += pay;
  return lines;
}

/** Dock at a port: deliver anything bound here, pay the fees, and refresh its job board. */
export function dock(state: GameState, id: PortId): void {
  const p = port(id);
  state.docked = id;
  state.stranded = 0;
  state.ship.x = p.x - ARM;
  state.ship.y = p.y;
  state.ship.vx = state.ship.vy = 0;
  state.ship.angle = 0;
  if (state.target === id) state.target = null;

  const report: ReportLine[] = [];
  const arriving = state.hold.filter(j => j.to === id);
  state.hold = state.hold.filter(j => j.to !== id);
  for (const job of arriving) report.push(...settle(state, job));
  report.push({ text: 'Docking fee', amount: -p.dockFee });
  const days = state.day - state.lastUpkeepDay;
  if (days > 0) {
    report.push({ text: `Crew shares and air, ${days} day${days > 1 ? 's' : ''}`, amount: -days * TUNING.upkeepPerDay });
    state.lastUpkeepDay = state.day;
  }
  for (const line of report) state.credits += line.amount ?? 0;
  if (!state.target && state.hold.length) state.target = state.hold[0].to;

  state.boards[id] = generateBoard(state, id);
  state.report = report;
}

export function nearestPort(state: GameState): PortId {
  let best = PORTS[0], bestD = Infinity;
  for (const p of PORTS) {
    const d = Math.hypot(p.x - state.ship.x, p.y - state.ship.y);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best.id;
}

/** The port we are close and slow enough to dock at, if any. */
export function dockable(state: GameState): PortId | null {
  if (state.docked || speedOf(state) > TUNING.dockSpeed) return null;
  const p = port(nearestPort(state));
  return Math.hypot(p.x - state.ship.x, p.y - state.ship.y) <= TUNING.dockRadius ? p.id : null;
}

/** True once the ship is parked at a port's docking arm. */
export function atDock(state: GameState, id: PortId): boolean {
  const p = port(id);
  return Math.hypot(p.x - ARM - state.ship.x, p.y - state.ship.y) < 16 && speedOf(state) < 20;
}

function tow(state: GameState): void {
  dock(state, nearestPort(state));
  state.credits -= TUNING.towFee;
  state.report.unshift({ text: 'Ran dry. Towed in by a passing hauler', amount: -TUNING.towFee });
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

  state.dayFrac += dt / TUNING.secondsPerDay;
  while (state.dayFrac >= 1) {
    state.dayFrac -= 1;
    state.day++;
  }

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
  const p = port(id), s = state.ship;
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
