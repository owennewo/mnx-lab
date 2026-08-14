/**
 * The element inventory — what the destructibility sweep must try to remove
 * (roadmap/inprogress/core-element-ops-destruct-sweep.md, campaign item 2).
 *
 * The campaign's definition is "an element is anything the renderer draws
 * distinguishable ink for". That is a claim about the renderer, so the
 * renderer checks it: every primitive class drawn anywhere in the corpus must
 * be CLAIMED by a kind below or listed as STRUCTURAL_CLASSES, and
 * `harness/conformance/element-census.test.ts` fails when a class is neither.
 * The walk itself stays document-side — only noteheads and fret numbers carry
 * a `sourceId`, so the render output cannot address what it draws.
 *
 * Element or structure? *Encode the choice, not the consequence*
 * (roadmap/proposed/spec-instrument-position.md, the same rule that sorts
 * string from fret): ink that exists because the document CHOSE it is an
 * element; ink that follows from other data — a stem, a ledger line, the
 * barline every measure ends with — is structure and is never independently
 * removable. Some choices modify another element's ink instead of drawing
 * their own (`accidentalDisplay`, an explicit barline type): those are kinds
 * with no claimed class, not structure — they are removable, they just leave
 * the ink they were modifying behind.
 */
import type { MnxBeam, MnxStructure } from '../model/mnx.ts';
import type { EditOp } from './ops.ts';
import { isTimedEvent } from '../model/mnx.ts';
import { noteKeyOf } from './cursor.ts';

export type ElementKind =
  // note & event level
  | 'note' | 'kit-note' | 'tie' | 'slur' | 'lyric' | 'articulation'
  | 'accidental-display' | 'string-annotation' | 'fingering' | 'technique'
  // sequence containers
  | 'tuplet' | 'grace' | 'tremolo' | 'space' | 'full-measure-rest' | 'measure-repeat'
  // part-measure level
  | 'clef' | 'beam' | 'dynamic' | 'direction' | 'ottava'
  // global-measure level
  | 'time-signature' | 'key-signature' | 'barline' | 'repeat-start' | 'repeat-end'
  | 'ending' | 'segno' | 'fine' | 'jump' | 'tempo' | 'rehearsal' | 'section' | 'harmony'
  // part level
  | 'part-name' | 'strings' | 'capo' | 'staff-kind' | 'kit-component' | 'staves'
  // document level
  | 'layout' | 'score' | 'multimeasure-rest' | 'lyric-line-metadata' | 'sound';

/**
 * Per kind: the primitive classes it claims, why it is an element, and **the op
 * pair** — the verbs that build it and the verbs that remove it.
 *
 * A kind claiming NO class is either a modifier (it changes ink another kind
 * draws) or a renderer gap (the document carries it, nothing draws it yet) —
 * both are real elements, and the empty list is the honest record of which.
 *
 * The pair lives here, on one row, because the campaign contract requires
 * construct and destruct to be **defined together**
 * (roadmap/inprogress/core-campaign-element-ops.md): removal is not creation
 * reversed, and splitting the two across modules is how they drift. Both
 * harnesses read this table — the destruct sweep for its `no-op` verdict, the
 * construct tiers for what they are blocked on. An empty verb list is not a
 * gap in the table, it IS the campaign's remaining work, itemized.
 */
export interface ElementKindSpec {
  classes: string[];
  note: string;
  /** Ops that can bring this element into existence today. */
  construct?: EditOp['type'][];
  /** Ops that can remove it today. */
  remove?: EditOp['type'][];
}

export const ELEMENT_KINDS: Record<ElementKind, ElementKindSpec> = {
  note: {
    classes: ['notehead', 'accidental', 'fret-number', 'fret-bg'],
    note: 'The ink. Its accidental and fret number exist only because it does.',
    construct: ['insertNote', 'insertPitchNote'],
    remove: ['deleteNote']
  },
  'kit-note': { classes: [], note: 'Percussion kit note — drawn as a notehead by the kit component.' },
  tie: {
    classes: ['tie'],
    note: 'A curve between two notes; reference removal class.',
    construct: ['toggleTie'],
    remove: ['toggleTie']
  },
  slur: { classes: ['slur'], note: 'A curve between two events; reference removal class.' },
  lyric: { classes: ['lyric', 'lyric-hyphen'], note: 'One syllable of one line under an event.' },
  articulation: {
    classes: ['articulation', 'tremolo'],
    note: 'One event marking (accent, staccato, single-note tremolo…).'
  },
  'accidental-display': { classes: [], note: 'Modifier: forces or parenthesizes the note accidental.' },
  'string-annotation': {
    classes: [],
    note: 'Modifier: chooses which string a note is played on.',
    construct: ['setFret']
  },
  fingering: { classes: [], note: 'Renderer gap — carried by the document, nothing draws it yet.' },
  technique: { classes: [], note: 'Renderer gap — core-guitar-technique.md owns the drawing half.' },
  tuplet: { classes: ['tuplet-bracket', 'tuplet-number'], note: 'A time-modifying container.' },
  grace: {
    classes: ['grace-slash'],
    note: 'An un-timed container. Its only ink of its own is the slash — the `grace` token merely sizes the notes it holds.'
  },
  tremolo: { classes: ['tremolo-beam'], note: 'A two-event tremolo container.' },
  space: { classes: [], note: 'Authored silence that occupies a column but draws nothing.' },
  'full-measure-rest': {
    classes: ['rest-full-measure'],
    note: 'A rest is absence (§8.11) — but DECLARING the whole bar rests is a choice.'
  },
  'measure-repeat': { classes: [], note: 'Renderer gap — the repeat sign is not drawn yet.' },
  clef: {
    classes: ['clef', 'clef-change'],
    note: 'Inherited-attribute removal class: removing the DECLARATION reverts the bar to its predecessor’s governance (or the engine default), never to "no clef".',
    construct: ['setClef'],
    remove: ['removeClef']
  },
  beam: { classes: ['beam'], note: 'Authored beaming over event ids; the stroke is its ink.' },
  dynamic: { classes: ['dynamic'], note: 'A dynamic group at a metric position.' },
  direction: { classes: ['direction'], note: 'A text/symbolic instruction (proposed field).' },
  ottava: { classes: ['ottava', 'ottava-label'], note: 'An octave-shift line.' },
  'time-signature': {
    classes: ['time-sig', 'time-sig-num', 'time-sig-den'],
    note: 'Inherited-attribute removal class: reverts to the predecessor.',
    // `setTimeSignature` overwrites but cannot un-declare — the asymmetry the
    // campaign opened on.
    construct: ['setTimeSignature']
  },
  'key-signature': {
    classes: ['key-sig'],
    note: 'Inherited-attribute removal class; removal reverts to the predecessor, or C.',
    construct: ['setKeySignature'],
    remove: ['removeKeySignature']
  },
  barline: {
    classes: [],
    note: 'Modifier: every measure ends with a barline; this picks its type, so removal returns the default stroke rather than removing ink.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  'repeat-start': {
    classes: ['repeat-start'],
    note: 'Forward repeat at the measure start.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  'repeat-end': {
    classes: ['repeat-end', 'repeat-dot', 'repeat-times'],
    note: 'Backward repeat.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  ending: {
    classes: ['ending', 'ending-label'],
    note: 'A volta bracket over a measure range.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  segno: {
    classes: ['segno'],
    note: 'A segno sign at a metric position.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  fine: {
    classes: ['fine'],
    note: 'A fine marking at a metric position.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  jump: {
    classes: ['jump'],
    note: 'A D.S./D.S. al Fine instruction.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  tempo: {
    classes: ['tempo'],
    note: 'A metronome mark.',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  rehearsal: {
    classes: ['rehearsal-box', 'rehearsal-label'],
    note: 'A rehearsal mark (proposed field).',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  section: {
    classes: ['section-label'],
    note: 'A formal section label (proposed field).',
    construct: ['setMeasureAttribute'],
    remove: ['removeMeasureAttribute']
  },
  harmony: { classes: [], note: 'Renderer gap — core-chord-symbols.md owns the drawing half.' },
  'part-name': {
    classes: ['staff-label'],
    note: 'The name drawn left of the part’s staff.',
    // `addPart` takes the name, so creating one is real. Nothing STRIPS a
    // name: `removePart` removes the whole (empty) part, which is its
    // container's verb, not this element's — the distinction the drift test
    // caught the moment this row claimed otherwise.
    construct: ['addPart']
  },
  strings: {
    classes: ['tab-tuning-letter'],
    note: 'The declared fingerboard; without it there is no tab.',
    construct: ['setTuning']
  },
  capo: { classes: ['tab-capo'], note: 'The capo declaration, drawn on the tab staff.' },
  'staff-kind': {
    classes: ['tab-clef'],
    note: 'The part’s projection choice; the tab clef is its ink.',
    construct: ['setStaffKind']
  },
  'kit-component': { classes: [], note: 'One percussion kit mapping; its notes draw noteheads.' },
  staves: { classes: [], note: 'Modifier: how many staves the part is notated on.' },
  layout: {
    classes: ['brace', 'bracket', 'group-label', 'source-label'],
    note: 'A system layout: staff grouping, braces and their labels.'
  },
  score: { classes: ['score-title'], note: 'One presentation of the document.' },
  'multimeasure-rest': {
    classes: ['multirest-bar', 'multirest-cap', 'multirest-count'],
    note: 'A collapsed measure range inside a score.'
  },
  'lyric-line-metadata': { classes: [], note: 'A lyric line’s label/language (drawn as lyric ink).' },
  sound: { classes: [], note: 'A named sound the kit maps onto; audio only, never drawn.' }
};

/**
 * Ink that is a CONSEQUENCE, never an element: no op can remove it and no
 * selection should address it. Each reason is the argument for its place here.
 */
export const STRUCTURAL_CLASSES: Record<string, string> = {
  'staff-line': 'the staff itself',
  'ledger-line': 'the staff extended under a notehead',
  stem: 'a consequence of the event’s duration and beaming',
  flag: 'a consequence of an unbeamed duration',
  dot: 'a consequence of duration.dots',
  rest: 'absence, not an element (§8.11) — the walker enumerates ink',
  barline: 'every measure ends with one, authored or not',
  'barline-final-thin': 'the final barline pair',
  'barline-final-thick': 'the final barline pair',
  'barline-start': 'the system-start barline',
  grace: 'a modifier token on grace-sized ink, not ink of its own',
  'diagnostic-marker': 'renderer diagnostics — our output, not the document’s content',
  'diagnostic-validation': 'renderer diagnostics — our output, not the document’s content',
  'mnx-tab-svg': 'the tab staff’s root group'
};

/** Can ANY op in the union bring this kind into existence today? The forward
 *  half of the pair, and the construct tiers' whole basis: a scenario is
 *  blocked by exactly the kinds for which this is false
 *  (roadmap/inprogress/core-element-ops-construct-traces.md). */
export function kindHasConstructOp(kind: ElementKind): boolean {
  return (ELEMENT_KINDS[kind].construct?.length ?? 0) > 0;
}

export interface ElementRef {
  kind: ElementKind;
  /** Stable positional address, unique within the document. */
  path: string;
  /** Present when the ops layer can name this element today: a note inside
   *  `parts[0]`, staff 1 — the entry surface `deleteNote` addresses. */
  noteKey?: string;
  /** For elements ATTACHED to a note (a tie, a technique, a string choice):
   *  the key of the note that carries them. Their verbs act through the note
   *  — `toggleTie` addresses the note and toggles what hangs off it — so the
   *  sweep needs the owner's key, not one of their own. */
  ownerNoteKey?: string;
  /** For MEASURE-scoped attributes (clef, key signature): the measure their
   *  verbs address, set only when the ops layer can actually reach it — the
   *  entry surface, at the start of the bar. A mid-measure clef or one on a
   *  second part has no index here, which is how the sweep reports it as
   *  unaddressable rather than pretending. */
  measureIndex?: number;
  /** Where the element lives, for the surviving-document oracle. */
  jsonPath: (string | number)[];
}

function push(
  out: ElementRef[],
  kind: ElementKind,
  path: string,
  jsonPath: (string | number)[],
  noteKey?: string
): void {
  out.push(noteKey ? { kind, path, jsonPath, noteKey } : { kind, path, jsonPath });
}

/** A measure-scoped attribute, addressed by navigating to its bar. */
function pushAtMeasure(
  out: ElementRef[],
  kind: ElementKind,
  path: string,
  jsonPath: (string | number)[],
  measureIndex: number | undefined
): void {
  out.push(measureIndex === undefined ? { kind, path, jsonPath } : { kind, path, jsonPath, measureIndex });
}

/** An element hanging off a note: it carries the OWNER's key, because its
 *  verbs are aimed at the note (address the note, press T). */
function pushOnNote(
  out: ElementRef[],
  kind: ElementKind,
  path: string,
  jsonPath: (string | number)[],
  ownerNoteKey?: string
): void {
  out.push(ownerNoteKey ? { kind, path, jsonPath, ownerNoteKey } : { kind, path, jsonPath });
}

function walkBeams(
  out: ElementRef[],
  beams: MnxBeam[] | undefined,
  path: string,
  jsonPath: (string | number)[]
): void {
  (beams ?? []).forEach((beam, index) => {
    push(out, 'beam', `${path}/b${index}`, [...jsonPath, index]);
    walkBeams(out, beam.beams, `${path}/b${index}`, [...jsonPath, index, 'beams']);
  });
}

/** Container items carry events; the events' own elements are enumerated the
 *  same way wherever they sit, so a grace note is as much an element as a
 *  plain one — only its container is extra. */
function walkEvent(
  out: ElementRef[],
  event: Record<string, unknown>,
  path: string,
  jsonPath: (string | number)[],
  keyOf: ((noteIndex: number, note: Record<string, unknown>) => string | undefined) | null
): void {
  const notes = (event.notes ?? []) as Record<string, unknown>[];
  notes.forEach((note, noteIndex) => {
    const notePath = `${path}/n${noteIndex}`;
    const noteJson = [...jsonPath, 'notes', noteIndex];
    const ownerKey = keyOf?.(noteIndex, note);
    push(out, 'note', notePath, noteJson, ownerKey);
    for (const [tieIndex] of ((note.ties ?? []) as unknown[]).entries())
      pushOnNote(out, 'tie', `${notePath}/tie${tieIndex}`, [...noteJson, 'ties', tieIndex], ownerKey);
    if (note.accidentalDisplay)
      pushOnNote(out, 'accidental-display', `${notePath}/acc`, [...noteJson, 'accidentalDisplay'], ownerKey);
    const x = (note._x as { mnxLab?: Record<string, unknown> } | undefined)?.mnxLab;
    if (x) {
      const xJson = [...noteJson, '_x', 'mnxLab'];
      if (x.string !== undefined)
        pushOnNote(out, 'string-annotation', `${notePath}/string`, [...xJson, 'string'], ownerKey);
      if (x.fingering)
        pushOnNote(out, 'fingering', `${notePath}/fingering`, [...xJson, 'fingering'], ownerKey);
      const technique = (x.tab as { technique?: Record<string, unknown> } | undefined)?.technique;
      for (const name of Object.keys(technique ?? {}))
        pushOnNote(
          out, 'technique', `${notePath}/technique/${name}`, [...xJson, 'tab', 'technique', name], ownerKey
        );
    }
  });
  for (const [kitIndex] of ((event.kitNotes ?? []) as unknown[]).entries())
    push(out, 'kit-note', `${path}/kit${kitIndex}`, [...jsonPath, 'kitNotes', kitIndex]);
  for (const [slurIndex] of ((event.slurs ?? []) as unknown[]).entries())
    push(out, 'slur', `${path}/slur${slurIndex}`, [...jsonPath, 'slurs', slurIndex]);
  for (const line of Object.keys(
    (event.lyrics as { lines?: Record<string, unknown> } | undefined)?.lines ?? {}
  ))
    push(out, 'lyric', `${path}/lyric/${line}`, [...jsonPath, 'lyrics', 'lines', line]);
  for (const marking of Object.keys((event.markings ?? {}) as Record<string, unknown>))
    push(out, 'articulation', `${path}/marking/${marking}`, [...jsonPath, 'markings', marking]);
}

function walkContent(
  out: ElementRef[],
  content: unknown[] | undefined,
  path: string,
  jsonPath: (string | number)[],
  keyOf: ((eventIndex: number, noteIndex: number, note: Record<string, unknown>) => string | undefined) | null
): void {
  (content ?? []).forEach((raw, index) => {
    const item = raw as Record<string, unknown>;
    const itemPath = `${path}/e${index}`;
    const itemJson = [...jsonPath, index];
    const type = item.type as string | undefined;
    if (type === 'tuplet' || type === 'grace' || type === 'tremolo' || type === 'space') {
      push(out, type as ElementKind, itemPath, itemJson);
      // Container content keeps its own elements, minus an ops-layer key: the
      // entry surface cannot address inside a container yet.
      walkContent(out, item.content as unknown[] | undefined, `${itemPath}/c`, [...itemJson, 'content'], null);
      return;
    }
    if (!isTimedEvent(raw as never)) return;
    walkEvent(out, item, itemPath, itemJson, keyOf ? (n, note) => keyOf(index, n, note) : null);
  });
}

/**
 * Every element of a document, in document order. Deliberately independent of
 * `forEachKeyedNote`, which sees only the entry surface (`parts[0]`, staff 1):
 * the sweep must enumerate the ink the editor CANNOT reach, since that gap is
 * the finding.
 */
export function walkElements(doc: MnxStructure): ElementRef[] {
  const out: ElementRef[] = [];

  (doc.global?.measures ?? []).forEach((measure, measureIndex) => {
    const path = `g/m${measureIndex}`;
    const json: (string | number)[] = ['global', 'measures', measureIndex];
    const at = (kind: ElementKind, field: string) => {
      if ((measure as unknown as Record<string, unknown>)[field] !== undefined)
        // Global-measure attributes are addressed by navigating to their bar
        // (campaign item 7's family, and item 5's key signature before it).
        pushAtMeasure(out, kind, `${path}/${field}`, [...json, field], measureIndex);
    };
    at('time-signature', 'time');
    if (measure.key !== undefined)
      pushAtMeasure(out, 'key-signature', `${path}/key`, [...json, 'key'], measureIndex);
    at('barline', 'barline');
    at('repeat-start', 'repeatStart');
    at('repeat-end', 'repeatEnd');
    at('ending', 'ending');
    at('segno', 'segno');
    at('fine', 'fine');
    at('jump', 'jump');
    at('rehearsal', 'rehearsal');
    at('section', 'section');
    for (const [tempoIndex] of (measure.tempos ?? []).entries())
      pushAtMeasure(out, 'tempo', `${path}/tempo${tempoIndex}`, [...json, 'tempos', tempoIndex], measureIndex);
    for (const [harmonyIndex] of (measure._x?.mnxLab?.harmonies ?? []).entries())
      push(out, 'harmony', `${path}/harmony${harmonyIndex}`, [
        ...json, '_x', 'mnxLab', 'harmonies', harmonyIndex
      ]);
  });

  for (const line of Object.keys(doc.global?.lyrics?.lineMetadata ?? {}))
    push(out, 'lyric-line-metadata', `g/lyricline/${line}`, [
      'global', 'lyrics', 'lineMetadata', line
    ]);
  for (const sound of Object.keys(
    (doc.global as { sounds?: Record<string, unknown> } | undefined)?.sounds ?? {}
  ))
    push(out, 'sound', `g/sound/${sound}`, ['global', 'sounds', sound]);

  (doc.parts ?? []).forEach((part, partIndex) => {
    const partPath = `p${partIndex}`;
    const partJson: (string | number)[] = ['parts', partIndex];
    if (part.name !== undefined) push(out, 'part-name', `${partPath}/name`, [...partJson, 'name']);
    if (part.staves !== undefined) push(out, 'staves', `${partPath}/staves`, [...partJson, 'staves']);
    const x = part._x?.mnxLab;
    if (x?.strings) push(out, 'strings', `${partPath}/strings`, [...partJson, '_x', 'mnxLab', 'strings']);
    if (x?.capo !== undefined) push(out, 'capo', `${partPath}/capo`, [...partJson, '_x', 'mnxLab', 'capo']);
    if (x?.tab?.staffKind)
      push(out, 'staff-kind', `${partPath}/staffKind`, [...partJson, '_x', 'mnxLab', 'tab', 'staffKind']);
    for (const component of Object.keys(
      (part as { kit?: Record<string, unknown> }).kit ?? {}
    ))
      push(out, 'kit-component', `${partPath}/kit/${component}`, [...partJson, 'kit', component]);

    (part.measures ?? []).forEach((measure, measureIndex) => {
      const measurePath = `${partPath}/m${measureIndex}`;
      const measureJson = [...partJson, 'measures', measureIndex];
      for (const [clefIndex, positioned] of (measure.clefs ?? []).entries()) {
        const reachable =
          partIndex === 0 && (positioned.staff ?? 1) === 1 && positioned.position === undefined;
        pushAtMeasure(
          out,
          'clef',
          `${measurePath}/clef${clefIndex}`,
          [...measureJson, 'clefs', clefIndex],
          reachable ? measureIndex : undefined
        );
      }
      for (const [dynamicIndex] of (measure.dynamics ?? []).entries())
        push(out, 'dynamic', `${measurePath}/dyn${dynamicIndex}`, [...measureJson, 'dynamics', dynamicIndex]);
      for (const [directionIndex] of (measure.directions ?? []).entries())
        push(out, 'direction', `${measurePath}/dir${directionIndex}`, [
          ...measureJson, 'directions', directionIndex
        ]);
      for (const [ottavaIndex] of (measure.ottavas ?? []).entries())
        push(out, 'ottava', `${measurePath}/ottava${ottavaIndex}`, [
          ...measureJson, 'ottavas', ottavaIndex
        ]);
      if ((measure as unknown as Record<string, unknown>).measureRepeat !== undefined)
        push(out, 'measure-repeat', `${measurePath}/measureRepeat`, [...measureJson, 'measureRepeat']);
      walkBeams(out, measure.beams, `${measurePath}/beam`, [...measureJson, 'beams']);

      // The ops layer's note keys exist only for staff-1 sequences of parts[0]
      // — `forEachKeyedNote`'s traversal, mirrored here so a key means exactly
      // what `deleteNote` means by it. Voice index counts staff-1 sequences.
      let staffOneVoice = -1;
      (measure.sequences ?? []).forEach((sequence, sequenceIndex) => {
        const onStaffOne = (sequence.staff ?? 1) === 1;
        if (onStaffOne) staffOneVoice++;
        const voiceIndex = staffOneVoice;
        const addressable = partIndex === 0 && onStaffOne;
        const sequencePath = `${measurePath}/v${sequenceIndex}`;
        const sequenceJson = [...measureJson, 'sequences', sequenceIndex];
        if (sequence.fullMeasure)
          push(out, 'full-measure-rest', `${sequencePath}/fullMeasure`, [...sequenceJson, 'fullMeasure']);
        walkContent(
          out,
          sequence.content,
          sequencePath,
          [...sequenceJson, 'content'],
          addressable
            ? (eventIndex, noteIndex, note) =>
                noteKeyOf(note as never, measureIndex, voiceIndex, eventIndex, noteIndex)
            : null
        );
      });
    });
  });

  (doc.layouts ?? []).forEach((_layout, layoutIndex) =>
    push(out, 'layout', `layout${layoutIndex}`, ['layouts', layoutIndex])
  );
  (doc.scores ?? []).forEach((score, scoreIndex) => {
    push(out, 'score', `score${scoreIndex}`, ['scores', scoreIndex]);
    for (const [restIndex] of (score.multimeasureRests ?? []).entries())
      push(out, 'multimeasure-rest', `score${scoreIndex}/mmr${restIndex}`, [
        'scores', scoreIndex, 'multimeasureRests', restIndex
      ]);
  });

  return out;
}
