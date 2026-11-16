// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Dusk water, lantern-lit banks, a glowing koi with a trailing tail, and every
// screen drawn from the same scene. Text that holds a number is rebuilt only when the
// number changes, so a frame allocates nothing.
import {
  COMBO, FIELD, FONT, GOAL_DISTANCE, HERON, KOI, LIVES, PALETTE, RIVER, WHIRLPOOL,
} from './config.js';
import { KIND_LOG } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

/** A deterministic 0..1 hash of a number: rock shapes and reed clumps from a seed. */
function hash(value) {
  const s = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const levelLabel = cachedLabel('LEVEL ');
  const comboLabel = cachedLabel('COMBO x');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const distanceLabel = cachedLabel('');

  // The banks' decoration, fixed once: reed clumps, drifting fireflies, rising bubbles.
  const decorRandom = createRandom(20261115);
  const reeds = [];
  for (let index = 0; index < 46; index += 1) {
    reeds.push({
      side: index % 2 === 0 ? 0 : 1,
      x: decorRandom() * 88,
      y: decorRandom() * FIELD.height,
      height: 34 + decorRandom() * 44,
      lean: (decorRandom() - 0.5) * 26,
    });
  }
  const ambientFlies = [];
  for (let index = 0; index < 22; index += 1) {
    ambientFlies.push({
      x: RIVER.left + decorRandom() * (RIVER.right - RIVER.left),
      y: decorRandom() * FIELD.height,
      phase: decorRandom() * TAU,
      speed: 0.4 + decorRandom() * 0.8,
    });
  }
  const bubbles = [];
  for (let index = 0; index < 26; index += 1) {
    bubbles.push({
      x: RIVER.left + 20 + decorRandom() * (RIVER.right - RIVER.left - 40),
      y: decorRandom() * FIELD.height,
      radius: 1.5 + decorRandom() * 3.5,
      speed: 18 + decorRandom() * 30,
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function glowText(value, x, y, size, color, glowColor, blur) {
    context.save();
    context.shadowColor = glowColor;
    context.shadowBlur = blur;
    text(value, x, y, size, color, 'center');
    context.restore();
  }

  function drawWater(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.waterTop);
    gradient.addColorStop(1, PALETTE.waterBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Moonlit ripples drifting down with the current.
    context.strokeStyle = PALETTE.waterLine;
    context.globalAlpha = 0.35;
    context.lineWidth = 2;
    const offset = (state.time * state.scrollSpeed) % 64;
    for (let y = -64 + offset; y < FIELD.height + 64; y += 64) {
      context.beginPath();
      for (let x = RIVER.left; x <= RIVER.right; x += 32) {
        const wave = Math.sin(x * 0.02 + y * 0.05 + state.time * 1.4) * 6;
        if (x === RIVER.left) context.moveTo(x, y + wave);
        else context.lineTo(x, y + wave);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
    // Bubbles rising through the water.
    context.fillStyle = '#bfe6ff';
    for (const bubble of bubbles) {
      const y = ((bubble.y - state.time * bubble.speed) % FIELD.height + FIELD.height) % FIELD.height;
      context.globalAlpha = 0.28;
      context.beginPath();
      context.arc(bubble.x, y, bubble.radius, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawBanks(state) {
    const scroll = (state.time * state.scrollSpeed * 0.55) % FIELD.height;
    for (const side of [0, 1]) {
      const bankX = side === 0 ? 0 : RIVER.right;
      const bankWidth = side === 0 ? RIVER.left : FIELD.width - RIVER.right;
      context.fillStyle = PALETTE.bank;
      context.fillRect(bankX, 0, bankWidth, FIELD.height);
      context.fillStyle = PALETTE.bankEdge;
      const edgeX = side === 0 ? RIVER.left - 6 : RIVER.right;
      context.fillRect(edgeX, 0, 6, FIELD.height);
      // Reeds swaying on the bank, scrolling slower than the water.
      for (const reed of reeds) {
        if (reed.side !== side) continue;
        const y = ((reed.y + scroll) % FIELD.height + FIELD.height) % FIELD.height;
        const x = side === 0 ? reed.x : RIVER.right + 14 + reed.x;
        const sway = Math.sin(state.time * 1.2 + reed.y * 0.05) * 4;
        context.strokeStyle = hash(reed.y) > 0.5 ? PALETTE.reed : PALETTE.reedDark;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(x + reed.lean * 0.4 + sway, y - reed.height * 0.6, x + reed.lean + sway, y - reed.height);
        context.stroke();
      }
      // Lantern posts along the bank, their glow spilling onto the water.
      const spacing = 210;
      const lanternOffset = (state.time * state.scrollSpeed * 0.55) % spacing;
      for (let y = -spacing + lanternOffset; y < FIELD.height + spacing; y += spacing) {
        const x = side === 0 ? RIVER.left - 30 : RIVER.right + 30;
        context.strokeStyle = '#2a2118';
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(x, y + 46);
        context.lineTo(x, y);
        context.stroke();
        const flicker = 0.85 + Math.sin(state.time * 3 + y) * 0.08;
        const glow = context.createRadialGradient(x, y - 8, 2, x, y - 8, 54);
        glow.addColorStop(0, `rgba(255, 179, 71, ${0.5 * flicker})`);
        glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y - 8, 54, 0, TAU);
        context.fill();
        context.fillStyle = PALETTE.lantern;
        context.beginPath();
        context.roundRect(x - 11, y - 22, 22, 28, 6);
        context.fill();
        context.fillStyle = '#7a4a12';
        context.fillRect(x - 13, y - 25, 26, 4);
        context.fillRect(x - 13, y + 7, 26, 4);
      }
    }
    // Fireflies drifting over the river.
    for (const fly of ambientFlies) {
      const x = fly.x + Math.sin(state.time * fly.speed + fly.phase) * 26;
      const y = ((fly.y + Math.sin(state.time * fly.speed * 0.7 + fly.phase) * 14 - state.time * 8) % FIELD.height + FIELD.height) % FIELD.height;
      const pulse = 0.45 + Math.sin(state.time * 2.4 + fly.phase * 3) * 0.35;
      context.fillStyle = PALETTE.firefly;
      context.globalAlpha = pulse;
      context.beginPath();
      context.arc(x, y, 2.4, 0, TAU);
      context.fill();
      context.globalAlpha = pulse * 0.25;
      context.beginPath();
      context.arc(x, y, 8, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawRock(rock) {
    context.save();
    context.translate(rock.x, rock.y);
    context.rotate(rock.rotation);
    context.beginPath();
    const points = 8;
    for (let index = 0; index < points; index += 1) {
      const angle = (index / points) * TAU;
      const radius = rock.radius * (0.78 + hash(rock.seed + index * 7.3) * 0.4);
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = PALETTE.rock;
    context.fill();
    context.strokeStyle = PALETTE.rockDark;
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = 'rgba(255, 255, 255, 0.14)';
    context.beginPath();
    context.ellipse(-rock.radius * 0.25, -rock.radius * 0.35, rock.radius * 0.4, rock.radius * 0.22, -0.5, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawLog(log) {
    context.save();
    context.translate(log.x, log.y);
    context.rotate(log.rotation);
    context.fillStyle = PALETTE.logDark;
    context.beginPath();
    context.roundRect(-log.width / 2 - 3, -log.height / 2 - 3, log.width + 6, log.height + 6, 14);
    context.fill();
    context.fillStyle = PALETTE.log;
    context.beginPath();
    context.roundRect(-log.width / 2, -log.height / 2, log.width, log.height, 12);
    context.fill();
    context.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-log.width / 2 + 8, -log.height / 2 + 8);
    context.lineTo(log.width / 2 - 8, -log.height / 2 + 8);
    context.moveTo(-log.width / 2 + 8, log.height / 2 - 8);
    context.lineTo(log.width / 2 - 8, log.height / 2 - 8);
    context.stroke();
    context.restore();
  }

  function drawHeron(state, heron) {
    if (!heron.struck) {
      // The warning: a pulsing ripple circle and a red ring over the strike spot.
      const pulse = 1 + Math.sin(state.time * 14) * 0.08;
      context.save();
      context.strokeStyle = PALETTE.heronWarn;
      context.globalAlpha = 0.85;
      context.lineWidth = 3;
      context.setLineDash([10, 8]);
      context.beginPath();
      context.arc(heron.x, heron.y, heron.radius * pulse, 0, TAU);
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = 0.25 + Math.sin(state.time * 10) * 0.1;
      context.fillStyle = PALETTE.heronWarn;
      context.beginPath();
      context.arc(heron.x, heron.y, heron.radius * 0.6, 0, TAU);
      context.fill();
      context.restore();
      text('!', heron.x, heron.y - heron.radius - 10, 30, PALETTE.heronWarn, 'center');
    } else {
      // The strike: a white beak stabs the spot and the water bursts.
      const depth = 1 - heron.timer / 0.3;
      const tipY = heron.y - 150 + depth * 150;
      context.save();
      context.fillStyle = '#e8ecf2';
      context.beginPath();
      context.moveTo(heron.x - 16, heron.y - 190);
      context.lineTo(heron.x + 16, heron.y - 190);
      context.lineTo(heron.x, tipY);
      context.closePath();
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(heron.x, heron.y, heron.radius * (0.4 + depth * 0.6), 0, TAU);
      context.stroke();
      context.restore();
    }
  }

  function drawWhirlpool(whirl) {
    context.save();
    context.translate(whirl.x, whirl.y);
    context.rotate(whirl.spin);
    context.strokeStyle = PALETTE.whirl;
    context.globalAlpha = 0.75;
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = whirl.radius * (0.35 + ring * 0.28);
      context.lineWidth = 4 - ring;
      context.beginPath();
      context.arc(0, 0, radius, 0.4 + ring, Math.PI * 1.5 + ring);
      context.stroke();
    }
    context.globalAlpha = 0.35;
    context.fillStyle = '#06283d';
    context.beginPath();
    context.arc(0, 0, whirl.radius * 0.22, 0, TAU);
    context.fill();
    context.restore();
    context.globalAlpha = 1;
  }

  function drawPearl(state, pearl) {
    const bob = Math.sin(state.time * 3 + pearl.phase) * 2;
    const glow = context.createRadialGradient(pearl.x, pearl.y + bob, 1, pearl.x, pearl.y + bob, pearl.radius * 2.4);
    glow.addColorStop(0, 'rgba(255, 233, 168, 0.85)');
    glow.addColorStop(1, 'rgba(255, 233, 168, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(pearl.x, pearl.y + bob, pearl.radius * 2.4, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.pearl;
    context.beginPath();
    context.arc(pearl.x, pearl.y + bob, pearl.radius, 0, TAU);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(pearl.x - 4, pearl.y + bob - 4, 4, 0, TAU);
    context.fill();
  }

  function drawFireflyPickup(state, fly) {
    const pulse = 0.7 + Math.sin(state.time * 5 + fly.phase) * 0.3;
    const glow = context.createRadialGradient(fly.x, fly.y, 1, fly.x, fly.y, fly.radius * 2.6);
    glow.addColorStop(0, `rgba(125, 255, 212, ${0.8 * pulse})`);
    glow.addColorStop(1, 'rgba(125, 255, 212, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(fly.x, fly.y, fly.radius * 2.6, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.firefly;
    context.beginPath();
    context.arc(fly.x, fly.y, fly.radius * 0.6, 0, TAU);
    context.fill();
    context.strokeStyle = 'rgba(125, 255, 212, 0.8)';
    context.lineWidth = 2;
    const flap = Math.sin(state.time * 18 + fly.phase) * 5;
    context.beginPath();
    context.ellipse(fly.x - 8, fly.y - 4 - flap, 7, 3, -0.5, 0, TAU);
    context.ellipse(fly.x + 8, fly.y - 4 - flap, 7, 3, 0.5, 0, TAU);
    context.stroke();
  }

  function drawKoi(state) {
    const koi = state.koi;
    // The tail: a ribbon of shrinking, fading circles trailing the stored positions.
    for (let index = koi.tail.length - 1; index >= 2; index -= 1) {
      const point = koi.tail[index];
      const fraction = 1 - index / koi.tail.length;
      context.fillStyle = `rgba(255, 158, 94, ${0.55 * fraction})`;
      context.beginPath();
      context.arc(point.x, point.y, 3 + 9 * fraction, 0, TAU);
      context.fill();
    }
    const blink = koi.invulnerable > 0 && Math.floor(koi.invulnerable * 10) % 2 === 0;
    context.save();
    context.translate(koi.x, koi.y);
    context.rotate(koi.angle);
    if (blink) context.globalAlpha = 0.35;
    context.shadowColor = PALETTE.koiOrange;
    context.shadowBlur = 22;
    // Tail fin, fanning behind the body.
    context.fillStyle = PALETTE.koiFin;
    context.beginPath();
    context.moveTo(-18, 0);
    context.quadraticCurveTo(-38, -16, -46, -6);
    context.quadraticCurveTo(-34, 0, -46, 6);
    context.quadraticCurveTo(-38, 16, -18, 0);
    context.fill();
    // Body: orange back fading to a white belly.
    const body = context.createLinearGradient(0, -16, 0, 16);
    body.addColorStop(0, PALETTE.koiOrange);
    body.addColorStop(0.55, '#ffb37a');
    body.addColorStop(1, PALETTE.koiWhite);
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(0, 0, 30, 16, 0, 0, TAU);
    context.fill();
    // Orange patches on the back.
    context.fillStyle = 'rgba(230, 84, 20, 0.55)';
    context.beginPath();
    context.ellipse(-6, -8, 12, 6, -0.3, 0, TAU);
    context.ellipse(12, -6, 8, 5, 0.4, 0, TAU);
    context.fill();
    // Dorsal fin and side fins.
    context.fillStyle = PALETTE.koiFin;
    context.beginPath();
    context.moveTo(-4, -14);
    context.quadraticCurveTo(2, -26, 10, -14);
    context.closePath();
    context.fill();
    context.beginPath();
    context.ellipse(-2, 10, 10, 4, 0.5, 0, TAU);
    context.ellipse(-2, -10, 10, 4, -0.5, 0, TAU);
    context.fill();
    context.shadowBlur = 0;
    // Eye, looking upstream.
    context.fillStyle = '#1a1a22';
    context.beginPath();
    context.arc(16, -6, 3.4, 0, TAU);
    context.arc(16, 6, 3.4, 0, TAU);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(17, -7, 1.2, 0, TAU);
    context.arc(17, 5, 1.2, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      if (!particle.active) continue;
      const alpha = Math.max(0, particle.life / particle.maxLife);
      context.globalAlpha = alpha;
      if (particle.kind === 0) context.fillStyle = '#cfe9ff';
      else if (particle.kind === 1) context.fillStyle = PALETTE.pearl;
      else context.fillStyle = PALETTE.firefly;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawFloaters(state) {
    for (const slot of state.floaters) {
      if (!slot.active) continue;
      context.globalAlpha = Math.min(1, slot.life / 0.45);
      text(slot.text, slot.x, slot.y, 22, PALETTE.gold, 'center');
    }
    context.globalAlpha = 1;
  }

  function drawHeart(x, y, size, filled) {
    context.save();
    context.translate(x, y);
    context.scale(size / 20, size / 20);
    context.beginPath();
    context.moveTo(0, 6);
    context.bezierCurveTo(-12, -4, -6, -12, 0, -5);
    context.bezierCurveTo(6, -12, 12, -4, 0, 6);
    context.closePath();
    context.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
    context.fill();
    if (!filled) {
      context.strokeStyle = '#5a3a4a';
      context.lineWidth = 1.5;
      context.stroke();
    }
    context.restore();
  }

  function drawGateIcon(x, y) {
    context.save();
    context.translate(x, y);
    context.strokeStyle = PALETTE.lantern;
    context.fillStyle = PALETTE.lantern;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-12, -8);
    context.lineTo(12, -8);
    context.moveTo(-9, -2);
    context.lineTo(9, -2);
    context.moveTo(-7, -8);
    context.lineTo(-7, 10);
    context.moveTo(7, -8);
    context.lineTo(7, 10);
    context.stroke();
    context.beginPath();
    context.arc(0, 4, 3, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 28, 20, 28, PALETTE.text, 'left');
    text(levelLabel(state.level), 28, 54, 20, PALETTE.muted, 'left');
    // Distance progress: the river's length, with the Lantern Gate at its end.
    const barX = 440;
    const barWidth = 400;
    const barY = 24;
    const progress = Math.min(1, state.distance / GOAL_DISTANCE);
    context.fillStyle = 'rgba(7, 13, 29, 0.65)';
    context.beginPath();
    context.roundRect(barX - 8, barY - 8, barWidth + 16, 34, 10);
    context.fill();
    context.fillStyle = '#1d2f4d';
    context.beginPath();
    context.roundRect(barX, barY, barWidth, 12, 6);
    context.fill();
    const fill = context.createLinearGradient(barX, 0, barX + barWidth, 0);
    fill.addColorStop(0, '#2e9e7a');
    fill.addColorStop(1, PALETTE.gold);
    context.fillStyle = fill;
    if (progress > 0) {
      context.beginPath();
      context.roundRect(barX, barY, Math.max(12, barWidth * progress), 12, 6);
      context.fill();
    }
    drawGateIcon(barX + barWidth + 12, barY + 6);
    text(distanceLabel(`${Math.floor(state.distance)} m`), barX + barWidth / 2, barY + 30, 16, PALETTE.muted, 'center');
    // Hearts, top right.
    const heartSize = 22;
    const heartGap = 10;
    const firstHeart = FIELD.width - 28 - LIVES * (heartSize + heartGap) + heartGap;
    for (let life = 0; life < LIVES; life += 1) {
      drawHeart(firstHeart + life * (heartSize + heartGap) + heartSize / 2, 34, heartSize, life < state.lives);
    }
    // Combo meter under the hearts.
    if (state.combo > 1) {
      const label = comboLabel(state.combo);
      text(label, FIELD.width - 28, 58, 20, PALETTE.gold, 'right');
      const meterWidth = 110;
      const meterX = FIELD.width - 28 - meterWidth;
      context.fillStyle = '#1d2f4d';
      context.beginPath();
      context.roundRect(meterX, 84, meterWidth, 6, 3);
      context.fill();
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.roundRect(meterX, 84, meterWidth * Math.max(0, state.comboTimer / COMBO.window), 6, 3);
      context.fill();
    }
  }

  function drawPanel(title, lines, prompt, titleColor) {
    context.save();
    context.fillStyle = 'rgba(7, 13, 29, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.restore();
    glowText(title, FIELD.width / 2, 250, 84, titleColor || PALETTE.text, PALETTE.lantern, 32);
    let y = 310;
    for (const line of lines) {
      text(line, FIELD.width / 2, y, 22, PALETTE.muted, 'center');
      y += 34;
    }
    text(prompt, FIELD.width / 2, y + 26, 24, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'Swim the glowing river home — reach the Lantern Gate at 1000 m.',
    'Steer with arrows or WASD, or hold the pointer. Dodge rocks, logs, herons and whirlpools.',
    'Pearls +10, fireflies +25, chained into a combo. Three hits and the current takes you.',
    'P pauses · M mutes',
    '',
  ];

  /** Paint one frame: the river, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake * Math.sin(state.time * 91) * 0.6;
    const shakeY = state.shake * Math.cos(state.time * 113) * 0.6;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawWater(state);
    drawBanks(state);
    for (const whirl of state.whirlpools) if (whirl.active) drawWhirlpool(whirl);
    for (const obstacle of state.obstacles) {
      if (!obstacle.active) continue;
      if (obstacle.kind === KIND_LOG) drawLog(obstacle);
      else drawRock(obstacle);
    }
    for (const pearl of state.pearls) if (pearl.active) drawPearl(state, pearl);
    for (const fly of state.fireflies) if (fly.active) drawFireflyPickup(state, fly);
    for (const heron of state.herons) if (heron.active) drawHeron(state, heron);
    drawKoi(state);
    drawParticles(state);
    drawFloaters(state);

    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? bestLabel(best) : 'No best score yet — the river is waiting.';
      drawPanel('KOI CURRENT', TITLE_LINES, 'Press Space or click to start', PALETTE.gold);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The river waits for you.'], 'Press P or Space to keep swimming', PALETTE.text);
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'THE LANTERN GATE',
        [
          'You swam the whole river home.',
          finalLabel(state.score),
          `Pearls ${state.pearlsCollected} · Fireflies ${state.firefliesCollected} · Near misses ${state.nearMisses}`,
          bestLabel(best),
        ],
        'Press Space or click to swim again',
        PALETTE.gold,
      );
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'THE CURRENT TOOK YOU',
        [
          `You swam ${Math.floor(state.distance)} m of ${GOAL_DISTANCE} m.`,
          finalLabel(state.score),
          `Pearls ${state.pearlsCollected} · Fireflies ${state.firefliesCollected} · Near misses ${state.nearMisses}`,
          bestLabel(best),
        ],
        'Press Space or click to try again',
        PALETTE.heart,
      );
    }

    // A soft vignette, so the edges fall into dusk.
    const vignette = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    vignette.addColorStop(0, 'rgba(4, 8, 20, 0)');
    vignette.addColorStop(1, 'rgba(4, 8, 20, 0.5)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
