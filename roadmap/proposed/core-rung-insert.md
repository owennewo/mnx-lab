# Insert at the rung — `I`, `Shift+I`, and the ghost past the end

> **Status: proposed 2026-08-24.** Serves the **implementation loop**. Grew out
> of hands-on testing of
> [core-entry-surface.md](../complete/core-entry-surface.md): `Shift+M` appends
> a bar at the **end of the score**, never at the cursor, and there is no way
> to put a bar anywhere else at all. Two gestures come out of that — a
> rung-aware **insert** (`I` / `Shift+I`) and a **ghost bar past the end** —
> and they are one item because they partition the same problem: insert owns
> the middle, the ghost owns the end.

## The gap, exactly

The structural rungs all removed positionally and constructed by appending:

| rung | removal | construct |
|---|---|---|
| container | `removeContainer` (indexed) | `wrapInContainer` (takes a range) |
| voiceMeasure | `removeVoiceMeasure` (indexed) | `addVoiceMeasure` — **appends** |
| partMeasure | `removePartMeasure` (indexed) | — |
| measure | `removeMeasure` (indexed) | `appendMeasure` — **end of score** |
| document | `removePart` (indexed) | `addPart` — **appends** |

This is the same asymmetry [core-entry-surface.md](../complete/core-entry-surface.md)
closed one tier down — removal knew where it was, construction did not — and
the fix has the same shape: **the verb takes a position, and an absent position
means what the verb already meant.**

There is no `insertMeasure` op in the codebase at all. `appendMeasure` pushes
onto `global.measures` and every part's array; a bar cannot be added anywhere
but the end, so a pickup bar is currently unauthorable.

## Which rungs can have "insert", and which can have a side

A rung earns **insert** when its members are an ordered sequence of siblings the
cursor already walks. It earns **before/after** when that order is one the
reader can see, rather than an array index that happens to exist.

| rung | insert | side | why |
|---|---|---|---|
| note | *has one* | **no** | A chord is a set. Entry addresses it **spatially** (pitch or string) and display order is derived — `buildGrid` sorts by line, then pitch. There is no "before" in a chord, and `noteIndex` is key material. |
| event | **yes** | **yes** | Strictly ordered in time and walked by ←→. The most wanted, and the hardest — see §8.11 below. |
| container | no | — | The construct verb is a **wrap**: it takes a range, not a position, and an empty tuplet is not a thing. |
| voiceMeasure | yes (`addVoiceMeasure`) | **no** | The voice ordinal is **identity, not layout** — voices stack by stem direction, not index — and note keys embed it, so a side would mean renumbering. |
| partMeasure | no | — | A staff exists for the whole part or not at all; `staves` is a part-level declaration, not a member of this bar. |
| **measure** | **yes** | **yes** | Ordered in time, visible, and `removeMeasure` is already positional. |
| section | boundary only | no | Sections are **derived** from `section` labels on global measures. You do not insert between them, you mark a boundary at a bar. |
| **document** | **yes** (parts) | **yes** | Parts are ordered in score order and that order is what the reader sees. `addPart` appends — the same bug one tier up. |

**Insert makes sense at five rungs; a side is meaningful at three** — event,
measure, and part. Two ordered in time, one in space. The three refusals fail
for three genuinely different reasons (unordered set, index-as-identity,
construct-is-not-an-insert), which is why a single gesture cannot simply be
scoped to every rung and left to sort itself out.

## The ghost past the end

The second gesture. Today `→` at the last position is a **dead key**:
`movePosition` returns the cursor unchanged, and `moveMeasure` refuses when the
target bar does not exist.

The tempting move is to make that arrow *append a bar*. It should not, for
three reasons, and the third is the interesting one:

1. **"Bare arrows never mutate"** is stated doctrine in
   [keymap.ts](../../src/edit/keymap.ts) (input survey §3.2) and enforced
   everywhere else — Alt+arrows re-pitch, Alt+arrows re-value.
2. **Autorepeat.** Holding `→` to skim a piece would manufacture bars at the
   key-repeat rate. That is the failure that would actually bite.
3. **The codebase already has the right idiom, one scale down.** `buildGrid`
   emits an **entry ghost** — the unfilled remainder of a bar — a position with
   no event behind it, existing precisely "so the cursor can stand where the
   next note will be inserted."

So: **extend the ghost one bar past the end of the score.** `→` at the last
position moves onto a **ghost bar**; at the note and event rungs that is its
first entry position, which is the existing entry ghost in a bar that does not
exist yet. Everything good follows from it being *navigation*:

- the bare-arrow rule survives untouched;
- autorepeat is harmless — there is one ghost bar and you stop on it;
- it can be **drawn**, faint, which is a far better affordance than a key that
  silently changes meaning at a boundary;
- nothing is left behind if you arrow away again, because no document changed.

**Materialisation is on the keystroke, not the arrival** — the same rule
`addVoiceMeasure` follows: the cursor stands somewhere real and the keystroke
is what commits. The bar and the note it received must land as **one `batch`
op**, or undo would leave an orphaned empty bar behind the note it removed.
Once materialised, a fresh ghost appears past the new end, which is the whole
"keep typing and the score grows" behaviour.

## Deliberately unspecified: `←` at the *start* of a rung's list

`←` on the first item is also a dead key, and the symmetric reading ("a ghost
bar before bar 1") is available. **This item does not specify it**, on purpose:
`Shift+I` already makes a pickup bar authorable, so the leading ghost would buy
reach nothing else offers — which is exactly the condition under which it
should be decided on its own evidence rather than for symmetry. Left open.

## The event rung collides with the full-bar invariant

Insert at the event rung runs straight into §8.11: the bar is already full.
"Insert a quarter before this one" must either steal from neighbouring rests or
push a beat out of the bar, and this codebase never silently clamps and never
consumes ink.

That is the same **kind** of question the entry surface answered for voice
creation, and it deserves the same treatment — decided once, stated in the op's
declaration, applied everywhere. It is also the argument for not letting it
block the other two: measure and part are unambiguous and fix a bug that has
been hit in real use.

## The hazard insert has to design against

Inserting mid-score shifts every later positional key, and that turns out to be
**safe**: every cross-reference in the model is id-based. Ties mint `note.id`,
slurs and beams resolve to event ids, an ottava's `end.measure` and a score's
`systems[].measure` are measure ids.

Three fields are not. Each is a **bar count anchored at a start bar**, so a bar
inserted inside its span silently widens what it covers:

- `ending.duration` — how many bars the volta spans
- `measureRepeat.number` — how many bars are repeated
- `multimeasureRests[].duration` — how many bars collapse into the H-bar
  (its `start` is an id, so only the length is at risk)

A first cut must either adjust these or refuse loudly. Refusing is the
house habit for guarded removal and would be defensible here too, but silently
re-spanning a volta is the one outcome that is not.

## Keys

`I` = insert after, `Shift+I` = insert before. Both are free (`KeyI` appears
nowhere in the keymap), and it mirrors the scheme already in place: `Del` is
"remove at this rung", so `I` is its construct twin, with the side as a
modifier rather than a second key to learn. Rung-generic by construction — the
same key means bar, part, or event depending on where you are, which is the
ladder's own promise.

**`Shift+M` retires**, and it is referenced in four places that must move
together: the binding in `keymap.ts`, the `add-bar` tray tile in
`commandRegistry.ts` (scoped `['document', 'measure']`), the palette's
`edit: add bar` hint in `WorkbenchApp.ts`, and the `KEY_DOCS` row in
`keymapDocs.ts`. Keep the `appendMeasure` **op** underneath — "add a bar at the
end" is still a real thing to want, and the ghost is now its gesture.

## Scope

- `insertMeasure { measureIndex, side }` and its removal twin already present.
- `addPart` gains an optional insert position — **absent means append**, the
  convention `EntryTarget` established, so no committed trace moves.
- The `I` / `Shift+I` bindings, resolving per rung; a rung with no insert
  refuses rather than falling back to a wider one.
- The trailing ghost bar, materialised on keystroke as one `batch`.
- `Shift+M` and its four references retired.

## Not in scope

- **The event rung's insert** — it needs the §8.11 policy decided first, and
  that is its own item.
- `←` at the start of a rung's list, as above.
- Voice and staff insertion with a side, which would mean renumbering.
- Moving existing music (re-assignment), which is an edit to music that exists.

## Evidence when it lands

**The corpus has no anacrusis scenario** — checked, the only short first bars
are tuplet and `space` artifacts — so a pickup bar would need one authored, and
a new scenario is a weaker oracle than an existing golden. The sharper test
needs no corpus at all:

**Commutativity against a committed trace.** Take a traced multi-bar scenario
and rebuild it *out of order* — write bar 2 first, then `Shift+I` bar 1 in
front of it — and require the primitives to equal the same golden the in-order
trace already matches. That is a real proof of insert (the middle of the score
moved, and everything downstream still resolved), and it reuses evidence the
repo already trusts rather than minting a new claim to check it against.

Three more, each aimed at one risk this doc names:

- `I` and `Shift+I` at the **document** rung in a trace — parts inserted in
  score order, not appended.
- **Ghost-bar materialisation whose undo returns byte-identically** to the
  document before it. This is the `batch` requirement, and undo-to-`{}` is
  already every trace's second verdict, so the harness can see it.
- A **volta or measure-repeat span that is provably not re-spanned** by an
  insert inside it — the one hazard whose failure mode is silent.
