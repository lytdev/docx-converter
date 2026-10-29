import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  define: { global: 'globalThis' },
  resolve: { alias: { '@napi-rs/canvas': '/src/modules/images/node-canvas-unavailable.ts' } },
  build: { outDir: 'dist', emptyOutDir: false,
    lib: { entry: 'src/index.ts', name: 'DocxHtml', formats: ['umd'], fileName: () => 'docx-html.umd.cjs' },
  },
});
