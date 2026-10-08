// Prototype-only persistent instrument setup. Player timing, vibrato and
// attack bends remain in the original scheduler; this adds a separate law.
export const NEUTRAL_SETUP=Object.freeze({fret12Cents:Object.freeze(Array(6).fill(0)),fret24Cents:Object.freeze(Array(6).fill(0)),tensionCents:0,tensionSeconds:.045});
const keys=['fret12Cents','fret24Cents','tensionCents','tensionSeconds'];
const finite=(value,min,max,label)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`Invalid ${label}: expected ${min}–${max}`);};
export function validateInstrumentSetup(setup){
 if(!setup||Object.keys(setup).sort().join()!==[...keys].sort().join())throw Error('Invalid instrument setup fields');
 for(const [key,limit] of [['fret12Cents',30],['fret24Cents',50]]){
  if(!Array.isArray(setup[key])||setup[key].length!==6)throw Error(`Expected six ${key} values`);
  for(let s=0;s<6;s++)finite(setup[key][s],-limit,limit,`${key}[${s}]`);
 }
 finite(setup.tensionCents,0,30,'tension response');finite(setup.tensionSeconds,.005,.25,'tension settling time');
 return setup;
}
function noteValues(note){
 if(!Number.isInteger(note.string)||note.string<0||note.string>5||!Number.isInteger(note.fret)||note.fret<0||note.fret>24)throw Error('Setup requires string 0–5 and fret 0–24');
 finite(note.performed_velocity,0,1,'performed pluck strength');
}
function centsUnchecked(setup,note,age){
 const x=note.fret/12;
 // A persistent quadratic anchored at open/12th/24th frets. No random
 // note-to-note intonation is introduced or confused with player variation.
 const fretCents=x*(2-x)*setup.fret12Cents[note.string]+.5*x*(x-1)*setup.fret24Cents[note.string];
 const settlingCents=setup.tensionCents*note.performed_velocity**2*Math.exp(-age/setup.tensionSeconds);
 return {fretCents,settlingCents,totalCents:fretCents+settlingCents};
}
export function instrumentPitchCents(setup,note,age){
 validateInstrumentSetup(setup);noteValues(note);finite(age,0,Infinity,'note age');
 return centsUnchecked(setup,note,age);
}
export function withInstrumentSetup(plan,{preset,performance,rate,setup=NEUTRAL_SETUP,annotate=false}){
 validateInstrumentSetup(setup);finite(rate,1,192000,'sample rate');
 const enabled=setup.tensionCents!==0||setup.fret12Cents.some(x=>x!==0)||setup.fret24Cents.some(x=>x!==0);
 // Exact event identity at neutral; no extra target rounding or note state.
 if(!enabled)return plan;
 if(!performance?.notes||!Number.isFinite(performance.sampleRate)||performance.sampleRate<=0)throw Error('Setup requires the performed note sequence');
 const notes=new Map(),labels=new Map();
 for(const note of performance.notes){
  noteValues(note);const start=Math.round(note.onset_frame*rate/performance.sampleRate);
  if(!Number.isInteger(start)||start<0)throw Error('Invalid setup note onset');
  const key=`${note.string}:${start}`;if(notes.has(key))throw Error('Ambiguous simultaneous notes on one string');
  notes.set(key,note);
 }
 const events=plan.events.map(event=>{
  const match=/^s(\d)-frequency$/.exec(event.key);
  // Direct manual frequency events remain direct; note trajectories retain
  // their original noteStart so live updates can preserve ringing notes.
  if(!match||event.noteStart===undefined)return event;
  const key=`${match[1]}:${event.noteStart}`,note=notes.get(key);
  if(!note)throw Error('Frequency trajectory has no matching setup note');
  finite(event.value,60,1400,'scheduled player frequency');
  const age=(event.frame-event.noteStart)/rate;finite(age,0,Infinity,'scheduled note age');
  const cents=centsUnchecked(setup,note,age),target=event.value*2**(cents.totalCents/1200);
  const value=Math.max(60,Math.min(1400,target));
  if(annotate){
   let label=labels.get(key);
   if(!label){
    const string=preset.instrument.strings[note.string],nominalMidi=string.openMidi+note.fret;
    label={string:note.string,fret:note.fret,noteStart:event.noteStart,nominalMidi,nominalHz:440*2**((nominalMidi-69)/12),
     tuningCents:string.tuningCents,playerIntonationCents:note.intonation_cents??0,instrumentFretCents:cents.fretCents,
     initialSettlingCents:setup.tensionCents*note.performed_velocity**2,settlingSeconds:setup.tensionSeconds,rangeClampedEvents:0,points:[]};
    labels.set(key,label);
   }
   label.rangeClampedEvents+=Number(value!==target);
   label.points.push({frame:event.frame,ageSeconds:age,scheduledPlayerHz:Math.fround(event.value),instrumentSetupCents:cents.totalCents,
    soundingHz:Math.fround(value),unclampedTargetHz:target,rangeClamped:value!==target});
  }
  return {...event,value};
 });
 return {...plan,events,...(annotate?{instrumentPitch:{schemaVersion:1,setup:structuredClone(setup),notes:[...labels.values()],
  scope:'Nominal labels are separate from scheduled sounding pitch. Instrument setup multiplies the original bounded player trajectory; final DSP targets remain 60–1400 Hz. Float32 targets are annotated; coupled modes and dispersion can differ from those targets.'}}:{})};
}
