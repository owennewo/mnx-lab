# Notes

The required-field floor of MNX v17, verified against the schema: `root` requires
`mnx`/`global`/`parts`; `part` requires only `measures` (no `id`, no `name`!);
`part-measure` requires `sequences`; `sequence` requires `content`; `event` requires
`duration`; `note` requires `pitch`. Everything else — key, time, clef, ids, part
identity — is optional, with semantics left to the consumer's defaults.

Findings this scenario already pins:

- **`part.name` is optional in the spec but required by this project's internal types**
  ([src/types/mnx.ts](../../../../src/types/mnx.ts)), and the notation layout calls
  `part.name.toLowerCase()` unguarded — this document is expected to surface that when
  rendering snapshots arrive (step 3).
- With no `time`, there is no schema-level constraint that the whole note "fits" the
  measure; duration-vs-measure arithmetic is entirely a consumer concern.
