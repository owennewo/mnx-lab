// Isolated Stage 1 prototype. Factory engine 1.4.0 remains the comparison.
// A passive first-order shelf separates low and upper-partial decay, with
// analytic phase-delay compensation at each string's fundamental.
import("stdfaust.lib");
b = component("guitar.dsp");
declare name "Guitar construction prototype";

trebleDecay = hslider("treble_decay",1.2,0.03,30,0.01);
initialDamping = hslider("initial_damping",0,0,1,0.001);
initialTime = hslider("initial_damping_time",0.12,0.01,0.5,0.001);
lossProfile(i) = hslider("s%i-loss_profile",0.85+0.06*i,0.4,2,0.001);
trebleScale(i) = hslider("s%i-treble_scale",1,0.4,1.6,0.001);
stiffnessScale(i) = hslider("s%i-stiffness_scale",1,0.3,2,0.001);

excitation(i,noise) = b.velocity(i)*0.18*(b.pickTexture*contact+b.pluckBody*0.5*displacement)
with {
    period=ma.SR/b.freq(i);
    hard=b.hardness(i);
    softScale=min(1,hard/0.1);
    hardScale=max(1,hard);
    cutoff=min(0.45*ma.SR,(900+12000*max(0.1,min(1,hard)))*softScale*hardScale);
    contactTime=(0.0015+0.002*(1-max(0.1,min(1,hard))))/softScale/hardScale;
    contact=noise : fi.lowpass(2,cutoff)
      : *(en.ar(0.0003/softScale/hardScale,contactTime,b.trigger(i)))
      : b.pluckComb(b.position(i),period);
    hit=b.trigger(i)>b.trigger(i)';
    pluckPeriod=period : ba.sAndH(hit);
    pluckPosition=b.position(i) : ba.sAndH(hit) : max(0.01);
    age=ba.countup(4096,hit);
    phase=min(1,age/max(8,pluckPeriod));
    x=min(2*phase,2-2*phase);
    triangle=min(x/pluckPosition,(1-x)/(1-pluckPosition));
    profile=triangle*(1-2*(phase>=0.5))*(age<pluckPeriod)*(pluckPeriod>0);
    displacement=profile : fi.lowpass(2,cutoff);
};

string(i,feedback,noise) =
    (feedback+excitation(i,noise)) : fi.tf1(a,1,a)
    : fi.tf1(b0,b1,-pole) : *(initialLoss)
    : de.fdelay4(4096,max(4,period-1-apDelay-shelfDelay))
with {
    f=b.freq(i);
    period=ma.SR/f;
    w=2*ma.PI*f/ma.SR;
    a=(0-min(0.65,b.dispersion*stiffnessScale(i)))*(1-0.06*i);
    apDelay=2*atan(((1-a)/(1+a))*tan(w/2))/w;
    // Natural loss shape stays independent of finger muting. This prevents
    // release from retuning the loss phase or increasing an already short tail.
    bassT60=b.decay*b.decayScale(i);
    trebleT60=trebleDecay*trebleScale(i);
    rho=pow(0.001,1/(f*bassT60));
    highTarget=pow(0.001,1/(f*trebleT60));
    // Warmth retains its meaning: move the loss knee lower. Per-string
    // profiles describe designed string families rather than measured material.
    cutoff=min(0.4*ma.SR,max(4*f,(4+12*b.brightness)*f*lossProfile(i)));
    k=tan(ma.PI*cutoff/ma.SR);
    pole=(1-k)/(1+k);
    t=tan(w/2)/k;
    // |H(f0)|² = (low²+high²*t²)/(1+t²). The unit cap
    // preserves passivity when an extreme loss profile cannot meet both targets.
    lowTarget=min(1,sqrt(max(0,rho*rho*(1+t*t)-highTarget*highTarget*t*t)));
    low=lowTarget : si.smooth(ba.tau2pole(0.003));
    high=highTarget : si.smooth(ba.tau2pole(0.003));
    b0=high+(low-high)*(1-pole)/2;
    b1=-high*pole+(low-high)*(1-pole)/2;
    // Continuous host controls already ramp in 16-sample increments. Keep the
    // compensated delay constant within each control block so Lagrange weights
    // can be computed once, while bounded filter gains still smooth in audio.
    shelfDelay=atan((lowTarget-highTarget)*t/max(1e-12,lowTarget+highTarget*t*t))/w;
    // Damping must bound the longest-lived part of the spectrum, including
    // inverted profiles whose treble rings longer than their fundamental.
    muteGain=min(1,pow(0.001,1/(f*b.release))/max(1e-12,max(lowTarget,highTarget)));
    fingerGain=(muteGain+(1-muteGain)*b.sustain(i)) : si.smooth(ba.tau2pole(0.003));
    hit=b.trigger(i)>b.trigger(i)';
    age=ba.countup(100000000,hit);
    // Linear settling keeps time-varying transcendental functions out of the
    // sample loop. Both endpoints and every interpolated gain stay passive.
    initialEnvelope=max(0,1-age/(ma.SR*initialTime));
    initialLoss=(1-(1-pow(0.001,initialDamping/(f*0.1)))*initialEnvelope)*fingerGain;
};
bank(f0,f1,f2,f3,f4,f5,e0,e1,e2,e3,e4,e5) =
    string(0,f0,e0),string(1,f1,e1),string(2,f2,e2),
    string(3,f3,e3),string(4,f4,e4),string(5,f5,e5);
strings=bank ~ b.scatter;
mixdown=par(i,6,b.observe(i)) :> *(0.4);
process=strings <: (mixdown <: (b.body : b.output),_),si.bus(6);
