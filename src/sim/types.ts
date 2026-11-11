/** Ports are generated per game, so an id is just a string: the four core ports keep their names, the rest are 'p4', 'p5'... */
export type PortId = string;
export type JobKind = 'legit' | 'grey' | 'shady';
/** What sort of place a port is. It decides the look, the prices and the kind of work on offer. */
export type PortType = 'ring' | 'farm' | 'mine' | 'relay';

export interface Port {
  id: PortId;
  name: string;
  type: PortType;
  /** The neighbourhood it belongs to: the Halcyon Core, or one of the outlying reaches. */
  region: string;
  x: number;
  y: number;
  blurb: string;
  /** Credits per unit of fuel. */
  fuelPrice: number;
  dockFee: number;
  /** Relative odds of legit / grey / shady work on this port's board. */
  mix: readonly [number, number, number];
  /** Whether there is a shipyard here to fit upgrades. */
  yard: boolean;
  /** Seed for the port's colours. 0 means "as drawn": the four core ports. */
  look: number;
}

/** A charted run between two ports, short enough for a stock tank. */
export type Lane = readonly [PortId, PortId];

export interface Job {
  id: number;
  kind: JobKind;
  cargo: string;
  tons: number;
  from: PortId;
  to: PortId;
  pay: number;
  /** Last day the job pays in full. */
  due: number;
  client: string;
  note: string;
}

export interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fuel: number;
}

export interface Upgrades {
  cargo: number;
  tank: number;
  engine: number;
}

export interface ReportLine {
  text: string;
  amount?: number;
  /** What the line is for. Optional, so reports in old saves still load; the balance harness reads it. */
  tag?: 'pay' | 'fine' | 'fee' | 'upkeep' | 'tow' | 'writeoff';
  /** For 'pay' and 'fine' lines: the kind of job, and whether it came in late. */
  job?: JobKind;
  late?: boolean;
}

export interface GameState {
  /** The random number generator's state. It moves on with every roll. */
  seed: number;
  /** The seed this game was started from: the same one always gives the same sector. Optional for saves from before it was kept. */
  startSeed?: number;
  nextJobId: number;
  day: number;
  dayFrac: number;
  lastUpkeepDay: number;
  credits: number;
  /** This game's sector: generated once from the seed, then fixed for the life of the save. */
  ports: Port[];
  lanes: Lane[];
  docked: PortId | null;
  /** Port the nav computer is pointed at. */
  target: PortId | null;
  ship: Ship;
  upgrades: Upgrades;
  boards: Record<PortId, Job[]>;
  /** The day each port's board was last posted. Optional: saves from before it existed just get fresh boards. */
  boardDay?: Partial<Record<PortId, number>>;
  hold: Job[];
  /** What happened the last time we docked. */
  report: ReportLine[];
  /** Seconds spent adrift with an empty tank. */
  stranded: number;
  stats: { delivered: number; earned: number };
}

export interface FlightInput {
  /** -1 (left) to 1 (right). */
  turn: number;
  thrust: boolean;
  brake: boolean;
}

export interface Result {
  ok: boolean;
  msg: string;
}
