import type { PortType } from '../../sim/types';
import { LEGACY_SCALE } from '../../view';
import { hueFor, hueShifted } from '../pixels';
import { farm } from './farm';
import type { StationSprite } from './kit';
import { mine } from './mine';
import { relay } from './relay';
import { ring } from './ring';

export type { StationLight, StationSprite } from './kit';

/**
 * One station design per port type, drawn from above and centred on the port's position.
 * The four core ports are shown as drawn; generated ports get the same build in other colours.
 */
const BUILD: Record<PortType, () => StationSprite> = { ring, farm, mine, relay };
const HUES = [-48, 34, -26, 58, -62, 22];

export function makeStation(type: PortType, look: number): StationSprite & { scale: number } {
  const st = BUILD[type]();
  return { ...st, scale: st.scale ?? LEGACY_SCALE, canvas: hueShifted(st.canvas, hueFor(look, HUES)) };
}
