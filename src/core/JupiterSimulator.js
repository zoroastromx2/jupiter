import * as THREE from 'three';
import jupiterVert from '../shaders/jupiter.vert?raw';
import jupiterFrag from '../shaders/jupiter.frag?raw';
import {
  CONSTANTS,
  JOVIAN_KM_PER_UNIT,
  toWebGLUnits
} from '../math/AstroScale.js';
import {
  TWO_PI,
  jupiterHeliocentricPosition
} from '../math/KeplerOrbit.js';

const JUPITER = CONSTANTS.JUPITER;
const MOON_IDS = ['IO', 'EUROPA', 'GANYMEDE', 'CALLISTO'];

/**
 * Jupiter: oblate spheroid, System III rotation, seasonal solar direction,
 * custom cloud shader, and owner of the Jovian equatorial frame.
 */
export class JupiterSimulator {
  constructor(scene, assets) {
    this.assets = assets;
    this.radiusEq = toWebGLUnits(JUPITER.RADIUS_EQUATORIAL, JOVIAN_KM_PER_UNIT);
    this.radiusPolar = toWebGLUnits(JUPITER.RADIUS_POLAR, JOVIAN_KM_PER_UNIT);
    this.rotationPeriodDays = JUPITER.ROTATION_PERIOD_DAYS;

    this.group = new THREE.Group();
    this.group.name = 'JovianSystem';
    scene?.add(this.group);

    this.equatorGroup = new THREE.Group();
    this.equatorGroup.name = 'JupiterEquatorialFrame';
    this.group.add(this.equatorGroup);

    this.poleLocal = new THREE.Vector3(0, 1, 0);
    this.poleWorld = new THREE.Vector3(0, 1, 0);
    const poleEcliptic = JUPITER.POLE_ECLIPTIC;
    // The IAU J2000 pole is 3.13 degrees from Jupiter's orbital normal.
    // Using the measured pole applies that obliquity without a hand-tuned axis.
    this.poleWorld
      .set(poleEcliptic.X, poleEcliptic.Z, -poleEcliptic.Y)
      .normalize();
    this.equatorGroup.quaternion.setFromUnitVectors(this.poleLocal, this.poleWorld);

    this.spinGroup = new THREE.Group();
    this.spinGroup.name = 'JupiterSpin';
    this.equatorGroup.add(this.spinGroup);

    this.center = new THREE.Vector3(0, 0, 0);
    this.sunDirection = new THREE.Vector3(0, 0, 1);
    this.jupiterHeliocentric = new THREE.Vector3();
    this.sunDistanceKm = JUPITER.SUN_DISTANCE_KM;
    this.rotationPhase = 0;
    this.daysSinceEpoch = 0;

    this.moonsPosition = [
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3()
    ];
    this.moonsRadius = MOON_IDS.map(
      (id) => toWebGLUnits(CONSTANTS[id].RADIUS, JOVIAN_KM_PER_UNIT)
    );

    this.uniforms = {
      tColor: { value: assets.jupiterColor },
      tNormal: { value: assets.jupiterNormal },
      tClouds: { value: assets.jupiterClouds },
      uSunDirection: { value: this.sunDirection },
      uTime: { value: 0 },
      uDaysSinceEpoch: { value: 0 },
      uAuroraIntensity: { value: 1.2 },
      uIoFootprintAzimuth: { value: 0 },
      uMoonsPosition: { value: this.moonsPosition },
      uMoonsRadius: { value: this.moonsRadius },
      uRadiusEq: { value: this.radiusEq },
      uRadiusPolar: { value: this.radiusPolar }
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: jupiterVert,
      fragmentShader: jupiterFrag,
      toneMapped: false
    });

    this.geometry = new THREE.SphereGeometry(1, 192, 96);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'Jupiter';
    this.mesh.scale.set(this.radiusEq, this.radiusPolar, this.radiusEq);
    this.mesh.userData.radius = this.radiusEq;
    this.spinGroup.add(this.mesh);
    this.focusTarget = this.mesh;

    // Low cloud-top viewpoint for the surface/close-orbit mode.
    this.surfaceCameraMount = new THREE.Object3D();
    this.surfaceCameraMount.name = 'JupiterCloudTopMount';
    this.surfaceCameraMount.position
      .set(0.959, 0.179, 0.257)
      .normalize()
      .multiplyScalar(1.015);
    this.surfaceCameraTarget = new THREE.Object3D();
    this.surfaceCameraTarget.name = 'JupiterCloudTopTarget';
    this.surfaceCameraTarget.position.set(0.825, 0.152, 3.15);
    this.mesh.add(this.surfaceCameraMount);
    this.mesh.add(this.surfaceCameraTarget);

    this.inverseMeshMatrix = new THREE.Matrix4();
    this.ioLocal = new THREE.Vector3();
    this.worldQuaternion = new THREE.Quaternion();
    this.inverseWorldQuaternion = new THREE.Quaternion();
    this.localSunDirection = new THREE.Vector3();
    this.surfaceAimDirection = new THREE.Vector3();
  }

  setAuroraIntensity(value) {
    this.uniforms.uAuroraIntensity.value = Math.max(0, value);
  }

  orientSurfaceView() {
    this.mesh.updateWorldMatrix(true, false);
    this.mesh.getWorldQuaternion(this.worldQuaternion);
    this.inverseWorldQuaternion.copy(this.worldQuaternion).invert();
    this.localSunDirection
      .copy(this.sunDirection)
      .applyQuaternion(this.inverseWorldQuaternion)
      .normalize();

    this.surfaceCameraMount.position
      .copy(this.localSunDirection)
      .multiplyScalar(1.015);

    this.surfaceAimDirection.set(0, 0, 1);
    this.surfaceAimDirection.addScaledVector(
      this.localSunDirection,
      -this.localSunDirection.z
    );
    if (this.surfaceAimDirection.lengthSq() < 1e-4) {
      this.surfaceAimDirection.set(0, 1, 0);
    }
    this.surfaceAimDirection
      .normalize()
      .addScaledVector(this.localSunDirection, 0.05)
      .normalize();

    this.surfaceCameraTarget.position
      .copy(this.surfaceCameraMount.position)
      .addScaledVector(this.surfaceAimDirection, 3.0);
  }

  update(daysSinceEpoch) {
    this.daysSinceEpoch = daysSinceEpoch;

    const phase =
      (((daysSinceEpoch / this.rotationPeriodDays) % 1) + 1) % 1;
    this.rotationPhase = phase * TWO_PI;
    this.spinGroup.rotation.y = this.rotationPhase;

    jupiterHeliocentricPosition(
      daysSinceEpoch,
      JUPITER,
      this.jupiterHeliocentric
    );
    this.sunDistanceKm = this.jupiterHeliocentric.length();
    this.sunDirection.copy(this.jupiterHeliocentric).multiplyScalar(-1).normalize();

    const wrappedTime = ((daysSinceEpoch % 1000) + 1000) % 1000;
    this.uniforms.uTime.value = wrappedTime;
    this.uniforms.uDaysSinceEpoch.value = daysSinceEpoch;
    this.uniforms.uSunDirection.value.copy(this.sunDirection);
  }

  /**
   * Sync analytical shadow data from the live Galilean world positions.
   * Called after the moon simulators have advanced.
   */
  updateMoonUniforms(moonSimulators) {
    for (let i = 0; i < MOON_IDS.length; i += 1) {
      const moon = moonSimulators[i];
      if (!moon) continue;
      moon.mesh.getWorldPosition(this.moonsPosition[i]);
      this.moonsRadius[i] = moon.sceneRadius;
    }

    // Project Io's live azimuth into Jupiter's local (rotating) frame.
    this.mesh.updateWorldMatrix(true, false);
    this.inverseMeshMatrix.copy(this.mesh.matrixWorld).invert();
    this.ioLocal.copy(this.moonsPosition[0]).applyMatrix4(this.inverseMeshMatrix);
    this.uniforms.uIoFootprintAzimuth.value = Math.atan2(
      this.ioLocal.z,
      this.ioLocal.x
    );
  }
}
