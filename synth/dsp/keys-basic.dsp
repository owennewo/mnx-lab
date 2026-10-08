// Basic keys (labelled "basic"): one additive voice; the host runs 16 instances and
// computes each only while it sounds (idle voices cost nothing).
// Correct behaviour and bounded levels only (D9); not a piano model.
// Per voice: five slightly stretched partials with pitch-dependent decay (higher
// partials die sooner), velocity → level and brightness, a short hammer thump,
// a damper that releases when neither the key (gate) nor the sustain pedal holds
// it, and a 1.5 ms kill fade the host uses to steal a voice without a click.
// A voice's sliders change only when a note starts on it, so nothing is latched:
// every coefficient stays control-rate (computed once per block, not per sample).
import("stdfaust.lib");
declare name "Basic keys";
declare author "Guitar Faust project";
declare basic "true";

pedal = hslider("sustain_pedal",0,0,1,0.001) > 0.5;
noise = no.noise;

voice = (left*x, right*x) with {
  f = hslider("freq",261.63,20,5000,0.001);
  v = hslider("velocity",0.7,0,1,0.001);
  g = hslider("gate",0,0,1,1);
  kill = hslider("kill",0,0,1,1);
  damping = hslider("damping",0,0,1,0.001);
  hit = g > g';
  vl = v;
  age = ba.countup(1000000000,hit);
  attack = min(1,age/(0.002*ma.SR));
  t60 = max(0.6,min(14,9*pow(261.63/f,0.6)))*(1-0.9*damping);
  // y(n) = 1 at a hit, else y(n-1)·c: an exponential decay restarted by each note.
  decay(c) = (*(c) : \(y).(select2(hit,y,1.0))) ~ _;
  // Each partial is a two-pole resonator, reset and excited at the hit: a decaying
  // sinusoid a·rⁿ·sin((n+1)w) for a few multiplies per sample, with every
  // coefficient control-rate.
  resonator(w,r,a) = (\(y1,y2).(select2(hit,2*r*cos(w)*y1-r*r*y2,a*sin(w)),select2(hit,y1,0))) ~ (_,_) : (_,!);
  partial(k) = resonator(2*ma.PI*min(0.45*ma.SR,f*k*sqrt(1+0.0004*sqrt(f/261.63)*k*k))/ma.SR,
    pow(0.001,(1+0.6*(k-1))/(t60*ma.SR)),pow(k,0.9*vl-1.5));
  tone = sum(k,5,partial(k+1));
  thump = noise*decay(pow(0.001,1/(0.012*ma.SR)))*0.3 : fi.lowpass(1,1500+6000*vl);
  held = max(g,pedal);
  damper = held : si.smooth(ba.tau2pole(select2(held,0.07,0.0015)));
  fade = (1-kill) : si.smooth(ba.tau2pole(0.0015));
  x = 0.08*pow(vl,1.6)*attack*damper*fade*(tone+thump);
  // Balance by register: low notes lean left, high notes right; unity at middle C.
  p = max(-0.35,min(0.35,log(f/261.63)/log(2)/4));
  left = 1-max(0,p);
  right = 1+min(0,p);
};
process = voice;
