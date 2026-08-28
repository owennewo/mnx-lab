# Rungs get their own keys, and Escape gets its meaning back

> **Status: proposed 2026-08-28.** Amends the ladder's key story from
> [core-selection-ladder.md](../complete/core-selection-ladder.md) — whose
> **Scrub alias 2026-08-20** note is the direct predecessor and got half of
> this right — and revises the anchor gesture from
> [core-element-ops-spanners.md](../complete/core-element-ops-spanners.md).
> **No golden moves**: this is the input layer plus workbench chrome, so there
> is no debt for [lab-verify.md](../inprogress/lab-verify.md).

## The problem

**Escape walks the ladder, and hands-on that misfires.** Reaching for Escape as
"back out of what I'm doing" — the meaning it has in every other application —
widens the selection instead. The mistake is not learnable away, because the
reflex being violated is older and stronger than the ladder.

The 2026-08-20 scrub-alias note found half of this already:

> Hands-on use found Esc/Enter right in meaning but wrong in feel for
> *bouncing* between rungs: they are terminal keys on opposite corners of the
> keyboard, Esc sits fourth in a precedence cascade, and Enter will grow an
> input cliff at the note rung.

Its fix was to add **Shift+↑/↓** as a fluency alias while keeping Esc/Enter on
the semantic argument that "Escape widens until it cancels, Enter narrows until
it acts". That argument is sound on paper and wrong in the hand: adding a better
key did not stop the worse one from firing. The alias fixed the *feel* and left
the *misfire* in place.

So the ladder should be evicted from Escape and Enter entirely — which is also
the only way to get either key back for the jobs they are actually shaped for.

Three separate jobs are currently fused onto two keys:

| Job | Today | Wanted |
|---|---|---|
| Step one rung | Escape / Enter, **and** Shift+↑/↓ | Shift+↑/↓ only |
| Jump to a named rung | walk it, or open the tray and click | **Shift+1–8** |
| Abandon / commit a pending gesture | Escape, buried inside `relaxSelection` | **Escape / Enter**, stated once |

## Decisions

### 1. Escape and Enter stop moving the ladder

The three `NAVIGATION_LAYER` bindings go: `Escape → relaxSelection`,
`Enter → tightenSelection`, `NumpadEnter → tightenSelection`
(`src/edit/keymap.ts:76–79`). The **intents stay** — `destructWalk.ts:320,355`
drives them programmatically and the tray, chip and HUD all still walk. This
unbinds keys; it deletes no vocabulary.

### 2. Shift+1–8 is the absolute rung jump

`1` = `note` … `8` = `document`, in `SELECTION_LADDER` order, which is also the
tray's narrowest-first column — so the digits count *down* the drawn ladder and
the chip's ▲▼, the tray column and the numbers all agree.

Shift+digit is free by survey, not by luck: nothing in `keymap.ts` binds a
shifted digit (digits appear only as bare `Digit0–9`/`Numpad0–9` in
`TAB_DIGIT_LAYER`), every `SHELL_BINDINGS` entry is Shift+*letter* or a Ctrl
chord, and no browser claims Shift+1–8.

It is also the *last clean global tier*. The alternatives were checked and all
fail: **Ctrl/⌘+digit and Alt+digit** are browser tab selection and are not
preventable; **Alt+letter** hits the browser/OS menu accelerators and Alt already
means "change" here; **Ctrl+letter** is claimed across most of the alphabet;
**bare letters** are spent on the technique and adornment dialects.

### 3. Shift+↑/↓ stays exactly as it is

Relative stepping is unchanged, open or shut, in the tray or out of it. The
digits are the absolute layer beside it, not a replacement.

### 4. Escape and Enter get the pending-gesture contract

Stated once, as a mirrored pair:

> **Escape abandons the innermost pending thing. Enter commits it.**
>
> 1. popover / overlay — own their keydown and `preventDefault()`, unchanged
> 2. pending fret digits (`TabDigitResolver.candidate`)
> 3. an armed spanner anchor (`Session.spanAnchor`)
> 4. nothing pending → Escape deselects · Enter is free (the note-rung input
>    job `session.ts:1379` already reserves)

This is `ESCAPE_PRECEDENCE` keeping its shape and losing its rung-walking middle
step, with Enter as its counterpart for the first time.

Both are bound as **`ShellAction`s, not `EditorIntent`s** — the same test the
clipboard verbs already pass. Abandon and commit must consult the mount-owned
fret resolver *and* session state *and* possibly deselect (which
`ScenarioPage.ts:2291` already calls view chrome, not session history), so the
mount is the only layer that can arbitrate, and it dispatches the **resolved**
intent downward in the established pattern.

### 5. The spanner anchor grows a kind

`spanAnchorKey: string | null` becomes `spanAnchor: { key, kind: 'slur' | 'beam' } | null`.

Enter cannot complete an armed gesture without this: the anchor is a bare note
key today, and the kind is decided at *completion* by which letter you press.
Two live defects fall out of the same change:

- **Cross-kind completion is reachable.** Arm with `S`, complete with `B`, get a
  beam — and the reverse. Nothing prevents it and nothing documents it. After
  this, a mismatched letter refuses rather than silently switching kind.
- **The HUD lies about beams.** `ScenarioPage.ts:4037` hardcodes
  `· slur from <key>…` with the tooltip *"press S again at the far note to
  complete the slur · Esc drops it"* — shown verbatim when a **beam** is armed.

`S` (and `B`) stay as completers at the far note. Enter becomes a second way in,
not a replacement, and it dispatches the armed kind's own intent — so the trace
still records `toggleSlur` twice and replay is bit-for-bit what it is today.

### 6. The fret buffer gets the abandon key it never had

`TabDigitResolver.cancel()` drops a pending digit without touching the document
and is commented **"Used only by tests"** — an abandon path with no key bound to
it. Meanwhile `ScenarioPage.ts:2261` flushes on *any* resolved action, so Escape
mid-fret-entry currently **writes the fret** and then walks a rung. Escape must
`cancel()` here, and must be excluded from that blanket flush.

Enter gains the symmetric win: commit the candidate immediately instead of
waiting out the 500 ms `ENTRY_DIGIT_WINDOW_MS` timer.

### 7. `walkToLevel` stops parking

`ScenarioPage.ts:3089` steps toward the target and **stops early when a step
doesn't move**, so an absent rung leaves you at the nearest reachable one. That
is correct for relative stepping and a lie for absolute addressing: Shift+3 in a
document with no tuplet would silently deposit you on `voiceMeasure`.

Introduce a **`goToLevel` intent** carrying the target, guarded by
`presentLevels`. An absent rung is a clean no-op with a flash on the chip — a
dead key with no feedback is what teaches people a shortcut can't be trusted.
The chip's ▲▼, the HUD rows, the tray's rungs and the new digits then all funnel
through one call, and the trace records **one** jump for one keypress instead of
the current N relax/tighten steps.

### 8. The tray's ladder column prints the ordinals

Dim `1`–`8` at the rungs' own indent. Nothing in the UI numbers the rungs today,
which is the one real objection to a numeric tier — so the slow surface becomes
the legend for the fast one, which is how every palette-plus-shortcut pairing
works. One render change, no new gesture.

## Rejected: `/{n}`

Opening the tray and typing a digit was considered and does not work.

- **Digits already reach the search line.** `SelectionTray.ts:1122` routes any
  printable character to the query box; carving digits out costs them as search
  characters in a surface whose op names plausibly contain them (`8th`, `16th`,
  triplet `3`, time signatures).
- **The tray's ladder is preview-then-commit on purpose**
  (`tray-rung-preview` → `tray-rung-commit`). So `/1` must either preview and
  stay open — `/`, `1`, `Enter`, three keys and a panel for what Shift+1 does in
  one — or commit and close, which makes the digit behave unlike Shift+↑/↓ *in
  the same surface*, breaking the tray's own rule that the ladder gesture "does
  not change meaning when the surface opens".
- **`/` is the wrong door.** `keymap.ts:246` splits the surfaces explicitly: `/`
  is the **command** surface, Ctrl+G the **destination** one. A rung jump is a
  destination.

Noted for the record, since it is the better idea if the tray ever wants a fast
rung path of its own: the rungs' first letters are **all unique** — `note`,
`event`, `container`, `voiceMeasure`, `partMeasure`, `measure`, `section`,
`document` → n, e, c, v, p, m, s, d. Unusable globally (bare letters taken, Alt
and Ctrl contaminated), but inside the tray they need no global binding and no
legend at all.

## The known cost: AZERTY

Bindings match `KeyboardEvent.code`, so `{ code: 'Digit1', shift: true }` is the
physical key on every layout and resolution is layout-proof. Two things are not:

- **The label is `Shift+1`, never `!`.** Shifted Digit1 prints `!` on QWERTY and
  German QWERTZ but `1` on AZERTY. Naming the position reads correctly on both;
  naming the glyph is a QWERTY-ism that would be wrong in the cheatsheet.
- **On French/Belgian AZERTY the digit row is shifted** — `Shift+&` *is* how you
  type `1`. Today that stroke matches nothing (fret bindings require Shift up,
  and AZERTY users get frets off the bare key, which is the `code` discipline
  working as intended). After this, an AZERTY player reaching for "fret 1" the
  way their keyboard is printed jumps the selection to `note` instead.

Accepted, with eyes open: the harm is bounded to a **non-mutating, visible,
one-keypress-reversible** rung change in the pane where digits matter most.
Recorded here so it is a known cost rather than a bug report later, and it is the
concrete reason to revisit if layout-aware bindings ever land alongside the
emulation presets `keymap.ts:8` reserves.

## Work

**1 · `src/edit/keymap.ts`** — drop the three ladder bindings; add
`Digit1–8, shift` → `goToLevel`; add `Escape` and `Enter`/`NumpadEnter` to
`SHELL_BINDINGS` as `abandonPending` / `commitPending`; rewrite the
`ESCAPE_PRECEDENCE` block as the two-sided contract.

**2 · `src/edit/intents.ts`, `src/edit/session.ts`** — add `goToLevel` (presence-
guarded) and `dropAnchor`; kind the anchor and refuse cross-kind completion;
remove the anchor branch from `relaxSelection` (`session.ts:1358`) so Shift+↑
means widen with no first-press exception; update the `spanAnchor` getter.

**3 · `src/workbench/ScenarioPage.ts`** — the abandon/commit cascades; exclude
Escape from the blanket `flushPendingFret()` at `:2261`; refactor `walkToLevel`
onto `goToLevel` with the no-op flash; drop the relax-past-top/`cursorHidden`
special-casing at `:2293` and `:2320` in favour of an explicit deselect; make the
`· slur from …` strip and its tooltip kind-aware.

**4 · `src/workbench/SelectionTray.ts`** — ordinals in the ladder column.

**5 · Tests.** `keymap-docs.test.ts` runs the binding↔documentation join **both
ways**, so this cannot be half-done: retire the Escape/Enter ladder rows, add
eight digit rows (labelled `Shift+1`…), and update the polarity assertion the
ladder doc pins there. New coverage for the presence guard (absent rung is a
no-op, not a park), refused cross-kind completion, and Escape cancelling a
pending fret rather than committing it.

**6 · Stale comments — normative, must change with the code.**

| Where | What it says now |
|---|---|
| `keymap.ts:70–79` | Escape relaxes / Enter tightens, at the bindings themselves |
| `keymap.ts:277–300` | `ESCAPE_PRECEDENCE`, the four-step doctrine block |
| `selection.ts:244` | "Escape never changes meaning, it just becomes gradual" |
| `session.ts:1357` | "Escape drops an armed spanner anchor before it does anything else" |
| `hudRows.ts:84` | "the column always matches what Escape/Enter can reach" |
| `ScenarioPage.ts:2289–2293` | the ladder/deselect comment block |
| `ScenarioPage.ts:3082` | "a second way to change the selection beside Escape/Enter" |
| `SelectionTray.ts:1060–1066` | "Shift+↑/↓ keeps the ladder — the same chord … with the tray shut" |

**7 · Stale roadmap docs — dated amendment notes, not rewrites.** Complete docs
are records of their moment; the house form is the inline dated note, precedent
at `core-selection-ladder.md:222` (*Scrub alias 2026-08-20*) and `:239`.

- **[core-selection-ladder.md](../complete/core-selection-ladder.md)** — the big
  one, and the one this doc answers. A note beside the scrub-alias paragraph
  saying its half-measure went the rest of the way, plus the passages that state
  the old contract outright: `:5`, `:185`, `:308–317`, `:389`, `:512`, `:610`.
- **[core-element-ops-spanners.md](../complete/core-element-ops-spanners.md)** —
  the gesture table at `:50` gains the kind and Enter, and "one nullable note
  key" is no longer the shape of the state.
- **[core-selection-tray-mechanism.md](../complete/core-selection-tray-mechanism.md)**
  — the Escape-precedence references at `:211`, `:231`, `:248`, `:272`.
- **[core-selection-floor-axis.md](../complete/core-selection-floor-axis.md)** —
  "Enter tightens" at `:73`.

Deliberately **left alone** as accurate history or still-true tray-internal
behaviour: `core-keymap-cheatsheet.md:58` (describing the problem as it stood),
`workbench-selection-chip-ladder.md:93` and
`core-selection-tray-global-tab.md:23–25` (Enter inside the tray is unchanged).

## Open questions

- **Do Shift+digits punch through an open tray?** The tray *is* the ladder, so
  arguably yes — but `event.key` for Shift+1 is `!`, length 1, so it currently
  reaches type-to-search and would need carving out ahead of that rule. Leaving
  them to the search box is defensible and cheaper.
- **Does Enter-completes-a-spanner record `toggleSlur` or a key of its own?**
  Recommended above as the kind's own intent, so replay is unchanged — but it
  does mean the trace shows a letter the user did not press, which the spanners
  doc's "the recorded intent is what was pressed" was written against.
- **What else earns Escape once it is free?** Deliberately unanswered. The point
  of this item is to stop Escape doing the wrong thing; finding it more work is a
  separate decision and a separate doc.
