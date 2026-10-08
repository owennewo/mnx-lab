// Tremolo: amplitude modulation, depth 0–1.
import("stdfaust.lib");
declare name "Tremolo";
smooth(x) = x : si.smooth(ba.tau2pole(0.04));
depth = hslider("depth",.35,0,1,.01) : smooth;
rate = hslider("rate",3,.2,10,.01) : smooth;
process = par(i,2,*(1-depth*(.5+.5*os.osc(rate))));
