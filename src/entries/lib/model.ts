// mnx-lab/model — document types, upgrades and key derivation.
export * from '../../model/mnx.ts';
export { upgradeTabExtension } from '../../model/upgradeTabExtension.ts';
export { syntheticNoteKey } from '../../model/noteKeys.ts';

/**
 * Validates a document against the published MNX schema (the precompiled
 * standalone Ajv validator — no runtime codegen, works in Workers).
 */
export async function validate(
  doc: unknown
): Promise<{ valid: boolean; errors: { instancePath: string; message?: string }[] }> {
  const mod = await import('../../../worker/generated/validate-mnx.mjs');
  const validateMnx = mod.default;
  const valid = validateMnx(doc);
  return { valid, errors: valid ? [] : (validateMnx.errors ?? []) };
}
