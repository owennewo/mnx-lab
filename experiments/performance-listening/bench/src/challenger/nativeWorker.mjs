import { workerData } from 'node:worker_threads';
import * as ort from 'onnxruntime-node';
const { signal, input, output, model } = workerData;
const state = new Int32Array(signal), x = new Float32Array(input), y = new Float32Array(output);
try {
  const session = await ort.InferenceSession.create(model, { executionProviders:['cpu'], intraOpNumThreads:1, interOpNumThreads:1 });
  Atomics.store(state,0,1); Atomics.notify(state,0);
  for (;;) {
    while (Atomics.load(state,0) === 1) Atomics.wait(state,0,1);
    if (Atomics.load(state,0) === 3) break;
    const r = await session.run({'serving_default_input_2:0':new ort.Tensor('float32', x, [1,43844,1])});
    let offset=0;
    for (const name of ['StatefulPartitionedCall:1','StatefulPartitionedCall:2','StatefulPartitionedCall:0']) {
      y.set(r[name].data,offset); offset+=r[name].data.length;
    }
    Atomics.store(state,0,1); Atomics.notify(state,0);
  }
  await session.release();
} catch(e) { Atomics.store(state,0,-1); Atomics.notify(state,0); throw e; }
