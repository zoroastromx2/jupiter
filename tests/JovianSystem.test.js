import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CONSTANTS, JOVIAN_KM_PER_UNIT } from '../src/math/AstroScale.js';
import { JupiterSimulator } from '../src/core/JupiterSimulator.js';
import { GalileanMoonSimulator } from '../src/core/GalileanMoonSimulator.js';

function createSystem() {
  const scene = new THREE.Scene();
  const assets = {
    jupiterColor: null,
    jupiterNormal: null,
    jupiterClouds: null,
    ioColor: null,
    ioNormal: null,
    europaColor: null,
    europaNormal: null,
    ganymedeColor: null,
    ganymedeNormal: null,
    callistoColor: null,
    callistoNormal: null
  };

  const jupiter = new JupiterSimulator(scene, assets);
  const moons = ['IO', 'EUROPA', 'GANYMEDE', 'CALLISTO'].map(
    (id) => new GalileanMoonSimulator(jupiter, id, assets)
  );

  return { scene, jupiter, moons };
}

describe('Jovian system simulation', () => {
  it('scales the oblate Jupiter mesh by equatorial and polar radii', () => {
    const { jupiter } = createSystem();
    expect(jupiter.mesh.scale.x).toBeCloseTo(71.492, 6);
    expect(jupiter.mesh.scale.y).toBeCloseTo(66.854, 6);
    expect(jupiter.mesh.scale.z).toBeCloseTo(71.492, 6);
    expect(jupiter.group.name).toBe('JovianSystem');
  });

  it('applies the 3.13 degree IAU obliquity', () => {
    const { jupiter } = createSystem();
    const i = THREE.MathUtils.degToRad(CONSTANTS.JUPITER.INCLINATION);
    const lan = THREE.MathUtils.degToRad(CONSTANTS.JUPITER.LAN);
    const orbitalNormal = new THREE.Vector3(
      Math.sin(lan) * Math.sin(i),
      Math.cos(i),
      Math.cos(lan) * Math.sin(i)
    ).normalize();
    const tiltDegrees = THREE.MathUtils.radToDeg(
      Math.acos(THREE.MathUtils.clamp(jupiter.poleWorld.dot(orbitalNormal), -1, 1))
    );

    expect(tiltDegrees).toBeCloseTo(CONSTANTS.JUPITER.AXIAL_TILT_DEG, 1);
  });

  it('keeps each Galilean moon at its prescribed semi-major axis', () => {
    const { jupiter, moons } = createSystem();
    jupiter.update(345.6);

    for (let i = 0; i < moons.length; i += 1) {
      moons[i].update(345.6);
      const radius = moons[i].mesh.position.length();
      const expected = moons[i].semiMajorAxisScene;
      const e = moons[i].eccentricity;
      expect(radius).toBeGreaterThanOrEqual(expected * (1 - e) - 1e-6);
      expect(radius).toBeLessThanOrEqual(expected * (1 + e) + 1e-6);
    }
  });

  it('repeats moon positions after one orbital period', () => {
    const { scene, jupiter, moons } = createSystem();
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();

    jupiter.update(100);
    moons[0].update(100);
    scene.updateMatrixWorld(true);
    moons[0].mesh.getWorldPosition(first);

    const day = 100 + CONSTANTS.IO.ORBIT_PERIOD;
    jupiter.update(day);
    moons[0].update(day);
    scene.updateMatrixWorld(true);
    moons[0].mesh.getWorldPosition(second);

    expect(second.distanceTo(first)).toBeLessThan(1e-4);
  });

  it('synchronises the Jupiter uniforms with live moon world positions', () => {
    const { scene, jupiter, moons } = createSystem();
    const worldPosition = new THREE.Vector3();

    jupiter.update(500);
    for (const moon of moons) moon.update(500);
    scene.updateMatrixWorld(true);
    jupiter.updateMoonUniforms(moons);

    for (let i = 0; i < moons.length; i += 1) {
      moons[i].mesh.getWorldPosition(worldPosition);
      expect(jupiter.moonsPosition[i].distanceTo(worldPosition)).toBeLessThan(
        1e-6
      );
      expect(jupiter.moonsRadius[i]).toBeCloseTo(
        CONSTANTS[moons[i].id].RADIUS / JOVIAN_KM_PER_UNIT,
        6
      );
    }

    expect(jupiter.sunDirection.length()).toBeCloseTo(1, 8);
    expect(jupiter.uniforms.uIoFootprintAzimuth.value).toBeGreaterThanOrEqual(
      -Math.PI
    );
    expect(jupiter.uniforms.uIoFootprintAzimuth.value).toBeLessThanOrEqual(
      Math.PI
    );
  });

  it('tidally locks the local +Z axis toward Jupiter', () => {
    const { jupiter, moons } = createSystem();
    jupiter.update(220);
    moons[2].update(220);

    const expected = Math.atan2(
      -moons[2].mesh.position.x,
      -moons[2].mesh.position.z
    );
    expect(moons[2].mesh.rotation.y).toBeCloseTo(expected, 12);
  });
});
