const note = (pitch,start,end,velocity=.7) => ({pitch,start,end,velocity});
const entry = (id,category,actual,target=actual) => ({id,category,actual,target:structuredClone(target),duration:Math.max(1.7,...actual.map(n=>n.end+.4)),split:"evaluation"});
export function fusionHeldoutV2() {
 return [
 entry("v2-silence","silence",[]),
 entry("v2-low-sustain","single",[note(43,.33,1.42)]),
 entry("v2-high-sustain","single",[note(75,.28,1.36,.4)]),
 entry("v2-short","single",[note(59,.37,.45)]),
 entry("v2-repeat-soft","repeated",[note(59,.28,.49),note(59,.63,.84,.3),note(59,.98,1.19,.8)]),
 entry("v2-restrike","repeated",[note(67,.32,.63),note(67,.63,.94,.45),note(67,.94,1.25)]),
 entry("v2-rapid","repeated",[0,1,2,3].map(i=>note(65,.29+i*.115,.375+i*.115))),
 entry("v2-ringing","arpeggio",[note(43,.29,1.5),note(62,.67,.9),note(62,1.05,1.28)]),
 entry("v2-arpeggio","arpeggio",[43,50,55,59].map((p,i)=>note(p,.32+i*.19,1.5))),
 entry("v2-strum","strum",[43,50,55,59,62,67].map((p,i)=>note(p,.31+i*.022,1.4))),
 entry("v2-wrong-inner","error",[note(55,.3,1.1),note(60,.3,1.1),note(62,.3,1.1)],[note(55,.3,1.1),note(59,.3,1.1),note(62,.3,1.1)]),
 entry("v2-quiet-extra","error",[note(50,.3,1.1),note(57,.3,1.1),note(61,.64,.91,.2)],[note(50,.3,1.1),note(57,.3,1.1)])
 ];
}
