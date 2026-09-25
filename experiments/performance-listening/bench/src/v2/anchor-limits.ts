/** Optimistic bound with exact endpoints and a continuously bounded local speed.
 * This is an assumption sensitivity calculation, never a source annotation. */
export function anchorLimits(anchors: { seconds: number; quarter: number }[], nominalQps: number) {
  if(anchors.length<2 || !Number.isFinite(nominalQps) || nominalQps<=0)throw new Error('Invalid anchor-limit input');
  const slow=.8*nominalQps,fast=1.2*nominalQps;
  let total=0,answerable=0;
  const bars=anchors.slice(1).map((right,i)=>{
    const left=anchors[i]!,duration=right.seconds-left.seconds,quarters=right.quarter-left.quarter;
    if(duration<=0 || quarters<=0 || quarters<slow*duration-1e-9 || quarters>fast*duration+1e-9)throw new Error('Anchor interval is outside the assumed tempo envelope');
    const width=(t:number)=>Math.max(0,Math.min(fast*t,quarters-slow*(duration-t))-Math.max(slow*t,quarters-fast*(duration-t)));
    const knots=[0,duration,(fast*duration-quarters)/(fast-slow),(quarters-slow*duration)/(fast-slow)].filter(t=>t>=0&&t<=duration).sort((a,b)=>a-b);
    let covered=0;
    for(let j=1;j<knots.length;j++){
      const a=knots[j-1]!,b=knots[j]!,wa=width(a),wb=width(b);
      if(wa<=.25 && wb<=.25)covered+=b-a;
      else if((wa<=.25)!==(wb<=.25))covered+=(b-a)*(.25-Math.min(wa,wb))/Math.abs(wb-wa);
    }
    total+=duration;answerable+=covered;
    return {durationSeconds:duration,quarters,maxHalfWidthQuarters:Math.max(...knots.map(width))/2,answerableFraction:covered/duration};
  });
  return {assumptions:'Exact cached bar endpoints and a known continuous 80–120% nominal speed bound; neither is independently established for these sources.',maximumAnswerableFractionUnderAssumptions:answerable/total,bars};
}
