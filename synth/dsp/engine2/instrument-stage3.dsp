// Isolated excitation experiment. Stage 2's circulating-wave core is retained;
// the additive injection never clears a ringing delay line or filter state.
import("stdfaust.lib");
b=component("guitar.dsp");
p=component("instrument-stage1.dsp");
s=component("instrument-stage2.dsp");
declare name "Guitar contact and release prototype";

contactWidth=hslider("contact_width",0.025,0,0.2,0.001);
releaseTime=hslider("pluck_release_time",0.0004,0.00003,0.02,0.00001);
textureColour=hslider("texture_colour",0.7,0,1,0.001);
velocityTone=hslider("velocity_tone",0.35,0,1,0.001);
attackTrial=hslider("attack_trial",0,0,3,1);
attackAmount=hslider("attack_amount",0.65,0,1,0.001);
attackString=hslider("attack_string",-1,-1,5,1);

// A unit-DC-gain exponential spatial blur. Its length scale is a fraction of
// the round-trip period, unlike release time measured in fixed seconds. This
// compact candidate replaces the costlier three-point blur; that candidate is
// retained for comparison. Every frozen blur response is non-amplifying.
hold(hit,x)=x : ba.sAndH(hit);
// Linear contact interpolation preserves position-dependent comb notches
// approximately, without a per-sample fourth-order interpolation polynomial.
heldDelay1(hit,d,x)=de.delay(4096,id,x)*(1-frac)+de.delay(4096,id+1,x)*frac
with { id=hold(hit,int(d)); frac=hold(hit,ma.frac(d)); };
blur(hit,d,x)=x : *(1-pole) : fi.pole(pole)
with { pole=hold(hit,select2(d>0,0,exp(-1/max(0.001,d)))); };
// s%i-excite gates the excitation's computation (FAUST enable, per compute call). The host
// turns it on at each pluck and off after the attack window (plucked-plan.js), when its
// filters hold less than -150 dB; by default it is always on. The latched velocity stays
// outside the gate: a sample-and-hold inside an enable compiles differently in FAUST 2.81.
// enable() holds its last value while off; the product makes the idle excitation exactly 0.
excite(i)=hslider("s%i-excite",1,0,1,1);
excitation(i,noise)=v*0.18*(enable(texture*contact+fullness*0.5*displacement+knock,excite(i))*excite(i))
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
    forceColour=velocityTone*(1-b.velocity(i));
    // Hardness remains an explicit macro over width and release. Separate
    // inspector values scale that macro; there is no hidden output gain boost.
    targetWidth=min(0.25,contactWidth*sqrt(0.6/hard)*(1+0.8*forceColour));
    targetTau=min(0.04,releaseTime*0.6/hard*(1+2*forceColour));
    tau=latch(targetTau);
    // Compute nonlinear coefficient functions before sample-and-hold: FAUST
    // then evaluates them at the control rate, not once per audio sample.
    pole=latch(exp(-1/(ma.SR*max(0.00003,targetTau))));
    noisePole=latch(exp(-2*ma.PI*min(0.4*ma.SR,700+14000*textureColour)/ma.SR));
    release=*(1-pole) : fi.pole(pole) : *(1-pole) : fi.pole(pole);
    age=ba.countup(4096,hit);
    phase=min(1,age*inversePeriod);
    x=min(2*phase,2-2*phase);
    triangle=min(x*inversePos,(1-x)*inverseComplement);
    profile=triangle*(1-2*(phase>=0.5))*(age<period)*(period>0);
    trial=latch(attackTrial);
    amount=latch(attackAmount);
    displacement=profile : blur(hit,targetWidth*ma.SR/b.freq(i)) : release;
    // Trial 2: brief decaying two-band contact knock injected into the string.
    // Fixed-time scale, independent of Texture/fullness, and v^2 overall.
    // No nonlinear feedback, persistent drive, or spontaneous excitation.
    seconds=age/ma.SR;
    knock=(trial==2)*((latch(attackString)==-1)|(latch(attackString)==i))*amount*v*0.65*(sin(2*ma.PI*980*seconds)+0.45*sin(2*ma.PI*2450*seconds))
        *exp(-seconds/0.0035)*(seconds<0.025);
    contact=noise : *(1-noisePole) : fi.pole(noisePole)
        : *(en.ar(0.0002,0.001+2*tau,b.trigger(i)))
        : comb : blur(hit,targetWidth*ma.SR/b.freq(i)) : release;
    targetComb=targetPos*max(8,ma.SR/b.freq(i));
    comb(x)=x-heldDelay1(hit,targetComb,x);
};

// Frozen Stage 2 loss/dispersion and motion equations. Keeping the experiment
// isolated avoids silently changing Stage 1/2 comparison assets. These will be
// unified into one core during versioned adoption, not shipped as three engines.
loop(i,axis,feedback,noise)=
    (feedback+initialGain*excitation(i,noise)) : fi.tf1(a,1,a)
    : fi.tf1(b0,b1,-pole) : *(initialLoss)
    : de.fdelay4(4096,max(4,period-1-apDelay-shelfDelay))
with {
    f=b.freq(i)*pow(2,(2*axis-1)*s.beating*s.beatingScale(i)/2400);
    period=ma.SR/f;
    w=2*ma.PI*f/ma.SR;
    initialGain=hold(b.trigger(i)>b.trigger(i)',sqrt(select2(axis,1-dir,dir)));
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
    low=lowTarget : si.smooth(ba.tau2pole(0.003));
    high=highTarget : si.smooth(ba.tau2pole(0.003));
    b0=high+(low-high)*(1-pole)/2;
    b1=-high*pole+(low-high)*(1-pole)/2;
    shelfDelay=atan((lowTarget-highTarget)*t/max(1e-12,lowTarget+highTarget*t*t))/w;
    muteGain=min(1,pow(0.001,1/(f*b.release))/max(1e-12,max(lowTarget,highTarget)));
    fingerGain=(muteGain+(1-muteGain)*b.sustain(i)) : si.smooth(ba.tau2pole(0.003));
    hit=b.trigger(i)>b.trigger(i)';
    age=ba.countup(100000000,hit);
    initialEnvelope=max(0,1-age/(ma.SR*p.initialTime));
    initialLoss=(1-(1-pow(0.001,p.initialDamping/(f*0.1)))*initialEnvelope)*fingerGain;
};
bank(f00,f01,f10,f11,f20,f21,f30,f31,f40,f41,f50,f51,e0,e1,e2,e3,e4,e5)=
    loop(0,0,f00,e0),loop(0,1,f01,e0),loop(1,0,f10,e1),loop(1,1,f11,e1),
    loop(2,0,f20,e2),loop(2,1,f21,e2),loop(3,0,f30,e3),loop(3,1,f31,e3),
    loop(4,0,f40,e4),loop(4,1,f41,e4),loop(5,0,f50,e5),loop(5,1,f51,e5);
strings=(bank ~ s.scatter) : par(i,6,s.project);
mixdown=par(i,6,b.observe(i)) :> *(0.4);
process=strings <: (mixdown <: (b.body : b.output),_),si.bus(6);
