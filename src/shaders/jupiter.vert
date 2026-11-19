uniform float uRadiusEq;
uniform float uRadiusPolar;

varying vec3 vLocalPos;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTangent;

void main() {
  vLocalPos = normalize(position);
  vUv = uv;

  // The mesh is a unit sphere scaled by (R_eq, R_pol, R_eq). The ellipsoid
  // normal is S^-1 * s in local space; remove the scale from the model matrix
  // so only its rotation reaches the normal.
  vec3 ellipsoidNormal = normalize(
    vec3(
      position.x / uRadiusEq,
      position.y / uRadiusPolar,
      position.z / uRadiusEq
    )
  );

  mat3 model = mat3(modelMatrix);
  vec3 columnScale = vec3(
    length(model[0]),
    length(model[1]),
    length(model[2])
  );
  mat3 rotationOnly = mat3(
    model[0] / columnScale.x,
    model[1] / columnScale.y,
    model[2] / columnScale.z
  );

  vNormal = normalize(rotationOnly * ellipsoidNormal);

  vec3 tangent = cross(vec3(0.0, 1.0, 0.0), vLocalPos);
  if (dot(tangent, tangent) < 1.0e-5) {
    tangent = vec3(1.0, 0.0, 0.0);
  }
  vTangent = normalize(rotationOnly * tangent);

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
