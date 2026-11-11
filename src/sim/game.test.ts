import { describe, expect, it } from 'vitest';
import {
  ARM, TUNING, UPGRADES, acceptJob, atDock, autopilot, buyFuel, buyUpgrade, cargoMax, dock, fuelMax, holdTons, launch, newGame,
  stepFlight, towFee,
} from './game';
import { BOARD } from './jobs';
import type { GameState, PortId } from './types';
import { CORE, port } from './world';

function flyTo(state: GameState, target: PortId, maxSeconds: number): number {
  for (let i = 0; i < maxSeconds * 60; i++) {
    stepFlight(state, autopilot(state, target), 1 / 60);
    if (atDock(state, target)) return i / 60;
  }
  return Infinity;
}

describe('job boards', () => {
  it('give every port honest work that fits a stock ship, and never send cargo to its own port', () => {
    for (const seed of [1, 2, 3, 99]) {
      const s = newGame(seed);
      for (const p of s.ports) {
        const board = s.boards[p.id];
        expect(board.length).toBeGreaterThanOrEqual(4);
        expect(board.some(j => j.kind === 'legit' && j.tons <= BOARD.starterMaxTons)).toBe(true);
        expect(BOARD.starterMaxTons).toBeLessThanOrEqual(cargoMax(s));
        expect(board.every(j => j.to !== p.id && j.from === p.id && j.pay > 0)).toBe(true);
      }
    }
  });
});

describe('taking work', () => {
  it('moves a job from the board to the hold and points the nav at it', () => {
    const s = newGame(1);
    const job = s.boards.kestrel.find(j => j.tons <= BOARD.starterMaxTons)!;
    expect(acceptJob(s, job.id).ok).toBe(true);
    expect(s.hold).toContain(job);
    expect(s.boards.kestrel).not.toContain(job);
    expect(s.target).toBe(job.to);
  });

  it('refuses cargo that will not fit', () => {
    const s = newGame(1);
    for (const job of [...s.boards.kestrel]) acceptJob(s, job.id);
    expect(holdTons(s)).toBeLessThanOrEqual(cargoMax(s));
    s.boards.kestrel = [{ ...s.hold[0], id: 9999, tons: cargoMax(s) + 1 }];
    expect(acceptJob(s, 9999).ok).toBe(false);
  });
});

describe('docking', () => {
  it('pays out deliveries and charges fees', () => {
    const s = newGame(5);
    const job = s.boards.kestrel.find(j => j.kind === 'legit')!;
    acceptJob(s, job.id);
    launch(s);
    dock(s, job.to);
    expect(s.hold).toHaveLength(0);
    expect(s.stats.delivered).toBe(1);
    const paid = s.report.find(l => l.text.startsWith('Delivered'))!.amount!;
    expect(paid).toBeGreaterThanOrEqual(job.pay);
    expect(s.credits).toBe(TUNING.startCredits + paid - port(s, job.to).dockFee);
  });

  it('pays less for late deliveries', () => {
    const s = newGame(5);
    const job = s.boards.kestrel.find(j => j.kind === 'legit')!;
    acceptJob(s, job.id);
    launch(s);
    s.day = job.due + 1;
    dock(s, job.to);
    const paid = s.report.find(l => l.text.startsWith('Delivered'))!.amount!;
    expect(paid).toBeLessThan(job.pay);
    expect(s.report.some(l => l.text.startsWith('Crew shares'))).toBe(true);
  });
});

describe('money', () => {
  it('sells fuel on a tab, but only down to the credit floor', () => {
    // A ship with enough aboard to reach the next port gets no charity (balance.test.ts covers the one that has not).
    const s = newGame(1);
    const price = port(s, 'kestrel').fuelPrice;
    s.ship.fuel = 90;
    s.credits = TUNING.creditFloor + 10;
    expect(buyFuel(s, 'fill').ok).toBe(true);
    expect(s.ship.fuel).toBe(90 + Math.floor(10 / price));
    expect(s.credits).toBeGreaterThanOrEqual(TUNING.creditFloor);
    expect(s.credits).toBeLessThan(TUNING.creditFloor + price);
    expect(buyFuel(s, 'fill').ok).toBe(false);
  });

  it('fits upgrades only when you can pay', () => {
    const s = newGame(1);
    const cost = UPGRADES.find(u => u.id === 'cargo')!.costs[0];
    expect(buyUpgrade(s, 'cargo').ok).toBe(false);
    s.credits = cost;
    expect(buyUpgrade(s, 'cargo').ok).toBe(true);
    expect(cargoMax(s)).toBe(TUNING.cargo + TUNING.cargoStep);
    expect(s.credits).toBe(0);
  });

  it('fits upgrades only where there is a shipyard', () => {
    const s = newGame(1);
    s.credits = 5000;
    launch(s);
    dock(s, 'marrow');
    expect(port(s, 'marrow').yard).toBe(false);
    expect(buyUpgrade(s, 'engine').ok).toBe(false);
    expect(s.upgrades.engine).toBe(0);
    launch(s);
    dock(s, 'hollow');
    expect(buyUpgrade(s, 'engine').ok).toBe(true);
  });
});

describe('flight', () => {
  it('autopilot reaches every core port from every other on one tank', () => {
    for (const from of CORE) {
      for (const to of CORE) {
        if (from === to) continue;
        const s = newGame(1);
        s.docked = from.id;
        launch(s);
        const t = flyTo(s, to.id, 90);
        expect(t, `${from.id} -> ${to.id}`).toBeLessThan(60);
        // Fuel is dearer to burn than it was, but the longest leg still leaves a quarter of a stock tank spare.
        expect(fuelMax(s) - s.ship.fuel).toBeLessThan(0.75 * fuelMax(s));
      }
    }
  });

  it('tows you to the nearest port when the tank runs dry', () => {
    const s = newGame(1);
    launch(s);
    s.ship.x = 1200;
    s.ship.y = -300;
    s.ship.vx = 0;
    s.ship.fuel = 0;
    let towed = false;
    for (let i = 0; i < 600 && !towed; i++) {
      towed = stepFlight(s, { turn: 0, thrust: true, brake: false }, 1 / 60) === 'towed';
    }
    expect(towed).toBe(true);
    expect(s.docked).not.toBeNull();
    expect(s.docked).toBe('kestrel');
    expect(s.ship.x).toBe(port(s, s.docked!).x - ARM);
    // The fee grows with how far the hauler has to drag you.
    expect(s.report[0].amount).toBe(-towFee(Math.hypot(1200, 300)));
    expect(towFee(Math.hypot(1200, 300))).toBeGreaterThan(TUNING.towFee);
  });
});
