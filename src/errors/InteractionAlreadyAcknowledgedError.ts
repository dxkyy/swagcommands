import { ErrorContext, SwagError } from "./SwagError";

export class InteractionAlreadyAcknowledgedError extends SwagError {
  public constructor(context: ErrorContext = {}) {
    super("The interaction has already been acknowledged.", {
      code: "SWAG_INTERACTION_ALREADY_ACKNOWLEDGED",
      context,
      phase: "response",
    });
  }
}
