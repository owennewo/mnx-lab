# W3C MNX Schema Version History

This file documents the version history, updates, and origins of the MNX JSON schemas stored in this directory.

## Current Version Information

- **Schema Source:** [W3C Music Notation Community Group - MNX GitHub Repository](https://github.com/w3c-cg/mnx)
- **Direct Link:** `https://raw.githubusercontent.com/w3c-cg/mnx/main/docs/mnx-schema.json`
- **Retrieved On:** 2026-05-23
- **Format Standard:** JSON Schema Draft 2020-12

## Key Architecture & Features

The downloaded schema enforces the core concepts of the MNX format:
1. **Root Layout**: Requires a top-level `"mnx"` version key and separate `"global"` and `"parts"` hierarchies.
2. **Global Timeline**: Tracks key signatures (`"fifths"` value), time signatures (`"count"` and `"unit"` values), and system-wide markers.
3. **Decoupled Parts**: Parts are stored as a flat array of musical streams.
4. **Semantic Event Model**: Events represent either chords/notes (with duration base, pitch structures, alterations) or rests.
5. **Extensibility**: Allows custom properties under the `_x` namespaces (useful for proprietary editor features like custom guitar tablature bends or notes context).

## Version History Log

### 2026-05-23 (Initial Download)
- Fetched the latest JSON Schema from the `main` branch of the `w3c-cg/mnx` repository.
- Checked and verified structure compatibility (utilizing Draft 2020-12 `$defs` and `unevaluatedProperties` constraints).
