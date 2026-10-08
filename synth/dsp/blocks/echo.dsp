// Echo: feedback delay with a tone lowpass and optional ping-pong. The host sets
// time in seconds from the block's beats and the tempo.
import("stdfaust.lib");
declare name "Echo";
smooth(x) = x : si.smooth(ba.tau2pole(0.04));
time = hslider("time",.375,.04,2,.001);
feedback = hslider("feedback",.5,0,.8,.01) : smooth;
mix = hslider("mix",.4,0,1,.01) : smooth;
tone = hslider("tone",5000,500,12000,1) : smooth;
ping = hslider("ping_pong",1,0,1,1) : smooth;
echo(l,r) = l+el,r+er with {
    delays = (+ : fi.lowpass(1,tone) : de.sdelay(262144,2048,time*ma.SR)),
             (+ : fi.lowpass(1,tone) : de.sdelay(262144,2048,time*ma.SR));
    cross(a,b) = feedback*((1-ping)*a+ping*b),feedback*((1-ping)*b+ping*a);
    loop(fl,fr,x,y) = fl,x,fr,y : delays;
    wet = (l*mix,r*mix) : (loop ~ cross);
    el = wet : _,!; er = wet : !,_;
};
process = echo;
