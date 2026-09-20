// A refusal has to say something — roadmap/rejected/studio-editor-touch.md's
// sibling finding, met on the owner's own piece on 2026-09-20.
//
// A piece held open in a second tab is read-only, and read-only still allows
// NAVIGATION: the cursor moved to exactly where it was clicked, and then a
// typed fret vanished with no explanation anywhere but a chip beside the title.
// The mount made that worse than it had to be — it returned before the session
// saw the intent, so the refusal never reached the host's `onRefused` at all.
//
// The rule and its words live together in `edit/` precisely so this test can
// pin both. The one silence is deliberate and is the interesting half.
import { describe, it, expect } from 'vitest';
import { refusalNotice } from '../../src/edit/clipboardFeedback.ts';
import type { EditorIntent } from '../../src/edit/intents.ts';

const FRET: EditorIntent = { type: 'enterFret', fret: 2 };
const NEXT: EditorIntent = { type: 'nextPosition' };
const POINTER: EditorIntent = {
  type: 'goToPointer',
  measureIndex: 2, partIndex: 0, staffIndex: 1,
  line: 3, projection: 'tab', fraction: 0.5
};

describe('refusalNotice', () => {
  it('explains a read-only piece, and says how to fix it', () => {
    const notice = refusalNotice(FRET, 'read-only');
    expect(notice).not.toBeNull();
    expect(notice!.ok).toBe(false);
    expect(notice!.message).toMatch(/another tab/i);
    expect(notice!.message).toMatch(/read only/i);
  });

  it('explains an older version, and names both ways out', () => {
    const notice = refusalNotice(FRET, 'suspended');
    expect(notice!.message).toMatch(/older version/i);
    expect(notice!.message).toMatch(/current/i);
  });

  it('speaks for an edit the session itself declined', () => {
    expect(refusalNotice(FRET, 'unavailable')).not.toBeNull();
  });

  // The deliberate silence: walking out of the score is an edge, not a
  // refusal, and a notice on every press of the last bar would be noise.
  it('stays quiet when navigation simply ran out of score', () => {
    expect(refusalNotice(NEXT, 'unavailable')).toBeNull();
    expect(refusalNotice(POINTER, 'unavailable')).toBeNull();
  });

  // ...but a navigation intent refused because the piece cannot be touched at
  // all is still worth saying, since the reader asked for something the
  // document could have given.
  it('still explains navigation blocked by the document being elsewhere', () => {
    expect(refusalNotice(NEXT, 'suspended')).not.toBeNull();
  });
});
