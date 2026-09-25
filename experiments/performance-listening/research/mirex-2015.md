# MIREX task conditions

Read 2026-09-25. Source: [2015 Real-time Audio to Score Alignment](https://www.music-ir.org/mirex/wiki/2015:Real-time_Audio_to_Score_Alignment_(a.k.a_Score_Following)), revision 10844, 2015-03-26.

**Reported:** This audio task accepts online algorithms even if processing is slower
than real time. It records estimated onset and detection time separately, with a MIDI
score position. It uses matching audio/score pairs and points to Cont et al. for
evaluation. The described material includes monophonic excerpts and Bach quartets;
the page says the proposed piano recordings were not used due to an oversight.

**Limitation / inference:** Online access alone does not prove our processing budget,
deadline, or microphone-to-feedback latency. The page supplies no negative-control
false-following denominator. Use its distinction between two times in the vocabulary,
with the local runner and oracle supplying stronger tests. This is supporting evidence
for [question 1](cont-2007-evaluation.md), not a local qualification.
