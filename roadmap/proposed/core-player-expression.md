# Expression and technique — what the marks mean, as numbers

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 8. Needs items 5 and 6;
> bends are audible only through item 6's per-string voices — the tab-fidelity
> dependency on the sound source the campaign called out.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Compiler stages in `audio/performance.ts`; the sink
  sees velocity, duration, a cents curve, `noReattack`/`damped` flags and a harmonic
  timbre hint. These fields are explicit additions to the sounding event type.
- **Rational time (§2).** Curves are `{ position, cents }` breakpoints in rationals of
  the event; the sink interpolates in audio time.
- **Identities (§3).** A hammer-on's target is a sounding event with
  `noReattack: true` on the **event type** (added here — the first draft named the flag
  without a field for it); it keeps its written occurrence for the cursor.
  From this item onward, `sounding[]`
  contains attacks and logical transitions distinguished by the flag; the compiler
  no longer promises that every list entry is a physical envelope attack.
- **Proof (§4).** The performance golden moves for every scenario carrying a mark or
  technique (~30); registered in [lab-verify.md](../inprogress/lab-verify.md) with
  "look for: velocity column follows the dynamic; bend curve matches the drawn one".
  Item 9 reports velocity/curve differences only where its backend exposes them;
  unsupported technique coverage is explicit. The golden and listening remain required.
- **Spec findings (§6).** Every number below is a convention, recorded on landing.
- **Reviewer gain (§7).** A bend scenario sounds bent with the curve the reviewer
  approved in the SVG.

## The mapping

| Source | Becomes |
|---|---|
| `dynamics` | velocity from a fixed table, in force until the next; `sfz` a one-event spike |
| `staccato` / `tenuto` / `accent` | duration × 0.5 / full with no gap / velocity + 20 |
| `arpeggio` | onsets staggered by a 64th per note, direction from the mark |
| `tremolo` | subdivided in item 5; velocity alternates slightly |
| `bend.points` | cents = `alter` × 100 at `position` × duration; pre-bend a non-zero first point; release a falling one |
| `slide` | a curve over the last quarter of the note to the target's pitch; in/out from ±2 semitones |
| `hammerPull.target` | target velocity − 25 and `noReattack` |
| `palmMute` | duration × 0.6, velocity − 15, `damped` flag |
| `vibrato` | ±30 cents, one cycle per 1/10 whole note from a quarter of the way in; tempo-relative per item 3 |
| `harmonic` | preserve sounded `note.pitch`; velocity − 10 and harmonic timbre hint; `touchingPitch` is technique metadata, not a replacement pitch |
| `lv` | item 3's ring rule |

## Harmonic evidence before interpretation

Hand-state sounded MIDI for natural and artificial harmonics, already-resolved converter
notes, capo, missing string, and missing touching pitch. No case changes `note.pitch`.
Validate touching metadata only where enough information exists to infer consistency;
otherwise report unsupported validation. An artificial harmonic's effective stopped
string differs from the open string, so open-string node arithmetic is not a general
pitch rule. Any future exception needs an explicit extension contract and converter
evidence; this item does not introduce one.

## Done bar

Goldens regenerated and registered; the MIDI export carries pitch bend on the string's
channel within the ±12 range and reports clips; a hammer-on in `lab/*technique*` shows
a source attack followed by a target `noReattack` transition in the sounding
list: two written occurrences, one envelope attack. The target changes pitch while
retaining voice continuity; a standalone seek into the target reconstructs an audible
voice instead of applying `noReattack` to silence.
