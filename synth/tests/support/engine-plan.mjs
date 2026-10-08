// The Engine2 planner input for a performed take with no effects: the take's audition
// automation and the design's base controls. Engine tests use it
// where the removed layer model's rigPlan() used to supply the same packet.
import {auditionAutomation} from '../../web/model/performance.js';
import {baseControls} from '../../web/model/presets.js';
export function enginePlan(performance,preset,rate){
 const params=baseControls(preset);
 return {...auditionAutomation(performance,preset,rate),params,performance};
}
// Factory designs resolved on the standard guitar: the per-slot presets the engine runs.
import fs from 'node:fs';
import {resolveDesign} from '../../web/host/instruments/plucked-design.js';
export const factoryPresets=()=>JSON.parse(fs.readFileSync(new URL('../../web/data/instrument-v2/presets.json',import.meta.url))).map(d=>resolveDesign(d).preset);
