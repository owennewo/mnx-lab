// Basic kit (labelled "basic"): one-shot synthetic pieces for the instrument host.
// Correct behaviour and bounded levels only (D9); not a drum model. One noise source
// and one metallic oscillator bank are shared. The open hi-hat has a choke state the
// host sets on closed/pedal hits (D8 choke group): a 2 ms fade, reset by its next hit.
import("stdfaust.lib");
declare name "Basic kit";
declare author "Guitar Faust project";
declare basic "true";

noise = no.noise;
// Classic six-oscillator metallic cluster (inharmonic square waves).
metal = (os.lf_squarewave(205.3)+os.lf_squarewave(304.4)+os.lf_squarewave(369.6)
        +os.lf_squarewave(522.7)+os.lf_squarewave(540)+os.lf_squarewave(800))/6;

// Each piece: a trigger slider (rising edge = hit) and a velocity. Velocity changes
// only with a new hit of that piece, so it is not latched and stays control-rate.
hitOf(t) = t > t';
// Restartable exponential decay: 1 at a hit, then ·c per sample (t60 seconds).
decay(hit,t60) = (*(pow(0.001,1/(t60*ma.SR))) : \(y).(select2(hit,y,1.0))) ~ _;
level(hit,v) = pow(v,1.4);

kick(t,v) = level(h,v)*(sin(phase)*decay(h,0.45)+0.3*(noise : fi.lowpass(2,3000))*decay(h,0.004)) with {
  h = hitOf(t);
  f = 48+110*decay(h,0.035*6.9078);
  phase = (+(2*ma.PI*f/ma.SR) : \(x).(x-2*ma.PI*floor(x/(2*ma.PI)))) ~ *(1-h);
};
snare(t,v) = level(h,v)*(0.55*(os.osc(180)+0.6*os.osc(330))*decay(h,0.14)
        +0.8*(noise : fi.bandpass(1,1500,9000))*decay(h,0.24)) with {h = hitOf(t);};
sidestick(t,v) = level(h,v)*(0.7*(noise : fi.bandpass(1,1500,3500))*decay(h,0.03)
        +0.5*os.osc(520)*decay(h,0.05)) with {h = hitOf(t);};
tom(t,v,f0,t60) = level(h,v)*(os.osc(f0*(1+0.25*decay(h,0.05*6.9078)))*decay(h,t60)
        +0.15*(noise : fi.lowpass(2,2500))*decay(h,0.02)) with {h = hitOf(t);};
hat(t,v,gainHat,cut,t60) = level(h,v)*gainHat*(metal+0.4*noise : fi.highpass(2,cut))*decay(h,t60) with {h = hitOf(t);};
// Foot "chick": the cymbals closing, darker and shorter than a stick hit.
hatPedal(t,v) = level(h,v)*0.6*(0.5*metal+noise : fi.bandpass(1,900,4500))*decay(h,0.035) with {h = hitOf(t);};
hatOpen(t,v,c) = level(h,v)*0.7*(metal+0.4*noise : fi.highpass(2,6500))*decay(h,0.8)*choke with {
  h = hitOf(t);
  // Choke state: 1 at a hit, then a 2 ms decay while the choke flag is set.
  choke = (\(y).(select2(h,select2(c>0,y,y*exp(-1/(0.002*ma.SR))),1.0))) ~ _;
};
crash(t,v) = level(h,v)*0.6*(0.6*metal+0.7*noise : fi.highpass(2,4000))*decay(h,2.4) with {h = hitOf(t);};
ride(t,v) = level(h,v)*0.5*((metal : fi.bandpass(1,3000,9000))+0.25*os.osc(620)*decay(h,1.2)+0.2*noise : fi.highpass(1,1200))*decay(h,1.8)
  with {h = hitOf(t);};

// Fixed stereo positions (balance law, unity at centre).
place(p,x) = x*(1-max(0,p)), x*(1+min(0,p));
gain = 0.35;
// Every piece but the closed hi-hat is computed only while its "-active" control is on:
// the host turns it on at each hit and off after twice its decay time (-120 dB). The
// closed hi-hat stays ungated, so the shared noise and metal generators keep running.
// enable() holds its last value while off; the product makes an idle piece exactly zero.
on(gate,x) = enable(x,gate)*gate;
process = (place(0,on(hslider("kick-active",1,0,1,1),kick(hslider("kick-trigger",0,0,1,1),hslider("kick-velocity",0.75,0,1,0.001)))),
  place(0,on(hslider("snare-active",1,0,1,1),snare(hslider("snare-trigger",0,0,1,1),hslider("snare-velocity",0.75,0,1,0.001)))),
  place(0.1,on(hslider("side-stick-active",1,0,1,1),sidestick(hslider("side-stick-trigger",0,0,1,1),hslider("side-stick-velocity",0.75,0,1,0.001)))),
  place(-0.25,on(hslider("tom-high-active",1,0,1,1),tom(hslider("tom-high-trigger",0,0,1,1),hslider("tom-high-velocity",0.75,0,1,0.001),210,0.45))),
  place(0,on(hslider("tom-mid-active",1,0,1,1),tom(hslider("tom-mid-trigger",0,0,1,1),hslider("tom-mid-velocity",0.75,0,1,0.001),150,0.6))),
  place(0.25,on(hslider("tom-low-active",1,0,1,1),tom(hslider("tom-low-trigger",0,0,1,1),hslider("tom-low-velocity",0.75,0,1,0.001),105,0.8))),
  place(0.3,hat(hslider("hihat-closed-trigger",0,0,1,1),hslider("hihat-closed-velocity",0.75,0,1,0.001),0.7,7000,0.07)),
  place(0.3,on(hslider("hihat-pedal-active",1,0,1,1),hatPedal(hslider("hihat-pedal-trigger",0,0,1,1),hslider("hihat-pedal-velocity",0.75,0,1,0.001)))),
  place(0.3,on(hslider("hihat-open-active",1,0,1,1),hatOpen(hslider("hihat-open-trigger",0,0,1,1),hslider("hihat-open-velocity",0.75,0,1,0.001),hslider("hihat-open-choke",0,0,1,1)))),
  place(-0.35,on(hslider("crash-active",1,0,1,1),crash(hslider("crash-trigger",0,0,1,1),hslider("crash-velocity",0.75,0,1,0.001)))),
  place(0.4,on(hslider("ride-active",1,0,1,1),ride(hslider("ride-trigger",0,0,1,1),hslider("ride-velocity",0.75,0,1,0.001)))))
  :> par(i,2,*(gain));
