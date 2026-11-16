# Koi Current — build notes

## What was built
An original 2D canvas arcade game, static files under `game/`, no build step, no
libraries, no network requests. A glowing koi swims upstream in a dusk river; the
goal is the Lantern Gate at 1000 m. Three hits end the run.

- `game/index.html` — canvas + screen-reader status line, loads `./src/main.js`.
- `game/src/config.js` — all tuning numbers, palette, river channel, pool sizes.
- `game/src/random.js` — seeded mulberry32 RNG (deterministic shots).
- `game/src/input.js` — arrows/WASD 8-way steering, pointer steering while held,
  one-shot confirm / pause / mute flags.
- `game/src/audio.js` — WebAudio synth only: pearl pluck (pitch climbs with the
  combo), firefly chime, near-miss tick, hit thud, level-up chime, win fanfare,
  heron warning, filtered-noise river ambience after the first gesture. Mute with M.
  Every call is a no-op without an AudioContext, so headless shots never crash.
- `game/src/world.js` — rules only, no drawing, no browser APIs: koi physics
  (acceleration + drag + whirlpool pull), spawning, circle collisions, score,
  combo (up to x8, 3 s window), lives, levels every 15 s to 8, distance/win/lose,
  near-miss bonuses, particles and floating score text. Fixed 1/60 s steps.
- `game/src/render.js` — all canvas drawing: dusk water gradient, scrolling
  ripples, parallax banks with swaying reeds and flickering lantern posts,
  drifting fireflies, rising bubbles, koi with trailing tail ribbon and glow,
  rocks (seeded polygons), logs, heron warning rings and beak strikes, spinning
  whirlpools, glowing pearls, HUD (score, distance progress bar with gate icon,
  hearts, level + combo meter), title / paused / win / game-over screens, vignette.
- `game/src/shots.js` — `stageShot(start|play|win|end)`: plays the real rules
  forward with an autopilot (look-ahead per direction, pearl chasing, whirlpool
  and heron avoidance). Start: 5 s title backdrop. Play: 26 s safe autopilot.
  Win: safe autopilot until the gate. End: short-horizon autopilot that gets caught.
- `game/src/main.js` — boot, fixed-step loop, five-screen state machine,
  `?shot=` staging with `window.__shotReady`, best score in localStorage
  (`koi-current.best`), pause on tab hide, status-line announcements.
- `main.ts` — Node 22 stdlib only: copies `game/` + `screenshots/` to
  `MAKEFUN_OUTPUT_DIR` (or `/output`) and writes `dossier.json` via
  `vendor/makefun-game.ts` with the scorer's caps.
- `serve.ts` — the kit starter's dev server, byte-for-byte.
- `vendor/makefun-game.ts` — the kit's copy, byte-for-byte, unchanged.

## Controls
- Arrows / WASD: steer (8-way, smooth acceleration).
- Mouse / touch pointer: hold and the koi swims toward it.
- Space / Enter / click: start / restart.
- P or Esc: pause. M: mute.

## Tuning
- Current speed 120 px/s at level 1, +8% per level; 1000 m takes roughly 60–75 s
  of clean swimming. Rock interval 0.9 s shrinking 8% per level (min 0.38 s).
- Pearls +10 x combo (max x8), fireflies +25 x combo, near miss +5.
- Heron warning 0.9 s, strike radius 62 px. Whirlpool pull 300 px/s² at centre,
  fading to zero at 2.2x radius. Koi top speed 430 px/s, 1.5 s invulnerability
  after a hit.

## Known limits
- The win shot plays the full run to the gate (up to ~90 s of simulated play);
  it is staged headless, so it costs no wall-clock time beyond the simulation.
- The river ambience starts only after the first key/click (browser autoplay
  policy); screenshots are silent by design.
- `screenshots/` is filled in by a later session; the dossier is rebuilt after
  the final screenshots land so its image hashes match.

## Play-test + screenshot session, 2026-11-16 (session 1757dcbb-6331-4f99-a763-7ac71a3e1e2a)

Live play-test in real headless Chrome for Testing (SwiftShader), driven by
`~/workspace/shot-tools/playtest-bestgame.mjs`, plain page (no `?shot=`):
- Space starts ("Playing. 3 lives. Reach the Lantern Gate at 1000 metres.").
- Arrow keys steer: koi visibly moved left edge, then top-centre; score rose
  0 → 20 → 30, a "Close! +5" near-miss popup appeared, one hit took a heart
  ("Hit. 2 lives left."), COMBO x2 meter showed on the pause screen.
- P pauses ("Paused." + "The river waits for you." screen) and P resumes.
- No steering: Level 2 at ~2 s, hits at ~5 s and ~8 s, game over at ~9–19 s
  ("Game over. Score 50."), best 50 saved to localStorage, Space restarts.
- FPS 3.3–3.8 in headless SwiftShader — software rendering, not representative
  of a real GPU; the fixed 1/60 s step loop still advances correctly.
- Console: exactly one error, the favicon 404 (`/favicon.ico` is not in
  `game/`) — cosmetic only, no game code changed for it.
- One real bug found and fixed in `game/src/main.js`: `endGame()`/`winGame()`
  built the screen-reader announcement before `finishRun()` updated `best`,
  so a first run announced "Best 0" while the drawn screen correctly showed
  "Best 50". Fix: extracted `updateBest()` and call it before building the
  message in both paths. Re-verified by re-running capture (all four shots
  byte-identical to before the fix) and the full play-test: announcement now
  reads "Game over. Score 50. Best 50." No other behaviour changed.
