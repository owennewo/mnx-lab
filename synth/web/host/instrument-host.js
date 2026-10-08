// Main-thread InstrumentHost (contract §6) over the AudioWorklet processor.
// Works with a live AudioContext or an OfflineAudioContext.
const json=url=>fetch(url).then(r=>{if(!r.ok)throw Error(`Missing ${url}`);return r.json();});
const load=async(base,name)=>{
 const [bytes,meta]=await Promise.all([fetch(`${base}${name}.wasm`).then(r=>{if(!r.ok)throw Error(`Missing ${name}.wasm`);return r.arrayBuffer();}),fetch(`${base}${name}.json`).then(r=>r.json())]);
 return {module:await WebAssembly.compile(bytes),meta};
};
const BLOCKS=['drive','vibrato','tremolo','echo','room','master'];
export async function loadHostAssets(base=new URL('../generated/',import.meta.url).href){
 const [blocks,guitar,factory,loudness,keys,kit]=await Promise.all([Promise.all(BLOCKS.map(b=>load(base,'blocks/'+b))),load(base,'instrument-v2/guitar'),
  json(new URL('../data/instrument-v2/presets.json',base).href),json(new URL('../data/instrument-v2/loudness.json',base).href),load(base,'basic/keys'),load(base,'basic/kit')]);
 return {blocks:Object.fromEntries(BLOCKS.map((b,i)=>[b,blocks[i]])),instruments:{plucked:{guitar,factory,loudness},keys:{keys},kit:{kit}}};
}
export class InstrumentHost{
 static async create(context,{assets}={}){
  assets??=await loadHostAssets();
  await context.audioWorklet.addModule(new URL('./host-processor.js',import.meta.url));
  const node=new AudioWorkletNode(context,'instrument-host',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{assets}});
  return new InstrumentHost(context,node);
 }
 constructor(context,node){
  this.context=context;this.node=node;this.listeners=new Map();this.pending=new Map();this.nextId=1;
  node.port.onmessage=({data})=>{
   if(data.type==='reply'){const p=this.pending.get(data.id);this.pending.delete(data.id);if(data.error)p?.reject(Error(data.error));else p?.resolve(data.diagnostics);return;}
   for(const fn of this.listeners.get(data.type)??[])fn(data.data??data);
  };
 }
 request(message){const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.node.port.postMessage({...message,id});});}
 configure(setup){return this.request({type:'configure',setup});}
 schedule(batch){return this.request({type:'schedule',batch});}
 cancel(cancel){return this.request({type:'cancel',cancel});}
 audition(audition){return this.request({type:'audition',audition});}
 now(){return this.context.currentTime;}
 // Live per-part cost metering; snapshot() resolves with the processor's report.
 async profile(action){if(action==='start')return this.request({type:'profile',action});const report=new Promise(resolve=>{const off=this.on('profile',d=>{off();resolve(d);});});await this.request({type:'profile',action});return report;}
 on(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);return ()=>this.listeners.get(type).delete(fn);}
 connect(destination=this.context.destination){this.node.connect(destination);return this;}
 dispose(){this.node.disconnect();this.node.port.onmessage=null;for(const p of this.pending.values())p.reject(Error('Host disposed'));this.pending.clear();}
}
