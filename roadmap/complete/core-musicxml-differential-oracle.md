# Independent semantic comparison

> **Status: complete, 2026-09-22.** Item 14 of
> [the MusicXML campaign](../inprogress/core-campaign-musicxml.md).

## Agreement before implementation

1. **Oracle:** music21 10.5.0 reads the original MusicXML independently. Compare note/rest rows against a separate MNX adapter; do not export MNX back to XML to obtain the expected import result. Also compare music21 reading our exports against their input MNX.
2. **MNX verdict:** measurement only; no new vocabulary. Source features outside the
   adapter's semantic scope are explicitly unassessed, not inferred from matching rows.
3. **Dependency budget:** no runtime/npm dependencies. A locked uv project uses Python
   3.12, music21 and lxml for capture/validation only. Install is explicit through the
   documented setup command; normal app builds stay independent of Python.
4. **Matrix:** these instruments complement the existing matrix. No support cells change
   without a converter behavior change and regenerated evidence.
5. **Completion bar:** All external fixtures have explicit outcomes; supported adapter cases compare rational measure-local onset/duration, sounding pitch, staff/voice grouping, grace identity, tie state and lyrics. Preserve multiplicity. Pin independent source captures for offline root tests and check live regeneration separately. Known mismatches remain reviewable; oracle errors/unsupported mappings are not passes.

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
