import { expect, it } from 'vitest';
import { DEFAULT_LAYERS, normalizeLayers } from '../../apps/studio/src/scorePreferences.ts';

// The Mix panel's levels, kept per piece: the synth's own level joined the recording's and the click's.
it("keeps the synth's level with the other layers, defaulting to full and refusing what is not a level", () => {
  expect(DEFAULT_LAYERS.synthLevel).toBe(1);
  expect(normalizeLayers({ synth: true, click: false, clickLevel: 0.6, recordingLevel: 1 }).synthLevel).toBe(1);
  expect(normalizeLayers({ synthLevel: 0.35 }).synthLevel).toBe(0.35);
  expect(normalizeLayers({ synthLevel: 1.5 }).synthLevel).toBe(1);
  expect(normalizeLayers({ synthLevel: 'loud' }).synthLevel).toBe(1);
});
