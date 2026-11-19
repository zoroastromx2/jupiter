import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { StarfieldSimulator } from '../src/core/StarfieldSimulator.js';

function firstPositions(simulator, count = 9) {
  return Array.from(
    simulator.points.geometry.attributes.position.array.slice(0, count)
  );
}

describe('StarfieldSimulator', () => {
  it('builds the star field without a browser window', () => {
    const scene = new THREE.Scene();
    const simulator = new StarfieldSimulator(scene);

    expect(simulator.points.name).toBe('Starfield');
    expect(simulator.points.geometry.attributes.position.count).toBe(3200);
    expect(scene.children).toContain(simulator.points);
    expect(simulator.material.uniforms.uPixelRatio.value).toBe(1);
  });

  it('is deterministic across instances', () => {
    const first = new StarfieldSimulator(null);
    const second = new StarfieldSimulator(null);

    expect(firstPositions(second)).toEqual(firstPositions(first));
  });

  it('clamps the pixel ratio to the supported range', () => {
    const simulator = new StarfieldSimulator(null);

    simulator.setPixelRatio(1.5);
    expect(simulator.material.uniforms.uPixelRatio.value).toBe(1.5);

    simulator.setPixelRatio(3);
    expect(simulator.material.uniforms.uPixelRatio.value).toBe(2);
  });
});
