# Causal alignment for the first sync-proxy development candidate

Question 2 of contract 1's bounded research budget: which causal alignment structure
is suitable for the initial known-start guitar follower? One new primary source.

Source: Simon Dixon, “Live Tracking of Musical Performances Using On-Line Time
Warping,” DAFx 2005, [conference abstract](https://dafx.de/paper-archive/details/o-kAKlRZ1QVrnYxd28nF0g),
read 2026-09-25. Full PDF retrieval timed out at both author mirrors; this note
uses only the conference abstract and indexed abstract text. This is historical algorithm research, not a current product claim.

The paper incrementally aligns arriving audio against another recording, using
spectral differences that emphasize onsets. Its reported piano alignment results do
not establish guitar performance or our thresholds. It motivates a causal alignment
path rather than a complete-audio offline alignment. Our local candidate is a simpler
score-template experiment, not a replication: pitch-class spectral features and
score-derived templates, a bounded monotone path and an explicit rejection threshold.
No reference recording or sync anchors enter the candidate. Whether that adaptation
works on the selected fingerstyle guitar clip is the experiment, not a claim from
the paper. Timing agreement will be measured against the user's accepted sync proxy.
