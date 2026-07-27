# W3C MNX Schema Version History

This file documents the version history, updates, and origins of the MNX JSON schemas stored in this directory.

## Current Version Information

- **Schema Version:** `version/19` (per the schema's `$id`)
- **Schema Source:** [W3C Music Notation Community Group - MNX GitHub Repository](https://github.com/w3c-cg/mnx)
- **Upstream Revision:** [`e41322cb`](https://github.com/w3c-cg/mnx/commit/e41322cb9794d7e1dd5e25e9f4475a847d114f1b)
  ("Expanded encoding for dynamics", 2026-06-16) — the commit the `vendor/mnx`
  submodule is pinned to. `mnx-schema.json` here is **byte-identical** to that
  commit's `docs/mnx-schema.json`, verified 2026-07-27.
- **Format Standard:** JSON Schema Draft 2020-12

> **Upstream is ahead: `version/24` as of 2026-07-21.** Versions 20–24 are all
> dynamics work (expanded dynamics range, dynamic groups gaining
> `visuallyContinues` / `accentPrefix` / `accentSuffix` / `staffEnd`, and
> `type='accent'` moving to `residualValue`). Bumping means moving the submodule
> pin, re-vendoring `docs/mnx-schema.json`, `npm run compile-validator` and
> `npm run sync:spec` — deliberately, as one change.

**The schema is generated, not authored.** Upstream keeps the spec in a Django
database; `docs/mnx-schema.json` is emitted by `manage.py makesite` from those
records, and its `$id` version comes from the `spectools.xmlschema.version`
field. So a schema change upstream is a change to `doctools/data.json`, never a
hand-edit of the JSON. See [docs/mnx-spec-submodule.md](../docs/mnx-spec-submodule.md).

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
