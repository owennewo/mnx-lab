// Stage 6 linear pickup experiment, over unchanged Stage 5 string/bridge core.
// Persistent setup lives in the host scheduler; nonlinear buzz is deferred.
import("stdfaust.lib");
b=component("guitar.dsp");
s=component("instrument-stage5.dsp");
r=component("instrument-stage4.dsp");
p=component("instrument-pickups.dsp");
declare name "Guitar linear pickup prototype";
process=s.strings <: (p.mixdown <: (r.radiation(24) : b.output),_),si.bus(6);
