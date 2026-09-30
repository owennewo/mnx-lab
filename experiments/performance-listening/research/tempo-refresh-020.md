# Plateau refresh: stable causal timing without confidence feedback

Required by development contract 1 after three versions without a gain (017–019).
One bounded question: how can timing be stabilized without trusting each newest
forward endpoint? Read 2026-09-30, one new primary paper, no new evidence set.

Arzt and Widmer, *Simple Tempo Models for Real-Time Music Tracking*, SMC 2010,
[author institute PDF](https://www.cp.jku.at/research/papers/Arzt_Widmer_SMC_2010.pdf),
sections 2, 4 and 6. The paper estimates tempo from an updated backward path,
rectifies between known onsets and excludes very recent onsets as unreliable. It
acknowledges delayed response to tempo changes. Its simple model modifies the
reference feature stream; another model uses prior performances. Evaluation focuses
on piano with additional ensemble examples, and some references are offline
alignments rather than independently timed labels. This does not establish guitar
following under our gates.

Local inference, explicitly different from that method: 017's selected-endpoint
feedback failed; 018 raw-acoustic prediction fixed Shinyguitar alignment but changed
which backtrace support judged; 019 endpoint ranks rejected more correct playing.
Preserve v8 raw alignment and support, and estimate only the emitted current position
by robust slope/intercept from its last two seconds of raw endpoints. Use medians
to discount short excursions rather than feeding the fitted output into either DP
or confidence. The input is less reliable than the paper's backward path, so this
is a bounded local hypothesis, not a replication. The exact-label scoreboard will
measure whether its stabilization exceeds its delay and bias, including tempo ramps.
No independent freshness, qualification or real-audio selection is gained. The
refresh discharges the plateau obligation; the count and further stop rule carry on.
