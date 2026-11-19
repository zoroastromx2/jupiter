import { describe, expect, it } from 'vitest';
import { CONSTANTS } from '../src/math/AstroScale.js';
import {
  TWO_PI,
  jupiterHeliocentricPosition,
  meanAnomalyRadians,
  orbitalPosition,
  solveKepler
} from '../src/math/KeplerOrbit.js';

function seededPosition(position) {
  return { x: position.x, y: position.y, z: position.z };
}

describe('Keplerian propagation', () => {
  it('solves Kepler equation to high precision', () => {
    for (const e of [0, 0.0013, 0.0041, 0.009, 0.0489]) {
      for (const meanAnomaly of [0, 0.4, 1.7, 3.9, 5.8]) {
        const E = solveKepler(meanAnomaly, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(meanAnomaly, 9);
      }
    }
  });

  it('produces a circular orbit with a constant radius', () => {
    const out = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 12; i += 1) {
      orbitalPosition(100, 0, 0, 0, (i / 12) * TWO_PI, out, 0);
      expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(100, 9);
      expect(out.y).toBeCloseTo(0, 12);
    }
  });

  it('repeats after one orbital period', () => {
    const position = { x: 0, y: 0, z: 0 };
    const config = CONSTANTS.EUROPA;
    const meanAnomaly = meanAnomalyRadians(
      123.4,
      config.ORBIT_PERIOD,
      config.MEAN_ANOMALY_EPOCH
    );
    orbitalPosition(
      config.ORBIT_SEMI_MAJOR,
      config.ORBIT_ECCENTRICITY,
      0.008,
      0.3,
      meanAnomaly,
      position
    );
    const first = seededPosition(position);

    const laterAnomaly = meanAnomalyRadians(
      123.4 + config.ORBIT_PERIOD,
      config.ORBIT_PERIOD,
      config.MEAN_ANOMALY_EPOCH
    );
    orbitalPosition(
      config.ORBIT_SEMI_MAJOR,
      config.ORBIT_ECCENTRICITY,
      0.008,
      0.3,
      laterAnomaly,
      position
    );

    expect(position.x).toBeCloseTo(first.x, 6);
    expect(position.y).toBeCloseTo(first.y, 6);
    expect(position.z).toBeCloseTo(first.z, 6);
  });

  it('places the Galilean inclinations above the equatorial plane', () => {
    const out = { x: 0, y: 0, z: 0 };
    orbitalPosition(100, 0, 0.05 * (Math.PI / 180), 0.7, 1.2, out, 0);
    expect(Math.abs(out.y)).toBeGreaterThan(0);
  });

  it('keeps Jupiter between perihelion and aphelion', () => {
    const out = { x: 0, y: 0, z: 0 };
    const q = CONSTANTS.JUPITER.ORBIT_SEMI_MAJOR *
      (1 - CONSTANTS.JUPITER.ORBIT_ECCENTRICITY);
    const Q = CONSTANTS.JUPITER.ORBIT_SEMI_MAJOR *
      (1 + CONSTANTS.JUPITER.ORBIT_ECCENTRICITY);

    for (let day = 0; day < 5000; day += 137) {
      jupiterHeliocentricPosition(day, CONSTANTS.JUPITER, out);
      const distance = Math.hypot(out.x, out.y, out.z);
      expect(distance).toBeGreaterThanOrEqual(q - 1);
      expect(distance).toBeLessThanOrEqual(Q + 1);
    }
  });
});
