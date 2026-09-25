# ASAP: annotation identity, ambiguity and partition practice

Read 2026-09-25. Bounded question: what should be kept explicit when converting
score-linked bar annotations into following evidence?

Primary source: [ASAP repository README](https://github.com/fosfrancesco/asap-dataset),
Foscarin et al., ISMIR 2020; repository documentation as retrieved on this date.
It separates score/performance annotations and records audio crop origins. It marks
beats whose positions cannot be determined, documents incomplete/misaligned performances,
and warns that alternate score files can represent the same piece with different repeats.
Its suggested piece identity uses title/composer rather than score filename.

Local inference: retain crop origins and uncertain regions; do not infer independence
from another export or repeat variant. This supports the preflight and partition rules,
not our numerical tolerances. ASAP is piano evidence, not a substitute for the selected
guitar recordings. No dataset was ingested or evaluated. The README is a moving source;
this note records only the practices inspected, not a pinned dataset claim.
