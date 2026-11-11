export type PortId = 'kestrel' | 'marrow' | 'hollow' | 'lantern';
export type JobKind = 'legit' | 'grey' | 'shady';

export interface Port {
  id: PortId;
  name: string;
  x: number;
  y: number;
  blurb: string;
  /** Credits per unit of fuel. */
  fuelPrice: number;
  dockFee: number;
  /** Relative odds of legit / grey / shady work on this port's board. */
  mix: readonly [number, number, number];
}

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
  seed: number;
  nextJobId: number;
  day: number;
  dayFrac: number;
  lastUpkeepDay: number;
  credits: number;
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
