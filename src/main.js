import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { AssetFetcher } from './core/AssetFetcher.js';
import { CameraController } from './core/CameraController.js';
import { GalileanMoonSimulator } from './core/GalileanMoonSimulator.js';
import { JovianRingsSimulator } from './core/JovianRingsSimulator.js';
import { JupiterSimulator } from './core/JupiterSimulator.js';
import { MissionSimulator } from './core/MissionSimulator.js';
import { StarfieldSimulator } from './core/StarfieldSimulator.js';
import {
  MISSIONS,
  MISSION_ORDER
} from './data/HistoricalMissions.js';
import { VintageOpticsShader } from './shaders/VintageOpticsShader.js';
import {
  J2000_EPOCH_MS,
  JOVIAN_KM_PER_UNIT,
  MS_PER_DAY,
  dateToDaysSinceEpoch,
  setDateFromDays
} from './math/AstroScale.js';
import { advanceSimulationDays } from './math/TimeRate.js';
import { missionUToDaysSinceEpoch } from './math/MissionTimeline.js';
import { MissionTimelineUI } from './ui/MissionTimelineUI.js';
import {
  DEFAULT_LANGUAGE,
  LANG_STORAGE_KEY,
  detectInitialLanguage,
  formatLocalizedRate,
  getBodyMeta,
  getMissionDescription,
  getMissionPlanetLabel,
  normalizeLanguage,
  t
} from './i18n/I18n.js';
import {
  getTouchControlProfile,
  resolveSwipeSheetAction
} from './input/TouchGestureMath.js';
import { TouchNavigationController } from './input/TouchNavigationController.js';
import './style.css';

const BODY_ORDER = ['jupiter', 'io', 'europa', 'ganymede', 'callisto'];
const MOON_IDS = ['IO', 'EUROPA', 'GANYMEDE', 'CALLISTO'];

let currentLang = DEFAULT_LANGUAGE;
const bodyLabelNodes = {};
const missionOptgroups = {};
const disabledMissionOptions = [];

function loadStoredLanguage() {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveStoredLanguage(lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage access errors in restricted environments.
  }
}

const state = {
  daysSinceEpoch: 0,
  rate: 1,
  paused: false,
  fps: 0,
  fpsFrames: 0,
  fpsAccumulator: 0,
  hudAccumulator: 0
};
let orbitsVisible = true;
let ringsVisible = true;

let scene;
let camera;
let renderer;
let composer;
let labelRenderer;
let controls;
let cameraController;
let jupiterSim;
let ringsSim;
let missionSim;
let starfieldSim;
let moonSimulators = [];
let opticsPass;
let sunLight;
let simulationDate = new Date();
let selectedBodyId = 'jupiter';
let simulationStarted = false;
let followProbe = false;
let assetFetcher = null;

let missionSelectorEl;
let missionDescriptionEl;
let followProbeBtn;
let instrumentViewBtn;
let instrumentLensBtn;
let followStateEl;
let instrumentViewStateEl;
let instrumentLensStateEl;
let instrumentHudEl;
let instrumentMissionNameEl;
let instrumentNameEl;
let instrumentLensReadoutEl;
let instrumentDistanceEl;
let instrumentVelocityEl;
let missionTimelineUI = null;
let touchNavigation = null;
let mobileDrawerOpen = false;

const targetButtons = {};
const mobileBodyChips = {};
const doubleTapTargetPos = new THREE.Vector3();
const timer = new THREE.Timer();
timer.connect(document);

function bodySimulatorFor(id) {
  if (id === 'jupiter') return jupiterSim;
  const index = MOON_IDS.indexOf(id.toUpperCase());
  return index >= 0 ? moonSimulators[index] : null;
}

function sceneRadiusFor(id, simulator) {
  if (simulator?.sceneRadius) return simulator.sceneRadius;
  if (id === 'jupiter') return jupiterSim.radiusEq;
  return simulator?.sceneRadius ?? 1;
}

function createLabel(id, simulator, height) {
  const meta = getBodyMeta(id, currentLang);
  const element = document.createElement('div');
  element.className = 'body-label';

  const name = document.createElement('span');
  name.textContent = meta?.labelName ?? id.toUpperCase();

  const sub = document.createElement('span');
  sub.className = 'label-sub';
  sub.textContent = meta?.labelSub ?? '';

  element.appendChild(name);
  element.appendChild(sub);

  bodyLabelNodes[id] = { nameEl: name, subEl: sub };

  const label = new CSS2DObject(element);
  label.position.set(0, height, 0);
  simulator.mesh.add(label);
  return label;
}

function createLabels() {
  createLabel('jupiter', jupiterSim, 1.16);
  createLabel('io', moonSimulators[0], 1.55);
  createLabel('europa', moonSimulators[1], 1.55);
  createLabel('ganymede', moonSimulators[2], 1.55);
  createLabel('callisto', moonSimulators[3], 1.55);
}

function refreshBodyLabels() {
  for (let i = 0; i < BODY_ORDER.length; i += 1) {
    const id = BODY_ORDER[i];
    const nodes = bodyLabelNodes[id];
    const meta = getBodyMeta(id, currentLang);
    if (!nodes || !meta) continue;
    nodes.nameEl.textContent = meta.labelName;
    nodes.subEl.textContent = meta.labelSub;
  }
}

function refreshTargetListUI() {
  for (let i = 0; i < BODY_ORDER.length; i += 1) {
    const id = BODY_ORDER[i];
    const button = targetButtons[id];
    const meta = getBodyMeta(id, currentLang);
    if (button && meta) {
      const nameEl = button.querySelector('.target-name');
      const metaEl = button.querySelector('.target-meta');
      if (nameEl) nameEl.textContent = meta.name;
      if (metaEl) metaEl.textContent = meta.shortMeta;
    }
    const mobileChip = mobileBodyChips[id];
    if (mobileChip && meta) {
      mobileChip.textContent = meta.name;
    }
  }
}

function refreshSelectionUI() {
  const meta = getBodyMeta(selectedBodyId, currentLang);
  if (!meta) return;
  const simulator = bodySimulatorFor(selectedBodyId);

  for (let i = 0; i < BODY_ORDER.length; i += 1) {
    const id = BODY_ORDER[i];
    const active = id === selectedBodyId;
    targetButtons[id]?.classList.toggle('is-active', active);
    const chip = mobileBodyChips[id];
    if (chip) {
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    }
  }

  document.getElementById('telemetry-target').textContent = meta.name;
  document.getElementById('telemetry-type').textContent = meta.type;
  document.getElementById('telemetry-radius').textContent = meta.radius;
  document.getElementById('telemetry-orbit').textContent = meta.orbit;
  document.getElementById('telemetry-period').textContent = meta.period;
  document.getElementById('telemetry-eccentricity').textContent = meta.eccentricity;
  document.getElementById('telemetry-tilt').textContent = meta.tilt;

  const focusLabel = document.getElementById('btn-focus-label');
  const surfaceLabel = document.getElementById('btn-surface-label');
  const surfaceButton = document.getElementById('btn-surface');

  focusLabel.textContent = t(currentLang, 'closeOrbit');
  if (cameraController?.isSurfaceLocked) {
    surfaceLabel.textContent = t(currentLang, 'exitSurface');
  } else {
    surfaceLabel.textContent =
      selectedBodyId === 'jupiter'
        ? t(currentLang, 'cloudTopView')
        : t(currentLang, 'surfaceView');
  }
  if (surfaceButton) surfaceButton.disabled = !simulator;

  updateViewState();
}

function updateViewState() {
  const viewState = document.getElementById('view-state');
  if (!viewState) return;

  const meta = getBodyMeta(selectedBodyId, currentLang);
  const bodyName = (meta?.name ?? selectedBodyId).toUpperCase();
  const surfaceLabel = document.getElementById('btn-surface-label');
  const lockedBar = document.getElementById('locked-view-bar');
  const lockedHint = document.getElementById('locked-view-hint');
  const lockedBtnLabel = document.getElementById('btn-exit-locked-label');

  if (cameraController?.isInstrumentLocked && missionSim?.activeMission) {
    viewState.textContent =
      `${t(currentLang, 'viewInstrument')} · ${missionSim.activeMission.name.toUpperCase()}`;
    if (lockedBar) lockedBar.hidden = false;
    if (lockedHint) lockedHint.textContent = t(currentLang, 'instrumentTouchHint');
    if (lockedBtnLabel) lockedBtnLabel.textContent = t(currentLang, 'exitInstrument');
  } else if (cameraController?.isSurfaceLocked) {
    viewState.textContent = `${t(currentLang, 'viewSurface')} · ${bodyName}`;
    if (surfaceLabel) surfaceLabel.textContent = t(currentLang, 'exitSurface');
    if (lockedBar) lockedBar.hidden = false;
    if (lockedHint) lockedHint.textContent = t(currentLang, 'surfaceTouchHint');
    if (lockedBtnLabel) lockedBtnLabel.textContent = t(currentLang, 'exitSurface');
  } else {
    viewState.textContent = `${t(currentLang, 'viewOrbital')} · ${bodyName}`;
    if (surfaceLabel) {
      surfaceLabel.textContent =
        selectedBodyId !== 'jupiter'
          ? t(currentLang, 'surfaceView')
          : t(currentLang, 'cloudTopView');
    }
    if (lockedBar) lockedBar.hidden = true;
  }
}

function applyOrbitVisibility() {
  const visible =
    orbitsVisible &&
    !cameraController?.isSurfaceLocked &&
    !cameraController?.isInstrumentLocked;
  for (let i = 0; i < moonSimulators.length; i += 1) {
    moonSimulators[i].setOrbitVisible(visible);
  }
}

function refreshViewToggles() {
  const onLabel = t(currentLang, 'stateOn');
  const offLabel = t(currentLang, 'stateOff');

  const orbitsState = document.querySelector('[data-state-for="orbits"]');
  if (orbitsState) orbitsState.textContent = orbitsVisible ? onLabel : offLabel;

  const labelsVisible = document.body.classList.contains('show-labels');
  const labelsState = document.querySelector('[data-state-for="labels"]');
  if (labelsState) labelsState.textContent = labelsVisible ? onLabel : offLabel;

  const ringsState = document.querySelector('[data-state-for="rings"]');
  if (ringsState) ringsState.textContent = ringsVisible ? onLabel : offLabel;
}

function refreshMissionUi() {
  if (!missionSelectorEl) return;

  const active = Boolean(missionSim?.activeMission);
  if (!active) followProbe = false;

  followProbeBtn.disabled = !active;
  instrumentViewBtn.disabled = !active;
  instrumentLensBtn.disabled =
    !active || !cameraController?.isInstrumentLocked;

  followProbeBtn.setAttribute(
    'aria-pressed',
    String(active && followProbe)
  );
  instrumentViewBtn.setAttribute(
    'aria-pressed',
    String(Boolean(cameraController?.isInstrumentLocked))
  );

  const onLabel = t(currentLang, 'stateOn');
  const offLabel = t(currentLang, 'stateOff');
  followStateEl.textContent = active && followProbe ? onLabel : offLabel;
  instrumentViewStateEl.textContent = cameraController?.isInstrumentLocked
    ? onLabel
    : offLabel;
  instrumentLensStateEl.textContent = cameraController?.isInstrumentLocked
    ? `${cameraController.activeLensMode} ${Math.round(camera.fov)}°`
    : '—';

  if (active && missionDescriptionEl) {
    missionDescriptionEl.textContent = getMissionDescription(
      missionSim.activeMission.key,
      currentLang,
      missionSim.activeMission.description
    );
  }

  if (!cameraController?.isInstrumentLocked) {
    instrumentHudEl.hidden = true;
  }
  updateViewState();
}

function refreshInstrumentReadout() {
  if (!instrumentHudEl) return;
  const active = Boolean(missionSim?.activeMission);
  if (!active || !cameraController?.isInstrumentLocked) {
    instrumentHudEl.hidden = true;
    return;
  }

  const config = missionSim.getActiveOpticalConfig(missionSim.currentU);
  const target = missionSim.getOpticalTargetPosition(missionSim.currentU);
  const distanceKm = target
    ? camera.position.distanceTo(target) * JOVIAN_KM_PER_UNIT
    : 0;
  const velocityKmS = missionSim.getRelativeVelocityKmS(missionSim.currentU);

  instrumentMissionNameEl.textContent = missionSim.activeMission.name;
  instrumentNameEl.textContent = config?.instrumentName ?? '—';
  instrumentLensReadoutEl.textContent =
    `${cameraController.activeLensMode} ${Math.round(camera.fov)}°`;
  instrumentDistanceEl.textContent = `${Math.round(distanceKm).toLocaleString()} km`;
  instrumentVelocityEl.textContent = `${velocityKmS.toFixed(2)} km/s`;
  instrumentHudEl.hidden = false;
}

function leaveInstrumentView(focusProbeAfter = false) {
  if (!cameraController?.isInstrumentLocked) return;

  cameraController.exitInstrumentView();
  missionSim?.setInstrumentMode(false);
  if (labelRenderer) labelRenderer.domElement.style.visibility = '';
  if (instrumentHudEl) instrumentHudEl.hidden = true;
  followProbe = false;

  if (focusProbeAfter && missionSim?.activeMission) {
    cameraController.focusOnObject(
      missionSim.probeGroup,
      missionSim.getFollowDistance(),
      0.25
    );
    followProbe = true;
  }

  refreshMissionUi();
  applyOrbitVisibility();
}

function populateMissionSelector() {
  missionSelectorEl = document.getElementById('mission-selector');
  missionDescriptionEl = document.getElementById('mission-description');
  followProbeBtn = document.getElementById('btn-follow-probe');
  instrumentViewBtn = document.getElementById('btn-instrument-view');
  instrumentLensBtn = document.getElementById('btn-instrument-lens');
  followStateEl = document.getElementById('follow-state');
  instrumentViewStateEl = document.getElementById('instrument-view-state');
  instrumentLensStateEl = document.getElementById('instrument-lens-state');
  instrumentHudEl = document.getElementById('instrument-hud');
  instrumentMissionNameEl = document.getElementById('instrument-mission-name');
  instrumentNameEl = document.getElementById('instrument-name');
  instrumentLensReadoutEl = document.getElementById('instrument-lens-readout');
  instrumentDistanceEl = document.getElementById('instrument-distance');
  instrumentVelocityEl = document.getElementById('instrument-velocity');

  const planets = ['SATURN', 'JUPITER'];
  for (let p = 0; p < planets.length; p += 1) {
    const planet = planets[p];
    const keys = MISSION_ORDER[planet] ?? [];
    const group = document.createElement('optgroup');
    group.label = getMissionPlanetLabel(planet, currentLang);

    let count = 0;
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const mission = MISSIONS[planet]?.[key];
      if (!mission) continue;

      const option = document.createElement('option');
      option.value = `${planet}:${key}`;
      option.textContent = `${mission.name} · ${mission.timestamp.slice(0, 4)}`;
      if (planet !== 'JUPITER' || mission.available === false) {
        option.disabled = true;
        option.title = t(currentLang, 'saturnUnavailable');
        disabledMissionOptions.push(option);
      }
      group.appendChild(option);
      count += 1;
    }

    if (count > 0) {
      missionOptgroups[planet] = group;
      missionSelectorEl.appendChild(group);
    }
  }

  missionSelectorEl.addEventListener('change', () => {
    const value = missionSelectorEl.value;
    if (!value) {
      clearActiveMission();
      return;
    }

    const separator = value.indexOf(':');
    const planet = value.slice(0, separator);
    const key = value.slice(separator + 1);
    const mission = MISSIONS[planet]?.[key];
    if (!mission || mission.available === false || planet !== 'JUPITER') {
      missionSelectorEl.value = '';
      return;
    }

    selectMission(planet, key);
  });

  followProbeBtn.addEventListener('click', toggleFollowProbe);
  instrumentViewBtn.addEventListener('click', toggleInstrumentView);
  instrumentLensBtn.addEventListener('click', toggleInstrumentLens);

  missionTimelineUI = new MissionTimelineUI(
    document.getElementById('mission-timeline'),
    {
      onScrub: (u) => seekMissionToU(u),
      onSelectMilestone: (milestone) => seekMissionToU(milestone.t, milestone)
    }
  );
}

function syncSimulationEpoch(days) {
  state.daysSinceEpoch = days;
  setDateFromDays(state.daysSinceEpoch, simulationDate);

  jupiterSim.update(state.daysSinceEpoch);
  for (let i = 0; i < moonSimulators.length; i += 1) {
    moonSimulators[i].update(state.daysSinceEpoch);
  }
  jupiterSim.updateMoonUniforms(moonSimulators);
  ringsSim.update(state.daysSinceEpoch);
  missionSim.update(state.daysSinceEpoch, camera, 0);
}

function seekMissionToU(u, milestone = null) {
  const activeMission = missionSim?.activeMission;
  if (!activeMission) return;

  const targetDays = missionUToDaysSinceEpoch(activeMission, u);
  syncSimulationEpoch(targetDays);

  if (cameraController?.isInstrumentLocked) {
    const opticalConfig =
      milestone ?? missionSim.getActiveOpticalConfig(missionSim.currentU);
    if (opticalConfig?.defaultFov) {
      cameraController.setInstrumentFov(opticalConfig.defaultFov);
    }
    const opticalTarget = missionSim.getOpticalTargetPosition(
      missionSim.currentU
    );
    if (opticalTarget) cameraController.setInstrumentTarget(opticalTarget);
  }

  refreshClock();
  refreshMissionUi();
  refreshInstrumentReadout();
  missionTimelineUI?.sync(state.daysSinceEpoch);
}

function ensureMissionProbeModel(mission, key) {
  if (!assetFetcher || !mission) return;

  let modelKey = null;
  if (mission.model === 'pioneer_glb') modelKey = 'pioneer11';
  else if (mission.model === 'voyager') modelKey = key;

  if (!modelKey) return;

  assetFetcher.loadProbeModel(modelKey).then((source) => {
    if (source) missionSim.applyProbeModel(modelKey, source);
  });
}

function selectMission(planet, key) {
  const mission = MISSIONS[planet]?.[key];
  if (!mission || mission.available === false) return;

  leaveInstrumentView(false);
  cameraController.exitSurfaceView();

  const eventMs = Date.parse(mission.timestamp);
  state.daysSinceEpoch = (eventMs - J2000_EPOCH_MS) / MS_PER_DAY;
  setDateFromDays(state.daysSinceEpoch, simulationDate);

  jupiterSim.update(state.daysSinceEpoch);
  for (let i = 0; i < moonSimulators.length; i += 1) {
    moonSimulators[i].update(state.daysSinceEpoch);
  }
  jupiterSim.updateMoonUniforms(moonSimulators);
  ringsSim.update(state.daysSinceEpoch);

  missionSim.setInstrumentMode(false);
  missionSim.loadMission(planet, key, state.daysSinceEpoch);
  ensureMissionProbeModel(mission, key);
  missionSim.update(state.daysSinceEpoch, camera);
  cameraController.setOpticsMode(mission.opticsMode);

  selectBody('jupiter', false);
  const overviewDirection = new THREE.Vector3()
    .copy(camera.position)
    .sub(jupiterSim.center);
  if (
    overviewDirection.lengthSq() <
    (jupiterSim.radiusEq * 2.5) * (jupiterSim.radiusEq * 2.5)
  ) {
    overviewDirection.set(0.55, 0.35, 1);
  }
  overviewDirection.normalize();
  overviewDirection.y += 0.22;
  overviewDirection.normalize();
  cameraController.setInstantFocus(
    jupiterSim.mesh,
    overviewDirection,
    jupiterSim.radiusEq * 9.0
  );

  missionSelectorEl.value = `${planet}:${key}`;
  missionDescriptionEl.textContent = getMissionDescription(
    key,
    currentLang,
    mission.description
  );
  missionDescriptionEl.hidden = false;
  followProbe = false;
  if (labelRenderer) labelRenderer.domElement.style.visibility = '';
  if (instrumentHudEl) instrumentHudEl.hidden = true;

  refreshClock();
  refreshMissionUi();
  document.body.classList.add('mission-active');
  missionTimelineUI?.setMission(mission, state.daysSinceEpoch);
}

function clearActiveMission() {
  leaveInstrumentView(false);
  missionSim?.clearMission();
  followProbe = false;
  if (missionDescriptionEl) {
    missionDescriptionEl.hidden = true;
    missionDescriptionEl.textContent = '';
  }
  if (missionSelectorEl) missionSelectorEl.value = '';
  if (instrumentHudEl) instrumentHudEl.hidden = true;
  cameraController?.setOpticsMode(0);
  document.body.classList.remove('mission-active');
  missionTimelineUI?.setMission(null);
  refreshMissionUi();
}

function toggleFollowProbe() {
  if (!missionSim?.activeMission) return;

  if (cameraController.isInstrumentLocked) {
    leaveInstrumentView(false);
  }

  followProbe = !followProbe;
  if (followProbe) {
    cameraController.focusOnObject(
      missionSim.probeGroup,
      missionSim.getFollowDistance(),
      0.25
    );
  } else {
    cameraController.focusOnObject(
      jupiterSim.mesh,
      jupiterSim.radiusEq * 9.0,
      0.22
    );
  }
  refreshMissionUi();
}

function toggleInstrumentView() {
  if (!missionSim?.activeMission) return;

  if (cameraController.isInstrumentLocked) {
    leaveInstrumentView(true);
    return;
  }

  followProbe = false;
  cameraController.exitSurfaceView();
  const config = missionSim.getActiveOpticalConfig(missionSim.currentU);
  const fov = config?.defaultFov ?? 32;

  cameraController.setOpticsMode(missionSim.activeMission.opticsMode);
  cameraController.engageInstrumentView(missionSim.instrumentMount, fov);
  missionSim.setInstrumentMode(true);

  if (labelRenderer) labelRenderer.domElement.style.visibility = 'hidden';
  refreshMissionUi();
  refreshInstrumentReadout();
  applyOrbitVisibility();
}

function toggleInstrumentLens() {
  if (!cameraController.isInstrumentLocked) return;
  cameraController.toggleInstrumentLens();
  refreshMissionUi();
  refreshInstrumentReadout();
}

function setRingsVisible(visible) {
  ringsVisible = Boolean(visible);
  ringsSim?.setVisible(ringsVisible);

  const button = document.getElementById('btn-toggle-rings');
  if (!button) return;

  button.setAttribute('aria-pressed', String(ringsVisible));
  const stateLabel = document.querySelector('[data-state-for="rings"]');
  if (stateLabel) {
    stateLabel.textContent = t(currentLang, ringsVisible ? 'stateOn' : 'stateOff');
  }
}

function viewRingsBacklight() {
  if (!ringsSim) return;
  leaveInstrumentView(false);
  missionSim?.setInstrumentMode(false);
  if (labelRenderer) labelRenderer.domElement.style.visibility = '';
  setRingsVisible(true);
  selectBody('jupiter', false);

  cameraController.exitSurfaceView();
  if (cameraController.tween) {
    cameraController.tween.kill();
    cameraController.tween = null;
  }
  cameraController.currentTarget = null;
  controls.enabled = true;

  const antiSun = jupiterSim.sunDirection.clone().multiplyScalar(-1);
  const side = new THREE.Vector3()
    .crossVectors(jupiterSim.poleWorld, antiSun)
    .normalize();
  const phaseOffset = THREE.MathUtils.degToRad(10);
  const direction = antiSun
    .clone()
    .multiplyScalar(Math.cos(phaseOffset))
    .addScaledVector(side, Math.sin(phaseOffset))
    .addScaledVector(jupiterSim.poleWorld, 0.22)
    .normalize();

  const distance = jupiterSim.radiusEq * 6.8;
  controls.target.set(0, 0, 0);
  camera.up.set(0, 1, 0);
  camera.position.copy(direction).multiplyScalar(distance);
  camera.lookAt(controls.target);
  controls.update();

  updateViewState();
}

function selectBody(id, shouldFocus = true) {
  if (!getBodyMeta(id, currentLang)) return;
  selectedBodyId = id;
  refreshSelectionUI();

  if (shouldFocus) {
    focusSelectedBody(false);
  }
}

function focusSelectedBody(surface) {
  const simulator = bodySimulatorFor(selectedBodyId);
  if (!simulator) return;
  leaveInstrumentView(false);

  if (surface) {
    simulator.orientSurfaceView?.();
    cameraController.landOnSurface(simulator);
  } else {
    const radius = sceneRadiusFor(selectedBodyId, simulator);
    const multiplier = selectedBodyId === 'jupiter' ? 4.0 : 6.2;
    cameraController.focusOnObject(
      simulator.focusTarget,
      radius * multiplier,
      0.22
    );
  }

  updateViewState();
}

function setRate(rate) {
  state.rate = rate;
  state.paused = false;
  refreshTimeControls();
}

function togglePause() {
  state.paused = !state.paused;
  refreshTimeControls();
}

function refreshTimeControls() {
  const pauseButton = document.getElementById('btn-pause');
  const mobilePauseBtn = document.getElementById('btn-mobile-pause');
  const status = document.getElementById('hud-status');
  const rate = document.getElementById('speed-readout');
  const clockRate = document.getElementById('clock-rate');
  const speedButtons = document.querySelectorAll('.speed-btn');

  const pauseLabel = state.paused
    ? t(currentLang, 'resume')
    : t(currentLang, 'pause');

  pauseButton.classList.toggle('is-active', state.paused);
  pauseButton.setAttribute('aria-pressed', String(state.paused));
  pauseButton.querySelector('span').textContent = pauseLabel;

  if (mobilePauseBtn) {
    mobilePauseBtn.classList.toggle('is-active', state.paused);
    mobilePauseBtn.setAttribute('aria-pressed', String(state.paused));
    mobilePauseBtn.setAttribute('aria-label', pauseLabel);
  }

  status.textContent = state.paused
    ? t(currentLang, 'statusPaused')
    : t(currentLang, 'statusLive');
  status.classList.toggle('is-paused', state.paused);

  const rateLabel = formatLocalizedRate(state.rate, state.paused, currentLang);
  rate.textContent = rateLabel;
  clockRate.textContent = rateLabel;

  for (let i = 0; i < speedButtons.length; i += 1) {
    const button = speedButtons[i];
    const value = Number(button.dataset.rate);
    const active = value === state.rate;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function setMobileDrawerOpen(open) {
  mobileDrawerOpen = Boolean(open);
  document.body.classList.toggle('mobile-drawer-open', mobileDrawerOpen);

  const drawerBtn = document.getElementById('btn-mobile-drawer');
  const drawerLabel = document.getElementById('btn-mobile-drawer-label');
  if (drawerBtn) {
    drawerBtn.setAttribute('aria-expanded', String(mobileDrawerOpen));
  }
  if (drawerLabel) {
    drawerLabel.textContent = t(
      currentLang,
      mobileDrawerOpen ? 'mobileControlsClose' : 'mobileControlsOpen'
    );
  }
}

function applyResponsiveControlProfile() {
  if (!controls) return;
  const isCoarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const profile = getTouchControlProfile(isCoarse, window.innerWidth);
  controls.rotateSpeed = profile.rotateSpeed;
  controls.zoomSpeed = profile.zoomSpeed;
  controls.panSpeed = profile.panSpeed;
  controls.dampingFactor = profile.dampingFactor;
}

function handleDoubleTapOrbital() {
  const simulator = bodySimulatorFor(selectedBodyId);
  if (!simulator?.focusTarget || !cameraController) return;

  simulator.focusTarget.getWorldPosition(doubleTapTargetPos);
  const currentDist = camera.position.distanceTo(doubleTapTargetPos);
  const radius = sceneRadiusFor(selectedBodyId, simulator);
  const closeDist = radius * (selectedBodyId === 'jupiter' ? 4.0 : 6.2);
  const overviewDist = radius * (selectedBodyId === 'jupiter' ? 8.8 : 13.0);

  const targetDist = currentDist <= closeDist * 1.35 ? overviewDist : closeDist;
  cameraController.focusOnObject(simulator.focusTarget, targetDist, 0.22);
  updateViewState();
}

function handleDoubleTapSurface() {
  if (!cameraController?.isSurfaceLocked) return;
  const lookOffset = Math.hypot(
    cameraController.surfaceLookYaw ?? 0,
    cameraController.surfaceLookPitch ?? 0
  );
  if (lookOffset > 0.08) {
    cameraController.resetSurfaceLook();
    return;
  }
  focusSelectedBody(false);
}

function bindSwipeSheetGesture(element, isOpenGetter) {
  if (!element) return;
  let startY = 0;
  let startTime = 0;
  let pointerId = null;

  element.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    pointerId = event.pointerId;
    startY = event.clientY;
    startTime = event.timeStamp || performance.now();
  });

  element.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    const dy = event.clientY - startY;
    const dt = Math.max(1, (event.timeStamp || performance.now()) - startTime);
    const velocityY = dy / dt;
    const action = resolveSwipeSheetAction(dy, velocityY, isOpenGetter());
    if (action === 'open') setMobileDrawerOpen(true);
    else if (action === 'close') setMobileDrawerOpen(false);
  });

  element.addEventListener('pointercancel', () => {
    pointerId = null;
  });
}

function jumpToDate(value) {
  if (!value) return;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return;

  syncSimulationEpoch((timestamp - J2000_EPOCH_MS) / MS_PER_DAY);
  refreshClock();
  refreshMissionUi();
  refreshInstrumentReadout();
  missionTimelineUI?.sync(state.daysSinceEpoch);
}

function jumpToNow() {
  syncSimulationEpoch(dateToDaysSinceEpoch(new Date()));
  state.paused = false;
  refreshTimeControls();
  refreshClock();
  missionTimelineUI?.sync(state.daysSinceEpoch);
}

function refreshClock() {
  const iso = simulationDate.toISOString();
  const dateString = iso.slice(0, 10);
  const timeString = `${iso.slice(11, 19)} UTC`;

  document.getElementById('hud-date').textContent = dateString;
  document.getElementById('hud-time').textContent = timeString;

  const dateInput = document.getElementById('time-date');
  if (document.activeElement !== dateInput && dateInput.value !== dateString) {
    dateInput.value = dateString;
  }

  if (jupiterSim) {
    const sunDistance = jupiterSim.sunDistanceKm / 1e6;
    document.getElementById('telemetry-sun-distance').textContent =
      `${sunDistance.toFixed(2)} ${t(currentLang, 'millionKm')}`;
  }
  document.getElementById('fps').textContent = `${Math.round(state.fps)} FPS`;
  updateViewState();
  applyOrbitVisibility();
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLang;
  document.title = t(currentLang, 'docTitle');

  const canvas = document.getElementById('webgl-canvas');
  if (canvas) canvas.setAttribute('aria-label', t(currentLang, 'canvasAria'));

  const langSwitcher = document.getElementById('lang-switcher');
  if (langSwitcher) {
    langSwitcher.setAttribute('aria-label', t(currentLang, 'langGroupAria'));
  }

  const speedGroup = document.querySelector('.speed-group');
  if (speedGroup) {
    speedGroup.setAttribute('aria-label', t(currentLang, 'timeRateTitle'));
  }

  const dateInput = document.getElementById('time-date');
  if (dateInput) dateInput.setAttribute('aria-label', t(currentLang, 'dateInputAria'));

  const hudButton = document.getElementById('btn-toggle-hud');
  if (hudButton) {
    const hidden = document.body.classList.contains('hud-hidden');
    hudButton.setAttribute(
      'aria-label',
      t(currentLang, hidden ? 'showInterface' : 'hideInterface')
    );
  }

  const sheetHandle = document.getElementById('mobile-sheet-handle');
  if (sheetHandle) {
    sheetHandle.setAttribute('aria-label', t(currentLang, 'mobileSheetHandleAria'));
  }

  const mobileDock = document.getElementById('mobile-dock');
  if (mobileDock) {
    mobileDock.setAttribute('aria-label', t(currentLang, 'mobileDockAria'));
  }

  const mobileBodyStrip = document.getElementById('mobile-body-strip');
  if (mobileBodyStrip) {
    mobileBodyStrip.setAttribute('aria-label', t(currentLang, 'mobileBodiesAria'));
  }

  const translatedNodes = document.querySelectorAll('[data-i18n]');
  for (let i = 0; i < translatedNodes.length; i += 1) {
    const el = translatedNodes[i];
    el.textContent = t(currentLang, el.dataset.i18n);
  }

  const drawerLabel = document.getElementById('btn-mobile-drawer-label');
  if (drawerLabel) {
    drawerLabel.textContent = t(
      currentLang,
      mobileDrawerOpen ? 'mobileControlsClose' : 'mobileControlsOpen'
    );
  }

  const langButtons = document.querySelectorAll('.lang-btn[data-lang]');
  for (let i = 0; i < langButtons.length; i += 1) {
    const button = langButtons[i];
    const active = button.dataset.lang === currentLang;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }

  const planets = Object.keys(missionOptgroups);
  for (let i = 0; i < planets.length; i += 1) {
    const planet = planets[i];
    missionOptgroups[planet].label = getMissionPlanetLabel(planet, currentLang);
  }

  const saturnTitle = t(currentLang, 'saturnUnavailable');
  for (let i = 0; i < disabledMissionOptions.length; i += 1) {
    disabledMissionOptions[i].title = saturnTitle;
  }
}

function applyLanguage(lang, persist = false) {
  currentLang = normalizeLanguage(lang);
  if (persist) saveStoredLanguage(currentLang);

  applyStaticTranslations();
  refreshTargetListUI();
  refreshBodyLabels();
  refreshViewToggles();
  refreshSelectionUI();
  refreshTimeControls();
  refreshMissionUi();
  refreshInstrumentReadout();
  if (jupiterSim) refreshClock();
  missionSim?.setLanguage(currentLang);
  missionTimelineUI?.setLanguage(currentLang);
}

function updateFps(delta) {
  state.fpsFrames += 1;
  state.fpsAccumulator += delta;
  if (state.fpsAccumulator >= 0.5) {
    state.fps = state.fpsFrames / state.fpsAccumulator;
    state.fpsFrames = 0;
    state.fpsAccumulator = 0;
  }
}

function updateHud(delta) {
  state.hudAccumulator += delta;
  if (state.hudAccumulator < 0.2) return;
  state.hudAccumulator = 0;

  setDateFromDays(state.daysSinceEpoch, simulationDate);
  refreshClock();
  refreshMissionUi();
  refreshInstrumentReadout();
  missionTimelineUI?.sync(state.daysSinceEpoch);
}

function tick() {
  requestAnimationFrame(tick);

  timer.update();
  const delta = timer.getDelta();
  const frameDelta = Math.min(delta, 0.05);

  if (!state.paused) {
    state.daysSinceEpoch += advanceSimulationDays(delta, state.rate);
  }

  jupiterSim.update(state.daysSinceEpoch);
  ringsSim.update(state.daysSinceEpoch);
  for (let i = 0; i < moonSimulators.length; i += 1) {
    moonSimulators[i].update(state.daysSinceEpoch);
  }
  jupiterSim.updateMoonUniforms(moonSimulators);
  missionSim.update(state.daysSinceEpoch, camera, frameDelta);

  if (cameraController.isInstrumentLocked) {
    const opticalTarget = missionSim.getOpticalTargetPosition(
      missionSim.currentU
    );
    if (opticalTarget) cameraController.setInstrumentTarget(opticalTarget);
  }

  cameraController.update();
  sunLight.position.copy(jupiterSim.sunDirection).multiplyScalar(2000);
  if (opticsPass) opticsPass.uniforms.uTime.value = timer.getElapsed();

  composer.render();
  labelRenderer.render(scene, camera);

  updateFps(delta);
  updateHud(frameDelta);

  if (!simulationStarted) {
    simulationStarted = true;
    if (
      typeof performance !== 'undefined' &&
      typeof performance.mark === 'function'
    ) {
      performance.mark('jovian:first-frame');
    }
    window.requestAnimationFrame(() => {
      document.getElementById('loader').classList.add('is-hidden');
    });
  }
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  composer.setSize(width, height);
  labelRenderer.setSize(width, height);
  starfieldSim?.setPixelRatio(pixelRatio);
  opticsPass?.uniforms.uResolution.value.set(width, height);
  applyResponsiveControlProfile();
  if (width > 900 && mobileDrawerOpen) {
    setMobileDrawerOpen(false);
  }
}

function setLoaderProgress(fraction) {
  const percent = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  const progress = document.getElementById('loader-progress');
  const label = document.getElementById('loader-percent');
  if (progress) progress.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}%`;
}

async function bootstrapApp() {
  currentLang = detectInitialLanguage({
    stored: loadStoredLanguage(),
    navigatorLanguage: typeof navigator !== 'undefined' ? navigator.language : null
  });
  applyStaticTranslations();

  const canvas = document.getElementById('webgl-canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.02,
    60000
  );
  camera.position.set(0, 640, 1480);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.2;
  controls.maxDistance = 12000;
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
  };
  applyResponsiveControlProfile();
  controls.update();

  cameraController = new CameraController(camera, controls);

  touchNavigation = new TouchNavigationController(canvas, cameraController, {
    onFirstTouch: () => {
      document.getElementById('mobile-gesture-cue')?.classList.add('is-dismissed');
    },
    onDoubleTapOrbital: handleDoubleTapOrbital,
    onDoubleTapSurface: handleDoubleTapSurface,
    onDoubleTapInstrument: toggleInstrumentLens,
    onInstrumentZoom: () => {
      refreshMissionUi();
      refreshInstrumentReadout();
    }
  });

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.48,
    0.42,
    1.12
  );
  composer.addPass(bloom);
  opticsPass = new ShaderPass(VintageOpticsShader);
  opticsPass.uniforms.uResolution.value.set(
    window.innerWidth,
    window.innerHeight
  );
  composer.addPass(opticsPass);
  composer.addPass(new OutputPass());
  cameraController.setOpticsPass(opticsPass);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  document.getElementById('labels-layer').appendChild(labelRenderer.domElement);

  assetFetcher = new AssetFetcher({
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    onProgress: setLoaderProgress
  });
  const assets = await assetFetcher.loadAll();

  state.daysSinceEpoch = dateToDaysSinceEpoch(new Date());
  simulationDate = setDateFromDays(state.daysSinceEpoch);

  jupiterSim = new JupiterSimulator(scene, assets);
  jupiterSim.sceneRadius = jupiterSim.radiusEq;
  moonSimulators = [
    new GalileanMoonSimulator(jupiterSim, 'IO', assets),
    new GalileanMoonSimulator(jupiterSim, 'EUROPA', assets),
    new GalileanMoonSimulator(jupiterSim, 'GANYMEDE', assets),
    new GalileanMoonSimulator(jupiterSim, 'CALLISTO', assets)
  ];
  ringsSim = new JovianRingsSimulator(jupiterSim);
  starfieldSim = new StarfieldSimulator(scene);

  sunLight = new THREE.DirectionalLight(0xfff1da, 2.2);
  sunLight.position.copy(jupiterSim.sunDirection).multiplyScalar(2000);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x7f90ad, 0.35));

  const missionSystems = {
    JUPITER: {
      planetKey: 'JUPITER',
      planetMesh: jupiterSim.mesh,
      anchor: jupiterSim.equatorGroup,
      radiusEq: jupiterSim.radiusEq,
      scaleFactor: JOVIAN_KM_PER_UNIT,
      moons: {
        IO: moonSimulators[0],
        EUROPA: moonSimulators[1],
        GANYMEDE: moonSimulators[2],
        CALLISTO: moonSimulators[3]
      },
      ringsSim
    }
  };
  missionSim = new MissionSimulator(
    scene,
    missionSystems,
    camera,
    cameraController,
    assets
  );

  createLabels();
  jupiterSim.update(state.daysSinceEpoch);
  ringsSim.update(state.daysSinceEpoch);
  for (let i = 0; i < moonSimulators.length; i += 1) {
    moonSimulators[i].update(state.daysSinceEpoch);
  }
  jupiterSim.updateMoonUniforms(moonSimulators);
  cameraController.update();

  for (let i = 0; i < BODY_ORDER.length; i += 1) {
    const id = BODY_ORDER[i];
    const button = document.querySelector(`[data-body="${id}"]`);
    if (button) {
      targetButtons[id] = button;
      button.addEventListener('click', () => {
        selectBody(id, true);
        if (window.innerWidth <= 900) setMobileDrawerOpen(false);
      });
    }
    const mobileChip = document.querySelector(`[data-mobile-body="${id}"]`);
    if (mobileChip) {
      mobileBodyChips[id] = mobileChip;
      mobileChip.addEventListener('click', () => {
        selectBody(id, true);
        document.getElementById('mobile-gesture-cue')?.classList.add('is-dismissed');
      });
    }
  }

  populateMissionSelector();

  document.getElementById('btn-focus').addEventListener('click', () => {
    focusSelectedBody(false);
    if (window.innerWidth <= 900) setMobileDrawerOpen(false);
  });

  document.getElementById('btn-surface').addEventListener('click', () => {
    if (cameraController.isSurfaceLocked) {
      focusSelectedBody(false);
    } else {
      focusSelectedBody(true);
    }
    if (window.innerWidth <= 900) setMobileDrawerOpen(false);
  });

  document.getElementById('btn-exit-locked-view')?.addEventListener('click', () => {
    if (cameraController.isInstrumentLocked) {
      leaveInstrumentView(true);
    } else if (cameraController.isSurfaceLocked) {
      focusSelectedBody(false);
    }
  });

  document.getElementById('btn-mobile-pause')?.addEventListener('click', togglePause);
  document.getElementById('btn-mobile-drawer')?.addEventListener('click', () => {
    setMobileDrawerOpen(!mobileDrawerOpen);
  });
  document.getElementById('mobile-sheet-handle')?.addEventListener('click', () => {
    setMobileDrawerOpen(false);
  });
  bindSwipeSheetGesture(
    document.getElementById('mobile-sheet-handle'),
    () => mobileDrawerOpen
  );
  bindSwipeSheetGesture(
    document.getElementById('mobile-dock'),
    () => mobileDrawerOpen
  );

  const labelsButton = document.getElementById('btn-toggle-labels');
  labelsButton.addEventListener('click', () => {
    const visible = !document.body.classList.contains('show-labels');
    document.body.classList.toggle('show-labels', visible);
    labelsButton.setAttribute('aria-pressed', String(visible));
    refreshViewToggles();
  });

  const orbitsButton = document.getElementById('btn-toggle-orbits');
  orbitsButton.addEventListener('click', () => {
    orbitsVisible = !orbitsVisible;
    orbitsButton.setAttribute('aria-pressed', String(orbitsVisible));
    refreshViewToggles();
    applyOrbitVisibility();
  });

  document.getElementById('btn-toggle-rings').addEventListener('click', () => {
    setRingsVisible(!ringsVisible);
  });

  document
    .getElementById('btn-rings-backlight')
    .addEventListener('click', () => {
      viewRingsBacklight();
      if (window.innerWidth <= 900) setMobileDrawerOpen(false);
    });

  const pauseButton = document.getElementById('btn-pause');
  pauseButton.addEventListener('click', togglePause);

  const speedButtons = document.querySelectorAll('.speed-btn');
  for (let i = 0; i < speedButtons.length; i += 1) {
    speedButtons[i].addEventListener('click', () => {
      setRate(Number(speedButtons[i].dataset.rate));
    });
  }

  const langButtons = document.querySelectorAll('.lang-btn[data-lang]');
  for (let i = 0; i < langButtons.length; i += 1) {
    langButtons[i].addEventListener('click', () => {
      applyLanguage(langButtons[i].dataset.lang, true);
    });
  }

  const dateInput = document.getElementById('time-date');
  dateInput.value = simulationDate.toISOString().slice(0, 10);

  document.getElementById('btn-jump').addEventListener('click', () => {
    jumpToDate(dateInput.value);
  });

  dateInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      jumpToDate(dateInput.value);
    }
  });

  document.getElementById('btn-now').addEventListener('click', jumpToNow);

  const hudButton = document.getElementById('btn-toggle-hud');
  hudButton.addEventListener('click', () => {
    const hidden = document.body.classList.toggle('hud-hidden');
    hudButton.setAttribute(
      'aria-label',
      t(currentLang, hidden ? 'showInterface' : 'hideInterface')
    );
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (cameraController.isInstrumentLocked) {
      leaveInstrumentView(true);
      return;
    }
    if (cameraController.isSurfaceLocked) {
      focusSelectedBody(false);
    }
  });

  window.addEventListener('resize', onResize);

  setRingsVisible(ringsVisible);
  applyLanguage(currentLang, false);
  timer.reset();
  requestAnimationFrame(tick);
}

bootstrapApp().catch((error) => {
  console.error('Unable to initialise the Jovian observatory.', error);
  const loader = document.getElementById('loader');
  const label = document.getElementById('loader-label');
  if (label) label.textContent = t(currentLang, 'loaderError');
  if (loader) loader.classList.remove('is-hidden');
});
