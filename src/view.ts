/**
 * The game frame. Everything is drawn into a 480x270 canvas and scaled up by a whole number.
 *
 * The sim's units did not change when the frame grew from 320x180: one flight unit, or one unit of an on-foot
 * map, is ZOOM screen pixels. Art is authored in screen pixels, so a 16-unit floor tile is drawn 24 pixels wide.
 */
export const VIEW_W = 480, VIEW_H = 270;
/** Screen pixels per sim unit. */
export const ZOOM = 1.5;
/** Screen pixels per on-foot map tile (16 map units). */
export const TILE_PX = 24;
/**
 * The scale of art drawn for the old 320x180 frame: the renderers stretch it by this much until it is redrawn.
 * Native art has a scale of 1.
 */
export const LEGACY_SCALE = 1.5;
