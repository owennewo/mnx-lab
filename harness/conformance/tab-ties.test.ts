// Tied notes on tab (lab-verify.md, "Tied notes leave the tab"). A tie
// continuation is still ringing — the string was struck once — so the tab staff
// draws no digit for it; only a continuation carried over a system break draws,
// in parentheses, so a line never opens on a silent string.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { layoutTab } from '../../src/engine/layout/tab.ts';
import { tieOrigins } from '../../src/engine/layout/spacing.ts';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { initSmufl, WIDTH_SP } from '../helpers/corpusPrimitives.ts';

initSmufl();

const scenario = (): MnxStructure =>
  JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../scenarios/lab/26-tab-rhythm/04-tied-notes-on-tab/document.mnx.json'),
      'utf8'
    )
  );

function noteIds(mnx: MnxStructure): string[] {
  const ids: string[] = [];
  for (const measure of mnx.parts[0].measures)
    for (const sequence of measure.sequences)
      for (const item of sequence.content)
        if ('notes' in item) for (const note of item.notes ?? []) if (note.id) ids.push(note.id);
  return ids;
}

/** Fret digit text by note id. */
function digits(mnx: MnxStructure): Map<string, string> {
  const drawn = new Map<string, string>();
  for (const p of layoutTab({ mnx, widthSp: WIDTH_SP }).primitives) {
    const text = p as { kind: string; text?: string; className?: string; sourceId?: string };
    if (text.kind === 'text' && text.className?.startsWith('fret-number') && text.sourceId)
      drawn.set(text.sourceId, text.text ?? '');
  }
  return drawn;
}

describe('tied notes on tab', () => {
  it('leaves a continuation undrawn, except one carried over a system break', () => {
    const mnx = scenario();
    const origins = tieOrigins(mnx);
    const drawn = digits(mnx);
    const carried = [...drawn].filter(([, text]) => text.startsWith('('));
    expect(carried.map(([, text]) => text)).toEqual(['(0)']);
    expect(origins.has(carried[0][0])).toBe(true);
    for (const id of origins.keys()) if (id !== carried[0][0]) expect(drawn.has(id)).toBe(false);
    for (const id of noteIds(mnx)) if (!origins.has(id)) expect(drawn.get(id)).toMatch(/^\d+$/);
  });

  it('draws every note once its ties are gone', () => {
    const mnx = scenario();
    for (const measure of mnx.parts[0].measures)
      for (const sequence of measure.sequences)
        for (const item of sequence.content)
          if ('notes' in item) for (const note of item.notes ?? []) delete note.ties;
    const drawn = digits(mnx);
    expect(noteIds(mnx).every(id => /^\d+$/.test(drawn.get(id) ?? ''))).toBe(true);
  });
});
