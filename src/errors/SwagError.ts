export type ErrorPhase =
  | "initialization"
  | "validation"
  | "execution"
  | "response"
  | "autocomplete"
  | "event";

export type InvocationKind = "message" | "interaction" | "autocomplete";

export interface ErrorContext {
  commandName?: string;
  eventName?: string;
  filePath?: string;
  invocationKind?: InvocationKind;
  preconditionName?: string;
  subcommandName?: string;
}

export interface SwagErrorOptions {
  cause?: unknown;
  code: string;
  context?: ErrorContext;
  phase: ErrorPhase;
}

export class SwagError extends Error {
  public readonly code: string;
  public readonly context: Readonly<ErrorContext>;
  public readonly phase: ErrorPhase;

  public constructor(message: string, options: SwagErrorOptions) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.code = options.code;
    this.context = Object.freeze({ ...options.context });
    this.phase = options.phase;
  }
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unknown error occurred.";
};
