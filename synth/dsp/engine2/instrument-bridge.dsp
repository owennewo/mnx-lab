// Designed passive bridge junction, not a measured Mores admittance.
// This module is independent of microphone/output radiation.
import("stdfaust.lib");
b=component("guitar.dsp");
s=component("instrument-stage2.dsp");

transfer=hslider("bridge_transfer",0.035,0,0.3,0.0001);
rolloff=hslider("bridge_rolloff",250,20,4000,0.1);
sympathy=hslider("sympathetic_response",1,0,1,0.001);
free(i)=hslider("s%i-free_ringing",1,0,1,1);
// A sounding note always participates. For an idle string, availability and
// sympathetic participation are independent of the bridge loading amount.
participation(i)=b.sustain(i)+(1-b.sustain(i))*sympathy*free(i);
weight(i)=participation(i)*sqrt(1.0/6);
available(i)=free(i)+(1-free(i))*b.sustain(i);

// Normalized one-state allpass lattice. For every instantaneous a,c:
// y^2 + nextState^2 = input^2 + previousState^2, provided a^2+c^2=1.
// Unlike a direct-form time-varying allpass, this retains a storage-energy
// identity while coefficients move. The recursive connection delays state.
lattice=(step ~ (!,_))
with {
    k=tan(ma.PI*rolloff/ma.SR);
    a=(k-1)/(k+1);
    c=sqrt(max(0,1-a*a));
    step(previous,input)=(a*input+c*previous,c*input-a*previous);
};

// Orthogonal split -> lossless lattice -> orthogonal recombination.
// With frozen controls the common reflectance is (1-m)-m*A(z).
// Return, absorbed port, and next lattice state are exposed for diagnostics.
port(x)=x <: (*(alpha) : lattice),*(beta) : recombine
with {
    alpha=sqrt(transfer);
    beta=sqrt(1-transfer);
    recombine(y,state,bypass)=(beta*bypass-alpha*y,
                              alpha*bypass+beta*y,state);
};

// Six real ports plus an implicit absorbing completion port. Real string
// weights have sum(w_i^2)<=1 and are NOT renormalized as strings become
// unavailable: turning sympathy off must not multiply a sounding string's
// own loading by six. The completion port carries the missing norm.
axisDiagnostic(x0,x1,x2,x3,x4,x5)=
    x0+weight(0)*delta,x1+weight(1)*delta,x2+weight(2)*delta,
    x3+weight(3)*delta,x4+weight(4)*delta,x5+weight(5)*delta,
    (common : port : (!,_,!)),completion*delta,(common : port : (!,!,_))
with {
    common=weight(0)*x0+weight(1)*x1+weight(2)*x2
        +weight(3)*x3+weight(4)*x4+weight(5)*x5;
    delta=(common : port : (_,!,!))-common;
    completion=sqrt(max(0,1-(weight(0)*weight(0)+weight(1)*weight(1)
        +weight(2)*weight(2)+weight(3)*weight(3)
        +weight(4)*weight(4)+weight(5)*weight(5))));
};
axis=axisDiagnostic : (si.bus(6),!,!,!);
scatter=axes : (axis,axis) : interleave
with {
    axes(x00,x01,x10,x11,x20,x21,x30,x31,x40,x41,x50,x51)=
        x00,x10,x20,x30,x40,x50,x01,x11,x21,x31,x41,x51;
    pair(x,y)=((1-s.exchange)*x+s.exchange*y,
               (1-s.exchange)*y+s.exchange*x);
    interleave(x0,x1,x2,x3,x4,x5,y0,y1,y2,y3,y4,y5)=
        pair(x0,y0),pair(x1,y1),pair(x2,y2),
        pair(x3,y3),pair(x4,y4),pair(x5,y5);
};

// Frozen diagonal-reflection phase only. Other responding strings can cause
// real coupled pitch/decay changes; this is not an exact eigenmode tuner.
phaseLead(i,f)=atan(2*g*t/(1+t*t-2*g))/w
with {
    w=2*ma.PI*f/ma.SR;
    t=tan(w/2)/tan(ma.PI*rolloff/ma.SR);
    g=transfer*weight(i)*weight(i);
};
process=axisDiagnostic;
