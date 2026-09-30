/** Frozen hand cases only. This loader never computes the oracle's expected answers. */
import {readFileSync} from 'node:fs';
import {sha} from '../ladder/privateSets.ts';
import type {BarTruth,ExpectedAssessment3} from './assessment3.ts';
import type {PerformanceLabel} from './label.ts';
import type {MarginName,SentinelInput,StateCheck,Status} from './gates2.ts';
export interface BarCase {id:string;arithmetic:string;quarters:number[];ordinals:number[];onsets:number[];
  expected:Pick<ExpectedAssessment3,'overall'|'typical'|'clean'> & {bars:BarTruth[]};flags:[number,'slow'|'fast'][]}
export interface Oracle3 {format:'event-oracle@3';assessment:BarCase[];states:(StateCheck & {id:string;expected:Status})[];
  selection:{inputs:SentinelInput[];performances:string[];controls:string[]};marginCases:{name:MarginName;value:number;expected:number}[];
  retirement:{history:boolean[];harder:boolean;expected:boolean}[]}
export function readOracle3():Oracle3 {
  const bytes=readFileSync(new URL('../../oracle-events/oracle-3.json',import.meta.url));
  const freeze=JSON.parse(readFileSync(new URL('../../oracle-events/freeze-3.json',import.meta.url),'utf8'));
  if(sha(bytes)!==freeze.sha256)throw new Error('event-oracle@3 changed since freezing');
  return JSON.parse(bytes.toString());
}
export function caseLabel(c:BarCase):PerformanceLabel {
  const events=c.quarters.map((quarter,index)=>({index,quarter,at:{ordinal:c.ordinals[index]!,metricOffset:{num:String(c.ordinals[index]===c.ordinals[index-1]?1:0),den:c.ordinals[index]===c.ordinals[index-1]?'4':'1'}},notes:[{noteKey:`n${index}`,midi:60+index}]}));
  return {format:'performance-label@2',id:c.id,score:{path:`oracle:${c.id}`,sha256:null},handoff:{from:events[0]!.at,quartersPerMinute:90},duration:c.onsets.at(-1)!+1,audio:null,events,
    performance:{events:events.map(e=>({index:e.index,onset:c.onsets[e.index]!,distinguishableAt:c.onsets[e.index]!,notes:[{noteKey:`n${e.index}`,outcome:'matched',onset:c.onsets[e.index]!,end:c.onsets[e.index]!+.25}]})),extras:[]},
    cursor:{resolution:'event',segments:events.map(e=>({from:c.onsets[e.index]!,uncertainty:0,state:'supported',truth:e.index,admissible:[e.index],rule:['sounded']}))},
    provenance:{kind:'hand-worked',note:c.arithmetic}};
}
