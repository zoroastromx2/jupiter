uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tClouds;

uniform vec3 uSunDirection;
uniform float uTime;
uniform float uDaysSinceEpoch;
uniform float uAuroraIntensity;
uniform float uIoFootprintAzimuth;

uniform vec3 uMoonsPosition[4];
uniform float uMoonsRadius[4];

varying vec3 vLocalPos;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTangent;

const float TWO_PI = 6.283185307179586;
const float SUN_ANGULAR_RADIUS = 0.00465;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);

  float a = hash12(cell);
  float b = hash12(cell + vec2(1.0, 0.0));
  float c = hash12(cell + vec2(0.0, 1.0));
  float d = hash12(cell + vec2(1.0, 1.0));

  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float noise3(vec3 p) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);

  float n000 = hash13(cell);
  float n100 = hash13(cell + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(cell + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(cell + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(cell + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(cell + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(cell + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(cell + vec3(1.0, 1.0, 1.0));

  return mix(
    mix(mix(n000, n100, local.x), mix(n010, n110, local.x), local.y),
    mix(mix(n001, n101, local.x), mix(n011, n111, local.x), local.y),
    local.z
  );
}

float fbm2(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += noise2(p) * amplitude;
    p = p * 2.03 + vec2(11.7, 4.9);
    amplitude *= 0.5;
  }
  return value;
}

float fbm3(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += noise3(p) * amplitude;
    p = p * 2.01 + vec3(7.1, 13.2, 3.7);
    amplitude *= 0.5;
  }
  return value;
}

/**
 * Analytical Galilean transit shadows on the cloud tops.
 * The penumbra is driven by the moon-Jupiter distance, matching the finite
 * angular size of the Sun. Io and Europa are smaller than the solar image at
 * Jupiter, so their shadow cores retain a small amount of light.
 */
float galileanTransitShadow(vec3 worldPosition, vec3 sunDir) {
  float light = 1.0;

  for (int i = 0; i < 4; i++) {
    float moonRadius = uMoonsRadius[i];
    vec3 oc = worldPosition - uMoonsPosition[i];
    float b = dot(oc, sunDir);

    if (b < 0.0) {
      float distanceToMoon = length(oc);
      float penumbra = max(moonRadius * 0.02, distanceToMoon * SUN_ANGULAR_RADIUS);
      float perpendicular = sqrt(max(dot(oc, oc) - b * b, 0.0));

      if (perpendicular < moonRadius + penumbra) {
        float coverage = 1.0 - smoothstep(
          moonRadius - penumbra,
          moonRadius + penumbra,
          perpendicular
        );
        float maximumOccultation = max(
          0.32,
          clamp((moonRadius * moonRadius) / (penumbra * penumbra), 0.0, 1.0)
        );

        light *= 1.0 - coverage * maximumOccultation * 0.97;
        if (light < 0.01) break;
      }
    }
  }

  return light;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 tangent = normalize(vTangent - normal * dot(normal, vTangent));
  vec3 bitangent = cross(normal, tangent);
  vec3 sunDir = normalize(uSunDirection);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  float latitude = asin(clamp(vLocalPos.y, -1.0, 1.0));
  float longitude = atan(vLocalPos.z, vLocalPos.x);
  float cosLatitude = cos(latitude);
  float poleGuard = 1.0 - smoothstep(0.78, 0.99, abs(vLocalPos.y));

  // Differential zonal flow: the shear is strongest at mid-latitudes and
  // fades toward the poles, where a 3D eddy field keeps the UVs from pinching.
  float zonalShear =
    sin(latitude * 12.0) * 0.018 +
    sin(latitude * 30.0 + 0.7) * 0.0045;
  float flow = uTime * 0.0026 + zonalShear * (0.2 + 0.8 * cosLatitude);

  vec3 eddyCoord =
    vLocalPos * vec3(3.1, 7.4, 3.1) +
    vec3(uTime * 0.010, 0.0, uDaysSinceEpoch * 0.0004);
  float eddies = fbm3(eddyCoord) - 0.5;

  vec2 uv = vUv;
  uv.x += flow + eddies * 0.013 * poleGuard;

  // Great Red Spot: a slowly rotating vortex centred on the map's storm.
  // The mask lives in texture space so it travels with the advected albedo.
  vec2 grsCenter = vec2(0.158, 0.406);
  vec2 grsDelta = uv - grsCenter;
  grsDelta.x = fract(grsDelta.x + 0.5) - 0.5;

  vec2 grsMetric = vec2(grsDelta.x, grsDelta.y * 2.15);
  float grsDistance = length(grsMetric);
  float grsMask = 1.0 - smoothstep(0.028, 0.082, grsDistance);
  float grsAngle = grsMask * (1.15 + 0.35 * sin(uTime * 0.35));
  float grsCos = cos(grsAngle);
  float grsSin = sin(grsAngle);
  mat2 grsRotation = mat2(grsCos, -grsSin, grsSin, grsCos);
  vec2 grsSwirled = grsCenter + (grsRotation * grsDelta) * (0.88 + 0.12 * grsMask);
  uv = mix(uv, grsSwirled, grsMask * 0.72);

  vec2 sampleUv = vec2(uv.x, clamp(uv.y, 0.0, 1.0));

  float cloudDetail = texture2D(tClouds, sampleUv).r;
  vec3 normalSample = texture2D(tNormal, sampleUv).xyz * 2.0 - 1.0;
  normal = normalize(
    normal + (tangent * normalSample.x + bitangent * normalSample.y) * 0.10
  );

  vec3 albedo = texture2D(tColor, sampleUv).rgb;
  float luminance = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
  albedo = mix(vec3(luminance), albedo, 1.38);
  albedo *= vec3(1.07, 1.0, 0.9);
  albedo *= 0.84;
  albedo *= 0.94 + 0.14 * cloudDetail;

  // A subtle red collar keeps the storm readable without fighting the map.
  albedo = mix(albedo, albedo * vec3(1.52, 0.58, 0.4), grsMask * 0.48);
  albedo *= 1.0 - 0.12 * grsMask * smoothstep(0.035, 0.085, grsDistance);

  float transitShadow = galileanTransitShadow(vWorldPosition, sunDir);
  float ndl = dot(normal, sunDir);
  float dayLight = smoothstep(-0.10, 0.12, ndl);

  vec3 sunColor = vec3(1.0, 0.975, 0.92);
  vec3 ambient = vec3(0.012, 0.016, 0.026);
  vec3 color = albedo * (ambient + sunColor * (1.22 * dayLight * transitShadow));

  // Thin scattering rim, strongest at the day limb.
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
  color += vec3(0.16, 0.30, 0.55) * fresnel * (0.08 + 0.62 * dayLight) * 0.38;

  // Polar auroral ovals (62 deg - 75 deg) with corotating curtains.
  float absY = abs(vLocalPos.y);
  float auroraBand =
    smoothstep(0.878, 0.895, absY) *
    (1.0 - smoothstep(0.960, 0.974, absY));
  float nightSide = 1.0 - smoothstep(-0.08, 0.22, ndl);

  if (auroraBand > 0.001 && nightSide > 0.001) {
    vec2 ringCoord = vec2(cos(longitude), sin(longitude));
    float curtainNoise =
      fbm2(ringCoord * 4.2 + vec2(absY * 18.0, uTime * 0.032));
    curtainNoise += 0.55 * fbm2(
      ringCoord * 9.3 + vec2(absY * 37.0, -uTime * 0.055)
    );
    curtainNoise /= 1.55;

    float curtain = smoothstep(0.46, 0.72, curtainNoise) * auroraBand;
    float longitudeDelta = atan(
      sin(longitude - uIoFootprintAzimuth),
      cos(longitude - uIoFootprintAzimuth)
    );
    float ioFootprint =
      exp(-pow(longitudeDelta / 0.075, 2.0)) *
      exp(-pow((absY - 0.924) / 0.021, 2.0));

    vec3 auroraEmission =
      vec3(0.20, 0.50, 2.0) * curtain * 0.62 +
      vec3(1.75, 0.26, 1.30) * ioFootprint * 1.25;

    color += auroraEmission * nightSide * uAuroraIntensity;
  }

  gl_FragColor = vec4(color, 1.0);
}
