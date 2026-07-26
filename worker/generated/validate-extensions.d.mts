// Hand-written declaration for the generated `_x.mnxLab` extension validators
// (see scripts/compile-validator.mjs).
import type { MnxValidationError } from './validate-mnx.d.mts';

type SubValidator = ((data: unknown) => boolean) & {
  errors: MnxValidationError[] | null;
};

export declare const validateNoteExt: SubValidator;
export declare const validatePartExt: SubValidator;
export declare const validateGlobalMeasureExt: SubValidator;
