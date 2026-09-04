# The converter support matrix — derived, never declared

> **Status: BUILT 2026-09-04.** Item 8 of
> [core-campaign-musicxml.md](../proposed/core-campaign-musicxml.md), and the only `lab-`
> item in it: this is corpus machinery, not converter work. Answers the original
> question — *which converters support what, and which gaps are ours versus the spec's.*

## Why it is generated and not written

A hand-maintained support table is a lie within two weeks. It records what someone
believed on the day they typed it, and nothing ever makes it wrong out loud. So every
cell here is **evidence**: all 125 committed MNX documents — the whole scenario corpus
plus the converter fixtures — go through each converter's round trip, and what comes back
is compared with what went in. Hand-editing the result is a red test.

The comparison needs an answer to "which schema objects does this document instantiate"
for documents nobody has scored, which `coversDefs` cannot give (it exists only for spec
scenarios). `harness/helpers/mnxDefs.ts` reimplements upstream's own
`accumulate_used_json_objects()`, and `mnx-defs.test.ts` holds it to upstream's answer
across all 52 mirrored scenarios.

**It is deliberately stricter than upstream's join.** Two defs — `measure-number`,
`literal-string-event` — are claimed by `coversDefs` for documents that do not contain
them: both are optional properties of an object the document *does* use, so upstream
credits what could be carried while this credits what is written. Instantiation is the
right question here, because "did this survive the round trip" is meaningless for a key
that was never there.

## The five verdicts, and what each is evidence of

| | |
|---|---|
| `supported` | every document carrying it kept it |
| `lossy` | at least one did not — **the dangerous cell**, because the conversion succeeded and quietly thinned the music |
| `error` | the converter threw on every document carrying it |
| `extension` | survives only under `_x.mnxLab` — a **spec** gap, feeding `spec/proposals/`, not a converter backlog |
| `untested` | no document exercises it — the honest cell a declared table always fakes as a tick |

**The two kinds of gap separate by construction**, which was the whole point:
`extension` says the standard cannot hold something a format can; `lossy` and `error` say
our code cannot carry something the standard can.

Every non-`supported` cell names a document: what lost it, or — for `extension`, which
never lost anything — where it can be seen. **A cell without evidence is a scoreboard
entry**, and this exists not to be one.

## What it found on its first run

| MusicXML | first run | after the crash it found |
|---|---|---|
| supported | 24 | **36** |
| lossy | 82 | **70** |
| extension | 6 | 6 |
| untested | 3 | 3 |

Two documents **could not be converted at all** —
`lab/31-score-text/10-labels-on-a-tab-staff` and `lab/50-lyrics/02-tab-verses`, both
`Cannot read properties of undefined (reading 'replace')`. That was a crash in the
exporter that nothing else had noticed, found by pointing the whole corpus at it
([core-musicxml-export-crash.md](core-musicxml-export-crash.md)), and fixing it moved
**twelve rows** from lossy to supported: a single crash was distorting a dozen verdicts,
because every def those two documents carried counted as lost.

The 70 is not 70 problems: the evidence column groups them, and the largest clusters are
one document each (`lab/60-layout/01-group-barline-individual` accounts for 8,
`lab/32-articulations/01-rare-articulations` for 5). It is a work queue with starting
points, which a coverage fraction never is.

The 6 `extension` rows — `capo`, `fret`, `harmonies`, `string`, `strings`, `tab` — are the
campaign's standing list of things MNX cannot yet say. They are exactly the vendor blocks
`docs/mnx-extensions.md` registers, arrived at from the other direction.

## The page

`#/converters`, reachable from the command palette, in the same frame as `#/objects`.
Rows are tiered by what to do about them rather than by severity, each def links to its
coverage page, and each piece of evidence links to the scenario that proves it.

The generated JSON lives at `src/corpus/generated/converter-matrix.json` rather than
`harness/reports/`, following `worker/generated/`: the workbench renders it, and the
boundary rules forbid the harness reaching into a shell, so the data has to sit below
both.

## The agreement block

1. **The oracle** — itself, plus `mnx-defs.test.ts` holding the walker to upstream's join.
2. **The MNX verdict** — none; this reads the schema, it does not extend it.
3. **The dependency budget** — no new dependency.
4. **The matrix row** — it *is* the matrix.
5. **The losslessness bar** — not applicable to an instrument. Held instead to: the
   committed matrix regenerates identically, and a lane may never support fewer defs than
   it did.

## What this does not do yet

**One lane.** Guitar Pro is the obvious second, and the lane interface takes a round-trip
function, so adding it is a few lines plus whatever the GP round trip needs. Held back
until the clean-room binary reader settles
([core-guitarpro-binary-import.md](core-guitarpro-binary-import.md)), rather than pinning
a matrix against a converter mid-replacement.

**Round trips only.** A round trip is exact about *loss* and blind to *symmetric* error —
the campaign's founding point. The W3C oracle is what covers that, and the two are
complementary: the oracle scores 27 documents deeply, the matrix scores 125 shallowly.
