// A faster road to the SAME D1. Miniflare's Node-side D1 proxy makes prepare()
// and bind() synchronous, blocking round trips to workerd before the execution's
// own async one: three hops a statement, ~16 ms measured, and the library tests
// spent ~5 s a file blocked in them. Here prepare and bind stay in Node, and each
// execution is ONE request to a tiny Worker in the same workerd, which runs it
// against the real binding (~3 ms). It is D1 that prepares, binds and runs there;
// bind()'s synchronous type check is mirrored here, values JSON would change (NaN,
// bytes) cross tagged, and errors keep D1's message.
import type { Miniflare } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';

/** The executor Worker: the Miniflare script for a library runtime. */
export const D1_EXECUTOR_SCRIPT = `
const decode = value => {
  if (!value || typeof value !== 'object' || !('__mnxD1' in value)) return value;
  if (value.__mnxD1 === 'number') return Number(value.value);
  if (value.__mnxD1 === 'bytes') return Uint8Array.from(atob(value.value), c => c.charCodeAt(0));
  return value;
};
const statement = (env, { sql, params }) => env.DB.prepare(sql).bind(...params.map(decode));
export default { async fetch(request, env) {
  const call = await request.json();
  try {
    let result;
    if (call.kind === 'batch') result = await env.DB.batch(call.statements.map(s => statement(env, s)));
    else if (call.kind === 'exec') result = await env.DB.exec(call.sql);
    else {
      const prepared = statement(env, call);
      result = call.kind === 'first' ? await prepared.first(call.column) : call.kind === 'all' ? await prepared.all() : await prepared.run();
    }
    return Response.json({ ok: true, result: result === undefined ? null : result });
  } catch (error) {
    return Response.json({ ok: false, name: error?.name ?? 'Error', message: String(error?.message ?? error) });
  }
} };
`;

type Call = { kind: 'first' | 'all' | 'run'; sql: string; params: unknown[]; column?: string }
  | { kind: 'batch'; statements: { sql: string; params: unknown[] }[] }
  | { kind: 'exec'; sql: string };

const encode = (value: unknown): unknown => {
  if (typeof value === 'number' && !Number.isFinite(value)) return { __mnxD1: 'number', value: String(value) };
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return { __mnxD1: 'bytes', value: Buffer.from(bytes).toString('base64') };
  }
  return value;
};

class ExecutorStatement {
  constructor(private readonly db: ExecutorD1, readonly sql: string, readonly params: unknown[] = []) {}
  bind(...values: unknown[]) {
    // D1 checks bound values synchronously, at bind(), and throws there — in
    // production too — so this does the same, by workerd's d1-api rules. The
    // differential test (d1-executor.test.ts) holds these to the real proxy.
    for (const value of values) {
      const type = typeof value;
      const ok = type === 'number' || type === 'string' || type === 'boolean' || value === null ||
        value instanceof ArrayBuffer || ArrayBuffer.isView(value) ||
        (Array.isArray(value) && value.every(b => typeof b === 'number' && b >= 0 && b < 256));
      if (!ok) throw new Error(`D1_TYPE_ERROR: Type '${type}' not supported for value '${String(value)}'`);
    }
    return new ExecutorStatement(this.db, this.sql, values.map(encode));
  }
  first(column?: string) { return this.db.call({ kind: 'first', sql: this.sql, params: this.params, ...(column === undefined ? {} : { column }) }); }
  all() { return this.db.call({ kind: 'all', sql: this.sql, params: this.params }); }
  run() { return this.db.call({ kind: 'run', sql: this.sql, params: this.params }); }
}

class ExecutorD1 {
  constructor(private readonly mf: Miniflare) {}
  prepare(sql: string) { return new ExecutorStatement(this, sql); }
  batch(statements: ExecutorStatement[]) {
    return this.call({ kind: 'batch', statements: statements.map(s => ({ sql: s.sql, params: s.params })) });
  }
  exec(sql: string) { return this.call({ kind: 'exec', sql }); }
  async call(call: Call): Promise<unknown> {
    const response = await this.mf.dispatchFetch('http://d1.executor/', { method: 'POST', body: JSON.stringify(call) });
    const reply = await response.json() as { ok: true; result: unknown } | { ok: false; name: string; message: string };
    if (reply.ok) return reply.result;
    const error = new Error(reply.message);
    error.name = reply.name;
    throw error;
  }
}

/** The runtime's database, as the Worker's D1Database. */
export function executorD1(mf: Miniflare): D1Database {
  return new ExecutorD1(mf) as unknown as D1Database;
}
