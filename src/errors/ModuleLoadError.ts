import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class ModuleLoadError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext = {}) {
    super(`Failed to load module: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_MODULE_LOAD_FAILED",
      context,
      phase: "initialization",
    });
  }
}
