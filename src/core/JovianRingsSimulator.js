import * as THREE from 'three';
import ringsVert from '../shaders/jovian_rings.vert?raw';
import ringsFrag from '../shaders/jovian_rings.frag?raw';
import { JOVIAN_RINGS } from '../math/AstroScale.js';

const TWO_PI = Math.PI * 2.0;
const SHEPHERD_INCLINATIONS = [
  0.0,
  0.0,
  THREE.MathUtils.degToRad(0.374),
  THREE.MathUtils.degToRad(1.076)
];

/**
 * Jupiter's dust rings as a single-pass volumetric bounding cylinder.
 * The mesh lives in Jupiter's equatorial frame (Y = pole), so the shader can
 * reason about ring radii and vertical thickness in Jupiter-radii units.
 */
export class JovianRingsSimulator {
  constructor(jupiterSimulator) {
    this.jupiter = jupiterSimulator;
    this.radiusEq = jupiterSimulator.radiusEq;
    this.radiusPolar = jupiterSimulator.radiusPolar;
    this.visible = true;

    this.group = new THREE.Group();
    this.group.name = 'JovianDustRings';
    jupiterSimulator.equatorGroup.add(this.group);

    const cylinderRadius = JOVIAN_RINGS.THEBE_EXT_OUTER * this.radiusEq;
    const cylinderHeight =
      JOVIAN_RINGS.HALO_MAX_HEIGHT * 2.4 * this.radiusEq;

    // The requested R_J boundary values are converted to world units here.
    this.geometry = new THREE.CylinderGeometry(
      cylinderRadius,
      cylinderRadius,
      cylinderHeight,
      64,
      1
    );

    const defines = {};
    for (const [key, value] of Object.entries(JOVIAN_RINGS)) {
      defines[key] = value.toFixed(6);
    }

    this.uniforms = {
      uSunDirection: { value: jupiterSimulator.sunDirection },
      uJupiterRadius: {
        value: new THREE.Vector3(
          this.radiusEq,
          this.radiusPolar,
          this.radiusEq
        )
      },
      uTime: { value: 0 },
      uRingExposure: { value: 1.0 },
      uRingInverseMatrix: { value: new THREE.Matrix4() }
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      defines,
      vertexShader: ringsVert,
      fragmentShader: ringsFrag,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'JovianRingVolume';
    this.mesh.renderOrder = 2;
    this.group.add(this.mesh);

    this.shepherdRadii = [1.792, 1.806, JOVIAN_RINGS.AMALTHEA_OUTER, JOVIAN_RINGS.THEBE_OUTER];
    this.shepherdPeriods = [0.29478, 0.29826, 0.49818, 0.67454];
    this.shepherdPhases = [0.2, 1.7, 3.1, 5.4];
    this.shepherdNodes = [0.0, 0.5, 0.4, 0.8];

    const shepherdPositions = new Float32Array(12);
    const shepherdGeometry = new THREE.BufferGeometry();
    shepherdGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(shepherdPositions, 3)
    );

    this.shepherdMaterial = new THREE.PointsMaterial({
      color: 0xffd7a1,
      size: 1.6,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });

    this.shepherdGeometry = shepherdGeometry;
    this.shepherdPositions = shepherdPositions;
    this.shepherdPoints = new THREE.Points(
      shepherdGeometry,
      this.shepherdMaterial
    );
    this.shepherdPoints.name = 'RingShepherdMoons';
    this.shepherdPoints.frustumCulled = false;
    this.group.add(this.shepherdPoints);

    this.update(0);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.group.visible = this.visible;
  }

  setExposure(value) {
    this.uniforms.uRingExposure.value = Math.max(0, value);
  }

  update(daysSinceEpoch) {
    const wrappedTime = ((daysSinceEpoch % 1000) + 1000) % 1000;
    this.uniforms.uTime.value = wrappedTime;

    this.mesh.updateWorldMatrix(true, false);
    this.uniforms.uRingInverseMatrix.value
      .copy(this.mesh.matrixWorld)
      .invert();

    const positions = this.shepherdPositions;
    for (let i = 0; i < this.shepherdRadii.length; i += 1) {
      const radius = this.shepherdRadii[i] * this.radiusEq;
      const angle =
        this.shepherdPhases[i] +
        (daysSinceEpoch / this.shepherdPeriods[i]) * TWO_PI;
      const inclination = SHEPHERD_INCLINATIONS[i];
      const node = this.shepherdNodes[i];

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] =
        radius * Math.sin(inclination) * Math.sin(angle - node);
      positions[i * 3 + 2] = -Math.sin(angle) * radius;
    }

    this.shepherdGeometry.attributes.position.needsUpdate = true;
  }
}
