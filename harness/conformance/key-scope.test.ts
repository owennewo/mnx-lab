// Keyboard scope (roadmap/complete/core-editor-focus-scope.md): the rules
// that decide who owns a keystroke, asserted where they are data rather than
// DOM behavior.
//
// The DOM half (focus containment across shadow roots) needs a browser and is
// covered by the hands-on pass; what IS mechanically checkable — and what
// rots silently — is the layer split: the workbench shell's page-level
// bindings must never leak into an editor layer, because those layers travel
// into embeds with the promotion and an embed that eats a host page's Ctrl+K
// is a bad citizen.
import { describe, it, expect } from 'vitest';
import {
  EDIT_LAYER,
  NAVIGATION_LAYER,
  PENDING_PRECEDENCE,
  SHELL_BINDINGS,
  TAB_DIGIT_LAYER,
  resolveIntent,
  resolveShellAction,
  type KeymapLayer
} from '../../src/edit/keymap.ts';

/** The layers that promote to `elements/` with the editor mount. */
const EDITOR_LAYERS: KeymapLayer[] = [NAVIGATION_LAYER, EDIT_LAYER, TAB_DIGIT_LAYER];

describe('keyboard scope', () => {
  it('maps horizontal selection gestures to replayable intents', () => {
    expect(resolveIntent({ code: 'ArrowLeft', shift: true }, EDITOR_LAYERS)).toEqual({
      type: 'extendSelection',
      direction: 'previous'
    });
    expect(resolveIntent({ code: 'ArrowRight', shift: true }, EDITOR_LAYERS)).toEqual({
      type: 'extendSelection',
      direction: 'next'
    });
    expect(resolveIntent({ code: 'End', shift: true }, EDITOR_LAYERS)).toEqual({
      type: 'extendSelection',
      direction: 'end'
    });
    expect(resolveIntent({ code: 'KeyA', ctrl: true }, EDITOR_LAYERS)).toEqual({
      type: 'closeSelection'
    });
    expect(resolveIntent({ code: 'KeyA', meta: true }, EDITOR_LAYERS)).toEqual({
      type: 'closeSelection'
    });
  });

  it('no shell binding is claimed by an editor layer', () => {
    // Shell strokes are page-level (rail, palette, go-to). If an editor layer
    // also claimed one, promoting the layers would carry the workbench's
    // shortcut into every embed.
    const collisions = SHELL_BINDINGS.filter(shell => resolveIntent(shell, EDITOR_LAYERS) !== null);
    expect(collisions.map(c => `${c.code}${c.ctrl ? '+ctrl' : ''}${c.shift ? '+shift' : ''}`)).toEqual(
      []
    );
  });

  it('editor layers bind no bare browser-reserved chords', () => {
    // Ctrl+T/N/W and friends never reach a handler; a binding there is dead
    // on arrival and misleads the cheatsheet.
    const reserved = new Set(['KeyT', 'KeyN', 'KeyW']);
    const dead = EDITOR_LAYERS.flatMap(layer =>
      layer.bindings.filter(b => b.ctrl && !b.shift && !b.alt && reserved.has(b.code))
    );
    expect(dead).toEqual([]);
  });
});

describe('the pending-gesture contract', () => {
  // The selection ladder left this open ("popovers and the palette already
  // consume Escape"); core-selection-tray-mechanism.md answered it once, in
  // the keymap layer, and core-rung-addressing.md widened it to a PAIR —
  // Escape abandons the innermost pending thing, Enter commits it. The order
  // is the contract, so it is asserted rather than left to each surface.
  it('is innermost-first: overlays, then the fret, then the anchor, then the selection', () => {
    expect([...PENDING_PRECEDENCE]).toEqual([
      'popover',
      'overlay',
      'pendingFret',
      'spanAnchor',
      'selection'
    ]);
  });

  it('puts every overlay ahead of everything the mount arbitrates', () => {
    // A regression here would mean Escape dropping a fret or an anchor
    // *behind* an open tray — state changing while the user was backing out
    // of a menu, which is the confusion the ordering exists to prevent.
    const mount = PENDING_PRECEDENCE.indexOf('pendingFret');
    expect(PENDING_PRECEDENCE.indexOf('popover')).toBeLessThan(mount);
    expect(PENDING_PRECEDENCE.indexOf('overlay')).toBeLessThan(mount);
    // Deselection is the LAST resort, after every pending thing has declined.
    expect(PENDING_PRECEDENCE.indexOf('selection')).toBe(PENDING_PRECEDENCE.length - 1);
  });

  it('Escape and Enter are shell actions, and carry no editor intent', () => {
    // They stopped being ladder bindings in core-rung-addressing.md: the
    // back-out reflex was firing against a rung walk and winning every time.
    // Shell actions because abandoning or committing spans the mount's fret
    // resolver, the session's anchor and deselection — no layer below the
    // mount can see all three.
    expect(resolveIntent({ code: 'Escape' }, EDITOR_LAYERS)).toBeNull();
    expect(resolveIntent({ code: 'Enter' }, EDITOR_LAYERS)).toBeNull();
    expect(resolveIntent({ code: 'NumpadEnter' }, EDITOR_LAYERS)).toBeNull();
    expect(resolveShellAction({ code: 'Escape' })).toBe('abandonPending');
    expect(resolveShellAction({ code: 'Enter' })).toBe('commitPending');
    expect(resolveShellAction({ code: 'NumpadEnter' })).toBe('commitPending');
  });

  it('leaves the overlays to consume Escape themselves', () => {
    // The overlays own their own keydown and call preventDefault — they are
    // NOT keymap bindings, and the ONE Escape binding is the fallthrough the
    // mount arbitrates. If an overlay ever became a binding, two handlers
    // would race for the same key.
    expect(SHELL_BINDINGS.filter(b => b.code === 'Escape')).toHaveLength(1);
  });
});
