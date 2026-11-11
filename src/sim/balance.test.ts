/**
 * Guardrails for the economy. These play real seeded games through the sim (see harness.ts) and assert
 * the things the design depends on. Seeds are fixed, so results only move when rules or numbers change;
 * the bounds are deliberately loose, so retuning a constant should not trip them but breaking a promise will.
 *
 * `npm run balance` runs this file in "balance" mode, which also prints the full comparison tables.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { runBalance } from './balance';
import type { Balance } from './balance';
import { careless, monkey, planner } from './bots';
import {
  ARM, TUNING, UPGRADES, buyFuel, buyUpgrade, dock, dockable, fuelFor, fuelMax, launch, limpFuel, newGame, stepFlight, upgradeCost,
} from './game';
import { canLeaveDock, flyTo, playMany, seedRange } from './harness';
import { PAY, RISK } from './jobs';
import type { GameState, PortId } from './types';
import { PORTS, distance } from './world';

const FULL = import.meta.env.MODE === 'balance';

/** A docked ship in whatever sorry state we like. */
function wreck(at: PortId, fuel: number, credits: number, upgrades = { cargo: 0, tank: 0, engine: 0 }): GameState {
  const s = newGame(7);
  s.upgrades = { ...upgrades };
  launch(s);
  dock(s, at);
  s.ship.fuel = fuel;
  s.credits = credits;
  return s;
}

describe('nobody gets stuck', () => {
  it('a dry tank and a maxed tab is not a dead end: the port fronts enough fuel to reach any other port', () => {
    // The suspected soft-lock: before the fix buyFuel refused, launch refused, and that was the end of the game.
    for (const from of PORTS) {
      for (const engine of [0, 3]) {
        for (const tank of [0, 3]) {
          for (const credits of [TUNING.creditFloor - 400, TUNING.creditFloor, TUNING.creditFloor + 1, TUNING.creditFloor + 30]) {
            for (const fuel of [0, 0.5, 0.99]) {
              const s = wreck(from.id, fuel, credits, { cargo: 0, tank, engine });
              const where = `${from.id}, engine ${engine}, tank ${tank}, ${credits} cr, ${fuel} fuel`;
              expect(buyFuel(s, 'fill').ok, where).toBe(true);
              expect(s.ship.fuel, where).toBeGreaterThanOrEqual(limpFuel(s, from.id) - 1e-9);
              expect(s.credits, where).toBeGreaterThanOrEqual(Math.min(credits, TUNING.creditFloor));
              expect(launch(s).ok, where).toBe(true);
            }
          }
        }
      }
    }
  });

  it('that fronted fuel really does reach the farthest port, and delivering there pays', () => {
    for (const from of PORTS) {
      for (const engine of [0, 1, 2, 3]) {
        const far = [...PORTS].sort((a, b) => distance(from.id, b.id) - distance(from.id, a.id))[0].id;
        const s = wreck(from.id, 0, TUNING.creditFloor, { cargo: 0, tank: 0, engine });
        expect(buyFuel(s, 'fill').ok).toBe(true);
        expect(s.credits).toBe(TUNING.creditFloor);
        expect(s.ship.fuel).toBeLessThan(fuelMax(s)); // a ration, not a free fill
        launch(s);
        expect(flyTo(s, far, 1 / 30), `${from.id} -> ${far}, engine ${engine}`).toBe('arrived');
      }
    }
  });

  it('the tab stops at the credit floor whatever happens: tows, fees, upkeep and fines are waved off past it', () => {
    const s = wreck('kestrel', 3, TUNING.creditFloor + 20);
    launch(s);
    s.ship.x = 1200;
    s.ship.y = -300;
    let towed = false;
    for (let i = 0; i < 3000 && !towed; i++) towed = stepFlight(s, { turn: 0, thrust: true, brake: false }, 1 / 60) === 'towed';
    expect(towed).toBe(true);
    expect(s.credits).toBe(TUNING.creditFloor);
    expect(s.report.reduce((a, l) => a + (l.amount ?? 0), 0)).toBe(-20); // the report still adds up
    expect(canLeaveDock(s)).toBe(true);
  });

  it('the tab still has a limit for a ship that can already reach the next port', () => {
    const s = wreck('kestrel', 0, TUNING.creditFloor);
    buyFuel(s, 'fill');
    expect(buyFuel(s, 'fill').ok).toBe(false);
    expect(buyFuel(s, 10).ok).toBe(false);
  });

  it('refuses to "buy" a negative amount of fuel', () => {
    const s = wreck('kestrel', 50, 100);
    expect(buyFuel(s, -40).ok).toBe(false);
    expect(s.credits).toBe(100);
    expect(s.ship.fuel).toBe(50);
  });

  it('random button-mashing never finds a state with no way out', () => {
    const logs = playMany(monkey(), seedRange(FULL ? 300 : 60, 11), { days: 80 });
    expect(logs.filter(g => g.stuck).map(g => `${g.seed}: ${g.stuck}`)).toEqual([]);
    expect(logs.reduce((a, g) => a + g.lost + g.belowFloor, 0)).toBe(0);
    expect(logs.every(g => canLeaveDock(g.final))).toBe(true);
  });
});

describe('job boards cannot be rerolled for free', () => {
  it('casting off and docking straight back in shows the same board', () => {
    const s = newGame(3);
    const before = s.boards.kestrel.map(j => j.id);
    launch(s);
    expect(dockable(s)).toBe('kestrel'); // the game lets you do this: L, then E
    dock(s, 'kestrel');
    expect(s.boards.kestrel.map(j => j.id)).toEqual(before);
  });

  it('a new day brings a new board', () => {
    const s = newGame(3);
    const before = s.boards.kestrel.map(j => j.id);
    launch(s);
    s.day += 1;
    dock(s, 'kestrel');
    expect(s.boards.kestrel.map(j => j.id)).not.toEqual(before);
  });

  it('a save from before boards were dated still loads and gets a board', () => {
    const s = newGame(3);
    Reflect.deleteProperty(s, 'boardDay');
    launch(s);
    dock(s, 'marrow');
    expect(s.boards.marrow.length).toBeGreaterThanOrEqual(4);
    expect(s.boardDay?.marrow).toBe(s.day);
  });
});

describe('the numbers add up on paper', () => {
  it('riskier work lists higher, pays more on average, and can pay worse than honest work', () => {
    const grey = PAY.mult.grey * (1 - RISK.shortChance * (1 - RISK.shortKeep));
    const shady = PAY.mult.shady * (1 - RISK.fineChance * RISK.finePay);
    const legit = 1 + RISK.tipChance * RISK.tipFrac;
    expect(PAY.mult.shady).toBeGreaterThan(PAY.mult.grey);
    expect(PAY.mult.grey).toBeGreaterThan(1);
    // Better on average, in that order, but not by so much that honest work is pointless...
    expect(grey).toBeGreaterThan(legit * 1.03);
    expect(shady).toBeGreaterThan(grey * 1.03);
    expect(shady).toBeLessThan(legit * 1.6);
    // ...and a bad day on either is worse than an ordinary day of honest work.
    expect(PAY.mult.grey * RISK.shortKeep).toBeLessThan(0.9);
    expect(PAY.mult.shady * (1 - RISK.finePay)).toBeLessThan(0.9);
  });

  it('a tow never beats buying the fuel', () => {
    // Running dry past halfway gets you towed to where you were going. That must cost more than the fuel it saves...
    const s = newGame(1);
    for (const a of PORTS) {
      for (const b of PORTS) {
        if (a !== b) expect(TUNING.towFee, `${a.id} -> ${b.id}`).toBeGreaterThan((fuelFor(s, distance(a.id, b.id)) / 2) * a.fuelPrice);
      }
    }
    // ...and it must not save time either: the hauler is no faster than a stock ship.
    expect(TUNING.towSpeed).toBeLessThanOrEqual(TUNING.accel / TUNING.drag);
    const t = wreck('kestrel', 100, 0);
    launch(t);
    const day = t.day + t.dayFrac;
    t.ship.x = 1200;
    t.ship.y = -300;
    t.ship.vx = 0;
    t.ship.fuel = 0;
    while (!t.docked) stepFlight(t, { turn: 0, thrust: false, brake: false }, 1 / 60);
    const flown = Math.hypot(1200 + ARM, 300) / (TUNING.accel / TUNING.drag) / TUNING.secondsPerDay;
    expect(t.day + t.dayFrac - day).toBeGreaterThan(flown);
  });

  it('docking where you are already docked changes nothing', () => {
    // The game shell docks again after a tow has already berthed the ship. That used to cost a second
    // docking fee, reroll the board and wipe the tow off the arrival report.
    const s = wreck('marrow', 40, 250);
    const before = structuredClone(s);
    dock(s, 'marrow');
    expect(s).toEqual(before);
  });

  it('every upgrade level can be bought and none is priced out of reach of a tab-free player', () => {
    for (const u of UPGRADES) {
      const s = newGame(1);
      for (const cost of u.costs) {
        expect(upgradeCost(s, u.id)).toBe(cost);
        s.credits = cost;
        expect(buyUpgrade(s, u.id).ok).toBe(true);
        expect(s.credits).toBe(0);
      }
      expect(upgradeCost(s, u.id)).toBeNull();
    }
  });
});

describe('the economy, played out', () => {
  let b: Balance;
  beforeAll(() => {
    b = runBalance({ games: 40, days: 100, worth: { levels: [1], bots: [planner, careless] } });
  }, 300_000);

  it('no strategy ever gets stuck, loses a ship in flight, or sinks below the credit floor', () => {
    for (const s of [...Object.values(b.stock), ...Object.values(b.played), ...Object.values(b.probes)]) {
      expect(s.stuckShare, s.bot).toBe(0);
      expect(s.lost, s.bot).toBe(0);
      expect(s.belowFloor, s.bot).toBe(0);
      expect(s.minCreditsWorst, s.bot).toBeGreaterThanOrEqual(TUNING.creditFloor);
    }
  });

  it('honest work is steady: a careful legit-only player earns in every game and rarely loses money on a trip', () => {
    for (const name of ['cautious', 'legit-planner']) {
      const s = b.stock[name];
      expect(s.netPerDayP10, name).toBeGreaterThan(0);
      expect(s.losingTrips, name).toBeLessThan(0.2);
      expect(s.minCreditsWorst, name).toBeGreaterThan(-150); // never needs more than a splash of fuel on the tab
      expect(s.towsPer100Trips, name).toBe(0);
      expect(b.played[name].endedInDebt, name).toBe(0);
      // ...and never needs the harbormaster's charity.
      expect(s.aidPerDay + b.played[name].aidPerDay, name).toBe(0);
    }
  });

  it('but only modestly: a first upgrade takes a careful legit-only player roughly 6-10 deliveries', () => {
    for (const name of ['cautious', 'legit-planner']) {
      const s = b.played[name];
      expect(s.reachedFirstUpgrade, name).toBe(1);
      expect(s.upgradeAtDelivery[0], name).toBeGreaterThanOrEqual(4);
      expect(s.upgradeAtDelivery[0], name).toBeLessThanOrEqual(14);
    }
    // Nobody is done with the yard in the first few minutes, and the honest player does get there eventually.
    expect(b.played.planner.upgradeAtDelivery[0]).toBeGreaterThanOrEqual(3);
    expect(b.played.cautious.upgradesAtEnd).toBeGreaterThanOrEqual(3);
  });

  it('shady work out-earns honest work on average, with clearly more variance', () => {
    expect(b.stock.shady.netPerDay).toBeGreaterThan(b.stock.cautious.netPerDay * 1.1);
    expect(b.stock.shady.tripSd).toBeGreaterThan(b.stock.cautious.tripSd * 1.4);
    expect(b.stock.shady.losingTrips).toBeGreaterThan(b.stock.cautious.losingTrips);
    expect(b.stock.planner.netPerDay).toBeGreaterThan(b.stock['legit-planner'].netPerDay * 1.1);
    expect(b.stock.planner.tripSd).toBeGreaterThan(b.stock['legit-planner'].tripSd * 1.2);
    // The same holds job for job, measured against an equal legit load.
    expect(b.kinds.grey.mean).toBeGreaterThan(b.kinds.legit.mean);
    expect(b.kinds.shady.mean).toBeGreaterThan(b.kinds.grey.mean);
    expect(b.kinds.grey.sd).toBeGreaterThan(b.kinds.legit.sd * 1.5);
    expect(b.kinds.shady.sd).toBeGreaterThan(b.kinds.grey.sd * 1.5);
    expect(b.kinds.shady.worst).toBeLessThan(b.kinds.legit.worst);
  });

  it('no way of playing runs away with it, and none is a trap', () => {
    // Taking risks pays, but not so much that honest work is a mistake.
    expect(b.stock.planner.netPerDay).toBeLessThan(b.stock['legit-planner'].netPerDay * 2);
    expect(b.stock.shady.netPerDay).toBeLessThan(b.stock.cautious.netPerDay * 2);
    // Every ordinary way of playing makes a living, even the player who never looks at the fuel gauge.
    for (const name of ['cautious', 'legit-planner', 'greedy', 'planner', 'shady', 'careless']) {
      expect(b.stock[name].netPerDay, name).toBeGreaterThan(0);
      expect(b.played[name].netPerDay, name).toBeGreaterThan(0);
    }
    expect(b.stock.careless.netPerDayP10).toBeGreaterThan(0);
    // The safety net is a net, not an income: nobody who is trying lives off it.
    for (const name of ['greedy', 'planner', 'shady', 'careless']) {
      expect(b.stock[name].aidPerDay, name).toBeLessThan(0.1 * b.stock[name].netPerDay);
    }
  });

  it('known exploits stay closed', () => {
    // Rerolling the board by re-docking, or by drifting outside for a day, must not beat just getting on with it.
    expect(b.probes['reroll-redock'].netPerDay).toBeLessThan(b.stock.planner.netPerDay * 1.02);
    expect(b.probes['reroll-layover'].netPerDay).toBeLessThan(b.stock.planner.netPerDay * 1.02);
    // Riding the tow truck must not beat flying the whole way.
    expect(b.probes['tow-hopper'].netPerDay).toBeLessThan(b.stock.cautious.netPerDay);
  });

  it('deadlines are easy flown direct and bite when you detour', () => {
    // Flown straight to its port, a job is on time. Carried via another port first, it is a coin toss.
    for (const name of ['cautious', 'greedy', 'shady']) expect(b.stock[name].lateDirect, name).toBeLessThan(0.02);
    expect(b.stock.greedy.lateDetour).toBeGreaterThan(0.1);
    expect(b.stock.greedy.lateDetour).toBeLessThan(0.75);
    // A player who plans the route can still make multi-drop runs pay without being late all the time.
    expect(b.stock.planner.lateShare).toBeLessThan(0.1);
  });

  it('every port is worth waking up at, and none is the only place to be', () => {
    for (const name of ['legit-planner', 'planner']) {
      const s = b.stock[name];
      for (const p of PORTS) {
        expect(s.visits[p.id], `${name} visits ${p.id}`).toBeGreaterThan(0.12);
        expect(s.visits[p.id], `${name} visits ${p.id}`).toBeLessThan(0.45);
        expect(s.netFrom[p.id], `${name} leaving ${p.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('every upgrade earns something for the player it suits, and pays for itself in a sane number of trips', () => {
    const best = (id: string) => Math.min(...Object.values(b.worth).map(rows => rows.find(u => u.id === id && u.level === 1)!.paybackTrips));
    expect(best('cargo')).toBeLessThan(40);
    expect(best('engine')).toBeLessThan(40);
    // The aux tank is the weak one: it only pays through cheap-fuel runs and fewer tows. Loose on purpose.
    expect(best('tank')).toBeLessThan(90);
  });

  it('prints the comparison tables (npm run balance)', () => {
    if (!FULL) return;
    console.log('\n' + runBalance({ games: 200, days: 150, worth: { levels: [1, 2, 3], games: 80 } }).text + '\n');
  }, 900_000);
});
