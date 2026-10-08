// A performed take in the reference performance format becomes ordinary contract
// notes: per-note touch as `nuance`, finger vibrato as a vibrato technique (C16, C17:
// the performance belongs to the material, not to the synth). Take strings are DSP slots of the
// standard 6-string guitar (0 = low E); contract strings are positional (D3).
import {CONTRACT} from '../../contract/index.js';
const pad=(i,n)=>String(i).padStart(String(n).length,'0');
export function performanceToNotes(performance,{part='guitar'}={}){
 const rate=performance.sampleRate;
 return performance.notes.map((n,i)=>({id:`p${pad(i,performance.notes.length)}`,part,at:n.onset_frame/rate,duration:(n.offset_frame-n.onset_frame)/rate,
  velocity:n.performed_velocity,target:{pitch:[40,45,50,55,59,64][n.string]+n.fret},fingering:{string:6-n.string,fret:n.fret},
  techniques:[{type:'vibrato',depthCents:n.vibrato_cents,rateHz:n.vibrato_hz,phase:n.vibrato_phase,delaySeconds:n.vibrato_delay??.18,fadeSeconds:.2}],
  nuance:{intonationCents:n.intonation_cents,attackBendCents:n.attack_bend_cents,excitation:{positionDelta:n.position_delta,hardnessDelta:n.hardness_delta}}}));
}
export {CONTRACT};
