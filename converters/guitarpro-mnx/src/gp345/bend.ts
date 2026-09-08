import { GpBinaryReader } from './binary.js';
import { GpifBend } from '../gpif/document.js';

/** Documented GP3–5 bend record, also used by GP4/5 tremolo bars. */
export function readBinaryBend(
  reader: GpBinaryReader,
  label: string,
  warn: (message: string) => void
): GpifBend {
  reader.readInt8(`${label} type`);
  reader.readInt32(`${label} peak`);
  const count = reader.readInt32(`${label} point count`);
  if (count < 0 || count > 100_000 || count > Math.floor(reader.remaining / 9)) {
    throw new Error(`${label}: invalid bend point count ${count} at 0x${reader.offset.toString(16)}`);
  }
  const points: { position: number; alter: number }[] = [];
  let lastPosition = -1;
  let hasVibrato = false;
  for (let index = 0; index < count; index++) {
    const position = reader.readInt32(`${label} point ${index + 1} position`);
    const value = reader.readInt32(`${label} point ${index + 1} value`);
    hasVibrato = reader.readBool(`${label} point ${index + 1} vibrato`) || hasVibrato;
    if (position < lastPosition || position < 0 || position > 60) {
      throw new Error(`${label}: invalid bend position ${position} at 0x${reader.offset.toString(16)}`);
    }
    lastPosition = position;
    points.push({ position: position / 60, alter: value / 50 });
  }
  if (hasVibrato) warn(`${label}: bend-point vibrato is not represented.`);
  return {
    points,
    originValue: null,
    originOffset: null,
    middleValue: null,
    middleOffset1: null,
    middleOffset2: null,
    destinationValue: null,
    destinationOffset: null
  };
}
