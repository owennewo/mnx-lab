# Keyboard focus scope — who owns the next keystroke, and how you can tell

> **Status: stage 1 built 2026-08-12, same day as proposed** (stages 2–4 open).
> Shipped: `--mnx-focus-ring` (public token, light + dark), the viewer's
> `tabindex="0"` default (author-set values never clobbered) and its
> `:host(:focus-within)` outline, `src/workbench/keyScope.ts` (the shared
> scope tests — `realTarget`/`isTextEntry`/`focusWithin`/`focusUnclaimed`/
> `keyIsOurs`) wired into both listeners (the page scopes to itself, the
> shell keeps document scope deliberately), and
> `harness/conformance/key-scope.test.ts` (no shell binding claimed by an
> editor layer; no editor binding on a browser-reserved chord).
> **Verified in headless Chrome via CDP**, all four behaviors: `tabindex="0"`
> present; outline `none` unfocused → `solid 2px` accent focused → `none`
> again when focus leaves; the focus chain crosses shadow roots
> (`mnx-workbench > mnx-scenario-page > mnx-score-viewer`); and Shift+M
> appends a bar when the viewer is focused, is ignored when the rail's
> search input **or a rail link** holds focus (the link is the new
> behavior — a non-text element outside the page used to fire the editor),
> and works again on refocus. Unclaimed focus (`<body>`, i.e. a fresh load)
> still counts as ours — deliberate workbench leniency, documented at
> `focusUnclaimed`, and exactly what an embed must not do.
>
> Feeds [core-editor-element-promotion.md](core-editor-element-promotion.md)'s
> "the shadow-DOM focus story coming due" line item, and hands
> [core-viewer-surface.md](core-viewer-surface.md) one public token
> (`--mnx-focus-ring`). Raised 2026-08-12 from an embed question: *on a random
> host page that embeds the viewer, when do PgUp/PgDn reach me and when do they
> reach the page?*

## The problem

Today the answer is "almost always me", and that is wrong for an embed.

Both keyboard listeners are `window.addEventListener('keydown', …)` with two
guards only — skip if `defaultPrevented || isComposing`, skip if
`composedPath()[0]` is INPUT/TEXTAREA/SELECT/contentEditable
(`src/workbench/ScenarioPage.ts`, `src/workbench/WorkbenchApp.ts`). **There is
no focus check.** In the workbench that is defensible: one score, the page *is*
the editor. In an embed it is antisocial — a viewer in a sidebar would swallow
the reader's PgUp/PgDn while they scroll the host's article, and steal Ctrl+K
from the host's own search box.

Two facts make this sharper than it looks:

- **A custom element is not focusable by default.** With no `tabindex`, the
  embedded viewer can never be `document.activeElement`, so "when focused" is
  not even expressible today.
- **Shadow DOM does not scope key events.** It *retargets* them (the host page
  sees `event.target` as `<mnx-score-viewer>`, and `composedPath()[0]` reveals
  the real inner node) and it scopes `activeElement` (the host's is the
  element, the real one is `shadowRoot.activeElement`). But a `window` listener
  still hears every key in the document, shadow boundaries or not. Encapsulation
  is a styling and DOM story, never a keyboard one.

## The scope ladder (the model to build against)

Four nested scopes decide whether a handler runs. Naming them is half the work:

1. **Browser/OS** — Ctrl+T, Ctrl+W, F11, Cmd+Tab. Un-interceptable;
   `preventDefault()` does not reach them. A binding that collides here is
   simply unavailable, and *which* keys those are differs per platform and
   browser — an argument for keeping embed bindings conservative.
2. **Document** — keydown fires at `document.activeElement` and bubbles to
   `window`. With nothing focused the target is `<body>`, and every window
   listener sees everything. This is the embed's default state today.
3. **Host element** — the boundary that *should* decide ownership: keys
   pressed while focus is inside the element are the editor's; everything else
   belongs to the page.
4. **Regions inside the component** — text inputs, the setup popovers, the
   palette. The tag-name check is today's only member of this scope; it stays,
   as an *inner* rule, not the outer one.

## The design

**One rule: handle a key iff focus is inside the host element.** Four parts.

1. **Make the host focusable** — `tabindex="0"` reflected by the element (host
   pages may override to `-1` for click-only focus). Tab now reaches the viewer;
   click focuses it. This is what makes "focused" expressible at all.
2. **Listen on the host, not `window`** — events from inside the shadow root
   bubble to the host, so a host-scoped listener hears exactly the keys aimed at
   the component and no others. PgUp/PgDn then behave correctly *by
   construction*: the editor's while focused, the page's scroll otherwise. This
   part lands with the promotion (`elements/` owns the host element); until
   then the workbench keeps its window listener plus an explicit focus test.
3. **Test focus containment, not tag names** — `contains(document.activeElement)`
   plus `shadowRoot.activeElement` for the internal case. The existing
   INPUT/TEXTAREA/contentEditable check survives as scope 4: a popover input
   inside our own shadow root must still win over the editor.
4. **Swallow only what we consumed** — `preventDefault()` exactly when an
   intent handled the key, so unhandled keys fall through to the host page. The
   keymap tables already know which those are (`resolveIntent` returning null is
   the signal); today's handlers are looser than that.

### The visible signal

A focus ring on the host, because "who gets the next keystroke" must be legible
without pressing a key and finding out:

- `:host(:focus-within)`, **not** `:focus` — the ring must stay lit while a
  popover input inside the component holds focus, or it blinks off exactly when
  you are typing a time signature.
- `outline`, not `border` — no reflow when it appears, and it renders outside
  the box so the paper's geometry is untouched.
- A token, `--mnx-focus-ring`, defaulting to the accent-derived colour and
  restylable by the host — the one piece of this that touches the public
  surface, so [core-viewer-surface.md](core-viewer-surface.md) owns its final
  name and shape.
- **Click focus counts.** For an editor, a mouse click genuinely transfers key
  ownership, so the ring shows on click too rather than strict `:focus-visible`
  semantics. (`:focus-visible` remains right for buttons *inside* the chrome.)

### The second signal: the cursor must not lie

An unfocused component drawing a cursor/enclosure is claiming keystrokes it
will not receive. When focus leaves, the overlay should dim (or hide) and
restore on focus — the `cursorHidden` machinery from the ladder work already
expresses exactly this state, so this is wiring, not new concepts.

### Shell bindings do not travel

Ctrl+B (rail), Ctrl+K (palette), Ctrl+G (go-to) are *workbench shell*
concerns. An embed that takes Ctrl+K from a host page's search box is a bad
citizen. The code's layer split is already right — `SHELL_BINDINGS` sits beside
but separate from the editor layers — so the promotion must simply leave the
shell ones behind. Worth an assertion (a shell binding must never appear in an
element-tier layer) so the split cannot rot.

## Boundaries and caveats

- **Not a focus trap.** Tab inside the editor should still leave it; we are
  claiming *keys while focused*, not imprisoning the user. (A modal palette is
  a different question, and it is workbench-tier.)
- **`preventDefault()` on arrows/Space is load-bearing** — they scroll. Scoped
  to "focus is inside us and we handled it", that is correct; unscoped, it is
  the current antisocial behavior in miniature.
- **Multiple embedded viewers on one page** fall out for free: focus picks the
  target, and the ring says which one. This is impossible to express today.
- **Programmatic focus** (`element.focus()`) is the host's API for handing over
  the keyboard deliberately; it works once `tabindex` exists.
- **Accessibility is adjacent, not solved here** — a focusable editor wants a
  role and a label eventually. Recorded, not scoped.

## Staging

1. **The ring + focus-awareness where the listeners are today** (workbench
   tier): `tabindex` on the viewer, `:host(:focus-within)` outline with the
   token, the focus-containment test added beside the tag-name guard, and
   `preventDefault()` narrowed to handled keys. Ships the embed-visible half of
   the behavior without waiting for the promotion.
2. **Move the listener to the host element** — with
   [core-editor-element-promotion.md](core-editor-element-promotion.md), when
   the mount layer becomes `elements/`-tier. Deletes the window listener and
   the focus test together: containment becomes structural.
3. **The overlay's unfocused state** — dim/hide the cursor and enclosure,
   restoring on focus.
4. **The shell/editor binding assertion** — a conformance test that no
   `SHELL_BINDINGS` stroke appears in an element-tier keymap layer.
