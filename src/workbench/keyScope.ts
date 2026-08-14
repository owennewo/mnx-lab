// Keyboard scope tests — roadmap/proposed/core-editor-focus-scope.md.
//
// Four nested scopes decide whether a key is ours: browser/OS (unreachable),
// document, the host element, and regions inside the component. This module
// owns the two middle tests both workbench listeners share; the tag-name test
// is the innermost scope (a text field always wins, even inside us).
//
// The listeners are still window-scoped because the mount lives in
// `workbench/`; the focus test is what makes them behave as if they were
// host-scoped. When the editor promotes to `elements/`
// (core-editor-element-promotion.md), the listener moves onto the host
// element and `focusWithin` disappears — containment becomes structural
// rather than tested.

/** The real event target: shadow-DOM retargeting makes a window-level
 *  `event.target` the outermost host, so the composed path's head is the node
 *  actually focused (a popover input inside a shadow root, say). */
export function realTarget(event: KeyboardEvent): EventTarget | undefined {
  return event.composedPath()[0];
}

/** Scope 4 — a text-entry region owns its keys, wherever it lives. */
export function isTextEntry(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Scope 3 — is focus inside `host`? Walks the active-element chain across
 * shadow roots: `document.activeElement` stops at the outermost host, so each
 * shadow root's own `activeElement` continues the descent.
 */
export function focusWithin(host: Element): boolean {
  let active: Element | null = document.activeElement;
  while (active) {
    if (active === host || host.contains(active)) return true;
    const root: ShadowRoot | null = active.shadowRoot;
    if (!root) return false;
    active = root.activeElement;
  }
  return false;
}

/**
 * Nobody has claimed the keyboard: `<body>`/`<html>` is active, which is the
 * document's state on load and after a click on dead space. Editor keys must
 * still work then — a workbench user who has not clicked anything yet is
 * unambiguously addressing the score — so unclaimed focus counts as ours.
 * This is precisely the leniency an EMBED must not have, and it disappears
 * with the host-scoped listener in stage 2.
 */
export function focusUnclaimed(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || active === document.documentElement;
}

/**
 * **The** ownership predicate: will the next keystroke reach this editor?
 * Focus inside it, or unclaimed. Deliberately the single source for BOTH
 * the key handler and the cursor overlay's dimming — a cursor drawn while
 * this is false is a lie about who owns the keyboard, and two separate
 * rules would drift into telling it.
 */
export function editorHasKeyboard(host: Element): boolean {
  return focusWithin(host) || focusUnclaimed();
}

/**
 * The composite gate every keydown handler starts with: not already handled,
 * not mid-IME-composition, not a text field, and — when a host is given —
 * the editor owns the keyboard. `host: null` keeps document scope
 * deliberately (the workbench shell's own bindings, page-level by nature).
 */
export function keyIsOurs(event: KeyboardEvent, host: Element | null): boolean {
  if (event.defaultPrevented || event.isComposing) return false;
  if (isTextEntry(realTarget(event))) return false;
  if (!host) return true;
  return editorHasKeyboard(host);
}
