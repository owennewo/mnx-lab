# Reviewing an implementation

A prompt for the session that independently reviews a numbered experiment's
implementation and recorded evidence, where an oracle audit can't reach. Give it to
that session as its instructions, or tell it to read this file and follow it. It holds
no state: which experiment awaits this review, and why, is in
[the research log](RESEARCH_LOG.md).

It exists because [an oracle audit](AUDITING_AN_ORACLE.md) must not read the code or
results it checks, which keeps it independent of the author's reading of the rules, but
leaves the code itself, and the measurements it produced, checked only by its author.
Added on 2026-10-05 by the user's direction, after
[the seam-4 audit](bench/oracle-events/audit-observation-seam-4.md#rules-i-could-not-exercise)
named that gap: see the research log's current batch.

---

You are reviewing the implementation and evidence of one numbered experiment in the
mnx-lab repository's performance-listening loop. You did not write it. Your job is to
establish, from the code and the recorded evidence, whether its measurements mean what
its report says they mean, then record what you found and stop. A careful "does not
hold" is as valuable as a "holds".

## 1. What to review

The research log's current batch and its top open question name the experiment and
the obligations. For each obligation, the seam audit's table of rules it could not
exercise says what an independent reader still has to check.

## 2. What you may read and do

- Read everything: `CLAUDE.md`, the contract (including its 2026-10-04 amendment and the
  challenger section), the seam contract the experiment implements, the experiment's
  report, its source at its `<run-id>-source` tag, its tests, its public summary and
  the private records it cites.
- Verify hashes; recompute any figure from the private records.
- Re-execute **a sample** of the experiment's examples from its source tag, in a
  detached worktree, writing outputs only to your scratch space: never under `runs/`,
  never into the experiment's private run directory, never as a new run ID. Say which
  examples and why, and compare your records with the recorded ones.

You must not edit code, reports, verdicts, oracles, contracts, gates or frozen data,
run a numbered experiment, or tune anything. A defect you find is a finding for the
next numbered experiment to resolve, not something you fix.

## 3. What to check

Each obligation the research log names, and at least:

- **Timers.** Where measured listener work starts and stops; that it includes
  everything the contract's cost rule counts, exactly once, and excludes what it
  excludes (reference comparisons, evidence writing, evaluation); that shared loading
  is reported separately.
- **Equivalence claims.** Where the report says the new path equals an old one (for
  example, incremental inference against whole-window inference), what was compared,
  on which windows, and whether that sample covers the places it could fail: clip
  edges, boundaries between runs, silence, the attack of a note.
- **Causality.** That the live path reads no input beyond what has been delivered, and
  that the prefix checks exercise the real path with altered futures.
- **Clocks.** That decisions carry the delivery clock and measured completion as the
  seam defines them, and that nothing uses one where the other is required.
- **Provenance and reuse.** That the source tag, hashes and cited reused records
  reproduce, and that anything reused had unchanged producers and inputs.

## 4. Record, land, stop

Write `bench/oracle-events/implementation-review-NNN.md` (NNN the experiment's number):
each check with **holds**, **does not hold** or **could not check**, the evidence, and
what you re-executed; a summary line; your model and tool in the format
`<model> (<effort, if known>) in <tool>`. Update the research log: the question that
asked for the review gets your verdict and a link, and any "does not hold" becomes a
new top question for the next numbered experiment. Change nothing else. The review is
not a numbered experiment and adds no ledger row. Land it following `CLAUDE.md`,
retire your worktree, and stop.
