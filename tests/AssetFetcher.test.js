import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AssetFetcher } from '../src/core/AssetFetcher.js';

class FakeTextureLoader {
  constructor(missingNormals = false) {
    this.missingNormals = missingNormals;
  }

  load(url, onLoad, _onProgress, onError) {
    queueMicrotask(() => {
      if (this.missingNormals && url.includes('normal')) {
        onError(new Error(`missing ${url}`));
      } else {
        onLoad({ sourceUrl: url });
      }
    });
  }
}

describe('AssetFetcher', () => {
  it('loads every Jovian map with the correct color space', async () => {
    const progress = [];
    const fetcher = new AssetFetcher({
      textureLoader: new FakeTextureLoader(false),
      baseUrl: '/assets/',
      onProgress: (value) => progress.push(value)
    });

    const assets = await fetcher.loadAll();

    expect(assets.jupiterColor.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(assets.ioColor.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(assets.jupiterNormal.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(assets.jupiterClouds.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(assets.ganymedeNormal.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(1);
  });

  it('falls back to a flat linear normal when a secondary map is missing', async () => {
    const fetcher = new AssetFetcher({
      textureLoader: new FakeTextureLoader(true)
    });

    const assets = await fetcher.loadAll();

    expect(assets.jupiterNormal.isDataTexture).toBe(true);
    expect(assets.jupiterNormal.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(assets.callistoNormal.isDataTexture).toBe(true);
    expect(assets.ioColor.isDataTexture).toBeUndefined();
  });
});
