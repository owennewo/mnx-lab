// Small independent byte reader for the bounded SMF tests. Not a musical oracle.
export interface ReadMidiEvent {
  tick: number;
  status: number;
  data: number[];
  metaType?: number;
}
export function readMidi(bytes: Uint8Array): {
  format: number;
  ppq: number;
  tracks: ReadMidiEvent[][];
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  const need = (n: number) => {
    if (at + n > bytes.length) throw Error('Truncated MIDI');
  };
  const byte = () => {
    need(1);
    return bytes[at++];
  };
  const u16 = () => {
    need(2);
    const value = view.getUint16(at);
    at += 2;
    return value;
  };
  const u32 = () => {
    need(4);
    const value = view.getUint32(at);
    at += 4;
    return value;
  };
  const tag = () => String.fromCharCode(byte(), byte(), byte(), byte());
  const variable = () => {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = byte();
      value = value * 128 + (b & 127);
      if (!(b & 128)) return value;
    }
    throw Error('Invalid MIDI VLQ');
  };
  if (tag() !== 'MThd' || u32() !== 6) throw Error('Invalid MIDI header');
  const format = u16(),
    count = u16(),
    ppq = u16();
  if (ppq & 0x8000) throw Error('SMPTE unsupported');
  const tracks: ReadMidiEvent[][] = [];
  for (let t = 0; t < count; t++) {
    if (tag() !== 'MTrk') throw Error('Missing MIDI track');
    const length = u32(),
      stop = at + length;
    need(length);
    const events: ReadMidiEvent[] = [];
    let tick = 0,
      running = 0;
    while (at < stop) {
      tick += variable();
      let status = byte();
      if (status < 128) {
        if (!running) throw Error('Missing running status');
        at--;
        status = running;
      }
      if (status === 255) {
        const metaType = byte(),
          length = variable();
        need(length);
        const data = [...bytes.slice(at, at + length)];
        at += length;
        events.push({ tick, status, metaType, data });
        running = 0;
      } else if (status === 240 || status === 247) {
        const length = variable();
        need(length);
        at += length;
        running = 0;
      } else {
        running = status;
        const size = status >> 4 === 12 || status >> 4 === 13 ? 1 : 2;
        const data = Array.from({ length: size }, byte);
        if (data.some((b) => b > 127)) throw Error('Invalid MIDI data byte');
        events.push({ tick, status, data });
      }
    }
    if (at !== stop || events.at(-1)?.metaType !== 47) throw Error('Track length/end mismatch');
    tracks.push(events);
  }
  if (at !== bytes.length) throw Error('Trailing MIDI data');
  return { format, ppq, tracks };
}
