# Spacedude

A cozy space-trucking game in the browser: take jobs, haul cargo between ports, pay the bills, fix up the ship. Firefly in tone. TypeScript, Vite, plain Canvas 2D, no game framework.

## Design pillars

- **Cozy.** Nobody dies and nothing is game over. Running dry means a tow; being broke means fuel on a tab. Any rule change has to keep "there is always a way to take a job and deliver it".
- **Two looks.** The world is dusty pixel art on a 320x180 canvas scaled by whole numbers. Ship and station computers are an amber phosphor terminal drawn in the DOM.
- **Immersion on foot.** The player walks the ship and stations and uses things there (seat, terminal, airlock, counters). Don't add a menu for something that could be a place to walk to.

## Commands

- `npm run dev` - dev server. Add `?new` for a new game, `?seed=123` for a new game in a known sector.
- `npm test` - unit tests and balance guardrails (about 10 s).
- `npm run typecheck` - `tsc --noEmit`.
- `npm run balance` - full bot tables, 200 games per play style (about 3 min). Run it after touching money, fuel, jobs or the map.
- `npm run e2e` - plays the game in a real browser through `playwright-cli` (about 10 s). Run it after touching `src/main.ts`, `src/ui/` or `src/foot/`.

## Layout

- `src/sim/` - the rules. No DOM, no rendering, no globals: everything hangs off `GameState`, including the RNG (`state.seed`) and the generated sector (`state.ports`, `state.lanes`). That is what lets bots play it headless.
  - `sector.ts` generates the map; `world.ts` holds the four fixed core ports and lookups; `nav.ts` plans routes; `jobs.ts` and `game.ts` are the economy and flight.
  - `bots.ts`, `harness.ts`, `balance.ts` are the balance harness. They ship with the repo but not the game.
- `src/flight/` - the flight view. All art is drawn by code into canvases; generated ports reuse a type's drawing with the hue turned.
- `src/foot/` - walking: tile maps in `world.ts`, art in `art.ts`.
- `src/ui/` - the terminal (`console.ts`) and HUD (`hud.ts`), sized in `cqw` so they scale with the stage.
- `src/main.ts` - input, modes (on foot / at the helm) and the frame loop.
- `e2e/smoke.js` + `scripts/e2e.mjs` - the browser check.

## Rules of the road

- Tuning lives in exported constants: `TUNING` and `UPGRADES` (game.ts), `PAY`, `RISK`, `BOARD`, `DEADLINE`, `REACH` (jobs.ts), `SECTOR` and `PORT_TYPES` (sector.ts). Change numbers there, not inline. Flight feel (turn rate, accel, drag, docking) is tuned by hand: leave it alone unless asked.
- Every port must stay joined to the rest by lanes a stock tank can fly; `sector.test.ts` checks hundreds of seeds. A new map rule needs a test there.
- A guardrail in `balance.test.ts` is a promise about how the game feels. If a change breaks one, fix the game first; loosen the test only with a comment saying what changed and why, and tell the user.
- Changing what a save holds: bump the key in `save.ts` or make the new field optional. Old saves must load or be cleanly dropped, never crash.
- Comments say why, in plain words. British spelling in code (`colour`, `neighbours`).

## Checking work in a browser

- The dev build exposes `window.spacedude`: `state`, `walker`, `route(portId)`, and `advance(seconds)` to fast-forward. `e2e/smoke.js` shows how to drive the game with them.
- The in-app Browser pane throttles to about one frame a second when it is not visible, so real-time flights crawl there. Use `spacedude.advance()` or `playwright-cli`, which runs at full frame rate.
- `npm run e2e` uses Playwright's own Chromium (`playwright-cli install-browser chrome-for-testing` if it is missing). When driving `playwright-cli` by hand, pass `--browser=chromium` to `open`: its default is the Google Chrome app, which may not be installed. A git-ignored `.playwright/cli.config.json` overrides the browser for one machine.
