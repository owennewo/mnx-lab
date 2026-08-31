// The LIBRARY build face: `npm run build:lib` → dist/lib, consumed via the
// package.json exports map (mnx-lab, mnx-lab/model|engine|audio|elements).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist/lib',
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/entries/lib.ts',
        model: 'src/entries/lib/model.ts',
        engine: 'src/entries/lib/engine.ts',
        audio: 'src/entries/lib/audio.ts',
        elements: 'src/entries/lib/elements.ts'
      },
      formats: ['es']
    },
    rollupOptions: {
      // Consumers bring their own Lit; everything else is self-contained.
      external: [/^lit/, /^@lit\//]
    }
  }
});
