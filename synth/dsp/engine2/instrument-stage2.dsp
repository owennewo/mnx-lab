// Isolated two-component motion prototype, built on Stage 1's loss design.
// Exchange and shared-axis scattering are convex contractions. Radiation stays
// outside feedback. Neutral: equal loss, zero beating/exchange, direction 0.5.
import("stdfaust.lib");
b=component("guitar.dsp");
p=component("instrument-stage1.dsp");
declare name "Guitar two-component motion prototype";

beating=hslider("beating_cents",1.2,0,12,0.001);
exchange=hslider("motion_exchange",0.0008,0,0.03,0.00001);
lossRatio=hslider("motion_loss_ratio",0.7,0.35,1.5,0.001);
direction(i)=hslider("s%i-pluck_direction",0.5,0,1,0.001)
  : ba.sAndH(b.trigger(i)>b.trigger(i)');
beatingScale(i)=hslider("s%i-beating_scale",0.65+0.07*i,0,1.5,0.001);

loop(i,axis,feedback,noise) =
    (feedback+initialGain*p.excitation(i,noise)) : fi.tf1(a,1,a)
    : fi.tf1(b0,b1,-pole) : *(initialLoss)
    : de.fdelay4(4096,max(4,period-1-apDelay-shelfDelay))
with {
    f=b.freq(i)*pow(2,(2*axis-1)*beating*beatingScale(i)/2400);
    period=ma.SR/f;
    w=2*ma.PI*f/ma.SR;
    initialGain=sqrt(select2(axis,1-direction(i),direction(i)));
    factor=select2(axis,1,lossRatio);
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

// First mix each polarisation among strings, then exchange between the two
// local components. Both operations preserve or reduce total squared energy
// for their circulating-wave inputs; there is no unrestricted body feedback.
scatter(x00,x01,x10,x11,x20,x21,x30,x31,x40,x41,x50,x51) =
    pair(x00,x01),pair(x10,x11),pair(x20,x21),
    pair(x30,x31),pair(x40,x41),pair(x50,x51)
with {
    mean0=(x00+x10+x20+x30+x40+x50)/6;
    mean1=(x01+x11+x21+x31+x41+x51)/6;
    bridge0(x)=(1-b.coupling)*x+b.coupling*mean0;
    bridge1(x)=(1-b.coupling)*x+b.coupling*mean1;
    pair(x,y)=(1-exchange)*bridge0(x)+exchange*bridge1(y),
              (1-exchange)*bridge1(y)+exchange*bridge0(x);
};
bank(f00,f01,f10,f11,f20,f21,f30,f31,f40,f41,f50,f51,e0,e1,e2,e3,e4,e5) =
    loop(0,0,f00,e0),loop(0,1,f01,e0),loop(1,0,f10,e1),loop(1,1,f11,e1),
    loop(2,0,f20,e2),loop(2,1,f21,e2),loop(3,0,f30,e3),loop(3,1,f31,e3),
    loop(4,0,f40,e4),loop(4,1,f41,e4),loop(5,0,f50,e5),loop(5,1,f51,e5);
// A fixed projection preserves the neutral equal-component amplitude. Pluck
// direction changes projected level by up to 3 dB; retain that raw change and
// use optional fixed audition matching, rather than pumping the envelope.
project(x,y)=(x+y)*sqrt(0.5);
strings=(bank ~ scatter) : par(i,6,project);
mixdown=par(i,6,b.observe(i)) :> *(0.4);
process=strings <: (mixdown <: (b.body : b.output),_),si.bus(6);
