import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { EXPERIMENT, sha256 } from '../src/io.ts';
import { evaluateV2 } from '../src/v2/evaluate.ts';
import { compareV2 } from '../src/v2/retain.ts';
import type { GoldenV2, RecordedRun } from '../src/v2/types.ts';
import type { Decision } from '../src/types.ts';
import type { Retention } from '../src/v2/retain.ts';
it('reproduces the frozen v2 instrument checkpoint without claiming its stipulated fields are measurements',()=>{
 const folder=join(EXPERIMENT,'bench/oracle-v2/recorded'),bytes=readFileSync(join(folder,'checkpoint.json'));
 const r=JSON.parse(bytes.toString('utf8')) as {kind:string;claims:string;sourceHashes:Record<string,string>;cases:{golden:GoldenV2;record:Decision[];evaluation:unknown}[];retention:{goldens:GoldenV2[];base:RecordedRun;decisions:{run:RecordedRun;result:Retention}[]}};
 const metadata=JSON.parse(readFileSync(join(folder,'metadata.json'),'utf8'));
 expect(sha256(bytes)).toBe(metadata.checkpointSha256);expect(r.kind).toBe('instrument-verification');expect(r.claims).toContain('not measurements');
 for(const [file,hash] of Object.entries(r.sourceHashes))expect(sha256(readFileSync(join(EXPERIMENT,file)))).toBe(hash);
 for(const c of r.cases)expect(evaluateV2(c.golden,c.record)).toEqual(c.evaluation);
 for(const c of r.retention.decisions)expect(compareV2(r.retention.base,c.run,r.retention.goldens)).toEqual(c.result);
});
