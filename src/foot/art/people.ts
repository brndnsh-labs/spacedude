/**
 * People: the captain and the folk behind station counters, drawn at the frame's own size, about 20 pixels
 * wide and 30 tall in a 24x36 frame. The contract the renderer relies on is PersonSprites in types.ts.
 *
 * - people-rig.ts builds frames: it knows the walk, hangs arms, legs and coat skirts, and adds the outline.
 * - people-cast.ts is who there is: a hand-drawn head and torso for each facing, colours and measurements.
 *
 * To add someone: copy the person nearest to them in people-cast.ts, give them their own colour ramps (from
 * src/art/palette.ts) and redraw the three heads and three torsos (toward us, away, facing right). Change
 * `top`, `neck` and `hip` to make them taller or shorter, `arm`, `leg` and the torso's width to make them
 * slighter or heavier, and `coat` for anything that hangs below the hip. Something only they have (a prop, a
 * gesture) goes in their `detail`, and their `idle` is a list of poses. Add them to CAST and look at them in
 * /lab.html?show=people before anything else: check each facing enlarged, then small.
 */
import { CAST } from './people-cast';
import { FRAME_H, FRAME_W, GROUND, build, type Look } from './people-rig';
import type { PersonSprites } from './types';

/**
 * How a person sprite sits on the map: its size, where the feet are within it, and its scale (see types.ts).
 * The foot point is between the boots, two rows above the soles, so the renderer's shadow shows under them.
 */
export const PERSON = { w: FRAME_W, h: FRAME_H, footX: FRAME_W / 2, footY: GROUND - 2, scale: 1 } as const;

export type Outfit = Look;

/** Who there is to draw. The renderer asks for these four by name. */
export const OUTFITS = CAST;

/**
 * Every frame of one person. Frame 0 of each facing is standing still; the rest are a six-frame walk. `idle`
 * is the loop for standing at a counter, and carries its own contact shadow because the renderer only gives
 * the walker one.
 */
export function makePerson(o: Outfit): PersonSprites {
  return build(o);
}
