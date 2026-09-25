# Trivial baseline — FIRST_STEP question 2

Read 2026-09-25. **Outcome: not found within the bounded search.** Queries used:
`score following evaluation baseline tempo clock Cont 2007`,
`"score following" "baseline" "constant tempo"`,
`"score following" "baseline" "linear"`, and
`"score following" "clock" "baseline"`.

The primary-source search hit [Henkel et al., 2019, §4.2](https://stefan.balke.at/assets/pdf/2019_HenkelBDW_ScoreFollowingRL_TISMIR.pdf)
describes multimodal localization and online dynamic time warping baselines, not a
clock ignoring audio. Conditions include synthetic piano with sheet-image input;
that is not our symbolic-score, sine-tone setting. No clock-only reported numbers
were found in this source. A fixed-tempo probabilistic model also surfaced, but a
fixed timing prior does not demonstrate an audio-ignoring baseline.

**Inference and limitation:** This bounded search cannot establish that no published
clock floor exists. We cannot call our floor the usual baseline or compare its
numbers with one from the literature. The local experiment motivated is unchanged:
`clock-follower@1` proves the instrument on the pre-registered positives, controls
and tempo probe; it is not an external comparator.

Related search result: [Park et al. source note](park-2025.md).
