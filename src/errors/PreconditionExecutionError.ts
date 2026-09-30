import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class PreconditionExecutionError extends SwagError {
  public constructor(
    cause: unknown,
    preconditionName: string,
    context: ErrorContext = {},
  ) {
    super(
      `Precondition "${preconditionName}" execution failed: ${getErrorMessage(cause)}`,
      {
        cause,
        code: "SWAG_PRECONDITION_EXECUTION_FAILED",
        context: { ...context, preconditionName },
        phase: "execution",
      },
    );
  }
}
