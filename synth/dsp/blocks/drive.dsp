// Drive: tanh saturation with a tone lowpass, mixed with the dry signal. Stereo.
import("stdfaust.lib");
declare name "Drive";
smooth(x) = x : si.smooth(ba.tau2pole(0.04));
// Controls that set filter coefficients are not smoothed here (that recomputes them every
// sample): the host glides them a block at a time (blocks.js, `glide`).
gain = hslider("gain",12,0,30,.1);
mix = hslider("mix",.7,0,1,.01) : smooth;
tone = hslider("tone",4000,600,16000,1);
saturate(x) = (1-mix)*x + mix*(ma.tanh(x*pow(10,gain/20))/sqrt(pow(10,gain/20)) : fi.lowpass(2,min(.45*ma.SR,tone)));
process = par(i,2,saturate);
