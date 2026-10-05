/** Additional seam-5 observable fixtures; frozen kernels remain unchanged. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXPERIMENT, sha256 } from '../io.ts';
import { StreamingInput3, SerialLane3, type TimedPayload } from './streaming3.ts';
import { oracle4, evaluate4, hand4, equal4 } from './seam4.ts';
import { readObservationOracle2, evaluateHandCase, type HandCase } from './validateObservation2.ts';
import { readObservationOracle3, evaluate3 } from './validateObservation3.ts';
export type Fault5 = 'finish-flush' | 'finish-backdate' | 'finish-history-alias' | 'unsafe-integer';
interface FinishInput5 {
 setup: number; startEmissions: TimedPayload[];
 feed: { samples: number; tail: number; service: number; zeroMaps: boolean; emissions: TimedPayload[] };
 finish: number; finishEmissions: TimedPayload[]; continuation: number[];
}
export function oracle5(): HandCase[] {
 const bytes = readFileSync(join(EXPERIMENT, 'bench/oracle-events/observation-seam-5.json'));
 const freeze = JSON.parse(readFileSync(join(EXPERIMENT, 'bench/oracle-events/freeze-observation-seam-5.json'), 'utf8'));
 const cases = JSON.parse(bytes.toString()).cases as HandCase[];
 if (sha256(bytes) !== freeze.sha256 || cases.length !== freeze.cases || new Set(cases.map(c => c.id)).size !== freeze.cases) throw new Error('Frozen seam5 changed');
 return cases;
}
/** Physical expectations are exact bits; inherited abstract/time tolerance is unchanged. */
export function same5(actual: unknown, expected: unknown): boolean {
 if (expected && typeof expected === 'object' && 'f32Bits' in expected) {
  if (typeof actual !== 'number') return false;
  const bytes = Buffer.alloc(4); bytes.writeFloatBE(actual);
  return bytes.toString('hex') === (expected as {f32Bits:string}).f32Bits;
 }
 if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((v,i) => same5(actual[i],v));
 if (expected && typeof expected === 'object' && !('numerator' in expected)) return !!actual && typeof actual === 'object' && Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([k,v]) => same5((actual as Record<string,unknown>)[k],v));
 return equal4(actual, hand4(expected));
}
export function evaluate5(c: HandCase, fault?: Fault5): unknown {
 if (c.op !== 'finishState5') {
  if (fault === 'unsafe-integer' && c.op === 'invalidLength') {
   const length = (hand4(c.input) as {length:number}).length;
   return !Number.isInteger(length) || length < 0; // Deliberately wrong validation probe.
  }
  return evaluate4(c);
 }
 const v = hand4(c.input) as FinishInput5;
 const input = new StreamingInput3(), lane = new SerialLane3();
 let modelCalls = 0;
 // A map-producing backend would be called at these scheduled feed boundaries.
 const originalFrames = input.frames.bind(input);
 input.frames = (...args: Parameters<StreamingInput3['frames']>) => { modelCalls++; return originalFrames(...args); };
 lane.start(v.setup, v.startEmissions);
 const completions = [lane.completion];
 const chunk = new Float32Array(v.feed.samples); chunk[chunk.length-1] = v.feed.tail;
 if (input.feed(chunk) && v.feed.zeroMaps) input.frames(new Float32Array(172*88));
 lane.call(input.samples/48000, v.feed.service, v.feed.emissions); completions.push(lane.completion);
 const snapshot = () => ({samples:input.samples,generated:input.generated,retainedInput:input.retainedInput,retainedModel:input.retainedModel,nextSamples:input.nextSamples,watermark:input.watermark});
 const before = snapshot(), oldWindow = Buffer.from(input.window().buffer), modelCallsBefore = modelCalls;
 const oldHistory = JSON.stringify(lane.history), oldCount = lane.history.length;
 if (fault === 'finish-flush') input.feed(Float32Array.of(v.feed.tail)); // Forbidden tail neighbor.
 const finishFrames = input.finish(), after = snapshot(), newWindow = Buffer.from(input.window().buffer);
 const finishDecisions = lane.call(input.samples/48000, v.finish, v.finishEmissions); completions.push(lane.completion);
 if (fault === 'finish-backdate') finishDecisions.forEach((e,i) => { e.madeAt = v.finishEmissions[i]!.madeAt!; });
 const returnedFinish = structuredClone(finishDecisions);
 const oldHistoryUnchanged = oldHistory === JSON.stringify(lane.history.slice(0,oldCount));
 const appendedFinishMatches = equal4(lane.history.slice(oldCount),finishDecisions);
 const savedHistory = JSON.stringify(lane.history);
 const returned: TimedPayload[] = fault === 'finish-history-alias' ? lane.history.slice(oldCount) : finishDecisions;
 if (returned.length) { returned[0]!.refersTo = -1; returned[0]!.id = 'mutated-return'; }
 const returnedMutationIsolated = savedHistory === JSON.stringify(lane.history);
 const result = {before,after,windowBitsEqual:oldWindow.equals(newWindow),finishFrames,
  modelCallsBefore,modelCallsAfter:modelCalls,completions,work:lane.work,ratio:lane.cost(before.samples/48000).ratio,
  returnedFinish,oldHistoryUnchanged,appendedFinishMatches,historyCount:lane.history.length,returnedMutationIsolated,
  continuation:null as null | {generated:number;retainedInput:number;retainedModel:number;last:number}};
 if (v.continuation.length) {
  input.feed(Float32Array.from(v.continuation));
  result.continuation = {generated:input.generated,retainedInput:input.retainedInput,retainedModel:input.retainedModel,last:input.window().at(-1)!};
 }
 return result;
}
export function check5(c: HandCase) { const actual=evaluate5(c); return {id:c.id,actual,expected:hand4(c.expected),agrees:same5(actual,c.expected),arithmetic:c.arithmetic}; }
export function* inherited5() {
 for (const c of oracle4()) { const actual=evaluate4(c); yield {id:'seam4-'+c.id,actual,expected:hand4(c.expected),agrees:same5(actual,c.expected)}; }
 for (const c of readObservationOracle2()) { const actual=evaluateHandCase(c); yield {id:'seam2-'+c.id,actual,expected:hand4(c.expected),agrees:equal4(actual,hand4(c.expected))}; }
 for (const c of readObservationOracle3().filter(c=>!['S5','O11'].includes(c.id))) { const actual=evaluate3(c); yield {id:'seam3-'+c.id,actual,expected:hand4(c.expected),agrees:equal4(actual,hand4(c.expected))}; }
}
export function probes5() {
 const cases=oracle5();
 const assignments: [Fault5,string][] = [['finish-flush','S10'],['finish-backdate','S11'],['finish-history-alias','S11'],['unsafe-integer','O19']];
 return assignments.map(([fault,id]) => { const c=cases.find(c=>c.id===id)!;const actual=evaluate5(c,fault);return {fault,id,actual,detected:!same5(actual,c.expected)}; });
}
