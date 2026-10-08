// Vibrato: a modulated delay; depth is the approximate peak pitch deviation in cents.
import("stdfaust.lib");
declare name "Vibrato";
smooth(x) = x : si.smooth(ba.tau2pole(0.04));
depth = hslider("depth",10,0,50,.1) : smooth;
mix = hslider("mix",.5,0,1,.01) : smooth;
rate = hslider("rate",4.5,.2,10,.01) : smooth;
modulate(x) = (1-mix)*x + mix*de.fdelay(16384,ma.SR*(.014 + min(.012,(pow(2,depth/1200)-1)/(2*ma.PI*rate))*os.osc(rate)),x);
process = par(i,2,modulate);
