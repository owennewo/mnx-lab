# (n)ASAP: automation still needs independent annotation review

Read 2026-09-25. Same bounded question as the [ASAP note](asap-annotation-practice.md).
Primary source inspected: [authors' institutional abstract](https://research.jku.at/en/publications/automatic-note-level-score-to-performance-alignments-in-the-asap-/)
for Peter et al., 2023, [DOI 10.5334/TISMIR.149](https://doi.org/10.5334/TISMIR.149).
Only the abstract was read, not the full paper.

Reported: the work uses existing beat/measure alignments to constrain automatic
note alignment, and its resulting note alignments are manually checked. It describes
expert manual alignment as expensive. The source concerns solo-piano MIDI and scores,
not microphone guitar or our exact error tolerance.

Local inference: automated route and time-range checks are useful preflight, but do
not certify solo status, score correspondence or sub-beat precision. Our private
review packet therefore leaves human findings empty and never emits a golden.
No reported accuracy number is imported into this contract.
