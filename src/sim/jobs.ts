import { pick, rand, randInt } from './rng';
import type { GameState, Job, JobKind, PortId } from './types';
import { PORTS, distance, port } from './world';

const KINDS: readonly JobKind[] = ['legit', 'grey', 'shady'];
const PAY_MULT: Record<JobKind, number> = { legit: 1, grey: 1.4, shady: 2.1 };

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

export const round5 = (n: number) => Math.round(n / 5) * 5;

function rollKind(state: GameState, from: PortId): JobKind {
  const mix = port(from).mix;
  let r = rand(state) * (mix[0] + mix[1] + mix[2]);
  for (let i = 0; i < 3; i++) {
    r -= mix[i];
    if (r < 0) return KINDS[i];
  }
  return 'legit';
}

function makeJob(state: GameState, from: PortId, kind: JobKind, maxTons: number): Job {
  const to = pick(state, PORTS.filter(p => p.id !== from)).id;
  const tons = randInt(state, 2, maxTons);
  const d = distance(from, to);
  return {
    id: state.nextJobId++,
    kind,
    cargo: pick(state, CARGO[kind]),
    tons,
    from,
    to,
    pay: round5((60 + d * 0.05) * (0.6 + tons / 10) * PAY_MULT[kind]),
    due: state.day + Math.ceil(d / 900) + 2,
    client: pick(state, CLIENTS[kind]),
    note: pick(state, NOTES[kind]),
  };
}

/** A fresh job board. Always includes one small legit job so there is honest work that fits any ship. */
export function generateBoard(state: GameState, from: PortId): Job[] {
  const jobs = [makeJob(state, from, 'legit', 6)];
  const extra = randInt(state, 3, 4);
  for (let i = 0; i < extra; i++) jobs.push(makeJob(state, from, rollKind(state, from), 14));
  return jobs.sort((a, b) => b.pay - a.pay);
}
