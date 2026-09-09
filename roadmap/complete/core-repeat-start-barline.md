# A forward repeat is a barline, not something that follows one

> **Status: COMPLETE 2026-09-09** — built and landed the day it was reported, worktree
> retired. **No golden moved**; one new scenario, registered in
> [lab-verify.md](../inprogress/lab-verify.md#a-forward-repeat-is-a-barline--2026-09-09).
>
> Reported from a `both` view at the largest clearance: *"the bar 3 repeat start glyph
> has peeled away from the start of the bar"*. Third in a run of placement reports —
> after [core-heading-anchor.md](core-heading-anchor.md), and with the same shape.

## The complaint

At wide clearance a mid-piece `|:` floats free of the barline it belongs to, with a
plain barline still drawn back where the bar actually starts. The repeat reads as
belonging to neither bar.

## Why: the repeat was priced as content, not as a barline

`repeatStartX` was placed after the prefix's **content pad**:

```ts
const prefixLeftPad = (m, firstInSystem) =>
  firstInSystem && m.hasRepeatStart && display.clefs === 'hide' && …
    ? 0
    : contentLeftPad + (firstInSystem ? startBarlinePad : 0);
```

`contentLeftPad` is discretionary air before a bar's *content*, and it triples across
the clearance ladder — 0.15sp at level 0, 0.6 at the default, **1.8 at level 4**. A clef
and a time signature hide that: they sit between the barline and the `|:`, so the pad is
holding the clef off the barline and the repeat lands after the whole prefix, correctly.
Take the prefix away and the pad has nothing to do but push the repeat off its own
barline — and the ordinary barline is drawn there anyway, because nothing suppressed it.

The existing code already knew the right answer for one case: a system opening with a
repeat and no visible prefix put the `|:` at the staff's left edge and dropped the
separate system-start line. That special case was the general rule wearing a
`firstInSystem` disguise.

## The rule now

**A forward repeat is a barline.** `|:` opens with a thick stroke standing exactly where
the ordinary barline goes, so when its bar draws no prefix glyph the repeat **is** that
barline: it sits at the bar's left edge, and `repeatStartSuppliesBarline` stops the plain
barline being drawn under it. When the bar does draw a prefix, the repeat follows the
prefix glyphs, unchanged.

One exception, and it is why this is not a one-line deletion: a boundary that already
carries ink of its own. `:||:` is two real clusters, and so is a declared double or final
bar before a repeat. Those keep the pad, so the two clusters keep their room.

## What building it taught

- **The corpus had no coverage at all.** All five scenarios with a forward repeat put it
  on bar 1 of a system, with a clef and a time signature — the arm that was already
  right. That is exactly why the bug survived, and it is why the fix moved **no golden**:
  nothing in the corpus rendered the broken path. `lab/navigation/repeat-starts-mid-system`
  is the cover, and it carries both arms so a future simplification cannot collapse them.
- **The special case was the rule.** Generalising `firstInSystem && no prefix` to
  `no prefix` is the whole placement fix. A special case that reads as a workaround
  usually is one.
- **Suppression and placement are one change, not two.** Moving the `|:` onto the barline
  without dropping the plain barline would have doubled the ink invisibly (a 0.16sp
  stroke under a 0.5sp band); dropping the barline without moving the `|:` would have
  left a gap where a barline should be. The test asserts both halves separately so
  neither can be reverted alone.
- **Third of three, same shape.** Heading marks led the content anchor; the repeat was
  padded like content. Both were ink being placed by a measurement meant for air. Worth
  suspecting anywhere else a clearance-scaled pad sits in front of something that is not
  discretionary.

## Not done

- **`:||:` still separates by the clearance-scaled content pad**, so the gap between the
  two clusters breathes with the ladder (0.15 → 1.8sp). It is air between two marks
  rather than air before content, so it arguably wants a fixed ink gap of its own. No one
  has complained, and the corpus now covers it, so it can be judged on the engraving.
