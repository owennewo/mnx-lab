// Hand-written declaration for the generated tab-extension validators
// (see scripts/compile-validator.mjs).
import type { MnxValidationError } from './validate-mnx.d.mts';

type SubValidator = ((data: unknown) => boolean) & {
  errors: MnxValidationError[] | null;
};

export declare const validateTabNote: SubValidator;
export declare const validateTabPart: SubValidator;
