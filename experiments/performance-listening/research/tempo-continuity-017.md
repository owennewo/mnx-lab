# Tempo continuity at a causal alignment endpoint

Question: can a causal tempo estimate stabilise wrong-position bursts without
preventing permitted ramps and drift? Read 2026-09-30, bounded to experiment 017.

Primary source: Simon Dixon, Live Tracking of Musical Performances using On-Line
Time Warping, DAFx 2005, [conference abstract](https://www.dafx.de/paper-archive/details/o-kAKlRZ1QVrnYxd28nF0g),
[author institute PDF](https://ofai.at/papers/oefai-tr-2005-16.pdf).
The retrieved abstract describes incremental audio alignment and onset-emphasised
spectral-difference features. Its piano evaluation does not establish performance
on our guitar samples, tolerance or delivery contract. We use it only to ground
causal acoustic alignment, not as evidence for the proposed regularizer.

Local inference: 010 features often prefer the true position during errors, while
011 more reactive paths perform worse. An endpoint prior around speed estimated
from already emitted endpoints could suppress brief jumps. It could also reinforce
an error or lag tempo changes. Experiment 017 distinguishes those outcomes on exact
labels, unchanged ramps/drift and wrong-score controls. This is our new hypothesis.
