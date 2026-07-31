import { pointerToDisplayPath } from './jsonView.ts';

export interface PinnedError {
  /** Short rule id, e.g. clef-sign/enum. */
  rule: string;
  /** Human message, e.g. "TAB" is not one of: C, F, G. */
  msg: string;
  /** Display path, e.g. parts[0].measures[0].clefs[0].clef.sign. */
  path: string;
  /** JSON pointer into the document (for cross-highlighting), or null. */
  pointer: string | null;
}

interface AjvError {
  instancePath: string;
  schemaPath: string;
  message?: string;
  params?: Record<string, unknown>;
}

/** Mirrors harness/verify/check-scenarios.mjs formatError — pinned fragments match this. */
function formatError(err: AjvError): string {
  return `${err.instancePath || '/'} [${err.schemaPath}] ${err.message}`;
}

function valueAtPointer(doc: unknown, pointer: string): unknown {
  let v: unknown = doc;
  for (const seg of pointer.split('/').filter(Boolean)) {
    if (v == null || typeof v !== 'object') return undefined;
    v = (v as Record<string, unknown>)[seg.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return v;
}

function ruleOf(err: AjvError): string {
  // '#/$defs/clef-sign/enum' → 'clef-sign/enum'
  return err.schemaPath.replace(/^#\//, '').replace(/^\$defs\//, '');
}

function messageOf(err: AjvError, doc: unknown): string {
  const allowed = err.params?.allowedValues;
  if (Array.isArray(allowed)) {
    const value = valueAtPointer(doc, err.instancePath);
    return `${JSON.stringify(value)} is not one of: ${allowed.join(', ')}`;
  }
  return err.message ?? 'validation error';
}

/**
 * Resolves a spec-gap scenario's pinned error fragments (meta.expect.errors)
 * to the actual validation errors, by running the precompiled MNX validator
 * in the browser (lazy chunk — only loaded when an invalid-by-design exhibit
 * is opened). Fragments that match no live error fall back to a raw row, so
 * the exhibit still reads if the validator drifts.
 */
export async function resolvePinnedErrors(
  doc: unknown,
  fragments: string[]
): Promise<PinnedError[]> {
  let errors: AjvError[] = [];
  try {
    // Generated standalone Ajv module (lazy chunk; see spec/tools/compile-validator.mjs)
    const mod = await import('../../worker/generated/validate-mnx.mjs');
    const validate = mod.default as ((d: unknown) => boolean) & { errors?: AjvError[] | null };
    if (!validate(doc)) errors = validate.errors ?? [];
  } catch (err) {
    console.warn('Pinned-error validator failed to load', err);
  }

  const out: PinnedError[] = [];
  for (const fragment of fragments) {
    const match = errors.find(e => formatError(e).includes(fragment));
    if (match) {
      out.push({
        rule: ruleOf(match),
        msg: messageOf(match, doc),
        path: pointerToDisplayPath(match.instancePath),
        pointer: match.instancePath
      });
    } else {
      out.push({ rule: fragment, msg: 'pinned fragment (no live validator match)', path: '', pointer: null });
    }
  }
  return out;
}
