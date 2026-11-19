# Task List: Baseline Hardening (Iteration 1)

Status: **completed** · 2026-11-18 · CI run 44454516000 green
Plan: `tasks/plan.md` · Spec: `SPEC.md` (v1.1)
Result: 41 tests / 10 files · build clean · browser smoke passed · test → build → deploy green.

Target order: T1 → T2 → T3 → T4. Every task ends green (`npm test`, `npm run build`).

---

## Task T1: Run tests before deploy

**Description:** Add a `test` job to the Pages workflow and make `build` depend on
it, so a failing suite can never publish. Keep triggers, permissions and
concurrency exactly as they are.

**Acceptance criteria:**
- [x] `deploy.yml` defines a `test` job on `ubuntu-latest` using Node 20 with npm
      caching, running `npm ci` then `npm test`.
- [x] The `build` job declares `needs: test`; `deploy` still declares `needs: build`.
- [x] `on`, `permissions` and `concurrency` blocks are unchanged.
- [x] The YAML parsed on the Actions runner and the job graph is
      `deploy → build → test` (run 44454516000).

**Verification:**
- [x] `npm test` passes locally (41/41 after T4).
- [x] `git diff .github/workflows/deploy.yml` reviewed line by line.
- [x] After pushing, the Actions run showed `test` before `build`:
      https://github.com/zoroastromx2/jupiter/actions/runs/44454516000

**Dependencies:** None.

**Files likely touched:**
- `.github/workflows/deploy.yml`

**Estimated scope:** Small (1 file).

---

## Task T2: Single source for the J2000 time constants

**Description:** `MissionSimulator.js` privately redefined `J2000_EPOCH_MS` and
`MS_PER_DAY` instead of importing them from `AstroScale.js`. Import the shared
constants and delete the local copies; behaviour must not change.

**Acceptance criteria:**
- [x] `MissionSimulator.js` imports `J2000_EPOCH_MS` and `MS_PER_DAY` from
      `../math/AstroScale.js`.
- [x] No `Date.UTC(2000, ...)` or `86400000` literal remains in that file.
- [x] Mission timing, epoch jump and relative-velocity results are unchanged
      (existing mission tests pass untouched).

**Verification:**
- [x] `npm test` → 41/41 (33/33 at this task's checkpoint).
- [x] `npm run build` → exit 0.
- [x] `Select-String -Path src/core/MissionSimulator.js -Pattern '86400000|Date.UTC'`
      returns nothing.

**Dependencies:** None.

**Files likely touched:**
- `src/core/MissionSimulator.js`

**Estimated scope:** Extra small (1 file).

---

## Task T3: Guard `StarfieldSimulator` for non-browser runtimes

**Description:** The constructor read `window.devicePixelRatio` directly, so the
class could not be instantiated in Node. Read it behind a `typeof window` guard
with a fallback of 1, and add a Node-side test that pins the star field and the
pixel-ratio clamp. The test failed first with `ReferenceError: window is not
defined` (RED), then passed after the guard (GREEN).

**Acceptance criteria:**
- [x] `StarfieldSimulator` never touches `window` without a `typeof window` guard.
- [x] `new StarfieldSimulator(new THREE.Scene())` works in the Vitest Node environment.
- [x] Test asserts 3,200 points, `uPixelRatio` = 1 in Node, `setPixelRatio(1.5)` → 1.5,
      `setPixelRatio(3)` → 2, and identical positions across two instances (seed).
- [x] Browser rendering is unchanged.

**Verification:**
- [x] `npx vitest run tests/StarfieldSimulator.test.js` passes (3 tests).
- [x] `npm test` and `npm run build` pass.

**Dependencies:** None.

**Files likely touched:**
- `src/core/StarfieldSimulator.js`
- `tests/StarfieldSimulator.test.js`

**Estimated scope:** Small (2 files).

---

## Task T4: Cover the camera state machine

**Description:** `CameraController` owns the orbital → surface → instrument
transitions but had no tests. Added a Node-side suite using a real
`PerspectiveCamera`, a stub `OrbitControls` (`{ target, enabled, update() }`) and
synchronous GSAP progress, covering focus/follow, surface lock, instrument view,
lens toggle and exit restoration. A deliberate lens mutation made the suite fail,
confirming the assertions have teeth.

**Acceptance criteria:**
- [x] `focusOnObject` sets `currentTarget`, starts a tween, and after
      `tween.progress(1)` places the camera at `focusDistance` with `controls.target`
      on the target's world position.
- [x] `update()` translates the camera by the target delta while following.
- [x] `landOnSurface` + `progress(1)` sets `isSurfaceLocked`, puts the camera on the
      mount and points `camera.up` away from the body center; `exitSurfaceView`
      restores the default up and enables controls.
- [x] `engageInstrumentView(mount, 32)` locks, sets fov 32 and disables controls;
      `update()` places the camera on the mount; `toggleInstrumentLens()` switches
      to `NAC` / 10° and back to `WAC` / 32°.
- [x] `exitInstrumentView()` restores the default fov, up and controls.
- [x] Suite runs in Node with no DOM, no timers and no new dependency.

**Verification:**
- [x] `npx vitest run tests/CameraController.test.js` passes (5 tests).
- [x] `npm test` → 41 tests, all passing.
- [x] `npm run build` → exit 0.
- [x] Browser smoke: Vite dev server + headless Chrome 157 (SwiftShader), real
      clicks on target, surface, Esc, Juno mission, instrument and lens; no
      exceptions.

**Dependencies:** None (T1 landed first so the gate covers it).

**Files likely touched:**
- `tests/CameraController.test.js`

**Estimated scope:** Medium (1 file, several cases).

---

## Checkpoint CP1 — after T1, T2

- [x] `npm test` 33/33 at the checkpoint; `npm run build` clean.
- [x] Workflow graph reviewed: `deploy → build → test`.
- [x] No production behaviour change beyond the constant import.
- [x] Gate covered by the batch approval of T1–T4 (2026-11-18); no separate pause
      was requested.

## Checkpoint CP2 — after T3, T4

- [x] `npm test` 41/41; `npm run build` clean.
- [x] Code/test diff = 5 files; planning docs (`SPEC.md`, `tasks/`) updated
      separately; no lockfile churn.
- [x] Browser smoke passed (focus, follow, surface, instrument, lens); see the
      completion record.
- [x] Ready for final review; no commit made without user consent.

---

## Completion record — 2026-11-18

- Tests: 10 files / 41 tests / 549 ms.
- Build: 44 modules / 369 ms; JS 159.69 kB + three 671.26 kB
  (gzip 53.66 + 167.58); CSS 18.48 kB.
- Browser: Chrome 157 headless (SwiftShader), 1440×900, WebGL2, loader hidden,
  75 FPS, 0 exceptions, 1 warning (`THREE.Clock` deprecated — logged as G13).
- Flows: Io select → surface → Esc; Juno mission → 2016-08-27; instrument
  WAC 52° → NAC 10° → exit.
- Code/test files: `deploy.yml`, `MissionSimulator.js`, `StarfieldSimulator.js`,
  `CameraController.test.js`, `StarfieldSimulator.test.js`.
- Residual: none. CI run 44454516000: test ✓, build ✓, deploy ✓.

## Noticed but not touching

- `THREE.Clock` is deprecated in three r187 (G13).
- `instrument-lens-readout` keeps the last lens value after leaving instrument
  view; the HUD is hidden, so it is cosmetic.

---

## Out of scope (do not pull into this iteration)

G2 licence · G5 lazy model loading · G6 lint/format/coverage · G7 i18n ·
G8 self-hosted fonts · G9 module splits · G10 WebGL context loss · G11 visual
baselines · G12 local `dist/` · tests for `main.js`.
