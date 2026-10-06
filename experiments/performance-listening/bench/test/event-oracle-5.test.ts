import {describe,it,expect} from 'vitest';
import {readOracle5,validateOracle5,faultSensitivity5} from '../src/events/oracle5.ts';
const o=readOracle5();
describe('event-oracle@5 and stage-gates@3 (independent audit still required)',()=> {
 for(const c of validateOracle5(o))it(`${c.group} ${c.id}`,()=>expect(c.agrees,JSON.stringify(c)).toBe(true));
 for(const f of faultSensitivity5(o))it(`detects: ${f.name}`,()=>expect(f.detected,JSON.stringify(f)).toBe(true));
});
