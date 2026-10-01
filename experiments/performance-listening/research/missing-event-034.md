# Missing-event context for 034

Read 2026-10-01 by Sol 6.1 (high) in Codex. Bounded refresh of the primary abstract
already read for 024: Nakamura, Nakamura and Sagayama, *Real-Time Audio-to-Score
Alignment of Music Performances Containing Errors and Arbitrary Repeats and Skips*,
arXiv v1 (2015), accepted journal version 2016,
https://arxiv.org/abs/1512.07748.

The authors propose two monophonic HMMs representing errors and arbitrary navigation,
and report real-time alignment/recovery on clarinet performances. Their observation
model, navigation scope and evidence differ from this sine bench. That evidence
supports investigating explicit skip transitions; it does not establish this chain's
recovery accuracy, onset resolution, offline missing findings or performance on guitar.

Local inference from event-chain@3: exact pitch emission plus a two-event forward
transition should bridge one interior deletion on s1/s2. Offline deletion alignment
should preserve the two-quarter distance of the spanning interval. A clock can instead
move into the unsounded event; an incorrect deletion alignment can identify the wrong
missing note or interpret a doubled interval as a slowdown. [034's pre-registration](../reports/034-missing-event-sweep.md#pre-registration)
fixes these competing predictions before generating the new audio. No new method,
listener tuning, threshold or oracle follows from this abstract-only refresh.
