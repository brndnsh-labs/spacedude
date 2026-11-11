/**
 * The master palette. Each ramp runs dark to light, and shifts hue as it goes: shadows lean toward violet,
 * highlights toward warm yellow. That shift is most of what makes the game's colours feel dusty and lamplit
 * rather than flat. Take colours from here first; a subject that needs its own ramp (a planet, a nebula)
 * should be built the same way. See docs/art-style.md.
 */
export const INK = '#15121f';

export const PAL = {
  /** Space and deep shadow. */
  night: ['#0d0b12', '#15121f', '#1a1423', '#241a35', '#2b1f3b', '#3a2f45', '#4f4863'],
  /** Hull plate, machinery, cold metal. */
  steel: ['#232336', '#2f3148', '#434761', '#555a72', '#6f748b', '#8a8fa3', '#a7abbc', '#c3c6d4', '#eef0f5'],
  /** Warm painted panels, cloth, paper. */
  bone: ['#4a4038', '#5e5347', '#7a6b5c', '#94806f', '#c2ad90', '#e3d5b8', '#f6efd9'],
  /** Timber and leather. */
  wood: ['#2e211d', '#3b2a22', '#5e3d2b', '#75573f', '#8a6a52', '#a8794a', '#c9a27a', '#e0c49a'],
  /** Rust, brick, warning paint. */
  rust: ['#3d1f2e', '#57293a', '#6b2e3c', '#8f3b33', '#a3523f', '#c8553d', '#e07a5f', '#f2a58a'],
  /** Lamplight, brass, the game's accent. */
  amber: ['#5c3524', '#7a4a2a', '#b5683f', '#cf8048', '#eab668', '#f8dc98', '#fff3c4'],
  /** Glass, coolant, screens that are not amber. */
  teal: ['#16323a', '#24504a', '#2f6f6a', '#3f8f8a', '#5fb3a8', '#7fd1c7', '#d7f5ee'],
  /** Plants and farmland. */
  leaf: ['#162428', '#1f3f3c', '#2f6a4e', '#3f8f6a', '#52955c', '#8fc47a', '#d0e3a0'],
  /** Relay stations, neon, dusk. */
  violet: ['#1a1230', '#241f33', '#332c47', '#4f4668', '#6a6086', '#9f78bd', '#c79bd1', '#eed4ea'],
  /** The phosphor terminal. */
  phosphor: ['#0b0803', '#2b1d02', '#5a3e00', '#b37b00', '#ffb000', '#ffd27a'],
  /** Skin, three complexions, each dark to light. */
  skin: [
    ['#6b3f33', '#8a5540', '#a8754f', '#c98f6b'],
    ['#8a5540', '#b07a58', '#c98f6b', '#e0b08a'],
    ['#a8754f', '#c98f6b', '#e0b08a', '#f2cfa8'],
  ],
} as const;

/** Lights that mean something: port (red), starboard and "go" (green), beacons (white), caution (amber). */
export const SIGNAL = { red: '#ff6b5a', green: '#7df0b0', white: '#fff6e0', amber: '#eab668', teal: '#7fd1c7' } as const;
