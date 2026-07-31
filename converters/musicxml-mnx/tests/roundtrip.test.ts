import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { importMusicXML, exportMusicXML } from '../src/index.js';
import { DOMParser } from '@xmldom/xmldom';
import { MnxStructure, MnxPitch } from '../src/common/types.js';

/**
 * Structural round-trip guards.
 *
 * The original import/export tests only asserted document *shape*, which let
 * three defects ship unnoticed:
 *   1. every exported <type> was hardcoded to "quarter";
 *   2. `<chord/>` notes were split into separate events, inflating measures;
 *   3. a malformed <step> produced NaN → `null` in the JSON, i.e. invalid MNX.
 *
 * These tests assert musical invariants over whole documents rather than
 * spot-checking fields, so a regression in any of the three fails loudly.
 */

const SCORES = path.resolve(__dirname, '../../fixtures');
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const midi = (p: MnxPitch) => (p.octave + 1) * 12 + STEP_SEMITONES[p.step] + (p.alter || 0);

function els(parent: Element | Document, tag: string): Element[] {
  return Array.from(parent.getElementsByTagName(tag) as any as Element[]);
}
const text = (el: Element, tag: string) => els(el, tag)[0]?.textContent ?? null;

/** Every note of every voice, in document order, per part. */
function noteRows(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return els(doc as any, 'part').map(part => {
    const divisions = Number(text(els(part, 'measure')[0], 'divisions'));
    const rows: string[] = [];
    for (const m of els(part, 'measure')) {
      for (const n of els(m, 'note')) {
        const pitch = els(n, 'pitch')[0];
        const tech = els(n, 'technical')[0];
        // NB: quarter-note units, so a divisions change is not a difference.
        rows.push(
          [
            pitch
              ? `${(text(pitch, 'step') || '').trim()}${text(pitch, 'alter') ?? ''}/${text(pitch, 'octave')}`
              : 'REST',
            Number(text(n, 'duration')) / divisions,
            text(n, 'type'),
            tech ? `s${text(tech, 'string')}f${text(tech, 'fret')}` : '-',
            els(n, 'chord').length > 0 ? 'chord' : '-'
          ].join('|')
        );
      }
    }
    return rows;
  });
}

/** Measures whose voices do not add up to the time signature. */
function malformedMeasures(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const bad: string[] = [];
  for (const part of els(doc as any, 'part')) {
    let divisions = 1;
    let beats = 4;
    let beatType = 4;
    for (const m of els(part, 'measure')) {
      const attrs = els(m, 'attributes')[0];
      if (attrs) {
        if (text(attrs, 'divisions')) divisions = Number(text(attrs, 'divisions'));
        if (els(attrs, 'time')[0]) {
          beats = Number(text(attrs, 'time')[0] ? text(els(attrs, 'time')[0], 'beats') : null);
          beatType = Number(text(els(attrs, 'time')[0], 'beat-type'));
        }
      }
      const expected = (beats * divisions * 4) / beatType;
      let cursor = 0;
      let high = 0;
      for (const child of Array.from(m.childNodes as any as Node[])) {
        const el = child as Element;
        if (el.nodeType !== 1) continue;
        const dur = Number(text(el, 'duration') || 0);
        if (el.nodeName === 'note' && els(el, 'chord').length === 0) cursor += dur;
        else if (el.nodeName === 'backup') {
          high = Math.max(high, cursor);
          cursor -= dur;
        } else if (el.nodeName === 'forward') cursor += dur;
      }
      if (Math.abs(Math.max(high, cursor) - expected) > 1e-9) {
        bad.push(`${part.getAttribute('id')}:m${m.getAttribute('number')}`);
      }
    }
  }
  return bad;
}

/** Sounding pitch must equal open-string pitch + fret, for every annotated note. */
function tabPitchMismatches(mnx: MnxStructure): number {
  let mismatches = 0;
  for (const part of mnx.parts) {
    const tuning = part._x?.mnxLab?.tab?.tuning;
    if (!tuning) continue;
    // `_x.mnxLab.tab` frets are measured FROM the capo, so it belongs in the identity.
    const capo = part._x?.mnxLab?.tab?.capo ?? 0;
    const open = new Map(tuning.map(t => [t.string, t.pitch]));
    for (const measure of part.measures) {
      for (const seq of measure.sequences ?? []) {
        for (const event of seq.content ?? []) {
          for (const note of event.notes ?? []) {
            const pos = note._x?.mnxLab?.tab?.position;
            if (!pos) continue;
            const openPitch = open.get(pos.string);
            if (!openPitch || midi(openPitch) + capo + pos.fret !== midi(note.pitch)) mismatches++;
          }
        }
      }
    }
  }
  return mismatches;
}

function everyPitch(mnx: MnxStructure): MnxPitch[] {
  const out: MnxPitch[] = [];
  for (const part of mnx.parts)
    for (const measure of part.measures)
      for (const seq of measure.sequences ?? [])
        for (const event of seq.content ?? []) for (const note of event.notes ?? []) out.push(note.pitch);
  return out;
}

describe.each([
  ['House-of-the-Rising-Sun.xml'],
  ['Sun-did-glide.xml']
])('MusicXML -> MNX -> MusicXML round trip: %s', file => {
  async function roundTrip() {
    const original = await fs.readFile(path.join(SCORES, file), 'utf-8');
    const mnx = importMusicXML(original, { mergeNotationAndTab: true });
    return { original, mnx, exported: exportMusicXML(mnx) };
  }

  it('preserves every note: pitch, duration, notated type, string/fret and chord grouping', async () => {
    const { original, exported } = await roundTrip();
    const before = noteRows(original);
    const after = noteRows(exported);

    expect(after.length).toBe(before.length);
    for (let p = 0; p < before.length; p++) {
      expect(after[p].length).toBe(before[p].length);
      // Notes whose source <step> is malformed are repaired on import, so they
      // legitimately differ; compare every other field for those rows.
      for (let i = 0; i < before[p].length; i++) {
        const [bPitch, ...bRest] = before[p][i].split('|');
        const [aPitch, ...aRest] = after[p][i].split('|');
        expect(aRest.join('|')).toBe(bRest.join('|'));
        if (bPitch === 'REST' || bPitch.split('/')[0].replace(/-?\d+$/, '') !== '') {
          expect(aPitch).toBe(bPitch);
        }
      }
    }
  });

  it('exports <type> reflecting the real duration, not a hardcoded "quarter"', async () => {
    const { original, exported } = await roundTrip();
    const count = (xml: string) => {
      const seen: Record<string, number> = {};
      for (const t of els(new DOMParser().parseFromString(xml, 'text/xml') as any, 'type')) {
        seen[t.textContent!] = (seen[t.textContent!] || 0) + 1;
      }
      return seen;
    };
    const before = count(original);
    const after = count(exported);
    // Both fixtures contain a mix; a single-valued distribution means the bug is back.
    expect(Object.keys(after).length).toBeGreaterThan(1);
    for (const [type, n] of Object.entries(before)) {
      expect(after[type], `count of <type>${type}</type>`).toBe(n);
    }
  });

  it('keeps chords stacked so measures still add up to the time signature', async () => {
    const { original, exported } = await roundTrip();
    const chords = (xml: string) =>
      els(new DOMParser().parseFromString(xml, 'text/xml') as any, 'chord').length;

    expect(chords(original)).toBeGreaterThan(0); // fixture must actually exercise this
    expect(chords(exported)).toBe(chords(original));
    expect(malformedMeasures(exported)).toEqual([]);
  });

  it('never emits a pitch with a null/NaN octave or alter', async () => {
    const { mnx } = await roundTrip();
    for (const pitch of everyPitch(mnx)) {
      expect(Number.isInteger(pitch.octave)).toBe(true);
      expect(typeof pitch.step).toBe('string');
      expect(pitch.step.trim()).not.toBe('');
      if (pitch.alter !== undefined) expect(Number.isInteger(pitch.alter)).toBe(true);
    }
    // Guards the failure mode directly: NaN survives structuredClone but not JSON.
    expect(JSON.stringify(mnx)).not.toContain('null');
  });

  it('agrees with its own tuning: sounding pitch === open string + fret', async () => {
    const { mnx } = await roundTrip();
    expect(tabPitchMismatches(mnx)).toBe(0);
  });
});

describe('malformed source repair', () => {
  /**
   * Soundslice's MusicXML exporter emitted `<step> </step>` — a blank step — on
   * 234 notes of the original Sun-did-glide export. That file is gone (the
   * corpus moved to GPX, which does not have the defect), so the repair is
   * pinned here with a synthetic document instead: the behaviour still ships,
   * and third-party files can still arrive broken this way.
   */
  const BLANK_STEP_XML = `<?xml version="1.0"?><score-partwise version="4.0">
    <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
    <part id="P1">
      <measure number="1">
        <attributes><divisions>4</divisions>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>TAB</sign></clef>
          <staff-details><staff-lines>6</staff-lines>
            <staff-tuning line="1"><tuning-step>E</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
            <staff-tuning line="2"><tuning-step>A</tuning-step><tuning-octave>2</tuning-octave></staff-tuning>
            <staff-tuning line="3"><tuning-step>D</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
            <staff-tuning line="4"><tuning-step>G</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
            <staff-tuning line="5"><tuning-step>B</tuning-step><tuning-octave>3</tuning-octave></staff-tuning>
            <staff-tuning line="6"><tuning-step>E</tuning-step><tuning-octave>4</tuning-octave></staff-tuning>
          </staff-details>
        </attributes>
        <note><pitch><step> </step><alter>-1</alter><octave>3</octave></pitch>
          <duration>16</duration><voice>1</voice><type>whole</type>
          <notations><technical><fret>3</fret><string>5</string></technical></notations></note>
      </measure>
    </part></score-partwise>`;

  it('reconstructs pitches from string/fret when <step> is unusable, and reports it', () => {
    const warnings: string[] = [];
    const mnx = importMusicXML(BLANK_STEP_XML, { onWarning: m => warnings.push(m) });

    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/unusable <pitch>/);
    expect(warnings[0]).toMatch(/reconstructed from tablature/);
    expect(warnings[0]).not.toMatch(/could not be recovered/);
    expect(tabPitchMismatches(mnx)).toBe(0);

    // String 5 is A2 (MIDI 45); fret 3 makes it C3 — NOT the blank step's
    // bogus <alter>-1.
    const note = mnx.parts[0].measures[0].sequences[0].content[0].notes![0];
    expect(note.pitch).toEqual({ step: 'C', octave: 3 });
  });

  it('emits no null octaves for such a document', () => {
    const mnx = importMusicXML(BLANK_STEP_XML);
    expect(JSON.stringify(mnx)).not.toContain('null');
  });
});

describe('lyrics', () => {
  /**
   * Sun-did-glide carries THREE verses. Multi-verse is the point: a single
   * verse would hide line-keying bugs entirely. Most of its syllables also sit
   * on `<rest>` elements — legal MusicXML that an earlier version of this
   * importer ignored, losing 37 of 60 syllables.
   */
  async function importSun() {
    const xml = await fs.readFile(path.join(SCORES, 'Sun-did-glide.xml'), 'utf-8');
    return importMusicXML(xml, { mergeNotationAndTab: true });
  }

  /** Non-empty syllables of one verse, in document order. */
  function verse(mnx: ReturnType<typeof importMusicXML>, line: string) {
    const out: { text: string; type?: string }[] = [];
    for (const part of mnx.parts)
      for (const measure of part.measures)
        for (const sequence of measure.sequences ?? [])
          for (const event of sequence.content ?? []) {
            const syllable = event.lyrics?.lines?.[line];
            if (syllable?.text) out.push({ text: syllable.text, type: syllable.type });
          }
    return out;
  }

  it('imports every verse, including syllables attached to rests', async () => {
    const mnx = await importSun();
    expect(mnx.global.lyrics?.lineOrder).toEqual(['1', '2', '3']);
    expect(verse(mnx, '1').length).toBe(54);
    expect(verse(mnx, '2').length).toBe(54);
    expect(verse(mnx, '3').length).toBe(55);

    // Syllables on rests must survive — this is where they nearly all live.
    let onRests = 0;
    for (const part of mnx.parts)
      for (const measure of part.measures)
        for (const sequence of measure.sequences ?? [])
          for (const event of sequence.content ?? [])
            if (event.rest && event.lyrics) onRests++;
    expect(onRests).toBeGreaterThan(0);
  });

  it('reads the words back in order', async () => {
    const mnx = await importSun();
    const words = verse(mnx, '1')
      .map(s => s.text + (s.type === 'start' || s.type === 'middle' ? '' : ' '))
      .join('');
    expect(words).toMatch(/^I made a wish that you were a shining star/);
    expect(verse(mnx, '3').map(s => s.text).slice(0, 6).join(' ')).toBe(
      'And then the sun did glide'
    );
  });

  it('round-trips every verse back to MusicXML unchanged', async () => {
    const original = await fs.readFile(path.join(SCORES, 'Sun-did-glide.xml'), 'utf-8');
    const exported = exportMusicXML(importMusicXML(original, { mergeNotationAndTab: true }));

    const lyricsOf = (xml: string, partId: string) => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const part = els(doc as any, 'part').find(p => p.getAttribute('id') === partId)!;
      const byVerse: Record<string, string[]> = {};
      for (const note of els(part, 'note'))
        for (const lyric of els(note, 'lyric')) {
          const text = text_(lyric, 'text');
          if (!text) continue; // empty placeholders carry no meaning
          const number = lyric.getAttribute('number')!;
          (byVerse[number] ??= []).push(text);
        }
      return byVerse;
    };
    const text_ = (el: Element, tag: string) => els(el, tag)[0]?.textContent ?? null;

    const before = lyricsOf(original, 'P1-std');
    const after = lyricsOf(exported, 'P1-std');
    expect(Object.keys(after).sort()).toEqual(['1', '2', '3']);
    for (const verseId of ['1', '2', '3']) {
      expect(after[verseId], `verse ${verseId}`).toEqual(before[verseId]);
    }
  });
});

describe('repeats and alternate endings', () => {
  /**
   * Sun-did-glide has a forward repeat at bar 9, a backward repeat at bar 68
   * playing the section 3 times, and a volta spanning bars 47-68. Soundslice
   * writes that volta as start+stop on EVERY one of its 22 bars (44 marks);
   * MNX states it once with a duration. Both must survive.
   */
  async function importSun() {
    const xml = await fs.readFile(path.join(SCORES, 'Sun-did-glide.xml'), 'utf-8');
    return importMusicXML(xml, { mergeNotationAndTab: true });
  }

  it('imports the repeat signs, including the play count', async () => {
    const global = (await importSun()).global.measures;
    expect(global[8].repeatStart).toEqual({});          // bar 9
    expect(global[67].repeatEnd).toEqual({ times: 3 }); // bar 68, played 3x
    // Nowhere else.
    expect(global.filter(m => m.repeatStart).length).toBe(1);
    expect(global.filter(m => m.repeatEnd).length).toBe(1);
  });

  it('collapses a per-measure volta into a single bracket', async () => {
    const global = (await importSun()).global.measures;
    const endings = global
      .map((m, i) => ({ measure: i + 1, ending: m.ending }))
      .filter(e => e.ending);

    // 44 source marks -> exactly ONE bracket, bar 47 spanning 22 bars.
    expect(endings.length).toBe(1);
    expect(endings[0].measure).toBe(47);
    expect(endings[0].ending).toEqual({ numbers: [2], duration: 22 });
  });

  it('also understands the common form (start on first bar, stop on last)', () => {
    const xml = `<?xml version="1.0"?><score-partwise version="4.0">
      <part-list><score-part id="P1"><part-name>G</part-name></score-part></part-list>
      <part id="P1">
        <measure number="1"><attributes><divisions>1</divisions>
          <time><beats>4</beats><beat-type>4</beat-type></time></attributes>
          <barline location="left"><repeat direction="forward"/></barline>
          <note><rest/><duration>4</duration><voice>1</voice><type>whole</type></note></measure>
        <measure number="2">
          <barline location="left"><ending number="1" type="start"/></barline>
          <note><rest/><duration>4</duration><voice>1</voice><type>whole</type></note></measure>
        <measure number="3">
          <note><rest/><duration>4</duration><voice>1</voice><type>whole</type></note>
          <barline location="right"><ending number="1" type="stop"/>
            <repeat direction="backward"/></barline></measure>
        <measure number="4">
          <barline location="left"><ending number="2" type="start"/></barline>
          <note><rest/><duration>4</duration><voice>1</voice><type>whole</type></note>
          <barline location="right"><ending number="2" type="discontinue"/></barline></measure>
      </part></score-partwise>`;
    const global = importMusicXML(xml).global.measures;

    expect(global[0].repeatStart).toEqual({});
    // Bracket 1 spans bars 2-3 (start ... stop), bracket 2 is one open bar.
    expect(global[1].ending).toEqual({ numbers: [1], duration: 2 });
    expect(global[2].repeatEnd).toEqual({});
    expect(global[3].ending).toEqual({ numbers: [2], open: true });
  });

  it('round-trips repeats and the volta back to MusicXML', async () => {
    const original = await fs.readFile(path.join(SCORES, 'Sun-did-glide.xml'), 'utf-8');
    const exported = exportMusicXML(importMusicXML(original, { mergeNotationAndTab: true }));
    const doc = new DOMParser().parseFromString(exported, 'text/xml');
    const part = els(doc as any, 'part').find(p => p.getAttribute('id') === 'P1-std')!;

    const marks: string[] = [];
    for (const measure of els(part, 'measure'))
      for (const barline of els(measure, 'barline')) {
        // MusicXML orders <barline> children bar-style, ending, repeat — read
        // them in that order so the assertion reflects document order.
        const ending = els(barline, 'ending')[0];
        const repeat = els(barline, 'repeat')[0];
        if (ending)
          marks.push(
            `m${measure.getAttribute('number')} ending${ending.getAttribute('number')}:${ending.getAttribute('type')}`
          );
        if (repeat)
          marks.push(
            `m${measure.getAttribute('number')} ${repeat.getAttribute('direction')}` +
              (repeat.getAttribute('times') ? `x${repeat.getAttribute('times')}` : '')
          );
      }

    // Written in the standard form: one bracket, not 44 per-measure marks.
    expect(marks).toEqual([
      'm9 forward',
      'm47 ending2:start',
      'm68 ending2:stop',
      'm68 backwardx3'
    ]);
  });

  it('re-imports its own export to the same MNX (stable round trip)', async () => {
    const original = await fs.readFile(path.join(SCORES, 'Sun-did-glide.xml'), 'utf-8');
    const once = importMusicXML(original, { mergeNotationAndTab: true });
    const twice = importMusicXML(exportMusicXML(once), { mergeNotationAndTab: true });

    const structure = (m: typeof once) =>
      m.global.measures.map(g => ({
        repeatStart: g.repeatStart,
        repeatEnd: g.repeatEnd,
        ending: g.ending
      }));
    expect(structure(twice)).toEqual(structure(once));
  });
});

describe.each(['House-of-the-Rising-Sun', 'Sun-did-glide', 'Vestapol'])(
  'MNX -> MusicXML -> MNX is lossless: %s',
  name => {
    /**
     * The corpus is authored as Guitar Pro and MusicXML is DERIVED, so this is
     * the direction that matters: everything MNX holds must survive a trip out
     * to MusicXML and back. Compared semantically — note ids are legitimately
     * rewritten by the notation/TAB split, so technique targets are compared by
     * WHICH note they resolve to, not by their literal string.
     */
    async function roundTrip() {
      const source: MnxStructure = JSON.parse(
        await fs.readFile(path.join(SCORES, `${name}.mnx.json`), 'utf-8')
      );
      return { source, back: importMusicXML(exportMusicXML(source)) };
    }

    function rows(mnx: MnxStructure): string[] {
      const flat: { id?: string }[] = [];
      for (const part of mnx.parts)
        for (const measure of part.measures)
          for (const seq of measure.sequences ?? [])
            for (const event of seq.content ?? []) for (const note of event.notes ?? []) flat.push(note);
      const ordinal = new Map(flat.map((n, i) => [n.id, i]));

      const out: string[] = [];
      for (const part of mnx.parts)
        part.measures.forEach((measure, mi) => {
          for (const seq of measure.sequences ?? [])
            for (const event of seq.content ?? []) {
              const head = `${mi}/${seq.voice}/${event.duration.base}+${event.duration.dots ?? 0}`;
              const lyrics = Object.entries(event.lyrics?.lines ?? {})
                .map(([k, v]) => `${k}:${v.text}:${v.type}`)
                .join(';');
              if (event.rest || !event.notes?.length) {
                out.push(`${head}/REST/${lyrics}`);
                continue;
              }
              for (const note of event.notes) {
                const t = note._x?.mnxLab?.tab?.technique;
                const at = (k: 'hammerOn' | 'pullOff' | 'slide') =>
                  t?.[k]?.target !== undefined ? `@${ordinal.get(t[k]!.target!) ?? '?'}` : '';
                // Bend points are compared by their ALTER sequence, not their
                // positions: MusicXML has no way to say when a point falls, so
                // timing is normalised on the way through (the one thing this
                // round trip does not preserve — docs/mnx-extensions.md).
                const tech = t
                  ? [
                      t.hammerOn ? 'H' + at('hammerOn') : '',
                      t.pullOff ? 'P' + at('pullOff') : '',
                      t.slide ? `S:${t.slide.type}${t.slide.direction ?? ''}${at('slide')}` : '',
                      t.bend ? `B:${t.bend.points.map(pt => pt.alter).join('>')}` : '',
                      t.vibrato ? 'V' : '',
                      t.harmonic ? `Har:${t.harmonic.type}` : '',
                      t.palmMute ? 'PM' : ''
                    ]
                      .filter(Boolean)
                      .join(',')
                  : '-';
                const p = note._x?.mnxLab?.tab?.position;
                out.push(`${head}/${midi(note.pitch)}/${p ? `s${p.string}f${p.fret}` : '-'}/${tech}/${lyrics}`);
              }
            }
        });
      return out;
    }

    it('preserves every note, technique, lyric and fingerboard position', async () => {
      const { source, back } = await roundTrip();
      expect(rows(back)).toEqual(rows(source));
    });

    it('preserves tuning, capo and the global structure', async () => {
      const { source, back } = await roundTrip();
      const tab = (m: MnxStructure) => ({
        // Keyed by string number: the tab schema states that array order
        // carries no meaning, and the MusicXML round trip reverses it (staff
        // lines run bottom-up, string numbers run top-down).
        tuning: Object.fromEntries(
          (m.parts[0]._x?.mnxLab?.tab?.tuning ?? []).map(t => [t.string, t.pitch])
        ),
        capo: m.parts[0]._x?.mnxLab?.tab?.capo,
        staffKind: m.parts[0]._x?.mnxLab?.tab?.staffKind
      });
      expect(tab(back)).toEqual(tab(source));

      const globals = (m: MnxStructure) =>
        m.global.measures.map(g => ({
          key: g.key, time: g.time, repeatStart: g.repeatStart,
          repeatEnd: g.repeatEnd, ending: g.ending
        }));
      expect(globals(back)).toEqual(globals(source));
      expect(back.global.lyrics?.lineOrder).toEqual(source.global.lyrics?.lineOrder);
    });

    it('preserves rehearsal marks and section names as separate labels', async () => {
      const { source, back } = await roundTrip();
      const labels = (m: MnxStructure) =>
        m.global.measures.map(g => [
          g._x?.mnxLab?.rehearsal?.label ?? null,
          g._x?.mnxLab?.section?.label ?? null
        ]);
      expect(labels(back)).toEqual(labels(source));
    });

    it('preserves chord symbols, structure and position', async () => {
      const { source, back } = await roundTrip();
      // `text` is deliberately excluded: it is a DISPLAY override, and
      // MusicXML's `<kind text>` holds only the suffix — there is nowhere to
      // put a literal that contradicts the structure (a lowercase root, say),
      // so such a spelling normalises. The structure itself must survive.
      const harmonies = (m: MnxStructure) =>
        m.global.measures.flatMap((g, i) =>
          (g._x?.mnxLab?.harmonies ?? []).map(({ text: _text, ...rest }) => ({
            measure: i + 1,
            ...rest
          }))
        );
      expect(harmonies(back)).toEqual(harmonies(source));
    });

    it('leaves no dangling technique target', async () => {
      const { back } = await roundTrip();
      const ids = new Set<string>();
      const targets: string[] = [];
      for (const part of back.parts)
        for (const measure of part.measures)
          for (const seq of measure.sequences ?? [])
            for (const event of seq.content ?? [])
              for (const note of event.notes ?? []) {
                if (note.id) ids.add(note.id);
                const t = note._x?.mnxLab?.tab?.technique;
                for (const k of ['hammerOn', 'pullOff', 'slide'] as const)
                  if (t?.[k]?.target) targets.push(t[k]!.target!);
              }
      expect(targets.filter(t => !ids.has(t))).toEqual([]);
    });
  }
);
