// Conformance checks off the main thread: offline renders through the same host
// code, then the fixture's expectations. Also returns labels and diagnostics.
import {loadHostAssets,INSTRUMENTS,renderOffline,effectiveEvents} from '../host/index.js';
import {runFixture} from '../contract/conformance/index.js';
let assets;
self.onmessage=async({data})=>{
 try{
  assets??=await loadHostAssets();
  const render=args=>renderOffline({...args,instruments:INSTRUMENTS,assets});
  const f=data.fixture,{notes,controls}=effectiveEvents(f),rate=f.render?.rate??48000,seconds=f.render?.seconds??Math.max(1,...notes.map(n=>n.at+n.duration))+2;
  const full=render({setup:f.setup,...(f.batches?{batches:f.batches}:{notes,controls}),rate,seconds});
  const result=f.expect?.length?await runFixture(f,{render}):null;
  self.postMessage({id:data.id,labels:full.labels,diagnostics:full.diagnostics,result});
 }catch(error){self.postMessage({id:data.id,error:String(error.message||error)});}
};
