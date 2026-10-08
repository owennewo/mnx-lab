// Trivial test instrument for host invariance tests: a sine per note with a short
// attack, gate-length sustain and a release that shortens when the part's next
// note starts within 50 ms of it. That makes its output depend on notes up to
// its horizon ahead, as the plucked instrument's does, so a host that renders
// past the commit horizon fails the batching tests. Natively renders nothing;
// every technique arrives through lower().
import {CONTRACT} from '../../contract/index.js';
const HORIZON=.05,ATTACK=.004;
export class TestTone{
 static kind='test-tone';
 static capabilities=Object.freeze({kind:'test-tone',contract:CONTRACT,revision:1,basic:true,targets:'pitch',range:Object.freeze({pitch:Object.freeze([0,127])}),
  techniques:Object.freeze([]),controls:Object.freeze([]),primitives:Object.freeze(['pitchCurve','gate','velocity','damping']),horizonSeconds:HORIZON});
 constructor({rate,block}){this.rate=rate;this.out=[new Float32Array(block),new Float32Array(block)];this.notes=new Map();this.order=[];this.position=0;this.outputGain=1;}
 configure(){}
 begin(frame){this.position=frame;}
 apply({notes=[],removed=[]}){
  for(const id of removed){this.notes.delete(id);}
  for(const e of notes){const old=this.notes.get(e.id);this.notes.set(e.id,{...e,phase:old?.phase??0});}
  this.order=[...this.notes.values()].sort((a,b)=>a.frame-b.frame||(a.id<b.id?-1:1));
 }
 cents(e,frame){
  const curve=e.primitives.pitchCurve;if(!curve)return 0;
  const x=Math.min(1,(frame-e.frame)/e.lengthFrames);
  for(let i=1;i<curve.length;i++)if(x<=curve[i].at){const a=curve[i-1],b=curve[i];return b.at===a.at?b.cents:a.cents+(b.cents-a.cents)*((x-a.at)/(b.at-a.at));}
  return curve.at(-1).cents;
 }
 render(n){
  const [L,R]=this.out,start=this.position,rate=this.rate,attack=ATTACK*rate,horizon=HORIZON*rate;L.fill(0,0,n);R.fill(0,0,n);
  for(let k=0;k<this.order.length;k++){
   const e=this.order[k];if(e.frame>=start+n)break;
   const next=this.order[k+1]?.frame??Infinity,release=next>e.endFrame&&next-e.endFrame<horizon?next-e.endFrame:horizon;
   if(e.endFrame+release<=start)continue;
   const pitch=e.lowered.target.pitch??60,damp=e.primitives.damping?.amount??0,level=e.lowered.velocity*.2*(1-.7*damp);
   for(let i=Math.max(0,e.frame-start);i<n;i++){
    const f=start+i,age=f-e.frame;if(f>=e.endFrame+release)break;
    const env=Math.min(1,age/attack)*(f<e.endFrame?1:1-(f-e.endFrame)/release);
    e.phase+=2*Math.PI*440*2**((pitch-69+this.cents(e,f)/100)/12)/rate;
    const x=level*env*Math.sin(e.phase);L[i]+=x;R[i]+=x;
   }
  }
  this.position+=n;return this.out;
 }
}
