const n=(pitch,start,end,velocity=.7)=>({pitch,start,end,velocity});
const entry=(id,category,actual,target=actual)=>({id,category,actual,target:structuredClone(target),duration:Math.max(1.75,...actual.map(n=>n.end+.4)),split:"evaluation"});
export function fusionHeldoutV3(){return [
entry("v3-silence","silence",[]),
entry("v3-sustain-low","single",[n(46,.34,1.46)]),
entry("v3-sustain-high","single",[n(78,.3,1.42,.4)]),
entry("v3-short","single",[n(58,.36,.445)]),
entry("v3-repeat","repeated",[n(58,.3,.52),n(58,.66,.88,.35),n(58,1.02,1.24)]),
entry("v3-restrike","repeated",[n(70,.3,.64),n(70,.64,.98,.5),n(70,.98,1.32)]),
entry("v3-rapid","repeated",[0,1,2,3].map(i=>n(63,.32+i*.12,.41+i*.12))),
entry("v3-adjacent","repeated",[.31,.72,1.13].flatMap(t=>[n(63,t,t+.25),n(64,t,t+.25)])),
entry("v3-quiet-adjacent","repeated",[.32,.75,1.18].flatMap(t=>[n(66,t,t+.24),n(67,t,t+.24,.25)])),
entry("v3-ringing","arpeggio",[n(46,.31,1.55),n(65,.69,.94),n(65,1.09,1.34)]),
entry("v3-arpeggio","arpeggio",[46,53,58,62].map((p,i)=>n(p,.3+i*.18,1.5))),
entry("v3-strum","strum",[46,53,58,62,65,70].map((p,i)=>n(p,.32+i*.024,1.4))),
entry("v3-wrong","error",[n(58,.31,1.13),n(63,.31,1.13),n(65,.31,1.13)],[n(58,.31,1.13),n(62,.31,1.13),n(65,.31,1.13)]),
entry("v3-extra","error",[n(53,.32,1.18),n(60,.32,1.18),n(64,.7,.98,.22)],[n(53,.32,1.18),n(60,.32,1.18)])
];}
