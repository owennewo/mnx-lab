/** Frozen arithmetic and synthetic inputs. This adapter never derives expected answers. */
import {readFileSync} from 'node:fs';
import {sha} from '../ladder/privateSets.ts';
import {caseLabel,type BarCase, type Oracle3} from './oracle3.ts';
import type {PerformanceLabel} from './label.ts';
import type {BarSummary,AssessmentEvaluation3} from './assessment3.ts';
import type {PlanSubstage,Status,MarginName,SentinelInput} from './gates2.ts';
export interface BarCase4 extends Omit<BarCase,'onsets'> {onsets:(number|null)[]}
export interface ReportCase4 {id:string;case:string;bars:BarSummary[];flags:[number,'slow'|'fast'][];
 expected:Pick<AssessmentEvaluation3,'flags'|'falseFindings'|'clean'|'barReports'> & {gatesPassed:boolean}}
export interface IntervalCase4 {id:string;expectedSeconds:number;errorSeconds:number;expected?:number;reject?:boolean}
export interface ExampleCase4 {id:string;supported:boolean;onEvent?:number;ahead?:number;rejection?:number;exposure:number;longest:number;
 delays?: (number|null)[];overallError?:number;intervals?:Omit<IntervalCase4,'id'>[];sustained:number;p99:number;gates:boolean;causality:boolean[];answerable?:number;expected?:number;reject?:boolean}
export interface Oracle4 extends Omit<Oracle3,'format'|'assessment'> {
 format:'event-oracle@4';assessment:BarCase4[];reports:ReportCase4[];
 pools:{id:string;reports:string[];failed:string[]}[];
 requiredEvidence:{id:string;evidence:Record<string,boolean|null>;before:Status;attempted:boolean;fullSweep:boolean;sentinelsPassed:boolean;expected:Status}[];
 selectionCases:{id:string;inputs:(Omit<SentinelInput,'margin'> & {margin:number|string})[];performances:string[]|null;controls:string[]|null;reject:boolean}[];
 parentScoreCase:{id:string;performances:{id:string;score:string}[];controls:{id:string;parent:string;handedScore:string;kind:'silence'|'wrong-score';margin:number}[];performanceMargin:number;expected:{performances:string[];controls:string[]}};
 marginRejects:{id:string;name:MarginName;value:number|string}[];intervalMargins:IntervalCase4[];exampleMargins:ExampleCase4[];
 plans:{id:string;stages:PlanSubstage[];attempted:string[];fullSweep:boolean;expected?:string[];reject?:boolean}[];
}
export function readOracle4():Oracle4 {
 const bytes=readFileSync(new URL('../../oracle-events/oracle-4.json',import.meta.url));
 const freeze=JSON.parse(readFileSync(new URL('../../oracle-events/freeze-4.json',import.meta.url),'utf8'));
 if(sha(bytes)!==freeze.sha256)throw new Error('event-oracle@4 changed since freezing');
 return JSON.parse(bytes.toString());
}
export function caseLabel4(c:BarCase4):PerformanceLabel {
 const label=caseLabel({...c,onsets:c.onsets.map(t=>t??0)});
 // Null means missing. Filter the corresponding segment, without replacing its note truth.
 label.performance.events=label.performance.events.map((p,i)=>c.onsets[i]===null?
  {index:i,onset:null,distinguishableAt:null,notes:[{noteKey:`n${i}`,outcome:'missing'}]}:p);
 label.cursor.segments=label.cursor.segments.filter(s=>c.onsets[s.truth!]!==null);
 return label;
}
