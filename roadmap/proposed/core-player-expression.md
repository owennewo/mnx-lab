# Expression and technique — what the marks mean, as numbers

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 8. Needs item 4; its bends
> are only audible after item 6's per-string voices, which is the tab-fidelity
> dependency on the sound source the campaign called out.

## Agreement block (campaign contract)

- **Pure before audible (§1).** All of it is compiler stages in `audio/performance.ts`;
  the sink only ever sees velocity, duration and a cents curve.
- **Ticks (§2).** Curves are `{ tick, cents }` breakpoints; the sink interpolates.
- **Proof (§4).** The performance golden moves for every scenario carrying a mark or
  technique (~30, incl. `lab/*technique*`, `spec/dynamics*`, `spec/articulations*`);
  the batch is registered in [lab-verify.md](../inprogress/lab-verify.md) with "look
  for: velocity column follows the dynamic, bend column shape matches the drawn curve".
  The MIDI oracle (item 9) sees velocity and pitch bend and nothing else here, so the
  rest is golden-plus-ear.
- **Spec findings (§6).** How much a staccato shortens, how loud an accent is, how
  long a grace is: conventions, each recorded with its number.
- **Reviewer gain (§7).** A bend scenario **sounds bent**, with the curve the reviewer
  approved in the SVG. That closes the loop between the two kinds of golden.

## The mapping

| Source | Becomes |
|---|---|
| `dynamics` (`pp`…`ff`, `sfz`) | velocity from a fixed table, in force until the next; `sfz` a one-event spike |
| `markings.staccato` / `tenuto` / `accent` | duration × 0.5 / × 1.0 with no gap / velocity + 20 |
| `arpeggio` | onsets staggered by a fixed tick per note, direction from the mark |
| `tremolo` | already subdivided in item 4; velocity alternates slightly |
| `tab.technique.bend.points` | cents curve: `alter` × 100 at `position` × duration, pre-bend as a non-zero first point, release as a falling point |
| `slide` (`shift`/`legato`, `slideIn`/`slideOut`) | a curve over the last quarter of the note toward the target's pitch; in/out from a fixed offset |
| `hammerPull.target` | target velocity − 25, and a *no-reattack* flag the string voice honours |
| `palmMute` | duration × 0.6, velocity − 15 |
| `vibrato` | a 5 Hz ±30-cent curve from a quarter of the way in |
| `harmonic` (`natural`, `artificial`, `pinch`, …) | sounding pitch from `touchingPitch` (node arithmetic on the string's open pitch) else written pitch; velocity − 10 |
| `ties[].lv` | ring to a fixed maximum, already in item 4 |

Every number in that table is a §6 convention; the golden makes changing one a
one-line diff plus a re-approval, which is the cheapest a musical argument gets.

## Done bar

The goldens regenerated and registered; the MIDI file carries pitch bend on the
string's channel and velocity per note; a hammer-on in `lab/*technique*` renders
without a second attack in the string voice.
