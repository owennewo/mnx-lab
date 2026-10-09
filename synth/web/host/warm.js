// Warm-up. V8 compiles WebAssembly lazily, on a function's first call, so the first blocks
// of a new instrument paid for it in the audio callback — ~30 ms on a laptop, enough on a
// tablet to break up the first beats. While configuring (the page waits for the reply
// before it starts the music), a throwaway host with the same instruments, chains and buses
// plays one note per part for a fifth of a second: compiled code is shared by every
// instance of a module, so the real host starts warm. Once per instrument kind and chain
// (`warmed` remembers them).
// Pitch curves take their own path through the plucked planner.
const TECHNIQUES=[undefined,{type:'vibrato',depthCents:20,rateHz:5},{type:'bend',points:[{at:0,cents:0},{at:1,cents:100}]}];
const ROUNDS=5,shift=(t,k)=>t.pitch===undefined?t:{pitch:t.pitch+5*k};
export function warmHost(setup,{rate,block,instruments,assets,HostCore},warmed){
 try{
  const key=p=>[p.instrument?.kind,...(p.chain??[]).map(b=>b.type)].join(' '),fresh=setup.parts.filter(p=>instruments.has(p.instrument?.kind)&&!warmed.has(key(p)));
  if(!fresh.length)return;
  const scratch=new HostCore({rate,block,instruments,assets,history:false});
  scratch.configure({...setup,parts:fresh.map(p=>({...p,strip:{...p.strip,mute:false,solo:false}}))});
  const target=p=>p.instrument.kind==='kit'?{piece:'snare'}:{pitch:p.instrument.kind==='plucked'?Math.min(...(p.instrument.layout?.strings??[{pitch:40}]).map(s=>s.pitch))+3:60};
  // A few batches of notes, re-planned as playback re-plans them, so the planner is
  // compiled too: cold, a tablet's first batches took 10–30 ms of the audio thread.
  for(let batch=0;batch<ROUNDS;batch++){
   scratch.schedule({notes:fresh.flatMap((p,i)=>Array.from({length:3},(_,k)=>({id:`warm-${i}-${batch}-${k}`,part:p.id,at:.01+(3*batch+k)*.02,duration:.15,velocity:.5,target:shift(target(p),k),...(p.instrument.kind==='plucked'&&TECHNIQUES[k]?{techniques:[TECHNIQUES[k]]}:{})}))),through:1});
   for(let k=0;k<75/ROUNDS;k++)scratch.render(block);
  }
  for(const p of fresh)warmed.add(key(p));
 }catch{/* a cold start is slower, not wrong */}
}
