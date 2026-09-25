import { renderOracleArtifacts } from './report/oracle.ts';
import { generateSet, freezeSet } from './generate/set.ts';
const [command, target] = process.argv.slice(2);
if (command === 'report' && target === 'oracle') renderOracleArtifacts();
else if (command === 'generate' && target) console.log(generateSet(target));
else if (command === 'freeze' && target) freezeSet(target);
else throw new Error(`Bench ${command ?? 'command'} ${target ?? ''} is not implemented yet; see FIRST_STEP.`);
