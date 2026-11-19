import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { AssetFetcher } from './core/AssetFetcher.js';
import { CameraController } from './core/CameraController.js';
import { GalileanMoonSimulator } from './core/GalileanMoonSimulator.js';
import { JovianRingsSimulator } from './core/JovianRingsSimulator.js';
import { JupiterSimulator } from './core/JupiterSimulator.js';
import { StarfieldSimulator } from './core/StarfieldSimulator.js';
import {
  J2000_EPOCH_MS,
  MS_PER_DAY,
  dateToDaysSinceEpoch,
  setDateFromDays
} from './math/AstroScale.js';
import './style.css';

const BASE_DAYS_PER_SECOND = 1.0 / 24.0; // ×1 = one simulated hour per real second
const BODY_ORDER = ['jupiter', 'io', 'europa', 'ganymede', 'callisto'];
const MOON_IDS = ['IO', 'EUROPA', 'GANYMEDE', 'CALLISTO'];

const BODY_META = {
  jupiter: {
    name: 'Jupiter',
    type: 'Gas giant',
    radius: '71,492 km',
    orbit: '5.20 AU',
    period: '0.414 d (spin)',
    eccentricity: '0.0489',
    tilt: '3.13°'
  },
  io: {
    name: 'Io',
    type: 'Galilean moon',
    radius: '1,821.6 km',
    orbit: '421,700 km',
    period: '1.769 d',
    eccentricity: '0.0041',
    tilt: '0.00° (locked)'
  },
  europa: {
    name: 'Europa',
    type: 'Galilean moon',
    radius: '1,560.8 km',
    orbit: '671,034 km',
    period: '3.551 d',
    eccentricity: '0.0090',
    tilt: '0.00° (locked)'
  },
  ganymede: {
    name: 'Ganymede',
    type: 'Galilean moon',
    radius: '2,634.1 km',
    orbit: '1,070,412 km',
    period: '7.155 d',
    eccentricity: '0.0013',
    tilt: '0.00° (locked)'
  },
  callisto: {
    name: 'Callisto',
    type: 'Galilean moon',
    radius: '2,410.3 km',
    orbit: '1,882,709 km',
    period: '16.689 d',
    eccentricity: '0.0074',
    tilt: '0.00° (locked)'
  }
};

const state = {
  daysSinceEpoch: 0,
  timeScale: 1,
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
let starfieldSim;
let moonSimulators = [];
let simulationDate = new Date();
let selectedBodyId = 'jupiter';
let simulationStarted = false;

const targetButtons = {};
const clock = new THREE.Clock(false);

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

function createLabel(simulator, title, subtitle, height) {
  const element = document.createElement('div');
  element.className = 'body-label';

  const name = document.createElement('span');
  name.textContent = title;

  const sub = document.createElement('span');
  sub.className = 'label-sub';
  sub.textContent = subtitle;

  element.appendChild(name);
  element.appendChild(sub);

  const label = new CSS2DObject(element);
  label.position.set(0, height, 0);
  simulator.mesh.add(label);
  return label;
}

function createLabels() {
  createLabel(jupiterSim, 'JUPITER', '5.20 AU · 3.13°', 1.16);
  createLabel(moonSimulators[0], 'IO', '1.769 d', 1.55);
  createLabel(moonSimulators[1], 'EUROPA', '3.551 d', 1.55);
  createLabel(moonSimulators[2], 'GANYMEDE', '7.155 d', 1.55);
  createLabel(moonSimulators[3], 'CALLISTO', '16.689 d', 1.55);
}

function refreshSelectionUI() {
  const meta = BODY_META[selectedBodyId];
  const simulator = bodySimulatorFor(selectedBodyId);

  for (let i = 0; i < BODY_ORDER.length; i += 1) {
    const id = BODY_ORDER[i];
    targetButtons[id]?.classList.toggle('is-active', id === selectedBodyId);
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

  focusLabel.textContent = 'Close orbit';
  if (cameraController?.isSurfaceLocked) {
    surfaceLabel.textContent = 'Exit surface';
  } else {
    surfaceLabel.textContent =
      selectedBodyId === 'jupiter' ? 'Cloud-top view' : 'Surface view';
  }
  if (surfaceButton) surfaceButton.disabled = !simulator;

  updateViewState();
}

function updateViewState() {
  const viewState = document.getElementById('view-state');
  if (!viewState) return;

  if (cameraController?.isSurfaceLocked) {
    viewState.textContent = `SURFACE · ${BODY_META[selectedBodyId].name.toUpperCase()}`;
    document.getElementById('btn-surface-label').textContent = 'Exit surface';
  } else {
    viewState.textContent = `ORBITAL · ${BODY_META[selectedBodyId].name.toUpperCase()}`;
    if (selectedBodyId !== 'jupiter') {
      document.getElementById('btn-surface-label').textContent = 'Surface view';
    } else {
      document.getElementById('btn-surface-label').textContent = 'Cloud-top view';
    }
  }
}

function applyOrbitVisibility() {
  const visible = orbitsVisible && !cameraController?.isSurfaceLocked;
  for (let i = 0; i < moonSimulators.length; i += 1) {
    moonSimulators[i].setOrbitVisible(visible);
  }
}

function setRingsVisible(visible) {
  ringsVisible = Boolean(visible);
  ringsSim?.setVisible(ringsVisible);

  const button = document.getElementById('btn-toggle-rings');
  if (!button) return;

  button.setAttribute('aria-pressed', String(ringsVisible));
  const stateLabel = document.querySelector('[data-state-for="rings"]');
  if (stateLabel) stateLabel.textContent = ringsVisible ? 'ON' : 'OFF';
}

function viewRingsBacklight() {
  if (!ringsSim) return;
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
  if (!BODY_META[id]) return;
  selectedBodyId = id;
  refreshSelectionUI();

  if (shouldFocus) {
    focusSelectedBody(false);
  }
}

function focusSelectedBody(surface) {
  const simulator = bodySimulatorFor(selectedBodyId);
  if (!simulator) return;

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

function setSpeed(speed) {
  state.timeScale = speed;
  state.paused = false;
  refreshTimeControls();
}

function togglePause() {
  state.paused = !state.paused;
  refreshTimeControls();
}

function formatRate() {
  if (state.paused) return 'PAUSED';
  if (state.timeScale === 1) return '1 h / s';
  if (state.timeScale === 10) return '10 h / s';
  if (state.timeScale === 100) return '4.2 d / s';
  return `${state.timeScale} h / s`;
}

function refreshTimeControls() {
  const pauseButton = document.getElementById('btn-pause');
  const status = document.getElementById('hud-status');
  const rate = document.getElementById('speed-readout');
  const clockRate = document.getElementById('clock-rate');
  const speedButtons = document.querySelectorAll('.speed-btn');

  pauseButton.classList.toggle('is-active', state.paused);
  pauseButton.setAttribute('aria-pressed', String(state.paused));
  pauseButton.querySelector('span').textContent = state.paused ? 'Resume' : 'Pause';

  status.textContent = state.paused ? 'PAUSED' : 'LIVE';
  status.classList.toggle('is-paused', state.paused);

  const rateLabel = formatRate();
  rate.textContent = rateLabel;
  clockRate.textContent = rateLabel;

  for (let i = 0; i < speedButtons.length; i += 1) {
    const button = speedButtons[i];
    const value = Number(button.dataset.speed);
    button.classList.toggle(
      'is-active',
      !state.paused && value === state.timeScale
    );
  }
}

function jumpToDate(value) {
  if (!value) return;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return;

  state.daysSinceEpoch = (timestamp - J2000_EPOCH_MS) / MS_PER_DAY;
  setDateFromDays(state.daysSinceEpoch, simulationDate);
  refreshClock();
}

function jumpToNow() {
  state.daysSinceEpoch = dateToDaysSinceEpoch(new Date());
  setDateFromDays(state.daysSinceEpoch, simulationDate);
  state.paused = false;
  refreshTimeControls();
  refreshClock();
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

  const sunDistance = jupiterSim.sunDistanceKm / 1e6;
  document.getElementById('telemetry-sun-distance').textContent =
    `${sunDistance.toFixed(2)} M km`;
  document.getElementById('fps').textContent = `${Math.round(state.fps)} FPS`;
  updateViewState();
  applyOrbitVisibility();
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
}

function tick() {
  requestAnimationFrame(tick);

  const delta = Math.min(clock.getDelta(), 0.05);

  if (!state.paused) {
    state.daysSinceEpoch += delta * state.timeScale * BASE_DAYS_PER_SECOND;
  }

  jupiterSim.update(state.daysSinceEpoch);
  ringsSim.update(state.daysSinceEpoch);
  for (let i = 0; i < moonSimulators.length; i += 1) {
    moonSimulators[i].update(state.daysSinceEpoch);
  }
  jupiterSim.updateMoonUniforms(moonSimulators);

  cameraController.update();

  composer.render();
  labelRenderer.render(scene, camera);

  updateFps(delta);
  updateHud(delta);

  if (!simulationStarted) {
    simulationStarted = true;
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
}

function setLoaderProgress(fraction) {
  const percent = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  const progress = document.getElementById('loader-progress');
  const label = document.getElementById('loader-percent');
  if (progress) progress.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}%`;
}

async function bootstrapApp() {
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
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.2;
  controls.maxDistance = 12000;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.update();

  cameraController = new CameraController(camera, controls);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.48,
    0.42,
    1.12
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  document.getElementById('labels-layer').appendChild(labelRenderer.domElement);

  const fetcher = new AssetFetcher({
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    onProgress: setLoaderProgress
  });
  const assets = await fetcher.loadAll();

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
      button.addEventListener('click', () => selectBody(id, true));
    }
  }

  document.getElementById('btn-focus').addEventListener('click', () => {
    focusSelectedBody(false);
  });

  document.getElementById('btn-surface').addEventListener('click', () => {
    if (cameraController.isSurfaceLocked) {
      focusSelectedBody(false);
    } else {
      focusSelectedBody(true);
    }
  });

  const labelsButton = document.getElementById('btn-toggle-labels');
  labelsButton.addEventListener('click', () => {
    const visible = !document.body.classList.contains('show-labels');
    document.body.classList.toggle('show-labels', visible);
    labelsButton.setAttribute('aria-pressed', String(visible));
    document.querySelector('[data-state-for="labels"]').textContent = visible
      ? 'ON'
      : 'OFF';
  });

  const orbitsButton = document.getElementById('btn-toggle-orbits');
  orbitsButton.addEventListener('click', () => {
    orbitsVisible = !orbitsVisible;
    orbitsButton.setAttribute('aria-pressed', String(orbitsVisible));
    document.querySelector('[data-state-for="orbits"]').textContent = orbitsVisible
      ? 'ON'
      : 'OFF';
    applyOrbitVisibility();
  });

  document.getElementById('btn-toggle-rings').addEventListener('click', () => {
    setRingsVisible(!ringsVisible);
  });

  document
    .getElementById('btn-rings-backlight')
    .addEventListener('click', viewRingsBacklight);

  const pauseButton = document.getElementById('btn-pause');
  pauseButton.addEventListener('click', togglePause);

  const speedButtons = document.querySelectorAll('.speed-btn');
  for (let i = 0; i < speedButtons.length; i += 1) {
    speedButtons[i].addEventListener('click', () => {
      setSpeed(Number(speedButtons[i].dataset.speed));
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
      hidden ? 'Show interface' : 'Hide interface'
    );
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && cameraController.isSurfaceLocked) {
      focusSelectedBody(false);
    }
  });

  window.addEventListener('resize', onResize);

  refreshSelectionUI();
  refreshTimeControls();
  refreshClock();
  setRingsVisible(ringsVisible);
  clock.start();
  requestAnimationFrame(tick);
}

bootstrapApp().catch((error) => {
  console.error('Unable to initialise the Jovian observatory.', error);
  const loader = document.getElementById('loader');
  const label = document.getElementById('loader-label');
  if (label) label.textContent = 'Unable to load the simulation. Check the console.';
  if (loader) loader.classList.remove('is-hidden');
});
