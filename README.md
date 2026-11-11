# Spacedude

A cozy space-trucking game. Take jobs, haul cargo between ports, pay your bills, fix up your ship, and get by.

This is an early prototype of the core loop: one freighter and a sector of about a dozen ports.

Every new game rolls its own sector. The four ports of the Halcyon Core are always there; around them the game generates three outlying reaches of two to four ports each, with their own names, prices, work and colours. The sector is saved with the game, so it stays put while you learn it.

## Play

```bash
npm install
npm run dev
```

Then open the URL Vite prints.

- **On foot:** arrows or `WASD` to walk, `E` to use what you're facing. Aboard, that's the pilot's seat, the ship's computer, the airlock and a few comforts. In a station, it's the work broker, the dock office and the shipyard counter.
- **At the helm:** arrows or `WASD` to fly, `Q` for autopilot, `E` to dock, `Tab` for the ship's computer, `X` to stand up. The ship keeps flying while you walk around.
- **Terminals:** number keys switch tabs, arrows move, `Enter` acts, `Esc` leaves.
- **Getting around:** the ship's computer has a chart of the sector. Lay in a course for anywhere; if it is too far for one tank, the autopilot flies it in legs and stops at ports on the way so you can refuel. A bigger tank cuts corners.
- Add `?new` to the URL to start a new game, or `?seed=123` to start one in a particular sector. The ship computer's Log tab shows the seed of the sector you're in.

You can't lose. Fuel goes on a tab when you're broke, the helm warns you before you cast off without the fuel to reach your next stop, and running dry gets you towed to the nearest port for a fee.

## Layout

- `src/sim/` is the game's rules (sector generation, jobs, money, flight physics, route finding, autopilot) with no rendering, covered by `npm test`. `npm run balance` plays bots through hundreds of generated sectors and prints how each way of playing fares.
- `src/flight/` draws the pixel-art flight view.
- `src/foot/` is walking around: the ship's deck and station rooms as tile maps, with their art.
- `src/ui/` is the amber terminal screens and the HUD.
- `e2e/` and `scripts/` are the browser check: `npm run e2e` plays the game through in a real browser. It needs [playwright-cli](https://github.com/microsoft/playwright-cli) installed.
- `mockups/` holds the art-style explorations the look was chosen from.
