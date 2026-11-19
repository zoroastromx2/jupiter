varying vec3 vColor;

void main() {
  float radius = length(gl_PointCoord - vec2(0.5));
  float core = smoothstep(0.5, 0.04, radius);
  if (core <= 0.001) discard;
  gl_FragColor = vec4(vColor * core, core);
}
