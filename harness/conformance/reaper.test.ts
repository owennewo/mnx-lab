import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const reaper = fileURLToPath(new URL('../verify/reaper.mjs', import.meta.url));
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// What a smoke leaves when it is SIGKILLed: a child that ignores SIGTERM and
// has been reparented away from it. The reaper must still take it down.
it.skipIf(process.platform !== 'linux')('SIGKILLs what a killed process started', async () => {
  const smoke = spawn(process.execPath, ['--input-type=module', '-e', `
    import { spawn } from 'node:child_process';
    import { startReaper } from ${JSON.stringify(reaper)};
    startReaper();
    const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
    setTimeout(() => console.log(child.pid), 600);
  `], { stdio: ['ignore', 'pipe', 'inherit'] });
  const [line] = await once(smoke.stdout, 'data');
  const orphan = Number(String(line).trim());
  expect(alive(orphan)).toBe(true);
  smoke.kill('SIGKILL');
  for (let i = 0; i < 30 && alive(orphan); i++) await new Promise(r => setTimeout(r, 100));
  expect(alive(orphan)).toBe(false);
});
