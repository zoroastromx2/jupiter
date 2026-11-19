import * as THREE from 'three';
import starVert from '../shaders/starfield.vert?raw';
import starFrag from '../shaders/starfield.frag?raw';

const STAR_COUNT = 3200;
const STAR_RADIUS = 40000;

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export class StarfieldSimulator {
  constructor(scene) {
    const random = mulberry32(0x4a555049);
    const pixelRatio =
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const color = new THREE.Color();

    for (let i = 0; i < STAR_COUNT; i += 1) {
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const radius = STAR_RADIUS * (0.92 + random() * 0.08);

      positions[i * 3] = radius * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = radius * cosPhi;
      positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);

      const temperature = random();
      if (temperature < 0.14) {
        color.setRGB(0.72, 0.82, 1.0);
      } else if (temperature < 0.32) {
        color.setRGB(1.0, 0.92, 0.78);
      } else if (temperature < 0.45) {
        color.setRGB(1.0, 0.78, 0.58);
      } else {
        color.setRGB(0.94, 0.96, 1.0);
      }

      const brightness = 0.35 + Math.pow(random(), 3.2) * 0.9;
      colors[i * 3] = color.r * brightness;
      colors[i * 3 + 1] = color.g * brightness;
      colors[i * 3 + 2] = color.b * brightness;
      sizes[i] = 1.1 + Math.pow(random(), 4.0) * 3.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(pixelRatio, 2) }
      },
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.name = 'Starfield';
    this.points.frustumCulled = false;
    scene?.add(this.points);
  }

  setPixelRatio(pixelRatio) {
    this.material.uniforms.uPixelRatio.value = Math.min(pixelRatio, 2);
  }
}
