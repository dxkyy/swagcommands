import { ErrorContext, SwagError } from "./SwagError";

export class FeatureDefinitionError extends SwagError {
  public constructor(message: string, context: ErrorContext = {}) {
    super(message, {
      code: "SWAG_FEATURE_DEFINITION_INVALID",
      context,
      phase: "validation",
    });
  }
}
