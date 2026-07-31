# Accent dynamics: the structural encoding, written out in full

MNX v23 added `accentPrefix` / `accentSuffix` to `dynamic-group`, so the
sforzando family stops being an opaque SMuFL glyph name and becomes structure.
The parts concatenate to the conventional abbreviation, which is a neat design —
composition and glyph lookup end up being the same operation:

| encoding | spells | glyph |
|---|---|---|
| `s` + `f` + `z` | sfz | `dynamicSforzato` |
| `r` + `f` + `z` | rfz | `dynamicRinforzando2` |
| `""` + `f` + `z` | fz | `dynamicForzando` |
| `s` + `f` + `""` | sf | `dynamicSforzando1` |
| `""` + `f` + `""` + `p` | fp | `dynamicFortePiano` |
| `s` + `f` + `z` + `p` | sfzp | `dynamicSforzatoPiano` |

`src/layout/dynamics.ts` implements exactly that: `accentMnemonic()` composes the
string and looks it up in the table that already existed for `glyphs`-routed
marks. All 10 accent marks in the table compose correctly.

## Upstream history

This scenario was originally invalid by design. The published v24 schema stored
the `dynamic-prefix` and `dynamic-suffix` enum values **with literal quote
characters** — `"\"s\""`, `"\"r\""`, `"\"z\""` and two `"\"\""` — the only 5 of the
spec's 155 enum values stored that way. So it rejected `accentPrefix: "s"` (what
the docs prescribe) and accepted `accentPrefix: "\"s\""`. The docs also render
enum values in quotes, so the published `dynamic-prefix` page showed doubled
quotes.

Reported and fixed via [w3c-cg/mnx#529](https://github.com/w3c-cg/mnx/pull/529),
merged as `65d6ee3` — which cut schema **v26**. The document has validated
cleanly since.

The same PR contributed the descriptions for those five values, three
`dynamic-group` clarifications, and the spec's own `dynamic-accents` example —
whose reference engraving is this renderer's output.

## Still open upstream: what `{"value": "f", "residualValue": "p"}` means

`accentPrefix` defaults to `s` and `accentSuffix` to `z`, so that object
composes to **sfzp**, not `fp`. Getting `fp` needs both empty strings set
explicitly, which is what this scenario and the spec's example both do.

But `residualValue`'s own description still gives that exact object as its
worked example of an **`fp`**. Since v26 the spec's `dynamic-accents` example
uses the identical encoding for its **sfzp**, so the same JSON is now documented
two ways in the same spec. Not yet reported — it is a semantics question rather
than a typo, and worth raising with the related one: `residualValue` has no
`end` and `accent` is documented as a single beat, so how long the residual
dynamic lasts is unstated. That is inaudible in engraving and audible in
playback.

(The other gap found alongside — `value` never mentioning `type: "accent"` —
was fixed by the same PR and is no longer open.)
