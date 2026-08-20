# Keyboard focus scope — who owns the next keystroke, and how you can tell

> **Status: COMPLETE for its scope, 2026-08-14 (same day as proposed).**
> Stages 1, 3 and 4 built; **stage 2 retired as "not wanted"** —
> [core-viewer-embedded-app.md](core-viewer-embedded-app.md) settled the fork
> (*embeds view; studio edits*), and a read-only embed needs nothing beyond
> not stealing the host's keys, which stage 1 ships. Should studio bring the
> editor into `elements/`, the host-scoped listener returns as item 3 of the
> promotion's own work list.
> Shipped: `--mnx-focus-ring` (public token, light + dark), the viewer's
> `tabindex="0"` default (author-set values never clobbered) and its
> `:host(:focus-within)` outline, `src/workbench/keyScope.ts` (the shared
> scope tests — `realTarget`/`isTextEntry`/`focusWithin`/`focusUnclaimed`/
> `editorHasKeyboard`/`keyIsOurs`) wired into both listeners (the page scopes
> to itself, the shell keeps document scope deliberately), and
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
> **Stage 3** (the overlay stops lying): `editorHasKeyboard(host)` is now
> **the** ownership predicate, shared by the key gate and the visual so they
> cannot drift; the page tracks it as state and passes it to the viewer as
> `selection-inactive`, which fades the enclosure, the ghost cell and the
> accent recolor. *Faded, not hidden* — losing your place entirely makes
> refocus disorienting, and the goal is to drop the claim, not the memory.
> Verified with real mouse clicks: `dimmed` and `keyLanded` are exact
> inverses at every step (score focused → bright + key lands; rail search
> focused → dim + key ignored; refocused → bright again).
>
> **Environment finding worth keeping** (it shaped the implementation):
> headless Chrome delivers **none** of `focusin`/`focusout`/`focus`/`blur` to
> `window` — not even for real dispatched mouse clicks, with focus emulation
> enabled — while `document.activeElement` updates correctly throughout. So
> ownership is re-read on the *causes* of focus change (`pointerdown`
> capture, `Tab` keydown) as well as the focus events themselves. That is not
> merely a test workaround: it is why the dimming is trustworthy in
> environments where focus events are unreliable, and it is the reason to
> prefer reading `activeElement` over trusting an event stream.
>
> **Stage 4** landed with stage 1 (`harness/conformance/key-scope.test.ts`).
>
> Feeds [core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md)'s
> "the shadow-DOM focus story coming due" line item, and hands
> [core-viewer-surface.md](core-viewer-surface.md) one public token
> (`--mnx-focus-ring`). Raised 2026-08-14 from an embed question: *on a random
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
   intent claimed the key, so unhandled keys fall through to the host page.
   **Audited, already correct**: `if (!intent || !this.session) return;`
   precedes the only `preventDefault()`, so an unmatched stroke is never
   swallowed — no change was needed. One deliberate nuance: a stroke that
   matched an intent is swallowed even when `handleIntent` returns false (an
   arrow at the edge of the score). The key was *ours*; letting it fall
   through to scroll the page because the cursor happened to be at a boundary
   would be worse than doing nothing visibly.

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
will not receive. When focus leaves, the overlay dims and restores on focus.

**Built with its own state, NOT the ladder's `cursorHidden`** — the original
sketch here proposed reusing that flag ("wiring, not new concepts"); the build
rejected it. `cursorHidden` means *the user deliberately deselected* (Escape
relaxed past the top rung), and folding focus loss into it would make
"I dismissed the selection" and "my keyboard is elsewhere" indistinguishable —
returning focus would then have to guess whether to restore a selection the
user had dismissed. So the overlay reads a separate `hasKeyboard`, derived
from the same `editorHasKeyboard` predicate the key gate uses, and reaches
the element as `selection-inactive`. Two different truths, two flags.

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
- **Multiple embedded viewers on one page** fall out for free **once stage 2
  lands** — focus picks the target, and the ring says which one. Not true yet:
  the shipped ownership test is per *page* (the workbench mount asks "is focus
  inside this scenario page"), so two viewers would both answer yes. The ring
  is already per-element, so only the key routing is missing.
- **Programmatic focus** (`element.focus()`) is the host's API for handing over
  the keyboard deliberately; it works once `tabindex` exists.
- **Accessibility is adjacent, not solved here** — a focusable editor wants a
  role and a label eventually. Recorded, not scoped.

## Staging

1. ~~**The ring + focus-awareness where the listeners are today**~~ —
   **built**: `tabindex` on the viewer, `:host(:focus-within)` outline with the
   token, the focus-containment test beside the tag-name guard;
   `preventDefault()` audited and found already narrow (no change). Ships the
   antisocial-behavior fix without waiting for the promotion. **Note what this
   does NOT ship**: an embed still has no key handling of its own, because the
   listener lives in `workbench/`, which embeds never load. Stage 1 stops the
   workbench from over-claiming; stage 2 is what makes an embed *work*.
2. **Move the listener to the host element** — with
   [core-editor-element-promotion.md](../proposed/core-editor-element-promotion.md), when
   the mount layer becomes `elements/`-tier. Deletes the window listener and
   the focus test together: containment becomes structural.
   **RETIRED as "not wanted" (2026-08-14)**: the fork below was answered by
   [core-viewer-embedded-app.md](core-viewer-embedded-app.md) — **embeds view;
   studio edits**. A read-only embedded viewer needs no key handling beyond
   *not stealing the host's keys*, which stage 1 already delivers, so there is
   nothing here left to want. If studio later brings the editor into
   `elements/`, this stage returns as item 3 of the promotion's work list,
   where it already lives. **This doc is complete for its scope.**
   Original blocking analysis, kept for the record (trigger re-check
   2026-08-14): the promotion's
   trigger 1 (a stable intent vocabulary) is **met** — five changes to
   `intents.ts`, all additive, no renames ever — so the only thing standing
   is trigger 2, *a real second consumer asking for editing*. That is a
   product decision, not engineering, and it has a fork worth forcing:
   **if embeds are read-only by design, stage 2 is not "pending" but "not
   wanted"** — a read-only embedded viewer needs no key handling beyond not
   stealing the host's keys, which stage 1 already delivers, and this doc can
   close. The promotion doc now carries the three ways forward (decide the
   consumer question · a scope-only intermediate needing no boundary change ·
   the full promotion).
3. ~~**The overlay's unfocused state**~~ — **built**: `selection-inactive`
   fades enclosure, ghost cell and accent recolor, driven by the shared
   `editorHasKeyboard` predicate. Not yet covered: the whole *window* losing
   focus (another app in front) leaves `activeElement` inside us, so the
   overlay stays bright while no key can arrive — arguably correct (the
   editor is still the page's keyboard owner), revisit if it reads wrong.
4. ~~**The shell/editor binding assertion**~~ — **built** with stage 1.
