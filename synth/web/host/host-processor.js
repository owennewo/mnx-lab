// AudioWorklet hosting the instrument host: N parts, one room bus, master. The host
// clock is the AudioContext frame counter, so note times are context seconds (D5).
import {HostCore} from './host-core.js';
import {INSTRUMENTS} from './instruments/index.js';
class InstrumentHostProcessor extends AudioWorkletProcessor{
 constructor(options){
  super();
  this.host=new HostCore({rate:sampleRate,block:128,instruments:INSTRUMENTS,assets:options.processorOptions.assets});
  for(const type of ['diagnostic','meter'])this.host.on(type,data=>this.port.postMessage({type,data}));
  this.host.on('sounding',data=>this.port.postMessage({type:'sounding',data}));
  this.started=false;
  this.port.onmessage=({data})=>{
   try{
    // Messages carry their reply id so the client can await them (offline tests do).
    let result;
    if(data.type==='configure')result=this.host.configure(data.setup);
    else if(data.type==='schedule')result=this.host.schedule(data.batch);
    else if(data.type==='cancel')result=this.host.cancel(data.cancel);
    else if(data.type==='audition')this.host.setAudition(data.audition);
    else if(data.type==='profile'){if(data.action==='start')this.host.profile(true);else{result=[];this.port.postMessage({type:'profile',data:this.host.profileSnapshot()});}}
    this.port.postMessage({type:'reply',id:data.id,diagnostics:result??[]});
   }catch(error){this.port.postMessage({type:'reply',id:data.id,error:String(error.message||error)});}
  };
 }
 process(_,outputs){
  const output=outputs[0],n=output[0].length;
  if(!this.started){this.host.position=currentFrame;this.started=true;}
  try{
   const [l,r]=this.host.render(n);output[0].set(l.subarray(0,n));output[1]?.set(r.subarray(0,n));
  }catch(error){output.forEach(c=>c.fill(0));this.port.postMessage({type:'error',message:String(error.message||error)});}
  return true;
 }
}
registerProcessor('instrument-host',InstrumentHostProcessor);
