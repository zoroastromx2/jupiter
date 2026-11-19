uniform vec3 uSunDirection;
uniform vec3 uJupiterRadius;
uniform float uTime;
uniform float uRingExposure;
uniform mat4 uRingInverseMatrix;

varying vec3 vWorldPosition;

const float PI = 3.141592653589793;
const float G = 0.86;
const float SUN_ANGULAR_RADIUS = 0.00465;

float interleavedGradientNoise(vec2 pixel) {
  return fract(
    52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715)))
  );
}

float hgPhase(float cosTheta) {
  float g2 = G * G;
  float denominator = max(1.0 + g2 - 2.0 * G * cosTheta, 0.0001);
  return (1.0 - g2) / (4.0 * PI * pow(denominator, 1.5));
}

/**
 * Bounding cylinder in Jupiter's tilted equatorial frame.
 */
bool intersectBoundingCylinder(
  vec3 ro,
  vec3 rd,
  float radius,
  float halfHeight,
  out float tNear,
  out float tFar
) {
  tNear = 0.0;
  tFar = 1.0e7;

  float radialA = dot(rd.xz, rd.xz);
  float radialC = dot(ro.xz, ro.xz) - radius * radius;

  if (radialA > 1.0e-8) {
    float radialB = 2.0 * dot(ro.xz, rd.xz);
    float discriminant = radialB * radialB - 4.0 * radialA * radialC;
    if (discriminant < 0.0) return false;

    float root = sqrt(discriminant);
    float t0 = (-radialB - root) / (2.0 * radialA);
    float t1 = (-radialB + root) / (2.0 * radialA);
    tNear = max(tNear, t0);
    tFar = min(tFar, t1);
  } else if (radialC > 0.0) {
    return false;
  }

  if (abs(rd.y) > 1.0e-8) {
    float t0 = (-halfHeight - ro.y) / rd.y;
    float t1 = (halfHeight - ro.y) / rd.y;
    if (t0 > t1) {
      float swap = t0;
      t0 = t1;
      t1 = swap;
    }
    tNear = max(tNear, t0);
    tFar = min(tFar, t1);
  } else if (abs(ro.y) > halfHeight) {
    return false;
  }

  return tFar > tNear;
}

/**
 * Clip the ring march at the entry point of Jupiter's oblate spheroid.
 */
void clipAtJupiter(vec3 ro, vec3 rd, inout float tFar) {
  vec3 roN = ro / uJupiterRadius;
  vec3 rdN = rd / uJupiterRadius;

  float a = dot(rdN, rdN);
  if (a < 1.0e-12) return;

  float b = 2.0 * dot(roN, rdN);
  float c = dot(roN, roN) - 1.0;
  float discriminant = b * b - 4.0 * a * c;
  if (discriminant <= 0.0) return;

  float entry = (-b - sqrt(discriminant)) / (2.0 * a);
  if (entry > 0.0) tFar = min(tFar, entry);
}

/**
 * Soft shadow cast by Jupiter's oblate body. The Sun's finite angular radius
 * gives the ring a narrow penumbral transition.
 */
float jupiterShadow(vec3 p, vec3 sunLocal) {
  vec3 pN = p / uJupiterRadius;
  vec3 sN = sunLocal / uJupiterRadius;

  float a = dot(sN, sN);
  float b = 2.0 * dot(pN, sN);
  float c = dot(pN, pN) - 1.0;
  float closestT = -b / (2.0 * a);
  float closestDistance = sqrt(max(c - b * b / (4.0 * a), 0.0));
  float penumbra = max(
    0.004,
    length(p) * SUN_ANGULAR_RADIUS / uJupiterRadius.y
  );
  float obstructed = 1.0 - smoothstep(
    1.0 - penumbra,
    1.0 + penumbra,
    closestDistance
  );

  return mix(1.0, 1.0 - obstructed, step(0.0, closestT));
}

float boxVerticalProfile(float h, float halfHeight) {
  float core = 1.0 - smoothstep(halfHeight * 0.9, halfHeight, h);
  float edge = exp(
    -pow((h - halfHeight * 0.82) / (halfHeight * 0.12), 2.0)
  );
  return core * (1.0 + 0.25 * edge);
}

/**
 * Multi-component dust density in Jupiter equatorial radii.
 */
float sampleJovianRingDensity(vec3 p) {
  float r = length(p.xz) / uJupiterRadius.x;
  float h = abs(p.y) / uJupiterRadius.x;
  float azimuth = atan(p.z, p.x);

  // Halo: an electromagnetic torus with a teardrop/lens vertical section.
  float haloInner = smoothstep(HALO_INNER, HALO_INNER + 0.035, r);
  float haloOuter = 1.0 - smoothstep(HALO_OUTER - 0.03, HALO_OUTER, r);
  float haloRadial = haloInner * haloOuter;
  float haloBulge = exp(-pow((r - 1.45) / 0.18, 2.0));
  float haloSigma = max(0.03, HALO_MAX_HEIGHT * haloBulge);
  float haloVertical = exp(-pow(h / haloSigma, 2.0));
  float haloDrift =
    0.92 + 0.08 * sin(azimuth * 4.0 + uTime * 0.045 + r * 9.0);
  float halo = haloRadial * haloVertical * haloDrift * 0.0008;

  // Main ring: sharp dust sheet with fine ringlets and a faint Metis gap.
  float mainInner = smoothstep(MAIN_INNER, MAIN_INNER + 0.004, r);
  float mainOuter = 1.0 - smoothstep(MAIN_OUTER - 0.004, MAIN_OUTER, r);
  float mainRadial = mainInner * mainOuter;
  float ringlets =
    0.9 +
    0.06 * sin(r * 260.0 + 1.3) +
    0.03 * sin(r * 94.0 - 2.1);
  ringlets *=
    1.0 - 0.5 * exp(-pow((r - 1.758) / 0.0025, 2.0));
  float mainVertical = exp(-pow(h / MAIN_HALF_THICKNESS, 2.0));
  float mainRing = mainRadial * ringlets * mainVertical * 0.0065;

  // Amalthea gossamer: rectangular vertical box ending at Amalthea's orbit.
  float amaltheaInner = smoothstep(MAIN_OUTER, MAIN_OUTER + 0.045, r);
  float amaltheaOuter = 1.0 - smoothstep(
    AMALTHEA_OUTER - 0.08,
    AMALTHEA_OUTER - 0.02,
    r
  );
  float amaltheaRadial = amaltheaInner * amaltheaOuter;
  float amaltheaVertical = boxVerticalProfile(h, AMALTHEA_HALF_HEIGHT);
  float amalthea = amaltheaRadial * amaltheaVertical * 0.00052;

  // Thebe gossamer and its faint outward extension.
  float thebeInner = smoothstep(
    AMALTHEA_OUTER + 0.02,
    AMALTHEA_OUTER + 0.07,
    r
  );
  float thebeOuter = 1.0 - smoothstep(
    THEBE_OUTER - 0.09,
    THEBE_OUTER - 0.02,
    r
  );
  float thebeRadial = thebeInner * thebeOuter;
  float thebeVertical = boxVerticalProfile(h, THEBE_HALF_HEIGHT);
  float thebe = thebeRadial * thebeVertical * 0.00036;

  float extensionInner = smoothstep(
    THEBE_OUTER + 0.02,
    THEBE_OUTER + 0.08,
    r
  );
  float extensionOuter = 1.0 - smoothstep(
    THEBE_EXT_OUTER - 0.25,
    THEBE_EXT_OUTER,
    r
  );
  float extensionRadial = extensionInner * extensionOuter;
  float thebeExtension = extensionRadial * thebeVertical * 0.00012;

  return halo + mainRing + amalthea + thebe + thebeExtension;
}

void main() {
  vec3 ro = (uRingInverseMatrix * vec4(cameraPosition, 1.0)).xyz;
  vec3 worldPoint = (uRingInverseMatrix * vec4(vWorldPosition, 1.0)).xyz;
  vec3 rd = normalize(worldPoint - ro);
  vec3 sunLocal = normalize(
    (uRingInverseMatrix * vec4(uSunDirection, 0.0)).xyz
  );

  float cylinderRadius = THEBE_EXT_OUTER * uJupiterRadius.x;
  float cylinderHalfHeight = HALO_MAX_HEIGHT * 1.2 * uJupiterRadius.x;
  float tNear;
  float tFar;

  if (!intersectBoundingCylinder(
    ro,
    rd,
    cylinderRadius,
    cylinderHalfHeight,
    tNear,
    tFar
  )) {
    discard;
  }

  clipAtJupiter(ro, rd, tFar);
  if (tFar <= tNear) discard;

  const int STEP_COUNT = 10;
  float dt = (tFar - tNear) / float(STEP_COUNT);
  float jitter = interleavedGradientNoise(gl_FragCoord.xy);
  float cosTheta = dot(sunLocal, rd);
  float phase = hgPhase(cosTheta);
  float tPlane = 1.0e7;
  bool hasPlaneCrossing = abs(rd.y) > 1.0e-6;
  if (hasPlaneCrossing) {
    tPlane = -ro.y / rd.y;
    hasPlaneCrossing = tPlane > tNear && tPlane < tFar;
  }

  vec3 scattered = vec3(0.0);

  for (int i = 0; i < STEP_COUNT; i++) {
    float t = tNear + (float(i) + jitter) * dt;
    if (i == 0 && hasPlaneCrossing) t = tPlane;
    vec3 p = ro + rd * t;
    float density = sampleJovianRingDensity(p);
    if (density <= 0.00005) continue;

    float r = length(p.xz) / uJupiterRadius.x;
    float haloBlend = 1.0 - smoothstep(
      HALO_OUTER - 0.02,
      MAIN_OUTER + 0.05,
      r
    );
    vec3 dustColor = mix(
      vec3(1.05, 0.85, 0.68),
      vec3(0.78, 0.86, 1.02),
      haloBlend
    );

    float sunVisibility = jupiterShadow(p, sunLocal);
    float jupiterDayPhase = max(dot(normalize(p), sunLocal), 0.0);
    float bounce = pow(1.0 / max(r, 1.2), 2.2) * jupiterDayPhase * 0.22;
    vec3 bounceColor = vec3(1.0, 0.82, 0.62) * bounce;

    vec3 sampleLight =
      dustColor * (0.08 + phase * 0.38) * sunVisibility +
      bounceColor;

    scattered += sampleLight * density * dt;
  }

  gl_FragColor = vec4(scattered * uRingExposure, 1.0);
}
