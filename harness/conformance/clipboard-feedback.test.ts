// Stage 6 of core-selection-clipboard.md: the words the workbench shows for
// every clipboard outcome, and the keymap's claim on Ctrl/⌘+C/X/V. The
// notice contract — clip kind, member count, detached references, precise
// refusals — is pinned HERE because the strip itself is workbench chrome and
// the workbench has no tests; the sentences are the testable surface.
import { describe, expect, it } from 'vitest';
import type { MnxStructure } from '../../src/model/mnx.ts';
import { EditorSession } from '../../src/edit/session.ts';
import {
  copySelectionNotice,
  cutSelectionNotice,
  deleteSelectionNotice,
  pasteSelectionNotice
} from '../../src/edit/clipboardFeedback.ts';
import {
  copySelectionToStore,
  cutSelectionToStore,
  pasteSelectionFromStore
} from '../../src/edit/selectionClipboardActions.ts';
import {
  MemorySelectionClipboardStore,
  type SelectionClipboardStore
} from '../../src/edit/selectionClipboard.ts';
import {
  EDIT_LAYER,
  NAVIGATION_LAYER,
  TAB_DIGIT_LAYER,
  resolveIntent,
  resolveShellAction
} from '../../src/edit/keymap.ts';

function score(): MnxStructure {
  return {
    mnx: { version: 1 },
    global: { measures: [{ id: 'm0' }, { id: 'm1' }] },
    parts: [{
      id: 'p1',
      name: 'Guitar',
      measures: [
        {
          sequences: [{ content: [
            {
              id: 'e0',
              duration: { base: 'quarter' },
              notes: [{ id: 'n0', pitch: { step: 'C', octave: 4 }, ties: [{ target: 'n1' }] }]
            },
            {
              id: 'e1',
              duration: { base: 'quarter' },
              notes: [{ id: 'n1', pitch: { step: 'C', octave: 4 } }]
            }
          ] }]
        },
        { sequences: [{ content: [{ id: 'e2', duration: { base: 'half' }, rest: {} }] }] }
      ]
    }]
  };
}

describe('the clipboard keys', () => {
  it('Ctrl and ⌘ variants resolve as shell actions, and no layer claims them as intents', () => {
    // The shell-action path is what keeps clipboard I/O out of the session:
    // were one of these strokes also an EditorIntent binding, the mount's
    // fall-through would hand the session an unresolvable verb.
    const layers = [TAB_DIGIT_LAYER, NAVIGATION_LAYER, EDIT_LAYER];
    for (const [code, action] of [
      ['KeyC', 'copySelection'],
      ['KeyX', 'cutSelection'],
      ['KeyV', 'pasteSelection']
    ] as const) {
      for (const modifier of [{ ctrl: true }, { meta: true }]) {
        expect(resolveShellAction({ code, ...modifier })).toBe(action);
        expect(resolveIntent({ code, ...modifier }, layers)).toBeNull();
      }
    }
  });
});

describe('clipboard notices', () => {
  it('copy: clip kind, member count in the rung’s unit, detached boundary references', async () => {
    const session = new EditorSession(score());
    const store = new MemorySelectionClipboardStore();
    // Note point at n0: its tie crosses the clip boundary and detaches.
    expect(copySelectionNotice(await copySelectionToStore(session, store))).toEqual({
      ok: true,
      message: 'copied note-set — 1 note · 1 reference detached at the boundary'
    });

    session.handleIntent({ type: 'relaxSelection' }); // → event
    session.handleIntent({ type: 'closeSelection' });
    expect(copySelectionNotice(await copySelectionToStore(session, store))).toEqual({
      ok: true,
      message: 'copied event-run — 3 events across 2 bars'
    });

    while (session.selectionLevel !== 'partMeasure') session.handleIntent({ type: 'relaxSelection' });
    session.handleIntent({ type: 'closeSelection' });
    expect(copySelectionNotice(await copySelectionToStore(session, store))).toEqual({
      ok: true,
      message: 'copied part — the part ‘Guitar’ · 2 bars'
    });
  });

  it('cut: the captured unit plus what the removal repaired', async () => {
    const session = new EditorSession(score());
    session.handleIntent({ type: 'relaxSelection' }); // → event at e0
    expect(cutSelectionNotice(await cutSelectionToStore(session, new MemorySelectionClipboardStore())))
      .toEqual({
        ok: true,
        // n0's tie points at n1, which stays behind in e1: the clip detaches
        // it at the boundary, and the surviving score needs no repair (the
        // removed event held the tie's only end inside the selection).
        message: 'cut event-run — 1 event · 1 reference detached at the boundary'
      });
  });

  it('cut failure names the write-first guarantee', async () => {
    const session = new EditorSession(score());
    session.handleIntent({ type: 'relaxSelection' });
    const rejecting: SelectionClipboardStore = {
      async write() { throw new Error('store unavailable'); },
      async read() { return null; }
    };
    expect(cutSelectionNotice(await cutSelectionToStore(session, rejecting))).toEqual({
      ok: false,
      message: 'cut failed — store unavailable The document is unchanged.'
    });
  });

  it('paste: landing bars and repaired references; empty and refused say why', async () => {
    const empty = pasteSelectionNotice(
      await pasteSelectionFromStore(new EditorSession(score()), new MemorySelectionClipboardStore())
    );
    expect(empty).toEqual({
      ok: false,
      message: 'nothing to paste — There is no copied selection to paste.'
    });

    const source = new EditorSession(score());
    source.handleIntent({ type: 'relaxSelection' }); // → event
    const store = new MemorySelectionClipboardStore();
    await copySelectionToStore(source, store);

    const target = new EditorSession(score());
    target.handleIntent({ type: 'relaxSelection' });
    expect(pasteSelectionNotice(await pasteSelectionFromStore(target, store))).toEqual({
      ok: true,
      message: 'pasted event-run at bar 1'
    });

    // The landing invariant (core-paste-lands.md): a different destination
    // rung is no refusal — the selection contributes only an anchor.
    const wrongRung = new EditorSession(score()); // note level
    expect(pasteSelectionNotice(await pasteSelectionFromStore(wrongRung, store))).toEqual({
      ok: true,
      message: 'pasted event-run at bar 1'
    });

    // Accommodations join the notice: a quarter clip onto the half rest
    // consumes it whole and reports the rest that filled the remainder.
    const ontoRest = new EditorSession(score());
    ontoRest.handleIntent({ type: 'goToMeasure', measureIndex: 1 });
    expect(pasteSelectionNotice(await pasteSelectionFromStore(ontoRest, store))).toEqual({
      ok: true,
      message: 'pasted event-run at bar 2 · 1 rest filled in'
    });
  });
});

describe('the delete sentences', () => {
  // core-delete-clears-then-removes.md: the item exists because Del at a
  // guarded rung produced neither a change nor a sentence. Press 1 must say
  // what it took AND that press 2 is waiting, or the ladder's most useful
  // property stays invisible.
  const notice = (session: EditorSession) => {
    session.handleIntent({ type: 'delete' });
    return deleteSelectionNotice(session.lastDelete!);
  };

  it('names the rung the second press will take', () => {
    const bar = new EditorSession(score());
    while (bar.selectionLevel !== 'measure') bar.handleIntent({ type: 'relaxSelection' });
    expect(notice(bar)).toEqual({
      ok: true,
      message: 'cleared 2 notes — Del again to remove the bar'
    });
    expect(notice(bar)).toEqual({ ok: true, message: 'removed the bar' });
  });

  it('says a bare note deletion is finished, with no second press implied', () => {
    const session = new EditorSession(score()); // note rung
    expect(notice(session)).toEqual({ ok: true, message: 'deleted 1 note' });
  });

  it('says where the selection went when a section label goes', () => {
    const doc = score();
    doc.global.measures[0].section = { label: 'Intro' };
    const session = new EditorSession(doc);
    while (session.selectionLevel !== 'section') session.handleIntent({ type: 'relaxSelection' });
    expect(notice(session)).toEqual({
      ok: true,
      message: 'removed the section label — the bars remain, and Del now addresses them'
    });
    expect(session.selectionLevel).toBe('measure');
  });

  it('says a refusal out loud rather than answering with silence', () => {
    expect(deleteSelectionNotice({ kind: 'refused', level: 'document' })).toEqual({
      ok: false,
      message: 'nothing left to delete at the part rung'
    });
  });

  it('pluralises the removed rung', () => {
    expect(deleteSelectionNotice({ kind: 'removed', level: 'measure', members: 3 })).toEqual({
      ok: true,
      message: 'removed 3 bars'
    });
  });
});
