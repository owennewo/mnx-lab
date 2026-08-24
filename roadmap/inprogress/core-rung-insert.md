# Insert at the rung — `I`, `Shift+I`, and the ghost past the end

> **Status: in progress. Proposed 2026-08-24; the INSERT half built the same
> day — see *Built so far* at the foot. The ghost is still to come.** Serves the **implementation loop**. Grew out
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

## The event rung collides with the full-bar invariant — ANSWERED 2026-08-24

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


---

## Built so far — 2026-08-24, the insert half

`I` / `Shift+I` resolve per rung and land where they should. **The ghost past
the end is NOT built yet**, but **`Shift+M` is gone anyway** — see the section
below, which corrects this doc's own plan.

Landed:

- **`insertMeasure { measureIndex, side, partIndex? }`** — the positional twin
  `removeMeasure` always had and `appendMeasure` never was. The new bar is
  padded for the cursor's part on the same rule `appendMeasure` follows.
- **`addPart` takes an optional `partIndex`** — absent appends, the convention
  `EntryTarget` set, so no committed trace moved.
- **`insertAtRung { side }`**, one intent read off the rung: bar at `measure`,
  part at `document`, voice at `voiceMeasure` (`after` only). Every other rung
  **refuses rather than climbing**, which the tests assert bar-count-unchanged
  rather than merely by return value.
- **`widenSpansCovering`** — the silent hazard, closed. A span is widened
  exactly when the new bar lands inside `s … s+d-1`.
- Tray tiles at the measure and score rungs; the voice tile now names `I` too.
- **`goToEdge { edge }`** on `Home` / `End`, and `Shift+M` retired.

### Two things learned in the building

**The rung has to survive a structural insert.** `apply()` re-anchors at the
note rung by default — right for entry, wrong here: it made the *second* `I`
refuse, so inserting two bars in a row meant walking the ladder again between
them. Bar and part inserts now preserve the rung; the voice insert deliberately
does not, because the point of making a voice is to type into it.

**A refusing rung must not delegate upward, and delegation is easy to do by
accident.** `insertPartHere` first called `setPart` to land the cursor — and
`setPart` refuses a move to the index it is already on, which is exactly what
inserting BEFORE produces. The part was added and the verb reported failure.
Landing is done here now, the same rebuild `setPart` does.

### One friction found, not fixed

After `I` you stand at the **measure rung in an empty bar**, where ↑↓ means
"the neighbouring system" and the ladder will not descend to `note` because a
rest-only bar has no note to descend to. So the first pitch in a new bar cannot
be *aimed* before it is placed — you place it (entry works from `event`, and
snaps the rung to `note`) and then re-pitch. Pre-existing ladder behaviour that
this gesture merely walks into; recorded here because it is the one rough edge
a player will actually meet, and the ghost work is the natural place to judge
whether it needs anything.


## Correction — 2026-08-24: `Shift+M` goes now, not with the ghost

This doc planned to retire the append key *with* the ghost, on the grounds that
you should not remove a gesture before its replacement exists. That reasoning
was wrong, and the correction is worth keeping because it is a better statement
of what the item is for:

**`Shift+M` meant "insert at the end", and "the end" is a place the cursor can
go.** It never needed a verb of its own — it needed a way to get there. So the
replacement is not the ghost at all:

    End      →  the last bar
    I        →  insert after it

which is the append, spelled out of parts that already exist. `Home` comes with
it, and `goToEdge { edge }` is the intent, because a keymap cannot name the last
bar — it does not know how many there are, so the *edge* is what gets bound and
the session resolves the count.

That leaves the ghost to be what it actually is — **"keep typing and the score
grows"**, a fluency affordance — rather than the replacement for a key. Which
is a cleaner brief for it, and one it can now be judged on its own merits.

### What `appendMeasure` keeps, and why

The op, the intent and a keyless tray tile all survive, for a reason the tests
now pin: **genesis**. `insertMeasure` needs a bar to sit beside, so a document
with none cannot use `I` at all — `addPart` gives a part with an empty measure
list, and the first bar has to come from somewhere. `appendMeasure` is that
somewhere.

It matters beyond tidiness: all 28 committed construct traces open with
`addPart` then `appendMeasure`, and the keyboard-join verdict requires every
intent in a trace to be bound or named by a documented surface. The palette
entry is what keeps that true now the key is gone.


## The §8.11 ruling — 2026-08-24: insert may overfill, and the badge says so

The event rung was deferred here pending a decision on what "make room in a
full bar" means. **Ruled: it does not make room.** The bar is allowed to
overfill and the renderer reports it.

The reasoning, which is the codebase's own order of priorities rather than a
new one: making room would mean shortening or deleting music the author did not
name. This repo refuses to do that silently — no silent clamp, guarded removal,
ink is never consumed — and it refuses it *more strongly* than it insists on a
full bar. Faced with the two, the invariant is the one that yields.

It costs nothing to say so, because **the warning already existed**:
`validateDocument` has always reported `overfills the 4/4 bar: notes sum to 5
of 4 beats`, per voice, and the renderer already badges it. Insert did not need
a new diagnostic — it needed permission to produce a state the engine could
already describe.

So the invariant is restated, narrower and truer than before:

> §8.11 is a property of **entry**, not of the document at rest. Entry converts
> rests and keeps the bar full; a re-value pads or eats; a wrap re-pads. Insert
> suspends it deliberately, and an overfull bar is a legible state with a name
> — not a corruption.

The author resolves it with verbs they already have. The worked case, now a
test: a full 4/4 bar, `I` makes it five beats, select two events, `-` halves
them, the bar comes right and the badge clears.

### What that needed beyond the op

**The duration ladder had to learn ranges.** It re-valued exactly the event
under the cursor, so "select two notes and make them eighths" changed one of
them — the resolution step in the use case above did not work. It now steps
every event in a multi-member selection, each from its own value, so a quarter
and an eighth become an eighth and a 16th.

**The ops go back-to-front, and that is load-bearing.** `setDuration` addresses
an event by its ONSET, and re-valuing one moves every later onset — so
front-to-back the second op would aim at a moment that no longer holds what it
was aimed at. The delete path learned this first; same rule, same reason.

### One surprise worth knowing

The first `Shift+→` from a note-rung point **promotes to a one-event range**
rather than selecting two events. So selecting N events takes N presses, not
N-1. Pre-existing, and it surprised the tests before it surprised anyone else.

### On the fingerboard

`I` in the tab projection inserts on the **string the cursor is standing on**,
at fret 0 — the open string is the honest default there, since the line is a
string rather than a pitch, and a digit re-frets it exactly as it would any
other note. The capo is included, because fret 0 is capo-relative.


## Two corrections from use — 2026-08-24

Both found by driving the thing rather than testing it, and the second is the
more interesting.

**The cursor now follows an insert.** It stayed on the note you started from,
which made `I` feel like it had done nothing. Every other insert in this item
already moved (a new bar, a new part, a new voice); the event insert was simply
missed. `before` needs no move — the new note takes the onset the cursor
already holds — and `after` steps one along this voice's own events, which is
exactly where the new one was spliced.

**Delete now finishes.** The ladder went: Delete on a note → the note goes and
the event becomes a rest; Delete again → **nothing**, because `clearEvent`
clears to a rest and it was already one. The verb to say "and now go" did not
exist.

`removeEvent` is that verb, and the rule that decides between the two presses
is one the repo already had: **a container may be removed only once it is
empty.** An event is a container of notes, so an event holding ink is cleared,
and an emptied one is removed. No new principle — the ladder just stopped a
rung short of its own rule.

The bar underfills, and the badge says so. That is the same ruling `insertEvent`
carries, pointed the other way, and the pair is now symmetric:

| | effect on the bar | what says so |
|---|---|---|
| `insertEvent` | may overfill | `overfills the 4/4 bar: notes sum to 5 of 4 beats` |
| `removeEvent` | may underfill | `underfills the 4/4 bar: notes sum to 3 of 4 beats` |

Both refuse to repair the bar by touching music nobody named, and both leave a
state the engine can already describe.

Two details the tests pin: percussion counts as ink (a kit event carries
`kitNotes`, not `notes`, so an emptiness test asking only about `notes` would
have removed a drum hit outright), and multi-member removals go back-to-front,
because a splice moves every later event index out from under the ops still to
come — the same rule the ranged re-value needed.


## A rest is a thing you can select — 2026-08-24

Reported from use: after `I` then Delete, the selection box was drawn on the
wrong beat. The model was innocent — cursor and member both correctly at onset
1/4, the right rest selected — and the fault was entirely in the drawing.

**The cause.** `measurePositionX` places a selection with no ink to enclose by
**interpolating its metric fraction linearly across the bar**. Spacing is
springs-and-rods and a first system also carries a clef and a time signature,
so 25% of the way through the music is nowhere near 25% of the way across the
staff. It only ever bit rest-only moments, because everything else is enclosed
from real ink: the enclosure reads the finished SVG's `.selected` glyphs, and
noteheads carry a `sourceId` while **rests carried none**. Nothing in the SVG
said which rest was meant.

**The fix, stated as the principle it turned out to be: a rest is a thing you
can select, so it carries a name like every other thing you can select.**
`syntheticEventKey` is the event-level twin of the note key, in the same
grammar (`@[p<part>.]m<measure>[.s<staff>].v<voice>.e<event>[.c<container>]`,
part 0 and staff 1 silent), and it cannot collide with a note key because those
always end in `.n<i>` or `.k<i>`. A real `event.id` wins where there is one,
exactly as notes prefer theirs. `selectedEventIds` carries the highlight the
way `selectedNoteIds` does for notes; the enclosure needed one extra selector
(`.rest.selected`) and nothing else.

It fixes more than the reported bug: the cursor ghost shares the same fallback,
so standing on a rest was misdrawn too, and a rest is now something the JSON
cross-highlight and a future click-to-select can point at.

### The corpus cost, paid

**45 files, 9 verified scenarios demoted** — registered as batch 6 in
[lab-verify.md](lab-verify.md), queue 37 → 46 stale. The diff is a pure
metadata addition: a `sourceId` key on rest primitives and a `data-source-id`
attribute in the SVG. **No geometry, glyph or colour moved**, which is exactly
what the reviewer is asked to confirm — `spec/rest-positions` first, since it
is the scenario that exists to pin where rests sit.

The cheaper alternatives were considered and refused: snapping the interpolated
x to the nearest rendered column would have been right-looking rather than
right, and a fix that is usually correct is harder to debug than one that is
visibly wrong.


### The other half of it — the box was the GHOST, not the enclosure

Giving rests an id fixed the *colour* — the right rest lit up — and left the
box still drawn on beat 1. Because the box was never the enclosure: it was the
**cursor ghost**, which locates its column by a completely separate route.

`ghost.anchorKeys` are "note keys at the cursor's beat, used to locate the
column in the rendered SVG". A rest-only beat sounds nothing, so it offered
none, so the ghost hit the same `measurePositionX` fallback and landed on the
wrong beat — the identical failure, one layer over, and invisible while the
enclosure was the suspect.

Two lines of fix, once the rests had names: the cursor's context appends the
event key of any rest starting at its beat (notes still lead, because a column
with ink anchors more precisely than the rest sharing it), and the ghost's
locator accepts a `.rest` element as an anchor, not only a notehead or a fret
number.

**The tab staff draws no rest of its own** — rests there consume time silently,
by convention — so in the `both` view the tab ghost borrows the notation one:
the two projections share a spacing plan, so it is literally the same column.
In a tab-ONLY view there is no rest element anywhere in the SVG and the
fraction fallback still governs. That case is unfixed and named rather than
hidden.

**Worth keeping:** two overlays drew the same wrong answer for the same reason
through two different code paths, and fixing the one I could see left the one I
could not. The fraction fallback is still there, twice, and is still wrong
wherever it fires — it is now just much harder to reach.


### Third and last: voices only share columns while they agree about the bar

Still wrong in the `both` view, and the instrumented answer was unambiguous —
after insert-then-delete, the cursor's anchors came out as:

    anchorKeys = ["l45", "@m0.v0.e1"]
    rest  @m0.v0.e1   x = 15.6      ← the cursor's own voice
    note  l45         x = 16.1      ← a DIFFERENT voice, same beat

`anchorKeys` was documented as "note keys at the cursor's beat, **any voice**",
and notes led. That was sound while it was only ever asking "which column is
this beat in", because **voices share columns** — but they only share them
while they agree about the bar. Insert one note and this voice has five events
where its neighbour has four: the onsets still line up and the columns no
longer do. The ghost anchored to the neighbour's note and drew itself a column
away from the rest it was standing on.

**The cursor's own voice wins**, and notes still lead within it. The tab staff
draws no rest, so in the `both` view the ghost matches the notation rest and
uses its x — right, because the projections share a spacing plan, and the tab's
own columns for that voice skip the rest entirely (11.9 … 19.3, with the rest's
column at 15.6 between them).

**Three bugs, one root, three layers.** The enclosure could not find a rest;
the ghost could not either, for a different reason; and the ghost's anchor
ordering preferred a stranger. Each was invisible until the one in front of it
was fixed — and the fraction fallback that produced all three wrong answers is
still there, still wrong wherever it fires, now merely hard to reach.
