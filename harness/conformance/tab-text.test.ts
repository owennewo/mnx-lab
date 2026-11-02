// Tab text (tools/recording-align/tabText.ts): a transcription read off a page becomes the
// document studio would have made, and a misread bar is refused with its line number.
import { describe, expect, it } from 'vitest';
import { buildTabText } from '../../tools/recording-align/tabText.ts';
import { linearizePasses } from '../../src/model/passes.ts';
import { checkStorage } from '../../src/importers/storageCheckCore.ts';

const HEAD = 'title: Test\nkey: 1\ntime: 4/4\ntempo: 96\n';
const bars = (body: string) => buildTabText(HEAD + body);

describe('tab text', () => {
  it('writes string, fret and the pitch the place sounds, with ties and harmonics', () => {
    const { document } = bars(`bar 1
  v1: q:r 8:2/12h 8:1/12h~ h:1/12h~
  v2: h:6/0 h:5/3
bar 2
  v1: w:1/12h
  v2: w:6/3
`);
    const [v1, v2] = document.parts[0].measures[0].sequences;
    const notes = v1.content.flatMap(e => 'notes' in e ? e.notes ?? [] : []);
    expect(notes.map(n => [n.pitch.step, n.pitch.octave, n._x?.mnxLab?.string, n._x?.mnxLab?.fret])).toEqual([
      ['B', 4, 2, 12], ['E', 5, 1, 12], ['E', 5, 1, 12]]);
    expect(notes[0]._x?.mnxLab?.tab?.technique?.harmonic).toEqual({ type: 'natural' });
    // Each tie lands on the next note on its string, the last one across the bar line.
    const whole = document.parts[0].measures[1].sequences[0].content[0] as { notes: { id: string }[] };
    expect(notes[1].ties).toEqual([{ target: notes[2].id }]);
    expect(notes[2].ties).toEqual([{ target: whole.notes[0].id }]);
    expect(v2.content.map(e => (e as { notes: { pitch: { step: string; octave: number } }[] }).notes[0].pitch)).toEqual([
      { step: 'E', octave: 2 }, { step: 'C', octave: 3 }]);
    expect(checkStorage(document).check.verdict).not.toBe('differs');
  });

  it('copies a bar with fresh ids and plays segno, D.S. al Coda and a repeat as written', () => {
    const one = '  v1: w:3/0\n';
    const { document } = bars(`bar 1\n${one}bar 2 segno\n${one}bar 3 |:\n${one}bar 4 :| tocoda\n${one}bar 5 = 4 ds-al-coda\nbar 6 coda\n${one}`);
    const ids = document.parts[0].measures.map(m => (m.sequences[0].content[0] as { notes: { id: string }[] }).notes[0].id);
    expect(new Set(ids).size).toBe(6);
    expect(linearizePasses(document).entries.map(e => e.measureIndex + 1)).toEqual([1, 2, 3, 4, 3, 4, 5, 2, 3, 4, 3, 4, 6]);
  });

  it('marks consecutive volta bars as one ending', () => {
    const one = '  v1: w:3/0\n';
    const { document } = bars(`bar 1 |:\n${one}bar 2 volta=1\n${one}bar 3 volta=1 :|\n${one}bar 4 volta=2\n${one}`);
    expect(document.global.measures.map(m => m.ending)).toEqual([undefined, { numbers: [1], duration: 2 }, undefined, { numbers: [2], duration: 1 }]);
  });

  it('writes triplets and grace notes as containers, and the slurs to the next note on the string', () => {
    const { document } = bars(`bar 1
  v1: 8:5/3 t3(16:2/1+3/0p 16:3/2p 16:3/0) g:4/0p q:4/2s q.:4/4 8:r
`);
    const content = document.parts[0].measures[0].sequences[0].content as unknown as Record<string, any>[];
    expect(content.map(item => item.type ?? 'event')).toEqual(['event', 'tuplet', 'grace', 'event', 'event', 'event']);
    expect([content[1].inner, content[1].outer]).toEqual([{ duration: { base: '16th' }, multiple: 3 }, { duration: { base: '16th' }, multiple: 2 }]);
    const [first, second, third] = content[1].content;
    const open = first.notes.find((n: any) => n._x.mnxLab.string === 3);
    expect(open._x.mnxLab.tab.technique.hammerPull).toEqual({ target: second.notes[0].id });
    expect(second.notes[0]._x.mnxLab.tab.technique.hammerPull).toEqual({ target: third.notes[0].id });
    expect(content[2].content[0].notes[0]._x.mnxLab.tab.technique.hammerPull).toEqual({ target: content[3].notes[0].id });
    expect(content[3].notes[0]._x.mnxLab.tab.technique.slide).toEqual({ type: 'legato', target: content[4].notes[0].id });
    expect(checkStorage(document).check.verdict).not.toBe('differs');
  });

  it('refuses a misread bar, naming its line', () => {
    expect(() => bars('bar 1\n  v1: t3(8:3/0 8:3/1) h. :3/0\n')).toThrow(/not three undotted events/);
    expect(() => bars('bar 1\n  v1: t3(q:3/0 q:3/1 q:3/2 h:3/0\n')).toThrow(/not closed/);
    expect(() => bars('bar 1\n  v1: w:3/0 g:3/1\n')).toThrow(/grace note with nothing after it/);
    expect(() => bars('bar 1\n  v1: h:3/0p h:3/0\n')).toThrow(/lands on the fret it left/);
    expect(() => bars('bar 1\n  v1: h:3/0s h:2/0\n')).toThrow(/slide on string 3 has no later note/);
    expect(() => bars('bar 1\n  v1: q:3/0 q:3/0 q:3/0\n')).toThrow(/line 5: bar 1 v1 holds 3 beats of 4/);
    expect(() => bars('bar 1\n  v1: h:3/0~ h:2/1\n')).toThrow(/line 5: .*tie on string 3 has no later note/);
    expect(() => bars('bar 1\n  v1: h:3/0~ h:3/2\n')).toThrow(/lands on a different pitch/);
    expect(() => bars('bar 2\n  v1: w:3/0\n')).toThrow(/bar 2 follows bar 0/);
    expect(() => bars('bar 1\n  v1: w:7/0\n')).toThrow(/string 7 is not one of the tuning's 6/);
  });
});
