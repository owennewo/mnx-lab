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
  bandsForScope,
  COMMAND_GROUPS,
  COMMANDS,
  commandState,
  commandsForScope,
  glyphMark,
  isTriaged,
  selectionMemberSummary,
  sessionView,
  TRIAGE_MARKS,
  type CommandScope,
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
    const scopes = new Set<string>([...SELECTION_LADDER, 'session']);
    const strays = COMMANDS.flatMap(c => c.scopes.filter(r => !scopes.has(r)));
    expect(strays).toEqual([]);
  });

  it('every command is reachable from some scope', () => {
    // A command no tab can show is dead weight the tray would never draw.
    const orphans = COMMANDS.filter(c => c.scopes.length === 0);
    expect(orphans.map(c => c.id)).toEqual([]);
  });

  it('the session scope offers commands, and never mixes with a rung', () => {
    // `document` is the scope ABOVE the ladder (the tray's `global` tab), so a
    // command claiming both it and a rung would appear twice with two
    // different meanings of "here".
    const global = COMMANDS.filter(c => c.scopes.includes('session'));
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
      // Through `glyphMark`, so a row that composes an operator onto its mark
      // is still checked. Reading `command.glyph` directly would make every
      // composed row silently skip this test rather than fail it.
      const mark = glyphMark(command.glyph);
      if (!('smufl' in mark)) continue;
      const name = mark.smufl;
      if (!glyphnames[name]) bad.push(`${command.id}: ${name} (no such glyph)`);
      else if (!boxes[name]) bad.push(`${command.id}: ${name} (no bounding box)`);
    }
    expect(bad).toEqual([]);
  });

  it('a label is a name, not a sentence', () => {
    // The label has to work in three places at once — the tooltip, the ONE-LINE
    // readout the keyboard cursor writes into, and the search haystack — so it
    // is the tile's name and nothing else. Labels that explained themselves
    // ("Delete this bar (clears its notes first)", "Insert an event before this
    // one") were a name and a footnote sharing a field, and it was the footnote
    // that pushed the name off the end of the readout. `detail` is where a
    // footnote goes.
    const tooLong: string[] = [];
    const deictic: string[] = [];
    const articled: string[] = [];
    const prose: string[] = [];
    for (const { id, label } of COMMANDS) {
      if (label.length > 30) tooLong.push(`${id}: ${label} (${label.length})`);
      // The tile is already pointing at the thing; saying so costs a third of
      // the line and tells the reader what they can see.
      if (/\bthis\b/i.test(label)) deictic.push(`${id}: ${label}`);
      if (/^(Insert|Add|Delete|Append|Select|Go|Clear) (a|an|the) /.test(label)) {
        articled.push(`${id}: ${label}`);
      }
      // A parenthetical opening lowercase is prose — "(clears its notes
      // first)", "(cycles)". One opening uppercase is part of the name a
      // musician would use, as in "Jump (D.S. al fine)", and stays.
      if (/\([a-z]/.test(label)) prose.push(`${id}: ${label}`);
    }
    expect(tooLong, `labels over 30 chars:\n${tooLong.join('\n')}`).toEqual([]);
    expect(deictic, `labels saying "this":\n${deictic.join('\n')}`).toEqual([]);
    expect(articled, `verbs followed by an article:\n${articled.join('\n')}`).toEqual([]);
    expect(prose, `explanations that belong in detail:\n${prose.join('\n')}`).toEqual([]);
  });

  it('a detail says something the name does not', () => {
    const empty = COMMANDS.filter(c => c.detail !== undefined && c.detail.trim() === '');
    expect(empty.map(c => c.id), 'empty detail strings').toEqual([]);
    const echoes = COMMANDS.filter(
      c => c.detail && c.label.toLowerCase().includes(c.detail.toLowerCase())
    );
    expect(echoes.map(c => c.id), 'details already said by the label').toEqual([]);
  });

  it('no two tiles at one rung draw the same picture', () => {
    // The rule the operator grammar exists to keep. Insert-before and
    // insert-after used to draw the IDENTICAL glyph at every rung offering
    // them, and `restWhole` stood for three different verbs — so the shortcut
    // badge was the only thing telling two tiles apart, which is why it had to
    // be a slab sitting on top of the picture it was distinguishing.
    //
    // Scoped per rung, not globally: two rungs never share a tab, so the same
    // mark meaning different things at different rungs is fine, and the meta
    // line says which rung you are on.
    const picture = (glyph: EditorCommand['glyph']): string =>
      'mark' in glyph
        ? `${picture(glyph.mark)} ${glyph.op.sign}@${glyph.op.at}`
        : 'smufl' in glyph
          ? glyph.smufl
          : `arc:${glyph.arc}`;
    // Seven pairs predate the operator grammar and are NOT insert/delete
    // pairs — each is two unrelated verbs that happen to have reached for the
    // same mark, and separating them means choosing seven new pictures, which
    // is a design decision and not a mechanical one. Listed rather than
    // ignored so they read as debt for the triage ledger
    // (roadmap/proposed/core-selection-tray-residue.md) instead of as silence.
    const KNOWN_TWINS = new Set([
      'note: articTenutoAbove — tenuto, hammer-pull',
      'measure: coda — coda, section-colour',
    ]);
    const clashes: string[] = [];
    const seen = new Set<string>();
    for (const scope of [...SELECTION_LADDER, 'session'] as CommandScope[]) {
      const drawn = new Map<string, string[]>();
      for (const command of COMMANDS) {
        if (!command.scopes.includes(scope)) continue;
        const key = picture(command.glyph);
        drawn.set(key, [...(drawn.get(key) ?? []), command.id]);
      }
      for (const [key, ids] of drawn) {
        if (ids.length < 2) continue;
        const line = `${scope}: ${key} — ${ids.join(', ')}`;
        seen.add(line);
        if (!KNOWN_TWINS.has(line)) clashes.push(line);
      }
    }
    expect(clashes, `tiles sharing a picture at one rung:\n${clashes.join('\n')}`).toEqual([]);
    const stale = [...KNOWN_TWINS].filter(line => !seen.has(line));
    expect(stale, `no longer clashing — delete from KNOWN_TWINS:\n${stale.join('\n')}`).toEqual(
      []
    );
  });

  it('an operator points the way its own intent goes', () => {
    // The operator is not decoration: `+` marks WHERE the new thing lands, so
    // it has to agree with the side the intent actually inserts at. The two
    // axes are the rung's own — events and bars run before/after in time,
    // parts run above/below down the page — so each intent side admits the
    // one operator placement on either axis.
    const ALLOWED = {
      before: ['before', 'above'],
      after: ['after', 'below']
    } as const;
    const wrong: string[] = [];
    for (const command of COMMANDS) {
      const action = command.action?.(view());
      const intent = action && 'intent' in action ? action.intent : null;
      const composed = 'mark' in command.glyph ? command.glyph.op : null;
      if (intent?.type === 'insertAtRung') {
        if (composed?.sign !== 'plus') {
          wrong.push(`${command.id}: inserts, but draws ${composed?.sign ?? 'a bare mark'}`);
        } else if (!(ALLOWED[intent.side] as readonly string[]).includes(composed.at)) {
          wrong.push(`${command.id}: inserts ${intent.side}, but its + sits ${composed.at}`);
        }
      }
      if (composed?.sign === 'minus' && intent?.type !== 'delete') {
        wrong.push(`${command.id}: draws a minus but does not delete`);
      }
    }
    expect(wrong, `operators disagreeing with their intent:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('every band names commands that exist and are offered at that rung', () => {
    // The group table addresses commands BY ID from a distance, so it rots the
    // way every id table rots: a rename, a scope narrowed to one projection, a
    // command deleted. None of those is loud — the tile simply stops being
    // drawn under its caption and reappears in the trailing ungrouped band,
    // which is a layout nobody chose.
    const missing: string[] = [];
    const misplaced: string[] = [];
    const repeated: string[] = [];
    for (const [scope, table] of Object.entries(COMMAND_GROUPS)) {
      const seen = new Set<string>();
      for (const group of table ?? []) {
        for (const id of group.commands) {
          if (seen.has(id)) repeated.push(`${scope}: ${id}`);
          seen.add(id);
          const command = COMMANDS.find(c => c.id === id);
          if (!command) missing.push(`${scope}: ${id}`);
          else if (!command.scopes.includes(scope as never)) misplaced.push(`${scope}: ${id}`);
        }
      }
    }
    expect(missing, 'banded ids with no command').toEqual([]);
    expect(misplaced, 'banded at a rung the command does not offer').toEqual([]);
    expect(repeated, 'the same command in two bands').toEqual([]);
  });

  it('does not offer append-bar as a tray command', () => {
    const appendCommands = COMMANDS.filter(command => {
      const action = command.action?.(view());
      return action && 'intent' in action && action.intent.type === 'appendMeasure';
    });
    expect(appendCommands.map(command => command.id)).toEqual([]);
  });

  it('a grouped rung groups ALL of its commands', () => {
    // The trailing ungrouped band is a mercy for a command written today and
    // grouped tomorrow, not a place to leave things. At a rung that has a
    // table, an unbanded command means somebody added a verb and never said
    // what it belongs with — the exact question the table exists to answer.
    const stranded: string[] = [];
    for (const [scope, table] of Object.entries(COMMAND_GROUPS)) {
      const banded = new Set((table ?? []).flatMap(group => group.commands));
      // Both projections: `commandsForScope` filters to one dialect, and a
      // tab-only verb is no less in need of a band.
      for (const command of COMMANDS) {
        if (!command.scopes.includes(scope as never)) continue;
        if (!banded.has(command.id)) stranded.push(`${scope}: ${command.id}`);
      }
    }
    expect(stranded, 'commands at a grouped rung with no band').toEqual([]);
  });

  it('bands are cut from the filtered list, captions and all', () => {
    // What the tray depends on when someone types: a band whose every member
    // was filtered away must not draw its caption over nothing, and a lone
    // survivor must keep the caption that says where it came from.
    const all = commandsForScope('note', view());
    const full = bandsForScope('note', all);
    expect(full.map(b => b.id)).toEqual(
      (COMMAND_GROUPS.note ?? [])
        .filter(g => g.commands.some(id => all.some(c => c.id === id)))
        .map(g => g.id)
    );
    expect(full.every(b => b.commands.length > 0)).toBe(true);

    const survivors = all.filter(c => c.id === 'staccato');
    const filtered = bandsForScope('note', survivors);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].caption).toBe('articulation');
    expect(filtered[0].commands.map(c => c.id)).toEqual(['staccato']);

    expect(bandsForScope('note', [])).toEqual([]);
  });

  it('every rung is banded now, and each leads with its structure verbs', () => {
    // All eight rungs carry a table as of 2026-08-25, so no rung falls back to
    // the flat grid any more. What replaced that test is the property the
    // banding was FOR: wherever a rung can insert or remove its own unit, the
    // verbs for it are drawn together and drawn FIRST, instead of scattered
    // among the rung's properties — thirteen of them at the bar rung, which is
    // how the tray came to hide the one voice verb that could still be reached.
    for (const scope of SELECTION_LADDER) {
      const bands = bandsForScope(scope, commandsForScope(scope, view()));
      expect(bands.length, `${scope}: no bands`).toBeGreaterThan(0);
      expect(bands[0].caption, `${scope}: does not lead with structure`).toBe('structure');
      expect(bands.some(band => band.id === 'ungrouped'), `${scope}: stranded tiles`).toBe(false);
    }
  });

  it('still falls back to one bare band for a rung with no table', () => {
    // The fallback is not dead code — it is what draws a rung the day someone
    // adds one, before anybody has said what belongs with what.
    const commands = commandsForScope('measure', view());
    const bands = bandsForScope('nosuchrung' as unknown as Parameters<typeof bandsForScope>[0], commands);
    expect(bands).toHaveLength(1);
    expect(bands[0].caption).toBeUndefined();
    expect(bands[0].commands).toEqual(commands);
  });

  it('triage marks are well formed, and only where the tile exists', () => {
    // The triage ledger (roadmap/proposed/core-selection-tray-residue.md) is
    // DATA on the registry, so it rots the way data does: a mark left behind
    // by a renamed scope, a typo'd mark that silently never matches, an
    // `ordered` claimed for a group nobody drew. None of those would show up
    // as a red tile — the placement would simply stop being purple, which is
    // the one failure mode the whole mechanism exists to prevent.
    const orphaned: string[] = [];
    const unknown: string[] = [];
    const unordered: string[] = [];
    const blocked: string[] = [];
    for (const command of COMMANDS) {
      if (!command.triage) continue;
      if (!command.action) blocked.push(command.id);
      for (const [scope, marks] of Object.entries(command.triage)) {
        if (!command.scopes.includes(scope as never)) orphaned.push(`${command.id}@${scope}`);
        for (const mark of marks ?? []) {
          if (!TRIAGE_MARKS.includes(mark)) unknown.push(`${command.id}@${scope}: ${mark}`);
        }
        // `ordered` presupposes `grouped`: an index inside a group nobody has
        // drawn is not a statement about anything.
        if ((marks ?? []).includes('ordered') && !(marks ?? []).includes('grouped')) {
          unordered.push(`${command.id}@${scope}`);
        }
      }
    }
    expect(orphaned, 'marks for a scope the command does not offer').toEqual([]);
    expect(unknown, 'marks outside the three').toEqual([]);
    expect(unordered, 'ordered without grouped').toEqual([]);
    expect(blocked, 'a blocked tile cannot have been clicked').toEqual([]);
  });

  it('a blocked tile is exempt from triage rather than purple', () => {
    // The one precedence rule the tray depends on: purple never overrides
    // unavailable. `isTriaged` is what enforces it, upstream of the CSS, so a
    // reviewer is never asked to click a verb that does not exist.
    const wired = COMMANDS.filter(c => c.action);
    const unwired = COMMANDS.filter(c => !c.action);
    expect(unwired.length).toBeGreaterThan(0);
    for (const command of unwired) {
      for (const scope of command.scopes) expect(isTriaged(command, scope)).toBe(true);
    }
    expect(wired.length).toBeGreaterThan(0);
  });

  it('a wired placement needs all three marks to stop being purple', () => {
    // Deliberately asserted against a synthetic row rather than the live
    // table, so the FIRST person to actually triage a tile does not have to
    // edit a test to record their work. What must hold forever is the rule,
    // not the count: absent marks and partial marks both read as untriaged,
    // which is what makes an empty ledger show up as a wall of purple.
    const row = (marks?: readonly string[]): EditorCommand => ({
      id: 'probe',
      scopes: ['note'],
      glyph: { smufl: 'noteHalfUp' },
      label: 'probe',
      tier: 'key',
      action: () => null,
      ...(marks ? { triage: { note: marks as never } } : {})
    });
    expect(isTriaged(row(), 'note')).toBe(false);
    expect(isTriaged(row([]), 'note')).toBe(false);
    expect(isTriaged(row(['tested']), 'note')).toBe(false);
    expect(isTriaged(row(['tested', 'grouped']), 'note')).toBe(false);
    expect(isTriaged(row(['tested', 'grouped', 'ordered']), 'note')).toBe(true);
    // A mark earned at one rung says nothing about another.
    expect(isTriaged(row(['tested', 'grouped', 'ordered']), 'event')).toBe(false);
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
      for (const rung of command.scopes.filter(s => s !== 'session')) {
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

  it('barline tiles track and switch their exact style', () => {
    const session = new EditorSession(makeDoc());
    const double = find('double-barline');
    const final = find('final-barline');

    expect(commandState(double, sessionView(session))).toBe('available');
    expect(commandState(final, sessionView(session))).toBe('available');

    session.handleIntent((final.action!(sessionView(session)) as { intent: never }).intent);
    expect(commandState(final, sessionView(session))).toBe('active');
    expect(commandState(double, sessionView(session))).toBe('available');

    expect(double.action!(sessionView(session))).toEqual({
      intent: {
        type: 'setMeasureAttribute',
        attribute: { kind: 'barline', type: 'double' }
      }
    });
    session.handleIntent((double.action!(sessionView(session)) as { intent: never }).intent);
    expect(commandState(double, sessionView(session))).toBe('active');
    expect(commandState(final, sessionView(session))).toBe('available');
    expect(double.action!(sessionView(session))).toEqual({
      intent: { type: 'removeMeasureAttribute', kind: 'barline' }
    });
  });

  it('groups the double barline with repeats and barlines', () => {
    const repeats = COMMAND_GROUPS.measure?.find(group => group.id === 'repeats');
    expect(repeats?.commands).toContain('double-barline');
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
    // Two presses under the floor axis: re-level to the event, then extend.
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    session.handleIntent({ type: 'extendSelection', direction: 'next' });
    const selection = session.selection;

    expect(commandState(staccato, sessionView(session))).toBe('mixed');
    expect(selectionMemberSummary(sessionView(session))).toBe('2 events');
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

  it('the part scope tile commits the whole-part closure through an intent', () => {
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

  it('a selected run supplies spanner endpoints; a point slurs to the NEXT note', () => {
    const slur = new EditorSession(makeDoc());
    // Two presses under the floor axis: re-level to the event, then extend.
    slur.handleIntent({ type: 'extendSelection', direction: 'next' });
    slur.handleIntent({ type: 'extendSelection', direction: 'next' });
    const selection = slur.selection;
    expect(slur.handleIntent({ type: 'toggleSlur' })).toBe(true);
    expect(slur.opQueue.applied).toHaveLength(1);
    expect(slur.opQueue.applied[0].op).toMatchObject({
      type: 'setSlur',
      fromNoteKey: 'n1',
      toNoteKey: 'n2'
    });
    expect(slur.selection).toEqual(selection);
    expect(commandState(find('slur'), sessionView(slur))).toBe('active');

    const beamDoc = makeDoc();
    const events = beamDoc.parts[0].measures?.[0].sequences?.[0].content ?? [];
    events.forEach(event => {
      if ('duration' in event) event.duration = { base: 'eighth' };
    });
    const beam = new EditorSession(beamDoc);
    beam.handleIntent({ type: 'extendSelection', direction: 'next' });
    beam.handleIntent({ type: 'extendSelection', direction: 'next' });
    expect(beam.handleIntent({ type: 'toggleBeam' })).toBe(true);
    expect(beam.opQueue.applied[0].op).toMatchObject({ type: 'setBeam', from: 0, to: 1 });

    // The point form: no anchor to arm any more (the two-press gesture
    // retired by the user's call — core-selection-range-grain.md decision 5).
    // One press slurs to the next note, immediately.
    const point = new EditorSession(makeDoc());
    expect(point.handleIntent({ type: 'toggleSlur' })).toBe(true);
    expect(point.opQueue.applied[0].op).toMatchObject({
      type: 'setSlur',
      fromNoteKey: 'n1',
      toNoteKey: 'n2'
    });
  });

  it('S at a slur’s end extends it; at its start removes it', () => {
    const doc = makeDoc();
    // A third note in bar 1 gives the extension somewhere to go.
    doc.parts[0].measures?.[0].sequences?.[0].content.push(
      { duration: { base: 'quarter' }, notes: [note('n3', 'E', 4, 1)] }
    );
    const session = new EditorSession(doc);
    expect(session.handleIntent({ type: 'toggleSlur' })).toBe(true); // n1 → n2
    session.handleIntent({ type: 'nextPosition' }); // on n2, the slur's END
    expect(session.handleIntent({ type: 'toggleSlur' })).toBe(true); // extend → n3
    expect(session.opQueue.applied[1].op).toMatchObject({
      type: 'retargetSlur',
      noteKey: 'n1',
      toNoteKey: 'n3'
    });
    const first = session.doc.parts![0].measures![0].sequences![0].content[0] as {
      slurs?: { target: string }[];
    };
    const third = session.doc.parts![0].measures![0].sequences![0].content[2] as { id?: string };
    expect(first.slurs?.[0].target).toBe(third.id);

    // Back at the START, the press still toggles the slur off.
    session.handleIntent({ type: 'prevPosition' });
    expect(session.handleIntent({ type: 'toggleSlur' })).toBe(true);
    expect((session.doc.parts![0].measures![0].sequences![0].content[0] as {
      slurs?: unknown[];
    }).slurs).toBeUndefined();
  });

  it('B at a beam’s end extends it by the next event, never across the barline', () => {
    const doc = makeDoc();
    const events = doc.parts[0].measures?.[0].sequences?.[0].content ?? [];
    events.forEach(event => {
      if ('duration' in event) event.duration = { base: 'eighth' };
    });
    events.push({ duration: { base: 'eighth' }, notes: [note('n3', 'E', 4, 1)] });
    const session = new EditorSession(doc);
    expect(session.handleIntent({ type: 'toggleBeam' })).toBe(true); // n1..n2
    session.handleIntent({ type: 'nextPosition' }); // on n2, the beam's END
    expect(session.handleIntent({ type: 'toggleBeam' })).toBe(true); // extend
    const beam = session.doc.parts![0].measures![0].beams![0];
    expect(beam.events).toHaveLength(3);

    // At the new end with nothing after it in the bar but silence — and the
    // next bar out of reach — the press refuses rather than acting wide.
    session.handleIntent({ type: 'nextPosition' });
    expect(session.handleIntent({ type: 'toggleBeam' })).toBe(false);
  });

});
