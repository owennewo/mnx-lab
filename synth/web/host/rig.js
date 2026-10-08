// Rig 3.0.0 (chain campaign C14): a named session file holding one mnx-sound/2 setup,
// with designs embedded. It is the only format the app and the library read; earlier
// rig versions are not imported (C2).
import {validateSetup} from '../contract/index.js';
export const RIG_VERSION='3.0.0';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function makeRig(name,setup){return validateRig({rig:RIG_VERSION,name,setup:structuredClone(setup)});}
export function validateRig(rig){
 if(!isObject(rig)||rig.rig!==RIG_VERSION)throw Error(`Not a rig ${RIG_VERSION} file (earlier rig versions are not supported)`);
 if(typeof rig.name!=='string'||!rig.name.trim()||rig.name.length>120)throw Error('Invalid rig name');
 validateSetup(rig.setup);
 return rig;
}
