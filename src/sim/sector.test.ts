import { describe, expect, it } from 'vitest';
import { TUNING, atDock, autopilot, fuelFor, launch, limpFuel, newGame, stepFlight } from './game';
import { BOARD } from './jobs';
import { nextStop, planRoute } from './nav';
import { SECTOR, fallbackSector, generateSector, sectorProblems } from './sector';
import { CORE, CORE_REGION, charted, distance, neighbours, port } from './world';

const SEEDS = Array.from({ length: 400 }, (_, i) => 1 + i * 7919);

describe('a generated sector', () => {
  it('is sound for every seed: unique names, room between ports, every port on the chart', () => {
    let fallbacks = 0;
    for (const seed of SEEDS) {
      const s = generateSector({ seed });
      expect(sectorProblems(s), `seed ${seed}`).toEqual([]);
      const made = s.ports.length - CORE.length;
      expect(made).toBeGreaterThanOrEqual(SECTOR.newMin);
      expect(made).toBeLessThanOrEqual(SECTOR.newMax);
      const reaches = new Set(s.ports.map(p => p.region));
      expect(reaches.size).toBe(SECTOR.reaches + 1);
      if (s.ports[CORE.length].x === Math.round(-4300 + Math.cos(Math.PI / 2) * 900)) fallbacks++;
    }
    // The fixed fallback layout is a safety net, not the usual result.
    expect(fallbacks).toBeLessThan(SEEDS.length * 0.02);
  });

  it('always keeps the four core ports where they are', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const s = generateSector({ seed });
      for (const core of CORE) expect(port(s, core.id)).toEqual(core);
      expect(s.ports.filter(p => p.region === CORE_REGION)).toHaveLength(CORE.length);
    }
  });

  it('comes back the same from a game\'s starting seed, however far that game has played on', () => {
    const s = newGame(1234);
    expect(s.startSeed).toBe(1234);
    launch(s);
    for (let i = 0; i < 600; i++) stepFlight(s, autopilot(s, 'marrow'), 1 / 60);
    expect(newGame(s.startSeed!).ports).toEqual(s.ports);
  });

  it('is the same sector for the same seed, and a different one for another', () => {
    expect(generateSector({ seed: 42 })).toEqual(generateSector({ seed: 42 }));
    expect(generateSector({ seed: 42 }).ports.map(p => p.name)).not.toEqual(generateSector({ seed: 43 }).ports.map(p => p.name));
  });

  it('has a shipyard somewhere past the core', () => {
    for (const seed of SEEDS) expect(generateSector({ seed }).ports.some(p => p.region !== CORE_REGION && p.yard), `seed ${seed}`).toBe(true);
  });

  it('has a sound fallback layout', () => {
    for (const seed of SEEDS.slice(0, 50)) expect(sectorProblems(fallbackSector({ seed }))).toEqual([]);
  });
});

describe('charted lanes', () => {
  it('are all within a stock tank, with the fuel a broke captain is fronted', () => {
    for (const seed of SEEDS) {
      const s = newGame(seed);
      for (const [a, b] of s.lanes) {
        expect(fuelFor(s, distance(s, a, b)) + TUNING.limpMargin, `seed ${seed}, ${a}-${b}`).toBeLessThanOrEqual(TUNING.tank);
      }
      for (const p of s.ports) {
        expect(neighbours(s, p.id).length).toBeGreaterThanOrEqual(1);
        expect(limpFuel(s, p.id)).toBeLessThanOrEqual(TUNING.tank);
      }
    }
  });

  it('can really be flown by the autopilot on that much fuel', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const s = newGame(seed);
      for (const [a, b] of s.lanes) {
        for (const [from, to] of [[a, b], [b, a]]) {
          const t = structuredClone(s);
          t.docked = from;
          t.ship.fuel = limpFuel(t, from);
          launch(t);
          let arrived = false;
          for (let i = 0; i < 120 * 60 && !arrived; i++) {
            stepFlight(t, autopilot(t, to), 1 / 60);
            arrived = atDock(t, to);
          }
          expect(arrived, `seed ${seed}, ${from} -> ${to}`).toBe(true);
        }
      }
    }
  });

  it('give the charted distance between any two ports, never shorter than the straight line', () => {
    const s = newGame(5);
    for (const a of s.ports) {
      for (const b of s.ports) {
        const c = charted(s, a.id, b.id);
        expect(Number.isFinite(c.dist)).toBe(true);
        expect(c.dist).toBeGreaterThanOrEqual(distance(s, a.id, b.id) - 1e-6);
        expect(c.hops).toBe(a === b ? 0 : Math.max(1, c.hops));
      }
    }
  });
});

describe('the nav computer', () => {
  it('routes a stock ship to any port in legs its tank covers', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const s = newGame(seed);
      for (const a of s.ports) {
        for (const b of s.ports) {
          if (a === b) continue;
          const route = planRoute(s, a.id, b.id);
          expect(route.at(-1)).toBe(b.id);
          let at = a.id;
          for (const stop of route) {
            expect(fuelFor(s, distance(s, at, stop)) + TUNING.limpMargin, `seed ${seed}: ${at} -> ${stop}`).toBeLessThanOrEqual(TUNING.tank);
            at = stop;
          }
        }
      }
    }
  });

  it('cuts corners with a bigger tank', () => {
    let shorter = 0, total = 0;
    for (const seed of SEEDS.slice(0, 40)) {
      const stock = newGame(seed), tanked = newGame(seed);
      tanked.upgrades.tank = 3;
      for (const a of stock.ports) {
        for (const b of stock.ports) {
          if (a === b) continue;
          total++;
          const before = planRoute(stock, a.id, b.id).length, after = planRoute(tanked, a.id, b.id).length;
          expect(after).toBeLessThanOrEqual(before);
          if (after < before) shorter++;
        }
      }
    }
    expect(shorter / total).toBeGreaterThan(0.15);
  });

  it('points a docked ship at the first stop, and a ship short of fuel in flight at somewhere it can reach', () => {
    const s = newGame(9);
    const far = [...s.ports].sort((a, b) => charted(s, 'kestrel', b.id).hops - charted(s, 'kestrel', a.id).hops)[0];
    s.target = far.id;
    const route = planRoute(s, 'kestrel', far.id);
    expect(route.length).toBeGreaterThan(1);
    expect(nextStop(s)).toBe(route[0]);
    launch(s);
    expect(nextStop(s)).toBe(route[0]);
    s.ship.fuel = 3;
    expect(nextStop(s)).toBe('kestrel'); // only home is in reach: turn back
  });
});

describe('job boards in a generated sector', () => {
  it('always offer honest work one lane away that fits a stock ship', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const s = newGame(seed);
      for (const p of s.ports) {
        const board = s.boards[p.id];
        expect(board.some(j => j.kind === 'legit' && j.tons <= BOARD.starterMaxTons && charted(s, p.id, j.to).hops === 1), `seed ${seed}, ${p.id}`).toBe(true);
        expect(board.every(j => j.to !== p.id && j.pay > 0)).toBe(true);
      }
    }
  });

  it('send most work next door and some of it a long way', () => {
    let near = 0, far = 0;
    for (const seed of SEEDS.slice(0, 60)) {
      const s = newGame(seed);
      for (const p of s.ports) for (const j of s.boards[p.id]) charted(s, p.id, j.to).hops === 1 ? near++ : far++;
    }
    const share = far / (near + far);
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.5);
  });
});
