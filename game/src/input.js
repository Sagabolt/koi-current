// Keyboard and pointer input. Held keys give a steering vector; the pointer steers the koi
// toward where it is pressed. One-shot presses (start or restart, pause, mute) are queued as
// bit flags and taken once by the loop, so a press between two frames is never lost and never
// counted twice.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let pointerDown = false;
  let pointerX = FIELD.width / 2;
  let pointerY = FIELD.height / 2;

  /** Turn a pointer event's window position into a point on the 1280x720 field. */
  function toField(event) {
    const rect = target.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    pointerDown = false;
  });
  target.addEventListener('pointerdown', (event) => {
    const point = toField(event);
    pointerX = point.x;
    pointerY = point.y;
    pointerDown = true;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    if (!pointerDown) return;
    const point = toField(event);
    pointerX = point.x;
    pointerY = point.y;
  });
  target.addEventListener('pointerup', () => {
    pointerDown = false;
  });
  target.addEventListener('pointercancel', () => {
    pointerDown = false;
  });

  return {
    /**
     * The steering vector for this frame, from the koi's position: the pointer wins while it
     * is held (a unit vector toward it, shorter as the koi closes in), else the held keys.
     */
    steer(koiX, koiY) {
      if (pointerDown) {
        const dx = pointerX - koiX;
        const dy = pointerY - koiY;
        const length = Math.hypot(dx, dy);
        if (length < 6) return { x: 0, y: 0 };
        const pull = Math.min(1, length / 90);
        return { x: (dx / length) * pull, y: (dy / length) * pull };
      }
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
