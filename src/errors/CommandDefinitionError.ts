import { ErrorContext, SwagError } from "./SwagError";

export class CommandDefinitionError extends SwagError {
  public constructor(message: string, context: ErrorContext = {}) {
    super(message, {
      code: "SWAG_COMMAND_DEFINITION_INVALID",
      context,
      phase: "validation",
    });
  }
}
