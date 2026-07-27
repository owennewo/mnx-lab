# Accent dynamics: the v24 structural encoding, and why this is invalid

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

## Why `expect.standard` is `invalid`

The published v24 schema stores the `dynamic-prefix` and `dynamic-suffix` enum
values **with literal quote characters** — `"\"s\""`, `"\"r\""`, `"\"z\""` and two
`"\"\""`. They are the only 5 of the spec's 155 enum values stored that way. So
the schema rejects `accentPrefix: "s"` (what the docs prescribe) and accepts
`accentPrefix: "\"s\""`. The pinned errors here are that rejection.

The docs also render enum values in quotes, so the published page for
`dynamic-prefix` currently shows doubled quotes. One data fix corrects both.

Fix proposed upstream from `vendor/mnx` branch
`fix-dynamic-prefix-suffix-enum-quoting`. **This exhibit retires when it lands** —
every mark here validates against the corrected schema.

## Two related documentation gaps found alongside

- **`value` is undocumented for `type: "accent"`.** Its description covers
  `immediate` and `gradual` only, yet `residualValue`'s own text shows
  `{"value": "f", "residualValue": "p"}` — so an accent plainly uses `value`.
- **The `fp` example contradicts the stated defaults.** `accentPrefix` defaults
  to `s` and `accentSuffix` to `z`, so `{"value": "f", "residualValue": "p"}`
  composes to `sfzp`, not `fp`. Getting `fp` needs both empty strings set
  explicitly — which the quoting bug makes impossible. The defaults are what
  make the empty value load-bearing, and that is why the quoting bug blocks
  `fz`, `sf` and `fp` rather than being cosmetic.
