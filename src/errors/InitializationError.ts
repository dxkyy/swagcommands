import {
  ErrorContext,
  getErrorMessage,
  SwagError,
} from "./SwagError";

export interface InitializationErrorOptions {
  cause?: unknown;
  context?: ErrorContext;
}

export class InitializationError extends SwagError {
  public constructor(
    cause: unknown,
    options: Omit<InitializationErrorOptions, "cause"> = {},
  ) {
    super(`Failed to initialize SWAGCommands: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_INITIALIZATION_FAILED",
      context: options.context,
      phase: "initialization",
    });
  }
}
