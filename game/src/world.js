// The game's rules and state, with no drawing and no browser in it: the koi, the pools of
// rocks, logs, herons, whirlpools, pearls and fireflies, spawning, collisions, score, combo,
// lives and levels. step() advances one fixed step and returns what happened as bit flags,
// so the caller can react — with sound, with a screen change — without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.
import {
  COMBO, CURRENT, FIELD, FIREFLY, GOAL_DISTANCE, HERON, KOI, LEVEL, LIVES, LOG, NEAR_MISS,
  PEARL, POOL, RIVER, ROCK, WHIRLPOOL,
} from './config.js';

export const KIND_ROCK = 0;
export const KIND_LOG = 1;

export const EVENT_HIT = 1;
export const EVENT_PEARL = 2;
export const EVENT_FIREFLY = 4;
export const EVENT_LEVEL = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;
export const EVENT_NEARMISS = 64;
export const EVENT_HERON = 128;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  const koi = {
    x: FIELD.width / 2,
    y: FIELD.height - 150,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: KOI.radius,
    invulnerable: 0,
    /** The last few positions, for the tail to trail behind. */
    tail: [],
  };
  for (let index = 0; index < 14; index += 1) koi.tail.push({ x: koi.x, y: koi.y + index * 6 });

  const obstacles = [];
  for (let index = 0; index < POOL.obstacles; index += 1) {
    obstacles.push({ active: false, kind: KIND_ROCK, x: 0, y: 0, radius: 0, width: 0, height: 0, rotation: 0, spin: 0, seed: 0, closest: 0, passed: false });
  }
  const pearls = [];
  for (let index = 0; index < POOL.pearls; index += 1) {
    pearls.push({ active: false, x: 0, y: 0, radius: PEARL.radius, phase: 0 });
  }
  const fireflies = [];
  for (let index = 0; index < POOL.fireflies; index += 1) {
    fireflies.push({ active: false, x: 0, y: 0, radius: FIREFLY.radius, vx: 0, vy: 0, phase: 0 });
  }
  const herons = [];
  for (let index = 0; index < POOL.herons; index += 1) {
    herons.push({ active: false, x: 0, y: 0, radius: HERON.radius, timer: 0, struck: false });
  }
  const whirlpools = [];
  for (let index = 0; index < POOL.whirlpools; index += 1) {
    whirlpools.push({ active: false, x: 0, y: 0, radius: WHIRLPOOL.radius, spin: 0 });
  }
  const particles = [];
  for (let index = 0; index < POOL.particles; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, kind: 0 });
  }
  const floaters = [];
  for (let index = 0; index < POOL.floaters; index += 1) {
    floaters.push({ active: false, x: 0, y: 0, text: '', life: 0 });
  }

  const state = {
    koi, obstacles, pearls, fireflies, herons, whirlpools, particles, floaters,
    score: 0, pearlsCollected: 0, firefliesCollected: 0, nearMisses: 0,
    distance: 0, lives: LIVES, level: 1, elapsed: 0, time: 0,
    combo: 1, comboTimer: 0, scrollSpeed: CURRENT.baseSpeed, shake: 0, won: false,
    rockTimer: 0, logTimer: 0, heronTimer: 0, whirlTimer: 0, pearlTimer: 0, fireflyTimer: 0,
  };

  function reset() {
    koi.x = FIELD.width / 2;
    koi.y = FIELD.height - 150;
    koi.vx = 0;
    koi.vy = 0;
    koi.angle = 0;
    koi.invulnerable = 0;
    for (let index = 0; index < koi.tail.length; index += 1) {
      koi.tail[index].x = koi.x;
      koi.tail[index].y = koi.y + index * 6;
    }
    for (const item of obstacles) item.active = false;
    for (const item of pearls) item.active = false;
    for (const item of fireflies) item.active = false;
    for (const item of herons) item.active = false;
    for (const item of whirlpools) item.active = false;
    for (const item of particles) item.active = false;
    for (const item of floaters) item.active = false;
    state.score = 0;
    state.pearlsCollected = 0;
    state.firefliesCollected = 0;
    state.nearMisses = 0;
    state.distance = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.time = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.scrollSpeed = CURRENT.baseSpeed;
    state.shake = 0;
    state.won = false;
    state.rockTimer = ROCK.interval;
    state.logTimer = LOG.interval;
    state.heronTimer = HERON.interval;
    state.whirlTimer = WHIRLPOOL.interval;
    state.pearlTimer = 0.4;
    state.fireflyTimer = FIREFLY.interval;
  }

  function free(pool) {
    for (let index = 0; index < pool.length; index += 1) if (!pool[index].active) return pool[index];
    return null;
  }

  function riverX(margin) {
    return RIVER.left + margin + random() * (RIVER.right - RIVER.left - margin * 2);
  }

  function spawnRock() {
    const rock = free(obstacles);
    if (rock === null) return;
    rock.active = true;
    rock.kind = KIND_ROCK;
    rock.radius = ROCK.minRadius + random() * (ROCK.maxRadius - ROCK.minRadius);
    rock.width = rock.radius * 2;
    rock.height = rock.radius * 2;
    rock.x = riverX(rock.radius);
    rock.y = -rock.radius - 10;
    rock.rotation = random() * Math.PI * 2;
    rock.spin = (random() - 0.5) * 0.4;
    rock.seed = random() * 1000;
    rock.closest = Infinity;
    rock.passed = false;
  }

  function spawnLog() {
    const log = free(obstacles);
    if (log === null) return;
    log.active = true;
    log.kind = KIND_LOG;
    log.width = LOG.width;
    log.height = LOG.height;
    log.radius = LOG.radius;
    log.x = riverX(LOG.width / 2);
    log.y = -LOG.height;
    log.rotation = (random() - 0.5) * 0.5;
    log.spin = (random() - 0.5) * 0.15;
    log.seed = random() * 1000;
    log.closest = Infinity;
    log.passed = false;
  }

  function spawnPearl() {
    const pearl = free(pearls);
    if (pearl === null) return;
    pearl.active = true;
    pearl.x = riverX(PEARL.radius + 8);
    pearl.y = -PEARL.radius - 10;
    pearl.phase = random() * Math.PI * 2;
  }

  function spawnFirefly() {
    const fly = free(fireflies);
    if (fly === null) return;
    fly.active = true;
    fly.x = riverX(FIREFLY.radius + 8);
    fly.y = -FIREFLY.radius - 10;
    fly.vx = (random() - 0.5) * 40;
    fly.vy = 0;
    fly.phase = random() * Math.PI * 2;
  }

  /** A heron warns at a spot near the koi, then strikes it: move away before the beak falls. */
  function spawnHeron() {
    const heron = free(herons);
    if (heron === null) return;
    heron.active = true;
    heron.x = Math.min(RIVER.right - HERON.radius, Math.max(RIVER.left + HERON.radius, koi.x + (random() - 0.5) * 320));
    heron.y = Math.min(FIELD.height - 160, Math.max(140, koi.y - 140 + (random() - 0.5) * 160));
    heron.timer = HERON.warn;
    heron.struck = false;
  }

  function spawnWhirlpool() {
    const whirl = free(whirlpools);
    if (whirl === null) return;
    whirl.active = true;
    whirl.x = riverX(WHIRLPOOL.radius);
    whirl.y = -WHIRLPOOL.radius - 10;
    whirl.spin = random() * Math.PI * 2;
  }

  function burst(x, y, count, kind, speed) {
    let made = 0;
    for (let index = 0; index < particles.length && made < count; index += 1) {
      const particle = particles[index];
      if (particle.active) continue;
      particle.active = true;
      particle.x = x;
      particle.y = y;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.4 + random() * 0.6);
      particle.vx = Math.cos(angle) * power;
      particle.vy = Math.sin(angle) * power - speed * 0.3;
      particle.life = 0.5 + random() * 0.4;
      particle.maxLife = particle.life;
      particle.size = 2 + random() * 3;
      particle.kind = kind;
      made += 1;
    }
  }

  function floater(x, y, text) {
    const slot = free(floaters);
    if (slot === null) return;
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.text = text;
    slot.life = 0.9;
  }

  function hurt(events) {
    state.lives -= 1;
    koi.invulnerable = KOI.invulnerable;
    state.combo = 1;
    state.comboTimer = 0;
    state.shake = 14;
    burst(koi.x, koi.y, 16, 0, 260);
    if (state.lives <= 0) return events | EVENT_HIT | EVENT_OVER;
    return events | EVENT_HIT;
  }

  /**
   * One fixed step. `steer` is the koi's steering vector (-1..1 on each axis). With
   * `harmless` set (the title screen's backdrop) things drift but nothing touches the koi
   * and nothing scores.
   */
  function step(dt, steer, harmless) {
    let events = 0;
    state.time += dt;
    if (!harmless) state.elapsed += dt;
    const nextLevel = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (!harmless && nextLevel > state.level) events |= EVENT_LEVEL;
    state.level = nextLevel;
    state.scrollSpeed = CURRENT.baseSpeed * (1 + CURRENT.perLevel * (state.level - 1));
    if (!harmless) state.distance += state.scrollSpeed * CURRENT.metresPerPixel * dt;

    // The koi: accelerate toward the steering, drag when idle, stay inside the channel.
    koi.vx += steer.x * KOI.accel * dt;
    koi.vy += steer.y * KOI.accel * dt;
    const drag = Math.max(0, 1 - KOI.drag * dt);
    koi.vx *= drag;
    koi.vy *= drag;
    const speed = Math.hypot(koi.vx, koi.vy);
    if (speed > KOI.maxSpeed) {
      koi.vx = (koi.vx / speed) * KOI.maxSpeed;
      koi.vy = (koi.vy / speed) * KOI.maxSpeed;
    }
    // Whirlpools drag the koi toward their centres while they are on screen.
    for (const whirl of whirlpools) {
      if (!whirl.active) continue;
      const dx = whirl.x - koi.x;
      const dy = whirl.y - koi.y;
      const dist = Math.hypot(dx, dy);
      const reach = whirl.radius * 2.2;
      if (dist < reach && dist > 1) {
        const pull = WHIRLPOOL.pull * (1 - dist / reach) * dt;
        koi.vx += (dx / dist) * pull;
        koi.vy += (dy / dist) * pull;
      }
    }
    koi.x = Math.min(RIVER.right - koi.radius, Math.max(RIVER.left + koi.radius, koi.x + koi.vx * dt));
    koi.y = Math.min(FIELD.height - 60, Math.max(70, koi.y + koi.vy * dt));
    if (speed > 20) {
      const target = Math.atan2(koi.vx, -koi.vy);
      let diff = target - koi.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      koi.angle += diff * Math.min(1, 10 * dt);
    }
    // The tail trails the koi: each stored point takes the one ahead of it, in place.
    for (let index = koi.tail.length - 1; index > 0; index -= 1) {
      koi.tail[index].x = koi.tail[index - 1].x;
      koi.tail[index].y = koi.tail[index - 1].y;
    }
    koi.tail[0].x = koi.x;
    koi.tail[0].y = koi.y;
    if (koi.invulnerable > 0) koi.invulnerable = Math.max(0, koi.invulnerable - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - 42 * dt);

    // Spawning.
    state.rockTimer -= dt;
    if (state.rockTimer <= 0) {
      spawnRock();
      state.rockTimer += Math.max(ROCK.minInterval, ROCK.interval * ROCK.intervalScale ** (state.level - 1));
    }
    if (state.level >= 2) {
      state.logTimer -= dt;
      if (state.logTimer <= 0) {
        spawnLog();
        state.logTimer += Math.max(LOG.minInterval, LOG.interval * LOG.intervalScale ** (state.level - 1));
      }
    }
    if (state.level >= 3) {
      state.heronTimer -= dt;
      if (state.heronTimer <= 0) {
        spawnHeron();
        state.heronTimer += HERON.interval;
        events |= EVENT_HERON;
      }
    }
    if (state.level >= 4) {
      state.whirlTimer -= dt;
      if (state.whirlTimer <= 0) {
        spawnWhirlpool();
        state.whirlTimer += WHIRLPOOL.interval;
      }
    }
    state.pearlTimer -= dt;
    if (state.pearlTimer <= 0) {
      spawnPearl();
      state.pearlTimer += PEARL.interval + random() * PEARL.intervalJitter;
    }
    state.fireflyTimer -= dt;
    if (state.fireflyTimer <= 0) {
      spawnFirefly();
      state.fireflyTimer += FIREFLY.interval + random() * FIREFLY.intervalJitter;
    }

    // Obstacles drift down with the current; rocks and logs can hurt, and can be near-missed.
    for (const obstacle of obstacles) {
      if (!obstacle.active) continue;
      const drift = obstacle.kind === KIND_LOG ? LOG.drift : 1;
      obstacle.y += state.scrollSpeed * drift * dt;
      obstacle.rotation += obstacle.spin * dt;
      if (obstacle.y - obstacle.radius > FIELD.height) {
        obstacle.active = false;
        continue;
      }
      if (harmless) continue;
      const dist = distance(obstacle.x, obstacle.y, koi.x, koi.y);
      if (Math.abs(obstacle.y - koi.y) < 160 && dist < obstacle.closest) obstacle.closest = dist;
      if (!obstacle.passed && obstacle.y > koi.y + 110) {
        obstacle.passed = true;
        if (obstacle.closest < obstacle.radius + koi.radius + NEAR_MISS.gap) {
          state.score += NEAR_MISS.points;
          state.nearMisses += 1;
          floater(koi.x, koi.y - 44, `Close! +${NEAR_MISS.points}`);
          events |= EVENT_NEARMISS;
        }
      }
      if (dist < obstacle.radius + koi.radius - 6 && koi.invulnerable === 0) {
        obstacle.active = false;
        events = hurt(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Herons: the warning ticks down, then the beak strikes the marked spot once.
    for (const heron of herons) {
      if (!heron.active) continue;
      heron.y += state.scrollSpeed * 0.4 * dt;
      if (heron.struck) {
        heron.timer -= dt;
        if (heron.timer <= 0) heron.active = false;
        continue;
      }
      heron.timer -= dt;
      if (heron.timer <= 0) {
        heron.struck = true;
        heron.timer = 0.3;
        burst(heron.x, heron.y, 10, 0, 200);
        if (!harmless && koi.invulnerable === 0 && distance(heron.x, heron.y, koi.x, koi.y) < heron.radius + koi.radius - 8) {
          events = hurt(events);
          if (events & EVENT_OVER) return events;
        }
      }
      if (heron.y - heron.radius > FIELD.height) heron.active = false;
    }

    // Whirlpools drift down slowly, spinning.
    for (const whirl of whirlpools) {
      if (!whirl.active) continue;
      whirl.y += state.scrollSpeed * WHIRLPOOL.drift * dt;
      whirl.spin += dt * 3;
      if (whirl.y - whirl.radius > FIELD.height) whirl.active = false;
    }

    // Pearls: collected for points times the combo; each one feeds the chain.
    for (const pearl of pearls) {
      if (!pearl.active) continue;
      pearl.y += state.scrollSpeed * dt;
      pearl.x += Math.sin(state.time * 2 + pearl.phase) * 12 * dt;
      if (pearl.y - pearl.radius > FIELD.height) {
        pearl.active = false;
        continue;
      }
      if (harmless) continue;
      if (distance(pearl.x, pearl.y, koi.x, koi.y) < pearl.radius + koi.radius) {
        pearl.active = false;
        const gained = PEARL.points * state.combo;
        state.score += gained;
        state.pearlsCollected += 1;
        floater(pearl.x, pearl.y - 18, `+${gained}`);
        burst(pearl.x, pearl.y, 8, 1, 140);
        state.combo = Math.min(COMBO.max, state.combo + 1);
        state.comboTimer = COMBO.window;
        events |= EVENT_PEARL;
      }
    }

    // Fireflies drift sideways as they fall; rare, and worth more than a pearl.
    for (const fly of fireflies) {
      if (!fly.active) continue;
      fly.y += state.scrollSpeed * 0.9 * dt;
      fly.x += (fly.vx + Math.sin(state.time * 3 + fly.phase) * 30) * dt;
      if (fly.x < RIVER.left + fly.radius) fly.x = RIVER.left + fly.radius;
      if (fly.x > RIVER.right - fly.radius) fly.x = RIVER.right - fly.radius;
      if (fly.y - fly.radius > FIELD.height) {
        fly.active = false;
        continue;
      }
      if (harmless) continue;
      if (distance(fly.x, fly.y, koi.x, koi.y) < fly.radius + koi.radius) {
        fly.active = false;
        const gained = FIREFLY.points * state.combo;
        state.score += gained;
        state.firefliesCollected += 1;
        floater(fly.x, fly.y - 18, `+${gained}`);
        burst(fly.x, fly.y, 12, 2, 170);
        state.combo = Math.min(COMBO.max, state.combo + 1);
        state.comboTimer = COMBO.window;
        events |= EVENT_FIREFLY;
      }
    }

    // Particles and floating score text fade out on their own.
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 90 * dt;
      particle.vx *= 0.98;
    }
    for (const slot of floaters) {
      if (!slot.active) continue;
      slot.life -= dt;
      slot.y -= 34 * dt;
      if (slot.life <= 0) slot.active = false;
    }

    if (!harmless && !state.won && state.distance >= GOAL_DISTANCE) {
      state.won = true;
      events |= EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
