// Prototype-only descriptors. Saved factory presets retain schema 1 / engine
// 1.4.0 until a stage is adopted with an explicit migration.
export const nextPluckControl=key=>['pluck_body','pick_texture','contact_width','pluck_release_time','texture_colour','velocity_tone'].includes(key)||/^s\d-pluck_direction$/.test(key);
export const PROTOTYPE_CONTROLS={
 decay:{label:'Bass sustain',unit:'s',log:true,help:'Fundamental decay target; the passive shelf may limit extreme combinations.'},
 treble_decay:{label:'Treble decay',unit:'s',log:true,help:'Upper-partial decay, independent of bass sustain.'},
 brightness:{label:'Loss knee / brightness',help:'Moves the loss transition. Normally higher values retain more upper harmonics; inverted decay profiles reverse that relationship.'},
 initial_damping:{label:'Initial damping',help:'Additional passive damping immediately after each pluck.'},
 initial_damping_time:{label:'Damping settling time',unit:'s',log:true,help:'How long the additional damping takes to disappear.'},
 dispersion:{label:'String stiffness',help:'Changes upper-harmonic spacing; fundamental phase delay is compensated.'},
 pluck_body:{label:'Pluck fullness',help:'Additive pitched displacement. It never reduces the contact-noise signal.'},
 pick_texture:{label:'Pick texture',help:'Independent additive contact noise; high fullness can mask it perceptually.'},
 beating_cents:{label:'Motion beating',unit:'cents',help:'Small frequency difference between the two vibration components.'},
 motion_exchange:{label:'Motion exchange',help:'Bounded exchange between components; strong values suppress sustained beating.'},
 motion_loss_ratio:{label:'Second-component decay ratio',help:'Relative bass and treble decay duration of the second component.'},
 contact_width:{label:'Contact width',help:'Spatial blur as a fraction of the round-trip string length; independent of release time.'},
 pluck_release_time:{label:'Pluck release time',unit:'ms',scale:1000,log:true,help:'Two-pole release smoothing. Hardness divides this time; gentle velocities can lengthen it.'},
 texture_colour:{label:'Texture brightness',help:'Contact-noise spectrum, independent of displacement fullness.'},
 velocity_tone:{label:'Strength-dependent tone',help:'Soft attacks use broader contact and slower release; zero keeps tone independent of strength.'},
 body_size:{label:'Body size',help:'Shifts related radiation resonances down for larger bodies. Does not change string pitch.'},
 body_low_weight:{label:'Low-body weight',help:'Scales the lowest three modal families; the direct broadband bed remains.'},
 body_damping:{label:'Body damping',log:true,help:'Shortens and reduces all radiation resonances, independently of string decay. No compensating peak-gain restoration.'},
 body_breadth:{label:'Resonance breadth',help:'Preferentially broadens and reduces upper resonances; lower modes move less. Does not shift their centre frequencies.'},
 body_mix:{label:'Legacy body amount',help:'The retained twelve-mode radiation model. New radiation families are a later stage.'},
 coupling:{label:'Legacy shared coupling',help:'The retained convex string mixer, not yet the planned bridge-loading model.'},
 bridge_transfer:{label:'Bridge energy transfer',help:'Passive shared termination: more transfer adds bridge loss and inter-string response, independently of radiation amount.'},
 bridge_rolloff:{label:'Bridge loading rolloff',unit:'Hz',log:true,help:'Lower values extend loading to lower frequencies. This reflectance belongs in feedback; it is not a microphone body resonance.'},
 thwack_soak:{label:'Thwack',unit:'dB',help:'How much of a hard pluck\'s extra energy is soaked up after the attack, in dB at full strength. It scales with strength squared, so soft plucks are barely touched.'},
 thwack_time:{label:'Thwack time',unit:'s',log:true,help:'How long the soak lasts.'},
 thwack_body:{label:'Thwack body',help:'How loudly the soaked energy sounds through the body resonances, pitched with the note.'},
 thwack_treble:{label:'Thwack treble',help:'How many times faster the treble soaks than the bass.'},
 sympathetic_response:{label:'Sympathetic participation',help:'Participation of freely ringing idle strings. Sounding notes always participate; disabling sympathy does not multiply their own loading.'},
};
export const PICKUP_CONTROLS={
 electric:{label:'Electric observation',help:'Blends unobserved string projection with linear pickup observation. Zero keeps the acoustic path independent of all pickup controls.'},
 pickup:{label:'First pickup position',help:'Fraction of the string round-trip delay from the bridge. Retains the legacy point-comb mapping and interpolation; nearer the bridge gives different harmonic nulls.'},
 pickup_width:{label:'Pickup width',help:'Unit-DC period-scaled exponential aperture approximation. Reduces upper partials before amplification; zero exactly bypasses the aperture. Not a calibrated symmetric magnetic field.'},
 pickup2:{label:'Second pickup position',help:'Independent point observation with the same legacy delay interpolation. Never feeds the string or bridge loops.'},
 pickup_blend:{label:'Two-pickup blend',help:'Linear same-polarity blend: zero is first only, one is second only. Different observation phases can create intentional electric comb cancellations.'},
};
export const stringPrototypeControl=key=>{
 const free=/^s(\d)-free_ringing$/.exec(key);if(free)return {label:`String ${Number(free[1])+1} · idle state`,binary:true,help:'Free: can ring and respond after note-off. Finger-muted: strong damping and no idle sympathetic participation. Sounding notes override this preference. Retains the latest vibrating length; does not automatically reset a fret to open.'};
 const m=/^s(\d)-(loss_profile|treble_scale|stiffness_scale|beating_scale|pluck_direction)$/.exec(key);if(!m)return null;
 const descriptions={loss_profile:['Loss profile','Scale of the loss knee.'],treble_scale:['Treble decay scale','Per-string treble duration multiplier.'],stiffness_scale:['Stiffness scale','Per-string dispersion multiplier.'],beating_scale:['Beating scale','Per-string motion detuning multiplier.'],pluck_direction:['Pluck direction','0 = first component, 1 = second; sampled at the pluck. Fixed output projection retains its level change.']};
 return {label:`String ${Number(m[1])+1} · ${descriptions[m[2]][0]}`,help:descriptions[m[2]][1]};
};
