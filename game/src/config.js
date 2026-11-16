// Koi Current — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to fit the
// window, so no rule below depends on the screen size. The river runs down the middle:
// banks on both sides, the koi swims upstream through the channel between them.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The channel the koi may swim in; outside it are the banks. */
export const RIVER = { left: 118, right: 1162 };

/** Metres to the Lantern Gate: reaching them wins the game. */
export const GOAL_DISTANCE = 1000;

export const LIVES = 3;

export const KOI = {
  radius: 24,
  accel: 2600,
  maxSpeed: 430,
  drag: 3.4,
  /** Seconds of flashing safety after a hit. */
  invulnerable: 1.5,
};

/** The river's current: it carries everything downstream and it is what the koi fights. */
export const CURRENT = {
  baseSpeed: 120,
  /** Speed multiplier gained per level, on top of the base. */
  perLevel: 0.08,
  /** Metres the koi gains per pixel of current that passes. */
  metresPerPixel: 0.11,
};

/** Seconds of play per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 15, max: 8 };

export const ROCK = {
  minRadius: 18,
  maxRadius: 42,
  interval: 0.9,
  intervalScale: 0.92,
  minInterval: 0.38,
};

export const LOG = {
  width: 150,
  height: 34,
  radius: 34,
  interval: 1.7,
  intervalScale: 0.92,
  minInterval: 0.7,
  /** Logs drift a little slower than the current, like real driftwood. */
  drift: 0.85,
};

export const HERON = {
  /** Seconds the ripple warning shows before the beak strikes. */
  warn: 0.9,
  radius: 62,
  interval: 3.4,
};

export const WHIRLPOOL = {
  radius: 64,
  pull: 300,
  interval: 2.8,
  drift: 0.7,
};

export const PEARL = {
  radius: 13,
  points: 10,
  interval: 0.85,
  intervalJitter: 0.5,
};

export const FIREFLY = {
  radius: 11,
  points: 25,
  interval: 6.5,
  intervalJitter: 3.0,
};

/** A pearl chain: how long the combo survives with no pearl, and its highest multiplier. */
export const COMBO = { window: 3, max: 8 };

/** Passing this close to a rock or log without touching it is a near miss. */
export const NEAR_MISS = { gap: 24, points: 5 };

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOL = { obstacles: 48, pearls: 24, fireflies: 8, herons: 4, whirlpools: 6, particles: 140, floaters: 12 };

export const PALETTE = {
  backdrop: '#070d1d',
  waterTop: '#0e1a33',
  waterBottom: '#14324a',
  waterLine: '#1d4a63',
  bank: '#0a1f1a',
  bankEdge: '#1c3d2e',
  reed: '#2e6b4f',
  reedDark: '#1d4a36',
  lantern: '#ffb347',
  lanternGlow: '#ff9a2e',
  koiOrange: '#ff7a3c',
  koiWhite: '#fff4e0',
  koiFin: '#ff9e5e',
  pearl: '#ffe9a8',
  firefly: '#7dffd4',
  rock: '#5a6b84',
  rockDark: '#3a475e',
  log: '#7a5230',
  logDark: '#54371f',
  whirl: '#9fd8ff',
  heronWarn: '#ff5d5d',
  text: '#f4efe4',
  muted: '#a8b8cc',
  gold: '#ffd76a',
  heart: '#ff5d73',
  heartEmpty: '#3a2b3f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'koi-current.best';
