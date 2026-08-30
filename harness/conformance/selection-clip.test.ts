import { describe, expect, it } from 'vitest';
import { MemorySelectionClipboardStore } from '../../src/edit/selectionClipboard.ts';
import {
  MNX_LAB_EXTENSION_VERSION,
  SELECTION_CLIP_FORMAT,
  SELECTION_CLIP_VERSION,
  SelectionClipDecodeError,
  decodeSelectionClip,
  encodeSelectionClip,
  type SelectionClip,
  type SelectionClipEnvelope
} from '../../src/edit/selectionClip.ts';

const score = {
  mnx: { version: 1 },
  global: { measures: [{}] },
  parts: [{ id: 'part-1', measures: [{ sequences: [] }] }]
};

function envelope(clip: SelectionClip): SelectionClipEnvelope {
  return {
    format: SELECTION_CLIP_FORMAT,
    version: SELECTION_CLIP_VERSION,
    source: { mnxVersion: 1, extensionVersion: MNX_LAB_EXTENSION_VERSION },
    selection: { level: 'note', shape: 'point' },
    clip
  };
}

const everyKind: SelectionClip[] = [
  { kind: 'note-set', notes: [{ pitch: { step: 'C', octave: 4 } }] },
  {
    kind: 'event-run',
    span: 1,
    bars: [{
      offset: 0,
      onset: [0, 1],
      items: [{ duration: { base: 'quarter' }, notes: [{ pitch: { step: 'D', octave: 4 } }] }]
    }]
  },
  {
    kind: 'voice-bars',
    span: 2,
    bars: [{ offset: 1, sequence: { content: [] } }]
  },
  {
    kind: 'part-bars',
    span: 1,
    bars: [{ offset: 0, measure: { sequences: [] } }]
  },
  { kind: 'part', part: score.parts[0] },
  {
    kind: 'measures',
    parts: [{ id: 'part-1' }],
    measures: [{ global: {}, parts: [{ sequences: [] }] }]
  },
  { kind: 'document', document: score }
];

describe('selection clip codec', () => {
  it('round-trips every rung-derived clip kind through one string representation', () => {
    for (const clip of everyKind) {
      const source = envelope(clip);
      expect(decodeSelectionClip(encodeSelectionClip(source))).toEqual(source);
    }
  });

  it('round-trips optional context and dependencies', () => {
    const source: SelectionClipEnvelope = {
      ...envelope({ kind: 'part', part: score.parts[0] }),
      selection: { level: 'partMeasure', shape: 'closure' },
      context: {
        measures: [{ id: 'm1', key: { fifths: -2 }, time: { count: 4, unit: 4 } }]
      },
      dependencies: {
        support: { useBeams: true },
        lyrics: {
          lineOrder: ['verse'],
          lineMetadata: { verse: { label: 'Verse 1', lang: 'en' } }
        }
      },
      relationships: {
        measures: [{
          offset: 0,
          beams: [{ events: ['event-1', 'event-2'] }],
          ottavas: [{
            position: { fraction: [0, 1] },
            end: { measure: 'm1', position: { fraction: [1, 1] } },
            value: 1
          }]
        }]
      }
    };
    expect(decodeSelectionClip(encodeSelectionClip(source))).toEqual(source);
  });

  it.each([
    ['invalid JSON', '{'],
    ['unknown format', JSON.stringify({ ...envelope(everyKind[0]), format: 'other' })],
    ['unknown version', JSON.stringify({ ...envelope(everyKind[0]), version: 3 })],
    [
      'unknown envelope property',
      JSON.stringify({ ...envelope(everyKind[0]), browserClipboard: true })
    ],
    [
      'unknown clip property',
      JSON.stringify({
        ...envelope(everyKind[0]),
        clip: { ...everyKind[0], liveNoteKeys: ['source-address'] }
      })
    ],
    [
      'unknown clip kind',
      JSON.stringify({ ...envelope(everyKind[0]), clip: { kind: 'raw-selection' } })
    ],
    [
      'invalid context',
      JSON.stringify({ ...envelope(everyKind[0]), context: { measures: [{ time: { count: 0, unit: 4 } }] } })
    ]
  ])('rejects %s', (_label, serialized) => {
    expect(() => decodeSelectionClip(serialized)).toThrow(SelectionClipDecodeError);
  });

  it('rejects cyclic and non-JSON values before they reach the store', () => {
    const source = envelope(everyKind[0]) as SelectionClipEnvelope & { loop?: unknown };
    source.loop = source;
    expect(() => encodeSelectionClip(source)).toThrow(SelectionClipDecodeError);
  });
});

describe('memory selection clipboard', () => {
  it('stores only the serialized value and spans session changes', async () => {
    const store = new MemorySelectionClipboardStore();
    expect(await store.read()).toBeNull();
    const serialized = encodeSelectionClip(envelope(everyKind[5]));
    await store.write(serialized);
    expect(await store.read()).toBe(serialized);
    expect(decodeSelectionClip((await store.read())!)).toEqual(envelope(everyKind[5]));
  });
});
