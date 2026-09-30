# Slowed-bar research refresh for 026

Read 2026-09-30 by GPT-6 in Codex (version unverified). Bounded to the unchanged event chain under a piecewise tempo map.

Primary source re-read: Nakamura, Nakamura and Sagayama, *Real-Time Audio-to-Score Alignment of Music Performances Containing Errors and Arbitrary Repeats and Skips*, accepted IEEE/ACM TASLP 24(2), February 2016; arXiv v1, 2015-12-24, https://arxiv.org/abs/1512.07748v1. Its abstract presents monophonic HMMs handling tempo changes and errors, evaluated on clarinet. No quantitative result transfers to our sine examples or approved gates. The [024 note](event-chain-024.md) records the method-family motivation; we do not reproduce that paper's algorithm.

Local inference from eventChain1.ts: pitch-change tokens and ordered event transitions do not depend on tempo, so stretching one bar should preserve pitch matches while the offline assessor reconstructs the changed intervals. Alternative failures are pitch transients at the tempo boundary or biased onset estimates affecting bar flags. Both outputs, controls and all earlier evidence distinguish these from clock-based progression.

The approved instrument assigns an interval to the bar in which it ends. Under a time map slow on score quarters [0,4], four of seven measured intervals are slow; the median is the slow tempo, and the unchanged second bar can read fast. Slow on [4,8] gives three slow intervals and a base-tempo median, so the second bar reads slow. This is independently derived arithmetic from the contract, not a published claim or a proposal to change the instrument. The experiment checks each placement separately, retaining the optional `either` band.
