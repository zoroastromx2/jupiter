/**
 * AstroScale.js
 * Jovian physical constants from NASA/JPL planetary and satellite fact sheets.
 * Radii/distances are in kilometres at the 1-bar level; periods are in Earth days.
 */

export const JOVIAN_KM_PER_UNIT = 1000.0;
export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const MS_PER_DAY = 86400000.0;

/**
 * Jovian ring boundaries in Jupiter equatorial radii (R_J = 71,492 km).
 * The main ring and gossamer rings are dust sheets, not solid bodies.
 */
export const JOVIAN_RINGS = {
  HALO_INNER: 1.288,
  HALO_OUTER: 1.714,
  HALO_MAX_HEIGHT: 0.175,
  MAIN_INNER: 1.714,
  MAIN_OUTER: 1.806,
  MAIN_HALF_THICKNESS: 0.002,
  AMALTHEA_OUTER: 2.54,
  AMALTHEA_HALF_HEIGHT: 0.036,
  THEBE_OUTER: 3.16,
  THEBE_EXT_OUTER: 3.65,
  THEBE_HALF_HEIGHT: 0.062
};

export const CONSTANTS = {
  EARTH: {
    RADIUS_EQUATORIAL: 6378.137,
    RADIUS_POLAR: 6356.752,
    SUN_DISTANCE_KM: 149597870.7,
    ORBIT_ECCENTRICITY: 0.0167
  },
  JUPITER: {
    RADIUS_EQUATORIAL: 71492.0,
    RADIUS_POLAR: 66854.0,
    EQUATORIAL_RADIUS: 71492.0,
    POLAR_RADIUS: 66854.0,
    ROTATION_PERIOD_DAYS: 0.41354,
    AXIAL_TILT_DEG: 3.13,
    ORBIT_SEMI_MAJOR: 778479000.0,
    ORBIT_PERIOD: 4332.589,
    ORBIT_ECCENTRICITY: 0.0489,
    INCLINATION: 1.303,
    LAN: 100.464,
    LONGITUDE_PERIHELION: 14.7285,
    MEAN_ANOMALY_EPOCH: 19.6679,
    SUN_DISTANCE_KM: 778479000.0,
    RINGS: JOVIAN_RINGS,
    // IAU J2000 north pole in ecliptic coordinates (cardinal frame).
    POLE_ECLIPTIC: { X: -0.0146, Y: -0.0358, Z: 0.99925 }
  },
  IO: {
    RADIUS: 1821.6,
    ORBIT_SEMI_MAJOR: 421700.0,
    ORBIT_PERIOD: 1.769138,
    INCLINATION: 0.05,
    ECCENTRICITY: 0.0041,
    ORBIT_ECCENTRICITY: 0.0041,
    LAN: 43.977,
    MEAN_ANOMALY_EPOCH: 342.021
  },
  EUROPA: {
    RADIUS: 1560.8,
    ORBIT_SEMI_MAJOR: 671034.0,
    ORBIT_PERIOD: 3.551181,
    INCLINATION: 0.47,
    ECCENTRICITY: 0.009,
    ORBIT_ECCENTRICITY: 0.009,
    LAN: 219.106,
    MEAN_ANOMALY_EPOCH: 171.016
  },
  GANYMEDE: {
    RADIUS: 2634.1,
    ORBIT_SEMI_MAJOR: 1070412.0,
    ORBIT_PERIOD: 7.154553,
    INCLINATION: 0.2,
    ECCENTRICITY: 0.0013,
    ORBIT_ECCENTRICITY: 0.0013,
    LAN: 63.552,
    MEAN_ANOMALY_EPOCH: 317.54
  },
  CALLISTO: {
    RADIUS: 2410.3,
    ORBIT_SEMI_MAJOR: 1882709.0,
    ORBIT_PERIOD: 16.689018,
    INCLINATION: 0.19,
    ECCENTRICITY: 0.0074,
    ORBIT_ECCENTRICITY: 0.0074,
    LAN: 298.848,
    MEAN_ANOMALY_EPOCH: 181.408
  }
};

export const GALILEAN_MOON_IDS = ['IO', 'EUROPA', 'GANYMEDE', 'CALLISTO'];

export function calculateOblateness(radiusEq, radiusPolar) {
  if (radiusEq <= 0) throw new Error('Equatorial radius must be greater than zero.');
  return (radiusEq - radiusPolar) / radiusEq;
}

export function getEarthToJupiterRatio() {
  return CONSTANTS.JUPITER.RADIUS_EQUATORIAL / CONSTANTS.EARTH.RADIUS_EQUATORIAL;
}

/**
 * Scale a real measurement in kilometres into WebGL world units.
 */
export function toWebGLUnits(actualKm, scaleFactor = JOVIAN_KM_PER_UNIT) {
  if (scaleFactor <= 0) throw new Error('Scale factor must be greater than zero.');
  return actualKm / scaleFactor;
}

/**
 * Convert a Julian-style simulation date into days since the J2000 epoch.
 */
export function dateToDaysSinceEpoch(date) {
  return (date.getTime() - J2000_EPOCH_MS) / MS_PER_DAY;
}

/**
 * Create a reusable Date for a days-since-J2000 value.
 */
export function setDateFromDays(days, target = new Date()) {
  target.setTime(J2000_EPOCH_MS + days * MS_PER_DAY);
  return target;
}

export function daysToDate(days) {
  return setDateFromDays(days, new Date());
}

const SECONDS_PER_DAY = 86400.0;

/**
 * Mean circular orbital speed in km/s.
 */
export function calculateOrbitalVelocity(semiMajorAxisKm, orbitPeriodDays) {
  if (semiMajorAxisKm <= 0 || orbitPeriodDays <= 0) {
    throw new Error('Semi-major axis and orbital period must be greater than zero.');
  }
  return (2 * Math.PI * semiMajorAxisKm) / (orbitPeriodDays * SECONDS_PER_DAY);
}

export const ASTRONOMICAL_UNIT_KM = 149597870.7;

export function kilometersToAU(kilometers) {
  return kilometers / ASTRONOMICAL_UNIT_KM;
}
