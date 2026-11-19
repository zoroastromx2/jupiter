uniform sampler2D tColor;
uniform sampler2D tNormal;

uniform vec3 uSunDirection;
uniform vec3 uJupiterCenter;
uniform vec3 uJupiterPole;
uniform float uJupiterRadiusEq;
uniform float uJupiterRadiusPolar;
uniform float uSunIntensity;
uniform float uNormalStrength;
uniform float uAlbedoBoost;
uniform float uBounceIntensity;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vTangentW;
varying vec3 vWorldPosition;
varying vec3 vLocalPos;

/**
 * Ray vs Jupiter's oblate ellipsoid. The ray starts at the moon fragment and
 * points at the Sun. When the closest approach lies ahead and inside the disk,
 * Jupiter's shadow falls on the moon.
 */
float jupiterEclipse(vec3 surfacePosition, vec3 sunDir) {
  vec3 pole = normalize(uJupiterPole);
  vec3 rel = surfacePosition - uJupiterCenter;

  float relAxis = dot(rel, pole);
  vec3 relRadial = rel - pole * relAxis;

  float dirAxis = dot(sunDir, pole);
  vec3 dirRadial = sunDir - pole * dirAxis;

  float invEq2 = 1.0 / (uJupiterRadiusEq * uJupiterRadiusEq);
  float invPolar2 = 1.0 / (uJupiterRadiusPolar * uJupiterRadiusPolar);

  float A = dot(dirRadial, dirRadial) * invEq2 + dirAxis * dirAxis * invPolar2;
  float B = 2.0 * (
    dot(relRadial, dirRadial) * invEq2 +
    relAxis * dirAxis * invPolar2
  );
  float C =
    dot(relRadial, relRadial) * invEq2 +
    relAxis * relAxis * invPolar2 -
    1.0;

  float closestT = -B / (2.0 * A);
  float closestDistance = sqrt(max(C - B * B / (4.0 * A), 0.0));

  float penumbra = max(
    0.008,
    length(rel) * 0.00465 / uJupiterRadiusPolar
  );
  float inFront = step(0.0, closestT);

  return inFront * (1.0 - smoothstep(1.0 - penumbra, 1.0 + penumbra, closestDistance));
}

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 tangent = normalize(vTangentW - normal * dot(normal, vTangentW));
  vec3 bitangent = cross(normal, tangent);

  vec3 normalSample = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
  normal = normalize(
    normal + (tangent * normalSample.x + bitangent * normalSample.y) * uNormalStrength
  );

  vec3 albedo = texture2D(tColor, vUv).rgb * uAlbedoBoost;
  vec3 sunDir = normalize(uSunDirection);
  float ndl = max(dot(normal, sunDir), 0.0);
  float lit = smoothstep(-0.06, 0.13, ndl);

  float eclipse = jupiterEclipse(vWorldPosition, sunDir);
  float directLight = lit * (1.0 - eclipse);

  vec3 toJupiter = normalize(uJupiterCenter - vWorldPosition);
  float jupiterPhase = max(dot(-toJupiter, sunDir), 0.0);
  float bounce = max(dot(normal, toJupiter), 0.0) * jupiterPhase * uBounceIntensity;

  vec3 color = albedo * (
    vec3(0.014, 0.017, 0.024) +
    vec3(1.0, 0.985, 0.95) * (directLight * uSunIntensity + bounce)
  );

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  color += vec3(0.04, 0.07, 0.12) * rim * (0.15 + 0.85 * directLight);

  gl_FragColor = vec4(color, 1.0);
}
