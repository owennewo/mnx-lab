import { defineConfig } from 'vitest/config';
// 20 s, not vitest's 5 s: the frozen online-time-warp tests take about 5 s alone and
// overran the default under a loaded host (035's and 753e409e's landing gates).
export default defineConfig({ test: { include: ['test/**/*.test.ts', '../listen/test/**/*.test.ts'], testTimeout: 20000 } });
