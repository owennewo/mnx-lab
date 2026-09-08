import { GpBinaryReader } from './binary.js';

export function readBinaryMix(
  reader: GpBinaryReader, major: number, revision: number,
  label: string, warn: (message: string) => void
): number | null {
  const instrument = reader.readInt8(`${label} instrument`);
  if (major === 5) reader.skip(16, `${label} RSE instrument`);
  const controls = ['volume', 'balance', 'chorus', 'reverb', 'phaser', 'tremolo'];
  const values = controls.map(name => reader.readInt8(`${label} ${name}`));
  if (major === 5) reader.readIntByteSizeString(`${label} tempo name`);
  const tempo = reader.readInt32(`${label} tempo`);
  values.forEach((value, index) => {
    if (value >= 0) {
      reader.readUint8(`${label} ${controls[index]} duration`);
      warn(`${label}: ${controls[index]} mixer change is not represented.`);
    }
  });
  if (tempo >= 0) {
    const duration = reader.readUint8(`${label} tempo duration`);
    if (duration > 0) warn(`${label}: gradual tempo change imported as immediate.`);
    if (major === 5 && revision > 0) reader.readBool(`${label} hide tempo`);
  }
  if (major >= 4) reader.readUint8(`${label} mixer flags`);
  if (major === 5) {
    reader.readInt8(`${label} wah`);
    if (revision > 0) {
      reader.readIntByteSizeString(`${label} RSE effect`);
      reader.readIntByteSizeString(`${label} RSE category`);
    }
  }
  if (instrument >= 0) warn(`${label}: instrument change is not represented.`);
  return tempo >= 0 ? tempo : null;
}
