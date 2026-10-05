/** 039 offline variant: dominant-pitch@1 observations; frozen downstream logic inherited. */
import { BasicPitchChain } from './chain.ts';
export const BASIC_PITCH_CHAIN_2 = 'basic-pitch-chain@2';
export const DOMINANT_PITCH_POLICY = 'dominant-pitch@1: frame argmax note; lowest-bin tie; mask note/onset; official decoder defaults';
export class BasicPitchChain2 extends BasicPitchChain {}
