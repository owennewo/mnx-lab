/** Single HTTP byte ranges. Multiple/unknown units are ignored (full response). */
export type AudioRange = { status: 200; offset: 0; length: number }
  | { status: 206; offset: number; length: number }
  | { status: 416; offset: 0; length: 0 };
export function audioRange(header: string | undefined, size: number): AudioRange {
  const full: AudioRange = { status: 200, offset: 0, length: size };
  const invalid: AudioRange = { status: 416, offset: 0, length: 0 };
  if (!header || !header.startsWith('bytes=') || header.includes(',')) return full;
  if (header.length > 256) return invalid;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return invalid;
  const first = match[1] ? Number(match[1]) : undefined;
  const last = match[2] ? Number(match[2]) : undefined;
  if ((first !== undefined && !Number.isSafeInteger(first)) || (last !== undefined && !Number.isSafeInteger(last))) return invalid;
  if (first === undefined) {
    if (!last) return invalid;
    const length = Math.min(size, last);
    return { status: 206, offset: size - length, length };
  }
  if (first >= size || (last !== undefined && last < first)) return invalid;
  const end = Math.min(size - 1, last ?? size - 1);
  return { status: 206, offset: first, length: end - first + 1 };
}
