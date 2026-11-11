import { pick, rand, randInt } from './rng';
import type { GameState, Job, JobKind, PortId } from './types';
import { PORTS, distance, port } from './world';

const KINDS: readonly JobKind[] = ['legit', 'grey', 'shady'];

/**
 * What a job is listed at: (base + perPx * distance) * (loadBase + perTon * tons) * mult[kind].
 * At these rates a 4 t legit job about covers the fuel and upkeep of its own trip on any leg;
 * profit comes from a bigger load or a second job going the same way.
 */
export const PAY = {
  base: 55,
  perPx: 0.045,
  loadBase: 0.6,
  perTon: 0.1,
  mult: { legit: 1, grey: 1.3, shady: 1.8 } as Record<JobKind, number>,
} as const;

/**
 * What can happen on delivery, per job. On average a grey job brings in about 1.1x and a shady one about 1.25x
 * what the same load pays legit, but a grey job can pay well under legit and a shady one can cost you money.
 */
export const RISK = {
  /** Legit clients sometimes tip this fraction of the listed pay. */
  tipChance: 0.12,
  tipFrac: 0.15,
  /** Grey clients sometimes pay only this fraction. */
  shortChance: 0.25,
  shortKeep: 0.5,
  /** Shady cargo sometimes draws an "inspection fee" of fineFlat + finePay * listed pay: the payout and then some. */
  fineChance: 0.25,
  fineFlat: 0,
  finePay: 1.2,
} as const;

/**
 * What a board holds: one mid-sized legit "starter" job that fits any ship and pays its own way,
 * plus a few of whatever the port deals in.
 */
export const BOARD = { minTons: 2, maxTons: 14, starterMinTons: 4, starterMaxTons: 8, extraMin: 3, extraMax: 4 } as const;

/** A job is due `ceil(distance / pxPerDay) + slackDays` days after it is posted: easy direct, tight with a detour. */
export const DEADLINE = { pxPerDay: 900, slackDays: 2 } as const;

export const listedPay = (kind: JobKind, dist: number, tons: number) =>
  round5((PAY.base + dist * PAY.perPx) * (PAY.loadBase + tons * PAY.perTon) * PAY.mult[kind]);

const CARGO: Record<JobKind, readonly string[]> = {
  legit: ['Seed stock', 'Water filters', 'Machine parts', 'Medical supplies', 'Mail sacks', 'Hydroponic trays', 'Tinned protein'],
  grey: ['Unmarked spares', '"Salvage"', 'Duty-free liquor', 'Survey data', 'Livestock (probably)', 'Reclaimed hull plate'],
  shady: ['Sealed crates', 'A locked case', '"Farm equipment"', 'Passengers, no names', 'Something that hums'],
};

const CLIENTS: Record<JobKind, readonly string[]> = {
  legit: ['Harbor Co-op', 'Dr. Ansel Vey', 'Marrow Grange', 'Ossa Relief'],
  grey: ['a man named Pell', 'Tamsin at the yard', 'the night foreman', 'Brother Okoro'],
  shady: ['nobody you know', 'a friend of a friend', 'Mr. Quill', 'the woman in the corner booth'],
};

const NOTES: Record<JobKind, readonly string[]> = {
  legit: ['Paperwork in order. Pays on delivery.', 'Stamped manifest. Deliver before it spoils.', 'Routine. Sign here, here, and here.'],
  grey: ['Manifest is "mostly" accurate.', "Pays well if you don't count the crates.", "Customs won't care. Probably."],
  shady: ['No questions. No manifest.', 'Half the bar is whispering about who wants this.', 'Do not open. Do not shake.'],
};

export function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

function rollKind(state: GameState, from: PortId): JobKind {
  const mix = port(from).mix;
  let r = rand(state) * (mix[0] + mix[1] + mix[2]);
  for (let i = 0; i < 3; i++) {
    r -= mix[i];
    if (r < 0) return KINDS[i];
  }
  return 'legit';
}

function makeJob(state: GameState, from: PortId, kind: JobKind, minTons: number, maxTons: number): Job {
  const to = pick(state, PORTS.filter(p => p.id !== from)).id;
  const tons = randInt(state, minTons, maxTons);
  const d = distance(from, to);
  return {
    id: state.nextJobId++,
    kind,
    cargo: pick(state, CARGO[kind]),
    tons,
    from,
    to,
    pay: listedPay(kind, d, tons),
    due: state.day + Math.ceil(d / DEADLINE.pxPerDay) + DEADLINE.slackDays,
    client: pick(state, CLIENTS[kind]),
    note: pick(state, NOTES[kind]),
  };
}

/** A fresh job board. Always includes one legit starter job so there is honest work that fits any ship. */
export function generateBoard(state: GameState, from: PortId): Job[] {
  const jobs = [makeJob(state, from, 'legit', BOARD.starterMinTons, BOARD.starterMaxTons)];
  const extra = randInt(state, BOARD.extraMin, BOARD.extraMax);
  for (let i = 0; i < extra; i++) jobs.push(makeJob(state, from, rollKind(state, from), BOARD.minTons, BOARD.maxTons));
  return jobs.sort((a, b) => b.pay - a.pay);
}
