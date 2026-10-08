// Instrument kinds available to the host. Phases 3–5 add plucked, keys and kit.
import {TestTone} from './test-tone.js';
import {Plucked} from './plucked.js';
import {Keys} from './keys.js';
import {Kit} from './kit.js';
export const INSTRUMENTS=new Map([[TestTone.kind,TestTone],[Plucked.kind,Plucked],[Keys.kind,Keys],[Kit.kind,Kit]]);
