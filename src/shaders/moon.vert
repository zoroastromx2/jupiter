varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vTangentW;
varying vec3 vWorldPosition;
varying vec3 vLocalPos;

void main() {
  vUv = uv;
  vLocalPos = normalize(position);

  vec3 objectNormal = normalize(normal);
  vNormalW = normalize(mat3(modelMatrix) * objectNormal);

  vec3 tangent = cross(vec3(0.0, 1.0, 0.0), objectNormal);
  if (dot(tangent, tangent) < 1.0e-5) {
    tangent = vec3(1.0, 0.0, 0.0);
  }
  vTangentW = normalize(mat3(modelMatrix) * normalize(tangent));

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
