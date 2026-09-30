# Event-chain research for experiment 024

Read 2026-09-30 by GPT-6.1 in Codex. Bounded to monophonic event following.

Nakamura, Nakamura and Sagayama, *Real-Time Audio-to-Score Alignment of Music
Performances Containing Errors and Arbitrary Repeats and Skips* (2016),
https://arxiv.org/abs/1512.07748, proposes monophonic HMMs with error and navigation
transitions. Its reported clarinet recovery and real-time results concern a richer
method and a different task; they establish no result for this bench. They support
starting from explicit event states, with staying and skipping represented, rather
than forcing continuous clock movement. This experiment uses a hard pitch-emission
chain limit, not the paper's general algorithm or published accuracy claim.

De Cheveigné and Kawahara, *YIN, a fundamental frequency estimator for speech and
music* (2002), https://pubmed.ncbi.nlm.nih.gov/12002874/, develops an autocorrelation-based
fundamental estimator and tests speech. It is an alternative if the elementary
pure-tone detector fails; no speech error-rate result transfers to guitar here.

Our inference: with pure monophonic sines, distinct adjacent pitches, no deviations
and a known start, interpolated zero-crossing periods suffice to identify observations;
ordered event transitions suffice to place them. Harmonics, noise, repeated notes,
wrong notes and chords can invalidate both assumptions. A 20 ms window and two-window
agreement trade latency for transient rejection; the approved 200 ms deadline leaves
room. Those settings are fixed before hearing the development run, not fitted to it.

Counter-explanations: onset counting alone can follow wrong audio; a handed clock can
follow steady audio at the handed tempo. Silence, the distant wrong score and the
four playback tempi distinguish those from pitch-dependent event evidence. A later
near-miss control and one wrong note will test the currently hard pitch boundary.
