const n=(pitch,start,end,velocity=.7)=>({pitch,start,end,velocity});
const entry=(id,category,actual,target=actual)=>({id,category,actual,target:structuredClone(target),duration:Math.max(1.8,...actual.map(n=>n.end+.4)),split:"evaluation"});
export function fusionHeldoutV4(){return [
entry("v4-silence","silence",[]),
entry("v4-low","single",[n(44,.32,1.48)]),
entry("v4-high","single",[n(86,.33,1.47,.4)]),
entry("v4-short","single",[n(61,.34,.435)]),
entry("v4-repeat","repeated",[n(61,.33,.57),n(61,.71,.95,.35),n(61,1.09,1.33)]),
entry("v4-restrike","repeated",[n(68,.31,.64),n(68,.64,.97,.5),n(68,.97,1.3)]),
entry("v4-rapid","repeated",[0,1,2,3].map(i=>n(66,.3+i*.125,.395+i*.125))),
entry("v4-octaves","repeated",[.31,.73,1.15].flatMap(t=>[n(49,t,t+.26),n(61,t,t+.26,.45)])),
entry("v4-fifths","repeated",[.32,.74,1.16].flatMap(t=>[n(48,t,t+.25,.45),n(67,t,t+.25,.8)])),
entry("v4-ringing-bass","arpeggio",[n(44,.3,1.62,.8),n(68,.73,.98,.3),n(68,1.14,1.39,.4)]),
entry("v4-arpeggio","arpeggio",[44,51,56,60].map((p,i)=>n(p,.31+i*.18,1.52))),
entry("v4-strum","strum",[44,51,56,60,63,68].map((p,i)=>n(p,.3+i*.026,1.42))),
entry("v4-wrong","error",[n(56,.32,1.15),n(61,.32,1.15),n(63,.32,1.15)],[n(56,.32,1.15),n(60,.32,1.15),n(63,.32,1.15)]),
entry("v4-extra","error",[n(51,.31,1.19),n(58,.31,1.19),n(62,.72,1,.2)],[n(51,.31,1.19),n(58,.31,1.19)])
];}
