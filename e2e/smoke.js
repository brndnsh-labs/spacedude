// The browser check's play-through, run inside playwright-cli by scripts/e2e.mjs (`npm run e2e`).
// It plays the core loop in a real browser with real key presses: walk, take a job from the broker, fly it,
// get paid, then lay in a course too far for one tank and make the first stopover.
//
// Walking between rooms is skipped by placing the walker on a tile (walking itself is checked once, for real),
// and flights are fast-forwarded with the dev-only `spacedude.advance()`, so the whole thing takes a few seconds.
async page => {
  const BASE = 'http://localhost:5199';
  const steps = [];
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  const check = (name, ok, detail) => {
    steps.push({ name, ok: !!ok, detail });
    if (!ok) throw new Error(`Failed: ${name}`);
  };
  const game = (fn, arg) => page.evaluate(fn, arg);
  /** Put the walker on a tile, facing a way. Tiles are 16 px. */
  const stand = (tx, ty, facing) => game(([tx, ty, facing]) => {
    const w = window.spacedude.walker;
    w.x = tx * 16 + 8;
    w.y = ty * 16 + 8;
    w.facing = facing;
    window.spacedude.advance(0.1);
  }, [tx, ty, facing]);
  const press = async (key, times = 1) => { for (let i = 0; i < times; i++) await page.keyboard.press(key); };
  const consoleText = () => game(() => {
    const el = document.getElementById('console');
    return el.hidden ? null : el.textContent;
  });
  /** Fly on autopilot until the clamps are on, up to four minutes of game time. */
  const flyUntilDocked = () => game(() => {
    for (let i = 0; i < 48 && !window.spacedude.state.docked; i++) window.spacedude.advance(5);
    return window.spacedude.state.docked;
  });
  // Tiles (see src/foot/world.ts): where to stand to use each thing.
  const SHIP = { airlock: [8, 6, 'down'], seat: [16, 4, 'right'], terminal: [16, 3, 'up'] };
  const STATION = { airlock: [8, 7, 'down'], broker: [2, 3, 'up'], fuel: [12, 3, 'up'] };

  try {
    // --- a new game in a known sector ---
    await page.goto(`${BASE}/?seed=7`);
    await page.waitForFunction(() => window.spacedude && window.spacedude.state);
    const start = await game(() => {
      const s = window.spacedude.state;
      return { seed: s.startSeed, ports: s.ports.length, docked: s.docked, credits: s.credits, query: location.search };
    });
    check('?seed=7 starts a new game in sector 7 and clears itself from the address', start.seed === 7 && start.query === '' && start.docked === 'kestrel', start);
    check('the sector has the core ports and the generated reaches', start.ports >= 12 && start.ports <= 14, start);

    // --- walking, for real ---
    const x0 = await game(() => window.spacedude.walker.x);
    await page.keyboard.down('a');
    await page.waitForTimeout(500);
    await page.keyboard.up('a');
    const x1 = await game(() => window.spacedude.walker.x);
    check('holding A walks left', x1 < x0 - 10, { x0, x1 });

    // --- take a job from the broker ---
    await stand(...SHIP.airlock);
    await press('e');
    check('the airlock leads into the station', (await game(() => window.spacedude.walker.area)) === 'station');
    await stand(...STATION.broker);
    await press('e');
    check('the broker opens the job board', ((await consoleText()) ?? '').includes('Jobs'), await consoleText());
    const pickJob = await game(() => {
      const sd = window.spacedude, s = sd.state;
      const i = s.boards[s.docked].findIndex(j => j.tons <= 12 && sd.route(j.to).length === 1);
      return { i, job: s.boards[s.docked][i] };
    });
    check('the board has work one leg away that fits the hold', pickJob.i >= 0, pickJob);
    await press('ArrowDown', pickJob.i);
    await press('Enter');
    const loaded = await game(() => {
      const s = window.spacedude.state;
      return { hold: s.hold.map(j => j.id), target: s.target };
    });
    check('Enter loads the job and lays in its course', loaded.hold.length === 1 && loaded.hold[0] === pickJob.job.id && loaded.target === pickJob.job.to, loaded);
    await press('Escape');
    check('Esc leaves the terminal', (await consoleText()) === null);

    // --- fly it and get paid ---
    await stand(...STATION.airlock);
    await press('e');
    await stand(...SHIP.seat);
    await press('e');
    check('the pilot seat casts off', (await game(() => window.spacedude.state.docked)) === null);
    await press('q');
    const arrived = await flyUntilDocked();
    const paid = await game(() => {
      const s = window.spacedude.state;
      return { delivered: s.stats.delivered, credits: s.credits, report: s.report.reduce((a, l) => a + (l.amount ?? 0), 0), hold: s.hold.length };
    });
    check('the autopilot docks at the destination', arrived === pickJob.job.to, { arrived, want: pickJob.job.to });
    check('the job is delivered and the money adds up', paid.delivered === 1 && paid.hold === 0 && paid.credits === start.credits + paid.report, paid);

    // --- top up at the dock office ---
    await stand(...SHIP.airlock);
    await press('e');
    await stand(...STATION.fuel);
    await press('e');
    check('the dock office opens the fuel pump', ((await consoleText()) ?? '').includes('Fuel dock'));
    await press('Enter');
    const fuel = await game(() => window.spacedude.state.ship.fuel);
    check('Enter fills the tank', fuel > 99, { fuel });
    await press('Escape');
    await stand(...STATION.airlock);
    await press('e');

    // --- a course too far for one tank ---
    await stand(...SHIP.terminal);
    await press('e');
    check('the ship computer opens on the chart', (await game(() => !!document.querySelector('#console svg.map'))));
    const far = await game(() => {
      const sd = window.spacedude, s = sd.state;
      const routes = s.ports.map(p => sd.route(p.id));
      const i = routes.reduce((best, r, k) => (r.length > routes[best].length ? k : best), 0);
      return { i, id: s.ports[i].id, route: routes[i] };
    });
    check('some port is more than one leg away', far.route.length > 1, far);
    await press('ArrowDown', far.i);
    await press('Enter');
    const chart = await consoleText();
    check('Enter lays in the course and the chart says how to get there', (await game(() => window.spacedude.state.target)) === far.id && chart.includes('Too far for one tank'), chart);
    await press('Escape');
    await stand(...SHIP.seat);
    await press('e');
    await press('q');
    const stop = await flyUntilDocked();
    const after = await game(() => window.spacedude.state.target);
    check('the autopilot makes the first stopover and keeps the course', stop === far.route[0] && stop !== far.id && after === far.id, { stop, route: far.route, target: after });

    check('nothing was logged as an error', errors.length === 0, errors);
    return { ok: true, steps };
  } catch (e) {
    return { ok: false, steps, error: String(e), errors };
  }
}
