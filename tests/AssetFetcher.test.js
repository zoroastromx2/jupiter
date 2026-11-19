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

class FakeGLTFLoader {
  constructor({ fail = false } = {}) {
    this.urls = [];
    this.fail = fail;
  }

  load(url, onLoad, _onProgress, onError) {
    this.urls.push(url);
    queueMicrotask(() => {
      if (this.fail) {
        onError(new Error(`missing ${url}`));
        return;
      }
      onLoad({
        scene: new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshBasicMaterial()
        )
      });
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

describe('AssetFetcher probe models', () => {
  it('loads one probe model on demand and caches it', async () => {
    const gltfLoader = new FakeGLTFLoader();
    const fetcher = new AssetFetcher({ gltfLoader, baseUrl: '/jupiter/' });

    const first = await fetcher.loadProbeModel('pioneer11');
    const second = await fetcher.loadProbeModel('pioneer11');

    expect(first).toBe(second);
    expect(gltfLoader.urls).toEqual(['/jupiter/models/pioneer_11.glb']);
    expect(fetcher.assets.models.pioneer11).toBe(first);
  });

  it('shares one in-flight request between concurrent calls', async () => {
    const gltfLoader = new FakeGLTFLoader();
    const fetcher = new AssetFetcher({ gltfLoader, baseUrl: '/' });

    const [left, right] = await Promise.all([
      fetcher.loadProbeModel('voyager1'),
      fetcher.loadProbeModel('voyager1')
    ]);

    expect(left).toBe(right);
    expect(gltfLoader.urls).toEqual(['/models/voyager_1.glb']);
  });

  it('returns null for unknown keys and retries after a failed load', async () => {
    const gltfLoader = new FakeGLTFLoader({ fail: true });
    const fetcher = new AssetFetcher({ gltfLoader, baseUrl: '/' });

    expect(await fetcher.loadProbeModel('unknown')).toBeNull();
    expect(gltfLoader.urls).toEqual([]);

    expect(await fetcher.loadProbeModel('pioneer11')).toBeNull();
    expect(await fetcher.loadProbeModel('pioneer11')).toBeNull();
    expect(gltfLoader.urls).toEqual([
      '/models/pioneer_11.glb',
      '/models/pioneer_11.glb'
    ]);
  });
});
