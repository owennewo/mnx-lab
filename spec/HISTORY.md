# W3C MNX Schema Version History

This file documents the version history, updates, and origins of the MNX JSON schemas stored in this directory.

## Current Version Information

- **Schema Version:** `version/27` (per the schema's `$id`), 193 `$defs`
- **Schema Source:** [W3C Music Notation Community Group - MNX GitHub Repository](https://github.com/w3c-cg/mnx)
- **Upstream Revision:** [`46fbe93`](https://github.com/w3c-cg/mnx/commit/46fbe93)
  ("Updated notationref.json to include dynamics and hairpins as implemented",
  2026-07-29) — the commit the `vendor/mnx` submodule is pinned to, and
  `mnx-schema.json` here is a verbatim copy of its `docs/mnx-schema.json`.
- **Format Standard:** JSON Schema Draft 2020-12

**The schema is generated, not authored.** Upstream keeps the spec in a Django
database; `docs/mnx-schema.json` is emitted by `manage.py makesite` from those
records, and its `$id` version comes from the `spectools.xmlschema.version`
field. So a schema change upstream is a change to `doctools/data.json`, never a
hand-edit of the JSON. See [docs/mnx-spec-submodule.md](../docs/mnx-spec-submodule.md).

**Descriptions are normative and the schema drops them.** `spec-prose.json` in
this directory fingerprints every documented object, relationship and enum
(663 items) so `npm run sync:spec` can report prose drift when the pin moves —
the only tripwire that catches a field being *redefined* without its shape
changing. The v24 → v27 entry below is a live example: three descriptions were
rewritten with no version bump at all.

## v24 → v27 (2026-07-29)

Three versions, and **two of them are ours**:

| | commit | change |
|---|---|---|
| v25 | `1db0757` | `dynamic-value` +`pppppp` +`ffffff` — the conventional ladder is now complete, so only `fp`/`fz`/`z`-style marks still need `glyphs` |
| — | `94d0773` | our `dynamic-group` clarifications (`value` for accents; `prefix`/`suffix` vs `accentPrefix`/`accentSuffix`) — **prose only, no version bump** |
| **v26** | `65d6ee3` | **our fix**: `dynamic-prefix`/`dynamic-suffix` enum values no longer carry literal quote characters |
| — | `a2a3016` | our `dynamic-accents` worked example (slug `dynamic-accents`, files `dynamics-accents.*`) |
| v27 | `bd9e611` | measure repeats: +`measure-repeat`, `measure-repeat-count`, `measure-repeat-counter` |

Contributed via [w3c-cg/mnx#529](https://github.com/w3c-cg/mnx/pull/529), split
into three commits upstream. The enum descriptions landed verbatim; the
clarifications were lightly copy-edited; the example was renamed and rewritten to
lean on the `accentPrefix`/`accentSuffix` defaults rather than stating them, and
its reference engraving is this project's renderer output.

`94d0773` is the case the prose manifest exists for: three field descriptions
were rewritten and the schema version did not move, so nothing in
`mnx-schema.json` records that anything changed.

Corpus impact: three new spec examples (`dynamic-accents`, `measure-repeats`,
`measure-repeats-with-counters`) and the retirement of
`lab/dynamics/accent-prefix-suffix` as an invalid-by-design exhibit — it
validates cleanly from v26 on.

**Still open upstream:** `residualValue`'s description gives
`{"value": "f", "residualValue": "p"}` as its worked example of an `fp`, but with
the documented defaults that composes to `sfzp` — and since v26 the spec's own
`dynamic-accents` example uses exactly that encoding for its `sfzp`. Unreported;
a semantics question rather than a typo.

## v19 → v24 (2026-07-27)

Five upstream commits, all dynamics; nothing else in the spec moved. Two added
`$defs` (`dynamic-prefix`, `dynamic-suffix`), two changed (`dynamic-value`,
`dynamic-group`), none removed.

| | change |
|---|---|
| v20 | `dynamic-value` enum +`pppp` +`ppppp` +`ffff` +`fffff` |
| v21 | `dynamic-group` +`visuallyContinues` (id ref: render with the previous group as one unit) |
| v22 | `dynamic-group` +`residualValue` −`attackValue` |
| v23 | +`dynamic-prefix`/`dynamic-suffix`; `dynamic-group` +`accentPrefix` +`accentSuffix` |
| v24 | `dynamic-group` +`staffEnd` (cross-staff diagonal hairpins) |

Corpus impact was nil: all 49 spec examples are byte-identical across the range,
and all 57 scenarios still validate (the one v24 rejection is
`lab/24-tab-spec-gaps/01-tab-clef-rejected`, which is invalid by design).

Two findings that a schema diff alone does **not** show:

- **`attackValue` → `residualValue` is a semantic inversion, not a rename.** The
  spec states both encodings of the same marking: an "fp" was
  `{"attackValue": "f", "value": "p"}` at v19 and is `{"value": "f",
  "residualValue": "p"}` at v24. `value` changes meaning, so a v19 document
  still *validates* under v24 while denoting the opposite dynamic.
- **`type: 'accent'` predates v23's accent fields.** The `dynamic-group-type`
  enum is unchanged across the whole range, and the value's own description
  ("temporary accents on a single beat, such as sfz (sforzando)") is byte-identical
  at v19 and v24. What v24 changed is the *parent field's* description, which had
  listed only three of the four options and now names `accent` too. So v23's
  accent prefix/suffix filled in a model that was already present — and the gap
  was one level of prose disagreeing with another, which no schema diff can see.

**Known bug in v24 (fixed upstream in v26 — see above):** the `dynamic-prefix` and
`dynamic-suffix` enums carried literal quote characters — `"\"s\""`, `"\"r\""`,
`"\"z\""` and two `"\"\""`. They are the only 5 of the spec's 155 enum rows
stored that way, and they contradict the prose ("for a `sfz` dynamic, the prefix
is `s`"). Consequence: `accentPrefix: "s"` is **rejected** and `accentPrefix:
"\"s\""` is accepted. `MnxDynamic` in [src/types/mnx.ts](../src/types/mnx.ts)
types these as the spec intends, not as it validates.

## Key Architecture & Features

The downloaded schema enforces the core concepts of the MNX format:
1. **Root Layout**: Requires a top-level `"mnx"` version key and separate `"global"` and `"parts"` hierarchies.
2. **Global Timeline**: Tracks key signatures (`"fifths"` value), time signatures (`"count"` and `"unit"` values), and system-wide markers.
3. **Decoupled Parts**: Parts are stored as a flat array of musical streams.
4. **Semantic Event Model**: Events represent either chords/notes (with duration base, pitch structures, alterations) or rests.
5. **Extensibility**: Allows custom properties under the `_x` namespaces (useful for proprietary editor features like custom guitar tablature bends or notes context).

## Extension schema

`mnx-lab-extensions.schema.json` (**v3**) holds everything this project carries that MNX cannot
express, under the single vendor key `_x.mnxLab`. It is a `$defs` library, not a document schema:
`scripts/compile-validator.mjs` compiles three sub-validators from it (`note-ext`, `part-ext`,
`global-measure-ext`) and consumers walk the document. Register + rationale:
[docs/mnx-extensions.md](../docs/mnx-extensions.md).

- **v3 (2026-07-26)** — replaced `mnx-tab-extension.schema.json` (v2). The `_x` sub-key names a
  *vendor*, not a feature ([w3c-cg/mnx#429](https://github.com/w3c-cg/mnx/issues/429)), so `_x.tab`
  and `_x.section` moved under `_x.mnxLab`. Added `rehearsal`, `section`, `harmonies`,
  `technique.harmonic`, `technique.palmMute`; bends became `points` curves in semitones; slide
  enum values camelCased.
- **v2** (`mnx-tab-extension.schema.json`, removed in v3 — in git history) — `_x.tab`,
  single-source encoding, no TAB clefs.
- **v1** (`guitar-tab-extension.schema.json`, retained) — the legacy `_x.guitar` shape the load-time
  upgrade shim still accepts.

## Version History Log

### 2026-07-17 (Upgrade to version/19)
- Re-fetched from the `main` branch of `w3c-cg/mnx`; the schema `$id` advanced from `version/17` to `version/19`.
- The entire v17 → v19 delta is a **dynamics rework** (188 `$defs`, up from 183); nothing else changed.
  - **Removed:** `dynamic`, `dynamic-list`, `dynamic-type` (a thin `{ position, value: <free string>, glyph? }`).
  - **Added:** `dynamic-group`, `dynamic-group-list`, `dynamic-group-type`, `dynamic-value`, `relative-dynamic-value`, `wedge-type`, `multi-staff-orientation`, `smufl-glyph-list`.
  - **Modified:** `part-measure.dynamics` now points at `dynamic-group-list` instead of `dynamic-list`.
- Breaking for our data: dynamics now **require `type`** (`immediate`/`gradual`/`relative`/`accent`); `value` is now a **closed enum** (`ppp…fff`, `n`); the singular `glyph` became a plural `glyphs` (a `smufl-glyph-list`). Extended marks (`pppppp`, `sfz`, `fp`, `z`, …) that used to live in `value` now go through `glyphs`.
- New capability we do **not** yet render: hairpin wedges (`wedgeType` + `end`), relative dynamics (`relativeValue`), `prefix`/`suffix` text, and `orient`. Tracked as a renderer gap.
- Migrated the two dynamics scenarios (`spec/dynamics`, `lab/30-dynamics/01-all-dynamic-marks`) to the `dynamic-group` shape and regenerated `worker/generated/validate-mnx.mjs`.

### 2026-05-23 (Initial Download)
- Fetched the latest JSON Schema from the `main` branch of the `w3c-cg/mnx` repository.
- Checked and verified structure compatibility (utilizing Draft 2020-12 `$defs` and `unevaluatedProperties` constraints).
