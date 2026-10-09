// Engine2 guitar, stage 7: the attack soak (roadmap core-synth-performance, step 1). Twelve
// string loops (six strings, two polarisations) through the bridge, observed by the pickups,
// radiated by the body modes. It replaced stage 6 and its thwack (a knock waveform rendered
// by a full shadow engine per pluck).
// A hard pluck is not a loud soft pluck: its extra energy is soaked up quickly, sounding
// through the body as it goes, and what is left rings like a softer pluck. Each string
// carries an envelope v²·exp(-age/time), latched at its pluck, which
//   - drains the string (an extra loop loss, `thwack_soak` dB at velocity 1, more in the treble),
//   - and sends the string's own signal to the design's body modes while it drains, so the
//     body tone is pitched with the note and levelled relative to it in any design.
// The pitch glide of a hard pluck is the planner's tension law (setup.tensionCents), not here.
import("stdfaust.lib");
b=component("guitar.dsp");
p=component("instrument-stage1.dsp");
s=component("instrument-stage2.dsp");
e=component("instrument-stage3.dsp");
r=component("instrument-stage4.dsp");
j=component("instrument-bridge.dsp");
k=component("instrument-pickups.dsp");
declare name "Guitar attack soak";

soak=hslider("thwack_soak",0,0,24,0.01);         // extra loss at velocity 1, dB over the soak
soakTime=hslider("thwack_time",0.12,0.02,0.5,0.001);
soakBody=hslider("thwack_body",0,0,4,0.001);     // body tone from the soaked signal
soakTreble=hslider("thwack_treble",2,1,4,0.01);  // treble soaks this many times faster
// Set by the host from the design's body resonances (plucked-body.js), so one thwack_body
// setting gives the same average body tone in every design.
soakBodyTrim=hslider("thwack_body_trim",1,0.0625,16,0.0001);

// The soak envelope: v² at the pluck, then exp(-age/time). Two operations per sample.
soakEnvelope(i)=+(hit*v*v)~*(decay*(1-hit))
with {
    hit=b.trigger(i)>b.trigger(i)';
    v=b.velocity(i);
    decay=exp(-1/(ma.SR*soakTime));
};
// Loss per pass round the loop such that the envelope removes `soak` dB at velocity 1: a
// wave meets the loss f times a second, not once per sample, so it is per string.
drain(i)=min(0.5,soak/(8.685889*soakTime*b.freq(i)));

// The Stage 3 excitation without the trial knock.
excitation(i,noise)=v*0.18*(enable(texture*contact+fullness*0.5*displacement,e.excite(i))*e.excite(i))
with {
    hit=b.trigger(i)>b.trigger(i)';
    latch(x)=x : ba.sAndH(hit);
    v=latch(b.velocity(i));
    hard=max(0.025,b.hardness(i));
    period=latch(ma.SR/b.freq(i));
    targetPos=max(0.01,b.position(i));
    inversePos=latch(1/targetPos);
    inverseComplement=latch(1/(1-targetPos));
    inversePeriod=latch(1/max(8,ma.SR/b.freq(i)));
    fullness=latch(b.pluckBody);
    texture=latch(b.pickTexture);
    forceColour=e.velocityTone*(1-b.velocity(i));
    targetWidth=min(0.25,e.contactWidth*sqrt(0.6/hard)*(1+0.8*forceColour));
    targetTau=min(0.04,e.releaseTime*0.6/hard*(1+2*forceColour));
    tau=latch(targetTau);
    pole=latch(exp(-1/(ma.SR*max(0.00003,targetTau))));
    noisePole=latch(exp(-2*ma.PI*min(0.4*ma.SR,700+14000*e.textureColour)/ma.SR));
    release=*(1-pole) : fi.pole(pole) : *(1-pole) : fi.pole(pole);
    age=ba.countup(4096,hit);
    phase=min(1,age*inversePeriod);
    x=min(2*phase,2-2*phase);
    triangle=min(x*inversePos,(1-x)*inverseComplement);
    profile=triangle*(1-2*(phase>=0.5))*(age<period)*(period>0);
    displacement=profile : e.blur(hit,targetWidth*ma.SR/b.freq(i)) : release;
    contact=noise : *(1-noisePole) : fi.pole(noisePole)
        : *(en.ar(0.0002,0.001+2*tau,b.trigger(i)))
        : comb : e.blur(hit,targetWidth*ma.SR/b.freq(i)) : release;
    targetComb=targetPos*max(8,ma.SR/b.freq(i));
    comb(x)=x-e.heldDelay1(hit,targetComb,x);
};

// The string loop (stage 5's, with the bridge's phase lead); the soak scales the loss shelf's two targets (the treble faster). Both are
// already per-sample signals (smoothed controls), so this adds two multiplies per loop.
loop(i,axis,feedback,noise)=
    (feedback+initialGain*excitation(i,noise)) : fi.tf1(a,1,a)
    : fi.tf1(b0,b1,-pole) : *(initialLoss)
    : de.fdelay4(4096,max(4,period-1-apDelay-shelfDelay+j.phaseLead(i,f)))
with {
    f=b.freq(i)*pow(2,(2*axis-1)*s.beating*s.beatingScale(i)/2400);
    period=ma.SR/f;
    w=2*ma.PI*f/ma.SR;
    initialGain=e.hold(b.trigger(i)>b.trigger(i)',sqrt(select2(axis,1-dir,dir)));
    dir=hslider("s%i-pluck_direction",0.5,0,1,0.001);
    factor=select2(axis,1,s.lossRatio);
    a=(0-min(0.65,b.dispersion*p.stiffnessScale(i)))*(1-0.06*i);
    apDelay=2*atan(((1-a)/(1+a))*tan(w/2))/w;
    bassT60=b.decay*b.decayScale(i)*factor;
    trebleT60=p.trebleDecay*p.trebleScale(i)*factor;
    rho=pow(0.001,1/(f*bassT60));
    highTarget=pow(0.001,1/(f*trebleT60));
    cutoff=min(0.4*ma.SR,max(4*f,(4+12*b.brightness)*f*p.lossProfile(i)));
    k=tan(ma.PI*cutoff/ma.SR);
    pole=(1-k)/(1+k);
    t=tan(w/2)/k;
    lowTarget=min(1,sqrt(max(0,rho*rho*(1+t*t)-highTarget*highTarget*t*t)));
    soaked=drain(i)*soakEnvelope(i);
    low=(lowTarget : si.smooth(ba.tau2pole(0.003)))*max(0,1-soaked);
    high=(highTarget : si.smooth(ba.tau2pole(0.003)))*max(0,1-soakTreble*soaked);
    b0=high+(low-high)*(1-pole)/2;
    b1=-high*pole+(low-high)*(1-pole)/2;
    shelfDelay=atan((lowTarget-highTarget)*t/max(1e-12,lowTarget+highTarget*t*t))/w;
    muteGain=min(1,pow(0.001,1/(f*b.release))/max(1e-12,max(lowTarget,highTarget)));
    fingerGain=(muteGain+(1-muteGain)*j.available(i)) : si.smooth(ba.tau2pole(0.003));
    hit=b.trigger(i)>b.trigger(i)';
    age=ba.countup(100000000,hit);
    initialEnvelope=max(0,1-age/(ma.SR*p.initialTime));
    initialLoss=(1-(1-pow(0.001,p.initialDamping/(f*0.1)))*initialEnvelope)*fingerGain;
};
bank(f00,f01,f10,f11,f20,f21,f30,f31,f40,f41,f50,f51,e0,e1,e2,e3,e4,e5)=
    loop(0,0,f00,e0),loop(0,1,f01,e0),loop(1,0,f10,e1),loop(1,1,f11,e1),
    loop(2,0,f20,e2),loop(2,1,f21,e2),loop(3,0,f30,e3),loop(3,1,f31,e3),
    loop(4,0,f40,e4),loop(4,1,f41,e4),loop(5,0,f50,e5),loop(5,1,f51,e5);
strings=(bank ~ j.scatter) : par(i,6,s.project);

// What the soak takes from each string sounds through the design's 12 body modes (Stage 4's
// resonators); at 1 it is about +6 dB on a full-strength pluck's first 50 ms. Not computed
// while thwack_body is 0, nor while nothing is soaking: once every string's envelope is
// under 1e-5 of a full-strength pluck the resonators (which decay faster than the envelope)
// are some 90 dB down. Paused, the body is exactly 0 (enable would hold its last sample).
soaking=(soakEnvelope(0)+soakEnvelope(1)+soakEnvelope(2)+soakEnvelope(3)+soakEnvelope(4)+soakEnvelope(5))>1e-5;
// A string the hand damps (a dead or palm-muted note, or a note-off) loses its extra energy
// into the hand, not the body: each send is scaled by how free the string is to ring (the
// loop's own finger damping), smoothed so a note-off does not click.
send(i,x)=x*soakEnvelope(i)*(j.available(i) : si.smooth(ba.tau2pole(0.003)));
body(a0,a1,a2,a3,a4,a5)=4*soakBody*soakBodyTrim*on*enable((send(0,a0)+send(1,a1)+send(2,a2)
    +send(3,a3)+send(4,a4)+send(5,a5)) <: par(i,12,r.radiationMode(i)) :> _,on)
with { on=(soakBody>0)*soaking; };
present=si.bus(6) <: (k.mixdown,body) :> _ <: (r.radiation(24) : b.output),_;
process=strings <: (present,si.bus(6));
