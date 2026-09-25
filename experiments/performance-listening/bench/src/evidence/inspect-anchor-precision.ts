import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { anchorLimits } from '../v2/anchor-limits.ts';
const path=process.argv[2];
if(!path)throw new Error('Usage: tsx src/evidence/inspect-anchor-precision.ts <private-review.json>');
const bytes=readFileSync(path),packet=JSON.parse(bytes.toString('utf8'));
const rows=packet.rows.map((row: {piece:string;recording:number;clip:{sha256:string};anchors:{bar:number;offset:number;seconds:number;scoreQuarter:number|null}[]})=>{
 const selected=row.anchors.filter(a=>a.bar<=4&&a.offset===0).slice(0,5);
 if(selected.length!==5 || selected.some((a,i)=>a.bar!==i || a.scoreQuarter===null))throw new Error('Need the first five complete bar boundaries');
 const anchors=selected.map(a=>({seconds:a.seconds,quarter:a.scoreQuarter!}));
 const nominal=(anchors[4]!.quarter-anchors[0]!.quarter)/(anchors[4]!.seconds-anchors[0]!.seconds);
 const result=anchorLimits(anchors,nominal);
 return {piece:row.piece,recording:row.recording,clipSha256:row.clip.sha256,assumptions:result.assumptions,barCount:result.bars.length,maximumAnswerableFractionUnderAssumptions:Math.round(result.maximumAnswerableFractionUnderAssumptions*1e9)/1e9,worstPositionHalfWidthQuarters:Math.round(Math.max(...result.bars.map(b=>b.maxHalfWidthQuarters))*1e6)/1e6};
});
console.log(JSON.stringify({kind:'bar-anchor-precision-sensitivity',reviewSha256:createHash('sha256').update(bytes).digest('hex'),warning:'Optimistic assumption calculation, not accepted labels or a candidate assessment. Even exact endpoints cannot establish interior precision from bar counts alone.',requiredAnswerableFraction:.8,rows},null,2));
