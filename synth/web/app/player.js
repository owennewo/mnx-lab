// Live playback through the instrument host. Material repeats by scheduling each
// loop iteration about a second ahead (well past the commit horizon) with its own
// note ids; stop is a silencing cancel; edits are configure() calls, which ramp.
import {InstrumentHost,loadHostAssets} from '../host/index.js';
const LEAD=.25,AHEAD=1;
export class Player extends EventTarget{
 constructor(){super();this.playing=false;this.ready=null;this.previews=0;this.runs=0;this.command=0;}
 emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
 ensure(){
  this.ready??=(async()=>{
   this.context=new AudioContext({sampleRate:48000,latencyHint:'interactive'});
   this.host=await InstrumentHost.create(this.context,{assets:await loadHostAssets()});this.host.connect();
   this.host.on('meter',m=>this.emit('meter',m));this.host.on('diagnostic',d=>this.emit('diagnostic',d));
   this.host.on('error',e=>this.emit('error',e));this.host.on('sounding',s=>this.emit('sounding',s));
  })().catch(e=>{this.ready=null;throw e;});
  return this.ready;
 }
 async configure(setup){this.setup=setup;if(this.host)await this.host.configure(setup);}
 async play(setup,material,{loop=true}={}){
  const command=++this.command;
  await this.ensure();if(command!==this.command)return;
  await this.context.resume();if(command!==this.command)return;
  await this.silence(false);if(command!==this.command)return;
  await this.host.configure(setup);if(command!==this.command)return;this.setup=setup;
  // Each run gets its own ids: notes of a stopped run that already sounded stay in the host.
  Object.assign(this,{material,loop,start:this.context.currentTime+LEAD,iteration:0,playing:true,run:++this.runs});
  await this.schedule(0);
  if(command!==this.command)return;
  this.timer=setInterval(()=>this.tick(),100);this.emit('state',{playing:true});
 }
 // Every id a note names (its own, its chord gesture's, a legato source) gets the run and
 // iteration suffix, so repeats are distinct notes, chords and legato chains.
 schedule(k){
  const offset=this.start+k*this.material.length,tag=id=>`${id}.r${this.run}i${k}`;
  const shift=x=>({...x,id:tag(x.id),at:x.at+offset,...(x.gesture?{gesture:{...x.gesture,id:tag(x.gesture.id)}}:{}),...(x.techniques?{techniques:x.techniques.map(t=>t.type==='legato'?{...t,from:tag(t.from)}:t)}:{})});
  return this.host.schedule({notes:this.material.notes.map(shift),controls:this.material.controls.map(shift),through:offset+this.material.length});
 }
 tick(){
  const now=this.context.currentTime,end=this.start+(this.iteration+1)*this.material.length;
  if(this.loop&&now>end-AHEAD){this.iteration++;this.schedule(this.iteration);}
  else if(!this.loop&&now>end+1.5)this.stop();
  this.emit('position',this.position());
 }
 position(){if(!this.playing)return 0;const t=this.context.currentTime-this.start;return Math.max(0,this.loop?t%this.material.length:Math.min(t,this.material.length));}
 async silence(notify=true){
  clearInterval(this.timer);this.playing=false;
  if(this.host)await this.host.cancel({from:this.context.currentTime,silence:true});
  if(notify)this.emit('state',{playing:false});
 }
 async stop(){++this.command;await this.silence();}
 setLoop(loop){this.loop=loop;}
 // One note on one part, now (inside the session's current setup).
 async preview(note,setup=this.setup){
  const command=this.command;
  await this.ensure();if(command!==this.command)return;
  await this.context.resume();if(command!==this.command)return;
  if(setup)await this.host.configure(setup);if(command!==this.command)return;this.setup=setup;
  const at=this.context.currentTime+.15;
  await this.host.schedule({notes:[{...note,id:`preview-${++this.previews}`,at}],controls:[]});
 }
}
