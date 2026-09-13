# Selective extra analysis

[Back to fusion log](../fusion-log.md)

- **ID:** selective-analysis
- **Role:** fusion scheduling and evidence reconciliation policy.
- **Implementation:** proposed; no conditional multi-detector execution exists.
- **Evidence:** untried.
- **Disposition:** candidate only if added evidence fits a measured total-process budget.

## Purpose and fit

Invoke additional analysis only for a defined uncertainty/event condition. Could combine a
cheap ongoing estimator with delayed neural evidence. The extra method must improve the
whole listener relative to its parent recipe; it need not run on every chunk. Consumers
must understand late or revised evidence. Templates remain parked unless a specific trial
justifies their marginal contribution.

## Configuration

All parameters below are proposed; there are no implementation defaults or measured ranges.

| Parameter | Units / values | Availability | Tried / candidate | Interaction |
|---|---|---|---|---|
| Trigger | Versioned uncertainty/event predicate | Proposed | Unchosen | Must use currently available evidence, not actual labels |
| Analysis context / lookahead | ms | Proposed | Unchosen | Extra method may require more context than primary estimator |
| Invocation cap / cooldown | Calls per second / ms | Proposed | Unchosen | Persistent ambiguity can otherwise trigger continuously |
| Queue limit / timeout | Jobs / ms | Proposed | Unchosen | Backlog, stale evidence and bounded memory |
| Merge/conflict policy | Versioned rule | Proposed | Unchosen | Correlated agreement; contradictory and delayed observations |
| Total processing budget | Target-device time per audio interval | Proposed | Unchosen | Include both estimators, sharing overhead and reconciliation |

## Timing and cost contract

Unmeasured. Define whether jobs block the live path, how obsolete work is cancelled, and
what happens when budget is exhausted. Measure dense passages with continuous uncertainty,
not only average invocation savings. No claim that two individually cheap algorithms are
cheap enough together. Record reset behaviour and preserve the timestamp/provenance of
each piece of evidence.

## Trial history

No trials yet. The separate detector benchmarks provide candidate costs and failure cases,
not measurements of selective execution or complementary errors.

## What works, what does not, what is unknown

It is unknown whether the methods correct each other's errors enough to justify combining
them. It is also unknown whether trigger quality, scheduling overhead and stale results
erase a potential gain. No fused implementation has been selected.

## Next experiment and acceptance question

First specify a parent recipe, complementary failure hypothesis and fixed device budget.
Compare primary-only, conditional addition and (where affordable) always-on addition on
identical inputs. Retain all trigger settings tried. Require an accuracy benefit beyond
extra abstention, acceptable worst-case latency/backlog, and defined behaviour when the
budget is exhausted. Removing a component remains a valid successful iteration.
