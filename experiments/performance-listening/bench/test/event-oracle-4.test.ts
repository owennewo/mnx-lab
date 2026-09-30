import {describe,it,expect} from 'vitest';
import {readOracle4} from '../src/events/oracle4.ts';
import {validateOracle4,faultSensitivity4} from '../src/events/validateOracle4.ts';
const o=readOracle4();
describe('event-oracle@4 (independent audit still required)',()=> {
 for(const c of validateOracle4(o))it(`${c.group} ${c.id}`,()=>expect(c.agrees,JSON.stringify(c)).toBe(true));
 for(const f of faultSensitivity4(o))it(`detects wrong answer: ${f.name}`,()=>expect(f.detected).toBe(true));
});
