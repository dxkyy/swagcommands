import { ErrorContext, getErrorMessage, SwagError } from "./SwagError";

export class AutocompleteError extends SwagError {
  public constructor(cause: unknown, context: ErrorContext = {}) {
    super(`Autocomplete failed: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_AUTOCOMPLETE_FAILED",
      context,
      phase: "autocomplete",
    });
  }
}
