# MusicXML element ordering — defects found by the XSD oracle

> **Status: built, 2026-09-22.** Item 20 of
> [the MusicXML campaign](core-campaign-musicxml.md).

## Agreement before implementation

1. **Oracle:** pinned W3C MusicXML 4.0 XSD through item 15, plus structural tests on
   emitted XML that fail on the old code and semantic re-import assertions.
2. **MNX verdict:** existing pitch/tuning objects and existing rehearsal/section data;
   no new fields or vocabulary. This fixes the MusicXML grammar, not representation.
3. **Dependency budget:** none; reuse the independent dev-only checks.
4. **Matrix:** regenerate and require no changes. XML order must not change supported
   semantics or layout goldens. Update derived reference XML and observation/capture
   hashes with reviewed improvements.
5. **Losslessness bar:** pitch is step/alter/octave, tuning is step/alter/octave, and
   rehearsal plus section words occupy separate typed directions. XSD failures
   of these three classes disappear, independent note-table judgments remain unchanged,
   and all existing converter/reference round trips pass.

Finite scope: these three grammar errors only. Zero-duration exports, empty parts and
rootless harmony are separate findings requiring their own semantic decisions.

## Result

Three tests failed on the old exporter and pass after the fix. Independent XSD validity
improves 292 → 336 of 344 exports; semantic verdicts and the converter matrix are
unchanged. All four derived reference XML files were regenerated. The emitter uses
separate directions because the current reader recognizes section labels in the first
direction-type; this preserves both labels without widening the importer in this fix.
