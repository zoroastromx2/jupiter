import * as THREE from 'three';
import moonVert from '../shaders/moon.vert?raw';
import moonFrag from '../shaders/moon.frag?raw';
import {
  CONSTANTS,
  JOVIAN_KM_PER_UNIT,
  toWebGLUnits
} from '../math/AstroScale.js';
import {
  degToRad,
  meanAnomalyRadians,
  orbitalPosition
} from '../math/KeplerOrbit.js';

const MOON_STYLE = {
  IO: { color: 0xf2c26f, albedoBoost: 1.0, bounce: 0.12 },
  EUROPA: { color: 0xdce8f2, albedoBoost: 1.12, bounce: 0.1 },
  GANYMEDE: { color: 0xb6a487, albedoBoost: 0.92, bounce: 0.1 },
  CALLISTO: { color: 0x8d8178, albedoBoost: 0.9, bounce: 0.09 }
};

/**
 * One Galilean moon: nested LAN / inclination pivots, Keplerian propagation,
 * tidally locked spin, eclipse-aware shader, and surface camera mount.
 */
export class GalileanMoonSimulator {
  constructor(jupiter, moonId, assets) {
    this.jupiter = jupiter;
    this.id = moonId;
    this.config = CONSTANTS[moonId];
    this.style = MOON_STYLE[moonId];

    this.radiusKm = this.config.RADIUS;
    this.sceneRadius = toWebGLUnits(this.radiusKm, JOVIAN_KM_PER_UNIT);
    this.semiMajorAxisKm = this.config.ORBIT_SEMI_MAJOR;
    this.semiMajorAxisScene = toWebGLUnits(
      this.semiMajorAxisKm,
      JOVIAN_KM_PER_UNIT
    );
    this.periodDays = this.config.ORBIT_PERIOD;
    this.inclinationRad = degToRad(this.config.INCLINATION);
    this.lanRad = degToRad(this.config.LAN);
    this.eccentricity = this.config.ORBIT_ECCENTRICITY;
    this.meanAnomalyEpoch = this.config.MEAN_ANOMALY_EPOCH;

    this.node = new THREE.Object3D();
    this.node.name = `${moonId}-LAN`;
    this.node.rotation.y = this.lanRad;
    jupiter.equatorGroup.add(this.node);

    this.inclined = new THREE.Object3D();
    this.inclined.name = `${moonId}-Inclination`;
    this.inclined.rotation.x = this.inclinationRad;
    this.node.add(this.inclined);

    const colorTexture = assets?.[`${moonId.toLowerCase()}Color`] ?? null;
    const normalTexture = assets?.[`${moonId.toLowerCase()}Normal`] ?? null;

    this.uniforms = {
      tColor: { value: colorTexture },
      tNormal: { value: normalTexture },
      uSunDirection: { value: jupiter.sunDirection },
      uJupiterCenter: { value: jupiter.center },
      uJupiterPole: { value: jupiter.poleWorld },
      uJupiterRadiusEq: { value: jupiter.radiusEq },
      uJupiterRadiusPolar: { value: jupiter.radiusPolar },
      uSunIntensity: { value: 1.12 },
      uNormalStrength: { value: 0.65 },
      uAlbedoBoost: { value: this.style.albedoBoost },
      uBounceIntensity: { value: this.style.bounce }
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: moonVert,
      fragmentShader: moonFrag,
      toneMapped: false
    });

    this.geometry = new THREE.SphereGeometry(1, 64, 32);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = moonId;
    this.mesh.scale.setScalar(this.sceneRadius);
    this.mesh.userData.radius = this.sceneRadius;
    this.inclined.add(this.mesh);
    this.focusTarget = this.mesh;

    // Low-altitude viewpoint on the Jupiter-facing hemisphere.
    this.surfaceCameraMount = new THREE.Object3D();
    this.surfaceCameraMount.name = `${moonId}-SurfaceMount`;
    this.surfaceCameraMount.position
      .set(0.959, 0.179, 0.257)
      .normalize()
      .multiplyScalar(1.02);
    this.surfaceCameraTarget = new THREE.Object3D();
    this.surfaceCameraTarget.name = `${moonId}-SurfaceTarget`;
    this.surfaceCameraTarget.position.set(0.825, 0.152, 3.15);
    this.mesh.add(this.surfaceCameraMount);
    this.mesh.add(this.surfaceCameraTarget);

    this.orbitPosition = new THREE.Vector3();
    this.worldQuaternion = new THREE.Quaternion();
    this.inverseWorldQuaternion = new THREE.Quaternion();
    this.localSunDirection = new THREE.Vector3();
    this.surfaceAimDirection = new THREE.Vector3();
    this.mesh.position.copy(this.placeOnOrbit(0));

    this.orbitLine = this.createOrbitLine();
    this.inclined.add(this.orbitLine);
  }

  placeOnOrbit(daysSinceEpoch) {
    const meanAnomaly = meanAnomalyRadians(
      daysSinceEpoch,
      this.periodDays,
      this.meanAnomalyEpoch
    );

    orbitalPosition(
      this.semiMajorAxisScene,
      this.eccentricity,
      0,
      0,
      meanAnomaly,
      this.orbitPosition,
      0
    );

    return this.orbitPosition;
  }

  createOrbitLine() {
    const segments = 512;
    const positions = new Float32Array(segments * 3);
    const point = new THREE.Vector3();

    for (let i = 0; i < segments; i += 1) {
      const meanAnomaly = (i / segments) * Math.PI * 2;
      orbitalPosition(
        this.semiMajorAxisScene,
        this.eccentricity,
        0,
        0,
        meanAnomaly,
        point,
        0
      );
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: this.style.color,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });

    const line = new THREE.LineLoop(geometry, material);
    line.name = `${this.id}-orbit`;
    line.userData.moonId = this.id;
    return line;
  }

  update(daysSinceEpoch) {
    this.placeOnOrbit(daysSinceEpoch);
    this.mesh.position.copy(this.orbitPosition);

    // Tidal lock: local +Z faces Jupiter, so the surface mount looks at Jupiter.
    this.mesh.rotation.y = Math.atan2(
      -this.orbitPosition.x,
      -this.orbitPosition.z
    );
  }

  /**
   * Put the surface camera at the subsolar point and aim it along the local
   * horizon toward the Jupiter-facing direction. This guarantees a daylit
   * foreground while keeping the horizon level.
   */
  orientSurfaceView() {
    this.mesh.updateWorldMatrix(true, false);
    this.mesh.getWorldQuaternion(this.worldQuaternion);
    this.inverseWorldQuaternion.copy(this.worldQuaternion).invert();
    this.localSunDirection
      .copy(this.jupiter.sunDirection)
      .applyQuaternion(this.inverseWorldQuaternion)
      .normalize();

    this.surfaceCameraMount.position
      .copy(this.localSunDirection)
      .multiplyScalar(1.02);

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

  setOrbitVisible(visible) {
    this.orbitLine.visible = Boolean(visible);
  }

  getWorldPositionInto(target) {
    return this.mesh.getWorldPosition(target);
  }
}
