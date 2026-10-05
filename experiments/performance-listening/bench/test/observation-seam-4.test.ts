import {describe,it,expect} from 'vitest';
import {checks4,inherited4} from '../src/challenger/seam4.ts';
describe('seam4 author implementation checks; independent audit required',()=>{
 it('agrees with every separately frozen physical/state case',()=>{for(const c of checks4())expect(c.agrees,`${c.id}: ${JSON.stringify(c.actual)} vs ${JSON.stringify(c.expected)}`).toBe(true);});
 it('preserves declared abstract inherited layers',()=>{for(const c of inherited4())expect(c.agrees,c.id).toBe(true);});
});
