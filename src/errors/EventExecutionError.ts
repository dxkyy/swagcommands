import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class EventExecutionError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext = {}) {
    super(`Event callback failed: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_EVENT_EXECUTION_FAILED",
      context,
      phase: "event",
    });
  }
}
