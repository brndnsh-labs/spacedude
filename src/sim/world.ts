import type { Port, PortId } from './types';

/**
 * The Halcyon system. Positions are in flight-view pixels.
 * Fuel is the biggest running cost, so pump prices are spread wide on purpose: the mining camp is the place
 * to brim the tank, and the Lantern charges for being the only pump at the edge of the charts.
 */
export const PORTS: readonly Port[] = [
  {
    id: 'kestrel',
    name: 'Kestrel Station',
    x: 0,
    y: 0,
    blurb: 'Ring station over Ossa. Customs is slow, the coffee is decent.',
    fuelPrice: 2.4,
    dockFee: 20,
    mix: [70, 25, 5],
  },
  {
    id: 'marrow',
    name: "Marrow's Rest",
    x: 2400,
    y: -700,
    blurb: "Farm moon. Everyone knows everyone, and everyone's cargo.",
    fuelPrice: 2.8,
    dockFee: 10,
    mix: [60, 30, 10],
  },
  {
    id: 'hollow',
    name: 'Dry Hollow',
    x: -900,
    y: 1900,
    blurb: 'Mining camp bolted to a rock. Pays in scrip when it can get away with it.',
    fuelPrice: 1.2,
    dockFee: 15,
    mix: [35, 45, 20],
  },
  {
    id: 'lantern',
    name: 'The Lantern',
    x: 1900,
    y: 2300,
    blurb: "Relay beacon at the edge of the charts. Nobody asks what you're hauling.",
    fuelPrice: 3.6,
    dockFee: 5,
    mix: [15, 35, 50],
  },
];

export function port(id: PortId): Port {
  const p = PORTS.find(p => p.id === id);
  if (!p) throw new Error(`unknown port ${id}`);
  return p;
}

export function distance(a: PortId, b: PortId): number {
  const pa = port(a), pb = port(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}
