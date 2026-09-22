# MusicXML 4.0 export validation

> **Status: built, 2026-09-22.** Item 15 of
> [the MusicXML campaign](core-campaign-musicxml.md).

## Agreement before implementation

1. **Oracle:** The verbatim W3C MusicXML 4.0 release schemas, validated by pinned lxml/libxml2 with a local-only schema resolver. Schema-valid all-rests output is not evidence of musical accuracy.
2. **MNX verdict:** measurement only; no new vocabulary. Source features outside the
   adapter's semantic scope are explicitly unassessed, not inferred from matching rows.
3. **Dependency budget:** no runtime/npm dependencies. A locked uv project uses Python
   3.12, music21 and lxml for capture/validation only. Install is explicit through the
   documented setup command; normal app builds stay independent of Python.
4. **Matrix:** these instruments complement the existing matrix. No support cells change
   without a converter behavior change and regenerated evidence.
5. **Completion bar:** Validate every export generated from the external suite plus all committed scenario and reference MNX documents. Record failures as an explicit baseline, prohibit silent skips, and prove the gate rejects malformed output with mutation tests. Existing invalid output is a finding, not an excuse to omit validation.

## Comparison policy

Use written measure ordinal and local onset, preserving pickup measures without imposing
repeat playback. Use exact rational values; canonicalize voice labels by complete voice
content while retaining the partition and note multiplicity. Pitches are sounding
semitones including microtones; written spelling is outside this note-table claim. Grace
notes have zero metric duration plus their written duration and order. Compare tie start/
stop state and lyric line/text/syllabic state. Untested articulations, dynamics, layout,
playback and technique are not certified by this table. Preserve fixture provenance and
record tool versions. No screenshots or human verification claims are produced here.

Do not broaden this item into unbounded converter parity. Classify observed failures and
select any fixes as finite campaign items with their own agreement before changing code.

## Delivered

See [the instrument guide](../../docs/musicxml-oracles.md) for the locked environment,
comparison policy, commands, capture provenance and limitations. 344 cases are scored.
The live recapture matches committed evidence; existing mismatches remain explicit.
