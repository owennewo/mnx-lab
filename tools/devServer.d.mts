export interface ProcessInfo { cwd: string; exe: string; cmd: string }
export interface RunningProcess { pid: number; cmd: string }
export function isDevServer(proc: ProcessInfo, checkout: string): boolean;
export function devServerProcesses(checkout: string): RunningProcess[];
export function stopDevServer(procs: RunningProcess[]): Promise<void>;
export function startDevServer(checkout: string, options?: { timeoutMs?: number }): Promise<{ port: string; log: string }>;
