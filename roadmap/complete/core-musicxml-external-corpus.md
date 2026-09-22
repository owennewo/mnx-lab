# MusicXML external corpus — pinned inputs and an honest baseline

> **Status: complete, 2026-09-22.** Item 13 of
> [the MusicXML campaign](../inprogress/core-campaign-musicxml.md).
> First implementation slice of the resumed campaign; items 14, 15, 18 and 19 follow it.

## Agreement before implementation

1. **Oracle:** exact upstream git blobs, pinned revision and SHA-256 inventory for fixture
   provenance. Source descriptions specify intended features. The import/export sweep
   measures observed behavior only; it is not an independent semantic accuracy oracle.
   Item 14 supplies that missing judgment. No generated output is called correct merely
   because it imports, validates or exports.
2. **MNX verdict:** no new vocabulary or converter behavior in this item. Report imported
   schema validity and observed def presence/loss separately from source feature support.
   Representation gaps are findings for later agreed items.
3. **Dependency budget:** zero new runtime or npm dependencies. Python standard library
   vendors fixtures and extracts inventory; existing Vitest and validators run the sweep.
4. **Matrix row:** retain the established MNX-authored converter matrix unchanged. Add an
   external-source report keyed by fixture IDs, including observed defs lost on re-import.
   Feeding our own imports into that matrix as source truth would erase import losses and
   imply support the source never proved. Item 14 must establish independent expectations
   before external cases can justify semantic support claims.
5. **Losslessness bar:** every file under the pinned upstream xmlFiles tree is vendored
   byte-for-byte and inventoried, including negative/compatibility cases and compressed
   input. Every fixture has import, schema-validation, export and re-import dispositions.
   Hashes of observed outputs and diagnostic baselines make behavior changes reviewable;
   passing this baseline test is not a feature pass. Existing W3C oracle/matrix stay clean.

## Scope and acceptance

Vendor the complete suite (small enough to avoid a curation blind spot), upstream LICENSE
and README, plus a deterministic manifest: stable fixture ID, path, SHA-256, source format,
version, declared description, XML element inventory, category and intended test class.
A missing source description stays explicit. Keep upstream files untouched, including
copyright notices. Pin the upstream commit in the sync tool; no network is needed for tests.
The sync command consumes git objects at that pin, not an arbitrary working directory.

A generated report records all failures/warnings, validation errors, deterministic output
hashes and imported definitions lost on export/re-import. These are observations, not
rendering or write-path assessments; items 18 and 19 reuse the IDs and descriptions.
Negative source fixtures are included but tallied separately from feature fixtures.

Deliver reproducible sync/update/check commands, meaningful provenance/baseline tests,
and a short finding summary. Do not fix converter defects or manufacture goldens in this
slice. Subsequent work chooses a finite feature batch after the independent oracle exists.

## Delivered

All 183 upstream inputs and both notice files are pinned byte-for-byte. The initial
report records 177 feature / 3 negative / 3 compatibility cases, all completing the
pipeline; 13 feature imports fail published or extension validation. The existing
27-pair oracle and converter matrix are unchanged. See
[the report guide](../../docs/musicxml-suite.md) for findings and reproducible commands.
Items 14/15 and the two assessments remain open; no converter behavior changed here.

Validation: 2,606 root tests passed (one skipped), 157 converter tests passed, build
passed, and the vendored tree matched the pinned upstream git blobs. Implementation
landed in `220d2da0`; its worktree was removed before this document moved to complete.
