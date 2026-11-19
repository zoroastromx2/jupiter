import * as THREE from 'three';

const COLOR_ASSETS = new Set([
  'jupiterColor',
  'ioColor',
  'europaColor',
  'ganymedeColor',
  'callistoColor'
]);

function createFlatNormalTexture() {
  const texture = new THREE.DataTexture(
    new Uint8Array([128, 128, 255, 255]),
    1,
    1,
    THREE.RGBAFormat
  );
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createNeutralTexture(value = 0) {
  const texture = new THREE.DataTexture(
    new Uint8Array([value, value, value, 255]),
    1,
    1,
    THREE.RGBAFormat
  );
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createFallbackColor() {
  const texture = new THREE.DataTexture(
    new Uint8Array([178, 146, 112, 255]),
    1,
    1,
    THREE.RGBAFormat
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const ASSET_SPECS = [
  { key: 'jupiterColor', file: 'textures/jupiter_color.jpg', optional: false },
  { key: 'jupiterNormal', file: 'textures/jupiter_normal.jpg', optional: true },
  { key: 'jupiterClouds', file: 'textures/jupiter_clouds.jpg', optional: true },
  { key: 'ioColor', file: 'textures/io_color.jpg', optional: false },
  { key: 'ioNormal', file: 'textures/io_normal.jpg', optional: true },
  { key: 'europaColor', file: 'textures/europa_color.jpg', optional: false },
  { key: 'europaNormal', file: 'textures/europa_normal.jpg', optional: true },
  { key: 'ganymedeColor', file: 'textures/ganymede_color.jpg', optional: false },
  { key: 'ganymedeNormal', file: 'textures/ganymede_normal.jpg', optional: true },
  { key: 'callistoColor', file: 'textures/callisto_color.jpg', optional: false },
  { key: 'callistoNormal', file: 'textures/callisto_normal.jpg', optional: true }
];

/**
 * Texture pipeline for the Jovian system. Albedo maps are authored in sRGB;
 * normals, cloud masks and any scalar data maps stay linear.
 */
export class AssetFetcher {
  constructor(options = {}) {
    this.textureLoader = options.textureLoader || new THREE.TextureLoader();
    this.maxAnisotropy = Math.max(1, options.maxAnisotropy ?? 1);
    this.onProgress = options.onProgress ?? null;
    this.baseUrl =
      options.baseUrl ??
      (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
        ? import.meta.env.BASE_URL
        : '/');
    this.assets = {
      jupiterColor: null,
      jupiterNormal: null,
      jupiterClouds: null,
      ioColor: null,
      ioNormal: null,
      europaColor: null,
      europaNormal: null,
      ganymedeColor: null,
      ganymedeNormal: null,
      callistoColor: null,
      callistoNormal: null
    };
  }

  assetUrl(relativePath) {
    const base = this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`;
    return `${base}${relativePath}`;
  }

  configureTexture(texture, colorSpace) {
    texture.colorSpace = colorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = this.maxAnisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  loadTexture(spec) {
    const colorSpace = COLOR_ASSETS.has(spec.key)
      ? THREE.SRGBColorSpace
      : THREE.LinearSRGBColorSpace;

    return new Promise((resolve) => {
      this.textureLoader.load(
        this.assetUrl(spec.file),
        (texture) => {
          this.configureTexture(texture, colorSpace);
          resolve(texture);
        },
        undefined,
        () => {
          if (spec.optional) {
            resolve(null);
          } else {
            const fallback = COLOR_ASSETS.has(spec.key)
              ? createFallbackColor()
              : createNeutralTexture(128);
            this.configureTexture(fallback, colorSpace);
            resolve(fallback);
          }
        }
      );
    });
  }

  async loadAll() {
    let settled = 0;
    const total = ASSET_SPECS.length;

    const promises = ASSET_SPECS.map(async (spec) => {
      const texture = await this.loadTexture(spec);
      settled += 1;
      this.onProgress?.(settled / total);
      return [spec.key, texture];
    });

    const results = await Promise.all(promises);

    for (let i = 0; i < results.length; i += 1) {
      const [key, texture] = results[i];
      this.assets[key] = texture;
    }

    const flatNormal = createFlatNormalTexture();
    const neutralClouds = createNeutralTexture(0);

    if (!this.assets.jupiterNormal) this.assets.jupiterNormal = flatNormal;
    if (!this.assets.jupiterClouds) this.assets.jupiterClouds = neutralClouds;
    if (!this.assets.ioNormal) this.assets.ioNormal = flatNormal;
    if (!this.assets.europaNormal) this.assets.europaNormal = flatNormal;
    if (!this.assets.ganymedeNormal) this.assets.ganymedeNormal = flatNormal;
    if (!this.assets.callistoNormal) this.assets.callistoNormal = flatNormal;

    this.onProgress?.(1);
    return this.assets;
  }
}

export { ASSET_SPECS };
