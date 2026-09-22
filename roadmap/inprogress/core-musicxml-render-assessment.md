# MusicXML render assessment — from external fixtures to an evidenced gap proposal

> **Status: in progress, 2026-09-22.** Side quest, item 18 of
> [core-campaign-musicxml.md](../inprogress/core-campaign-musicxml.md). Serves the implementation loop.
> Requested 2026-09-22: if each external MusicXML fixture were loaded into our editor,
> would each feature render correctly? The deliverable is an assessment and a new,
> bounded proposal to fill the gaps it discovers.

## The agreement block

1. **The oracle** — the pinned W3C/LilyPond MusicXML test suite's source and feature
   descriptions, checked against the MusicXML specification where interpretation needs
   resolving. Available upstream engravings provide visual reference, not pixel goldens:
   different spacing and line wrapping can both be correct. Semantic checks and visual
   assessment are separate evidence; successful import or nonempty SVG proves neither.
2. **The MNX verdict** — inspect the imported MNX for every failing feature before
   assigning a renderer defect. Classify representation gaps separately; any proposed
   extension follows the campaign's spec-loop contract and names its proposal topic.
   This assessment adds no vocabulary.
3. **The dependency budget** — no new runtime dependency. Reuse item 13's pinned corpus
   and existing browser/render harnesses. Any optional reference tool is dev-only,
   pinned and documented; the assessment must not require a LilyPond converter we write.
4. **The matrix row** — this report measures end-to-end rendering per fixture and feature,
   complementing the converter matrix. No support cells change just because a screenshot
   exists. Converter behavior changes belong to implementation items and regenerate the
   matrix there.
5. **The losslessness bar** — every inventoried fixture receives an explicit disposition;
   every in-scope feature receives an evidence-backed verdict or an explicit unresolved
   verdict. Completion means the report and gap proposal are delivered, not every gap
   fixed. No automatic human-verification claims.

## Corpus and scope

Share the fixture/feature inventory and evidence identifiers with the companion
[write-path assessment](core-musicxml-write-assessment.md), campaign item 19. Rendering
and authoring verdicts remain separate; link shared root causes in the resulting proposals.

Depends on item 13 for the licensed, pinned corpus from
[W3C's LilyPond-derived suite](https://github.com/w3c-cg/musicxmlTestSuite).
Inventory the entire pinned suite, including files not selected for converter accuracy
checks, so curation cannot silently remove difficult rendering features. Record upstream
path, revision, feature description and exclusion reason where applicable. Keep fixtures
under converter/harness ownership; do not hand-edit mirrored `scenarios/spec/`.

Assess each feature named by a fixture's description, including negative cases. Pure
MIDI/playback properties are explicitly nonvisual; intentionally invalid input is judged
on expected rejection or diagnostic behavior. Neither counts as a rendering pass.
Exercise notation for all applicable scores, and tab/both only when the document declares
known strings and the view is relevant. Never assume guitar tuning to manufacture a view.

Use the actual workbench and studio mouse/keyboard browser editor file-open path with the shared importer and editor/viewer
surface. Record shell, viewport, staff scale, view, browser version and application commit.
Touch editing is out of scope. Headless batch rendering may accelerate the assessment,
but cannot substitute for proving that the corresponding fixture loads and displays
through the real editor path. Reuse existing harness conventions and document the command
that reproduces each capture.

## Assessment procedure and report

For each fixture:

1. Identify the intended features from the upstream source/description before inspecting
   our output. State the expected visible behavior; cite the relevant reference.
2. Load the original MusicXML through the editor. Capture import warnings/errors,
   imported MNX, render diagnostics and screenshots covering all relevant measures,
   staves and pages/systems. Preserve enough context to detect clipping and collisions.
3. Inspect the feature in the imported MNX and in the displayed result. Check identity,
   pitch/rhythm where visible, attachment, endpoints, placement and legibility as relevant.
   An unsupported placeholder is a diagnosed gap, not a correct rendering.
4. Record one verdict per fixture × feature × applicable view: **correct**, **partial**,
   **missing**, **incorrect**, **blocked**, **unresolved**, or **not applicable**. Record
   why and link the evidence. Crashes and import rejection block affected rendering
   checks; they do not establish whether the renderer supports the absent content.
5. Attribute failures to **importer**, **MNX representation**, **layout/SVG engine**,
   **editor integration**, **source/reference ambiguity**, or **not yet isolated**.
   Multiple causes may apply. Where necessary, use a minimal independently authored MNX
   probe to separate renderer capability from information lost on import, keeping that
   evidence distinct from the original end-to-end result.

Commit a machine-readable report and a readable assessment summary with an evidence
index and reproducible capture instructions. Store reviewable captures using the existing
harness artifact conventions; state where they are retained. Include both fixture and
feature totals, exclusions, unresolved cases, and grouped root causes. Do not turn a
feature-count percentage into a claim about all MusicXML.

Agent assessments are explicitly labelled as such. Scenario `verified` status and
verification provenance remain human assertions written only through `/verify`. Existing
approved goldens remain untouched by the assessment.

## Output: a proposal to fill the gaps

Create `roadmap/proposed/core-musicxml-render-gaps.md` and its roadmap index entry after
collecting evidence. This follow-up is explicitly requested as part of this side quest.
It links back to this assessment and the campaign, and contains:

- A finite, deduplicated list of observed gaps, with fixture/feature evidence and ownership.
- Priorities based on missing or misleading musical content, affected cases and dependency
  order; cosmetic layout differences alone are not musical failures.
- A minimal regression case and observable acceptance criteria for each selected fix,
  including the relevant editor smoke and structural assertion where pixels cannot judge.
- Separate importer prerequisites and spec questions, plus explicit deferrals with reasons.
- The campaign agreement block and required golden/verification-debt handling for fixes.

Do not implement those fixes during the assessment or promise exhaustive MusicXML support.
If no actionable rendering gaps are found, record that result with evidence rather than
inventing work; document importer/spec blockers and unresolved coverage honestly.

## Completion

The pinned suite is fully inventoried; applicable cases have been exercised in the editor;
feature verdicts and causes are evidenced; unresolved cases and exclusions are explicit;
and the new gap proposal is linked from the roadmap and campaign. Append findings to the
campaign's progress log. This item can finish with known gaps: fixing the selected gaps is
what the resulting proposal is for.

## Initial evidence landed, 2026-09-22

See [the assessment report](../../docs/musicxml-editor-assessment.md) for the complete
both-shell browser sweep, selected findings, retained evidence and reproduction. The
requested initial gap proposal exists, but detailed feature/task coverage remains open.
This item is not complete.
