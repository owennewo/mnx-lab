const n=(pitch,start,end,velocity=.7)=>({pitch,start,end,velocity});
const entry=(id,category,actual,target=actual)=>({id:`v5-${id}`,category,actual,target:structuredClone(target),duration:Math.max(2,...actual.map(n=>n.end+.4)),split:'evaluation'});
export function fusionHeldoutV5(){return [
 entry('silence','silence',[]),
 entry('low-f','single',[n(41,.37,1.53)]),
 entry('low-g','single',[n(43,.39,1.61)]),
 entry('upper','single',[n(70,.36,.91,.45)]),
 entry('bass-upper','mixture',[n(41,.37,1.53),n(70,.37,.93,.45)]),
 entry('octave','octave',[n(43,.38,1.54),n(55,.38,1.54,.35)]),
 entry('double-octave','octave',[n(46,.41,1.59,.5),n(70,.41,1.59,.5)]),
 entry('quiet-inner','chord',[n(43,.36,1.52),n(58,.36,1.52,.22),n(65,.36,1.52),n(70,.36,1.52,.5)]),
 entry('short','single',[n(65,.43,.515,.5)]),
 entry('restrike','repeated',[n(62,.37,.72),n(62,.72,1.07,.45),n(62,1.07,1.42)]),
 entry('ringing','arpeggio',[n(43,.36,1.78),n(67,.74,1.02,.35),n(67,1.22,1.5,.45)]),
 entry('strum','strum',[43,50,55,59,62,67].map((p,i)=>n(p,.37+i*.021,1.65))),
 entry('wrong','error',[n(55,.37,1.5),n(62,.37,1.5),n(65,.37,1.5)],[n(55,.37,1.5),n(61,.37,1.5),n(65,.37,1.5)]),
 entry('extra','error',[n(50,.36,1.55),n(57,.36,1.55),n(61,.83,1.13,.23)],[n(50,.36,1.55),n(57,.36,1.55)])
]}
