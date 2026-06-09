// Hand-written declaration for the generated standalone Ajv validator
// (see scripts/compile-validator.mjs).
export interface MnxValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

declare const validate: ((data: unknown) => boolean) & {
  errors: MnxValidationError[] | null;
};

export default validate;
