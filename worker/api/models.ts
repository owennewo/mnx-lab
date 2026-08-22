// GET /api/models — the roster the server-key demo mode is allowed to spend
// on. (With BYOK the user's own key buys any model they pick; this allowlist
// governs only the mode where the deployment pays — core-assist-byok.md.)
//
// models.json is GENERATED from worker/models.query.json by
// `npm run update:roster`, so the file carries its own provenance and the wire
// payload stays the bare lanes it always was.
import { Hono } from 'hono';
import roster from '../models.json';
import type { Env } from '../env.ts';

export const modelsRoute = new Hono<{ Bindings: Env }>().get('/', c => c.json(roster.lanes));
