// Master: volume, then a peak limiter with instant attack and exponential release,
// so the output never exceeds the ceiling. Third output: the limiter gain (≤ 1).
import("stdfaust.lib");
declare name "Master";
volume = hslider("volume",-3,-60,12,.1) : ba.db2linear : si.smooth(ba.tau2pole(0.02));
ceiling = hslider("ceiling",-1,-24,0,.1) : ba.db2linear;
release = hslider("release",.15,.01,2,.01);
process(l,r) = a*g, b*g, g with {
    a = l*volume; b = r*volume;
    rc = exp(-1/(release*ma.SR));
    env = max(abs(a),abs(b)) : (max ~ *(rc));
    g = min(1, ceiling/max(env,1e-9));
};
