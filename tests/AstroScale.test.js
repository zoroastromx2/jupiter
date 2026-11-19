import { describe, expect, it } from 'vitest';
import {
  CONSTANTS,
  JOVIAN_RINGS,
  JOVIAN_KM_PER_UNIT,
  J2000_EPOCH_MS,
  MS_PER_DAY,
  calculateOblateness,
  dateToDaysSinceEpoch,
  setDateFromDays,
  toWebGLUnits
} from '../src/math/AstroScale.js';

describe('Jovian constants', () => {
  it('matches the Jovian radii, rotation and obliquity', () => {
    expect(CONSTANTS.JUPITER.RADIUS_EQUATORIAL).toBe(71492.0);
    expect(CONSTANTS.JUPITER.RADIUS_POLAR).toBe(66854.0);
    expect(CONSTANTS.JUPITER.EQUATORIAL_RADIUS).toBe(71492.0);
    expect(CONSTANTS.JUPITER.POLAR_RADIUS).toBe(66854.0);
    expect(CONSTANTS.JUPITER.ROTATION_PERIOD_DAYS).toBe(0.41354);
    expect(CONSTANTS.JUPITER.AXIAL_TILT_DEG).toBe(3.13);
  });

  it('matches all four Galilean moon elements', () => {
    const expected = {
      IO: [1821.6, 421700.0, 1.769138, 0.05, 0.0041],
      EUROPA: [1560.8, 671034.0, 3.551181, 0.47, 0.009],
      GANYMEDE: [2634.1, 1070412.0, 7.154553, 0.2, 0.0013],
      CALLISTO: [2410.3, 1882709.0, 16.689018, 0.19, 0.0074]
    };

    for (const [id, values] of Object.entries(expected)) {
      expect(CONSTANTS[id].RADIUS).toBe(values[0]);
      expect(CONSTANTS[id].ORBIT_SEMI_MAJOR).toBe(values[1]);
      expect(CONSTANTS[id].ORBIT_PERIOD).toBe(values[2]);
      expect(CONSTANTS[id].INCLINATION).toBe(values[3]);
      expect(CONSTANTS[id].ECCENTRICITY).toBe(values[4]);
      expect(CONSTANTS[id].MEAN_ANOMALY_EPOCH).toBeTypeOf('number');
    }
  });

  it('derives Jupiter oblateness of about 0.06487', () => {
    const flattening = calculateOblateness(
      CONSTANTS.JUPITER.RADIUS_EQUATORIAL,
      CONSTANTS.JUPITER.RADIUS_POLAR
    );
    expect(flattening).toBeCloseTo(0.06487, 4);
  });

  it('matches the four Jovian dust-ring boundaries in R_J', () => {
    expect(JOVIAN_RINGS.HALO_INNER).toBe(1.288);
    expect(JOVIAN_RINGS.HALO_OUTER).toBe(1.714);
    expect(JOVIAN_RINGS.HALO_MAX_HEIGHT).toBe(0.175);
    expect(JOVIAN_RINGS.MAIN_INNER).toBe(1.714);
    expect(JOVIAN_RINGS.MAIN_OUTER).toBe(1.806);
    expect(JOVIAN_RINGS.MAIN_HALF_THICKNESS).toBe(0.002);
    expect(JOVIAN_RINGS.AMALTHEA_OUTER).toBe(2.54);
    expect(JOVIAN_RINGS.AMALTHEA_HALF_HEIGHT).toBe(0.036);
    expect(JOVIAN_RINGS.THEBE_OUTER).toBe(3.16);
    expect(JOVIAN_RINGS.THEBE_EXT_OUTER).toBe(3.65);
    expect(JOVIAN_RINGS.THEBE_HALF_HEIGHT).toBe(0.062);
    expect(CONSTANTS.JUPITER.RINGS).toBe(JOVIAN_RINGS);
  });

  it('scales kilometres into scene units', () => {
    expect(JOVIAN_KM_PER_UNIT).toBe(1000);
    expect(toWebGLUnits(71492)).toBeCloseTo(71.492, 6);
    expect(toWebGLUnits(421700)).toBeCloseTo(421.7, 6);
  });

  it('round-trips the J2000 epoch', () => {
    expect(dateToDaysSinceEpoch(new Date(J2000_EPOCH_MS))).toBe(0);
    const date = setDateFromDays(365.5);
    expect(date.getTime()).toBe(J2000_EPOCH_MS + 365.5 * MS_PER_DAY);
  });
});
