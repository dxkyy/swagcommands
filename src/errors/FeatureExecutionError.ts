import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class FeatureExecutionError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext) {
    super(`Feature execution failed: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_FEATURE_EXECUTION_FAILED",
      context,
      phase: "execution",
    });
  }
}
