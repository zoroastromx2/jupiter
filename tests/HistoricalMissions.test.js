import { describe, expect, it } from 'vitest';
import {
  MISSIONS,
  MISSION_ORDER,
  MISSION_PLANET_LABELS
} from '../src/data/HistoricalMissions.js';

const JOVIAN_KEYS = [
  'pioneer10',
  'pioneer11',
  'voyager1',
  'voyager2',
  'galileo',
  'juno'
];

function radialDistance([x, y, z]) {
  return Math.hypot(x, y, z);
}

describe('Historical mission catalogue', () => {
  it('groups Saturn legacy keys and the six Jovian missions by planet', () => {
    expect(Object.keys(MISSIONS)).toEqual(['SATURN', 'JUPITER']);
    expect(MISSION_ORDER.SATURN).toEqual([
      'pioneer11',
      'voyager1',
      'voyager2',
      'cassiniInsertion',
      'huygens',
      'cassiniGrandFinale'
    ]);
    expect(MISSION_ORDER.JUPITER).toEqual(JOVIAN_KEYS);
    expect(MISSION_PLANET_LABELS).toEqual({
      SATURN: 'Misiones a Saturno',
      JUPITER: 'Misiones a Júpiter'
    });

    for (const key of MISSION_ORDER.SATURN) {
      expect(MISSIONS.SATURN[key].key).toBe(key);
      expect(MISSIONS.SATURN[key].planet).toBe('SATURN');
      expect(MISSIONS.SATURN[key].available).toBe(false);
    }
  });

  it('stores the six Jovian missions with the requested epochs and optics', () => {
    const expected = {
      pioneer10: ['1973-12-04T02:26:00Z', 1, 'pioneer_glb'],
      pioneer11: ['1974-12-03T05:21:19Z', 1, 'pioneer_glb'],
      voyager1: ['1979-03-05T12:05:26Z', 2, 'voyager'],
      voyager2: ['1979-07-09T22:29:00Z', 2, 'voyager'],
      galileo: ['1995-12-07T22:04:00Z', 3, 'galileo'],
      juno: ['2016-08-27T12:51:00Z', 4, 'juno']
    };

    for (const key of JOVIAN_KEYS) {
      const mission = MISSIONS.JUPITER[key];
      expect(mission.available).toBe(true);
      expect(mission.planet).toBe('JUPITER');
      expect(mission.timestamp).toBe(expected[key][0]);
      expect(mission.opticsMode).toBe(expected[key][1]);
      expect(mission.model).toBe(expected[key][2]);
      expect(mission.controlPoints.length).toBeGreaterThan(5);
      expect(mission.milestones).toHaveLength(3);
      expect(mission.peakT).toBe(0.5);
    }
  });

  it('defines the requested periapsis distances in Jupiter radii', () => {
    expect(
      Math.min(
        ...MISSIONS.JUPITER.pioneer10.controlPoints.map(radialDistance)
      )
    ).toBeCloseTo(2.85, 1);
    expect(
      Math.min(
        ...MISSIONS.JUPITER.pioneer11.controlPoints.map(radialDistance)
      )
    ).toBeCloseTo(1.6, 1);
    expect(
      Math.min(
        ...MISSIONS.JUPITER.voyager1.controlPoints.map(radialDistance)
      )
    ).toBeCloseTo(4.88, 1);
    expect(
      Math.min(
        ...MISSIONS.JUPITER.voyager2.controlPoints.map(radialDistance)
      )
    ).toBeCloseTo(10.1, 1);
    expect(
      Math.min(...MISSIONS.JUPITER.galileo.controlPoints.map(radialDistance))
    ).toBeCloseTo(4.0, 1);
    expect(
      Math.min(...MISSIONS.JUPITER.juno.controlPoints.map(radialDistance))
    ).toBeCloseTo(1.06, 2);
  });

  it('keeps milestones ordered with valid optical targets', () => {
    const validTargets = new Set([
      'JUPITER',
      'JUPITER_RINGS',
      'IO',
      'EUROPA',
      'GANYMEDE',
      'CALLISTO'
    ]);

    for (const key of JOVIAN_KEYS) {
      let previousT = -1;
      for (const milestone of MISSIONS.JUPITER[key].milestones) {
        expect(milestone.t).toBeGreaterThan(previousT);
        expect(milestone.t).toBeLessThanOrEqual(1);
        expect(validTargets.has(milestone.targetKey)).toBe(true);
        expect(milestone.defaultFov).toBeGreaterThan(0);
        expect(milestone.instrumentName.length).toBeGreaterThan(0);
        previousT = milestone.t;
      }
    }
  });

  it('contains the Galileo dual trajectory and the Juno polar offsets', () => {
    const galileo = MISSIONS.JUPITER.galileo;
    expect(galileo.probeControlPoints.length).toBeGreaterThan(3);
    expect(radialDistance(galileo.probeControlPoints[0])).toBeCloseTo(3.0, 2);
    expect(
      radialDistance(galileo.probeControlPoints.at(-1))
    ).toBeCloseTo(1.01, 1);
    expect(galileo.probeFadeT).toBe(0.65);

    const juno = MISSIONS.JUPITER.juno;
    expect(juno.milestones[0].targetOffset).toEqual([0, 0.95, 0]);
    expect(juno.milestones[2].targetOffset).toEqual([0, -0.95, 0]);
    expect(MISSIONS.JUPITER.pioneer11.milestones[2].targetOffset).toEqual([
      0, 0.9, 0
    ]);
  });
});
