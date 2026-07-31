// Reserved SaaS seam — studio's document sync API (roadmap/inprogress/
// structure-lab.md). Deliberately a 501 stub with no bindings: the WORKBENCH
// has no backend by rule (its corpus is committed JSON, its documents live in
// IndexedDB), so nothing in ui/ may ever depend on this route. It exists so
// storage/CloudRepository has an address when studio starts.
import { Hono } from 'hono';
import type { Env } from '../env.ts';

export const documents = new Hono<{ Bindings: Env }>().all('/*', c =>
  c.json({ error: 'Document sync is reserved for the studio product; not implemented.' }, 501)
);
