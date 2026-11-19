import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MissionSimulator } from '../src/core/MissionSimulator.js';

function createSimulator() {
  return new MissionSimulator(
    new THREE.Scene(),
    {},
    new THREE.PerspectiveCamera(),
    {}
  );
}

describe('MissionSimulator playback mapping', () => {
  it('maps the milestone peak time to the computed periapsis parameter', () => {
    const simulator = createSimulator();
    simulator.periapsisU = 0.2;
    simulator.activeMission = { peakT: 0.5 };

    expect(simulator.mapMissionTimeToCurveU(0)).toBe(0);
    expect(simulator.mapMissionTimeToCurveU(0.25)).toBeCloseTo(0.1, 10);
    expect(simulator.mapMissionTimeToCurveU(0.5)).toBeCloseTo(0.2, 10);
    expect(simulator.mapMissionTimeToCurveU(0.75)).toBeCloseTo(0.6, 10);
    expect(simulator.mapMissionTimeToCurveU(1)).toBe(1);
  });

  it('builds a complete probe visual without renderer state', () => {
    const simulator = createSimulator();
    expect(simulator.probeGroup).toBeTruthy();
    expect(simulator.instrumentMount).toBeTruthy();
    expect(simulator.probeModels.pioneer).toBeTruthy();
    expect(simulator.probeModels.voyager1).toBeTruthy();
    expect(simulator.probeModels.voyager2).toBeTruthy();
    expect(simulator.probeModels.galileo).toBeTruthy();
    expect(simulator.probeModels.juno).toBeTruthy();
    expect(simulator.galileoProbeMesh).toBeTruthy();
  });
});
