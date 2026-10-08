import {clamp,clone} from './presets.js';

// Keep the old humanisation bounds for instruments inside the original range.
export function excitationValue(base,delta,lo,hi,extendedLo,extendedHi) {
 return clamp(base+delta,base<lo||base>hi?extendedLo:lo,base<lo||base>hi?extendedHi:hi);
}

// The shipped seeded performance is authored by the native Python scheduler.
// Keep its exact timing/dynamics and regenerate instrument-dependent controls.
export function automation(performance,preset,rate,{tailSeconds=4}={}) {
  const events=[];
  let noteStart;
  const put=(frame,key,value)=>events.push({frame:Math.round(frame),key,value,...(noteStart===undefined?{}:{noteStart})});
  let final=0;
  for(const n of performance.notes) {
    const s=n.string,st=preset.instrument.strings[s];
    const start=Math.round(n.onset_frame*rate/performance.sampleRate);
    noteStart=start;
    const stop=Math.round(n.offset_frame*rate/performance.sampleRate);
    const base=440*2**((st.openMidi+n.fret-69+(st.tuningCents+n.intonation_cents)/100)/12);
    if(base<60||base>1400)throw new Error('This tuning puts a note outside the supported 60–1400 Hz range.');
    for(const [key,value] of Object.entries({velocity:n.performed_velocity,
      position:excitationValue(preset.instrument.excitation.position,n.position_delta,.04,.46,.01,.49),
      hardness:excitationValue(preset.instrument.excitation.hardness,n.hardness_delta,.1,1,.025,preset.schemaVersion===2?40:4),sustain:1,trigger:1})) put(start,`s${s}-${key}`,value);
    put(start+Math.round(.001*rate),`s${s}-trigger`,0);put(stop,`s${s}-sustain`,0);
    for(let frame=start;frame<stop;frame+=Math.max(1,Math.round(rate/200))) {
      const age=(frame-start)/rate;
      const bend=n.attack_bend_cents*Math.exp(-age/.045);
      const vibrato=n.vibrato_cents*clamp((age-(n.vibrato_delay??.18))/.2,0,1)*Math.sin(2*Math.PI*n.vibrato_hz*age+n.vibrato_phase);
      put(frame,`s${s}-frequency`,clamp(base*2**((bend+vibrato)/1200),60,1400));
    }
    final=Math.max(final,stop);
  }
  noteStart=undefined;
  for(let s=0;s<6;s++)put(final+Math.round(.25*rate),`s${s}-sustain`,0);
  events.sort((a,b)=>a.frame-b.frame);
  return {events,frames:final+Math.round(tailSeconds*rate),seed:performance.seed};
}
// The native/reference export keeps its long analysis tail. Interactive playback
// only needs the release and a short body decay, not four seconds of dead air.
export function auditionAutomation(performance,preset,rate) {
  return {...automation(performance,preset,rate,{tailSeconds:auditionTail(preset)}),minimumFrames:auditionFrames(performance,rate)};
}
export function auditionTail(preset) {
 // Candidate free strings retain their natural decay after note-off instead
 // of being cut by the legacy .4 s release-tail allowance. The processor can
 // still end an already silent tail early. Legacy scheduling is unchanged.
 const freeTail=preset?.schemaVersion===2?Math.max(0,...preset.instrument.strings.filter(s=>s.freeRinging===1).map(s=>preset.instrument.parameters.decay*s.decayScale)):0;
 return Math.max(.4,freeTail,preset?.instrument.parameters.release||0,preset?.instrument.parameters.body_mix>0?Math.max(...preset.instrument.modes.map(m=>m.t60_seconds)):0);
}
export function auditionFrames(performance,rate=performance.sampleRate,preset) {
  return Math.max(...performance.notes.map(n=>Math.round(n.offset_frame*rate/performance.sampleRate)))+Math.round(auditionTail(preset)*rate);
}
export function selectPassage(reference,kind,string=0) {
  const p=clone(reference);
  if(kind==='full')return p;
  if(kind==='accents'){
    p.id='accent-pulse';p.name='Beat accents · steady pulse';p.timeOriginSeconds=.15;
    p.notes=Array.from({length:16},(_,beat)=>{
      const n={...clone(reference.notes[0]),id:beat,beat,string:2,fret:2,midi:52,velocity:.72,performed_velocity:.72,
        duration_beats:.45,technique:'fingerpick',strum_rank:0,group:`pulse-${beat}`,
        position_delta:0,hardness_delta:0,intonation_cents:0,attack_bend_cents:0,vibrato_cents:0};
      n.onset_frame=Math.round((.15+beat*60/p.bpm)*p.sampleRate);
      n.offset_frame=Math.round((.15+(beat+.45)*60/p.bpm)*p.sampleRate);
      n.onset_seconds=n.onset_frame/p.sampleRate;n.offset_seconds=n.offset_frame/p.sampleRate;return n;
    });
    return p;
  }
  if(kind==='fingerpick')p.notes=p.notes.filter(n=>n.beat<16);
  else if(kind==='strum') {
    p.notes=p.notes.filter(n=>n.beat>=16);
    const shift=p.notes[0].onset_frame-Math.round(.15*p.sampleRate);
    p.notes.forEach(n=>{n.onset_frame-=shift;n.offset_frame-=shift;});
    p.timeOriginSeconds=.15-shift/p.sampleRate;
  } else {
    const n=clone(p.notes[0]);n.string=string;n.fret=0;n.midi=[40,45,50,55,59,64][string];
    n.onset_frame=Math.round(.1*p.sampleRate);n.offset_frame=Math.round(2*p.sampleRate);
    n.beat=0;n.duration_beats=1.9*p.bpm/60;n.technique="fingerpick";n.strum_rank=0;
    p.timeOriginSeconds=.1;p.notes=[n];
  }
  return p;
}
