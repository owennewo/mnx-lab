# Expression and technique — what the marks mean, as numbers

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 8. Needs items 5 and 6;
> bends are audible only through item 6's per-string voices — the tab-fidelity
> dependency on the sound source the campaign called out.

## Agreement block (campaign contract)

- **Pure before audible (§1).** Compiler stages in `audio/performance.ts`; the sink
  sees velocity, duration, a cents curve and two voice flags.
- **Rational time (§2).** Curves are `{ position, cents }` breakpoints in rationals of
  the event; the sink interpolates in audio time.
- **Identities (§3).** A hammer-on's target is a sounding event with
  `noReattack: true` on the **event type** (added here — the first draft named the flag
  without a field for it); it keeps its written occurrence for the cursor.
- **Proof (§4).** The performance golden moves for every scenario carrying a mark or
  technique (~30); registered in [lab-verify.md](../inprogress/lab-verify.md) with
  "look for: velocity column follows the dynamic; bend curve matches the drawn one".
  Item 9 sees velocity and pitch bend only; the rest is golden-plus-ear.
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
| `vibrato` | ±30 cents at 5 Hz from a quarter of the way in |
| `harmonic` | sounding pitch from `touchingPitch` (node arithmetic on the string's open pitch) else the written pitch; velocity − 10 — **the one deliberate exception** to item 3's nothing-shifts rule |
| `lv` | item 3's ring rule |

## Done bar

Goldens regenerated and registered; the MIDI export carries pitch bend on the string's
channel within the ±12 range and reports clips; a hammer-on in `lab/*technique*` shows
one attack in the sounding list.
