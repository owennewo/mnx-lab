// Thwack body calibration (roadmap core-synth-performance step 1). The thwack's body tone is
// the strings' own sound through the design's twelve body resonances, so how much it adds
// depends on how a note's harmonics meet those resonances: on the factory designs a
// full-strength low E gained anything from +9 to +23 dB at the same setting. This works out,
// from the design's resonance table, the body's average boost over every note from open to
// the 12th fret on the layout's strings, and returns the trim that brings that average to
// the reference design's (rounded steel, standard tuning), so one Thwack body setting means
// the same amount in every design. Within a design, a note on a resonance still blooms more.
// Pure arithmetic, run when a design is configured; nothing per note.

// The average (in dB) for rounded steel in standard tuning, from bodyBoostDb below.
export const REFERENCE_BOOST_DB=-16.01;

// One radiation mode of instrument-stage4.dsp (family k, bank 0), as a resonator:
// H(z) = g·(1−rc·z⁻¹)/(1−2rc·z⁻¹+r²z⁻²), g = gain·(1−0.001^(1/(rate·t60))).
function modes(p,rate){
 const q=p.instrument.parameters;
 return p.instrument.modes.map((m,k)=>{
  const frequency=Math.min(.42*rate,m.frequency_hz/q.body_size),upper=Math.min(1,frequency/1400);
  const duration=m.t60_seconds/q.body_damping/Math.max(.25,1+(q.body_breadth-1)*upper);
  const r=.001**(1/(rate*duration)),w=2*Math.PI*frequency/rate;
  return {rc:r*Math.cos(w),r2:r*r,g:m.gain*(k<3?q.body_low_weight:1)*(1-.001**(1/(rate*m.t60_seconds)))};
 });
}
function power(bank,f,rate){
 const w=2*Math.PI*f/rate,c1=Math.cos(w),s1=Math.sin(w),c2=Math.cos(2*w),s2=Math.sin(2*w);let re=0,im=0;
 for(const {rc,r2,g} of bank){
  // (1−rc·e^{−jw}) / (1−2rc·e^{−jw}+r²e^{−2jw})
  const nr=1-rc*c1,ni=rc*s1,dr=1-2*rc*c1+r2*c2,di=2*rc*s1-r2*s2,d=dr*dr+di*di;
  re+=g*(nr*dr+ni*di)/d;im+=g*(ni*dr-nr*di)/d;
 }
 return re*re+im*im;
}
// Mean over the notes, in dB, of the body's power gain on a plucked note's harmonics
// (energy ∝ sin²(nπ·position)/n⁴, below 8 kHz).
export function bodyBoostDb(p,pitches,rate){
 const bank=modes(p,rate),position=p.instrument.excitation.position;let sum=0,count=0;
 for(const open of pitches)for(let fret=0;fret<=12;fret++){
  const f0=440*2**((open+fret-69)/12);let num=0,den=0;
  for(let n=1;n<=40&&n*f0<8000;n++){const weight=Math.sin(n*Math.PI*position)**2/n**4;num+=weight*power(bank,n*f0,rate);den+=weight;}
  sum+=10*Math.log10(num/den);count++;
 }
 return sum/count;
}
// The body trim for a resolved design on its layout (slots: [{pitch}]), clamped to ±24 dB.
export function bodyTrim(p,slots,rate){
 const db=REFERENCE_BOOST_DB-bodyBoostDb(p,slots.map(s=>s.pitch+(s.capo??0)),rate);
 return 10**(Math.min(24,Math.max(-24,db))/20);
}
