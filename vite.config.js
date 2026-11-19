import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr', '**/*.vert', '**/*.frag'],
  server: {
    port: 3000,
    host: true,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
        }
      }
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js']
  }
});
