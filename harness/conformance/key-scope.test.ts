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
  NAVIGATION_LAYER,
  SHELL_BINDINGS,
  TAB_DIGIT_LAYER,
  resolveIntent,
  type KeymapLayer
} from '../../src/edit/keymap.ts';

/** The layers that promote to `elements/` with the editor mount. */
const EDITOR_LAYERS: KeymapLayer[] = [NAVIGATION_LAYER, EDIT_LAYER, TAB_DIGIT_LAYER];

describe('keyboard scope', () => {
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
