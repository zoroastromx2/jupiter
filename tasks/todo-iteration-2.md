# Task List: Boot Performance (Iteration 2)

Status: **completed** · 2026-11-18
Plan: `tasks/plan-iteration-2.md` · Spec: `SPEC.md` v1.2
Result: 48 tests / 10 files · first frame 2.31 s median · 3.37 MB initial · 0 GLBs before paint.

Target order: T1 → T2 → T3 → T4. Every task ended green (`npm test`, `npm run build`).

---

## Task T1: Add the single-model lazy loader

**Description:** `AssetFetcher` could load all three probe GLBs at once but had no
single-model entry point. Added `loadProbeModel(key)` with a per-key in-flight
promise and session cache, and rebuilt `loadProbeModels()` on top of it so the
existing all-at-once contract and tests keep working.

**Acceptance criteria:**
- [x] `loadProbeModel('pioneer11')` requests `models/pioneer_11.glb` through the
      configured base and stores the result in `assets.models.pioneer11`.
- [x] A second call returns the cached model without a second request.
- [x] Two concurrent calls for the same key share one request.
- [x] An unknown key resolves `null` without a request.
- [x] `loadProbeModels()` still loads Pioneer 11, Voyager 1 and Voyager 2 in that
      order and resolves the `assets.models` object.
- [x] A failed GLB resolves `null` and does not poison the cache (a later call
      retries).

**Verification:**
- [x] `npx vitest run tests/AssetFetcher.test.js` passes (5 tests).
- [x] `npm test` → 48 tests.
- [x] `npm run build` → exit 0.

**Dependencies:** None.

**Files likely touched:**
- `src/core/AssetFetcher.js`
- `tests/AssetFetcher.test.js`

**Estimated scope:** Small (2 files).

---

## Task T2: Hot-swap probe models in the simulator

**Description:** `MissionSimulator` built photo or fallback wrappers once, in its
constructor. Added `applyProbeModel(modelKey, source)` so a GLB that arrives later
replaces the fallback without disturbing the active mission, follow mode or
instrument view.

**Acceptance criteria:**
- [x] `applyProbeModel('pioneer11', source)` replaces the fallback under
      `probeModels.pioneer` with a `PioneerModel` wrapper marked `userData.glb`.
- [x] `applyProbeModel('voyager1' | 'voyager2', source)` targets the matching
      `voyager1` / `voyager2` wrapper.
- [x] The previous wrapper is detached; the new wrapper is the only one for that
      probe key.
- [x] If the active mission uses that probe, the new wrapper is visible; if not,
      it stays hidden.
- [x] Calling `applyProbeModel` twice with the same model is idempotent (no second
      wrapper, same object returned).
- [x] Unknown model keys or `null` sources return `null` and change nothing.
- [x] Existing probe construction and mission playback tests still pass.

**Verification:**
- [x] `npx vitest run tests/MissionSimulator.test.js` passes (6 tests).
- [x] `npm test` → 48 tests.
- [x] `npm run build` → exit 0.

**Dependencies:** None. T3 consumes this API.

**Files likely touched:**
- `src/core/MissionSimulator.js`
- `tests/MissionSimulator.test.js`

**Estimated scope:** Medium (2 files).

---

## Task T3: Wire lazy loading into boot and selection

**Description:** Stopped awaiting the probe GLBs during boot, kept the mission
selector interactive with fallbacks, and loaded the selected mission's model on
demand. Added a `jovian:first-frame` performance mark so the improvement is
measurable.

**Acceptance criteria:**
- [x] `bootstrapApp` no longer calls `loadProbeModels()` before the first tick.
- [x] Selecting Pioneer 10 or 11 loads exactly one `pioneer_11.glb`.
- [x] Selecting Voyager 1 loads exactly one `voyager_1.glb`; Voyager 2 loads
      `voyager_2.glb`.
- [x] Selecting Galileo or Juno loads no GLB.
- [x] The fallback probe is visible immediately; the GLB replaces it when ready;
      switching missions mid-load never shows the wrong craft.
- [x] `performance.mark('jovian:first-frame')` fires once, after the first
      composed frame.
- [x] Loader copy no longer promises a spacecraft wait.
- [x] Mission path, follow, instrument view and lens still work; no exceptions.

**Verification:**
- [x] `npm test` (48 tests) and `npm run build` pass.
- [x] CDP browser run: zero `.glb` requests before the first-frame mark; one per
      model-backed mission; zero for Juno.
- [x] Mission HUD stayed visible for Pioneer, Voyager and Juno selections.

**Dependencies:** T1, T2.

**Files likely touched:**
- `src/main.js`

**Estimated scope:** Small (1 file).

---

## Task T4: Measure, compare and record

**Description:** Rebuilt the production bundle, measured three runs under the same
20 Mbps profile, verified the targets, and updated the spec and task records.

**Acceptance criteria:**
- [x] Median first frame ≤ 3,000 ms (baseline 5,283 ms), three runs.
- [x] Zero GLB requests before the first-frame mark.
- [x] Initial transfer ≤ 3.6 MB (baseline 9.68 MB).
- [x] Each model-backed mission loads exactly one GLB, ≤ 2.3 MB.
- [x] `SPEC.md` §10 G5 status and §11 verification log updated; §9 criterion 9
      reflects the measured target.
- [x] This plan and task list marked with the outcome.
- [x] `npm test` 48/48; `npm run build` clean; no new dependency.

**Verification:**
- [x] CDP harness output recorded (three runs, median).
- [x] `git diff --stat` limited to the expected files; no asset or lockfile churn.

**Dependencies:** T3.

**Files likely touched:**
- `SPEC.md`
- `tasks/plan-iteration-2.md`
- `tasks/todo-iteration-2.md`

**Estimated scope:** Small (docs + measurement).

---

## Checkpoint CP1 — after T1, T2

- [x] `npm test` 48/48; `npm run build` clean.
- [x] Boot behaviour unchanged at this point (all models still eager).
- [x] Both APIs reviewed before wiring into `main.js`.

## Checkpoint CP2 — after T3, T4

- [x] No GLB before `jovian:first-frame`; one per model-backed mission.
- [x] Median first frame 2,314 ms; initial transfer 3,373,840 B.
- [x] Mission flows and HUD unchanged; zero exceptions.
- [x] Spec, plan and task log updated; ready to commit.

---

## Completion record — 2026-11-18

- Tests: 10 files / 48 tests / 581 ms.
- Build: 44 modules / 845 ms; JS 160.71 kB + three 671.26 kB
  (gzip 54.02 + 167.58); CSS 18.48 kB.
- Boot, three runs at 20 Mbps / 40 ms, cache off:
  2,314 / 2,206 / 2,496 ms → **median 2,314 ms** (baseline 5,283 ms, −56 %).
- Initial transfer: **3,373,840 B** (baseline 9,675,518 B, −65 %).
- GLB requests before first frame: **0** (baseline 3).
- Mission requests: Pioneer 10 → `pioneer_11.glb`; Voyager 1 → `voyager_1.glb`;
  Juno → none. One request per model-backed mission.
- Instrument smoke: Voyager 1 → WAC 20° → NAC 10° → exit; 0 exceptions.
- Exceptions: 0.
- Code/test files: `AssetFetcher.js`, `MissionSimulator.js`, `main.js`,
  `AssetFetcher.test.js`, `MissionSimulator.test.js`.
- Residual: no automated performance budget yet (G5 remains partial).

## Noticed but not touching

- `THREE.Clock` deprecation (G13) is still open.
- Optional textures (normals/clouds) still block boot but are only ~0.6 MB.
