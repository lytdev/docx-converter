import { defineConfig } from 'vite';
export default defineConfig({ base: './', define: { global: 'globalThis' }, resolve: { alias: { '@napi-rs/canvas': '/src/modules/images/node-canvas-unavailable.ts' } }, build: { outDir: 'dist-demo' } });
