import type { Delivery, Handoff, Emission } from '../../../listen/contract.ts';
import type { MnxStructure } from '../../../../../src/model/mnx.ts';
import { BasicPitchChain, type ObservationFrame } from './chain.ts';
import { NativeModel, WINDOW, FRAMES, localFrameTime, resamplePrefix } from './native.ts';
export class BasicPitchLive extends BasicPitchChain {
  private audio:number[]=[]; private modelAudio:number[]=[]; private next=0.1; private last=-Infinity;
  frames:ObservationFrame[]=[];
  parity:{input:Float32Array;maps:ReturnType<NativeModel['predict']>}|null=null;
  constructor(private model:NativeModel,private edge:0|15){super();}
  override start(score:MnxStructure,handoff:Handoff,delivery:Delivery){this.audio=[];this.modelAudio=[];this.next=.1;this.last=-Infinity;this.frames=[];this.parity=null;return super.start(score,handoff,delivery);}
  override feed(chunk:Float32Array,clock:number):Emission[]{
    super.feed(chunk,clock);for(const x of chunk)this.audio.push(x);
    this.modelAudio.push(...resamplePrefix(this.audio,this.modelAudio.length));
    if(clock+1e-9<this.next)return [];
    this.next+=.1;
    const start=this.modelAudio.length-WINDOW, input=new Float32Array(WINDOW);
    for(let i=0;i<WINDOW;i++)input[i]=this.modelAudio[start+i]??0;
    const maps=this.model.predict(input), out:Emission[]=[];
    if(!this.parity)this.parity={input:input.slice(),maps};
    for(let j=0;j<FRAMES-this.edge;j++) {
      const audioTime=localFrameTime(start,j);if(audioTime<0||audioTime<=this.last||audioTime>clock)continue;
      const note=maps.note.subarray(j*88,(j+1)*88);let bin=0;
      for(let b=1;b<88;b++)if(note[b]!>note[bin]!)bin=b;
      const confidence=note[bin]!, frame:ObservationFrame={audioTime,availableAt:clock,midi:confidence>=.3?bin+21:null,confidence,silent:confidence<.3};
      this.frames.push(frame);out.push(...this.observe(frame));this.last=audioTime;
    }
    return out;
  }
}
