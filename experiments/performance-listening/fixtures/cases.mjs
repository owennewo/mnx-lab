// Explicit schedules are an independent oracle for the renderer/evaluator adapter.
// No random generation in v1; seed=0 records that choice in every manifest.
const note = (pitch, start = .25, end = .95, velocity = .75) => ({pitch, start, end, velocity});
const chord = (pitches, velocity = .75) => pitches.map(p => note(p, .25, .95, velocity));
const entry = (id, category, target, actual = target, extra = {}) => ({
  id, category, target: structuredClone(target), actual: structuredClone(actual), ...extra,
});
export function cases() {
  const triad = chord([60, 64, 67]);
  const items = [entry('silence', 'silence', [])];
  for (const pitch of [40, 52, 64, 76, 88])
    for (const velocity of [.3, .8]) items.push(entry(`single-${pitch}-${velocity}`, 'single', [note(pitch, .25, .95, velocity)]));
  for (const [name, pitches] of Object.entries({octave:[48,60], fifth:[48,55], second:[60,61], third:[60,64]}))
    items.push(entry(`dyad-${name}`, 'dyad', chord(pitches)));
  for (const pitches of [[60,64,67], [48,55,60,64], [40,47,52,56,59], [40,47,52,56,59,64]])
    items.push(entry(`chord-${pitches.length}`, 'chord', chord(pitches)));
  items.push(
    entry('duplicate-pitch-voices', 'chord', chord([48,55,60,64,67,67])),
    entry('quiet-inner', 'masking', triad.map((n,i)=>({...n, velocity:i===1?.12:.8}))),
    entry('wrong-inner', 'error', triad, chord([60,65,67]), {mutation:'wrong'}),
    entry('quiet-wrong-inner', 'error', triad, chord([60,65,67]).map((n,i)=>({...n,velocity:i===1?.12:.8})), {mutation:'wrong'}),
    entry('missing-inner', 'error', triad, chord([60,67]), {mutation:'missing'}),
    entry('extra-note', 'error', triad, chord([60,64,66,67]), {mutation:'extra'}),
    entry('early-note', 'error', [note(60)], [note(60,.1,.8)], {mutation:'early'}),
    entry('late-note', 'error', [note(60)], [note(60,.45,1.15)], {mutation:'late'}),
    entry('repeated', 'repeated', [.25,.65,1.05].map(s=>note(60,s,s+.25))),
    entry('restrike-no-gap', 'repeated', [.25,.6,.95].map(s=>note(60,s,s+.35))),
    entry('alternating', 'sequence', [60,64,60,64].map((p,i)=>note(p,.25+i*.3,.5+i*.3))),
    entry('strum', 'strum', [40,47,52,56,59,64].map((p,i)=>note(p,.25+i*.025,1.1))),
    entry('arpeggio', 'overlap', [48,55,60,64].map((p,i)=>note(p,.25+i*.2,1.3))),
    entry('bend', 'bend', [{...note(60,.25,1.25), bend:{start:.55,end:.8,cents:200}}]),
  );
  return items.map(c=>({...c, duration:Math.max(1.4,...c.actual.map(n=>n.end+.4)), split:'evaluation'}));
}
export function templateCases(config) {
  return Array.from({length:config.midiMax-config.midiMin+1},(_,i)=>({
    ...entry(`template-${i+config.midiMin}`, 'template', [note(i+config.midiMin,.25,.85,.65)]),
    duration:1.2, split:'template',
  }));
}
