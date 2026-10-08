// Linear observation only. Never enters the strings or bridge feedback.
import("stdfaust.lib");
b=component("guitar.dsp");
declare name "Dual pickup observation prototype";
pickupWidth=hslider("pickup_width",0,0,0.15,0.0001);
pickup2=hslider("pickup2",0.32,0.04,0.45,0.001);
pickupBlend=hslider("pickup_blend",0,0,1,0.001);

// Unit-DC exponential aperture approximation. Width scales with the string
// period, rather than a fixed-Hz tone filter. This is not a calibrated
// symmetric magnetic field or a literal rectangular/sinc pickup aperture.
// At zero width q=0 exactly, retaining the existing point observation.
aperture(i,x)=select2(pickupWidth>0,x,x*(1-q) : +~*(q))
with { q=exp(-1/max(0.000001,pickupWidth*ma.SR/b.freq(i))); };
// Electric pickups (and the second pickup) are not computed while their mix is zero.
observe(i,x)=(1-b.electric)*x+b.electric*enable(aperture(i,
    (1-pickupBlend)*b.comb(b.pickup*ma.SR/b.freq(i),x)
    +pickupBlend*enable(b.comb(pickup2*ma.SR/b.freq(i),x),pickupBlend>0)),b.electric>0);
mixdown=par(i,6,observe(i)) :> *(0.4);
process=par(i,6,observe(i));
