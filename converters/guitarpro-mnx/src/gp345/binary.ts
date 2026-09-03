/**
 * Sequential reader for the legacy Guitar Pro 3/4/5 binary family.
 *
 * The format is little-endian and uses three distinct length-prefixed string
 * shapes. Keeping them named here is intentional: confusing IntSizeString
 * with IntByteSizeString moves the cursor by one byte and corrupts everything
 * after it without necessarily failing near the cause.
 */
export class GpBinaryReader {
  private readonly view: DataView;
  private readonly decoder = new TextDecoder('windows-1252');
  private cursor = 0;

  constructor(private readonly data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get offset(): number {
    return this.cursor;
  }

  get remaining(): number {
    return this.data.length - this.cursor;
  }

  readUint8(label = 'byte'): number {
    this.require(1, label);
    return this.view.getUint8(this.cursor++);
  }

  readInt8(label = 'signed byte'): number {
    this.require(1, label);
    return this.view.getInt8(this.cursor++);
  }

  readUint16(label = 'short'): number {
    this.require(2, label);
    const value = this.view.getUint16(this.cursor, true);
    this.cursor += 2;
    return value;
  }

  readInt16(label = 'signed short'): number {
    this.require(2, label);
    const value = this.view.getInt16(this.cursor, true);
    this.cursor += 2;
    return value;
  }

  readUint32(label = 'integer'): number {
    this.require(4, label);
    const value = this.view.getUint32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  readInt32(label = 'signed integer'): number {
    this.require(4, label);
    const value = this.view.getInt32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  readFloat32(label = 'float'): number {
    this.require(4, label);
    const value = this.view.getFloat32(this.cursor, true);
    this.cursor += 4;
    return value;
  }

  readFloat64(label = 'double'): number {
    this.require(8, label);
    const value = this.view.getFloat64(this.cursor, true);
    this.cursor += 8;
    return value;
  }

  readBool(label = 'boolean'): boolean {
    return this.readUint8(label) !== 0;
  }

  readBytes(length: number, label = 'bytes'): Uint8Array {
    this.requireLength(length, label);
    this.require(length, label);
    const value = this.data.subarray(this.cursor, this.cursor + length);
    this.cursor += length;
    return value;
  }

  /** Skip a documented field which MNX deliberately does not consume. */
  skip(length: number, label: string): void {
    this.readBytes(length, label);
  }

  /** Byte length followed by exactly that many characters. */
  readByteSizeString(label: string): string;
  /**
   * Byte length followed by a fixed-width character field. The version header
   * uses a 30-byte field regardless of the string's actual length.
   */
  readByteSizeString(label: string, fieldSize: number): string;
  readByteSizeString(label: string, fieldSize?: number): string {
    const length = this.readUint8(`${label} length`);
    if (fieldSize !== undefined && length > fieldSize) {
      throw this.error(`${label} length ${length} exceeds its ${fieldSize}-byte field`);
    }
    const bytes = this.readBytes(fieldSize ?? length, label);
    return this.decode(bytes.subarray(0, length));
  }

  /** Four-byte length followed by exactly that many characters. */
  readIntSizeString(label: string): string {
    const length = this.readInt32(`${label} length`);
    this.requireLength(length, label);
    return this.decode(this.readBytes(length, label));
  }

  /**
   * Four-byte (character length + 1), then byte character length, then text.
   * This is the common GP3–5 score-information/text encoding.
   */
  readIntByteSizeString(label: string): string {
    const outerLength = this.readInt32(`${label} outer length`);
    this.requireLength(outerLength, label);
    if (outerLength === 0) return '';

    const length = this.readUint8(`${label} length`);
    if (outerLength !== length + 1) {
      throw this.error(
        `${label} length mismatch: outer length ${outerLength}, byte length ${length}`
      );
    }
    return this.decode(this.readBytes(length, label));
  }

  private decode(bytes: Uint8Array): string {
    return this.decoder.decode(bytes);
  }

  private requireLength(length: number, label: string): void {
    if (!Number.isSafeInteger(length) || length < 0) {
      throw this.error(`${label} has invalid length ${length}`);
    }
  }

  private require(length: number, label: string): void {
    if (this.cursor + length > this.data.length) {
      throw this.error(
        `${label} needs ${length} byte${length === 1 ? '' : 's'}, only ${this.remaining} remain`
      );
    }
  }

  private error(message: string): Error {
    return new Error(`Guitar Pro binary at 0x${this.cursor.toString(16)}: ${message}`);
  }
}
