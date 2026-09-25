import { renderOracleArtifacts } from './report/oracle.ts';
const [command, target] = process.argv.slice(2);
if (command === 'report' && target === 'oracle') renderOracleArtifacts();
else throw new Error(`Bench ${command ?? 'command'} ${target ?? ''} is not implemented yet; see FIRST_STEP.`);
