// Room: a return bus. Input is the sum of the parts' sends; output is wet only.
import("stdfaust.lib");
declare name "Room";
smooth(x) = x : si.smooth(ba.tau2pole(0.04));
// Controls that set filter coefficients are not smoothed here (that recomputes them every
// sample): the host glides them a block at a time (blocks.js, `glide`).
level = hslider("level",.2,0,1,.01) : smooth;
decay = hslider("decay",1,.2,12,.01) : max(.2);
damping = hslider("damping",7000,1000,12000,1) : max(1000);
pre = hslider("predelay",15,0,100,.1);
width = hslider("width",1,0,1.5,.01) : smooth;
process(sl,sr) = wl,wr with {
    wet = (sl*level,sr*level) : par(i,2,de.sdelay(16384,2048,pre*ma.SR/1000))
      : re.zita_rev1_stereo(0,200,damping,decay,decay,96000);
    a = wet : _,!; b = wet : !,_;
    wl = (a+b)*.5 + (a-b)*.5*width;
    wr = (a+b)*.5 - (a-b)*.5*width;
};
