// Six coupled string waveguides and a shared modal radiation model.
// The host supplies six independent seeded noise streams; no sampled audio.
import("stdfaust.lib");
declare name "Guitar laboratory";
declare author "Guitar Faust project";

decay = hslider("decay", 4, 0.05, 60, 0.01);
brightness = hslider("brightness", 0.65, 0, 1, 0.001);
dispersion = hslider("dispersion", 0.12, 0.001, 0.65, 0.001);
coupling = hslider("coupling", 0.002, 0, 0.02, 0.0001);
release = hslider("release", 0.08, 0.015, 0.5, 0.001);
pickup = hslider("pickup", 0.18, 0.04, 0.45, 0.001);
electric = hslider("electric", 0, 0, 1, 0.01);
bodyMix = hslider("body_mix", 0.6, 0, 1, 0.01);
pluckBody = hslider("pluck_body", 0.30, 0, 4, 0.01);
pickTexture = hslider("pick_texture", 0.7, 0, 8, 0.01);

freq(i) = hslider("s%i-frequency", 110, 60, 1400, 0.001);
position(i) = hslider("s%i-position", 0.2, 0.01, 0.49, 0.001);
velocity(i) = hslider("s%i-velocity", 0.7, 0, 1, 0.001);
hardness(i) = hslider("s%i-hardness", 0.6, 0.025, 40, 0.001);
trigger(i) = button("s%i-trigger");
sustain(i) = hslider("s%i-sustain", 0, 0, 1, 0.001);
decayScale(i) = hslider("s%i-decay_scale", 1, 0.4, 1.6, 0.001);

// Symmetric FIR: exactly one sample of phase delay, frequency-dependent loss.
loss(b,x) = (1+b)*0.5*x' + (1-b)*0.25*(x+x'');
comb(d,x) = x - de.fdelay4(4096, max(2,d), x);
// At very short, newly exposed pluck distances use causal linear interpolation
// instead of flattening every position below two samples to the same comb.
pluckComb(p,period,x) = select2((p<0.04)&(p*period<2),
    comb(p*period,x), x-de.fdelay(4096,max(0,p*period),x));

string(i, feedback, noise) =
    (rho*feedback + excitation) : fi.tf1(a,1,a) : loss(brightness)
    : de.fdelay4(4096, max(4, period - 2 - apDelay))
with {
    f = freq(i);
    period = ma.SR/f;
    // Allpass dispersion is a controllable approximation to stiff strings.
    a = -dispersion*(1.0 - 0.06*i);
    w = 2*ma.PI*f/ma.SR;
    apDelay = 2*atan(((1-a)/(1+a))*tan(w/2))/w;
    held = sustain(i) : si.smooth(ba.tau2pole(0.003));
    t60 = release + held*(decay*decayScale(i)-release);
    rho = pow(0.001, 1/(f*t60));
    // Retain a little contact noise, with the original pluck-position comb.
    hard = hardness(i);
    softScale = min(1,hard/0.1);
    hardScale = max(1,hard);
    cutoff = min(0.45*ma.SR,(900+12000*max(0.1,min(1,hard)))*softScale*hardScale);
    contactTime = (0.0015+0.002*(1-max(0.1,min(1,hard))))/softScale/hardScale;
    contact = noise : fi.lowpass(2, cutoff)
      : *(en.ar(0.0003/softScale/hardScale, contactTime, trigger(i)))
      : pluckComb(position(i),period);
    // Fill one round trip with an odd extension of a triangular displacement.
    // Positive and mirrored negative halves give zero mean and a stronger
    // fundamental, with the pluck-position harmonic nulls already in the shape.
    // This initializes our single-loop approximation over one period; it is
    // not an exact instantaneous two-rail waveguide initialization.
    hit = trigger(i) > trigger(i)';
    pluckPeriod = period : ba.sAndH(hit);
    pluckPosition = position(i) : ba.sAndH(hit) : max(0.01);
    age = ba.countup(4096, hit);
    phase = min(1, age/max(8,pluckPeriod));
    x = min(2*phase, 2-2*phase);
    triangle = min(x/pluckPosition, (1-x)/(1-pluckPosition));
    profile = triangle*(1-2*(phase>=0.5))*(age<pluckPeriod)*(pluckPeriod>0);
    displacement = profile : fi.lowpass(2, cutoff);
    // Independent excitation layers: fullness never turns off pick contact.
    excitation = velocity(i)*0.18*(pickTexture*contact + pluckBody*0.5*displacement);
};

// Convex scattering mixes circulating waves without increasing their max norm.
// Each string then applies its own loss; inactive strings remain available
// for sympathetic motion but their finger damping still applies.
scatter(x0,x1,x2,x3,x4,x5) =
    mix(x0),mix(x1),mix(x2),mix(x3),mix(x4),mix(x5)
with {
    mean = (x0+x1+x2+x3+x4+x5)/6;
    mix(x) = (1-coupling)*x + coupling*mean;
};
bank(f0,f1,f2,f3,f4,f5,e0,e1,e2,e3,e4,e5) =
    string(0,f0,e0), string(1,f1,e1), string(2,f2,e2),
    string(3,f3,e3), string(4,f4,e4), string(5,f5,e5);
strings = bank ~ scatter;

observe(i,x) = (1-electric)*x + electric*comb(pickup*ma.SR/freq(i),x);
mode(i) = pm.modeFilter(
    hslider("m%i-freq", 200, 50, 8000, 0.1),
    hslider("m%i-t60", 0.12, 0.005, 4, 0.001),
    hslider("m%i-gain", 0.5, 0, 8, 0.001)
    // Normalize modal peak approximately; pm.modeFilter alone is unnormalized.
    * (1-pow(0.001, 1/(ma.SR*hslider("m%i-t60",0.12,0.005,4,0.001)))));
// A broadband radiation bed remains at every body setting. The previous
// crossfade to isolated modes removed most frequencies between resonances.
// This is a designed response, not a measured bridge-to-pressure transfer.
// Fixed feed-forward makeup avoids an envelope follower pumping the decay.
body(x) = (x + 1.25*bodyMix*(x <: par(i,12,mode(i)) :> _))/(1+0.4*bodyMix);
// Output: rumble high-pass and a fixed 18 kHz top. Saturation, tone and room are
// the chain's blocks now (Drive, the Room bus), not part of the instrument.
output = fi.highpass(2,45) : fi.lowpass(2,18000) <: _,_;
mixdown = par(i,6,observe(i)) :> *(0.4);
// Outputs: stereo presentation, dry mono, six diagnostic string signals.
process = strings <: (mixdown <: (body : output),_), si.bus(6);
