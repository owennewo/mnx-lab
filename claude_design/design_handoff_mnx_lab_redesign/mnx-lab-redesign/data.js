// MNX Lab redesign prototype — corpus data.
// Mirrors the real repo (scenarios/ @ 2026-06-10): 49 spec/ mirrors + 4 lab/
// scenarios; statuses approximate the live corpus (53 scenarios, 47 rendered).
window.MNX_DATA = (() => {

  const DURBASE = { w: 'whole', h: 'half', q: 'quarter', '8': 'eighth' };
  const STEPS = ['E', 'F', 'G', 'A', 'B', 'C', 'D']; // sp 0 = E4 (bottom line, treble)

  function spToPitch(sp, acc) {
    const i = ((sp % 7) + 7) % 7;
    const p = { step: STEPS[i], octave: 4 + Math.floor((sp + 2) / 7) };
    if (acc === '#') p.alter = 1;
    if (acc === 'b') p.alter = -1;
    return p;
  }

  function pitchLabel(sp, acc) {
    const p = spToPitch(sp, acc);
    const a = acc === '#' ? '\u266F' : acc === 'b' ? '\u266D' : acc === 'n' ? '\u266E' : '';
    return p.step + a + p.octave;
  }

  // Generate a small, honest MNX document from a music spec (note ids n1..nK).
  function genMnx(music, extra = {}) {
    let n = 0;
    return {
      mnx: { version: 1 },
      global: {
        measures: music.measures.map((m, i) => {
          if (i !== 0) return {};
          const g = {};
          if (music.keyFlats) g.key = { fifths: -music.keyFlats };
          if (music.keySharps) g.key = { fifths: music.keySharps };
          g.time = { count: music.time ? music.time[0] : 4, unit: music.time ? music.time[1] : 4 };
          return g;
        })
      },
      parts: [Object.assign(
        { id: extra.partId || 'P1' },
        extra.name ? { name: extra.name } : {},
        extra.tab ? { _x: { tab: extra.tab } } : {},
        {
          measures: music.measures.map((m, mi) => Object.assign(
            mi === 0 ? { clefs: [{ clef: Object.assign({ sign: 'G', staffPosition: -2 }, music.clef === 'g8vb' ? { octave: -1 } : {}) }] } : {},
            {
              sequences: [{
                content: m.events.map(ev => ev.rest
                  ? { duration: { base: DURBASE[ev.dur] }, rest: {} }
                  : { duration: { base: DURBASE[ev.dur] }, notes: ev.notes.map(nt => ({ id: 'n' + (++n), pitch: spToPitch(nt.sp, nt.acc === 'n' ? null : nt.acc) })) })
              }]
            }
          ))
        }
      )]
    };
  }

  function flatNotes(music) {
    const out = [];
    if (!music) return out;
    let ev = 0;
    music.measures.forEach((m, mi) => m.events.forEach(e => {
      (e.notes || []).forEach(nt => out.push({ sp: nt.sp, acc: nt.acc || null, m: mi + 1, ev, label: nt.lbl || pitchLabel(nt.sp, nt.acc) }));
      ev++;
    }));
    return out;
  }

  const genAnchors = music => flatNotes(music).map((_, i) => ({ q: '"id": "n' + (i + 1) + '"', n: 1 }));

  // ── music spec presets ─────────────────────────────────────────────
  const q = sp => ({ dur: 'q', notes: [{ sp }] });
  const mel = (...sps) => ({ time: [4, 4], measures: [{ events: sps.map(q) }] });
  const singleWhole = sp => ({ time: [4, 4], measures: [{ events: [{ dur: 'w', notes: [{ sp }] }] }] });
  const beamedPairs = () => ({
    time: [4, 4], measures: [{
      events: [
        { dur: '8', beam: 'a', notes: [{ sp: 2 }] }, { dur: '8', beam: 'a', notes: [{ sp: 4 }] },
        { dur: '8', beam: 'b', notes: [{ sp: 5 }] }, { dur: '8', beam: 'b', notes: [{ sp: 3 }] },
        q(2), q(1)
      ]
    }]
  });
  const restsMusic = () => ({
    time: [4, 4], measures: [{
      events: [{ dur: 'h', rest: true }, q(5), { dur: 'q', rest: true }]
    }]
  });
  const dottedMusic = () => ({
    time: [4, 4], measures: [{
      events: [{ dur: 'q', dot: true, notes: [{ sp: 2 }] }, { dur: '8', notes: [{ sp: 3 }] }, { dur: 'h', notes: [{ sp: 4 }] }]
    }]
  });
  const chordMusic = () => ({
    time: [4, 4], measures: [{
      events: [
        { dur: 'q', notes: [{ sp: 0 }, { sp: 2 }, { sp: 4 }] },
        { dur: 'q', notes: [{ sp: 1 }, { sp: 3 }, { sp: 5 }] },
        { dur: 'h', notes: [{ sp: 2 }, { sp: 4 }, { sp: 6 }] }
      ]
    }]
  });
  const tiesMusic = () => ({
    time: [4, 4], measures: [
      { events: [{ dur: 'h', notes: [{ sp: 2 }] }, { dur: 'h', arc: true, notes: [{ sp: 4 }] }] },
      { events: [{ dur: 'w', notes: [{ sp: 4 }] }] }
    ]
  });
  const slursMusic = () => ({
    time: [4, 4], measures: [{
      events: [{ dur: 'q', arc: true, notes: [{ sp: 1 }] }, q(3), { dur: 'q', arc: true, notes: [{ sp: 4 }] }, q(6)]
    }]
  });

  function hashOf(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function defaultMusic(name) {
    const h = hashOf(name);
    const pick = k => ((h >> (k * 3)) % 7) + 1; // 1..7
    return mel(pick(0), pick(1), pick(2), pick(3));
  }
  function musicFor(name) {
    if (/beam/.test(name)) return beamedPairs();
    if (/rest/.test(name)) return restsMusic();
    if (name === 'dotted-notes') return dottedMusic();
    if (/chord/.test(name)) return chordMusic();
    if (/^ties/.test(name)) return tiesMusic();
    if (/^slur/.test(name)) return slursMusic();
    if (name === 'hello-world') return singleWhole(5);
    if (name === 'key-signatures') return Object.assign(mel(1, 2, 3, 4), { keyFlats: 3 });
    if (/time-signature/.test(name)) return { time: [3, 4], measures: [{ events: [q(2), q(4), q(6)] }] };
    if (name === 'stem-directions') return mel(1, 7, 2, 6);
    return defaultMusic(name);
  }

  // ── spec/ mirror (49 entries; representative names) ────────────────
  const TITLE_OVERRIDES = {
    'beam-hooks': 'Beams (hooks)',
    'beams-across-barlines': 'Beams (across barlines)',
    'beams-inner-grace-notes': 'Beams (with inner grace notes)',
    'beams-secondary-beam-breaks': 'Beams (secondary beam breaks)',
    'beams-secondary-beam-breaks-implied': 'Beams (secondary beam breaks implied)',
    'jumps-dal-segno': 'Jumps (dal segno)',
    'jumps-ds-al-fine': 'Jumps (D.S. al Fine)',
    'lyrics-melisma': 'Lyrics (melisma)',
    'lyrics-verses': 'Lyrics (verses)',
    'octave-shifts-incomplete': 'Octave shifts (incomplete)',
    'repeats-alternate-endings': 'Repeats (alternate endings)',
    'repeats-implied-start': 'Repeats (implied start)',
    'slurs-chords': 'Slurs (chords)',
    'slurs-incomplete': 'Slurs (incomplete)',
    'slurs-targeted': 'Slurs (targeted)',
    'smufl-noteheads': 'SMuFL noteheads',
    'ties-targeted': 'Ties (targeted)',
    'time-signatures-irregular': 'Time signatures (irregular)',
    'two-bar-pickup': 'Two-bar pickup',
    'jumps-dal-segno-al-coda': 'Jumps (dal segno al coda)'
  };
  const titleOf = name => TITLE_OVERRIDES[name] ||
    (name.charAt(0).toUpperCase() + name.slice(1)).replace(/-/g, ' ');

  const RENDER_ERRORS = {
    'beams-inner-grace-notes': 'layout: unsupported feature \u2014 grace (event.grace)',
    'grace-notes': 'layout: unsupported feature \u2014 grace (event.grace)',
    'multimeasure-rests': 'layout: unsupported feature \u2014 multimeasure-rest',
    'octave-shifts': 'layout: unsupported feature \u2014 ottava (sequence-content octave-shift)',
    'tuplets': 'layout: unsupported feature \u2014 tuplet (event ratio nesting)'
  };
  const VERIFIED_SPEC = ['hello-world', 'dotted-notes', 'rests', 'ties'];
  const IDREFS = /beam|tie|slur|jump|melisma|octave-shift|repeats-alternate|tremolo/;

  const SPEC_NAMES = [
    'accidentals', 'articulations', 'beam-hooks', 'beams', 'beams-across-barlines',
    'beams-inner-grace-notes', 'beams-secondary-beam-breaks', 'beams-secondary-beam-breaks-implied',
    'clef-changes', 'dotted-notes', 'dynamics', 'grace-notes', 'hello-world',
    'jumps-dal-segno', 'jumps-ds-al-fine', 'key-signatures', 'lyrics', 'lyrics-melisma',
    'lyrics-verses', 'multimeasure-rests', 'multiple-voices', 'octave-shifts',
    'octave-shifts-incomplete', 'organ-layout', 'parts', 'repeats', 'repeats-alternate-endings',
    'repeats-implied-start', 'rests', 'slurs', 'slurs-chords', 'slurs-incomplete',
    'slurs-targeted', 'smufl-noteheads', 'stem-directions', 'string-techniques',
    'styling-comprehensive', 'system-layouts', 'tempo-markings', 'three-note-chord',
    'ties', 'ties-targeted', 'time-signatures', 'time-signatures-irregular', 'tremolos',
    'triplets', 'tuplets', 'two-bar-pickup', 'whole-measure-rests'
  ];

  // ── the real spec/accidentals document (imported from the repo) ────
  const ACCIDENTALS_JSON = {
    mnx: { support: { useAccidentalDisplay: true }, version: 1 },
    global: { measures: [{ key: { fifths: -2 }, time: { count: 4, unit: 4 } }, {}, {}] },
    parts: [{
      measures: [
        {
          clefs: [{ clef: { sign: 'G', staffPosition: -2 } }],
          sequences: [{
            content: [
              { duration: { base: 'quarter' }, notes: [{ pitch: { octave: 4, step: 'F' } }] },
              { duration: { base: 'quarter' }, notes: [{ pitch: { octave: 4, step: 'G' } }] },
              { duration: { base: 'quarter' }, notes: [{ accidentalDisplay: { show: true }, pitch: { alter: 1, octave: 4, step: 'G' } }] },
              { duration: { base: 'quarter' }, notes: [{ pitch: { octave: 4, step: 'A' } }] }
            ]
          }]
        },
        {
          sequences: [{
            content: [
              { duration: { base: 'half' }, notes: [{ pitch: { alter: -1, octave: 4, step: 'B' } }] },
              { duration: { base: 'quarter' }, notes: [{ accidentalDisplay: { show: true }, pitch: { alter: -1, octave: 5, step: 'D' } }] },
              { duration: { base: 'quarter' }, notes: [{ _c: "This note doesn't use accidentalDisplay.", pitch: { alter: -1, octave: 5, step: 'D' } }] }
            ]
          }]
        },
        {
          sequences: [{
            content: [
              { duration: { base: 'whole' }, notes: [{ accidentalDisplay: { show: true }, pitch: { octave: 5, step: 'D' } }] }
            ]
          }]
        }
      ]
    }]
  };

  const ACCIDENTALS_MUSIC = {
    time: [4, 4], keyFlats: 2,
    measures: [
      { events: [q(1), q(2), { dur: 'q', notes: [{ sp: 2, acc: '#' }] }, q(3)] },
      { events: [{ dur: 'h', notes: [{ sp: 4, lbl: 'B\u266D4' }] }, { dur: 'q', notes: [{ sp: 6, acc: 'b', lbl: 'D\u266D5' }] }, { dur: 'q', notes: [{ sp: 6, lbl: 'D\u266D5' }] }] },
      { events: [{ dur: 'w', notes: [{ sp: 6, acc: 'n', lbl: 'D\u266E5' }] }] }
    ]
  };
  const ACCIDENTALS_ANCHORS = [
    { q: '"step": "F"', n: 1 }, { q: '"step": "G"', n: 1 }, { q: '"alter": 1', n: 1 }, { q: '"step": "A"', n: 1 },
    { q: '"alter": -1', n: 1 }, { q: '"alter": -1', n: 2 }, { q: '"alter": -1', n: 3 }, { q: '"show": true', n: 3 }
  ];

  // ── the real lab/tab-part document (imported from the repo) ────────
  const STD_TUNING = [
    { string: 1, pitch: { step: 'E', octave: 4 } }, { string: 2, pitch: { step: 'B', octave: 3 } },
    { string: 3, pitch: { step: 'G', octave: 3 } }, { string: 4, pitch: { step: 'D', octave: 3 } },
    { string: 5, pitch: { step: 'A', octave: 2 } }, { string: 6, pitch: { step: 'E', octave: 2 } }
  ];
  const TABPART_JSON = {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'guitar', name: 'Guitar',
      _x: { tab: { tuning: STD_TUNING, staffKind: 'both' } },
      measures: [{
        clefs: [{ clef: { sign: 'G', staffPosition: -2, octave: -1 } }],
        sequences: [{ content: [{ duration: { base: 'whole' }, notes: [{ id: 'n1', pitch: { step: 'E', octave: 2 } }] }] }]
      }]
    }]
  };

  const OPEN_CHORD_SPS = [-7, -4, -1, 2, 4, 7]; // written E3 A3 D4 G4 B4 E5 (8vb clef)
  const OPEN_CHORD_LBLS = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
  const OPEN_CHORD_MUSIC = {
    time: [4, 4], clef: 'g8vb',
    measures: [{ events: [{ dur: 'w', notes: OPEN_CHORD_SPS.map((sp, i) => ({ sp, lbl: OPEN_CHORD_LBLS[i] })) }] }]
  };
  const OPEN_CHORD_JSON = (() => {
    const d = genMnx(OPEN_CHORD_MUSIC, { partId: 'guitar', name: 'Guitar', tab: { tuning: STD_TUNING, staffKind: 'both' } });
    d.parts[0].measures[0].sequences[0].content[0].notes.forEach((nt, i) => { nt._x = { tab: { position: { string: 6 - i, fret: 0 } } }; });
    return d;
  })();

  const TABCLEF_JSON = {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }] },
    parts: [{
      id: 'guitar', name: 'Guitar',
      measures: [{
        clefs: [{ clef: { sign: 'TAB', staffPosition: 0 } }],
        sequences: [{ content: [{ duration: { base: 'whole' }, notes: [{ id: 'n1', pitch: { step: 'E', octave: 2 } }] }] }]
      }]
    }]
  };

  const TABCLEF_NOTES = [
    'MusicXML 4.0 includes TAB in its clef-sign vocabulary, so every notation+tab guitar score converted from MusicXML naturally wants to express a TAB clef. MNX v17 cannot: clef-sign is C | F | G.',
    'The exhibit is deliberately focused: staffPosition: 0 is supplied so the only validation error is the enum rejection \u2014 even though requiring staffPosition (a pitch-to-line mapping) makes no conceptual sense for a tab staff, which has no pitch axis. That second wrinkle is itself telling: the clef object\u2019s shape assumes pitched staves throughout.',
    'Our position: this is the right rejection for the wrong reason. Tab is a view of the same semantic content, not a different clef \u2014 so the fix is not adding TAB to the enum but giving MNX a way to declare staff presentation. Until the spec has one, the _x.tab extension uses a part-level staffKind flag.',
    'History: this project\u2019s MusicXML converter originally emitted TAB clefs, which made every converted guitar score invalid and silently burned all LLM self-correction retries. Fixed 2026-06-09 by the v2 single-source migration.'
  ];

  // ── build the corpus ───────────────────────────────────────────────
  const LAB_CATEGORIES = [
    ['lab/document', 'Document basics'],
    ['lab/pitches', 'Pitches and accidentals'],
    ['lab/durations', 'Durations and rests'],
    ['lab/tab-part', 'Tab part configuration'],
    ['lab/tab-positions', 'Fingerboard positions'],
    ['lab/tab-fingering', 'Fingering'],
    ['lab/tab-techniques', 'Techniques \u2014 bends, slides, hammer-ons'],
    ['lab/tab-spec-gaps', 'Spec gaps \u2014 invalid by design'],
    ['lab/edge-cases', 'Edge cases and regressions']
  ];

  const scenarios = [];

  scenarios.push({
    id: 'lab/document/minimal-single-note', ns: 'lab', group: 'lab/document',
    title: 'Minimal valid document: one note',
    desc: 'The smallest document that validates and renders: one part, one measure, one whole note. The corpus\u2019 hello-world \u2014 every renderer regression shows up here first.',
    status: 'verified', standard: 'valid', extension: 'n/a', source: 'hand-written',
    bars: 1, idRefs: false, tags: ['document'],
    specRef: 'https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/mnx-document/',
    music: singleWhole(5), defs: 9
  });

  scenarios.push({
    id: 'lab/tab-part/standard-tuning-both', ns: 'lab', group: 'lab/tab-part',
    title: 'Standard tuning, staffKind both',
    desc: 'A one-note guitar part carrying the full part-level _x.tab extension: explicit standard tuning (six entries with explicit string numbers \u2014 array order carries no meaning) and staffKind "both", declaring that this part prefers notation + tab views derived from the single note stream. The note itself has no position annotation, so tab rendering exercises the playability heuristic.',
    status: 'rendered', standard: 'valid', extension: 'valid', source: 'hand-written',
    bars: 1, idRefs: false, tags: ['tab', 'tab:part', 'tuning'], requires: ['tab-view'],
    specRef: 'https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/part/',
    music: { time: [4, 4], clef: 'g8vb', measures: [{ events: [{ dur: 'w', notes: [{ sp: -7, lbl: 'E2' }] }] }] },
    tab: { measures: [{ events: [{ frets: [{ s: 6, f: 0 }] }] }] },
    json: TABPART_JSON, anchors: [{ q: '"id": "n1"', n: 1 }], defs: 4
  });

  scenarios.push({
    id: 'lab/tab-positions/open-strings-chord', ns: 'lab', group: 'lab/tab-positions',
    title: 'All six open strings as one chord',
    desc: 'One chord event; every note carries _x.tab.position and no two notes share a string. The degenerate-but-canonical position case: fret 0 everywhere, so the tab view is fully annotated and the heuristic is never consulted.',
    status: 'rendered', standard: 'valid', extension: 'valid', source: 'hand-written',
    bars: 1, idRefs: false, tags: ['chords', 'tab:position'], requires: ['tab-positions'],
    specRef: 'https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/note/',
    music: OPEN_CHORD_MUSIC,
    tab: { measures: [{ events: [{ frets: [6, 5, 4, 3, 2, 1].map(s => ({ s, f: 0 })) }] }] },
    json: OPEN_CHORD_JSON, defs: 7
  });

  scenarios.push({
    id: 'lab/tab-spec-gaps/tab-clef-rejected', ns: 'lab', group: 'lab/tab-spec-gaps',
    title: 'TAB clef is rejected by the clef-sign enum',
    desc: 'What every MusicXML tab staff carries \u2014 a clef with sign "TAB" \u2014 is unrepresentable in MNX v17: the clef-sign enum is C|F|G only. This document is otherwise minimal and valid; the single pinned error is the enum rejection. This is the founding exhibit for the _x.tab extension\u2019s design decision that tab-ness is a part-level view declaration, not a clef.',
    status: 'valid', standard: 'invalid', extension: 'n/a', source: 'hand-written',
    bars: 1, idRefs: false, tags: ['tab', 'spec-gap', 'clef'],
    specRef: 'https://w3c-cg.github.io/mnx/docs/mnx-reference/objects/clef/',
    issueRef: 'https://github.com/w3c-cg/mnx/issues/63',
    music: null, json: TABCLEF_JSON, notes: TABCLEF_NOTES,
    errors: [{
      rule: 'clef-sign/enum',
      msg: '"TAB" is not one of: C, F, G',
      path: 'parts[0].measures[0].clefs[0].clef.sign'
    }],
    errorAnchor: { q: '"sign": "TAB"', n: 1 }, defs: 3
  });

  SPEC_NAMES.forEach(name => {
    const s = {
      id: 'spec/' + name, ns: 'spec', group: 'spec',
      title: titleOf(name),
      desc: 'Mirror of the MNX spec worked example \u201C' + name + '\u201D. Metadata generated by sync-spec-examples.mjs \u2014 never hand-edited; resync diffs are the upstream-change tripwire.',
      status: RENDER_ERRORS[name] ? 'valid' : (VERIFIED_SPEC.includes(name) ? 'verified' : 'rendered'),
      standard: 'valid', extension: 'n/a', source: 'spec-example',
      bars: 1, idRefs: IDREFS.test(name), tags: ['spec-example'],
      specRef: 'https://w3c-cg.github.io/mnx/docs/mnx-reference/examples/' + name + '/',
      music: RENDER_ERRORS[name] ? null : musicFor(name),
      renderError: RENDER_ERRORS[name] || null,
      defs: (hashOf(name) % 14) + 6
    };
    if (name === 'accidentals') {
      s.music = ACCIDENTALS_MUSIC;
      s.json = ACCIDENTALS_JSON;
      s.anchors = ACCIDENTALS_ANCHORS;
      s.desc = 'MNX spec example \u201Caccidentals\u201D: a two-flat key, an explicit sharp via accidentalDisplay, flats carried by the key vs. shown courtesy, and a displayed natural \u2014 the full accidental-display decision tree in three bars.';
      s.defs = 28;
    }
    scenarios.push(s);
  });

  // finalize: json / noteList / anchors / coversDefs / default view
  const BASE_DEFS = ['mnx', 'global', 'part', 'measure-global', 'sequence', 'event', 'note', 'pitch', 'duration', 'note-value', 'time', 'clef'];
  const DEF_RULES = [
    [/accidental/, ['accidental-display', 'alter', 'key', 'fifths']],
    [/grace/, ['grace', 'beam']],
    [/beam/, ['beam', 'event-ref']],
    [/clef-changes/, ['clef-sign', 'positioned-clef']],
    [/key-signatures/, ['key', 'fifths']],
    [/time-signature/, ['time-signature-unit']],
    [/multimeasure/, ['multimeasure-rest']],
    [/rest/, ['rest']],
    [/dotted/, ['note-value', 'dot']],
    [/^ties/, ['tie', 'note-ref']],
    [/^slur/, ['slur', 'slur-side', 'note-ref']],
    [/lyric/, ['lyrics', 'lyric-line', 'syllable']],
    [/melisma/, ['note-ref']],
    [/jump/, ['jump', 'segno', 'fine']],
    [/repeat/, ['repeat-start', 'repeat-end', 'ending']],
    [/dynamic/, ['dynamics']],
    [/tempo/, ['tempo', 'metronome']],
    [/octave-shift/, ['octave-shift', 'event-ref']],
    [/voices/, ['voice', 'stem-direction']],
    [/chord/, ['stem-direction']],
    [/stem/, ['stem-direction']],
    [/tremolo/, ['tremolo', 'event-ref']],
    [/tuplet|triplet/, ['tuplet', 'tuplet-ratio']],
    [/smufl/, ['notehead', 'smufl-font']],
    [/organ|system|parts|layout/, ['layout', 'staff-layout']],
    [/styling/, ['style', 'color']],
    [/pickup/, ['measure-rhythmic-position']],
    [/string-techniques/, ['event-ref']],
    [/hello/, []]
  ];
  function featureDefsFor(s) {
    const n = s.id.split('/').pop();
    let out = [];
    DEF_RULES.forEach(([re, d]) => { if (re.test(n)) out = out.concat(d); });
    return [...new Set(out)];
  }

  // real coversDefs for the imported scenarios
  const REAL_DEFS = {
    'spec/accidentals': {
      covers: ['accidental-display', 'alter', 'clef', 'clef-sign', 'event', 'fifths', 'global', 'key', 'measure-global', 'mnx', 'note', 'note-value', 'note-value-base', 'octave', 'part', 'part-measure', 'pitch', 'positioned-clef', 'positive-integer', 'root', 'sequence', 'staff-position', 'step', 'string', 'support', 'time', 'time-signature-unit', 'version-number'],
      feature: ['accidental-display', 'alter', 'key', 'fifths']
    },
    'lab/tab-part/standard-tuning-both': { covers: ['part', 'vendor-extensions', 'clef', 'time'], feature: ['vendor-extensions'] },
    'lab/tab-positions/open-strings-chord': { covers: ['event', 'note', 'pitch', 'vendor-extensions'], feature: ['vendor-extensions'] },
    'lab/tab-spec-gaps/tab-clef-rejected': { covers: ['clef', 'clef-sign', 'positioned-clef'], feature: ['clef-sign', 'positioned-clef'] }
  };

  scenarios.forEach(s => {
    const real = REAL_DEFS[s.id];
    if (real) { s.coversDefs = real.covers; s.featureDefs = real.feature; }
    else {
      s.featureDefs = featureDefsFor(s);
      s.coversDefs = [...new Set(BASE_DEFS.concat(s.featureDefs))];
    }
    s.defs = s.coversDefs.length;
    if (!s.json) s.json = s.music ? genMnx(s.music) : null;
    s.jsonText = s.json ? JSON.stringify(s.json, null, 2) : '';
    s.noteList = flatNotes(s.music);
    if (!s.anchors) s.anchors = s.music ? genAnchors(s.music) : [];
    s.defaultView = s.tab ? 'both' : 'notation';
  });

  return {
    scenarios,
    LAB_CATEGORIES,
    coverage: {
      covered: 61, total: 78,
      uncovered: ['pedal', 'cue', 'breath', 'caesura', 'parenthesis', 'glissando', 'arpeggio', 'trill', 'mordent', 'turn', 'harmonics', 'let-ring', 'damp', 'scoop', 'fall', 'doit', 'bend']
    },
    manifest: { mnx: 17, tab: 2, synced: '2026-06-10' },
    h: { flatNotes, genMnx, genAnchors, pitchLabel }
  };
})();
