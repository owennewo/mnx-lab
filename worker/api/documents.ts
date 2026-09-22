// Reserved document-sync seam (roadmap/complete/lab-structure-lab.md).
// Deliberately remains a 501 response. Studio persists source renditions through
// storage/libraryClient.ts and the library API, coordinated by storage/saveSession.ts.
// The workbench needs no backend for its committed corpus or verification writes;
// its optional library reads do not use this reserved route.
import { Hono } from 'hono';
import type { Env } from '../env.ts';

export const documents = new Hono<{ Bindings: Env }>().all('/*', c =>
  c.json({ error: 'Document sync is reserved for the studio product; not implemented.' }, 501)
);
