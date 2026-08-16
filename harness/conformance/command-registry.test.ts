// The command registry (roadmap/inprogress/core-selection-tray-mechanism.md):
// the joins that keep the selection tray honest.
//
// The tray is a pure function of registry + session, so what can rot silently
// is the registry's agreement with everything it references: keys that no
// binding fires, intents outside the vocabulary, glyph names the font does
// not have, rungs the ladder does not offer. Each is a join, and each is
// cheap — which is the whole argument for the registry living in `edit/`
// rather than the workbench, where the harness could not reach it.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMANDS,
  commandState,
  commandsForScope,
  selectionMemberSummary,
  sessionView,
  type EditorCommand
} from '../../src/edit/commandRegistry.ts';
import { KEY_DOCS, strokeKey, SURFACE_INTENTS } from '../../src/edit/keymapDocs.ts';
import {
  EDIT_LAYER,
  NAVIGATION_LAYER,
  SHELL_BINDINGS,
  TAB_DIGIT_LAYER
} from '../../src/edit/keymap.ts';
import { SELECTION_LADDER } from '../../src/edit/selection.ts';
import { EditorSession, replayIntents } from '../../src/edit/session.ts';
import type { MnxNote, MnxPitch, MnxStructure } from '../../src/model/mnx.ts';
import { STANDARD_GUITAR_STRINGS } from '../../src/model/mnx.ts';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

const note = (id: string, step: MnxPitch['step'], octave: number, string: number): MnxNote => ({
  id,
  pitch: { step, octave },
  _x: { mnxLab: { string } }
});

/** Two bars, one voice, a declared instrument — enough to walk the ladder and
 *  to give every rung something to be about. */
function makeDoc(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ time: { count: 4, unit: 4 } }, {}] },
    parts: [
      {
        id: 'p1',
        measures: [
          {
            sequences: [
              {
                content: [
                  // Same pitch twice: a tie needs a matching note to land on,
                  // so this is what makes the tie tile's state observable.
                  { duration: { base: 'quarter' }, notes: [note('n1', 'E', 4, 1)] },
                  { duration: { base: 'quarter' }, notes: [note('n2', 'E', 4, 1)] }
                ]
              }
            ]
          },
          { sequences: [{ content: [{ duration: { base: 'whole' }, rest: {} }] }] }
        ],
        _x: { mnxLab: { strings: [...STANDARD_GUITAR_STRINGS] } }
      }
    ]
  };
}

const view = () => sessionView(new EditorSession(makeDoc()));

/** Every stroke any binding table claims, in the docs' canonical form. */
function boundStrokeLabels(): Set<string> {
  const labels = new Set<string>();
  for (const doc of KEY_DOCS) {
    const bound = doc.strokes.map(strokeKey);
    const anyBound = [
      ...NAVIGATION_LAYER.bindings,
      ...EDIT_LAYER.bindings,
      ...TAB_DIGIT_LAYER.bindings,
      ...SHELL_BINDINGS
    ].some(b => bound.includes(strokeKey(b)));
    if (anyBound) labels.add(doc.keys);
  }
  return labels;
}

describe('command registry — the joins', () => {
  it('every id is unique', () => {
    const seen = new Map<string, number>();
    for (const command of COMMANDS) seen.set(command.id, (seen.get(command.id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it('every scope named is a real ladder rung, or `document`', () => {
    const scopes = new Set<string>([...SELECTION_LADDER, 'document']);
    const strays = COMMANDS.flatMap(c => c.scopes.filter(r => !scopes.has(r)));
    expect(strays).toEqual([]);
  });

  it('every command is reachable from some scope', () => {
    // A command no tab can show is dead weight the tray would never draw.
    const orphans = COMMANDS.filter(c => c.scopes.length === 0);
    expect(orphans.map(c => c.id)).toEqual([]);
  });

  it('the document scope offers commands, and never mixes with a rung', () => {
    // `document` is the scope ABOVE the ladder (the tray's `global` tab), so a
    // command claiming both it and a rung would appear twice with two
    // different meanings of "here".
    const global = COMMANDS.filter(c => c.scopes.includes('document'));
    expect(global.length).toBeGreaterThan(0);
    const mixed = global.filter(c => c.scopes.length > 1);
    expect(mixed.map(c => c.id)).toEqual([]);
  });

  it('every shortcut names a key some table actually binds', () => {
    // The tile's chip is a PROMISE that the key works outside the tray. A
    // shortcut nothing binds teaches a keystroke that does nothing.
    const labels = boundStrokeLabels();
    const unbound = COMMANDS.filter(
      c => c.shortcut && ![...labels].some(label => label.includes(c.shortcut!))
    );
    expect(unbound.map(c => `${c.id}: ${c.shortcut}`)).toEqual([]);
  });

  it('every surface action opens a real shell surface', () => {
    const surfaces = new Set(Object.keys(SURFACE_INTENTS));
    // rhythmPopover is bound and real; SURFACE_INTENTS lists the intent join
    // per surface, so anything the registry opens must appear there or be a
    // bound shell action.
    const shellActions = new Set(SHELL_BINDINGS.map(b => b.action));
    const bad: string[] = [];
    for (const command of COMMANDS) {
      const action = command.action?.(view());
      if (action && 'surface' in action) {
        if (!surfaces.has(action.surface) && !shellActions.has(action.surface)) {
          bad.push(`${command.id}: ${action.surface}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every intent action names a type the session handles', () => {
    // The registry may not invent verbs: the session's switch is the
    // vocabulary, and an unhandled type would be a tile that silently does
    // nothing.
    const source = fs.readFileSync(path.join(ROOT, 'src/edit/session.ts'), 'utf8');
    const handled = new Set([...source.matchAll(/case '([a-zA-Z]+)'/g)].map(m => m[1]));
    const unhandled: string[] = [];
    for (const command of COMMANDS) {
      const action = command.action?.(view());
      if (action && 'intent' in action && !handled.has(action.intent.type)) {
        unhandled.push(`${command.id}: ${action.intent.type}`);
      }
    }
    expect(unhandled).toEqual([]);
  });

  it('every glyph name exists in the SMuFL metadata, with a bounding box', () => {
    // The tray draws each glyph into its own ink box; a name the font does
    // not carry falls back to a literal "?" on the tile.
    const names = fs.readFileSync(path.join(ROOT, 'public/smufl/glyphnames.json'), 'utf8');
    const metadata = fs.readFileSync(
      path.join(ROOT, 'public/smufl/bravura_metadata.json'),
      'utf8'
    );
    const glyphnames = JSON.parse(names) as Record<string, unknown>;
    const boxes = (JSON.parse(metadata) as { glyphBBoxes: Record<string, unknown> }).glyphBBoxes;
    const bad: string[] = [];
    for (const command of COMMANDS) {
      if (!('smufl' in command.glyph)) continue;
      const name = command.glyph.smufl;
      if (!glyphnames[name]) bad.push(`${command.id}: ${name} (no such glyph)`);
      else if (!boxes[name]) bad.push(`${command.id}: ${name} (no bounding box)`);
    }
    expect(bad).toEqual([]);
  });

  it('an unwired command names its residue row, and a wired one does not', () => {
    // The ledger and the tiles must not drift: every greyed tile has an
    // address in core-selection-tray-residue.md, and a command that fires
    // carries no stale blocker.
    const v = view();
    const missing = COMMANDS.filter(c => !c.action && !c.blockedBy);
    const stale = COMMANDS.filter(c => c.action?.(v) && c.blockedBy);
    expect(missing.map(c => c.id)).toEqual([]);
    expect(stale.map(c => c.id)).toEqual([]);
  });
});

describe('command registry — the funnel', () => {
  it('a fired command lands in the op log carrying its intent', () => {
    // The mechanism's one ruling: tiles fire intents through the session, so
    // a tray edit is indistinguishable from a keystroke downstream — undoable,
    // in the op queue with provenance, and replayable in a trace. If a command
    // ever reached `applyOp` directly, the op would arrive with no intent
    // stamped and this would catch it.
    const session = new EditorSession(makeDoc());
    const staccato = COMMANDS.find(c => c.id === 'staccato')!;
    const action = staccato.action!(sessionView(session));
    session.handleIntent((action as { intent: never }).intent);

    const applied = session.opQueue.applied;
    expect(applied).toHaveLength(1);
    expect(applied[0].op.type).toBe('setMarking');
    expect(applied[0].intent).toEqual({ type: 'setMarking', marking: 'staccato' });

    // …and it is undoable, like every other edit.
    expect(session.canUndo).toBe(true);
    session.handleIntent({ type: 'undo' });
    expect(sessionView(session).markings).toEqual([]);
  });

  it('every wired intent command is replayable from a trace', () => {
    // Traces are written in intents, so what a tile fires must survive the
    // recording. Replaying the intents a rung's commands produce must not
    // throw — the cheap proof that nothing in the registry emits a shape the
    // session cannot read back.
    const session = new EditorSession(makeDoc());
    const intents = commandsForScope('note', sessionView(session))
      .map(command => command.action?.(sessionView(session)))
      .filter((a): a is { intent: never } => !!a && 'intent' in a)
      .map(a => a.intent);
    expect(intents.length).toBeGreaterThan(0);
    expect(() => replayIntents(makeDoc(), intents)).not.toThrow();
  });
});

describe('command registry — rung filtering', () => {
  it('a command never offers a rung where its key is documented inert', () => {
    // The cheatsheet says what a key means at each rung, and an ABSENT rung
    // means the key does nothing there (keymap-docs.test.ts mirrors that
    // against the session's guards). A tile offering the same command at such
    // a rung would contradict the cheatsheet on the same screen.
    const contradictions: string[] = [];
    for (const command of COMMANDS) {
      if (!command.shortcut) continue;
      const doc = KEY_DOCS.find(d => d.keys === command.shortcut);
      if (!doc || doc.meaning.all !== undefined) continue;
      const documented = new Set(Object.keys(doc.meaning));
      // `document` has no rung, so no per-rung meaning can contradict it.
      for (const rung of command.scopes.filter(s => s !== 'document')) {
        if (!documented.has(rung)) contradictions.push(`${command.id} @ ${rung} (${doc.keys})`);
      }
    }
    expect(contradictions).toEqual([]);
  });

  it('offers commands at every rung the ladder can reach', () => {
    // A rung whose tab is empty is a dead tab; the tray shows all seven.
    const v = view();
    const empty = SELECTION_LADDER.filter(level => commandsForScope(level, v).length === 0);
    expect(empty).toEqual([]);
  });

  it('a projection-specific command appears only in its own dialect', () => {
    // `S` slurs in notation and slides in tab (campaign items 9/10 resolved
    // the collision by projection) — the tray must not offer both at once.
    const session = new EditorSession(makeDoc());
    // A document with strings opens in the tab projection, so notation is the
    // deliberate move here rather than the default.
    session.handleIntent({ type: 'setProjection', projection: 'notation' });
    const notation = sessionView(session);
    expect(notation.projection).toBe('notation');
    const inNotation = commandsForScope('note', notation).map(c => c.id);
    expect(inNotation).toContain('slur');
    expect(inNotation).not.toContain('slide');

    session.handleIntent({ type: 'setProjection', projection: 'tab' });
    const inTab = commandsForScope('note', sessionView(session)).map(c => c.id);
    expect(inTab).toContain('slide');
    expect(inTab).not.toContain('slur');
  });
});

describe('command registry — state reads the document', () => {
  const find = (id: string): EditorCommand => COMMANDS.find(c => c.id === id)!;

  it('an unwired command always draws unavailable', () => {
    // `arpeggio` has no op yet and names its residue row; respell used to sit
    // here and now fires, which is the ledger doing its job.
    expect(commandState(find('arpeggio'), view())).toBe('unavailable');
  });

  it('a marking tile turns active once the mark is on the event, and removes it', () => {
    const session = new EditorSession(makeDoc());
    const staccato = find('staccato');
    expect(commandState(staccato, sessionView(session))).toBe('available');

    const before = sessionView(session);
    const action = staccato.action!(before);
    expect(action).toEqual({ intent: { type: 'setMarking', marking: 'staccato' } });
    session.handleIntent((action as { intent: never }).intent);

    const after = sessionView(session);
    expect(commandState(staccato, after)).toBe('active');
    // The active tile IS the remove (the design's rule).
    expect(staccato.action!(after)).toEqual({
      intent: { type: 'removeMarking', marking: 'staccato' }
    });
  });

  it('a bar attribute turns active on the cursor’s own bar', () => {
    const session = new EditorSession(makeDoc());
    const repeatEnd = find('repeat-end');
    expect(commandState(repeatEnd, sessionView(session))).toBe('available');

    session.handleIntent({
      type: 'setMeasureAttribute',
      attribute: { kind: 'repeatEnd' }
    });
    expect(commandState(repeatEnd, sessionView(session))).toBe('active');

    // Bar 2 is a different bar: the same command reads available there.
    session.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(commandState(repeatEnd, sessionView(session))).toBe('available');
  });

  it('the tie tile follows the note under the cursor', () => {
    const session = new EditorSession(makeDoc());
    const tie = find('tie');
    expect(commandState(tie, sessionView(session))).toBe('available');
    session.handleIntent({ type: 'toggleTie' });
    expect(commandState(tie, sessionView(session))).toBe('active');
  });

  it('a partial range is mixed, applies to all in one undo entry, and keeps the range', () => {
    const session = new EditorSession(makeDoc());
    const staccato = find('staccato');
    session.handleIntent({ type: 'setMarking', marking: 'staccato' });
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    const selection = session.selection;

    expect(commandState(staccato, sessionView(session))).toBe('mixed');
    expect(selectionMemberSummary(sessionView(session))).toBe('2 notes');
    expect(staccato.action!(sessionView(session))).toEqual({
      intent: { type: 'setMarking', marking: 'staccato' }
    });

    const entries = session.opQueue.applied.length;
    session.handleIntent({ type: 'setMarking', marking: 'staccato' });
    expect(session.opQueue.applied).toHaveLength(entries + 1);
    expect(session.opQueue.applied.at(-1)?.op).toMatchObject({ type: 'batch' });
    expect(commandState(staccato, sessionView(session))).toBe('active');
    expect(session.selection).toEqual(selection);

    session.handleIntent({ type: 'undo' });
    expect(commandState(staccato, sessionView(session))).toBe('mixed');
    expect(session.selection).toEqual(selection);
  });

  it('the section and part scope tiles commit structural ranges through intents', () => {
    const doc = makeDoc();
    doc.global!.measures![0].section = { label: 'A' };
    const section = new EditorSession(doc);
    while (section.selectionLevel !== 'section') {
      section.handleIntent({ type: 'relaxSelection' });
    }
    const sectionRange = find('section-range').action!(sessionView(section));
    expect(sectionRange).toEqual({ intent: { type: 'selectSectionRange' } });
    section.handleIntent((sectionRange as { intent: never }).intent);
    expect(section.selectionLevel).toBe('measure');
    expect(section.resolvedSelection.members).toHaveLength(2);

    const part = new EditorSession(makeDoc());
    while (part.selectionLevel !== 'partMeasure') {
      part.handleIntent({ type: 'relaxSelection' });
    }
    const partScope = find('part-scope').action!(sessionView(part));
    expect(partScope).toEqual({ intent: { type: 'closeSelection' } });
    part.handleIntent((partScope as { intent: never }).intent);
    expect(part.selection.extent).toEqual({ kind: 'closure', scope: 'part' });
  });

  it('bulk event and measure commands include rests and keep one history envelope', () => {
    const events = new EditorSession(makeDoc());
    events.handleIntent({ type: 'relaxSelection' });
    events.handleIntent({ type: 'closeSelection' });
    const eventSelection = events.selection;
    expect(events.resolvedSelection.members).toHaveLength(3);
    expect(events.handleIntent({ type: 'setMarking', marking: 'accent' })).toBe(true);
    expect(events.opQueue.applied).toHaveLength(1);
    expect(events.opQueue.applied[0].op).toMatchObject({ type: 'batch' });
    expect(events.doc.parts?.[0].measures?.[1].sequences?.[0].content[0]).toMatchObject({
      markings: { accent: {} },
      rest: {}
    });
    expect(events.selection).toEqual(eventSelection);

    const bars = new EditorSession(makeDoc());
    while (bars.selectionLevel !== 'measure') bars.handleIntent({ type: 'relaxSelection' });
    bars.handleIntent({
      type: 'setMeasureAttribute',
      attribute: { kind: 'repeatEnd' }
    });
    bars.handleIntent({ type: 'extendSelection', direction: 'next' });
    const barSelection = bars.selection;
    expect(commandState(find('repeat-end'), sessionView(bars))).toBe('mixed');
    expect(bars.handleIntent({
      type: 'setMeasureAttribute',
      attribute: { kind: 'repeatEnd' }
    })).toBe(true);
    expect(bars.opQueue.applied).toHaveLength(2);
    expect(bars.opQueue.applied[1].op).toMatchObject({ type: 'batch' });
    expect(bars.doc.global?.measures?.map(measure => measure.repeatEnd)).toEqual([{}, {}]);
    expect(bars.selection).toEqual(barSelection);
  });

  it('a selected run supplies spanner endpoints while point selection keeps the anchor fallback', () => {
    const slur = new EditorSession(makeDoc());
    slur.handleIntent({ type: 'extendSelection', direction: 'next' });
    const selection = slur.selection;
    expect(slur.handleIntent({ type: 'toggleSlur' })).toBe(true);
    expect(slur.opQueue.applied).toHaveLength(1);
    expect(slur.opQueue.applied[0].op).toMatchObject({
      type: 'setSlur',
      fromNoteKey: 'n1',
      toNoteKey: 'n2'
    });
    expect(slur.spanAnchor).toBeNull();
    expect(slur.selection).toEqual(selection);
    expect(commandState(find('slur'), sessionView(slur))).toBe('active');

    const beamDoc = makeDoc();
    const events = beamDoc.parts[0].measures?.[0].sequences?.[0].content ?? [];
    events.forEach(event => {
      if ('duration' in event) event.duration = { base: 'eighth' };
    });
    const beam = new EditorSession(beamDoc);
    beam.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(beam.handleIntent({ type: 'toggleBeam' })).toBe(true);
    expect(beam.opQueue.applied[0].op).toMatchObject({ type: 'setBeam', from: 0, to: 1 });
    expect(beam.spanAnchor).toBeNull();

    const anchor = new EditorSession(makeDoc());
    expect(anchor.handleIntent({ type: 'toggleSlur' })).toBe(true);
    expect(anchor.spanAnchor).toBe('n1');
    expect(anchor.opQueue.applied).toHaveLength(0);
  });
});
