import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class FeatureCleanupError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext) {
    super(`Feature cleanup failed: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_FEATURE_CLEANUP_FAILED",
      context,
      phase: "execution",
    });
  }
}
