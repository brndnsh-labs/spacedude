import { describe, expect, it } from 'vitest';
import {
  ARM, TUNING, acceptJob, atDock, autopilot, buyFuel, buyUpgrade, cargoMax, dock, holdTons, launch, newGame, stepFlight,
} from './game';
import type { GameState, PortId } from './types';
import { PORTS, port } from './world';

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
      for (const p of PORTS) {
        const board = s.boards[p.id];
        expect(board.length).toBeGreaterThanOrEqual(4);
        expect(board.some(j => j.kind === 'legit' && j.tons <= 6)).toBe(true);
        expect(board.every(j => j.to !== p.id && j.from === p.id && j.pay > 0)).toBe(true);
      }
    }
  });
});

describe('taking work', () => {
  it('moves a job from the board to the hold and points the nav at it', () => {
    const s = newGame(1);
    const job = s.boards.kestrel.find(j => j.tons <= 6)!;
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
    expect(s.credits).toBe(300 + paid - port(job.to).dockFee);
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
    const s = newGame(1);
    s.ship.fuel = 0;
    s.credits = TUNING.creditFloor + 10;
    expect(buyFuel(s, 'fill').ok).toBe(true);
    expect(s.ship.fuel).toBe(5);
    expect(s.credits).toBe(TUNING.creditFloor);
    expect(buyFuel(s, 'fill').ok).toBe(false);
  });

  it('fits upgrades only when you can pay', () => {
    const s = newGame(1);
    expect(buyUpgrade(s, 'cargo').ok).toBe(false);
    s.credits = 500;
    expect(buyUpgrade(s, 'cargo').ok).toBe(true);
    expect(cargoMax(s)).toBe(18);
    expect(s.credits).toBe(0);
  });
});

describe('flight', () => {
  it('autopilot reaches every port from every other on one tank', () => {
    for (const from of PORTS) {
      for (const to of PORTS) {
        if (from === to) continue;
        const s = newGame(1);
        s.docked = from.id;
        launch(s);
        const t = flyTo(s, to.id, 90);
        expect(t, `${from.id} -> ${to.id}`).toBeLessThan(60);
        expect(100 - s.ship.fuel).toBeLessThan(60);
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
    expect(s.ship.x).toBe(port(s.docked!).x - ARM);
    expect(s.report[0].amount).toBe(-TUNING.towFee);
  });
});
