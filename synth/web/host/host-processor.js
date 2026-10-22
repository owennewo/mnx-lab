// AudioWorklet hosting the instrument host: N parts, one room bus, master. The host
// clock is the AudioContext frame counter, so note times are context seconds (D5).
import {HostCore} from './host-core.js';
import {INSTRUMENTS} from './instruments/index.js';
import {warmHost} from './warm.js';
class InstrumentHostProcessor extends AudioWorkletProcessor{
 constructor(options){
  super();
  this.assets=options.processorOptions.assets;this.warmed=new Set();
  this.host=new HostCore({rate:sampleRate,block:128,instruments:INSTRUMENTS,assets:this.assets,history:false});
  for(const type of ['diagnostic','meter'])this.host.on(type,data=>this.port.postMessage({type,data}));
  this.host.on('sounding',data=>this.port.postMessage({type:'sounding',data}));
  this.started=false;
  // Blocks where the browser's frame had moved on from the host's, and the frames skipped:
  // running totals since the processor started, sent with each load report.
  this.skips={count:0,frames:0};
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
 // Warm-up (warm.js), while configuring: the page waits for the reply before it plays.
 warm(setup){warmHost(setup,{rate:sampleRate,block:128,instruments:INSTRUMENTS,assets:this.assets,HostCore},this.warmed);}
 // Each report also says what the time went on, by kind ('render', or the message type:
 // 'schedule', 'configure', 'cancel'…): its total, longest single stretch and stretches over
 // 8 ms (playbackTrace.ts in mnx-lab), and which kind the window's longest stretch was.
 timed(kind,work){
  const start=this.clock();work();const now=this.clock(),spent=now-start,load=this.load;
  load.busy+=spent;if(spent>load.peak){load.peak=spent;load.peakKind=kind;}
  const k=load.kinds[kind]??={ms:0,max:0,long:0};k.ms+=spent;k.max=Math.max(k.max,spent);if(spent>8)k.long++;
  if(now-load.since>=500){this.port.postMessage({type:'load',data:{busy:load.busy/(now-load.since),peakMs:load.peak,peakKind:load.peakKind,kinds:load.kinds,windowMs:now-load.since,
   skipsTotal:this.skips.count,skippedMsTotal:this.skips.frames/sampleRate*1000}});this.load={since:now,busy:0,peak:0,peakKind:'',kinds:{}};}
 }
 // The host renders at the browser's frame, every block. It used to take the frame once and
 // count blocks from there; when the browser moved on without asking for some, every note
 // after came out that much late until the page was reloaded (0.64 s, seen 2026-10-22).
 process(_,outputs){
  const output=outputs[0],n=output[0].length,host=this.host;
  if(this.started&&currentFrame!==host.position){this.skips.count++;this.skips.frames+=currentFrame-host.position;}
  this.started=true;
  this.timed('render',()=>{
   try{
    const [l,r]=host.render(n,currentFrame);output[0].set(l.subarray(0,n));output[1]?.set(r.subarray(0,n));
   }catch(error){output.forEach(c=>c.fill(0));this.port.postMessage({type:'error',message:String(error.message||error)});}
  });
  return true;
 }
}
registerProcessor('instrument-host',InstrumentHostProcessor);
