// Thin Hono wiring for the /api/* routes. Static assets (the Vite client
// build) are served by Workers Assets in front of this Worker; any request
// not matching an asset invokes it.
//
// The Worker is NOT the workbench's backend — it is the DEMO for a visitor
// with no OpenRouter key of their own (core-assist-byok: with a key the whole
// edit loop runs in the browser), plus two reserved 501 seams for the future
// studio product. Every done frame it produces is stamped demoMode/mockMode.
// The workbench must stay fully functional from static build output alone.
import { Hono } from 'hono';
import { editNotation } from './api/editNotation.ts';
import { modelsRoute } from './api/models.ts';
import { documents } from './api/documents.ts';
import { auth } from './api/auth.ts';
import type { Env } from './env.ts';

const app = new Hono<{ Bindings: Env }>();

app.route('/api/edit-notation', editNotation);
app.route('/api/models', modelsRoute);
app.route('/api/documents', documents);
app.route('/api/auth', auth);

export default app;
