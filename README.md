# Spacedude

A cozy space-trucking game. Take jobs, haul cargo between ports, pay your bills, fix up your ship, and get by.

This is an early prototype of the core loop: one star system, four ports, one freighter.

## Play

```bash
npm install
npm run dev
```

Then open the URL Vite prints.

- **Docked:** the ship's console. `1`-`5` switch tabs, arrows move, `Enter` acts, `L` launches.
- **Flying:** arrows or `WASD` to fly, `Q` for autopilot, `E` to dock, `Tab` for the console.
- Add `?new` to the URL to start a new game.

You can't lose. Fuel goes on a tab when you're broke, and running dry gets you towed to the nearest port for a fee.

## Layout

- `src/sim/` is the game's rules (jobs, money, flight physics, autopilot) with no rendering, covered by `npm test`.
- `src/flight/` draws the pixel-art flight view.
- `src/ui/` is the amber ship console and the flight HUD.
- `mockups/` holds the art-style explorations the look was chosen from.
