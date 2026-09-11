// Thin Hono wiring for the /api/* routes. Static assets (the Vite client
// build) are served by Workers Assets in front of this Worker; any request
// not matching an asset invokes it.
//
// The Worker is NOT the workbench's backend — it is the DEMO for a visitor
// with no OpenRouter key of their own (core-assist-byok: with a key the whole
// edit loop runs in the browser), plus two reserved 501 seams for the future
// studio product, plus authenticated personal library ingest. Every done frame it produces is stamped demoMode/mockMode.
// The workbench must stay fully functional from static build output alone.
import { Hono } from 'hono';
import { editNotation } from './api/editNotation.ts';
import { modelsRoute } from './api/models.ts';
import { documents } from './api/documents.ts';
import { library } from './api/library.ts';
import { auth } from './api/auth.ts';
import type { Env } from './env.ts';

const app = new Hono<{ Bindings: Env }>();

// The root is studio's (apps/studio/, served at /studio/); the workbench, the
// lab's own instrument, lives at /workbench/. No asset answers `/`, so the
// request falls through to the Worker. Access gates /studio at the edge, so
// an anonymous visitor lands on the OTP prompt from here.
app.get('/', c => c.redirect('/studio/', 302));

app.route('/api/edit-notation', editNotation);
app.route('/api/models', modelsRoute);
app.route('/api/documents', documents);
app.route('/api/auth', auth);
// Public capability flag contains no library/account data; static hosting returns no flag.
app.get('/api/capabilities', c => c.json({ library: Boolean(c.env.LIBRARY_ACCESS_ISSUER && c.env.LIBRARY_ACCESS_AUD) }, 200, { 'Cache-Control': 'no-store' }));
app.route('/api/library', library);

export default app;
