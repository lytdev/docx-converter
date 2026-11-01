import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  define: { global: 'globalThis' },
  resolve: { alias: { '@napi-rs/canvas': '/src/modules/images/node-canvas-unavailable.ts', '../adapters/node/pdf-renderer.js': '/src/adapters/browser/node-pdf-unavailable.ts' } },
  build: { outDir: 'dist', emptyOutDir: false,
    lib: { entry: 'src/index.ts', name: 'DocxConvert', formats: ['es', 'umd'], fileName: format => format === 'es' ? 'docx-html.browser.js' : 'docx-html.umd.cjs' },
  },
});
