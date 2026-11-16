// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world for a fixed stretch, steered by a simple autopilot (try each
// way the koi could swim, look ahead, keep clear of rocks, logs, heron strikes and
// whirlpools, chase the nearest pearl when that is safe), so the frame is what a real game
// looks like and the same seed always gives the same frame.
import { FIELD, KOI, RIVER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN, KIND_LOG } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const LIMIT_SECONDS = 900;
/**
 * How far ahead, in seconds, the autopilot checks each way it could swim: the play and win
 * scenes' pilot looks well ahead and keeps all its lives; the end scene's looks only a
 * moment ahead, so it is caught out once the river speeds up, as a hurried player is.
 */
const HORIZON_SAFE = 0.9;
const HORIZON_SHORT = 0.22;
const SAMPLE = 1 / 30;
/** The eight ways to swim, plus holding still. */
const DIRECTIONS = [
  { x: 0, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -0.707, y: -0.707 },
  { x: 0.707, y: -0.707 },
  { x: -0.707, y: 0.707 },
  { x: 0.707, y: 0.707 },
];
/** Extra room, each side, it keeps between the koi and an obstacle. */
const MARGIN = 12;

/**
 * Seconds until swimming in `direction` runs the koi into something; Infinity when it never
 * does inside the horizon. Obstacles are predicted drifting down with the current, a heron
 * strike is checked at the moment its beak falls, and a whirlpool's centre counts as a wall
 * the pilot will not enter.
 */
function timeToHit(state, direction, horizon) {
  const koi = state.koi;
  let x = koi.x;
  let y = koi.y;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    x = Math.min(RIVER.right - koi.radius, Math.max(RIVER.left + koi.radius, x + direction.x * KOI.maxSpeed * SAMPLE));
    y = Math.min(FIELD.height - 60, Math.max(70, y + direction.y * KOI.maxSpeed * SAMPLE));
    for (const obstacle of state.obstacles) {
      if (!obstacle.active) continue;
      const drift = obstacle.kind === KIND_LOG ? 0.85 : 1;
      const oy = obstacle.y + state.scrollSpeed * drift * t;
      if (Math.abs(oy - y) > obstacle.radius + koi.radius + MARGIN) continue;
      if (Math.hypot(obstacle.x - x, oy - y) < obstacle.radius + koi.radius + MARGIN) return t;
    }
    for (const heron of state.herons) {
      if (!heron.active || heron.struck) continue;
      if (heron.timer <= horizon && Math.hypot(heron.x - x, heron.y - y) < heron.radius + koi.radius) return Math.max(t, heron.timer);
    }
    for (const whirl of state.whirlpools) {
      if (!whirl.active) continue;
      const wy = whirl.y + state.scrollSpeed * 0.7 * t;
      if (Math.hypot(whirl.x - x, wy - y) < whirl.radius * 0.85) return t;
    }
  }
  return Infinity;
}

/** Where swimming in `direction` for `horizon` seconds ends up, for chasing pearls. */
function endPosition(state, direction, horizon) {
  const koi = state.koi;
  const x = Math.min(RIVER.right - koi.radius, Math.max(RIVER.left + koi.radius, koi.x + direction.x * KOI.maxSpeed * horizon));
  const y = Math.min(FIELD.height - 60, Math.max(70, koi.y + direction.y * KOI.maxSpeed * horizon));
  return { x, y };
}

/**
 * Of the safe ways to swim, the one toward the nearest pearl (or the river's middle); else
 * the one that is hit last.
 */
function autopilot(state, horizon) {
  let pearl = null;
  for (const item of state.pearls) {
    if (item.active && (pearl === null || item.y > pearl.y)) pearl = item;
  }
  for (const item of state.fireflies) {
    if (item.active && (pearl === null || item.y > pearl.y)) pearl = item;
  }
  const targetX = pearl === null ? FIELD.width / 2 : pearl.x;
  const targetY = pearl === null ? FIELD.height * 0.55 : pearl.y + 60;
  let best = DIRECTIONS[0];
  let bestTime = -1;
  let bestPearl = Infinity;
  for (const direction of DIRECTIONS) {
    const time = timeToHit(state, direction, horizon);
    if (time < bestTime) continue;
    const end = endPosition(state, direction, horizon);
    const pearlDistance = Math.hypot(targetX - end.x, targetY - end.y);
    if (time > bestTime || pearlDistance < bestPearl) {
      bestTime = time;
      bestPearl = pearlDistance;
      best = direction;
    }
  }
  return best;
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'win') {
    for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state, HORIZON_SAFE), false);
      if (events & EVENT_WIN) break;
      if (events & EVENT_OVER) break;
    }
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
  }
  if (name === 'end') {
    // The short-horizon pilot should be caught before the gate; if one attempt swims
    // clean through to 1000 m, replay it blinder until the current takes it.
    for (const horizon of [HORIZON_SHORT, 0.12, 0.06]) {
      world.reset();
      for (let index = 0; index < LIMIT_SECONDS / STEP; index += 1) {
        const events = world.step(STEP, autopilot(world.state, horizon), false);
        if (events & (EVENT_OVER | EVENT_WIN)) break;
      }
      if (world.state.lives === 0) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  const horizon = HORIZON_SAFE;
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    if (world.step(STEP, autopilot(world.state, horizon), false) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
