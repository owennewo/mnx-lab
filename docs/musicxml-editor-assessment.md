# MusicXML editor assessment — initial evidence, 2026-09-22

**Both assessments remain in progress.** The complete corpus has been exercised in
Workbench and Studio, and selected failures and one authoring task have been investigated.
This is not yet a feature-by-feature correctness or authoring-support inventory. Agent
findings do not confer scenario verification. No goldens or verification records changed.

| Evidence | Workbench | Studio |
|---|---:|---:|
| Original fixtures exercised | 183 | 183 |
| View observations | 219 | 219 |
| Screenshot tiles | 245 | 432 |
| Import/capture failures | 0 | 0 |
| Fixtures with layout exceptions | 4 | 4 |

All 183 imported document hashes agree between shells. A nonempty SVG is not a pass;
the four layout-failing fixtures are `12a-Clefs`, `34c-Font-Size`, `41c-StaffGroups`, and
`73a-Percussion`. Notation fails in all four; Both also fails for staff groups. The
recorded exception is an access to `staffPosition` on an undefined object.

## Evidence and provenance

The original corpus is [the pinned W3C/LilyPond suite](musicxml-suite.md), including all
177 feature, three negative and three compatibility cases. Source IDs, hashes and
unabridged descriptions remain in its manifest. Reports preserve shell, application
commit, Chrome version, viewport (1440×1000, device scale 1), staff scale, spacing density,
view, system rows, import warnings, render errors, console errors and screenshot names.
The app under assessment is commit `b534a735`; only harness/docs changed while capturing.

- [Workbench observations](../harness/reports/musicxml-editor-workbench.json)
- [Studio observations](../harness/reports/musicxml-editor-studio.json)
- [Selected feature/task findings](../harness/reports/musicxml-editor-findings.json)
- [Retained evidence manifest](../harness/fixtures/musicxml-editor-evidence/manifest.json)
- [Chord authoring action trace](../harness/fixtures/musicxml-editor-evidence/write-chord/report.json)

Full captures are retained locally under `/tmp/mnx-musicxml-editor-captures` and
`/tmp/mnx-musicxml-studio-captures`, with a directory per source ID containing imported
MNX, per-view SVG, overlapping PNG tiles and observation JSON. Those temporary directories
are not portable or permanent. Selected reviewed examples are committed under
`harness/fixtures/musicxml-editor-evidence/`; the full set is reproducible below. Captures
are review evidence, not pixel goldens. Existing source fixtures retain their MIT notices.

Notation was requested for every document. Tab/Both were requested only when the imported
document advertised known strings. This exposed an importer defect: some piano documents
acquire fabricated guitar strings. Those extra captures are diagnostic evidence, not an
assertion that the source is a guitar score or that tab is applicable to it.

## The two entry paths

Workbench uses Open… and the actual file input, importer worker and shared editor.
Studio has no local score-upload UI. The capture seeds its **local-only** library with a
GP canonical fixture and an unchanged MusicXML original rendition through operator ingest,
then uses **Saved → Versions → View** and **Make current**. It does not convert the XML to
GP or inject an MNX document into a live editor. The GP seed is only an entry prerequisite.

All XML originals display through Versions. **177 cannot become current** because their
imported document has no required title; the API says “A piece needs a title”. They remain
view-only, with a bound but suspended editor. Six become current: `51a-Header-Credits`,
`51b-Header-Quotes`, `51d-EmptyTitle`, `52a-PageLayout`, `90a-Compressed-MusicXML` and
`99c-Wavy-Lines-No-Numbers`. Do not credit editing capability from a suspended binding.
Studio's conversion-notes state belongs to its current source while an older version is
viewed; recorded warnings there must not be treated as warnings freshly returned by the
XML version import. Workbench records the actual original-file import warnings.

The Studio sweep clicks its Settings → Staff control; Workbench uses the staff-view
buttons. Screenshots tile the actual shell scroll container, without changing viewport
or shrinking the score. A settled SVG, rather than just a populated document property,
is required before reading diagnostics. This matters: a preliminary capture read an
empty diagnostic list just before the first real paint.

## Meter follow-up

The [meter assessment](musicxml-meter-assessment.md) reviews all 12 time-signature
fixtures in both shells and exercises five Workbench meter commands. The original
full-corpus captures hid time signatures via editor preferences: they cannot establish
missing-meter defects. New captures explicitly show them and record effective display
options. Other feature families must check relevant preferences before assigning verdicts.

## Initial agent findings

1. `43a-PianoStaff`: the source has two pitches on treble/bass staves and no tuning;
   imported MNX has one pitch plus standard guitar strings. The lower staff is empty in
   the capture. No import warning. This is an importer prerequisite to rendering fidelity.
2. `01d-Pitches-Microtones`: -1.5/-0.5/+0.5/+1.5 alterations become -1/0/0/+1, twice,
   without warning. Published MNX `alter` is integer, so support needs a representation
   decision; a float parser alone would produce invalid standard MNX.
3. `14a-StaffDetails-LineChanges`: variable line counts and hidden lines disappear from
   imported data; both parts draw ordinary five-line staves, without an import warning.
4. Unsupported clefs can blank an entire projection. The percussion import also fails
   published-schema validation, so the UI's generic “Validates, doesn’t render yet”
   explanation is misleading for this case. Import validation and failure containment
   both need attention; rendering support for the absent features is unresolved.
5. Studio's untitled-version refusal blocks the normal edit path, separately from
   shared editor operation support.

The requested bounded follow-ups are
[render gaps](../roadmap/inprogress/core-musicxml-render-gaps.md) and
[write gaps](../roadmap/proposed/core-musicxml-write-gaps.md). They specify regression
fixtures, ownership, acceptance criteria and representation-policy deferrals. No fixes
from those proposals have been implemented during this assessment.

## Bounded write-path proof

On Workbench's original `21a-Chord-Basic`, real keyboard actions transpose the selected
note by one semitone (Alt+Up), remove it (Delete), and create A4 at the vacated staff
position (N). Each change preserves unrelated data and exactly undoes/redoes with
Ctrl+Z/Ctrl+Y. Before/after documents validate against published MNX and the root extension.
The JSON panel's Copy document action, followed by saving the clipboard as `.mnx.json`
and reopening through Open…, restores the final document exactly. The harness performs
the external clipboard-to-file save; Workbench does not gain a download command from this.

The existing Studio editor smoke also passed on a separate, normal editable piece:
keyboard entry, inspector meter, lyrics, clipboard, shared undo history and GP save/reload.
Its [transcript](../harness/fixtures/musicxml-editor-evidence/studio-editor-smoke.txt) is
supplementary shared-surface evidence, not a pass for every imported corpus feature.
MusicXML download preservation and arbitrary-feature GP persistence remain unassessed.

## Reproduce

Install npm dependencies once, then `npm run build`. Requires installed Chrome (or
`CHROME_BIN`), with no new runtime dependency:

```sh
node harness/verify/musicxml-editor-capture.mjs
node harness/verify/musicxml-write-probe.mjs
```

Optional `MUSICXML_CAPTURE_FILTER` is a source-ID regular expression for a pilot run;
leave it unset for the full 183. `MUSICXML_CAPTURE_DIR` selects an artifact directory.
`MUSICXML_CAPTURE_TIME_SIGNATURES=show` drives the real display control before capture.
The scripts never write scenario statuses. Each shell needs its own capture directory.

For Studio, follow [local library setup](library-access.md), then in separate terminals:

```sh
npm run dev:login
npx wrangler dev --config wrangler.jsonc --assets dist/client --port 8797 --local --local-upstream localhost
```

```sh
LIBRARY_LOCAL_ORIGIN=http://127.0.0.1:8797 MUSICXML_CAPTURE_SHELL=studio MUSICXML_CAPTURE_DIR=/tmp/mnx-musicxml-studio-captures node harness/verify/musicxml-editor-capture.mjs
LIBRARY_LOCAL_ORIGIN=http://127.0.0.1:8797 node harness/verify/studio-editor-smoke.mjs
```

Studio captures enforce loopback and use ignored local credentials/database files. Use a
fresh task-local library state for an identical starting point. This creates synthetic
local pieces; no production data is touched. The worktree can be retired after landing:
committed evidence and `/tmp` captures remain, while local service state is disposable.

## Remaining assessment work

Break every description into feature variants, including attachment, scope and placement;
review the full relevant captures against source semantics and reference engravings;
record explicit negative/nonvisual dispositions. Then map each variant to independent
create/change/remove tasks, exercise reachable commands and applicable persistence, and
record unavailable or unresolved capabilities with evidence. The current observation
reports deliberately leave unreviewed feature verdicts unresolved. The selected findings
file overrides only its explicitly named feature scopes, never whole fixtures by inference.

Items 18 and 19 must not be marked complete merely because these sweeps and initial gap
proposals exist. They remain the place to finish the detailed assessment.
