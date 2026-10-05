import { workerData } from 'node:worker_threads';
import * as ort from 'onnxruntime-node';
const {signal,input,output,model}=workerData;
const state=new Int32Array(signal),x=new Float32Array(input),y=new Float32Array(output);
try {
 const session=await ort.InferenceSession.create(model,{executionProviders:['cpu'],intraOpNumThreads:1,interOpNumThreads:1});
 Atomics.store(state,0,1);Atomics.notify(state,0);
 for(;;){
  while(Atomics.load(state,0)===1)Atomics.wait(state,0,1);
  if(Atomics.load(state,0)===3)break;
  const begin=Atomics.load(state,1),len=172-begin;
  const result=await session.run({'serving_default_input_2:0':new ort.Tensor('float32',x,[1,43844,1]),'neural_start':new ort.Tensor('int64',BigInt64Array.of(BigInt(begin)),[1])});
  let offset=0;
  for(const [name,bins] of [['StatefulPartitionedCall:1',88],['StatefulPartitionedCall:2',88],['StatefulPartitionedCall:0',264]]){
   const tensor=result[name];if(tensor.dims.join(',')!==[1,len,bins].join(','))throw new Error(`Wrong output shape ${name}: ${tensor.dims}`);
   y.set(tensor.data,offset);offset+=tensor.data.length;
  }
  Atomics.store(state,0,1);Atomics.notify(state,0);
 }
 await session.release();
}catch(e){Atomics.store(state,0,-1);Atomics.notify(state,0);throw e;}
