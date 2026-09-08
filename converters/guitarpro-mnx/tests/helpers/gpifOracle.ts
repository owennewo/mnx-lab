import { expect } from 'vitest';
import { importGuitarPro } from '../../src/import/gp.js';
import { extractScoreGpif } from '../../src/gpif/container.js';
import { parseGpif } from '../../src/gpif/document.js';

/** Correct only alphaTab's materialization of source-proven absent voice slots.
 * Never discard a voice merely because its imported content consists of rests. */
export function importGpifOracle(data: Uint8Array) {
  const historical = importGuitarPro(data);
  const source = parseGpif(extractScoreGpif(data));
  historical.parts.forEach((part, trackIndex) => part.measures.forEach((measure, index) => {
    const bar = source.bars.get(source.masterBars[index].barIds[trackIndex])!;
    measure.sequences = measure.sequences!.filter(sequence => {
      const slot = Number(sequence.voice!.slice(1)) - 1;
      const voiceId = bar.voiceIds[slot];
      const occupied = voiceId >= 0 && (source.voices.get(voiceId)?.beatIds.length ?? 0) > 0;
      if (!occupied) expect(sequence.content).toEqual([{ duration: { base: 'quarter' }, rest: {} }]);
      return occupied;
    });
  }));
  return historical;
}
