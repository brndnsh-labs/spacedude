/**
 * Runs every bot over many seeded games and lays the results out side by side.
 * `npm run balance` prints the tables; `balance.test.ts` asserts the invariants.
 */
import { PROBES, STRATEGIES, careless, cautious, legitPlanner, monkey, planner } from './bots';
import {
  kindStats, kindTable, playMany, portsTable, seedRange, summarise, summaryTable, upgradeTable, upgradeWorth, worthTable,
} from './harness';
import type { Bot, KindStats, Summary, UpgradeWorth } from './harness';
import { PAY } from './jobs';

export interface BalanceOptions {
  /** Games per strategy. */
  games: number;
  /** Game-days per game (the clock only runs in flight, so 100 days is about 17 minutes of flying). */
  days: number;
  /** Price upgrades with what-if runs: which levels, for which bots. Each level costs six more batches of games per bot. */
  worth?: { levels: readonly number[]; bots?: readonly ((buys?: boolean) => Bot)[]; games?: number };
}

export interface Balance {
  /** Each strategy on a stock ship that never upgrades: the bare economics of each way of playing. */
  stock: Record<string, Summary>;
  /** Each strategy buying upgrades as it goes: how a real game unfolds. */
  played: Record<string, Summary>;
  /** Exploit probes on a stock ship, to hold against the honest strategy each is built on. */
  probes: Record<string, Summary>;
  kinds: Record<'legit' | 'grey' | 'shady', KindStats>;
  /** What each upgrade level is worth to each kind of player, keyed by bot name. */
  worth: Record<string, UpgradeWorth[]>;
  text: string;
}

const WORTH_BOTS = [cautious, legitPlanner, planner, careless] as const;

export function runBalance(opts: BalanceOptions): Balance {
  const seeds = seedRange(opts.games);
  const run = { days: opts.days };
  const all: readonly ((buys?: boolean) => Bot)[] = [...STRATEGIES, monkey];

  const stockLogs = all.map(make => playMany(make(false), seeds, run));
  const stock = stockLogs.map(summarise);
  const played = all.map(make => summarise(playMany(make(true), seeds, run)));
  const probes = PROBES.map(make => summarise(playMany(make(false), seeds, run)));
  // Job kinds compared like for like: what was received, in units of an equal legit job's listed pay.
  const kinds = kindStats(stockLogs.flat(), d => d.listed / PAY.mult[d.kind]);
  const worth: Record<string, UpgradeWorth[]> = {};
  if (opts.worth) {
    const some = seeds.slice(0, opts.worth.games ?? seeds.length);
    for (const make of opts.worth.bots ?? WORTH_BOTS) worth[make().name] = upgradeWorth(make, some, run, opts.worth.levels);
  }

  const text = [
    `Spacedude balance: ${opts.games} games x ${opts.days} game-days per strategy. The clock only runs in flight; a trip is about 3 days.`,
    '',
    'STOCK SHIP, NO UPGRADES - what each way of playing earns',
    summaryTable(stock),
    '',
    'BUYING UPGRADES - cheapest first, as soon as affordable',
    summaryTable(played),
    '',
    'PROGRESSION - median deliveries / game-days until the Nth upgrade is fitted',
    upgradeTable(played),
    '',
    "JOB KINDS - credits received per job, in units of an equal legit job's listed pay",
    kindTable(kinds),
    '',
    'PORTS - share of dock visits, and the average net of a trip setting out from each port (stock ship)',
    portsTable(stock),
    '',
    'EXPLOIT PROBES (stock ship) - each should do no better than the honest strategy it is built on',
    summaryTable(probes),
    ...Object.entries(worth).flatMap(([bot, rows]) => [
      '',
      'UPGRADE PAYBACK - same seeds with and without each level, nothing else bought',
      worthTable(bot, rows),
    ]),
    '',
    'Strategies:',
    ...[...all, ...PROBES].map(make => `  ${make().name}: ${make().about}`),
    'Columns:',
    '  net = change in credits plus money put into upgrades. p10..p90 = spread of net/day across games.',
    '  trip sd = spread of net over one dock-to-dock trip. lose% = trips that lost money.',
    '  late = share of deliveries past their due day; direct = of jobs flown straight there; detour = of jobs that went via another port.',
    '  min cr = lowest balance seen in a game (average over games, then the worst game).',
    '  aid/day = charity: debt waved off at the credit floor plus fuel fronted to a broke ship.',
    '  stuck = games that ended docked with no way to launch.',
  ].join('\n');

  const byName = (rows: Summary[]) => Object.fromEntries(rows.map(r => [r.bot, r]));
  return {
    stock: byName(stock), played: byName(played), probes: byName(probes),
    kinds: Object.fromEntries(kinds.map(k => [k.kind, k])) as Balance['kinds'],
    worth, text,
  };
}
