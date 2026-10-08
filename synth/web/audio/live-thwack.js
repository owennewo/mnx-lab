// Live, bounded knocked-minus-clean responses. No PCM pre-rendering or worker.
// Shadow DSP instances are allocated once. At a pluck they inherit the current
// string state, avoiding a cold coefficient start or a warm-up render burst.
// Each shadow shares the main engine's clean baseline, avoiding a second clean
// copy per string. All subsequent events/updates are mirrored until it expires.
import {GuitarEngine} from './engine.js';
import {thwackAmount,THWACK_HOLD,THWACK_SETTLING} from '../model/thwack.js';
export class LiveThwackEngine extends GuitarEngine{
 constructor(module,meta,rate=48000,block=128){
  super(module,meta,rate,block);
  this.thwackStrength=0;
  this.voices=Array.from({length:6},()=>{const shadow=new GuitarEngine(module,meta,rate,block);shadow.resultChannels=2;return {active:false,age:0,low:[0,0],shadow};});
  this.lowAlpha=1-Math.exp(-2*Math.PI*1200/this.rate);
  this.fixedFrames=Math.round(THWACK_SETTLING*this.rate);const hold=Math.min(THWACK_HOLD*this.rate,this.fixedFrames*.9);
  // A control-envelope lookup, not PCM preparation. Float64 preserves the
  // exact Number used by the original per-sample fade formula.
  this.fixedEnvelope=Float64Array.from({length:this.fixedFrames},(_,age)=>age<=hold?1:.5*(1+Math.cos(Math.PI*(age-hold)/(this.fixedFrames-hold))));
  this.onPluck=e=>this.pluck(e);
  this.onRenderSegment=(result,offset,n,start)=>this.mix(result,offset,n,start);
 }
 setThwack(strength){thwackAmount(strength);this.thwackStrength=strength;}
 reset(...args){super.reset(...args);if(this.voices)for(const v of this.voices)v.active=false;}
 cloneInto(target){
  target.stateBytes.set(this.stateBytes);target.rng.set(this.rng);
  target.position=this.position;target.events=this.events;target.index=this.index-1;
  target.eventPolicy=this.eventPolicy;target.noteSchedule=null;
  target.ramps.clear();for(const [key,ramp] of this.ramps)target.ramps.set(key,{...ramp});
  target.nextPluck={...this.nextPluck};
 }
 update(...args){
  super.update(...args);
  for(const voice of this.voices){
   if(!voice.active)continue;
   const target=voice.shadow;target.events=this.events;target.index=this.index;
   target.ramps.clear();for(const [key,ramp] of this.ramps)target.ramps.set(key,{...ramp});
   target.nextPluck={...this.nextPluck};
   // Non-ramped controls are copied too, without replacing the shadow's own
   // mode/amount/selector or its circulating knock state.
   for(const key of Object.keys(args[0]))if(!this.ramps.has(key)&&!this.nextPluck[key]&&!/^s\d-(frequency|position|hardness|sustain|trigger)$/.test(key))target.set(key,this.get(key));
  }
 }
 pluck(hit){
  const string=Number(hit.key[1]),voice=this.voices[string];voice.active=false;
  if(this.thwackStrength===0)return;
  // Every new pluck replaces its own string's transient; no old knock returns.
  this.cloneInto(voice.shadow);
  if(this.diagnosticBlock){this.diagnosticBlock.plucks++;this.diagnosticBlock.snapshotBytes+=this.stateBytes.length;}
  voice.shadow.set('attack_trial',2);voice.shadow.set('attack_string',string);
  voice.shadow.set('attack_amount',thwackAmount(this.thwackStrength));
  let next=Infinity;for(let i=this.index;i<this.events.length;i++){const e=this.events[i];if(e.key===hit.key&&e.value===1&&e.frame>this.position){next=e.frame;break;}}
  voice.frames=Math.min(Math.round(THWACK_SETTLING*this.rate),next-this.position);
  voice.hold=Math.min(THWACK_HOLD*this.rate,voice.frames*.9);
  voice.active=true;voice.age=0;voice.low.fill(0);
 }
 mix(result,offset,count){
  const alpha=this.lowAlpha;let active=0;
  for(const voice of this.voices){
   if(!voice.active)continue;
   active++;
   // Shadow and main RNG streams are identical. Reuse this segment's exact
   // Float32 noise instead of generating all six streams again per shadow.
   const {frames,hold}=voice,n=Math.min(count,frames-voice.age),a=voice.shadow.render(n,this.inputs);
   // Private shadows are never rendered outside these aligned segments.
   if(n===count)voice.shadow.rng.set(this.rng);
   if(this.diagnosticBlock){this.diagnosticBlock.shadowSegments++;this.diagnosticBlock.shadowFrames+=n;}
   for(let i=0;i<n;i++){
    const age=voice.age+i,envelope=frames===this.fixedFrames?this.fixedEnvelope[age]:age<=hold?1:.5*(1+Math.cos(Math.PI*(age-hold)/(frames-hold)));
    for(let c=0;c<2;c++){
     const residual=a[c][i]-this.outputs[c][i];voice.low[c]+=alpha*(residual-voice.low[c]);
     result[c][offset+i]+=(residual-(residual-2*voice.low[c]))*envelope;
    }
   }
   voice.age+=n;if(voice.age>=frames)voice.active=false;
  }
  if(this.diagnosticBlock)this.diagnosticBlock.maxVoices=Math.max(this.diagnosticBlock.maxVoices,active);
 }
}
