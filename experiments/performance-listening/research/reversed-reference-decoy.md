# A reversed-reference support comparator

Question for experiment 014: can a temporal decoy preserve timbre sensitivity while
removing the correct sequence, allowing relative rather than fixed-rank support?
One bounded development research question, 2026-09-29, by GPT-6 in Codex.

Primary source: Meinard Müller, FMP notebook [Subsequence DTW](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C7/C7S2_SubsequenceDTW.html),
following Fundamentals of Music Processing (2015), read 2026-09-29. The notebook
separates local frame costs from a sequence's accumulated path cost. It warns that
unrestricted steps can assign a sequence to one reference element; the steps
(1,1), (2,1), (1,2) constrain this flexibility. Its worked audio example matches
Beethoven recordings with CENS features, offline. It neither proposes a reversed
reference as a rejection control nor supplies causal guitar support thresholds.

The [Dixon note](dixon-2005-online-alignment.md) remains the comparator's primary
basis. A bounded attempt to retrieve its full paper from
https://ofai.at/papers/oefai-tr-2005-16.pdf timed out again; no new claim is taken
from the unavailable full text.

Local inference, not a published result: reversing the already-extracted reference
frames leaves every incoming frame's multiset of costs unchanged, hence also its
rank scale. Fitting a separate causal path with the same start and slope rules tests
whether the forward sequence explains the audio better than that decoy. Features
are not recomputed after reversal; doing so would also change onset features.

Alternative explanations matter. A wrong score can have a forward passage better
than its own reverse even though neither is the intended piece. Reversal changes
which pitch is at the known start, so any apparent discrimination could come from
that boundary rather than from the subsequent sequence. Sustained or repeated
passages can also let the decoy fit well. There is no exchangeability assumption or
statistical false-positive guarantee from one decoy. The frozen wrong-score
controls, every earlier rung and private rank traces test these limitations; a
positive-only gain cannot justify adopting the rule.
