# Player expression conventions

`audio/expression.ts` interprets marks after traversal and tie merging, before string
re-strikes truncate sounding gates. It changes sounding events, never written cursor
spans or sounded `note.pitch`. Its inputs and results remain pure and Node-safe.
These numbers are MNX Lab playback conventions, not requirements of MNX.

1. **Dynamics.** The velocity ladder is pppppp=8, ppppp=16, pppp=24, ppp=32,
   pp=44, p=56, mp=68, mf=80, f=96, ff=108, fff=116, ffff=120,
   fffff=124, ffffff=127, niente=0. Default mf is 80. Values are rounded and
   clamped to 0–127. Immediate marks persist in written order; each performed
   occurrence looks up the state at its written start, so repeats and jumps restore
   it. Staff and named-voice restrictions select applicable marks. At the same
   position, more specific marks follow general marks; authored order breaks ties.
2. **Accents and hairpins.** Accent dynamics affect onsets at their exact written
   position; their residual value persists. sfz uses f=96 for that onset. Explicit
   SMuFL ladder glyphs and the conventional sforzato/rinforzando/fp families have
   the same numeric interpretation. Unrecognized glyphs produce diagnostics.
   Relative louder/softer changes velocity by ±12. A bounded hairpin interpolates
   onset velocity in written metric time toward its value, or ±20 without a value;
   a subsequent dynamic interrupts it. Cross-bar ends resolve global measure ids
   and use compiler measure lengths. Missing/unresolved ends are diagnosed.
3. **Articulations.** Staccato halves an untied sounding gate. Tenuto retains the
   full gate (the baseline has no artificial gap). Accent adds 20 velocity.
   Staccato wins if combined with tenuto; ties keep continuity. Other articulation
   names are explicitly diagnosed as unsupported. A merged tie takes expression
   from its attack; techniques on continuations are diagnosed rather than silently
   reinterpreted. Tremolo alternates +4/−4 on its original subdivision index,
   including both members of a two-note tremolo and sliced traversal entries.
4. **Arpeggios.** Roll the marked chord pitch span upward by default, downward for
   `down`, by 1/64 whole note per note. Preserve each release time. A gate too short
   for its delay uses duration × index/count and reports compression. Missing
   endpoints are diagnosed. Non-arpeggio brackets leave simultaneous onsets.
5. **Bends and slides.** Bend `alter × 100` gives cents; decimal position is read
   exactly from its decimal spelling and multiplied by the sounding gate. A
   nonzero initial point is a pre-bend; descending points release. Points must be
   finite and within 0–1. Target slides cover the last quarter of the source gate;
   slide-in starts at ∓200 cents and reaches zero after the first quarter;
   slide-out reaches ±200 cents at release. Up is the default. Bend and slide
   curves add. A re-strike truncates playback of a curve, preserving its original
   progression rather than stretching it into the shorter gate.
6. **Legato.** Hammer/pull and legato-slide references must resolve to the next
   contiguous occurrence on the same declared string voice. Unresolved targets,
   gaps, intervening attacks and cross-string targets are diagnosed. The source
   reaches the target onset; the target has `noReattack`, and a hammer/pull target
   loses 25 velocity. Thus sounding entries include logical transitions as well
   as attacks. Transport changes pitch and amplitude while preserving phase,
   resets the source bend, and reconstructs an attack when seeking into a target.
7. **Palm mute and vibrato.** Palm mute multiplies gate length by 3/5, subtracts 15
   velocity and sets `damped`. Vibrato starts one quarter into the gate, lasts the
   remaining three quarters, and has depth ±30 cents and period 1/10 whole note.
   Tempo and transport rate convert that rational period to audio time.
8. **Harmonics.** Preserve sounded pitch, subtract 10 velocity, emit the harmonic
   timbre hint. Only natural harmonics with known string and touching pitch get
   a consistency check: capo-adjusted open pitch plus common touching intervals
   12/7/5/4 correspond to sounded intervals 12/19/24/28 (0.15-semitone tolerance).
   Unknown nodes, missing metadata and artificial/pinch/tap/semi/feedback types
   report unsupported validation. Artificial harmonics do not use open-string
   arithmetic. Inconsistency is diagnostic and never changes pitch. Conformance
   pins natural/artificial, capo, missing string/touching metadata, and the corpus's
   already resolved harmonic pitches.

The native sink renders harmonic hints with a triangle oscillator; its fundamental
stays the sounded pitch. Other notes use sine. Legato keeps the attack's patch until a new attack;
changing oscillator type while scheduling would retroactively change earlier audio. Palm mute's audible change is already
encoded in velocity and gate; the sink receives its flag for future patches. This is
a simple review patch, not a sampled guitar. Legato amplitude changes use the existing
5 ms smoothing. To preserve an incoming ramp across an instantaneous bend reset,
the native adapter places its final incoming endpoint one sample before the step;
no performance time is changed.

MIDI omits zero-velocity events with a silent-note diagnostic. It exports numeric velocity, duration and independent string pitch curves within
±12 semitones, with clipping diagnostics. It retriggers logical legato targets and
omits harmonic/damped timbre hints, explicitly reported per affected event. This is
still a bounded export, not an independent musical oracle.

`expression.test.ts` pins hand-stated values and compiled transport behavior.
`smoke:audio` measures a compiled bend/hammer, attenuation, harmonic third partial
and palm-mute release in an OfflineAudioContext. The existing `/verify` performance
page exposes velocity, curves and flags alongside Listen and the written engraving.
The [expression review batch](../roadmap/inprogress/lab-verify.md#player-expression--2026-09-09)
requires human review; passing automated checks grants no approval.
