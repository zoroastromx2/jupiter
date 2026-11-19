import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { MISSIONS } from '../data/HistoricalMissions.js';
import { J2000_EPOCH_MS, MS_PER_DAY } from '../math/AstroScale.js';

const MS_PER_HOUR = 3600000;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const PATH_SEGMENTS = 360;
const TWO_PI = Math.PI * 2;
const MODEL_TARGET_SIZE = 8;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Multi-planet historical mission player.
 * systems shape:
 *   { JUPITER: { planetMesh, anchor, radiusEq, scaleFactor, moons, ringsSim } }
 */
export class MissionSimulator {
  constructor(scene, systems, camera, cameraController, assets = null) {
    this.scene = scene;
    this.systems = systems;
    this.camera = camera;
    this.cameraController = cameraController;
    this.assets = assets;

    this.activePlanet = null;
    this.activeSystem = null;
    this.activeMission = null;
    this.activeKey = null;
    this.curve = null;
    this.probeCurve = null;
    this.curveCenter = new THREE.Vector3();
    this.curveRadius = 1;
    this.periapsisU = 0.5;
    this.currentCurveU = 0;
    this.currentU = 0;
    this.eventMs = 0;
    this.windowHours = 48;
    this.radiusEq = 1;
    this.instrumentMode = false;
    this.spinPhase = 0;

    this.milestoneBadges = [];
    this.lineGeometry = null;
    this.lineMaterial = null;
    this.probeLineGeometry = null;
    this.probeLineMaterial = null;

    this.trajectoryGroup = new THREE.Group();
    this.trajectoryGroup.name = 'MissionTrajectory';

    this.pathGroup = new THREE.Group();
    this.pathGroup.name = 'MissionPath';
    this.trajectoryGroup.add(this.pathGroup);

    this.tempTangent = new THREE.Vector3();
    this.tempRight = new THREE.Vector3();
    this.tempUp = new THREE.Vector3();
    this.tempMatrix = new THREE.Matrix4();
    this.tempProbeWorld = new THREE.Vector3();
    this.tempMarkerWorld = new THREE.Vector3();
    this.tempOffset = new THREE.Vector3();
    this.opticalTarget = new THREE.Vector3();
    this.opticalTargetA = new THREE.Vector3();
    this.opticalTargetB = new THREE.Vector3();
    this.tempVelocityA = new THREE.Vector3();
    this.tempVelocityB = new THREE.Vector3();
    this.tempInstrumentWorld = new THREE.Vector3();
    this.tempTargetTangent = new THREE.Vector3();
    this.tempProbePosition = new THREE.Vector3();
    this.milestoneSegment = {
      previous: null,
      next: null,
      local: 0
    };

    this.buildProbe();
  }

  buildProbe() {
    this.probeGroup = new THREE.Group();
    this.probeGroup.name = 'MissionProbe';
    this.probeGroup.visible = false;
    this.trajectoryGroup.add(this.probeGroup);

    this.probeVisual = new THREE.Group();
    this.probeVisual.name = 'MissionProbeVisual';
    this.probeGroup.add(this.probeVisual);

    this.probeModels = {
      pioneer: this.buildPhotoModel(
        this.assets?.models?.pioneer11,
        'PioneerModel',
        MODEL_TARGET_SIZE,
        0,
        true
      ),
      voyager1: this.buildPhotoModel(
        this.assets?.models?.voyager1,
        'Voyager1Model',
        MODEL_TARGET_SIZE,
        Math.PI / 2,
        false
      ),
      voyager2: this.buildPhotoModel(
        this.assets?.models?.voyager2,
        'Voyager2Model',
        MODEL_TARGET_SIZE,
        Math.PI / 2,
        false
      ),
      galileo: this.buildGalileoModel(),
      juno: this.buildJunoModel()
    };

    if (!this.probeModels.pioneer) {
      this.probeModels.pioneer = this.buildPioneerFallback();
    }
    if (!this.probeModels.voyager1) {
      this.probeModels.voyager1 = this.buildVoyagerFallback('Voyager1Fallback');
    }
    if (!this.probeModels.voyager2) {
      this.probeModels.voyager2 = this.buildVoyagerFallback('Voyager2Fallback');
    }

    this.instrumentMount = new THREE.Object3D();
    this.instrumentMount.name = 'OpticalInstrumentMount';
    this.instrumentMount.position.set(0, 1.1, 2.6);
    this.probeVisual.add(this.instrumentMount);

    this.galileoProbeMesh = this.buildGalileoProbeMesh();
    this.trajectoryGroup.add(this.galileoProbeMesh);
  }

  buildPhotoModel(source, name, targetSize, rotationX, warmNormalizer) {
    if (!source) return null;

    const mesh = source.clone(true);
    mesh.name = name;
    mesh.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = targetSize / maxDim;

    mesh.scale.setScalar(scale);
    mesh.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    mesh.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (let i = 0; i < materials.length; i += 1) {
        materials[i].envMapIntensity = 1.35;
        materials[i].needsUpdate = true;
      }
    });

    const wrapper = new THREE.Group();
    wrapper.name = `${name}Wrapper`;
    wrapper.rotation.x = rotationX;
    if (warmNormalizer) wrapper.userData.warm = true;
    wrapper.visible = false;
    wrapper.add(mesh);
    this.probeVisual.add(wrapper);
    return wrapper;
  }

  buildFallbackBus(material) {
    const group = new THREE.Group();
    const bus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 1.6, 10, 1),
      material
    );
    bus.rotation.x = Math.PI / 2;
    group.add(bus);
    return group;
  }

  buildPioneerFallback() {
    const wrapper = new THREE.Group();
    wrapper.name = 'PioneerFallback';
    wrapper.visible = false;

    const gold = new THREE.MeshStandardMaterial({
      color: 0xd8b45d,
      metalness: 0.8,
      roughness: 0.3
    });
    const white = new THREE.MeshStandardMaterial({
      color: 0xf2eee3,
      metalness: 0.15,
      roughness: 0.45,
      side: THREE.DoubleSide
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x2d2f35,
      metalness: 0.75,
      roughness: 0.35
    });

    const bus = this.buildFallbackBus(gold);
    wrapper.add(bus);
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(1.0, 0.45, 20, 1, true),
      white
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.z = 1.05;
    wrapper.add(dish);
    for (let i = 0; i < 3; i += 1) {
      const boom = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6),
        dark
      );
      boom.rotation.z = (i / 3) * TWO_PI;
      boom.rotation.x = Math.PI / 2;
      wrapper.add(boom);
    }
    wrapper.scale.setScalar(2.6);
    this.probeVisual.add(wrapper);
    return wrapper;
  }

  buildVoyagerFallback(name) {
    const wrapper = new THREE.Group();
    wrapper.name = name;
    wrapper.visible = false;

    const white = new THREE.MeshStandardMaterial({
      color: 0xf3f0e5,
      metalness: 0.15,
      roughness: 0.42,
      side: THREE.DoubleSide
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x282b32,
      metalness: 0.8,
      roughness: 0.3
    });

    const bus = this.buildFallbackBus(white);
    wrapper.add(bus);
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 0.35, 22, 1, true),
      white
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.z = 1.2;
    wrapper.add(dish);
    const boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 3.4, 6),
      dark
    );
    boom.rotation.z = Math.PI / 2;
    boom.position.y = 0.55;
    wrapper.add(boom);
    wrapper.scale.setScalar(2.4);
    this.probeVisual.add(wrapper);
    return wrapper;
  }

  buildGalileoModel() {
    const wrapper = new THREE.Group();
    wrapper.name = 'GalileoModel';
    wrapper.visible = false;
    wrapper.scale.setScalar(2.15);

    const gold = new THREE.MeshStandardMaterial({
      color: 0xd4ad58,
      metalness: 0.82,
      roughness: 0.27
    });
    const blackMesh = new THREE.MeshStandardMaterial({
      color: 0x1a1b1f,
      metalness: 0.55,
      roughness: 0.5,
      side: THREE.DoubleSide
    });
    const white = new THREE.MeshStandardMaterial({
      color: 0xe9e5d8,
      metalness: 0.12,
      roughness: 0.45
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x26282e,
      metalness: 0.7,
      roughness: 0.32
    });

    const bus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.72, 1.6, 12, 1),
      gold
    );
    bus.rotation.x = Math.PI / 2;
    wrapper.add(bus);

    // Partially deployed umbrella HGA: open cone plus exposed radial ribs.
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(1.25, 0.5, 18, 1, true, 0, Math.PI * 1.72),
      blackMesh
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.z = 1.15;
    wrapper.add(dish);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.025, 6, 32, Math.PI * 1.72),
      gold
    );
    rim.position.z = 1.15;
    rim.rotation.z = 0.2;
    wrapper.add(rim);

    const ribPositions = [];
    const ribCount = 9;
    for (let i = 0; i < ribCount; i += 1) {
      const angle = (i / (ribCount - 1)) * Math.PI * 1.72;
      ribPositions.push(
        0, 0, 1.38,
        Math.cos(angle) * 1.25, Math.sin(angle) * 1.25, 1.12
      );
    }
    const ribGeometry = new THREE.BufferGeometry();
    ribGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(ribPositions, 3)
    );
    const ribs = new THREE.LineSegments(
      ribGeometry,
      new THREE.LineBasicMaterial({
        color: 0xf1ce83,
        transparent: true,
        opacity: 0.8
      })
    );
    wrapper.add(ribs);

    const hgaHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.32, 8),
      white
    );
    hgaHub.rotation.x = Math.PI / 2;
    hgaHub.position.z = 1.32;
    wrapper.add(hgaHub);

    // RTG booms and canisters.
    const rtgBoomA = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6),
      dark
    );
    rtgBoomA.rotation.z = Math.PI / 2;
    rtgBoomA.position.y = 0.55;
    wrapper.add(rtgBoomA);
    const rtgBoomB = rtgBoomA.clone();
    rtgBoomB.position.y = -0.55;
    wrapper.add(rtgBoomB);
    for (const y of [0.55, -0.55]) {
      for (const x of [-0.72, 0.72]) {
        const rtg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.5, 10),
          dark
        );
        rtg.rotation.z = Math.PI / 2;
        rtg.position.set(x, y, 0);
        wrapper.add(rtg);
      }
    }

    // Long magnetometer boom.
    const magBoom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 4.2, 5),
      white
    );
    magBoom.rotation.z = Math.PI / 2;
    magBoom.position.set(2.1, 0.12, 0.1);
    wrapper.add(magBoom);
    const magTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      dark
    );
    magTip.position.set(4.2, 0.12, 0.1);
    wrapper.add(magTip);

    this.probeVisual.add(wrapper);
    return wrapper;
  }

  buildJunoModel() {
    const wrapper = new THREE.Group();
    wrapper.name = 'JunoModel';
    wrapper.visible = false;
    wrapper.scale.setScalar(2.1);

    const spinGroup = new THREE.Group();
    spinGroup.name = 'JunoSpinGroup';
    this.junoSpinGroup = spinGroup;
    wrapper.add(spinGroup);

    const gold = new THREE.MeshStandardMaterial({
      color: 0xb88d45,
      metalness: 0.75,
      roughness: 0.36
    });
    const white = new THREE.MeshStandardMaterial({
      color: 0xe9e7df,
      metalness: 0.1,
      roughness: 0.4
    });
    const solar = new THREE.MeshStandardMaterial({
      color: 0x1d3f76,
      metalness: 0.55,
      roughness: 0.25,
      emissive: 0x081a33,
      emissiveIntensity: 0.75
    });
    const frame = new THREE.MeshStandardMaterial({
      color: 0x7c6a4e,
      metalness: 0.75,
      roughness: 0.32
    });

    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.52, 6, 1),
      gold
    );
    core.rotation.x = Math.PI / 2;
    spinGroup.add(core);

    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(0.58, 0.26, 22, 1, true),
      white
    );
    dish.rotation.x = -Math.PI / 2;
    dish.position.z = 0.4;
    spinGroup.add(dish);
    const dishHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8),
      white
    );
    dishHub.rotation.x = Math.PI / 2;
    dishHub.position.z = 0.54;
    spinGroup.add(dishHub);

    for (let wingIndex = 0; wingIndex < 3; wingIndex += 1) {
      const wing = new THREE.Group();
      wing.rotation.z = (wingIndex / 3) * TWO_PI;
      spinGroup.add(wing);

      for (let panelIndex = 0; panelIndex < 3; panelIndex += 1) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(1.22, 0.14, 0.58),
          solar
        );
        panel.position.x = 0.74 + panelIndex * 1.22;
        wing.add(panel);
      }

      const spar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 3.7, 5),
        frame
      );
      spar.rotation.z = Math.PI / 2;
      spar.position.x = 1.85;
      wing.add(spar);

      for (const edge of [-0.34, 0.34]) {
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, 3.7, 5),
          frame
        );
        rail.rotation.z = Math.PI / 2;
        rail.position.set(1.85, 0, edge);
        wing.add(rail);
      }
    }

    this.probeVisual.add(wrapper);
    return wrapper;
  }

  buildGalileoProbeMesh() {
    const group = new THREE.Group();
    group.name = 'galileoProbeMesh';
    group.visible = false;

    const shieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x5b3829,
      metalness: 0.35,
      roughness: 0.7
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff7b3a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    shieldMaterial.transparent = true;
    this.galileoProbeMaterials = [shieldMaterial, glowMaterial];

    const shield = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 1.15, 18, 1),
      shieldMaterial
    );
    shield.rotation.x = Math.PI / 2;
    group.add(shield);

    const probeBus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.55, 12),
      shieldMaterial
    );
    probeBus.rotation.x = Math.PI / 2;
    probeBus.position.z = -0.5;
    group.add(probeBus);

    const afterGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.055, 6, 18),
      glowMaterial
    );
    afterGlow.position.z = -0.75;
    group.add(afterGlow);
    this.galileoProbeMaterials.push(glowMaterial);

    group.scale.setScalar(2.0);
    this.trajectoryGroup.add(group);
    return group;
  }

  loadMission(planetKey, missionKey, daysSinceEpoch = 0) {
    const mission = MISSIONS[planetKey]?.[missionKey];
    const system = this.systems[planetKey];

    if (!mission || !system || mission.available === false || !mission.controlPoints) {
      this.clearMission();
      return null;
    }

    this.clearMission();

    this.activePlanet = planetKey;
    this.activeSystem = system;
    this.activeMission = mission;
    this.activeKey = missionKey;
    this.radiusEq = system.radiusEq;
    this.windowHours = mission.windowHours || 48;
    this.eventMs = Date.parse(mission.timestamp);
    this.lastDaysSinceEpoch = daysSinceEpoch;

    this.trajectoryGroup.removeFromParent();
    system.anchor.add(this.trajectoryGroup);
    this.trajectoryGroup.visible = true;
    this.trajectoryGroup.position.set(0, 0, 0);

    const controls = mission.controlPoints.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z).multiplyScalar(this.radiusEq)
    );
    this.curve = new THREE.CatmullRomCurve3(
      controls,
      false,
      'centripetal',
      0.5
    );

    const sampled = this.curve.getPoints(PATH_SEGMENTS);
    this.lineGeometry = new THREE.BufferGeometry().setFromPoints(sampled);
    this.lineMaterial = new THREE.LineBasicMaterial({
      color: mission.color,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const line = new THREE.Line(this.lineGeometry, this.lineMaterial);
    line.name = `${mission.name}Trajectory`;
    line.frustumCulled = false;
    this.pathGroup.add(line);

    const bounds = new THREE.Box3().setFromPoints(sampled);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    this.curveCenter.copy(sphere.center);
    this.curveRadius = Math.max(0.5, sphere.radius);

    if (mission.probeControlPoints) {
      const probeControls = mission.probeControlPoints.map(
        ([x, y, z]) => new THREE.Vector3(x, y, z).multiplyScalar(this.radiusEq)
      );
      this.probeCurve = new THREE.CatmullRomCurve3(
        probeControls,
        false,
        'centripetal',
        0.5
      );
      this.probeLineGeometry = new THREE.BufferGeometry().setFromPoints(
        this.probeCurve.getPoints(96)
      );
      this.probeLineMaterial = new THREE.LineBasicMaterial({
        color: mission.probeColor || 0xff6a2a,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const probeLine = new THREE.Line(
        this.probeLineGeometry,
        this.probeLineMaterial
      );
      probeLine.name = `${mission.name}ProbeTrajectory`;
      probeLine.frustumCulled = false;
      this.pathGroup.add(probeLine);
    }

    this.computePeriapsisU();

    const missionColor = `#${mission.color.toString(16).padStart(6, '0')}`;
    for (let i = 0; i < mission.milestones.length; i += 1) {
      const milestone = mission.milestones[i];
      const point = this.curve.getPointAt(
        this.mapMissionTimeToCurveU(milestone.t)
      );
      const geometry = new THREE.OctahedronGeometry(1, 0);
      const material = new THREE.MeshBasicMaterial({
        color: mission.color,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.name = `${mission.name}Milestone${i}`;
      marker.position.copy(point);
      this.pathGroup.add(marker);

      const element = document.createElement('div');
      element.className = 'milestone-badge';
      element.textContent = milestone.title;
      element.style.setProperty('--mission-color', missionColor);

      const label = new CSS2DObject(element);
      label.position.set(0, 2.6, 0);
      marker.add(label);

      this.milestoneBadges.push({
        marker,
        element,
        geometry,
        material,
        milestone
      });
    }

    this.probeGroup.visible = true;
    this.probeVisual.visible = true;
    this.refreshProbeVisibility();
    this.setInstrumentMode(false);
    this.update(daysSinceEpoch, this.camera);

    return mission;
  }

  refreshProbeVisibility() {
    const key = this.activeMission?.key;
    const pioneer = key === 'pioneer10' || key === 'pioneer11';
    const voyager1 = key === 'voyager1';
    const voyager2 = key === 'voyager2';
    const galileo = key === 'galileo';
    const juno = key === 'juno';

    const wrappers = [
      this.probeModels.pioneer,
      this.probeModels.voyager1,
      this.probeModels.voyager2,
      this.probeModels.galileo,
      this.probeModels.juno
    ];
    for (let i = 0; i < wrappers.length; i += 1) {
      const wrapper = wrappers[i];
      if (!wrapper) continue;
      wrapper.removeFromParent();
      wrapper.visible = false;
    }

    let active = null;
    if (pioneer) active = this.probeModels.pioneer;
    else if (voyager1) active = this.probeModels.voyager1;
    else if (voyager2) active = this.probeModels.voyager2;
    else if (galileo) active = this.probeModels.galileo;
    else if (juno) active = this.probeModels.juno;

    if (active) {
      active.visible = true;
      this.probeVisual.add(active);
    }
  }

  setInstrumentMode(locked) {
    this.instrumentMode = Boolean(locked);
    if (this.probeVisual) this.probeVisual.visible = !this.instrumentMode;
    if (this.pathGroup) this.pathGroup.visible = !this.instrumentMode;
    if (this.galileoProbeMesh) {
      this.galileoProbeMesh.visible =
        !this.instrumentMode && this.galileoProbeMesh.userData.active === true;
    }
  }

  computePeriapsisU() {
    if (!this.curve) {
      this.periapsisU = 0.5;
      return;
    }

    let bestU = 0.5;
    let bestDistance = Infinity;
    const samples = 512;
    for (let i = 0; i <= samples; i += 1) {
      const u = i / samples;
      this.curve.getPointAt(u, this.tempProbePosition);
      const distance = this.tempProbePosition.lengthSq();
      if (distance < bestDistance) {
        bestDistance = distance;
        bestU = u;
      }
    }
    this.periapsisU = clamp(bestU, 0.02, 0.98);
  }

  mapMissionTimeToCurveU(missionU) {
    const peak =
      this.activeMission?.peakT !== undefined
        ? this.activeMission.peakT
        : 0.5;
    if (missionU <= peak) {
      return peak > 0 ? (missionU / peak) * this.periapsisU : 0;
    }
    return (
      this.periapsisU +
      ((missionU - peak) / Math.max(1e-8, 1 - peak)) *
        (1 - this.periapsisU)
    );
  }

  clearMission() {
    for (let i = 0; i < this.milestoneBadges.length; i += 1) {
      const badge = this.milestoneBadges[i];
      badge.element.remove?.();
      badge.geometry.dispose();
      badge.material.dispose();
    }
    this.milestoneBadges = [];

    if (this.lineGeometry) {
      this.lineGeometry.dispose();
      this.lineGeometry = null;
    }
    if (this.lineMaterial) {
      this.lineMaterial.dispose();
      this.lineMaterial = null;
    }
    if (this.probeLineGeometry) {
      this.probeLineGeometry.dispose();
      this.probeLineGeometry = null;
    }
    if (this.probeLineMaterial) {
      this.probeLineMaterial.dispose();
      this.probeLineMaterial = null;
    }

    this.pathGroup.clear();
    this.pathGroup.visible = true;
    this.probeGroup.visible = false;
    this.probeVisual.visible = true;
    if (this.galileoProbeMesh) {
      this.galileoProbeMesh.visible = false;
      this.galileoProbeMesh.userData.active = false;
    }

    this.curve = null;
    this.probeCurve = null;
    this.activeMission = null;
    this.activeKey = null;
    this.activePlanet = null;
    this.activeSystem = null;
    this.eventMs = 0;
    this.currentU = 0;
    this.instrumentMode = false;
  }

  update(daysSinceEpoch, camera = this.camera, deltaTime = 0.016) {
    this.lastDaysSinceEpoch = daysSinceEpoch;
    if (!this.activeMission || !this.curve) return;

    const nowMs = J2000_EPOCH_MS + daysSinceEpoch * MS_PER_DAY;
    const deltaHours = (nowMs - this.eventMs) / MS_PER_HOUR;
    const u = clamp(
      this.activeMission.peakT + deltaHours / this.windowHours,
      0,
      1
    );
    this.currentU = u;

    const curveU = this.mapMissionTimeToCurveU(u);
    this.currentCurveU = curveU;
    this.curve.getPointAt(curveU, this.probeGroup.position);
    this.curve.getTangentAt(curveU, this.tempTangent).normalize();

    this.tempRight.crossVectors(WORLD_UP, this.tempTangent);
    if (this.tempRight.lengthSq() < 1e-8) {
      this.tempRight.set(1, 0, 0);
    } else {
      this.tempRight.normalize();
    }
    this.tempUp.crossVectors(this.tempTangent, this.tempRight).normalize();
    this.tempMatrix.makeBasis(this.tempRight, this.tempUp, this.tempTangent);
    this.probeGroup.quaternion.setFromRotationMatrix(this.tempMatrix);

    this.trajectoryGroup.updateMatrixWorld(true);
    this.probeGroup.getWorldPosition(this.tempProbeWorld);
    const cameraDistance = camera
      ? camera.position.distanceTo(this.tempProbeWorld)
      : 20;

    this.probeVisual.scale.setScalar(clamp(cameraDistance * 0.012, 0.7, 1.6));
    this.probeVisual.visible = !this.instrumentMode;

    for (let i = 0; i < this.milestoneBadges.length; i += 1) {
      const marker = this.milestoneBadges[i].marker;
      marker.getWorldPosition(this.tempMarkerWorld);
      const markerDistance = camera
        ? camera.position.distanceTo(this.tempMarkerWorld)
        : cameraDistance;
      marker.scale.setScalar(clamp(markerDistance * 0.008, 0.25, 3.0));
    }

    if (this.activeMission.key === 'juno' && this.junoSpinGroup) {
      this.spinPhase = (this.spinPhase + deltaTime * 0.24) % TWO_PI;
      this.junoSpinGroup.rotation.z = this.spinPhase;
    }

    this.updateGalileoProbe(u, cameraDistance);
  }

  updateGalileoProbe(u, cameraDistance) {
    if (!this.galileoProbeMesh) return;

    if (
      this.activeMission?.key !== 'galileo' ||
      !this.probeCurve ||
      this.instrumentMode
    ) {
      this.galileoProbeMesh.visible = false;
      this.galileoProbeMesh.userData.active = false;
      return;
    }

    const start = 0.25;
    const entry = 0.5;
    const fadeT = this.activeMission.probeFadeT || 0.65;

    if (u < start || u > fadeT) {
      this.galileoProbeMesh.visible = false;
      this.galileoProbeMesh.userData.active = false;
      return;
    }

    const probeU = clamp((u - start) / (entry - start), 0, 1);
    this.probeCurve.getPointAt(probeU, this.tempProbePosition);
    this.galileoProbeMesh.position.copy(this.tempProbePosition);
    this.probeCurve.getTangentAt(probeU, this.tempTargetTangent).normalize();
    this.tempRight.crossVectors(WORLD_UP, this.tempTargetTangent);
    if (this.tempRight.lengthSq() < 1e-8) {
      this.tempRight.set(1, 0, 0);
    } else {
      this.tempRight.normalize();
    }
    this.tempUp
      .crossVectors(this.tempTargetTangent, this.tempRight)
      .normalize();
    this.tempMatrix.makeBasis(
      this.tempRight,
      this.tempUp,
      this.tempTargetTangent
    );
    this.galileoProbeMesh.quaternion.setFromRotationMatrix(this.tempMatrix);

    const fade = 1 - THREE.MathUtils.smoothstep(u, entry, fadeT);
    this.galileoProbeMesh.scale.setScalar(
      clamp(cameraDistance * 0.02, 1.2, 3.5)
    );
    for (let i = 0; i < this.galileoProbeMaterials.length; i += 1) {
      this.galileoProbeMaterials[i].opacity = fade;
    }
    if (this.probeLineMaterial) this.probeLineMaterial.opacity = 0.9 * fade;

    this.galileoProbeMesh.visible = fade > 0.01;
    this.galileoProbeMesh.userData.active = this.galileoProbeMesh.visible;
  }

  getMilestoneSegment(u) {
    const milestones = this.activeMission?.milestones;
    if (!milestones?.length) return null;
    const segment = this.milestoneSegment;

    const first = milestones[0];
    if (u <= first.t) {
      segment.previous = first;
      segment.next = first;
      segment.local = 0;
      return segment;
    }

    const last = milestones[milestones.length - 1];
    if (u >= last.t) {
      segment.previous = last;
      segment.next = last;
      segment.local = 0;
      return segment;
    }

    for (let i = 0; i < milestones.length - 1; i += 1) {
      const previous = milestones[i];
      const next = milestones[i + 1];
      if (u <= next.t) {
        const span = Math.max(1e-8, next.t - previous.t);
        segment.previous = previous;
        segment.next = next;
        segment.local = (u - previous.t) / span;
        return segment;
      }
    }

    segment.previous = last;
    segment.next = last;
    segment.local = 0;
    return segment;
  }

  getActiveOpticalConfig(u = this.currentU) {
    const milestones = this.activeMission?.milestones;
    if (!milestones?.length) return null;
    let active = milestones[0];
    for (let i = 0; i < milestones.length; i += 1) {
      if (milestones[i].t <= u + 1e-8) active = milestones[i];
    }
    return active;
  }

  resolveOpticalTarget(milestone, out) {
    const system = this.activeSystem;
    if (!system) {
      out.set(0, 0, 0);
      return out;
    }

    const key = milestone.targetKey;
    if (key === 'JUPITER_RINGS') {
      const ringTarget = system.ringsSim?.focusTarget;
      if (ringTarget) ringTarget.getWorldPosition(out);
      else if (system.planetMesh) system.planetMesh.getWorldPosition(out);
      else out.set(0, 0, 0);
    } else if (key === 'SATURN' || key === 'JUPITER') {
      if (system.planetMesh) system.planetMesh.getWorldPosition(out);
      else out.set(0, 0, 0);
    } else if (key && system.moons?.[key]?.mesh) {
      system.moons[key].mesh.getWorldPosition(out);
    } else if (system.planetMesh) {
      system.planetMesh.getWorldPosition(out);
    } else {
      out.set(0, 0, 0);
    }

    if (milestone.targetOffset) {
      this.tempOffset
        .set(
          milestone.targetOffset[0],
          milestone.targetOffset[1],
          milestone.targetOffset[2]
        )
        .multiplyScalar(this.radiusEq);
      out.add(this.tempOffset);
    }

    return out;
  }

  getOpticalTargetPosition(u = this.currentU, out = this.opticalTarget) {
    const segment = this.getMilestoneSegment(u);
    if (!segment) return null;

    this.resolveOpticalTarget(segment.previous, this.opticalTargetA);
    this.resolveOpticalTarget(segment.next, this.opticalTargetB);

    const local = clamp(segment.local, 0, 1);
    const eased = local * local * (3 - 2 * local);
    out.lerpVectors(this.opticalTargetA, this.opticalTargetB, eased);
    return out;
  }

  getRelativeVelocityKmS(u = this.currentU) {
    if (!this.curve || !this.activeMission) return 0;

    const deltaU = 0.001;
    const uA = clamp(u - deltaU, 0, 1);
    const uB = clamp(u + deltaU, 0, 1);
    const span = uB - uA;
    if (span < 1e-8) return 0;

    const curveA = this.mapMissionTimeToCurveU(uA);
    const curveB = this.mapMissionTimeToCurveU(uB);
    this.curve.getPointAt(curveA, this.tempVelocityA);
    this.curve.getPointAt(curveB, this.tempVelocityB);
    const worldDistance = this.tempVelocityA.distanceTo(this.tempVelocityB);
    const missionSeconds = Math.max(1, this.windowHours * 3600);
    const scaleFactor = this.activeSystem?.scaleFactor ?? 1000;

    return (worldDistance / (span * missionSeconds)) * scaleFactor;
  }

  getFollowDistance() {
    return clamp(this.curveRadius * 0.025, 12, 36);
  }
}
