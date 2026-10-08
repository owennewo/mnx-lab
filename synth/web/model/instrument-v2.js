// The guitar engine (dsp/engine2): its identity, parameter catalogue and the
// validation of a resolved per-slot preset. Designs name the engine by id and
// generation only, so a rebuilt or optimised DSP of the same generation keeps every
// saved design; the source hash pins the build (scripts/build_engine2.mjs).
import {clone,PARAMS as BASE_PARAMS} from './presets.js';
import {NEUTRAL_SETUP,validateInstrumentSetup,withInstrumentSetup} from './instrument-setup.js';
import {LATEST_NOTE_POLICY} from './note-ownership.js';
import {PROTOTYPE_CONTROLS,PICKUP_CONTROLS,nextPluckControl} from './instrument-controls.js';
import {THWACK_V2} from './thwack.js';

export const GUITAR_ENGINE=Object.freeze({id:'guitar-lab',generation:3,sourceSha256:'f3e8e1b703f561fb0ddd2e0662daf6541b06ae240145ace96a6bc95db7dc3022'});
export {THWACK_V2};
export const HARDNESS_V2={min:.025,max:40,normal:[.1,1],step:.001,log:true};
const spec=(key,min,max,value,step=.001)=>({name:(PROTOTYPE_CONTROLS[key]||PICKUP_CONTROLS[key])?.label||key,min,max,default:value,step,
 policy:nextPluckControl(key)?'next pluck':'smooth',...(PROTOTYPE_CONTROLS[key]||PICKUP_CONTROLS[key]),unit:(PROTOTYPE_CONTROLS[key]||PICKUP_CONTROLS[key])?.unit||''});
export const PARAMS_V2={...BASE_PARAMS};delete PARAMS_V2.coupling;
for(const [key,min,max,value,step] of [
 ['treble_decay',.03,30,1.2,.01],['initial_damping',0,1,0],['initial_damping_time',.01,.5,.12],
 ['beating_cents',0,12,0],['motion_exchange',0,.03,0,.00001],['motion_loss_ratio',.35,1.5,1],
 ['contact_width',0,.2,.025],['pluck_release_time',.00003,.02,.0004,.00001],['texture_colour',0,1,.7],['velocity_tone',0,1,0],
 ['body_size',.6,1.8,1],['body_low_weight',0,2,1],['body_damping',.25,4,1],['body_breadth',.5,3,1],
 ['bridge_transfer',0,.3,0,.0001],['bridge_rolloff',20,4000,250,.1],['sympathetic_response',0,1,0],
 ['pickup_width',0,.15,0,.0001],['pickup2',.04,.45,.32],['pickup_blend',0,1,0],
])PARAMS_V2[key]=spec(key,min,max,value,step);
PARAMS_V2.body_mix={...BASE_PARAMS.body_mix,default:0,name:'Body radiation · experimental',help:'Fixed 24-mode experimental radiation. Zero bypasses it. Not listening-accepted; disabled in every factory design.'};
PARAMS_V2.decay={...BASE_PARAMS.decay,name:'Bass sustain',log:true,help:PROTOTYPE_CONTROLS.decay.help};
PARAMS_V2.brightness={...BASE_PARAMS.brightness,name:'Loss knee / brightness',help:PROTOTYPE_CONTROLS.brightness.help};
export const STRING_V2={
 lossProfile:{name:'Loss profile',min:.4,max:2,step:.001,default:1,dsp:'loss_profile'},
 trebleScale:{name:'Treble decay scale',min:.4,max:1.6,step:.001,default:1,dsp:'treble_scale'},
 stiffnessScale:{name:'Stiffness scale',min:.3,max:2,step:.001,default:1,dsp:'stiffness_scale'},
 beatingScale:{name:'Beating scale',min:0,max:1.5,step:.001,default:1,dsp:'beating_scale'},
 pluckDirection:{name:'Pluck direction',min:0,max:1,step:.001,default:0,dsp:'pluck_direction',policy:'next pluck'},
 freeRinging:{name:'Free after release',min:0,max:1,step:1,default:0,dsp:'free_ringing',policy:'smooth'},
};
export const INSTRUMENT_KEYS_V2=Object.keys(PARAMS_V2).filter(k=>k!=='levelDb');
const exact=(o,keys,label)=>{if(!o||Array.isArray(o)||typeof o!=='object'||Object.keys(o).sort().join()!==[...keys].sort().join())throw Error(`Invalid ${label} fields`);};
const number=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Invalid ${label}: expected ${min}–${max}`);};
// A design resolved onto the six engine slots (plucked-design.js resolveDesign).
export function validatePresetV2(p){
 exact(p,['schemaVersion','id','name','family','description','factory','instrument','recording'],'preset');
 if(p.schemaVersion!==2)throw Error('Resolved presets are schema 2');
 if(typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||typeof p.family!=='string'||typeof p.description!=='string'||typeof p.factory!=='boolean')throw Error('Invalid preset metadata');
 exact(p.instrument,['parameters','strings','excitation','modes','setup'],'instrument');exact(p.instrument.parameters,INSTRUMENT_KEYS_V2,'instrument parameters');
 exact(p.recording,['levelDb'],'recording');
 for(const [k,v] of Object.entries({...p.instrument.parameters,...p.recording}))number(v,PARAMS_V2[k].min,PARAMS_V2[k].max,k);
 exact(p.instrument.excitation,['position','hardness','thwack'],'excitation');number(p.instrument.excitation.position,.01,.49,'position');number(p.instrument.excitation.hardness,HARDNESS_V2.min,HARDNESS_V2.max,'hardness');number(p.instrument.excitation.thwack,THWACK_V2.min,THWACK_V2.max,'thwack');
 if(!Array.isArray(p.instrument.strings)||p.instrument.strings.length!==6||!Array.isArray(p.instrument.modes)||p.instrument.modes.length!==12)throw Error('Expected six strings and twelve radiation seeds');
 for(const s of p.instrument.strings){
  exact(s,['openMidi','tuningCents','decayScale',...Object.keys(STRING_V2)],'string');
  number(s.openMidi,36,76,'open MIDI');if(!Number.isInteger(s.openMidi))throw Error('Open MIDI must be an integer');
  number(s.tuningCents,-25,25,'tuning');number(s.decayScale,.4,1.6,'decay scale');
  for(const [k,d] of Object.entries(STRING_V2))number(s[k],d.min,d.max,k);
  if(![0,1].includes(s.freeRinging))throw Error('Free ringing must be 0 or 1');
 }
 for(const m of p.instrument.modes){exact(m,['frequency_hz','t60_seconds','gain'],'radiation seed');number(m.frequency_hz,50,8000,'frequency');number(m.t60_seconds,.005,4,'decay');number(m.gain,0,8,'gain');}
 validateInstrumentSetup(p.instrument.setup);return p;
}
// Shared by live playback and final render/benchmark tools. Caller supplies the
// original player/rack plan; setup affects only owned future note trajectories.
export function instrumentPlanV2(packet,{preset,rate}){
 validatePresetV2(preset);const params={...packet.params};delete params.coupling;
 for(let i=0;i<6;i++){
  params[`s${i}-sustain`]=0;
  for(const [k,d] of Object.entries(STRING_V2))params[`s${i}-${d.dsp}`]=preset.instrument.strings[i][k];
 }
 return {...withInstrumentSetup({...packet,params},{preset,performance:packet.performance,rate,setup:preset.instrument.setup}),eventPolicy:LATEST_NOTE_POLICY,thwack:{strength:preset.instrument.excitation.thwack}};
}
