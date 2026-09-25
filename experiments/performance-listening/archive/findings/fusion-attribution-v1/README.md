# F-003: neighbouring-pitch attribution improves the candidate

Implementation loop · 2026-09-13. **Revise; F-000 remains default.**

At a fixed attack recipe, F-003 requires an additional re-strike to compete with its two
immediate semitone neighbours. Ratios 1 and 1.5 were frozen before measuring 168 regression
recordings. Ratio **1** won the predefined ranking; 1.5 removed no additional false attacks
and lost another correct one. Selection was locked before 42 new recordings, including
real repeated adjacent-note dyads and quiet inner notes. There was no held-out retuning.

Compared with F-002, the selected rule removes **16/23 added false attacks** on regression
at the cost of one correct attack. On held-out audio it removes **10/11 added false attacks
with no loss of correct attacks**. Parent events and pitch coverage remain exactly identical
in every case. Whole-pipeline processing is +5.2% versus F-000 on regression and +7.8% on
held-out; F-002's corresponding costs are +5.6% and +7.2%. The incremental filter cost is
small in this run; no target-device performance claim is established.

Repeat recall is 39.7% → 78.2% against F-000 on regression. Held-out repeat recall reaches
92.4%, also achieved by F-002. This includes the adjacent-note cases, but does not establish
that every quiet close-interval chord is safe under competition. The extra false-accusation
gate still fails: +7 regression and +1 held-out. The sole held-out extra is guitar
`v3-restrike`, MIDI 82 during a played MIDI 70 repetition—an octave confusion.

This earns a follow-up: retain ratio 1 and test competition with lower harmonic-related
pitch hypotheses. The [F-004 protocol](../../experiments/fusion-harmonic-attribution-protocol.md)
freezes that next question and fresh real-octave/bass tests. These v3 recordings now belong
to regression evidence. This is synthetic sample-pack evidence, not live guitar validation.

[Comparison table](table.md) · [Exact unmatched re-strikes](attack-diagnostics.json) ·
[Development summary](development-summary.json) · [Held-out summary](heldout-summary.json) ·
[Decision](decision.json) · [Provenance](provenance.json).
