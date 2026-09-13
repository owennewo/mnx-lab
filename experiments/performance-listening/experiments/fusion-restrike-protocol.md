# F-002: preserve pitch presence, add re-strikes only

Implementation loop. Frozen before measurement, 2026-09-13.

Parent F-000 remains the harmonic scorer plus original two-frame gate. Keep the F-001-01
feature parameters fixed (.15 rise threshold, 90 ms refractory, 35 ms association).
No parameter sweep: isolate the change in how attack evidence is used. It cannot gate,
close or restart parent pitch tracks. Instead, a rise associated with an already confirmed
track starts an additional attack candidate requiring two qualifying frames. Its end may
follow the parent, but never extend outside parent pitch presence. New parent tracks
consume the current crossing to avoid immediately duplicating their initial attack.
Crossings are still consumed before confirmation; that separate question is not changed.

Development is all 132 recordings from audio-v1 and the first iteration's held-out set,
now regression evidence. New v2 held-out schedules are frozen in fusion-heldout-v2.mjs.
Run only F-000 and F-002-01, three counterbalanced processing passes after warmup.
Persist development disposition before scoring v2; no tuning on either split.

Retain F-001 acceptance rules: repeat precision AND recall must increase; overall and
single/arpeggio/strum attack/active F1 must not lose more than two percentage points;
false accusations cannot increase; median processing <=1.25× parent; pooled and common
matched-truth p95 increase <=25 ms. Report missed unexpected and unassessed attacks,
recall, and backlog. Additionally require exact active-pitch TP/FP/FN identity per case
and retention of every parent's pitch/start/end/confidence/decision sample. These are
structural invariants, not compensable quality tradeoffs. Include held-out wrong-note,
short, rapid and overlap cases. Evaluate new schedules on existing packs only: no claim
about microphone or unseen-instrument generalization. Keep/revise are both valid outcomes.
