# Accidental spelling — the policy, the override, and the display

**Campaign:** [core-campaign-element-ops.md](core-campaign-element-ops.md), item 6.
Serves the **implementation loop**: our editor is the variable.

Built 2026-08-15.

## The item was two questions wearing one name

The row read "flats, enharmonic respell, `accidentalDisplay`/parentheses" as if
they were three sizes of the same thing. They are not, and separating them is
what made the item small:

- **Spelling** — *which letter and accidental name this sound.* A choice the
  editor must make on the player's behalf every time a pitch is computed rather
  than typed, with an override for when it guesses wrong.
- **Display** — *whether the accidental is printed, and in brackets.* Note-level
  ink, exactly like an articulation, and it belongs with the other adornments.

One is a policy plus a key; the other is a word in an existing popover. Nothing
about them is shared, and the row's "9+ scenarios" was one number covering both.

## The policy

`spellPitch(midi, fifths, direction)` in `src/edit/staffSpace.ts` — the module
that already owns pitch, clef and key context. The old rule lived in `ops.ts`
as five lines of placeholder ("prefer a natural, then a sharp") with a comment
promising this work, and it had a real consequence: **E♭ was unwritable.**
Stepping E down a semitone produced D♯, in every key, in both directions.

Three rules, in order:

1. **A letter the key already alters this way is the plain answer.** In E♭
   major the black key below F is E♭, not D♯ — the reader is carrying that flat
   already.
2. **Otherwise follow the key's sign.** Flat keys spell flats, sharp keys sharps.
3. **Where the key is silent, spell the direction of the move.** Down is a flat,
   up is a sharp. This is the ordinary convention, and it is exactly what makes
   Alt+↓ from E write E♭.

Double accidentals are never *chosen* — only asked for. A policy that can
produce F♭♭ from an ordinary keypress is a policy nobody can predict.

**Transposition now reads context it used to throw away**: the key of the bar
the note is in (per bar, since a document changes key mid-piece) and the sign of
the move. That is the whole of the change at the call site.

## The override

`J` — the key MuseScore and Dorico both use — cycles `enharmonicSpellings`:
every way the sound can be written with at most two accidentals, nearest first
(plainest letter, then flat before sharp). **The sounding pitch never moves**, so
a tab fret, a tie target and every reference survive; the letter, the accidental
and therefore the staff position change.

It **cycles rather than chooses** because "the other spelling" has no single
answer — C♯ is also D♭ and B♯♯. And the cycle is the policy's own candidate
list, so a spelling the policy would never pick is still reachable by asking for
it. One list, two uses: an override that could not reach what the policy avoids
would be no override at all.

## The display

`accidentalDisplay` gains the **enclosure** the corpus has carried all along
(`{show: true, enclosure: {symbol: "parentheses"}}` — the cautionary form), and
a way in: `accidental`, `accidental parens`, `accidental hidden`,
`no accidental`, in the **adornment popover** (`Shift+A`). No sixth popover for
two words — the accidental's display is note-level ink like the markings beside
it, and the family test (item 7) says a shared owner is a shared verb.

The renderer still does not draw the enclosure — `lab/01-pitches/01-parenthesized-accidental`
has said so in its own notes since it was written, and its golden pins the bare
sharp. Item 6 is the **entry** side; writing data the renderer has yet to catch
up with is the same split item 9 made for technique.

## Evidence

`harness/conformance/accidental-spelling.test.ts` — the policy and the cycle as
units (E♭ down, D♯ up, the key overruling both, the sound invariant through
every respell), and the corpus round trip for the display: strip every
`accidentalDisplay` from `spec/accidentals` and
`lab/01-pitches/01-parenthesized-accidental`, navigate back to each note, type
the words, demand byte-identity.

## What it cost

**One recorded trace changed, correctly** — the campaign's second sighting of
its parked "intended semantic changes break traces" case (the first was
`from-scratch` in item 11b). `chord-stack-fret` ends with a downward transpose
that used to spell A♯ and now spells B♭. That is the item working: the trace
pinned the placeholder policy, and the placeholder was the bug. Regenerated
through `npm run update:edit-traces`; the diff is that one note.

Goldens byte-identical, and the corpus reports do not move — spelling is not an
element kind. Item 6 buys **traceability**, not coverage.
