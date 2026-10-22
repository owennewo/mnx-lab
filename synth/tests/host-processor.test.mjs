// The worklet processor (web/host/host-processor.js) under a stand-in AudioWorkletGlobalScope:
// it renders at the browser's frame every block, and counts the frames the browser skipped.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACT} from '../web/contract/index.js';
import {hostAssets} from '../web/host/node-assets.js';

const posted=[];let Processor;
Object.assign(globalThis,{
 sampleRate:48000,currentFrame:0,
 AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>posted.push(m)};}},
 registerProcessor:(name,cls)=>{Processor=cls;},
});
await import('../web/host/host-processor.js');

test('the processor renders at the browser frame and reports the frames it skipped',()=>{
 const processor=new Processor({processorOptions:{assets:hostAssets()}});
 processor.port.onmessage({data:{type:'configure',id:1,setup:{contract:CONTRACT,session:{buses:[],master:{}},parts:[{id:'a',instrument:{kind:'test-tone',design:'x'}}]}}});
 let wall=0;processor.clock=()=>wall;processor.load.since=0;
 const outputs=[[new Float32Array(128),new Float32Array(128)]];
 const block=frame=>{globalThis.currentFrame=frame;processor.process([],outputs);};
 // The first block starts wherever the context's clock already is: not a skip.
 for(let frame=4864;frame<48000;frame+=128)block(frame);
 block(48000+30720);
 assert.equal(processor.host.position,48000+30720+128);
 wall=600;block(48000+30720+128);
 const load=posted.filter(m=>m.type==='load').at(-1)?.data;
 assert.equal(load?.skipsTotal,1);
 assert.equal(load?.skippedMsTotal,640);
});
