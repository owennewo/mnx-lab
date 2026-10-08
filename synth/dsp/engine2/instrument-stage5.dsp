// Isolated loading/sympathy experiment. Radiation stays strictly feed-forward.
import("stdfaust.lib");
b=component("guitar.dsp");
p=component("instrument-stage1.dsp");
s=component("instrument-stage2.dsp");
e=component("instrument-stage3.dsp");
r=component("instrument-stage4.dsp");
j=component("instrument-bridge.dsp");
declare name "Guitar passive bridge prototype";

// Keep intrinsic loss and excitation unchanged. Only the termination and
// availability law differ from Stage 3/4; bridge loss is not folded into the
// string T60 a second time. Report intrinsic and achieved loaded decay apart.
loop(i,axis,feedback,noise)=
    (feedback+initialGain*e.excitation(i,noise)) : fi.tf1(a,1,a)
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
    low=lowTarget : si.smooth(ba.tau2pole(0.003));
    high=highTarget : si.smooth(ba.tau2pole(0.003));
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
process=strings <: (e.mixdown <: (r.radiation(24) : b.output),_),si.bus(6);
