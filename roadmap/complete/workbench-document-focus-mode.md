# Document focus mode — the viewer, then the browser

> **Status: COMPLETE (2026-08-30).** Serves the **implementation loop** in the
> **workbench shell**. Adds one workbench presentation state around the renamed
> `<mnx-document-viewer>` from
> [core-document-viewer-rename.md](../complete/core-document-viewer-rename.md). It does not add a
> fullscreen property to the embeddable element: hiding host chrome and sizing a host are
> composition, not rendering options.
>
> **Built verdict.** Landed in `07fd891`. `Ctrl+Alt+F`, the scenario-page focus button and
> `view: focus document` all toggle one transient shell-owned state; only the document
> surface, its zoom/focus pad and invoked editing overlays remain. `Ctrl+B` and `Ctrl+Alt+B`
> reveal their panes
> immediately, scenario-to-scenario navigation preserves focus, and non-scenario navigation
> exits it without mutating remembered pane preferences. Native `F11` remains browser-owned;
> a separate feature-detected palette action drives the Fullscreen API and follows
> `fullscreenchange`. Evidence: 1,214 tests, the 120-scenario checker, production build,
> primitive regeneration with an empty scenario diff, and a real-Chrome smoke covering
> viewport geometry, two-axis resize/repacking, overlays, restoration and route transitions.
> A same-day usability refinement keeps the zoom pad visible in focus mode and gives it a
> permanent, state-aware focus/exit button: the mode no longer hides both a useful document
> control and its own escape route, while the control remains ScenarioPage chrome rather than
> moving into `<mnx-document-viewer>`.

## Two levels, two owners

“Fullscreen” currently hides two independent boundaries:

| Level | Owner | Meaning | Control |
|---|---|---|---|
| **document focus** | workbench | hide workbench header, scenario rail, view strip and side panel; the document surface occupies the browser viewport with its zoom/focus pad retained | `Ctrl+Alt+F` or the pad's focus toggle |
| **browser fullscreen** | browser | hide tabs/address bar/window chrome as the platform permits | native `F11`; optional command/button through the Fullscreen API |

The names matter. Calling level 1 “fullscreen” would make the UI claim browser chrome has
gone when it has not. Calling both levels one mode would make exit order and state ownership
unknowable.

The existing focus-scope contract already places `F11` at browser/OS scope alongside
`Ctrl+T`, `Ctrl+W` and `Cmd+Tab`; the page must not bind it. `Ctrl+Alt+F` has no current
editor or shell collision and says *focus* without consuming another plain editing letter.
It joins `SHELL_BINDINGS`, because this is workbench chrome like `Ctrl+B` (rail) and
`Ctrl+Alt+B` (document panel), never an `EditorIntent` and never part of the embed face.

## The resting picture

On a normal render in document focus mode the viewport contains one persistent component:

```
mnx-workbench
└─ mnx-scenario-page
   ├─ mnx-document-viewer   fills the available viewport
   └─ mnx-zoom-pad          retained document controls + focus/exit toggle
```

The viewer's selection/enclosure remains because it is part of the document surface. Page-
level interaction UI may appear **transiently when invoked**: selection tray, rung inspector,
setup popover, clipboard notice and command/model dialogs. The zoom pad remains because
document scale and density are still useful here; its adjacent focus icon is a permanent,
discoverable exit that changes to “focus document” outside the mode. The app header, rail,
view tabs, panel toggle and side panel disappear. The resting state is therefore the viewer
plus its compact document-control cluster, not a mode that disables editing or hides its own
escape route.

Loading, failed and invalid-by-design scenarios are exceptions to the literal element tree.
The scenario page already omits the viewer for an invalid-by-design exhibit. Focus mode must
still show that main document surface rather than a blank viewport, so the implementation
targets the scenario page's **main region**, not “find this tag and fullscreen it”.

## State and restoration

`WorkbenchApp` owns `documentFocus`: it is the only layer that can remove both its own
header/rail and the scenario page's chrome. It reflects a host attribute for the outer grid
and passes a boolean property to `ScenarioPage`, which suppresses its head, side panel and
makes `.body` one column. The page passes that state to its retained zoom pad so the pad's
focus button presents the correct enter/exit action.

The state is deliberately:

- **transient** — no `localStorage`; entering focus mode in one tab must not make a later
  visit look broken;
- **not URL state** — it says how this window is being used, not which document/view a deep
  link identifies;
- **independent of the rail/panel preferences** — do not call `toggleRail()` or
  `togglePanel()` to enter. Their remembered values remain untouched and return exactly on
  exit;
- **scenario-scoped** — it may survive scenario→scenario navigation through go-to, but
  navigating to the attention queue or objects page exits it automatically;
- **reversible by the same key** — `Ctrl+Alt+F` exits without changing any remembered pane
  state. `Escape` keeps its existing innermost-pending/deselect meaning; browser fullscreen
  may consume Escape at its own level, but the workbench does not add another claimant.

Pane shortcuts must not mutate invisible preferences. While document focus is active,
`Ctrl+B` exits the mode and reveals the scenario rail; `Ctrl+Alt+B` exits and reveals the
document panel. The result is visible on the same keystroke, rather than a hidden toggle
whose effect surprises the reader later.

## Layout work

The mechanism is small because both pane folds already exist and the viewer already watches
its own box with `ResizeObserver`:

1. Add `toggleDocumentFocus` to `ShellAction`/`SHELL_BINDINGS` and its key documentation.
   Handle it in `WorkbenchApp`; do not teach `ScenarioPage` or the viewer to interpret a
   second keyboard table.
2. Add a reflected `document-focus` state on `mnx-workbench`. Its grid becomes one row/one
   column, `header` and `nav` are not rendered (or are `display: none`), and `main` occupies
   `100vh`/the fullscreen host.
3. Pass `.documentFocus` to `mnx-scenario-page`. In that state omit `.head`, force `.body`
   to `1fr`, omit the side panel, retain the zoom pad, and let `.main`/the viewer retain
   `min-width: 0`, `min-height: 0` and overflow ownership.
4. Decide the focus-mode gutter deliberately. The element must fill the viewport, but the
   paper need not touch glass: retaining the workbench's 14px viewer padding preserves a
   legible bench; zeroing it is accepted only after a visual comparison, not as a consequence
   of the word fullscreen.
5. Add a normal-mode button beside the existing view/panel controls, a palette row
   `view: focus document`, and a state-aware focus/exit button beside the zoom pad that
   remains present in both modes. On entry show a short non-interactive hint —
   “Ctrl+Alt+F to exit” — which fades while the permanent pad control remains.

No `fullscreen`, `focusMode` or `hideWorkbench` property is added to
`<mnx-document-viewer>`. The viewer contract's rule remains intact: element knobs bind
engine presentation; workbench chrome composes outside it.

## Browser fullscreen

Native `F11` remains the primary level-2 shortcut. A discoverable palette/button action may
call `requestFullscreen()` on `<mnx-workbench>` when available and label itself
`view: browser fullscreen`; while the API owns fullscreen, `fullscreenchange` updates that
row/button and `document.exitFullscreen()` reverses it. It gets **no second workbench key**:
the browser already owns the shortcut and platform conventions differ.

Document focus and browser fullscreen remain orthogonal:

1. `Ctrl+Alt+F` removes workbench chrome.
2. `F11` (or the API action) removes browser chrome.
3. Reverse them in either order; leaving browser fullscreen does not silently restore the
   workbench chrome, and leaving document focus does not force the browser out of fullscreen.

A single escalating cycle is rejected. Native browser fullscreen is outside the workbench's
state machine, and “first press hides panels, second press takes over the browser, third press
does what?” is not a shortcut a reader can predict.

## Verification

- Extend keymap conformance: `Ctrl+Alt+F` resolves only to the shell action, collides with no
  editor layer and appears in the generated key documentation/palette hint.
- Add a focused browser smoke: record rail-hidden/panel-hidden preferences, enter the mode,
  assert header/nav/page head/panel are absent, assert the zoom pad and its state-aware exit
  are visible, and assert the main surface and viewer bounding boxes occupy the viewport.
  Exercise the pad toggle in both directions, then prove the exact prior pane state returns.
- In the same smoke, resize through both width and height while focused and assert the
  viewer's rendered system packing updates — the existing container observer is the seam,
  not a synthetic window-resize call.
- Exercise a tray or setup shortcut in focus mode and prove the transient overlay remains
  usable, then closes back to the viewer-only resting state.
- Exercise queue navigation to prove it exits the mode, and scenario→scenario go-to to prove
  the mode can remain active.
- Feature-detect the Fullscreen API in browser smoke; test its state helper without making a
  headless browser's fullscreen policy a build requirement. Native `F11` itself is a manual
  platform check, not an event the harness pretends to own.
- Run `npm test`, `npm run check:scenarios` and `npm run build`. Then run
  `npm run update:primitives` and require a clean scenario diff: giving the viewer more room
  may repack the live display, but no fixed golden viewport changed.

## Not this

- Not a focus trap: Tab can still leave the viewer, and text inputs/overlays retain their
  existing innermost keyboard ownership.
- Not a presentation or slideshow mode, playback feature, new projection, or score picker.
- Not persisted user preference and not part of a scenario deep link.
- Not a viewer API. An arbitrary embed host remains responsible for its own fullscreen and
  chrome.
