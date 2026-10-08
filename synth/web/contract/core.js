// mnx-sound/2: shared constants, time rule, kit vocabulary, capabilities and
// diagnostics. Plain data; no DOM, no audio, no dependency on web/model.
export const CONTRACT='mnx-sound/2';
export const KINDS=Object.freeze(['plucked','keys','kit']);
export const TECHNIQUES=Object.freeze(['bend','vibrato','slide','legato','mute','harmonic','letRing']);
// tempo is session-wide (no part): the stream carries the tempo, tempo-synced blocks follow it (C16).
export const CONTROLS=Object.freeze(['sustainPedal','mute','tempo']);
// Tempo before the stream's first tempo control (the MIDI and MusicXML default).
export const DEFAULT_BPM=120;
export const PRIMITIVES=Object.freeze(['pitchCurve','gate','velocity','damping']);

// Today's planner rounds the exact ratio onset_frame*rate/sourceRate half up.
// Float seconds land just below those ties, so near-ties are snapped upwards.
export function frameAt(seconds,rate){
 if(!Number.isFinite(seconds)||!Number.isFinite(rate)||rate<=0)throw Error('Invalid time or rate');
 return Math.floor(seconds*rate+.5+1e-6);
}

export const PIECES=Object.freeze(['kick','snare','side-stick','tom-high','tom-mid','tom-low','hihat-closed','hihat-open','hihat-pedal','crash','ride']);
// A struck piece silences the pieces it cuts (open hi-hat closed by the foot or a closed hit).
export const CHOKE_CUTS=Object.freeze({'hihat-closed':Object.freeze(['hihat-open']),'hihat-pedal':Object.freeze(['hihat-open'])});
const GM=new Map([[35,'kick'],[36,'kick'],[37,'side-stick'],[38,'snare'],[40,'snare'],[41,'tom-low'],[43,'tom-low'],[45,'tom-mid'],[47,'tom-mid'],
 [48,'tom-high'],[50,'tom-high'],[42,'hihat-closed'],[44,'hihat-pedal'],[46,'hihat-open'],[49,'crash'],[52,'crash'],[55,'crash'],[57,'crash'],[51,'ride'],[53,'ride'],[59,'ride']]);
export const pieceFromGm=n=>GM.get(n)??null;

// Native techniques render physically; everything else goes through lower().
export const CAPABILITIES=Object.freeze({
 plucked:Object.freeze({kind:'plucked',contract:CONTRACT,revision:1,basic:false,targets:'pitch',range:Object.freeze({pitch:Object.freeze([36,88])}),
  techniques:Object.freeze(['bend','vibrato','slide','legato','mute','letRing']),gestures:Object.freeze(['strum','roll']),controls:Object.freeze(['mute']),primitives:PRIMITIVES,horizonSeconds:.1}),
 keys:Object.freeze({kind:'keys',contract:CONTRACT,revision:1,basic:true,targets:'pitch',range:Object.freeze({pitch:Object.freeze([21,108])}),
  techniques:Object.freeze(['letRing']),gestures:Object.freeze([]),controls:Object.freeze(['sustainPedal','mute']),primitives:Object.freeze(['gate','velocity','damping']),horizonSeconds:0}),
 kit:Object.freeze({kind:'kit',contract:CONTRACT,revision:1,basic:true,targets:'piece',pieces:PIECES,
  techniques:Object.freeze([]),gestures:Object.freeze([]),controls:Object.freeze(['mute']),primitives:Object.freeze(['velocity']),horizonSeconds:0}),
});
// A host with no native techniques (e.g. the old mnx sink wrapped as a host) still plays everything through lower().
export const GENERIC_CAPABILITIES=Object.freeze({kind:'generic',contract:CONTRACT,revision:1,basic:true,targets:'pitch',techniques:Object.freeze([]),gestures:Object.freeze([]),controls:Object.freeze([]),primitives:PRIMITIVES,horizonSeconds:0});

export const DIAGNOSTICS=Object.freeze({
 'approximated':{severity:'info',text:'Technique rendered through lower() as core primitives'},
 'dropped':{severity:'warning',text:'Lowered primitive not supported by this instrument; ignored'},
 'unknown-technique':{severity:'warning',text:'Technique type unknown to this contract revision; ignored'},
 'unknown-control':{severity:'warning',text:'Control type unknown to this contract revision; ignored'},
 'unknown-piece':{severity:'warning',text:'Kit piece not in the vocabulary; note is silent'},
 'unsupported-kind':{severity:'warning',text:'Instrument kind not available in this host; part is muted'},
 'unsupported-block':{severity:'warning',text:'Block type not available in this host; the signal passes through unchanged'},
 'invalid-block':{severity:'warning',text:'Block parameter invalid; its default or a clamped value is used'},
 'gesture-mismatch':{severity:'warning',text:'Chord gesture member disagrees with the others (onset or gesture); it plays as written'},
 'unknown-gesture':{severity:'warning',text:'Chord gesture type unknown to this contract revision; the chord plays as written'},
 'unresolved-reference':{severity:'warning',text:'Cross-note reference is missing, later, or on another part; treated as a plain note'},
 'fingering-mismatch':{severity:'info',text:'Fret disagrees with sounding pitch; pitch wins and the fret is recomputed'},
 'out-of-range':{severity:'warning',text:'Target outside the instrument range'},
 'late-note':{severity:'warning',text:'Note arrived inside the commit horizon; played, invariance not guaranteed'},
 'late-edit':{severity:'warning',text:'Edit or cancel inside the commit horizon; the scheduled version plays'},
 'voice-stolen':{severity:'info',text:'Polyphony limit reached; the oldest voice was released'},
 'retrigger-conflict':{severity:'warning',text:'Two attacks on one string or kit piece less than two samples apart; the later one is dropped'},
 'invalid-note':{severity:'error',text:'Note failed validation and was not scheduled'},
 'invalid-control':{severity:'error',text:'Control failed validation and was not scheduled'},
});
export function diagnostic(code,fields={}){
 const d=DIAGNOSTICS[code];if(!d)throw Error('Unknown diagnostic code '+code);
 return {code,severity:d.severity,...fields,message:fields.message??d.text};
}
