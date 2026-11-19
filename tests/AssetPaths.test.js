import { describe, expect, it } from 'vitest';
import { AssetFetcher, resolveAssetUrl } from '../src/core/AssetFetcher.js';

class RecordingTextureLoader {
  constructor() {
    this.urls = [];
  }

  load(url, onLoad) {
    this.urls.push(url);
    queueMicrotask(() => onLoad({ sourceUrl: url }));
  }
}

class RecordingGLTFLoader {
  constructor() {
    this.urls = [];
  }

  load(url, onLoad) {
    this.urls.push(url);
    queueMicrotask(() => onLoad({ scene: {} }));
  }
}

describe('asset URL resolution', () => {
  it('supports local, root-relative and public-prefixed paths under a Pages base', () => {
    expect(resolveAssetUrl('textures/jupiter_color.jpg', '/jupiter/')).toBe(
      '/jupiter/textures/jupiter_color.jpg'
    );
    expect(resolveAssetUrl('/models/pioneer_11.glb', '/jupiter/')).toBe(
      '/jupiter/models/pioneer_11.glb'
    );
    expect(resolveAssetUrl('./public/textures/io_color.jpg', '/jupiter/')).toBe(
      '/jupiter/textures/io_color.jpg'
    );
    expect(resolveAssetUrl('data/minor_moons.json', '/jupiter/')).toBe(
      '/jupiter/data/minor_moons.json'
    );
  });

  it('leaves external and inline URLs untouched', () => {
    expect(resolveAssetUrl('https://example.com/map.hdr', '/jupiter/')).toBe(
      'https://example.com/map.hdr'
    );
    expect(resolveAssetUrl('data:text/plain,ephemeris', '/jupiter/')).toBe(
      'data:text/plain,ephemeris'
    );
    expect(resolveAssetUrl('blob:https://example.com/id', '/jupiter/')).toBe(
      'blob:https://example.com/id'
    );
  });

  it('resolves every texture and model through the configured base', async () => {
    const textureLoader = new RecordingTextureLoader();
    const gltfLoader = new RecordingGLTFLoader();
    const fetcher = new AssetFetcher({
      textureLoader,
      gltfLoader,
      baseUrl: '/jupiter/'
    });

    await fetcher.loadAll();
    await fetcher.loadProbeModels();

    expect(textureLoader.urls).toContain('/jupiter/textures/jupiter_color.jpg');
    expect(textureLoader.urls).toContain('/jupiter/textures/callisto_normal.jpg');
    expect(gltfLoader.urls).toEqual([
      '/jupiter/models/pioneer_11.glb',
      '/jupiter/models/voyager_1.glb',
      '/jupiter/models/voyager_2.glb'
    ]);
    expect([...textureLoader.urls, ...gltfLoader.urls].every((url) => url.startsWith('/jupiter/'))).toBe(true);
  });
});
