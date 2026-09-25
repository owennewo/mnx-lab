# Development contract 1 — the synthetic-first following ladder

2026-09-25. Loop: implementation research. This contract governs **development**:
how the loop learns, which evidence it builds and when a candidate is ready for
real audio. It retains nothing. [Research contract 1](research-contract-1.md) stays
the **qualification** contract: its gates, reserved and final evidence rules and
retention procedure are unchanged except where the last section says otherwise.

## The user's direction

After reviewing experiments 001–003, the user wrote:

> My intuition is that we've gone to real audio too early. what I would suggest is to
> produce sine wave, perfectly timed audio of the first 4 bars of winner. Experiment
> with that and then try to fuzz it up. Fuzzing might be to change speed, add note
> timing variation, subtle frequency difference, different attack/sustain/releae
> profiles and when we have something that works with a variery of fuzzed sources
> switch to real audio.

They then directed that the next planned experiment be marked abandoned and that the
experiment's documents and procedure be brought in line with this approach, including
splitting development from qualification. When asking for rung 0 to be built, they
added that real samples are worth trying once sine, jitter and the other early rungs
work, naming the tonejs-instruments guitars. The axes, order and ranges below were
drafted from that direction. Tightening them needs no approval; loosening a range,
a pass bar or the exit rule needs the user.

## Why

Neither spectral follower was ever run on audio whose answer is exact. Both went
from design straight to the real Winner clip, where a tracking defect and an acoustic
limitation produce the same failure. A rendering of Winner's own score keeps the real
piece's structural ambiguity, such as repeated harmonies and arpeggio patterns, and
gives sample-exact labels. Fuzzing it one declared axis at a time attributes each
failure to the axis that caused it.

## The ladder

Every rung renders Winner's first four performed bars from the same private score
that the frozen `winner-four-bars-sync-proxy-v1` set pins. A polyphonic renderer
works from the compiled performance's sounding notes, so every note of the score
sounds, chords included. The renderer knows every event it produced, so labels are
exact. Because the score is private, rendered audio stays outside git like the real
clips; committed records hold the recipe, seed and hashes.

| Rung | Axis | What varies | Provisional range |
|---|---|---|---|
| 0 | None | Sine partial per note at score timing, nominal 101 BPM, sine-v1 envelope | Fixed |
| 1 | Tempo | Constant tempo away from nominal, smooth ramps and slow drift | Local beat durations 80–120% of the supplied nominal tempo, as contract 1 defines modest variation |
| 2 | Onset timing | Independent per-note jitter; chord notes spread like a strum | Jitter up to ±40 ms; spread up to 30 ms |
| 3 | Envelope | Attack, sustain and release shapes; notes ringing past their score duration | Plucked exponential decay 0.3–3 s; ringing into following notes allowed |
| 4 | Timbre | Harmonic partials with slight inharmonicity, plucked-string synthesis, then recorded guitar samples | Develop on most sample sets; hold out at least one set from each source |
| 5 | Tuning | Global reference offset and small per-note detune | Global ±25 cents; per note ±10 cents |
| 6 | Level and noise | Per-note level and a noise floor | Per note ±6 dB; signal-to-noise 40 dB down to 20 dB |
| 7 | Combined | All axes sampled jointly within their ranges | As above |

Recorded samples come from two sources. The repository ships four CC0 guitar sets
under `public/samples/`. The user also proposed the tonejs-instruments collection
(github.com/nbrosowsky/tonejs-instruments): its `guitar-acoustic`, `guitar-electric`
and `guitar-nylon` sets are licensed CC BY 3.0, per its README, read 2026-09-25. Those
samples are fetched outside git for local research, and each set's provenance carries
the attribution. Recorded samples come after the jitter and envelope rungs work, as
the user asked.

Each rung is a frozen, versioned set. Its fuzz draws come from seeds split into
development and held-out groups before any candidate runs on it. Held-out seeds from
the same generator test robustness to the draw, not transfer to a new source. Every
rung carries the two following controls used in experiment 002: the listener given
Dust's intended score, and digital silence of the same duration. The fuzz recipe is
provenance, hidden from the listener like every other label.

## What "works" means

A rung is passed when one frozen candidate meets contract 1's following gates on
every held-out example of that rung and still meets them on every earlier rung. The
gates apply unchanged, with exact labels in place of bounded ones:

| Measure | Gate |
|---|---|
| Position tolerance | ±0.25 quarter |
| Supported correct | At least 95% of answerable supported points |
| Listener coverage | At least 98% of answerable points |
| Unsupported correct rejection | At least 95% |
| Wrong or false exposure | At most 5% of answerable time; no episode over 0.5 s |
| Correct-decision deadline | At most 10% missed; 150 ms allowance, 200 ms deadline |
| Causality | Every prefix check passes |
| Cost | At most 25% of real time; per-chunk p99 at most 10 ms |

**Exit to real audio:** one frozen candidate passes rung 7 and every earlier rung.
Real-audio development then resumes on the Winner clip under
[sync-proxy development 1](sync-proxy-development-1.md), with that document's Winner,
then Dust, then longer windows progression. The ladder stays as regression evidence.

## The scoreboard

Every candidate version runs the whole scoreboard, never a hand-picked part of it:

- **Every rung built so far**, development seeds, judged by the exact-label
  following instrument. Its v1 lineage judges generator labels. If polyphonic labels
  need a schema change, that is a new instrument version with its own hand-worked
  oracle cases, built before any candidate is judged on it.
- **Recognition at supplied labels**, the experiment 003 method, as a standing
  component measure. On synthetic rungs the supplied alignment is exact, so it
  separates hearing the right passage from choosing the right path.
- **The real Winner clip** under `sync-proxy-evaluator@1`. This is a thermometer:
  recorded on every run to show when synthetic progress starts to carry over,
  never used to select a candidate, set a range or declare a rung passed.

No experiment introduces an evaluator of its own. The instruments are the exact-label
following instrument, the sync-proxy evaluator for the thermometer, the recognition
diagnostic, and the v2 instrument, which belongs to qualification.

## Candidates

- **Floor:** `clock-follower@1`, unchanged.
- **First question:** rerun the frozen `spectral-follower@1` and `@2` on rung 0.
  A candidate that fails clean, exact audio has a tracking defect, and that answer
  reinterprets experiment 002 without changing it.
- **Comparator:** a causal online time-warping follower after
  [Dixon 2005](../research/dixon-2005-online-alignment.md), with onset-emphasised
  spectral features, aligning the incoming audio against a fixed rendering of the
  intended score. The score is the listener's input, so rendering it is permitted.
  The fuzz recipe, the labels and the thermometer's sync are not. The reference
  rendering is fixed and does not change with the rung. Home-grown candidates are
  compared with this, not only with the clock.

## Budget and stopping

Development iterations are not rationed: a candidate version costs one scoreboard
run, and nothing on this tier is retained. What is rationed is what would weaken a
later claim or spend someone else's judgement:

- **Reserved and final evidence** stay under contract 1 and are never consulted here.
- **Requests to the user** are limited to loosening this contract, qualification
  decisions and evidence the loop cannot produce itself.
- **Research** stays bounded: each search answers one recorded question with a note.

**Plateau:** three successive candidate versions without a gain on the current rung's
failing gate trigger one bounded research refresh. Three more without a gain stop the
ladder, and the loop reports the limit to the user with the scoreboard evidence.

## Records

One numbered experiment is one file, `reports/NNN-slug.md`. Its pre-registration
section is committed before the run: question, rung, candidates, prediction and what
would contradict it. Results are appended after the run in the same file. The
experiment adds one ledger row, one run summary per scoreboard run and one row in
the report registry that the shared exporter reads. It does not add a contract file
or an exporter of its own.

## Effect on existing records

- The open question "can attack-sensitive features and short sequence evidence
  distinguish passages" on the real Winner clip is **abandoned**, not tried. Its idea
  survives in the comparator, which is first tested on the ladder.
- [Sync-proxy development 1](sync-proxy-development-1.md) is paused as development
  evidence until the ladder exits. Its evaluator continues as the thermometer.
- In research contract 1, the budget of six candidate versions and twelve assessments
  now counts candidates frozen for qualification and their qualification assessments,
  not development iterations. Its reserved-access, final-acceptance and technical-rerun
  rules are unchanged. The qualification driver in the bench implements that tier.
- Experiments 001–003, their runs, plans and frozen code are unchanged.
