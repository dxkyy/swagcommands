import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class MessageResponseError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext = {}) {
    super(`Message response failed: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_MESSAGE_RESPONSE_FAILED",
      context,
      phase: "response",
    });
  }
}
