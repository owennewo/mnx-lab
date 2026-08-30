// The EMBED build face: `npm run build:embed` → dist/embed/mnx-lab.js — one
// script tag that registers the elements/ custom elements. Self-contained
// (Lit bundled): a host page adds the tag and uses <mnx-document-viewer>.
//
// LOAD-BEARING: Vite copies `public/` into outDir, which is what puts
// `smufl/` (metadata + Bravura) NEXT TO the artifact. The embed entry derives
// its asset base from its own script URL, so that adjacency is the mechanism
// behind "one script tag is enough" — do not prune the copy
// (roadmap/proposed/core-viewer-embedded-app.md). `npm run smoke:embed`
// serves this directory cross-origin and would fail if it went away.
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
    },
    rollupOptions: {
      // One source, two formats: the entry reads `import.meta.url` to locate
      // its own assets, which only the ESM output can carry. The IIFE build
      // legitimately compiles it away — that face uses
      // `document.currentScript.src` instead, and the code guards for both —
      // so the bundler's "replaced with an empty object" notice is expected,
      // not a defect to fix.
      onwarn(warning, defaultHandler) {
        if (warning.code === 'EMPTY_IMPORT_META') return;
        defaultHandler(warning);
      }
    }
  }
});
