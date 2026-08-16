/** Transport for one serialized selection clip. The first implementation is
 * intentionally memory-only, but the async string contract keeps copy/cut
 * ordering independent of that transport choice. */
export interface SelectionClipboardStore {
  write(serialized: string): Promise<void>;
  read(): Promise<string | null>;
}

export class MemorySelectionClipboardStore implements SelectionClipboardStore {
  private serialized: string | null = null;

  async write(serialized: string): Promise<void> {
    this.serialized = serialized;
  }

  async read(): Promise<string | null> {
    return this.serialized;
  }
}
