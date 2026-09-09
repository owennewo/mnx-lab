# Independent MIDI oracle

MuseScore Studio **4.7.5, build 3654226**, the user's selected external performer, supplies recorded
MIDI for the **27 upstream W3C MusicXML/MNX pairs and four converter XML fixtures**.
No MNX Lab converter or MIDI writer produces these recordings. The paired MNX is
compiled directly, and its bounded MIDI export is also checked for pitch/attack
order and observable onset timing. The external recording stays byte-for-byte intact, including duplicate
notes and accompaniment.

The first baseline is **22/27 W3C observable strict matches**, alongside the
engraving import oracle's **24/27**. These measure different properties. All four
converter fixtures differ. A match asserts observable pitch multisets, attack order,
and checked timing; it does not assert unobservable bar identities or guitar timbre.
The report publishes the denominator, unmatched groups, note counts, every excluded
span and every unobservable bar candidate. Reduced coverage is never discarded from
those totals.

## Evidence and commands

- `harness/fixtures/midi-oracle/manifest.json`: version, official release URL,
  AppImage SHA-256, export arguments, input paths/hashes and raw MIDI hashes.
- `*.mid`: original external exports, independently regenerable.
- Five `*.import.json` receipts: semantic extracts from MuseScore's own `.mscx`
  imports, without random element ids. They expose imported pitches, zero-length
  playback events, jumps, markers, repeat counts and volta numbers.
- `attributions.json`: explicit ownership and evidence for each discrepancy.
- `harness/reports/midi-oracle.json`: strict results, coverage, interpretive deltas,
  export findings and attribution. Both improvements and regressions fail the test
  until the report and any obsolete attribution are reviewed and updated.

`npm test` replays the committed recordings and validates their input/byte hashes.
It needs no installed MuseScore and never silently skips the oracle. This makes
ordinary CI deterministic while retaining an independent musical authority.

```sh
npm run check:midi-oracle-live # fresh MuseScore exports must match every receipt and byte
npm run capture:midi-oracle    # explicitly refresh external evidence after input/tool review
npm run update:midi-oracle     # recompute our side and the report against those recordings
```

`MUSESCORE_BIN` selects an executable; otherwise the runner uses `musescore`.
Capture requires version 4.7.5. It uses fresh XDG config/data/cache directories,
`QT_QPA_PLATFORM=offscreen`, a timeout per subprocess, and stages all exports before
replacing any committed recording. A missing executable or different version fails
with a diagnostic. It never downloads or installs software.

On this workstation the official x86_64 AppImage was downloaded, checked against the
release asset digest, and extracted to `~/.local/opt/musescore-4.7.5`; the user-local
`~/.local/bin/musescore` wrapper runs it. No root access or runtime/npm dependency
was added. Other developers can supply the same official release through
`MUSESCORE_BIN`. The exact asset hash is in the manifest. CLI options are checked
against the installed executable's `--help`; MuseScore 4.7.5 no longer accepts the
older `-s` flag. See the [official command-line documentation](https://handbook.musescore.org/appendix)
and [pinned release](https://github.com/musescore/MuseScore/releases/tag/v4.7.5).

## What is strict, and what is observable

MIDI note-on/off events become complete simultaneous pitch multisets, retaining
multiplicity. Track/channel bookkeeping pairs releases; tempo events independently
supply elapsed seconds. Exact compiler whole-note positions are compared in quarter
notes against external `tick / PPQ` positions. The onset tolerance is **1/64 quarter**.
A deterministic longest-common-subsequence alignment never substitutes a pitch or
removes duplicate notes; unmatched groups remain strict failures.

The XML evidence reader only uses the generic XML parser. It does not invoke the
MusicXML importer or our pass model. It extracts written note fingerprints, voice
backups/forwards, divisions, transposition and technique presence directly from the
external source. A bar identity is asserted only for a complete fingerprint unique
throughout the written pitch stream, including windows inside other bars. Silent
and identical bars remain unobservable. Raw external candidate windows are retained;
our traversal is compared to identifiable windows, never used to manufacture them.

Grace, fermata, arpeggio and tremolo measures conservatively exclude onset timing
within the entire written measure. Missing/extra attacks also break timing continuity.
Later timing restarts only at independently matching unique pitch content, using up
to two neighboring attacks on each side. The anchor itself is counted separately,
not as a successful timing check. Without an anchor, timing remains unobservable.
Pitch/order failures inside these regions remain failures. Synthetic tests exercise
holds, repeated unanchorable content, missing grace pitches, duplicate chords,
inside-bar fingerprint collisions, and errors after re-anchoring.

Duration in quarters and seconds, onset seconds, and velocity are reported as signed
MNX-minus-MuseScore deltas for aligned notes. They are not strict articulation
verdicts. The initial capture has **no noncentral pitch-bend events**, so it proves
no guitar curve agreement. MIDI also cannot establish string identity, oscillator
phase continuity, harmonic timbre or palm-mute timbre. The converter fixtures'
input mismatches prevent attributing their guitar-technique differences; that loss
of coverage is explicit, not normalized away.

## Three-score experiment and findings

The experiment ran before building the full baseline, after items 5–8 had landed.
The original proposal's earlier timing was no longer possible; the experiment still
preceded any decision about tolerances, exclusions or baseline exceptions.

| Case | MuseScore | MNX Lab | Finding |
|---|---|---|---|
| Simple voltas | MIDI pitches 72,76,72,67,72,72 | 72,76,72,67 | Different treatment of three endings with uncounted backward repeats |
| D.S. al Fine | 72,76,72,77,72 | 72,76,72,77,72,76,72 | MuseScore import has no playback Jump/Marker objects |
| Tuplets | 480 PPQ; first onsets 0, 2/3, 1, 4/3, 5/3, 2, 3 quarters | Same pitches and onsets | Exact agreement after PPQ normalization |

The five W3C exceptions are pinned individually:

- **Grace:** MuseScore imports B4 with a playback event of length zero and omits
  it from MIDI. Our sounding grace remains a strict unmatched pitch.
- **D.S. and D.S. al Fine:** source sound-navigation attributes exist, but MuseScore
  imports no playback jump/marker objects. Its exports omit the returns.
- **Simple voltas:** both encodings omit explicit repeat counts. MuseScore and the
  campaign's default-two-visits rule disagree; external behavior alone does not
  establish a replacement convention.
- **Advanced voltas:** the final E5 is present in MuseScore's imported score but
  absent from its MIDI after the repeat/third-ending combination. The failure is
  localized to external playback/export; its internal cause remains unresolved.

All four converter MusicXML exports contain distinct notation and TAB parts that
MuseScore plays simultaneously. House of the Rising Sun and Vestapol also produce
harmony accompaniment. We keep the duplicate and added attacks in the strict
comparison; deduplicating them would conceal an input-conversion problem. The W3C
inputs are independently authored; the converter XML inputs are explicitly derived.

No item-3 timing convention changed. Matched ordinary MuseScore notes end one
480-PPQ tick early; our full gates remain deliberate. The grace and navigation
findings above do not justify changing our compiler to imitate this backend.
This instrument changes no scenario engraving/performance golden or human approval.
