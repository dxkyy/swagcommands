import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class InteractionResponseError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext = {}) {
    super(`Interaction response failed: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_INTERACTION_RESPONSE_FAILED",
      context,
      phase: "response",
    });
  }
}
