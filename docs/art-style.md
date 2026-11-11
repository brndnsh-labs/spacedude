# Spacedude art style

The look to hit is a late 16-bit console game: SNES and Genesis era, the generation after the plain,
flat-colour NES look. Dusty, lamplit, lived-in. Firefly's frontier in tone: worn metal, warm timber, brass,
amber screens, with cool space outside.

All art in this game is drawn by code into canvases, once, at load. There are no image files.

## The frame

- The game draws into a **480x270** canvas, scaled up by a whole number (usually 3x or 4x). Judge your work at
  that size, not only blown up: zoomed-in screenshots are for finding faults, 3x is what the player sees.
- The sim's units are unchanged from the old 320x180 frame. One sim unit (flight) or map unit (on foot) is
  **1.5 screen pixels** (`ZOOM` in `src/view.ts`). A map tile is 16 units, so **24 pixels**.
- Art is authored in screen pixels and declares `scale: 1`. Art from the old frame declares nothing (or
  `LEGACY_SCALE`) and gets stretched 1.5x, which is why it looks uneven. Replacing a module means going native.

## What "16-bit" means here

1. **Shade everything.** No surface is one flat colour. Small things get 3 shades, large ones 4 or 5, taken
   from a ramp in `src/art/palette.ts`. Ramps shift hue: shadows go violet, highlights go warm.
2. **One light.** In flight the sun is to the upper right (`LIGHT` in `src/flight/pixels.ts`): top and right
   edges are light, bottom and left are dark. On foot the light is overhead and slightly right: tops of things
   are lit, fronts are mid, and short shadows fall down and to the left.
3. **Ground things.** Furniture, crates and people cast a small dark contact shadow. Walls shade the floor at
   their feet. Corners are darker than the middle of a room.
4. **Material, not fill.** A floor tile reads as what it is made of: planks with grain, joints and nail heads;
   deck plate with seams, tread and scuffs; grating you can see through. Make 3 or 4 variants of each tile and
   pick by a hash of the tile position, so a room does not look stamped. Never Math.random: art must come out
   the same every time (`rng(seed)` in `src/flight/pixels.ts`).
5. **Walls have height.** A wall face is a tile tall with a cap on top: panel seams, trim, pipes, vents, signs,
   windows with frames and depth. Wall tops have thickness.
6. **Outlines by job.** Things that move (the ship, people, crates) get a full dark outline, in `INK` or in a
   darker shade of the colour next to it on the lit side. Scenery does not get black lines between tiles; an
   object's edge is a darker shade of its own colour, with `INK` only where it meets the floor.
7. **Dither with purpose.** Ordered dithering (`bay`, `shade` in pixels.ts) is for big soft gradients: planets,
   nebulae, glows, glass. Not for small sprites, and never as random speckle. No orphan pixels: a lone pixel is
   a rivet, a glint or a star, or it is noise.
8. **Clean lines.** Slopes step evenly (1:1, 2:1, 3:1). Round things are round. A touch of mid-shade
   anti-aliasing on big curves is fine; blurry edges are not.
9. **Things that matter stand out.** What the player can use (the pilot seat, the ship computer, the airlock,
   the three station counters) carries a saturated accent or a lit screen. Floors stay calmer than furniture.
10. **A little life.** Blinking lamps, a flickering screen, steam, a swaying plant: a few frames each, cheap.
    Draw them in the `live` hook (rooms) or as `lights` (stations), not by repainting big areas every frame.

## Things to steer clear of

- Recreating another game's or show's designs. The ship, stations and people are our own.
- Gradients made of banded stripes with no texture; pillow shading (dark rim, light centre, no light direction).
- Detail that hides the layout. On foot, the player must see at a glance where they can walk.
- Per-frame pixel loops over large areas. Bake to a canvas once; per frame, blit and draw a few rectangles.

## Recolouring

Generated ports reuse a port type's art with the hue turned (`hueShifted` on a finished station or world,
`shiftHex` on room colours). So: keep big metal areas low in saturation, let accents carry the colour, and
check your art with the hue turned as well as straight (the lab shows both).

## Looking at your work

`/lab.html` on the dev server shows every sprite and room, enlarged and animated:
`?show=ship|stations|worlds|sky|deck|rooms|people`, `&zoom=N`. It labels each thing native or legacy.

With `playwright-cli` (always pass `--browser=chromium` to `open`, and use your own `-s=<name>` session):

```bash
playwright-cli -s=myart open "http://localhost:PORT/lab.html?show=deck" --browser=chromium
playwright-cli -s=myart resize 1600 1000
playwright-cli -s=myart screenshot --filename=/tmp/deck.png
```

Then read the PNG and look hard at it. To see art in the game itself, open `/?seed=7`; the dev build exposes
`window.spacedude` (`state`, `walker`, `advance(seconds)`) for putting the ship or the walker where you want.
In the game the canvas is 480x270 scaled to the window, so a 1440x810 or 1920x1080 window gives whole-number
scaling.

## Contracts

- Flight: `src/flight/ship.ts`, `src/flight/stations/kit.ts` (`StationSprite`), `src/flight/worlds.ts`
  (`WorldSprite`), `src/flight/sky.ts`. The renderer is `src/flight/render.ts`.
- On foot: `src/foot/art/types.ts` (`AreaArt`, `PersonSprites`). The renderer is `src/foot/render.ts`; the maps
  are in `src/foot/world.ts`.

Art modules paint; renderers place. If a contract cannot express what you need, say so rather than working
around it in a renderer you do not own.
