# Auditing an oracle

A prompt for the session that audits an evaluator oracle. Give it to that session as
its instructions, or tell it to read this file and follow it. It holds no state: which
oracle awaits an audit is in [the research log](RESEARCH_LOG.md). The rule it carries
out is [contract 2's "Auditing an oracle"](contracts/development-contract-2.md#auditing-an-oracle).

---

You are auditing a hand-worked oracle in the mnx-lab repository. An oracle is a frozen
set of small cases, each with the numbers an evaluator must produce, worked out by hand
from written rules. Every listener is judged by evaluators that reproduce an oracle, so
an oracle that misreads a rule misjudges every listener after it. Whoever wrote the
oracle also wrote the evaluator, so the two agree by construction, and a misreading they
share cannot be seen from inside. **Your job is to be the reader who did not write
either: re-derive a sample of the oracle's numbers from the rules alone, record where
you agree and where you do not, and then stop.**

You succeed by finding the truth about the oracle, not by agreeing with it. A careful
disagreement is as valuable as an agreement. Do not soften one to be polite.

## 1. Which oracle

The research log's top open question names the oracle awaiting audit and the experiment
that created or re-versioned it. Check that no audit of that version already exists in
`bench/oracle-events/` and that no other worktree is doing one. If the log names no
oracle awaiting an audit, stop and say so.

## 2. What you may read, and what you must not

Read:

1. `CLAUDE.md` at the repository root: worktrees, landing and the gate. Other agents work
   in this repository at the same time.
2. [Development contract 2](contracts/development-contract-2.md): the rules as the user
   directed them.
3. The instrument definitions the oracle declares, `contracts/event-instruments-N.md`:
   the rules in operational detail.
4. The oracle itself in `bench/oracle-events/`: its README, its frozen file and its
   freeze record. You may compare it with the previous oracle version, to find the cases
   this version added or changed.

Do **not** read:

- the evaluator code, `bench/src/events/`, or its tests;
- the report of the experiment that built the oracle, beyond its title;
- any run's results.

They carry the author's reading of the rules, which is exactly what you are checking.
Run nothing: no evaluator, listener or test. If a rule cannot be applied without reading
code, that is a finding about the rule; record it.

## 3. What to check

Re-derive by hand, from the rules alone:

- **at least one case for every rule** in the instrument definitions; and
- **every case the version added or changed.**

Work each number fully: times, durations, tempi, fractions and counts, with the
arithmetic shown. Compare only after you have your own number. Give each case one
verdict:

- **agree**: your number equals the oracle's, to its stated precision;
- **disagree**: it does not. Say which rule you applied, how you read it, and where the
  oracle's number departs from that reading;
- **ambiguous**: the rule honestly allows more than one reading and they give different
  numbers. Give each reading's number.

## 4. Record, land, stop

Write `bench/oracle-events/audit-N.md`, with N the oracle's version:

- the oracle's version and frozen hash, and the rule text you worked from, by file and
  version;
- a table of every case checked: case, rules exercised, your number, the oracle's number,
  verdict; then your arithmetic for each case below it;
- the rules you could not exercise and why;
- a summary line: the number of cases agreed, disagreed and ambiguous;
- your model and tool.

Then update the research log's question for this audit: its status to `answered` with
the verdict and a link, or, where there are disagreements or ambiguities, a new top
question for the next numbered experiment to resolve them. Change nothing else: not the
oracle, the instrument definitions, the contract or any code. The audit is not a numbered
experiment and adds no ledger row. Land it following `CLAUDE.md`, retire your worktree,
and stop.
