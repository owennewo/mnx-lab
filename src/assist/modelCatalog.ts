// Catalog adapters for the model selector — the edges that produce a
// CatalogModel[] for the pure scoring core (modelSelect.ts never fetches).
//
// Two sources, per the roadmap item's snapshot-as-floor decision: the
// committed snapshot (modelCatalog.snapshot.json — reviewable, offline, and
// what the tests run against) and an explicit live refresh from OpenRouter's
// public catalog endpoint. Both funnel through the same join with the curated
// priors below.

import type { CatalogModel, ModelPricing } from './modelSelect.ts';
import snapshot from './modelCatalog.snapshot.json';

/** The capability flags the snapshot keeps from supported_parameters — the
 *  ones a requirements definition can filter on. `tools` is the load-bearing
 *  one: worker/editLoop.ts forces the update_document tool call. */
export const KNOWN_PARAMETERS = ['tools', 'structured_outputs', 'response_format', 'reasoning'];

/** Curated quality/speed priors — DECLARED DATA, hand-set 2026-08-20 from
 *  public leaderboard readings, deliberately coarse. This table is the
 *  "curated prior table versioned alongside the roster" stage of the roadmap
 *  item; it is replaced by measured edit-loop eval data when that exists.
 *  Matched on the model id with any :variant suffix stripped, so a :free
 *  endpoint inherits its family's prior (same weights, other hardware —
 *  speed is the shakier half of that inheritance, which is one more reason
 *  these are priors and not verdicts). */
const MODEL_PRIORS: Record<string, { intelligenceIndex: number; tokensPerSecond: number }> = {
  'anthropic/claude-fable-5': { intelligenceIndex: 78, tokensPerSecond: 45 },
  'anthropic/claude-opus-5': { intelligenceIndex: 74, tokensPerSecond: 40 },
  'anthropic/claude-sonnet-5': { intelligenceIndex: 68, tokensPerSecond: 70 },
  'anthropic/claude-3-haiku': { intelligenceIndex: 35, tokensPerSecond: 120 },
  'google/gemini-3.5-flash': { intelligenceIndex: 62, tokensPerSecond: 150 },
  'google/gemini-3.1-flash-lite': { intelligenceIndex: 48, tokensPerSecond: 200 },
  'google/gemini-2.5-flash-lite': { intelligenceIndex: 42, tokensPerSecond: 190 },
  'deepseek/deepseek-v4-pro': { intelligenceIndex: 66, tokensPerSecond: 60 },
  'deepseek/deepseek-v4-flash': { intelligenceIndex: 55, tokensPerSecond: 130 },
  'moonshotai/kimi-k2.6': { intelligenceIndex: 63, tokensPerSecond: 80 },
  'qwen/qwen3.7-max': { intelligenceIndex: 64, tokensPerSecond: 70 },
  'qwen/qwen3.6-flash': { intelligenceIndex: 50, tokensPerSecond: 140 },
  'z-ai/glm-5.2': { intelligenceIndex: 60, tokensPerSecond: 90 },
  'nvidia/nemotron-3-ultra-550b-a55b': { intelligenceIndex: 61, tokensPerSecond: 50 },
  'nvidia/nemotron-3-super-120b-a12b': { intelligenceIndex: 52, tokensPerSecond: 110 },
  'nvidia/nemotron-3-nano-30b-a3b': { intelligenceIndex: 40, tokensPerSecond: 160 },
  'openai/gpt-oss-20b': { intelligenceIndex: 38, tokensPerSecond: 170 },
};

function baseId(id: string): string {
  const colon = id.indexOf(':');
  return colon === -1 ? id : id.slice(0, colon);
}

function withPriors(model: CatalogModel): CatalogModel {
  const prior = MODEL_PRIORS[baseId(model.id)];
  return prior ? { ...model, ...prior } : model;
}

/** The committed snapshot, priors joined — the floor every session starts on. */
export function snapshotCatalog(): CatalogModel[] {
  return (snapshot.models as CatalogModel[]).map(withPriors);
}

export const SNAPSHOT_FETCHED_AT: string = snapshot.fetchedAt;

const CATALOG_URL = 'https://openrouter.ai/api/v1/models';
const PER_MTOK = 1_000_000;

interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: Record<string, string>;
  supported_parameters?: string[];
}

function mtok(pricing: Record<string, string>, key: string): number | undefined {
  const v = pricing[key];
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n * PER_MTOK : undefined;
}

/** Shape one raw catalog entry the way the snapshot generator does, so live
 *  and committed rows are indistinguishable to the scorer. */
export function parseCatalogModel(raw: OpenRouterModel): CatalogModel {
  const pricing = raw.pricing ?? {};
  const shaped: ModelPricing = {
    input: mtok(pricing, 'prompt') ?? 0,
    output: mtok(pricing, 'completion') ?? 0,
  };
  const cacheRead = mtok(pricing, 'input_cache_read');
  const cacheWrite = mtok(pricing, 'input_cache_write');
  if (cacheRead !== undefined) shaped.cacheRead = cacheRead;
  if (cacheWrite !== undefined) shaped.cacheWrite = cacheWrite;
  return withPriors({
    id: raw.id,
    name: raw.name ?? raw.id,
    contextLength: raw.context_length ?? 0,
    pricing: shaped,
    parameters: KNOWN_PARAMETERS.filter(p => (raw.supported_parameters ?? []).includes(p)),
  });
}

/** Router pseudo-models (openrouter/auto and friends) price as -1 — "depends
 *  on the routed model" — so they are not assessable and never enter a
 *  catalog. The snapshot generator applies the same exclusion. */
function isAssessable(raw: OpenRouterModel): boolean {
  const pricing = raw.pricing ?? {};
  const input = mtok(pricing, 'prompt');
  const output = mtok(pricing, 'completion');
  return input !== undefined && output !== undefined && input >= 0 && output >= 0;
}

/** Explicit live refresh — never called on load; the dialog's refresh action
 *  is the only caller, per the snapshot-as-floor decision. */
export async function fetchLiveCatalog(signal?: AbortSignal): Promise<CatalogModel[]> {
  const res = await fetch(CATALOG_URL, { signal });
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  const body = (await res.json()) as { data?: OpenRouterModel[] };
  if (!Array.isArray(body.data)) throw new Error('catalog fetch: unexpected shape');
  return body.data
    .filter(isAssessable)
    .map(parseCatalogModel)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Display-name lookup over the snapshot for a stored model id. */
export function modelDisplayName(id: string): string {
  const hit = snapshotCatalog().find(m => m.id === id);
  return hit ? hit.name : id;
}
