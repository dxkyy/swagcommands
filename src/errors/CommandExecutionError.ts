import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class CommandExecutionError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext = {}) {
    super(`Command execution failed: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_COMMAND_EXECUTION_FAILED",
      context,
      phase: "execution",
    });
  }
}
