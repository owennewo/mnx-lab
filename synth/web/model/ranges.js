// Slider presentation is separate from saved physical parameter values.
export function sliderMapping(min,max,log=false) {
 return {
  toUnit:value=>log?Math.log(value/min)/Math.log(max/min):(value-min)/(max-min),
  fromUnit:value=>value<=0?min:value>=1?max:log?min*(max/min)**value:min+(max-min)*value,
 };
}
export function visibleRange(spec,value,extended) {
 const normal=spec.normal||[spec.min,spec.max];
 // Changing the UI mode must never silently alter a saved or ringing sound.
 return extended||value<normal[0]||value>normal[1]?[spec.min,spec.max]:normal;
}
export function auditionHeadroom(preset) {
 // Schema-2 texture is an independent additive excitation. Never turn down
 // the pitched note, or an already ringing note, when texture is raised.
 // Saved fixed audition gain and the visible output ceiling provide safety.
 // Preserve the legacy rule for schema-1 sounds and their archived renders.
 if(preset.schemaVersion===2)return 1;
 const p=preset.instrument.parameters;
 const body=1+p.body_mix*Math.max(0,Math.max(...preset.instrument.modes.map(m=>m.gain))/2-1);
 // Fullness must not duck contact noise (or a note already ringing). Factory
 // output gains reserve space for the whole fullness range instead.
 return 1/Math.max(1,p.pick_texture/2,body);
}
