// Radiation-only experiment. No part of this filter enters string feedback.
// Count comparisons will compile radiation(24), radiation(36), radiation(48).
import("stdfaust.lib");
b=component("guitar.dsp");
s=component("instrument-stage3.dsp");
declare name "Guitar radiation family prototype";

bodySize=hslider("body_size",1,0.6,1.8,0.001);
lowWeight=hslider("body_low_weight",1,0,2,0.001);
bodyDamping=hslider("body_damping",1,0.25,4,0.001);
breadth=hslider("body_breadth",1,0.5,3,0.001);
legacyFrequency(i)=hslider("m%i-freq",200,50,8000,0.1);
legacyDecay(i)=hslider("m%i-t60",0.12,0.005,4,0.001);
legacyGain(i)=hslider("m%i-gain",0.5,0,8,0.001);

// A damped two-state rotation, rather than a time-varying direct-form
// resonator. With no input its state norm contracts by r regardless of the
// frequency trajectory. The cosine impulse response has positive real part
// on the unit circle, so positive modal gains cannot cancel the direct bed in
// a frozen transfer response. Tests must also check float32 implementation.
radiationMode(i,x)=x : (inject ~ rotate) : (_,!) : *(gain*referenceLoss)
with {
    family=i%12;
    bank=int(i/12);
    frequency=min(0.42*ma.SR,legacyFrequency(family)*(1+0.47*bank+0.025*bank*(family%3))/bodySize);
    upperWeight=min(1,frequency/1400);
    referenceDuration=legacyDecay(family)/(1+0.4*bank);
    duration=referenceDuration/bodyDamping
        /max(0.25,1+(breadth-1)*upperWeight);
    r=pow(0.001,1/(ma.SR*duration));
    // Anchor gain to the seed, not the edited damping. Using (1-r) here
    // compensated the very resonance reduction that Damping should cause.
    // Breadth now changes width/decay without hidden peak-gain restoration.
    referenceLoss=1-pow(0.001,1/(ma.SR*referenceDuration));
    c=cos(2*ma.PI*frequency/ma.SR);
    t=sin(2*ma.PI*frequency/ma.SR);
    rc=r*c;
    rt=r*t;
    gain=legacyGain(family)*select2(family<3,1,lowWeight);
    inject(u,v,input)=(input+u,v);
    rotate(u,v)=rc*u-rt*v,rt*u+rc*v;
};
// Keep total modal weight comparable as count changes. Raw gain varies by
// pitch and family; optional fixed audition matching belongs in the host.
// Not computed at all while the body mix is zero (every factory design): exactly x.
radiation(count,x)=(x+5*b.bodyMix*(12.0/count)
    *enable((x <: par(i,count,radiationMode(i)) :> _),b.bodyMix>0))/(1+0.4*b.bodyMix);
process=s.strings <: (s.mixdown <: (radiation(24) : b.output),_),si.bus(6);
