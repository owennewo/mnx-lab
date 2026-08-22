// The model selector's scoring core — pure, DOM-free, fetchless.
// roadmap/inprogress/core-assist-model-selector.md: the roster as a query, not a
// list. A requirements definition (hard filters + weighted soft preferences)
// runs against a catalog and returns an ordered list of matching models.
//
// The ordering contract, in one paragraph: every soft dimension scores as
// HEADROOM OVER ITS REQUIREMENT — log2(actual/required), so exactly meeting a
// requirement scores 0 and surplus/shortfall are symmetric — then a weighted
// sum ranks the survivors. Positive weights over monotone per-dimension
// utilities means Pareto dominance is respected by construction (a model
// worse-or-equal on every dimension can never outrank its dominator); that
// invariant, not any particular score, is what model-select.test.ts pins.
// A dimension with no declared requirement is excluded from the sum (no
// requirement, no unit); a model with no data for a dimension scores 0 there
// and is flagged — unknown is neither rewarded nor punished, and never silent.

export interface ModelPricing {
  /** $/Mtok. `input`/`output` are always present in the catalog; the cache
   *  meters are optional — a model without cache pricing charges cached
   *  tokens at its full input rate, so that is also how we price it. */
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface CatalogModel {
  id: string;
  name: string;
  contextLength: number;
  pricing: ModelPricing;
  /** Capability flags from the catalog's supported_parameters, trimmed to the
   *  ones we filter on (see modelCatalog.ts). */
  parameters: string[];
  /** Curated priors, joined by the catalog adapter — absent means unknown. */
  tokensPerSecond?: number;
  intelligenceIndex?: number;
}

/** The expected token mix of the workload — the blend lives in the
 *  requirements definition, not the catalog (the catalog is per-meter only).
 *  Relative weights, any scale; normalized inside effectivePrice(). */
export interface TokenMix {
  input: number;
  output: number;
  cached: number;
}

export interface ModelRequirements {
  /** Hard filters — pass/fail. A model missing the data passes and is flagged. */
  requiredParameters?: string[];
  minContext?: number;
  /** Ceiling on the blended price, $/Mtok. 0 means free-only. */
  maxEffectivePrice?: number;
  minTokensPerSecond?: number;
  minIntelligence?: number;
  /** Dimensions on which NO EVIDENCE IS NOT GOOD ENOUGH — a model with no
   *  prior for one of these is excluded rather than passed-and-flagged. The
   *  default (pass, flag, score neutral) is right for the picker, where a
   *  human reads the '?' and decides; it is wrong for an unattended generator
   *  like the roster build, which has no reader. Naming the dimensions here
   *  is how "the roster admits no unknowns" gets said out loud. */
  requireKnown?: SoftDimension[];

  /** The workload blend the effective price is computed against. */
  tokenMix?: TokenMix;
  /** Per-dimension weights for the soft ranking; defaults below. A dimension
   *  with no corresponding requirement is excluded regardless of weight. */
  weights?: Partial<Record<SoftDimension, number>>;
}

export type SoftDimension = 'price' | 'context' | 'speed' | 'intelligence';

export interface DimensionScore {
  dimension: SoftDimension;
  /** log2(headroom ratio), clamped to ±HEADROOM_CAP_LOG2; 0 for unknown. */
  utility: number;
  unknown: boolean;
}

export interface ScoredModel {
  model: CatalogModel;
  score: number;
  dimensions: DimensionScore[];
  /** Human-readable caveats: 'unknown:<dimension>' rows record where the
   *  catalog had no evidence (hard floors passed on no evidence too). */
  flags: string[];
  /** The blended price this ranking used, $/Mtok. */
  effectivePrice: number;
}

/** Declared estimate of the edit loop's token mix, pending measurement from
 *  edit-loop evals (assist/editLoop.ts is factored for them): a large prompt
 *  (document + schema + system prompt, partially cacheable across retries)
 *  and a large completion (the model rewrites the whole document through the
 *  forced tool call). */
export const DEFAULT_TOKEN_MIX: TokenMix = { input: 2, output: 1, cached: 1 };

export const DEFAULT_WEIGHTS: Record<SoftDimension, number> = {
  price: 1,
  context: 0.5,
  speed: 1,
  intelligence: 1.5,
};

/** One spectacular dimension must not drown three adequate ones: headroom
 *  ratios are clamped to 2^±6 (64×) before the log. This is also what keeps a
 *  free model's price headroom (ratio → ∞) finite. */
export const HEADROOM_CAP_LOG2 = 6;

/** Blended $/Mtok for a model under a workload mix. Cached tokens price at
 *  cacheRead when the model declares it, else at the full input rate — which
 *  is what such a model would actually charge. */
export function effectivePrice(model: CatalogModel, mix: TokenMix = DEFAULT_TOKEN_MIX): number {
  const total = mix.input + mix.output + mix.cached;
  if (total <= 0) return model.pricing.input;
  const cached = model.pricing.cacheRead ?? model.pricing.input;
  return (
    (mix.input * model.pricing.input +
      mix.output * model.pricing.output +
      mix.cached * cached) /
    total
  );
}

function clampLog2(ratio: number): number {
  if (ratio <= 0) return -HEADROOM_CAP_LOG2;
  const v = Math.log2(ratio);
  return Math.max(-HEADROOM_CAP_LOG2, Math.min(HEADROOM_CAP_LOG2, v));
}

interface HardVerdict {
  pass: boolean;
  flags: string[];
}

function hardFilter(model: CatalogModel, req: ModelRequirements, blended: number): HardVerdict {
  const flags: string[] = [];
  for (const p of req.requiredParameters ?? []) {
    if (!model.parameters.includes(p)) return { pass: false, flags };
  }
  if (req.minContext !== undefined && model.contextLength < req.minContext) {
    return { pass: false, flags };
  }
  if (req.maxEffectivePrice !== undefined && blended > req.maxEffectivePrice) {
    return { pass: false, flags };
  }
  // Dimensions the caller declared unknowns unacceptable on (see requireKnown).
  for (const d of req.requireKnown ?? []) {
    if (d === 'speed' && model.tokensPerSecond === undefined) return { pass: false, flags };
    if (d === 'intelligence' && model.intelligenceIndex === undefined) return { pass: false, flags };
  }
  // Floors over prior-supplied data: no evidence passes, flagged (an unknown
  // is not a failure — the honest verdict is "no evidence", said out loud).
  if (req.minTokensPerSecond !== undefined && req.minTokensPerSecond > 0) {
    if (model.tokensPerSecond === undefined) flags.push('unknown:speed');
    else if (model.tokensPerSecond < req.minTokensPerSecond) return { pass: false, flags };
  }
  if (req.minIntelligence !== undefined && req.minIntelligence > 0) {
    if (model.intelligenceIndex === undefined) flags.push('unknown:intelligence');
    else if (model.intelligenceIndex < req.minIntelligence) return { pass: false, flags };
  }
  return { pass: true, flags };
}

/** A soft dimension participates only when the requirements declare a
 *  reference for it — no requirement, no unit to measure headroom in. */
function softDimensions(model: CatalogModel, req: ModelRequirements, blended: number): DimensionScore[] {
  const out: DimensionScore[] = [];
  if (req.maxEffectivePrice !== undefined && req.maxEffectivePrice > 0) {
    out.push({
      dimension: 'price',
      utility: clampLog2(req.maxEffectivePrice / Math.max(blended, 1e-9)),
      unknown: false,
    });
  }
  if (req.minContext !== undefined && req.minContext > 0) {
    out.push({
      dimension: 'context',
      utility: clampLog2(model.contextLength / req.minContext),
      unknown: false,
    });
  }
  if (req.minTokensPerSecond !== undefined && req.minTokensPerSecond > 0) {
    const known = model.tokensPerSecond !== undefined;
    out.push({
      dimension: 'speed',
      utility: known ? clampLog2(model.tokensPerSecond! / req.minTokensPerSecond) : 0,
      unknown: !known,
    });
  }
  if (req.minIntelligence !== undefined && req.minIntelligence > 0) {
    const known = model.intelligenceIndex !== undefined;
    out.push({
      dimension: 'intelligence',
      utility: known ? clampLog2(model.intelligenceIndex! / req.minIntelligence) : 0,
      unknown: !known,
    });
  }
  return out;
}

/** Filter, then rank. Returns survivors ordered best-first; ties break by
 *  intelligence prior (unknown last), then context, then id — deterministic
 *  output for a deterministic input, like every verdict in this repo. */
export function selectModels(req: ModelRequirements, catalog: CatalogModel[]): ScoredModel[] {
  const weights = { ...DEFAULT_WEIGHTS, ...req.weights };
  const mix = req.tokenMix ?? DEFAULT_TOKEN_MIX;
  const scored: ScoredModel[] = [];
  for (const model of catalog) {
    const blended = effectivePrice(model, mix);
    const verdict = hardFilter(model, req, blended);
    if (!verdict.pass) continue;
    const dimensions = softDimensions(model, req, blended);
    const flags = [...verdict.flags];
    for (const d of dimensions) {
      const flag = `unknown:${d.dimension}`;
      if (d.unknown && !flags.includes(flag)) flags.push(flag);
    }
    const score = dimensions.reduce((sum, d) => sum + weights[d.dimension] * d.utility, 0);
    scored.push({ model, score, dimensions, flags, effectivePrice: blended });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.model.intelligenceIndex ?? -1) - (a.model.intelligenceIndex ?? -1) ||
      b.model.contextLength - a.model.contextLength ||
      a.model.id.localeCompare(b.model.id),
  );
  return scored;
}
