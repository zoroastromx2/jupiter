attribute float aSize;
attribute vec3 aColor;

uniform float uPixelRatio;

varying vec3 vColor;

void main() {
  vColor = aColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * uPixelRatio;
}
