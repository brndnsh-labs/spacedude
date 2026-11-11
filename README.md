# Spacedude

A cozy space-trucking game. Take jobs, haul cargo between ports, pay your bills, fix up your ship, and get by.

This is an early prototype of the core loop: one star system, four ports, one freighter.

## Play

```bash
npm install
npm run dev
```

Then open the URL Vite prints.

- **On foot:** arrows or `WASD` to walk, `E` to use what you're facing. Aboard, that's the pilot's seat, the ship's computer, the airlock and a few comforts. In a station, it's the work broker, the dock office and the shipyard counter.
- **At the helm:** arrows or `WASD` to fly, `Q` for autopilot, `E` to dock, `Tab` for the ship's computer, `X` to stand up. The ship keeps flying while you walk around.
- **Terminals:** number keys switch tabs, arrows move, `Enter` acts, `Esc` leaves.
- Add `?new` to the URL to start a new game.

You can't lose. Fuel goes on a tab when you're broke, and running dry gets you towed to the nearest port for a fee.

## Layout

- `src/sim/` is the game's rules (jobs, money, flight physics, autopilot) with no rendering, covered by `npm test`.
- `src/flight/` draws the pixel-art flight view.
- `src/foot/` is walking around: the ship's deck and station rooms as tile maps, with their art.
- `src/ui/` is the amber terminal screens and the HUD.
- `mockups/` holds the art-style explorations the look was chosen from.
