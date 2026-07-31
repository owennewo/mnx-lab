// GET /api/models — the model roster offered by the assist drawer.
import { Hono } from 'hono';
import models from '../models.json';
import type { Env } from '../env.ts';

export const modelsRoute = new Hono<{ Bindings: Env }>().get('/', c => c.json(models));
