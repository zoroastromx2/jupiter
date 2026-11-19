import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { JOVIAN_RINGS } from '../src/math/AstroScale.js';
import { JupiterSimulator } from '../src/core/JupiterSimulator.js';
import { JovianRingsSimulator } from '../src/core/JovianRingsSimulator.js';

const EMPTY_ASSETS = {
  jupiterColor: null,
  jupiterNormal: null,
  jupiterClouds: null
};

function createRings() {
  const scene = new THREE.Scene();
  const jupiter = new JupiterSimulator(scene, EMPTY_ASSETS);
  const rings = new JovianRingsSimulator(jupiter);
  return { scene, jupiter, rings };
}

describe('Jovian dust rings', () => {
  it('builds the requested bounding cylinder in Jupiter radii', () => {
    const { jupiter, rings } = createRings();
    const expectedRadius = JOVIAN_RINGS.THEBE_EXT_OUTER * jupiter.radiusEq;
    const expectedHeight =
      JOVIAN_RINGS.HALO_MAX_HEIGHT * 2.4 * jupiter.radiusEq;

    expect(rings.group.parent).toBe(jupiter.equatorGroup);
    expect(rings.mesh.geometry.parameters.radiusTop).toBeCloseTo(
      expectedRadius,
      5
    );
    expect(rings.mesh.geometry.parameters.radiusBottom).toBeCloseTo(
      expectedRadius,
      5
    );
    expect(rings.mesh.geometry.parameters.height).toBeCloseTo(
      expectedHeight,
      5
    );
    expect(rings.mesh.geometry.parameters.radialSegments).toBe(64);
  });

  it('uses additive, depth-write-free back-side rendering', () => {
    const { rings } = createRings();

    expect(rings.mesh.material.side).toBe(THREE.BackSide);
    expect(rings.mesh.material.transparent).toBe(true);
    expect(rings.mesh.material.depthWrite).toBe(false);
    expect(rings.mesh.material.blending).toBe(THREE.AdditiveBlending);
    expect(rings.uniforms.uRingExposure.value).toBe(1);
    expect(rings.material.defines.HALO_INNER).toBe('1.288000');
    expect(rings.material.defines.THEBE_EXT_OUTER).toBe('3.650000');
  });

  it('advances time and moves the four shepherd markers', () => {
    const { rings } = createRings();
    rings.update(100);
    const before = Array.from(rings.shepherdPositions);
    expect(rings.uniforms.uTime.value).toBe(100);
    expect(rings.shepherdPositions.every(Number.isFinite)).toBe(true);

    rings.update(100.1);
    const after = Array.from(rings.shepherdPositions);
    expect(after).not.toEqual(before);
    expect(rings.uniforms.uRingInverseMatrix.value.elements.every(Number.isFinite)).toBe(
      true
    );
  });

  it('toggles the complete ring group', () => {
    const { rings } = createRings();
    rings.setVisible(false);
    expect(rings.group.visible).toBe(false);
    expect(rings.visible).toBe(false);
    rings.setVisible(true);
    expect(rings.group.visible).toBe(true);
  });
});
