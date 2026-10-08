// Guitar engine parameter catalogue (ranges, units, live policy) and the engine's base
// controls for a resolved design. Saturation, tone and room are chain blocks now.
export const clone = x => structuredClone(x);
export const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
export const PARAMS = {
  decay: {name:'Sustain',unit:'s',min:.05,max:60,step:.01,default:4,policy:'smooth'},
  brightness: {name:'String brightness',unit:'',min:0,max:1,step:.001,default:.65,policy:'smooth'},
  dispersion: {name:'String stiffness',unit:'',min:.001,max:.65,step:.001,default:.12,policy:'smooth'},
  coupling: {name:'Bridge coupling',unit:'',min:0,max:.02,step:.0001,default:.002,policy:'smooth'},
  release: {name:'Finger release',unit:'s',min:.015,max:.5,step:.001,default:.08,policy:'smooth'},
  pickup: {name:'Pickup position',unit:'',min:.04,max:.45,step:.001,default:.18,policy:'smooth'},
  electric: {name:'Electric pickup blend',unit:'',min:0,max:1,step:.01,default:0,policy:'smooth'},
  body_mix: {name:'Body resonance',unit:'',min:0,max:1,step:.01,default:.6,policy:'smooth'},
  pluck_body: {name:'Pluck fullness',unit:'',min:0,max:4,step:.01,default:.3,policy:'next pluck'},
  pick_texture: {name:'Pick texture',unit:'',min:0,max:8,step:.01,default:.7,policy:'next pluck'},
  levelDb: {name:'Calibration level',unit:'dB',min:-12,max:40,step:.1,default:20,policy:'smooth'},
};
export function baseControls(p) {
  const controls={...p.instrument.parameters};
  p.instrument.modes.forEach((m,i)=>Object.assign(controls,{[`m${i}-freq`]:m.frequency_hz,[`m${i}-t60`]:m.t60_seconds,[`m${i}-gain`]:m.gain}));
  p.instrument.strings.forEach((s,i)=>Object.assign(controls,{
    [`s${i}-frequency`]:440*2**((s.openMidi-69+s.tuningCents/100)/12),
    [`s${i}-decay_scale`]:s.decayScale,[`s${i}-sustain`]:1,
    [`s${i}-position`]:p.instrument.excitation.position,[`s${i}-hardness`]:p.instrument.excitation.hardness,
    [`s${i}-trigger`]:0,
  }));
  return controls;
}
