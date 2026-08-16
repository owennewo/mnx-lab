// Keyboard scope (roadmap/proposed/core-editor-focus-scope.md): the rules
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
  ESCAPE_PRECEDENCE,
  NAVIGATION_LAYER,
  SHELL_BINDINGS,
  TAB_DIGIT_LAYER,
  resolveIntent,
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

describe('escape precedence', () => {
  // The selection ladder left this open ("popovers and the palette already
  // consume Escape"); core-selection-tray-mechanism.md answers it once, in
  // the keymap layer. The order is the contract — innermost open thing
  // first — so it is asserted rather than left to each surface's habits.
  it('is innermost-first: popover, then overlay, then the ladder', () => {
    expect([...ESCAPE_PRECEDENCE]).toEqual([
      'popover',
      'overlay',
      'relaxSelection',
      'deselect'
    ]);
  });

  it('puts every overlay ahead of the ladder walk', () => {
    // A regression here would mean Escape widening the selection *behind* an
    // open tray — the selection moving while the user was backing out of a
    // menu, which is the exact confusion the ordering exists to prevent.
    const ladder = ESCAPE_PRECEDENCE.indexOf('relaxSelection');
    expect(ESCAPE_PRECEDENCE.indexOf('popover')).toBeLessThan(ladder);
    expect(ESCAPE_PRECEDENCE.indexOf('overlay')).toBeLessThan(ladder);
    expect(ESCAPE_PRECEDENCE.indexOf('deselect')).toBeGreaterThan(ladder);
  });

  it('Escape is bound to the ladder, not to any overlay', () => {
    // The overlays consume Escape by owning their own keydown and calling
    // preventDefault — they are NOT keymap bindings. If one ever became a
    // binding, two handlers would race for the same key.
    const escapeBindings = SHELL_BINDINGS.filter(b => b.code === 'Escape');
    expect(escapeBindings).toEqual([]);
    expect(resolveIntent({ code: 'Escape' }, EDITOR_LAYERS)).toEqual({
      type: 'relaxSelection'
    });
  });
});
