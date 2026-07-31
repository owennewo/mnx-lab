---
name: verify
description: Run the scenario approval loop as a conversation — present the attention queue as a side-by-side review page, collect the human's verdicts in plain sentences, and record approvals through the harness scripts. Use when the user invokes /verify, asks to review or approve scenarios, or asks what needs verification.
---

# /verify — conversational scenario approval

You are the review interface for the scenario corpus. `verified` is a **human**
assertion ("I looked at the rendered output and approve"); your job is to show the
human exactly what needs their eyes, take their verdicts as ordinary sentences, and
record them. The human never runs a command, never ticks a checkbox, never edits a
file in this flow.

## Ground rules

- **The only mutation path is the harness scripts.** Approvals go through the verify
  script (find it as the `verify:scenarios` entry in root `package.json` — do not
  hardcode its path; the repo structure migrates). Never edit a scenario's
  `meta.json` `status` or `verification` fields by hand — the script is the only
  writer, and it enforces eligibility (checker-clean, actually renders today).
- **The queue is provenance-derived and ordered by attention**: blocked items
  (checker errors, render crashes) first, then **stale** (verified once, primitives
  changed since — the committed golden diff shows exactly what changed), then
  **never seen**; already-current items are counted, never listed.
- **One review page, one stable URL, refreshed in place.** Publish the side-by-side
  page as an Artifact and keep redeploying the *same file path* so "refresh the
  page" works mid-conversation. Do not mint a new URL per round.
- **Rejections are handled in-line when possible**: fix the layout code or the
  scenario, re-render, refresh the page, and re-present in the same session.
  Anything not immediately fixable is recorded as a finding (a note to the user,
  plus a roadmap/scenario `notes.md` entry if durable) and the scenario stays
  unverified. Never verify to make a problem go away.

## The session shape

1. **Build the queue**: run the verify script with `--list --json`. If the queue is
   empty, say so and stop — do not invent work.
2. **Render the review page**: one HTML page, one section per queue item, ordered
   blocked → stale → never-seen. For each item show, side by side:
   - **our render** — the scenario's current SVG output (render it headlessly via
     the harness; the preview/contact-sheet tooling shows how the SVG is produced);
   - **the spec's reference engraving**, when one exists (spec-mirrored scenarios
     carry one in the pinned spec checkout — the preview tooling locates it);
   - for **stale** items additionally a what-changed note derived from diffing the
     committed `expected.primitives.json` against the freshly computed primitives
     (summarize in words — "beam spacing changed", "new glyph" — don't dump JSON).
   Load the artifact-design skill before writing the page. Publish as an Artifact
   and reuse the same file path every round. Keep the page self-contained (inline
   the SVGs; no external requests).
3. **Present**: one short message — the counts, one line per item with its state
   and what changed, and the page link. Then wait for verdicts.
4. **Record verdicts**: map the human's sentences to scenario ids ("the first two",
   "the beams one"). For approvals, run the verify script with those ids and
   confirm what it reports. For rejections, fix → re-render → redeploy the same
   URL → tell them to refresh. Repeat until the queue is empty or the human stops.
5. **Close**: state the final queue counts. If anything was left unverified,
   restate the open findings so they aren't lost with the session.

## What you never do

- Never set `status: verified` or write a `verification` record by any means other
  than the verify script.
- Never present a scenario as approved when the script skipped it — report skips
  verbatim.
- Never batch-approve without the human having named (or clearly gestured at)
  each item.
- Never treat a stale item as trivially re-approvable because the diff "looks
  small" — the human decides.
