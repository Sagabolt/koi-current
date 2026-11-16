# Screenshots — Koi Current (best-game-01)

Captured 2026-11-16 (WITA) in real headless Chrome for Testing
(`~/workspace/playwright-browsers/chrome-linux64/chrome`, SwiftShader),
viewport 1280×720, JPEG quality 88, from `node serve.ts` on port 8080,
via `~/workspace/shot-tools/capture-bestgame.mjs`.
Deterministic staged shots (`?shot=…&seed=1`, `window.__shotReady` awaited);
no re-staging needed — all four seed-1 frames were good on first capture,
and identical again after the 18:11 `main.js` best-score fix (same sha256s).

| File | Size | Dimensions | sha256 | What it shows |
|---|---|---|---|---|
| `1-start.jpg` | 79,605 B | 1280×720 | `17ce59ef71ba704688c33eb31c3dd1990f4734a4e6f968bef2a88caef305c9d2` | Title screen: glowing "KOI CURRENT", full how-to-play text, "Press Space or click to start", koi swimming below, lantern posts and fireflies on the banks. Legible and attractive. |
| `2-play.jpg` | 58,941 B | 1280×720 | `83a7f51c834e6a024c13fa445e30afdcfd08d909dbe303f39f95f8e8b3c0441a` | Live play at 354 m, Level 2, Score 60: orange koi bottom-left, HUD (score, distance bar with gate icon, 3 hearts), rocks, logs, glowing pearls, a green firefly. Rich, readable frame. |
| `3-win.jpg` | 67,856 B | 1280×720 | `76e14a209041536ae3d23937a377c3721485e96e7ebbe4ab3527304f8a22e0de` | Win screen: "THE LANTERN GATE", "You swam the whole river home", Score 105, Pearls 6 · Fireflies 1 · Near misses 0, Best 105, "Press Space or click to swim again"; distance bar full at 1000 m. |
| `4-end.jpg` | 65,494 B | 1280×720 | `54b15245d9db92cc99de6176ff5c52889be53b1b4aaaba3284dfef0a5b19b3e2` | Game over: "THE CURRENT TOOK YOU", "You swam 507 m of 1000 m", Score 810, Pearls 17 · Fireflies 3 · Near misses 5, Best 810, "Press Space or click to try again". |

Constraints (scorer caps): all four are JPEG, 1280×720 (long side 1280,
short side 720 ≥ 480), each ≤ 256 KiB. Dossier `out/dossier.json`
sha256 `0356108f5321cf2ff8af13cdabfd23d4f72660b617a30c1f55fb34cda1cd9062`;
every dossier image `sha256` field and its embedded base64 decode match the
files above exactly (verified 2026-11-16).
