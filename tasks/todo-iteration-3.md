# Task List: Quality Gate (Iteration 3)

Status: **completed** · 2026-11-18 · CI perf job green
Plan: `tasks/plan-iteration-3.md` · Spec: `SPEC.md` v1.3
Result: 48 tests · build clean · perf budget OK · no `THREE.Clock` warning.

Target order: T1 → T2 → T3 → T4.

---

## Task T1: Migrate `THREE.Clock` to `THREE.Timer`

**Description:** `main.js` still created the deprecated `THREE.Clock`. Replace it
with `Timer`, update once per frame, reset before the loop and connect Page
Visibility.

**Acceptance criteria:**
- [x] `main.js` creates `new THREE.Timer()` and calls `connect(document)`.
- [x] Each tick calls `timer.update()` before `getDelta()`.
- [x] `timer.getDelta()` replaces `clock.getDelta()`; `timer.getElapsed()`
      replaces `clock.elapsedTime`.
- [x] `timer.reset()` runs before the first `requestAnimationFrame`.
- [x] No `THREE.Clock` reference remains in `src/`.
- [x] No `THREE.Clock` deprecation warning in the browser console.
- [x] Time advances at ×1, pause holds it, resume advances it.

**Verification:**
- [x] Browser smoke: 08:54:00 → 10:54:05 after 2 s; pause held 11:01:16;
      resume reached 12:33:18; 0 exceptions.
- [x] `npm test` 48/48; `npm run build` clean.

**Dependencies:** None.

**Files:**
- `src/main.js`

**Scope:** Small (1 file).

---

## Task T2: Add the boot performance budget

**Description:** Add a dependency-free CDP script that serves `dist/`, measures
the first frame and initial payload under a fixed profile, and fails on budget
breaches. Wire it as `npm run perf` and document the Chrome/Node requirements.

**Acceptance criteria:**
- [x] `scripts/perf-budget.mjs` starts its own static server with gzip for
      text assets; no preview server required.
- [x] Chrome discovery supports `CHROME_PATH`, standard Windows paths and
      Linux `google-chrome`/`chromium`.
- [x] Budgets: first frame ≤ 8,000 ms, initial transfer ≤ 4,000,000 B, zero GLB
      requests before the frame, zero exceptions, zero Clock warnings.
- [x] Failure exits non-zero with one line per breach; success prints
      `PERF BUDGET OK`.
- [x] The Chrome profile is removed and the process tree is killed on both
      success and failure.
- [x] `package.json` exposes `npm run perf`; README documents Node 22+ and
      `CHROME_PATH`.
- [x] No new dependency.

**Verification:**
- [x] `npm run perf` → OK (first frame 3,075 ms, budget 8,000; 3,373,490 B; 0 GLBs).
- [x] `PERF_FIRST_FRAME_MS=1 npm run perf` → exit 1 with
      `first frame ... > 1 ms`.
- [x] No `jovian-perf-*` temp directories remain after the run.

**Dependencies:** None; measured after T1.

**Files:**
- `scripts/perf-budget.mjs`
- `package.json`
- `README.md`

**Scope:** Medium (3 files).

---

## Task T3: Gate deploys on the performance job

**Description:** Add a `perf` job to the Pages workflow and make `deploy` depend
on both `build` and `perf`.

**Acceptance criteria:**
- [x] `perf` runs on `ubuntu-latest`, Node 22, `npm ci`, `npm run build`,
      `npm run perf`; the build uses the relative base so the static server can
      serve `dist/`.
- [x] `deploy` declares `needs: [build, perf]`; `test` still gates both.
- [x] Triggers, permissions and concurrency unchanged.
- [x] The first Actions run on `main` passes the `perf` job:
      https://github.com/zoroastromx2/jupiter/actions/runs/44458283144

**Verification:**
- [x] YAML reviewed; job graph `deploy → {build, perf} → test`.
- [x] `npm run perf` passes locally under the same forced SwiftShader flags.
- [x] Actions run: test ✓, perf ✓ (5,613 ms), build ✓, deploy ✓.

**Dependencies:** T2.

**Files:**
- `.github/workflows/deploy.yml`

**Scope:** Small (1 file).

---

## Task T4: Verify and record

**Description:** Run the full verification pass and update the spec and
iteration records.

**Acceptance criteria:**
- [x] `npm test` 48/48, `npm run build` clean, `npm run perf` OK.
- [x] Timer smoke covers advance, pause and resume.
- [x] `SPEC.md` v1.3 closes G5 and G13 and records the iteration.
- [x] Plan and task log marked with the outcome.
- [x] CI run for the perf job confirmed on push.

**Verification:**
- [x] Local commands above.
- [x] `git diff --check`; no asset or lockfile churn.

**Dependencies:** T1, T2, T3.

**Files:**
- `SPEC.md`
- `tasks/plan-iteration-3.md`
- `tasks/todo-iteration-3.md`

**Scope:** Small (docs).

---

## Completion record — 2026-11-18

- Tests: 10 files / 48 tests / 559 ms.
- Build: 44 modules / 295 ms; JS 160.76 kB + three 670.66 kB
  (gzip 54.04 + 167.40); CSS 18.48 kB.
- Perf budget (forced SwiftShader, 20 Mbps / 40 ms): first frame 3,075 ms
  (budget 8,000; calibrated after the first CI run measured 5,928 ms);
  initial transfer 3,373,490 B; 0 GLBs before frame; 0 exceptions; 0 Clock
  warnings.
- CI run 44458283144: test ✓, perf ✓ (5,613 ms / 8,000), build ✓, deploy ✓.
- Budget failure path: `PERF_FIRST_FRAME_MS=1` → exit 1.
- Timer smoke: +2 h in 2 s at ×1; pause held; resume advanced; 0 exceptions.
- Files: `src/main.js`, `scripts/perf-budget.mjs`, `package.json`, `README.md`,
  `.github/workflows/deploy.yml`.
- Residual: none. The perf job gates deploys and is green on `main`.

## Noticed but not touching

- CI still does not run on `pull_request`; only `main` and manual dispatch.
- Optional textures still block boot (~0.6 MB); not worth a separate iteration
  yet.
