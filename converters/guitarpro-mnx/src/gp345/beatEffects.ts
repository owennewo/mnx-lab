import { GpBinaryReader } from './binary.js';
import { readBinaryBend } from './bend.js';

export function readBinaryBeatEffects(
  reader: GpBinaryReader, major: number, label: string, warn: (message: string) => void
): { vibrato: boolean; harmonicType: string | null } {
  const first = reader.readUint8(`${label} beat effects 1`);
  const second = major >= 4 ? reader.readUint8(`${label} beat effects 2`) : 0;
  if (first & 0x20) {
    reader.readUint8(`${label} slap/tap kind`);
    if (major === 3) reader.skip(4, `${label} legacy effect value`);
    warn(`${label}: slap/tap or legacy tremolo-bar effect is not represented.`);
  }
  if (second & 0x04) {
    readBinaryBend(reader, `${label} tremolo bar`, warn);
    warn(`${label}: tremolo bar is not represented.`);
  }
  if (first & 0x40) {
    reader.skip(2, `${label} brush speeds`);
    warn(`${label}: brush direction and speed are not represented.`);
  }
  if (second & 0x02) {
    reader.readUint8(`${label} pick direction`);
    warn(`${label}: pick stroke is not represented.`);
  }
  if (first & 0x10) warn(`${label}: fade-in is not represented.`);
  if (second & 0x01) warn(`${label}: rasgueado is not represented.`);
  if (first & 0x02) warn(`${label}: wide beat vibrato is not represented.`);
  return {
    vibrato: major === 3 && Boolean(first & 0x01),
    harmonicType: major === 3 ? (first & 0x04 ? 'Natural' : first & 0x08 ? 'Artificial' : null) : null
  };
}
