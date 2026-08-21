# Rigid columns are ink — price them on the ink scale

> **Status: BUILT 2026-08-21** (`0ebedf9`, *"Price rigid columns on the ink
> scale"*). `planHorizontal` takes `inkRatio`; every rigid ink contribution
> re-prices by it and each row re-justifies over the scaled rigids with its
> **square** membership — `packSystems` never sees the ratio. The three
> renderers derive the ratio after the square fit and re-place at it (the fit
> is not redone); the key-signature run reads `plan.inkRatio` so the one
> prefix glyph *run* fills the column priced for it. Goldens byte-identical
> (`update:primitives`, clean diff); 844 tests, corpus police and build green.
>
> Five conformance assertions in `zoom-density.test.ts`, each mutation-checked
> against the plumbing it claims: the ratio-1 path is untouched; row
> membership is invariant across 0.6–2.3 on both staff kinds (breaking the
> freeze fails exactly this one); the TAB clef clears the time signature at
> 1.4 / 1.6 / 2.3 **and the square-anchored counterfactual collides by 2.3**;
> the notation prefix clears through a four-sharp run (dropping the run's
> ratio fails exactly this one); a full row still ends at the margin after
> re-pricing — the springs paid, not the page.
>
> **Named residue, not a regression:** within-column *note-cluster* offsets —
> accidental→notehead, grace/tremolo/tuplet run advances, dots, ledger
> overhang, chord seconds — still draw square around their anchor
> (`notation.ts` emission helpers). The plan reserves the right scaled column
> for each; the cluster sits compactly at its left. They are the same family
> as stem and flag offsets, and threading the ratio through the emission
> layer is one pass over every glyph-relative x in `notation.ts`, worth doing
> as its own item if a dense chord at high zoom ever reads as tight. The
> prefix, which is what the reader's eye lands on at every system start, is
> fully priced.
>
> Originally: **PROPOSED 2026-08-20.** This doc is the decision that commit
> `fd6b06e` (*"Staff scale stops dragging the horizontal axis behind it"*,
> 2026-08-15) explicitly left open. Its closing line: *"Known cost, left for a
> decision: the spacing plan still reserves width for glyphs at square scale,
> so above ~1.2 the ink outgrows its columns — most visibly the clef and time
> signature at a system start."* Five days later a tab-view screenshot showed
> exactly that — the TAB clef run into the time signature under the pad's
> vertical arm — and this is the decision.
>
> Sibling: [core-ragged-last.md](../proposed/core-ragged-last.md), found in the same
> session. Different mechanism (the justifier's stretch cap, not the scale),
> different golden story (that one moves goldens; this one must not), so it is
> its own item.

## The symptom, and why it generalizes

Raise the zoom pad's vertical arm on a tab score and the gap between the TAB
clef and the time signature closes, then goes negative. The mechanism is the
deliberate split `fd6b06e` built: staff scale travels as `pxPerSpY` and every
ink **dimension** follows it (glyph font-size is `4 × ky` —
[svg.ts:161](../../src/engine/render/svg.ts)), while every **position** stays
on the horizontal scale, because the plan's columns are priced in sp × `kx`.
The clef is left-anchored and its ink widens rightward with `ky`; the time-sig
digits are centre-anchored and widen both ways; the anchors do not move. The
white space between them is the difference of two terms growing on different
scales, and it shrinks linearly in `ky/kx`.

The prefix is only where it is *loudest*. Every rigid column in the plan is
mispriced the same way: notehead cores, accidental stacks, dots, grace and
tremolo advances, mid-measure clef columns, fret digits, lyric syllables,
dynamic widths — all of them are glyph or text ink whose drawn width follows
`ky`, sitting in columns priced in `kx`. Push the arm far enough on a dense
bar and adjacent fret digits will touch each other just as surely as the clef
touches the time signature. The notation prefix is actually *tighter* than the
tab one: `gClef` is 2.68sp of ink in a 3sp slot against the tab clef's 1.64sp
in 2sp, so it has less slack, not more.

Two aggravators make this a today-problem rather than an extremes-problem:

- **Staff scale is absolute; the horizontal fit is not.** `staffScale` is
  measured against the 10px/sp baseline
  ([scale.ts:48](../../src/engine/render/scale.ts)) while `pxPerSp` fits the
  viewport. A wide score fits at 6–7px/sp, so the *first click* of the
  vertical arm — pinning `staffScale` at 1.0, the reader believing they have
  touched nothing — jumps the ink ratio to ~1.4, already past the ~1.2 wall
  `fd6b06e` named. Untouched (`staffScale` null) stays square, which is why
  the corpus never sees this.
- **The collision guarantee everyone relies on has a hidden premise.** Ruling
  1 of [core-zoom-density-pad.md](../complete/core-zoom-density-pad.md) argued
  the architecture eliminates collisions twice over — density scales springs
  only, and the justifier hands reclaimed width back. Both guards price widths
  in horizontal sp. They are sound **at square scale and only there**; the
  ruling predates `pxPerSpY` by hours and was never re-examined after it. (An
  appendix now points here.)

## The trilemma

Any fix has to choose consciously among three properties, of which the system
can have two:

1. **Ink scales in both axes** — a notehead grown vertically only is a
   squashed notehead. `svg.ts` commits to this, correctly.
2. **Horizontal placement is frozen under zoom** — the pad's vertical arm must
   not re-pack systems and slide notes. Ruling 2 of the pad doc, and the whole
   point of `fd6b06e`.
3. **No collisions.**

`fd6b06e` picked 1+2 and paid with 3, knowingly. Reversing 1 squashes glyphs;
reversing 2 wholesale is proportional-zoom-with-reflow, which was rejected on
real evidence and is a product decision, not a bug fix. The way out is to
notice that property 2 as *ruled* is coarser than property 2 as *needed*: what
the ruling actually protects is that bars never jump between systems under a
control drawn as a vertical arm. It does not require that nothing inside a row
may move by a few tenths of a staff space when the ink genuinely got wider.

## The principle: the plan already has the split

`spacing.ts`'s architecture is rigid-vs-spring, and its own gloss on the rigid
side is *"a clef occupies the width it occupies at a given staff size"*. Read
that clause under a non-square scale and it dictates the fix: **rigid columns
are ink, and ink lives on the vertical scale; springs are air, and air lives
on the horizontal scale.** The density axis already honors exactly this line
from the other side — `densityH` scales springs and never rigids. Staff scale
should honor it from this side: it scales rigids (because they *are* the ink
it grows) and never springs.

So `planHorizontal` gains one option, `inkRatio` (default 1) — the ratio
`pxPerSpY / pxPerSp` the emitter will draw at — and every **rigid ink**
contribution is multiplied by it: `CORE_SP` cores, accidental slots and their
pad, dots, grace/tremolo advances, mid-clef columns, dynamic and lyric column
widths, and the prefix glyph slots (clef, key glyphs, time signature, repeat
clusters). The justifier then absorbs the change with no new mechanism:
`stretch = (lineWidth − rigid·s) / spring` tightens the air as the ink grows,
which is precisely what an engraver does when asked to fit bigger type in the
same measure. Glyphs cannot touch until the springs are exhausted.

**What stays on the horizontal scale, deliberately:**

- **Springs and the frame pads/margins** — air, the other currency.
- **`MULTIREST_WIDTH_SP` and the H-bar** — `fd6b06e`'s own golden note: the
  multirest bar is a *distance between two musical positions*, not ink; it
  already carries `spanW` in the primitives file for exactly this reason.
  `spanW` on a rect is the litmus test: anything that needed it is a span, and
  spans don't scale with ink.
- **`EMPTY_CONTENT_SP`** — the width of nothing is air.

## Packing stays square

Line breaks are computed at `inkRatio = 1` and only the **placement** pass
re-runs with the scaled rigids. This is what preserves ruling 2's substance:
which bars sit on which system is invariant under the vertical arm, at every
value. `packSystems` is already factored out of `planHorizontal` (the density
ladder needed the same separation), so "pack at one ratio, place at another"
is an argument, not a refactor.

Degradation at the extreme is then inherited, not designed: a row whose scaled
rigids alone exceed the line hits `MIN_SQUEEZE`
([spacing.ts:90](../../src/engine/layout/spacing.ts)) and draws past the right
margin, ragged — the same shape overfull rows already degrade to. Overflow is
the honest failure; glyph-on-glyph is not, because a reader can scroll past
overflow but cannot read through a collision.

The renderer sequence: plan square → fit (`fitPxPerSp` reads `usedWidthSp`)
→ `kx` known → `inkRatio = ky/kx` → re-place. No iteration: the fit is
defined by the square plan, and re-placing does not re-fit. A square paint
(`staffScale` null — every embed, every golden, the harness) computes
`inkRatio = 1` and must take the untouched code path, not merely compute the
same numbers — the `tightenRows` precedent
([verticalDensity.ts:109-111](../../src/engine/layout/verticalDensity.ts)):
*"the default path does not merely compute the same numbers, it does not
run."*

## The `both` view comes along for free

`layoutNotation({includeTabStaves: true})` draws both staves from one plan and
one `ky`, so a single `inkRatio` serves the whole system and column alignment
between notation and tab is preserved by construction — the shared slot moves
once and both staves read it. No per-staff ratio exists to disagree.

## Gates

- **Goldens byte-identical.** `npm run update:primitives`, clean
  `git diff -- scenarios/`. Load-bearing, not ceremonial: the assertion is
  that `inkRatio` defaults to the code that exists today.
- **Conformance** (extend `zoom-density.test.ts` or sibling):
  1. x-coordinates byte-identical at `inkRatio = 1` (the no-op path).
  2. At the ratio the viewer actually produces for a wide fitted score with
     `staffScale = 1.6` (~2.3), no two prefix glyph ink boxes overlap on a
     tab and a notation scenario — measured through `computeBoundsSp`'s glyph
     metrics, the same boxes `tightenRows` trusts vertically.
  3. Row membership (`packedRowMeasures`) identical across the staff-scale
     range — ruling 2's substance, now asserted rather than assumed.
- **Hands-on** over CDP like the pad's own review: the screenshot scenario at
  0.6 / 1.0 / 1.6, tab, notation and both, confirming the clef→time gap now
  *holds* while note spacing visibly tightens.

## Not this

- **Not proportional zoom** (re-fitting `widthSp` in ink units and re-packing).
  Ruling 2 stands; this doc softens its letter one notch to save its spirit.
- **Not packing-aware ink.** Letting the packer see scaled rigids would move
  bars between systems under zoom — exactly what was banned. If extreme-zoom
  overflow ever hurts in practice, that is a *new* decision with its own
  evidence, and this doc's frozen-packing rule is where it would be argued.
- **Not the last-row stretch** — [core-ragged-last.md](../proposed/core-ragged-last.md).
- **Not touching `svg.ts`'s dimension rule.** Ink follows `ky`; that half of
  `fd6b06e` is correct and is the premise here, not the patient.

✔ when: the wide-score tab scenario holds its prefix gap at `staffScale` 1.6,
row membership is invariant under the vertical arm, `git diff -- scenarios/`
is clean after `update:primitives`, and the three conformance assertions above
are mutation-checked (break the ratio plumbing, watch them fail).
