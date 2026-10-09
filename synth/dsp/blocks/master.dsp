// Master: volume, then a look-ahead peak limiter, so the output never exceeds the ceiling.
// Third output: the limiter gain (≤ 1). Signed off by the lead on 2026-10-09 (roadmap
// core-synth-performance, while listening to the step 1 thwack):
// - look-ahead: the audio is delayed 3 ms and the gain eases down across that window, so it
//   is already reduced when a peak arrives and never jumps inside a waveform's cycle (the
//   previous limiter's instant attack flattened the tops of loud attacks);
// - soft knee: g = 1/(1+(peak/ceiling)^8)^(1/8) keeps peak·g below the ceiling and starts
//   reducing about 2 dB below it (−0.06 dB at −3 dB, −0.75 dB at the ceiling);
// - two-stage release: a fast stage (`release`, 60 ms) lets go after a single loud attack,
//   a slow stage (0.4 s in, 1 s out) holds the average reduction through loud passages, so
//   the gain does not pump between strums. The reduction is the larger of the two.
import("stdfaust.lib");
declare name "Master";
volume = hslider("volume",-3,-60,12,.1) : ba.db2linear : si.smooth(ba.tau2pole(0.02));
ceiling = hslider("ceiling",-1,-24,0,.1) : ba.db2linear;
release = hslider("release",.06,.01,2,.01);
MAXN = 512;
N = max(1,int(0.003*ma.SR));
process(l,r) = da*g, db*g, g with {
    a = l*volume; b = r*volume;
    da = a : de.delay(MAXN,N); db = b : de.delay(MAXN,N);
    // The loudest sample that will reach the output within the look-ahead.
    peak = max(abs(a),abs(b)) : ba.slidingMax(N+1,MAXN);
    // x*max(0,x) keeps FAUST from turning the squares into pow calls.
    sq(x) = x*max(0,x);
    reduction = 1 - 1/sqrt(sqrt(sqrt(1+sq(sq(sq(peak/ceiling))))));
    fast = reduction : max ~ *(exp(-1/(release*ma.SR)));
    slow = reduction : (follow ~ _)
    with {
        follow(previous,x) = previous+(x-previous)*select2(x>previous,
            1-exp(-1/(1.0*ma.SR)),1-exp(-1/(0.4*ma.SR)));
    };
    // Averaging the reduction (not the gain) starts from no reduction, not from silence.
    eased = 1 - (max(fast,slow) : ba.slidingMeanp(N,MAXN));
    // A safety net that never acts unless rounding lets a sample through.
    g = min(eased, ceiling/max(1e-9,max(abs(da),abs(db))));
};
