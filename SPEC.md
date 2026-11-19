# Spec: Jovian Observatory

**Status:** Draft — awaiting approval
**Version:** 1.3 (baseline + hardening + boot performance + quality gate)
**Repository:** `E:\AAD\3D\Jupiter` @ `632dd78`
**Date:** 2026-11-18

> This spec was reconstructed from the code, the README and the test suite. It
> records the contract the current application already satisfies, so future
> changes have a written reference. Anything not implemented yet is marked
> **Target**; everything else describes the present behaviour.

---

## 1. Objective

A single-page, physically scaled WebGL observatory of Jupiter, Io, Europa,
Ganymede and Callisto. It is a visualisation and education piece, not an
ephemeris-grade planning tool: positions come from J2000 Keplerian elements,
not from a JPL SPICE kernel.

**Users**

| User | Job to be done |
|---|---|
| Astronomy enthusiast | Explore the Jovian system, moons, rings and seasons in real time |
| Educator / communicator | Jump to a date, show transits, ring backlight, historical flybys |
| Portfolio reviewer | Judge rendering quality, physical fidelity and code craft |
| Developer / agent | Change the simulation without breaking physics, assets or UI |

**Success looks like**

- The page loads from a static host and runs without a build step at runtime.
- Every control in the HUD has a visible, reversible effect.
- Physical values match the NASA/JPL table pinned by the tests.
- A change can be verified with `npm test` and `npm run build` alone for logic,
  and with a short manual checklist for rendering.

**Out of scope for this baseline**

- Rendering Saturn, its moons or its rings (the catalogue keys exist but are
  disabled on purpose).
- Real ephemeris ingestion (SPICE, Horizons), gravity N-body integration,
  spacecraft attitude dynamics.
- Mobile native apps, multi-user sessions, any backend or database.
- Photorealistic mission reconstruction; the spacecraft paths and optics are
  stylised approximations.

---

## 2. Tech stack

| Layer | Choice | Version |
|---|---|---|
| Language | JavaScript (ES2022 modules, no TypeScript) | — |
| 3D | Three.js | `0.187.0` |
| Animation | GSAP (camera and surface transitions) | `3.15.1` |
| Bundler / dev server | Vite | `8.3.8` (range `^8.3.6`) |
| Tests | Vitest (Node environment) | `5.1.1` (range `^5.1.0`) |
| Runtime | Node.js | `>=20.19.0`; `npm run perf` needs Node 22+ |
| Hosting | GitHub Pages via Actions | `deploy.yml` |

Required browser capability: **WebGL2**. Three r187 no longer ships a WebGL1
renderer, so browsers without WebGL2 are unsupported. No polyfill is provided.

---

## 3. Commands

These are the only supported entry points. They were executed while writing
this spec; results are recorded in §11.

```bash
npm install          # install dependencies from package-lock.json
npm run dev          # Vite dev server, http://localhost:3000, host exposed
npm test             # Vitest, single run (48 tests / 10 files)
npm run build        # production bundle into dist/
npm run preview      # serve the built dist/ locally
npm run perf         # boot performance budget (Node 22+, headless Chrome)
```

Deployment (CI, not manual):

```bash
VITE_BASE_PATH=/<repo>/ npm run build   # base path consumed by vite.config.js
```

There is **no** lint, format, type-check, coverage or E2E script. `npm run perf`
is a browser budget check, not an E2E suite. Adding another gate is a boundary
decision (see §8).

---

## 4. Project structure

```
index.html                     Single page: HUD markup, loader, canvas, module entry
vite.config.js                 Base path, asset includes, build chunks, Vitest config
package.json                   Scripts, engines, runtime and dev dependencies
.github/workflows/deploy.yml   test → build + perf → GitHub Pages
public/                        Served verbatim: textures (5 MB) and GLB models (6 MB)
src/
  main.js                      Bootstrap, DOM wiring, UI state, frame loop (~1,000 lines)
  style.css                    HUD, glass panels, labels, responsive layout (~1,400 lines)
  math/
    AstroScale.js              Units, J2000 epoch, NASA/JPL constants, ring boundaries
    KeplerOrbit.js             Newton-Raphson Kepler solver, orbital position, Sun direction
  core/
    JupiterSimulator.js        Oblate spheroid, System III spin, heliocentric Sun, moon uniforms
    GalileanMoonSimulator.js   LAN/inclination pivots, Kepler position, tide lock, surface mount
    JovianRingsSimulator.js    Bounding cylinder, raymarch uniforms, shepherd markers
    MissionSimulator.js        Trajectory curves, periapsis remap, probe models, optics (~1,030 lines)
    CameraController.js        Orbital / surface / instrument state machine, GSAP transitions
    AssetFetcher.js            Texture and GLB pipeline with fallbacks and base-path resolution
    StarfieldSimulator.js      Deterministic 3,200-star point field
  data/
    HistoricalMissions.js      Six Jovian missions, six disabled Saturn placeholders
  shaders/
    jupiter.vert / .frag       Zonal shear, eddies, Great Red Spot, aurorae, transit shadows
    moon.vert / .frag          Albedo, normal map, Jupiter bounce, eclipse shadow
    jovian_rings.vert / .frag  Single-pass forward-scattering dust raymarch
    starfield.vert / .frag     Additive star points
    VintageOpticsShader.js     Post-process Vidicon / reseau / CCD / JunoCam looks
tests/                         10 Vitest files mirroring math, data and core classes
scripts/perf-budget.mjs        Boot budget: static server, CDP, headless Chrome
dist/                          Build output (git-ignored; do not treat as source)
```

`node_modules/` and `dist/` are generated. They are never edited by hand.

---

## 5. Architecture and invariants

### Module map

```
main.js
 ├─ AssetFetcher ──────────────► textures, GLB probe models (with fallbacks)
 ├─ JupiterSimulator ──────────┐
 │   ├─ GalileanMoonSimulator ─┤ equatorial frame, moon world positions
 │   └─ JovianRingsSimulator ──┘
 ├─ StarfieldSimulator
 ├─ MissionSimulator ──────────► Catmull-Rom curve, probe, optical target
 ├─ CameraController ──────────► orbit / surface / instrument states
 └─ VintageOpticsShader ───────► post-process pass
```

### Frame flow

Boot waits for textures only; mission GLBs are fetched when a mission is
selected and swapped into the probe when they arrive (Iteration 2).

1. `daysSinceEpoch` advances by `delta × timeScale × 1/24` (×1 = one simulated
   hour per real second), unless paused.
2. Jupiter updates spin, heliocentric position and Sun direction.
3. Rings and moons update from the same clock.
4. `jupiterSim.updateMoonUniforms()` pushes live world positions/radii into the
   planet shader (transit shadows and Io footprint).
5. `missionSim.update()` advances the probe, milestones and optical target.
6. `CameraController.update()` resolves follow/surface/instrument locks.
7. `composer.render()`, then `labelRenderer.render()`, then HUD refresh at 5 Hz.

### Invariants (do not change casually)

| Invariant | Value / rule | Where enforced |
|---|---|---|
| Scene scale | 1 world unit = 1,000 km | `AstroScale.JOVIAN_KM_PER_UNIT`, README, footer |
| Clock | Days since J2000 = 2000-01-01T12:00:00Z | `AstroScale`, `MissionSimulator` |
| World basis | +Y = ecliptic north, XZ = reference plane | `KeplerOrbit`, scene setup |
| Jupiter shape | `R_eq = 71,492 km`, `R_pol = 66,854 km` | `AstroScale`, tests |
| Mission points | Control points in Jupiter equatorial radii, scaled by `radiusEq` | `MissionSimulator.loadMission` |
| Hot path | No per-frame array/object allocation in update loops | `CameraController`, simulators |
| DOM safety | User/asset text rendered with `textContent`, never `innerHTML` | `main.js`, `MissionSimulator` |
| Determinism | Starfield seeded; tests must not depend on GPU or network | `StarfieldSimulator`, `tests/` |

---

## 6. Code style

ES modules with explicit `.js` extensions, named exports, `const` by default,
classes for stateful simulators, plain functions for math. Two-space indent,
single quotes, semicolons, trailing commas in multiline literals. Physics
comments explain *why*, not *what*. Hot loops use indexed `for` and
preallocated `THREE.Vector3` instances.

```js
export function resolveAssetUrl(path, baseUrl = import.meta.env?.BASE_URL ?? '/') {
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path
    .replace(/^(\.\/|\/)+/, '')
    .replace(/^public\//, '');
  return `${base}${normalizedPath}`;
}
```

Conventions:

- File and class names are PascalCase for simulators, camelCase for functions.
- Physical constants live only in `AstroScale.js`.
- UI strings live in `index.html` or `HistoricalMissions.js`, not scattered in code.
- Shader files are imported with Vite's `?raw` suffix.
- Mission data uses Spanish titles/descriptions while the UI chrome is English
  (known gap G8).

---

## 7. Testing strategy

Framework: Vitest, Node environment, `tests/**/*.test.js`, no coverage
thresholds, no browser environment.

| Area | Covered | Test file |
|---|---|---|
| Kepler solver, periodicity, bounds | Yes | `KeplerOrbit.test.js` |
| Constants, scale, epoch round-trip, oblateness | Yes | `AstroScale.test.js` |
| Asset URL base path, color spaces, fallbacks | Yes | `AssetPaths.test.js`, `AssetFetcher.test.js` |
| Jupiter/moon transforms, tide lock, uniforms | Yes (headless Three) | `JovianSystem.test.js` |
| Ring geometry, material flags, shepherd motion | Yes | `JovianRings.test.js` |
| Mission catalogue shape, epochs, optics, milestones | Yes | `HistoricalMissions.test.js` |
| Mission time → curve mapping, probe construction | Yes | `MissionSimulator.test.js` |
| Probe lazy load, cache and hot swap | Yes | `AssetFetcher.test.js`, `MissionSimulator.test.js` |
| `main.js` bootstrap and UI wiring | **No** | — |
| `CameraController` focus / surface / instrument states | Yes (headless Three) | `CameraController.test.js` |
| `StarfieldSimulator` determinism and pixel-ratio clamp | Yes | `StarfieldSimulator.test.js` |
| Shaders, optics look, WebGL output | **No** | — |
| Accessibility, keyboard flow, responsive layout | **No** | — |

Suite after Iteration 3: 10 files / 48 tests. The browser smoke and
`npm run perf` (§11) are external to `npm test`.

Rules for changes:

- Any change to `src/math/` or to a physical constant needs a unit test that
  fails before and passes after.
- Any new UI behaviour needs either a DOM-level test (jsdom) or an explicit
  manual check in the PR description.
- Any bug fix needs a regression test unless the bug is rendering-only.
- Tests stay deterministic: no GPU, no network, no wall-clock dependence.

**Target:** add jsdom tests for the `main.js` controls and automate the browser
smoke as a checked-in E2E test. (The CI test job and `CameraController` tests
landed in Iteration 1.)

---

## 8. Boundaries

**Always**

- Run `npm test` and `npm run build` before committing.
- Keep `tests/` green; update the pinned physical table when a constant changes.
- Preserve the scene-scale, epoch, basis and unit conventions in §5.
- Use `textContent` for anything derived from data or assets.
- Keep per-frame code allocation-free; preallocate vectors.

**Ask first**

- Adding a runtime or dev dependency, a lint/format/type-check tool, or a CI gate.
- Changing a physical constant, the epoch, the scene scale or the camera far plane.
- Changing public controls, HUD copy, or the mission catalogue schema.
- Adding network calls (fonts, analytics, CDN), storage, or a backend.
- Changing `VITE_BASE_PATH`, the Pages workflow, or the deployment target.
- Importing or replacing an asset whose licence is not already credited.

**Never**

- Commit secrets, tokens, or `.env` files.
- Commit `dist/` or edit `node_modules/`.
- Delete or skip a failing test to make CI pass without a tracked replacement.
- Introduce `innerHTML` with data-derived content.
- Change the 1 unit = 1,000 km scale or the J2000 epoch silently.
- Remove texture/model credits from the README.

---

## 9. Success criteria

The baseline is accepted when all of the following hold. Commands are evidence;
visual criteria are a manual checklist.

1. `npm ci && npm test` → 41/41 passing.
2. `npm run build` → exit 0, `dist/index.html` + hashed JS/CSS emitted.
3. `npm run dev` → page boots, loader reaches 100%, no uncaught console error.
4. Target selection, close orbit, surface view, Esc, time dilation, pause,
   time machine, orbit/label/ring toggles and ring backlight all work.
5. Mission selection jumps the clock, draws the path, and enables Follow probe,
   Instrument view and Lens; instrument HUD shows distance and velocity.
6. Jupiter and the four moons match the radii, periods and obliquity pinned in
   the tests; transit shadows appear near the 2030-04-01 equinox.
7. Deployed build loads under `/<repo>/` with no 404 for assets.
8. No unhandled promise rejection during load with all assets present.
9. **Met (Iteration 2):** first frame ≤ 3 s on a 20 Mbps / 40 ms profile and
   initial payload ≤ 3.6 MB. Measured median 2.31 s and 3.37 MB; mission GLBs
   load on demand. The CI budget uses a looser 5 s ceiling under forced
   SwiftShader.
10. **Target:** ≥ 50 FPS at 1080p on integrated graphics; adaptive quality if
    the target is missed.
11. **Met (Iteration 3):** `npm run perf` passes and the `perf` job gates the
    Pages deploy; a breach fails the workflow before publishing.

---

## 10. Current state: known gaps

Ordered by impact on future work. Evidence is from the repository at `632dd78`,
plus Iteration 1 (2026-11-18).

**Iteration 1 status:** G1 closed (tests gate the Pages deploy); G3 closed
(single source of time constants); G4 partially closed (`CameraController`
covered, `main.js` still untested); G10 partially closed (`StarfieldSimulator`
guard added, WebGL context loss still unhandled). G13 is new.

**Iteration 2 status:** G5 partially closed — probe models load per mission;
first frame 2.31 s median and 3.37 MB initial on the measured profile. An
automated performance budget is still missing.

**Iteration 3 status:** G5 closed (`npm run perf` + gating `perf` CI job);
G13 closed (`THREE.Timer`, no deprecation warning).

| ID | Gap | Evidence | Suggested action |
|---|---|---|---|
| G1 | CI deploys without running tests — **closed, verified in CI** | `test` job added; `build` now declares `needs: test` | — |
| G2 | No code licence | No `LICENSE` at root; README credits assets only | Choose a licence; review CC BY-SA implications of the Ganymede/Callisto maps |
| G3 | Epoch constants duplicated — **closed** | `MissionSimulator.js` now imports `J2000_EPOCH_MS` and `MS_PER_DAY` from `AstroScale` | — |
| G4 | UI and boot logic untested — **partial** | `main.js` (~1,000 lines) has no test; `CameraController` is now covered | Extract testable state helpers; add jsdom tests for `main.js` |
| G5 | No performance guard — **closed** | `npm run perf` checks first frame, payload and lazy models; the `perf` CI job gates `deploy` | — |
| G6 | No lint/format/coverage | No ESLint/Prettier/c8 config or scripts | Add on request; define thresholds in this spec first |
| G7 | Mixed languages | English UI chrome, Spanish mission titles/labels, `lang="en"` | Pick one product language or add an i18n layer |
| G8 | External font dependency | Google Fonts `<link>` in `index.html` | Self-host fonts or document the network requirement |
| G9 | Large modules | `main.js` ~1,000 lines, `MissionSimulator` ~1,030, `style.css` ~1,400 | Split by responsibility when touching them (HUD view, mission playback, styles) |
| G10 | No runtime resilience — **partial** | No WebGL context-loss handler; `StarfieldSimulator` guard added in Iteration 1 | Add context restore + fallback |
| G11 | No coverage of the visual result | Shaders and optics have no reference images | Add screenshot baselines if visual regressions become a concern |
| G12 | Stale `dist/` in the tree | `dist/` exists locally (git-ignored) and can drift from `src/` | Build only in CI; keep local `dist/` out of reviews |
| G13 | Deprecated `THREE.Clock` — **closed** | Replaced by `THREE.Timer`; the perf script fails if the warning returns | — |

---

## 11. Verification log

Executed on 2026-11-18 in `E:\AAD\3D\Jupiter`:

**Baseline (commit `632dd78`):**

| Command | Result |
|---|---|
| `npm test` | 8 files, 33 tests passed, 490 ms |
| `npm run build` | 44 modules, 1.41 s; JS 159.71 kB + three 671.26 kB (gzip 53.68 + 167.58), CSS 18.48 kB |
| `npm ls --depth=0` | three 0.187.0, gsap 3.15.1, vite 8.3.8, vitest 5.1.1 |
| `git status` | clean, `main` tracks `origin/main`, 3 commits |
| `git remote` | `https://github.com/zoroastromx2/jupiter.git` |

**After Iteration 1 (working tree):**

| Check | Result |
|---|---|
| `npm test` | 10 files, 41 tests passed, 549 ms |
| `npm run build` | 44 modules, 369 ms; JS 159.69 kB + three 671.26 kB (gzip 53.66 + 167.58), CSS 18.48 kB |
| Epoch literals | no `86400000` or `Date.UTC` left in `MissionSimulator.js` |
| Headless Chrome 157 (SwiftShader) | WebGL2, loader hidden, 75 FPS at 1440×900, zero exceptions, one deprecation warning (`THREE.Clock`) |
| HUD smoke | Io → surface → Esc; Juno mission → 2016-08-27; instrument WAC 52° → NAC 10° → exit |
| GitHub Actions run [44454516000](https://github.com/zoroastromx2/jupiter/actions/runs/44454516000) | test ✓, build ✓, deploy ✓ |

**After Iteration 2 (2026-11-18):**

| Check | Result |
|---|---|
| `npm test` | 10 files, 48 tests passed, 581 ms |
| `npm run build` | 44 modules, 845 ms; JS 160.71 kB + three 671.26 kB (gzip 54.02 + 167.58), CSS 18.48 kB |
| Boot, 3 runs (20 Mbps / 40 ms, cache off) | first frame 2,314 / 2,206 / 2,496 ms → median **2,314 ms** (baseline 5,283 ms) |
| Initial transfer | **3,373,840 B** (baseline 9,675,518 B) |
| GLB before first frame | **0** (baseline 3) |
| Mission requests | Pioneer 10 → 1× `pioneer_11.glb`; Voyager 1 → 1× `voyager_1.glb`; Juno → 0 |
| Instrument smoke | Voyager 1 → WAC 20° → NAC 10° → exit; 0 exceptions |
| Exceptions | 0 |

**After Iteration 3 (2026-11-18):**

| Check | Result |
|---|---|
| `npm test` | 10 files, 48 tests passed, 559 ms |
| `npm run build` | 44 modules, 295 ms; JS 160.76 kB + three 670.66 kB (gzip 54.04 + 167.40), CSS 18.48 kB |
| `npm run perf` (forced SwiftShader) | first frame 3,075 ms (budget 5,000) · transfer 3,373,490 B (budget 4,000,000) · 0 GLBs · 0 exceptions · 0 Clock warnings |
| Budget failure path | `PERF_FIRST_FRAME_MS=1` → exit 1 with the breach listed |
| Timer smoke | +2 h in 2 s at ×1; pause held; resume advanced; 0 exceptions |
| CI `perf` job | pending first push |

Not verified: live GPU rendering on the target hardware, mobile layout,
accessibility audit, deployed Pages run in a real browser, first CI run of the
`perf` job.

---

## 12. Open questions

1. **Scope (resolved 2026-11-18):** the baseline, Iteration 1 (hardening),
   Iteration 2 (boot performance) and Iteration 3 (quality gate) are complete.
   The next iteration still needs a choice: i18n, licence, Saturn, or
   `pull_request` checks.
2. **Support matrix (partial):** WebGL2 is assumed but not stated in the README;
   the budget enforces 20 Mbps / 40 ms under forced SwiftShader. Real devices
   remain open.
3. **Language:** should the product and the mission catalogue be English,
   Spanish, or localised at runtime?
4. **Licence:** which code licence, and are the CC BY-SA 3.0 moon maps
   acceptable for the intended distribution?
5. **Accuracy target:** is J2000 Keplerian propagation the accepted precision,
   or is real ephemeris data expected later?
6. **Quality gate (partial):** tests and the perf budget gate the Pages deploy.
   Still open: coverage thresholds, lint, and `pull_request` checks.
7. **Saturn scope:** keep the disabled catalogue keys as a stub, remove them,
   or schedule the multi-planet build?
8. **Persistence:** should camera, time and toggles survive reloads (URL state
   or `localStorage`)?
