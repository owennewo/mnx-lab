# W3C MNX Schema Version History

This file documents the version history, updates, and origins of the MNX JSON schemas stored in this directory.

## Current Version Information

- **Schema Version:** `version/19` (per the schema's `$id`)
- **Schema Source:** [W3C Music Notation Community Group - MNX GitHub Repository](https://github.com/w3c-cg/mnx)
- **Direct Link:** `https://raw.githubusercontent.com/w3c-cg/mnx/main/docs/mnx-schema.json`
- **Retrieved On:** 2026-07-17
- **Format Standard:** JSON Schema Draft 2020-12

## Key Architecture & Features

The downloaded schema enforces the core concepts of the MNX format:
1. **Root Layout**: Requires a top-level `"mnx"` version key and separate `"global"` and `"parts"` hierarchies.
2. **Global Timeline**: Tracks key signatures (`"fifths"` value), time signatures (`"count"` and `"unit"` values), and system-wide markers.
3. **Decoupled Parts**: Parts are stored as a flat array of musical streams.
4. **Semantic Event Model**: Events represent either chords/notes (with duration base, pitch structures, alterations) or rests.
5. **Extensibility**: Allows custom properties under the `_x` namespaces (useful for proprietary editor features like custom guitar tablature bends or notes context).

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
