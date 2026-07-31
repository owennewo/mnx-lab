// Reserved SaaS seam — studio's auth API (roadmap/inprogress/
// structure-lab.md). Deliberately a 501 stub with no bindings; see
// api/documents.ts for the rule that keeps the workbench off this route.
import { Hono } from 'hono';
import type { Env } from '../env.ts';

export const auth = new Hono<{ Bindings: Env }>().all('/*', c =>
  c.json({ error: 'Auth is reserved for the studio product; not implemented.' }, 501)
);
