// Tab read off a PDF's drawing (tools/recording-align/pdfTab.ts): its staves, barlines and
// fret words, snapped to strings and bars — on a drawn page small enough to read here.
import { describe, expect, it } from 'vitest';
import { bboxPages, compareFrets, draftBars, draftTabText, staffTuning, svgLines } from '../../tools/recording-align/pdfTab.ts';
import { buildTabText } from '../../tools/recording-align/tabText.ts';

// One system: a five-line notation staff, then a six-line tab staff at y 100–150 from x 50 to 450,
// drawn at 10× and scaled down as pdftocairo writes it; barlines at 250 (and a double at 446/450).
const S = 'transform="matrix(0.1, 0, 0, 0.1, 0, 0)"';
const line = (x1: number, y1: number, x2: number, y2: number) => `<path fill="none" d="M ${x1 * 10} ${y1 * 10} L ${x2 * 10} ${y2 * 10} " ${S}/>`;
const svg = [
  ...[40, 48, 56, 64, 72].map(y => line(50, y, 450, y)),
  ...[100, 110, 120, 130, 140, 150].map(y => line(50, y, 450, y)),
  line(250, 100, 250, 150), line(446, 100, 446, 150), line(450, 100, 450, 150),
  '<path d="M 1 2 C 3 4 5 6 7 8 Z"/>',
].join('\n');
const word = (text: string, x: number, y: number) => `<word xMin="${x - 2}" yMin="${y - 4}" xMax="${x + 2}" yMax="${y + 4}">${text}</word>`;
const bbox = `<doc><page width="595" height="842">
${word('E', 62, 100)}${word('B', 62, 110)}${word('G', 62, 120)}${word('D', 62, 130)}${word('A', 62, 140)}${word('D', 62, 150)}
${word('10', 40, 30)}${word('D', 120, 30)}
${word('7', 100, 110)}${word('7', 100.5, 120)}${word('0', 101, 150)}${word('5', 180, 110)}
${word('X', 300, 110)}${word('X', 300, 120)}${word('12', 380, 100)}
</page></doc>`;

describe('tab from a PDF', () => {
  const pages = [{ lines: svgLines(svg), words: bboxPages(bbox)[0] }];

  it('snaps each fret word to its string and bar, a column to one chord', () => {
    expect(draftBars(pages).map(b => b.columns.map(c => c.notes.join('+')))).toEqual([
      ['2/7+3/7+6/0', '2/5'], ['2/x+3/x', '1/12']]);
    expect(staffTuning(pages)).toBe('D2 A2 D3 G3 B3 E4');
    expect(draftTabText(draftBars(pages), { title: 'T' })).toContain('bar 2\n  # 0.26 2/x+3/x · 0.66 1/12\n  v1: ?');
  });

  it('names the bars where a transcription strikes what the page does not print', () => {
    const { document } = buildTabText(`title: T\nbar 1\n  v1: h:2/7+3/7+6/0 h:2/5\nbar 2\n  v1: h:2/0x+3/0x h:1/12\n`);
    expect(compareFrets(draftBars(pages), document as never)).toEqual([]);
    const { document: misread } = buildTabText(`title: T\nbar 1\n  v1: h:2/7+3/7+6/0 h:2/5\nbar 2\n  v1: h:2/0x+3/0x h:1/10\n`);
    expect(compareFrets(draftBars(pages), misread as never)).toEqual([{ bar: 2, transcriptionOnly: ['1/10'], pdfOnly: ['1/12'] }]);
  });
});
