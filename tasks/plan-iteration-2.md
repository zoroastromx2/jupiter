# Implementation Plan: Boot Performance (Iteration 2)

**Status:** approved · implemented · measured (2026-11-18)
**Spec:** `SPEC.md` v1.1 (G5, success criterion 9)
**Date:** 2026-11-18
**Baseline measured at:** commit `87a9ffb`

## Overview

The first frame currently waits for 6.3 MB of spacecraft GLB models that the
page does not need until a mission is selected, and that already have procedural
fallbacks. That is 65 % of the initial payload. This iteration loads a mission
model **on demand**, when its mission is selected, and swaps it in when ready.
Mission selection stays synchronous: the fallback probe is visible immediately,
the GLB replaces it a moment later, and the model is cached for the session.

No new dependency, no bundler change, no layout change. The only user-visible
difference is that a mission's detailed spacecraft may appear a beat after the
fallback.

## Baseline (measured, not estimated)

Chrome 157 headless (SwiftShader), 1440×900, 20 Mbps down / 5 Mbps up / 40 ms
latency, cache disabled, production build served by `vite preview`.

| Metric | Baseline |
|---|---|
| First frame (loader hidden proxy) | **5,283 ms** |
| GLB requests before first frame | **3** |
| GLB bytes transferred | **6,302,052** (65 % of total) |
| Total transfer before first frame | **9,675,518** |
| Textures complete | 1,774 ms |
| Uncaught exceptions | 0 |

The three GLBs start only after every texture is done (`await loadAll()` then
`await loadProbeModels()`), so they add ~3.5 s of pure waiting to first paint.

## Targets (same conditions)

| Target | Value |
|---|---|
| First frame | **≤ 3,000 ms** (baseline 5,283 ms) |
| GLB requests before first frame | **0** |
| Initial transfer | **≤ 3.6 MB** (baseline 9.68 MB) |
| GLB per mission selection | exactly **1**, ≤ 2.3 MB |
| Suite | **≥ 45 tests**, all passing |
| Runtime | build clean, 0 exceptions, mission flows unchanged |

Expected: ~2.0–2.6 s first frame after the change, because textures (~2.7 MB)
and shader compile are the only blocking work left.

## Scope

**In:** lazy `AssetFetcher` API, hot-swap in `MissionSimulator`, wiring in
`main.js`, a first-frame performance mark, unit tests, browser measurement, spec
and task records.

**Out:** deferring optional textures, prefetching all models after idle, service
worker/caching layer, `THREE.Clock` → `THREE.Timer` (G13), i18n, licence,
Saturn, any change to the fallback models or camera behaviour.

## Architecture decisions

- **AD1 — On demand, not prefetch.** Three GLBs are 6.3 MB; a session that never
  opens a mission should not pay for them. Selecting a mission loads only its
  model. Trade-off: the fallback is visible for ~1–2 s on a throttled first
  selection; the cache makes subsequent selections instant.
- **AD2 — Hot swap, never block selection.** `selectMission` keeps its current
  synchronous contract. The GLB is injected when it arrives; the active mission
  determines visibility. Switching missions mid-load cannot show the wrong craft
  because the swap is keyed by model, not by selection order.
- **AD3 — One lazy API.** `AssetFetcher.loadProbeModel(key)` owns the in-flight
  promise and the cache. `loadProbeModels()` remains as a thin wrapper so the
  existing tests and any external caller keep working.
- **AD4 — Measure with CDP, don't add a browser dependency.** The measurement
  harness stays outside the repo (Chrome path is environment-specific). The
  procedure and numbers are recorded here and in `SPEC.md`. A checked-in E2E
  harness remains a separate target.
- **AD5 — No disposal of replaced fallbacks.** Replaced wrappers are detached
  and dropped; their few geometries are bounded by the three probe keys. A full
  disposal pass is deferred until the probe lifecycle grows.

```
boot
  loadAll(textures) ──► build simulators (fallback probes) ──► first frame ──► mark
                                                                     │
selectMission(mission) ──► loadMission(path, fallback) ──────────────┘
        │
        └─► loadProbeModel(modelKey)
                ├─ no GLB mission (galileo, juno) → stop
                ├─ cached → apply immediately
                └─ fetch GLB → assets.models[key] → applyProbeModel → refresh
```

## Task index

Full acceptance criteria live in `tasks/todo-iteration-2.md`.

| ID | Task | Size | Depends on | Primary files |
|---|---|---|---|---|
| T1 | Add the single-model lazy loader | S | — | `AssetFetcher.js`, `AssetFetcher.test.js` |
| T2 | Hot-swap probe models in the simulator | M | — | `MissionSimulator.js`, `MissionSimulator.test.js` |
| T3 | Wire lazy loading into boot and selection | S | T1, T2 | `main.js` |
| T4 | Measure, compare and record | S | T3 | `SPEC.md`, this plan, task log |

## Phases and checkpoints

### Phase 1 — Foundation (T1, T2)

- Lazy loader with in-flight de-duplication and cache.
- `applyProbeModel` with idempotence and active-mission visibility.
- Unit tests for both.

**Checkpoint CP1**
- [x] `npm test` → 48/48.
- [x] `npm run build` → exit 0.
- [x] No change to boot yet; the app still loads all models.

### Phase 2 — Integration and measurement (T3, T4)

- Remove the boot-time `loadProbeModels()` await.
- Load the selected mission's model; add `jovian:first-frame` mark.
- Rebuild, measure three runs at 20 Mbps, record the median.
- Update `SPEC.md` (G5, verification log) and the task log.

**Checkpoint CP2**
- [x] No `/models/*.glb` request before `jovian:first-frame`.
- [x] Pioneer 10/11 → exactly one `pioneer_11.glb`; Voyager 1 → one
      `voyager_1.glb`; Voyager 2 → one `voyager_2.glb`; Galileo/Juno → none.
- [x] Mission path, fallback, follow and instrument view still work; 0 exceptions.
- [x] Median first frame 2,314 ms; initial transfer 3,373,840 B.

### Final checkpoint
- [x] All acceptance criteria in `tasks/todo-iteration-2.md` met.
- [x] `SPEC.md` records the new numbers and narrows G5.
- [x] Ready to commit; no push without user consent.

## Verification procedure

```powershell
npm run build
npm run preview -- --port 3200 --strictPort
# separate shell, Chrome with remote debugging
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new `
  --remote-debugging-port=9333 --user-data-dir="$env:TEMP\jupiter-perf" `
  --enable-unsafe-swiftshader --window-size=1440,900 about:blank
# CDP script (kept in %TEMP%\jupiter-measure):
#   Network.emulateNetworkConditions 20 Mbps / 5 Mbps / 40 ms, cache disabled
#   Page.addScriptToEvaluateOnNewDocument: record loader-hidden and first rAF
#   Performance.getMetrics + resource timings after 18 s
node "$env:TEMP\jupiter-measure\baseline.mjs" 'http://127.0.0.1:3200/' 18000
```

Run three times and report the median. The same script measured the baseline in
this plan; the after-run must use the rebuilt `dist/`.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Fallback → GLB visual pop | Low/Medium | Silent swap only when the mission is active; if it reads badly, prefetch on hover in a later iteration |
| Mission switched while a model loads | Medium | Apply by model key; visibility always derives from the active mission |
| Duplicate wrappers / memory growth | Low | Idempotence guard (`userData.glb`), detach the previous wrapper |
| Measurement variance (SwiftShader) | Medium | Three runs, median; compare relative, not absolute |
| Loader copy says "Loading mission spacecraft" after the change | Low | Update/remove the label in T3 |
| `loadProbeModels` callers break | Low | Keep it as a wrapper; existing tests pin its URLs |

## Rollback

T3 is the only behavioural switch. Reverting it restores the blocking `await
loadProbeModels()`; T1/T2 are additive and harmless on their own. No data,
assets or dependency changes.

## Outcome (2026-11-18)

| Metric | Baseline | After |
|---|---|---|
| First frame | 5,283 ms | **2,314 ms** median (2,314 / 2,206 / 2,496) |
| Initial transfer | 9,675,518 B | **3,373,840 B** |
| GLB requests before paint | 3 | **0** |
| Mission GLB | 3 at boot | 1 per selection (Pioneer/Voyager), 0 for Galileo/Juno |
| Tests | 41 | **48** |
| Exceptions | 0 | 0 |

The first frame improved by 56 % and the initial payload by 65 %. The measured
profile is 20 Mbps / 40 ms, cache disabled, headless Chrome 157 (SwiftShader).

## Open questions

1. **Resolved:** on-demand loading shipped; no prefetch.
2. **Resolved:** targets met (2.31 s ≤ 3.0 s, 3.37 MB ≤ 3.6 MB).
3. **Resolved:** silent fallback until the GLB arrives.
4. **Resolved:** G13 (`THREE.Clock` → `THREE.Timer`) stays a separate change.
