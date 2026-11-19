import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MissionSimulator } from '../src/core/MissionSimulator.js';
import { MISSIONS } from '../src/data/HistoricalMissions.js';

function createSimulator() {
  return new MissionSimulator(
    new THREE.Scene(),
    {},
    new THREE.PerspectiveCamera(),
    {}
  );
}

function createProbeSource() {
  return new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial()
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

  it('replaces a fallback probe with a loaded model', () => {
    const simulator = createSimulator();
    const fallback = simulator.probeModels.pioneer;
    expect(fallback.name).toBe('PioneerFallback');

    simulator.activeMission = MISSIONS.JUPITER.pioneer10;
    simulator.refreshProbeVisibility();

    const wrapper = simulator.applyProbeModel(
      'pioneer11',
      createProbeSource()
    );

    expect(wrapper.name).toBe('PioneerModelWrapper');
    expect(wrapper.userData.glb).toBe(true);
    expect(simulator.probeModels.pioneer).toBe(wrapper);
    expect(fallback.parent).toBeNull();
    expect(wrapper.visible).toBe(true);
    expect(wrapper.parent).toBe(simulator.probeVisual);
  });

  it('keeps one wrapper when the same model is applied twice', () => {
    const simulator = createSimulator();
    simulator.activeMission = MISSIONS.JUPITER.pioneer11;

    const source = createProbeSource();
    const first = simulator.applyProbeModel('pioneer11', source);
    const second = simulator.applyProbeModel('pioneer11', source);

    expect(second).toBe(first);
    expect(
      simulator.probeVisual.children.filter(
        (child) => child.name === 'PioneerModelWrapper'
      )
    ).toHaveLength(1);
  });

  it('keeps a loaded model hidden when another mission is active', () => {
    const simulator = createSimulator();
    simulator.activeMission = MISSIONS.JUPITER.juno;
    simulator.refreshProbeVisibility();

    const wrapper = simulator.applyProbeModel(
      'voyager1',
      createProbeSource()
    );

    expect(wrapper.visible).toBe(false);
  });

  it('ignores unknown model keys and empty sources', () => {
    const simulator = createSimulator();
    const source = createProbeSource();

    expect(simulator.applyProbeModel('unknown', source)).toBeNull();
    expect(simulator.applyProbeModel('pioneer11', null)).toBeNull();
  });

  it('maps normalized timeline positions back to days since J2000', () => {
    const simulator = createSimulator();
    simulator.activeMission = MISSIONS.JUPITER.juno;

    const peakDays = simulator.getDaysSinceEpochForU(0.5);
    const northPoleDays = simulator.getDaysSinceEpochForU(0.2);

    expect(peakDays - northPoleDays).toBeCloseTo(2.4 / 24, 10);
  });
});
