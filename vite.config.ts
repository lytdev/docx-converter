import { defineConfig } from 'vite';
export default defineConfig({ base: './', define: { global: 'globalThis' }, resolve: { alias: [
  { find: '@napi-rs/canvas', replacement: '/src/modules/images/node-canvas-unavailable.ts' },
  // MathJax's source build imports its default font through this private
  // specifier. Map it to STIX Two so the unused NewCM font data is not shipped.
  { find: /^#default-font\//, replacement: '@mathjax/mathjax-stix2-font/js/' },
] }, build: { outDir: 'dist-demo', target: 'es2020' } });
