// AudioWorklet hosting the instrument host: N parts, one room bus, master. The host
// clock is the AudioContext frame counter, so note times are context seconds (D5).
import {HostCore} from './host-core.js';
import {INSTRUMENTS} from './instruments/index.js';
class InstrumentHostProcessor extends AudioWorkletProcessor{
 constructor(options){
  super();
  this.assets=options.processorOptions.assets;this.warmed=new Set();
  this.host=new HostCore({rate:sampleRate,block:128,instruments:INSTRUMENTS,assets:this.assets,history:false});
  for(const type of ['diagnostic','meter'])this.host.on(type,data=>this.port.postMessage({type,data}));
  this.host.on('sounding',data=>this.port.postMessage({type:'sounding',data}));
  this.started=false;
  // Load: the share of the audio thread's time the host takes — rendering, and the messages
  // that re-plan — reported twice a second, so a page can tell when a device is not keeping
  // up. The worklet may have no clock finer than Date.now; over half a second of calls its
  // millisecond steps average out.
  this.clock=globalThis.performance?.now?.bind(globalThis.performance)??Date.now;
  this.load={since:this.clock(),busy:0,peak:0,peakKind:'',kinds:{}};
  this.port.onmessage=({data})=>this.timed(String(data?.type??'message'),()=>{
   try{
    // Messages carry their reply id so the client can await them (offline tests do).
    let result;
    if(data.type==='configure'){result=this.host.configure(data.setup);this.warm(data.setup);}
    else if(data.type==='schedule')result=this.host.schedule(data.batch);
    else if(data.type==='cancel')result=this.host.cancel(data.cancel);
    else if(data.type==='audition')this.host.setAudition(data.audition);
    else if(data.type==='profile'){if(data.action==='start')this.host.profile(true);else{result=[];this.port.postMessage({type:'profile',data:this.host.profileSnapshot()});}}
    this.port.postMessage({type:'reply',id:data.id,diagnostics:result??[]});
   }catch(error){this.port.postMessage({type:'reply',id:data.id,error:String(error.message||error)});}
  });
 }
 // Warm-up. V8 compiles WebAssembly lazily, on a function's first call, so the first blocks
 // of a new instrument paid for it in the audio callback — ~30 ms on a laptop, enough on a
 // tablet to break up the first beats. While configuring (the page waits for the reply
 // before it starts the music), a throwaway host with the same instruments, chains and buses
 // plays one note per part for a fifth of a second: compiled code is shared by every
 // instance of a module, so the real host starts warm. Once per instrument kind and chain.
 warm(setup){
  try{
   const key=p=>[p.instrument?.kind,...(p.chain??[]).map(b=>b.type)].join(' '),fresh=setup.parts.filter(p=>INSTRUMENTS.has(p.instrument?.kind)&&!this.warmed.has(key(p)));
   if(!fresh.length)return;
   const scratch=new HostCore({rate:sampleRate,block:128,instruments:INSTRUMENTS,assets:this.assets,history:false});
   scratch.configure({...setup,parts:fresh.map(p=>({...p,strip:{...p.strip,mute:false,solo:false}}))});
   const target=p=>p.instrument.kind==='kit'?{piece:'snare'}:{pitch:p.instrument.kind==='plucked'?Math.min(...(p.instrument.layout?.strings??[{pitch:40}]).map(s=>s.pitch))+3:60};
   scratch.schedule({notes:fresh.map((p,i)=>({id:`warm-${i}`,part:p.id,at:.01,duration:.1,velocity:.5,target:target(p)})),through:1});
   for(let k=0;k<75;k++)scratch.render(128);
   for(const p of fresh)this.warmed.add(key(p));
  }catch{/* a cold start is slower, not wrong */}
 }
 // Each report also says what the time went on, by kind ('render', or the message type:
 // 'schedule', 'configure', 'cancel'…): its total, longest single stretch and stretches over
 // 8 ms (playbackTrace.ts in mnx-lab), and which kind the window's longest stretch was.
 timed(kind,work){
  const start=this.clock();work();const now=this.clock(),spent=now-start,load=this.load;
  load.busy+=spent;if(spent>load.peak){load.peak=spent;load.peakKind=kind;}
  const k=load.kinds[kind]??={ms:0,max:0,long:0};k.ms+=spent;k.max=Math.max(k.max,spent);if(spent>8)k.long++;
  if(now-load.since>=500){this.port.postMessage({type:'load',data:{busy:load.busy/(now-load.since),peakMs:load.peak,peakKind:load.peakKind,kinds:load.kinds,windowMs:now-load.since}});this.load={since:now,busy:0,peak:0,peakKind:'',kinds:{}};}
 }
 process(_,outputs){
  const output=outputs[0],n=output[0].length;
  if(!this.started){this.host.position=currentFrame;this.started=true;}
  this.timed('render',()=>{
   try{
    const [l,r]=this.host.render(n);output[0].set(l.subarray(0,n));output[1]?.set(r.subarray(0,n));
   }catch(error){output.forEach(c=>c.fill(0));this.port.postMessage({type:'error',message:String(error.message||error)});}
  });
  return true;
 }
}
registerProcessor('instrument-host',InstrumentHostProcessor);
