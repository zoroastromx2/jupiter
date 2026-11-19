/**
 * KeplerOrbit.js
 * Allocation-free Keplerian propagation used by Jupiter and the Galilean moons.
 * World basis: +Y is ecliptic north, the reference plane is XZ.
 */

export const TWO_PI = Math.PI * 2.0;
const DEG2RAD = Math.PI / 180.0;

export function degToRad(degrees) {
  return degrees * DEG2RAD;
}

export function normalizeRadians(angle) {
  return angle - Math.floor(angle / TWO_PI) * TWO_PI;
}

/**
 * Solve Kepler's equation M = E - e sin E with Newton-Raphson.
 */
export function solveKepler(meanAnomaly, eccentricity) {
  const e = Math.min(0.95, Math.max(0.0, eccentricity));
  const M = normalizeRadians(meanAnomaly);
  let E = e < 0.8 ? M : Math.PI;

  for (let i = 0; i < 10; i += 1) {
    const delta = (E - e * Math.sin(E) - M) / (1.0 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }

  return E;
}

export function meanAnomalyRadians(daysSinceEpoch, periodDays, epochDegrees) {
  const period = periodDays > 0 ? periodDays : 1.0;
  return epochDegrees * DEG2RAD + (daysSinceEpoch / period) * TWO_PI;
}

/**
 * Position on an inclined, noded Keplerian ellipse.
 * out must expose x, y and z properties (a THREE.Vector3 is ideal).
 */
export function orbitalPosition(
  semiMajorAxis,
  eccentricity,
  inclinationRad,
  lanRad,
  meanAnomaly,
  out,
  argumentOfPeriapsisRad = 0.0
) {
  const e = Math.min(0.95, Math.max(0.0, eccentricity));
  const E = solveKepler(meanAnomaly, e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const radius = semiMajorAxis * (1.0 - e * cosE);

  // True anomaly and argument of latitude in the orbital plane.
  const trueAnomaly = Math.atan2(Math.sqrt(1.0 - e * e) * sinE, cosE - e);
  const u = argumentOfPeriapsisRad + trueAnomaly;
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);

  // In-plane position, prograde about +Y.
  const xOrb = radius * cosU;
  const zOrb = -radius * sinU;

  const cosI = Math.cos(inclinationRad);
  const sinI = Math.sin(inclinationRad);
  const cosLan = Math.cos(lanRad);
  const sinLan = Math.sin(lanRad);

  // Rx(i) then Ry(LAN), matching a nested Object3D pivot hierarchy.
  const yTilted = -zOrb * sinI;
  const zTilted = zOrb * cosI;

  out.x = xOrb * cosLan + zTilted * sinLan;
  out.y = yTilted;
  out.z = -xOrb * sinLan + zTilted * cosLan;
  return out;
}

/**
 * Jupiter heliocentric position in world coordinates (km).
 * elements uses the orbital fields in AstroScale.CONSTANTS.JUPITER.
 */
export function jupiterHeliocentricPosition(daysSinceEpoch, elements, out) {
  const meanAnomaly =
    elements.MEAN_ANOMALY_EPOCH * DEG2RAD +
    (daysSinceEpoch / elements.ORBIT_PERIOD) * TWO_PI;
  const argumentOfPeriapsis =
    (elements.LONGITUDE_PERIHELION - elements.LAN) * DEG2RAD;

  orbitalPosition(
    elements.ORBIT_SEMI_MAJOR,
    elements.ORBIT_ECCENTRICITY,
    elements.INCLINATION * DEG2RAD,
    elements.LAN * DEG2RAD,
    meanAnomaly,
    out,
    argumentOfPeriapsis
  );

  // orbitalPosition already produces our world basis; no extra remap is needed.
  return out;
}
