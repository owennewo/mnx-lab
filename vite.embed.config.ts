// The EMBED build face: `npm run build:embed` → dist/embed/mnx-lab.js — one
// script tag that registers the elements/ custom elements. Self-contained
// (Lit bundled): a host page adds the tag and uses <mnx-score-viewer>.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist/embed',
    emptyOutDir: true,
    lib: {
      entry: 'src/entries/embed.ts',
      name: 'MnxLab',
      formats: ['iife', 'es'],
      fileName: format => (format === 'iife' ? 'mnx-lab.js' : 'mnx-lab.esm.js')
    }
  }
});
