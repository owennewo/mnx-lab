# Evaluation norms — FIRST_STEP question 1

Read 2026-09-25. Source: Cont, Schwarz, Schnell and Raphael, ISMIR 2007,
[Evaluation of Real-Time Audio-to-Score Alignment](https://archives.ismir.net/ismir2007/paper/000315.pdf), pp. 315–316.

**Reported:** The paper separates estimated-onset error, reporting latency and offset
from the reference onset. Its example misalignment threshold is 300 ms. Missed and
misaligned events are distinct; latency averages concern non-misaligned events. Its
database covers flute, violin, clarinet and voice, classical and contemporary music.
It describes audio following; the reference preparation can use offline alignment
and manual correction. It does not define an unrelated-audio rejection metric or a
200 ms decision deadline.

**Local inference:** Our quarter-note tolerance is 250 ms at 60 BPM and about 167 ms
at 90 BPM, narrower than that example threshold, but continuous position and note-onset
error are different measures. The 200 ms deadline is a separate local requirement,
not validated by this paper. False-following controls and missed deadlines remain
necessary local measurements. This motivates the independently hand-worked oracle;
it changes none of [the provisional contract](../contracts/research-contract-0.md).

See also the [MIREX task note](mirex-2015.md). Answer: the magnitudes can be compared,
but these sources do not establish a universal norm or approve our tolerances.
