export interface PreconditionFailureOptions {
  identifier: string;
  message?: string;
  context?: Readonly<Record<PropertyKey, unknown>>;
}

export interface PreconditionFailure extends PreconditionFailureOptions {
  preconditionName: string;
}

export interface PreconditionSuccessResult {
  readonly success: true;
}

export interface PreconditionFailureResult {
  readonly success: false;
  readonly failure: Readonly<PreconditionFailure>;
}

export type PreconditionResult =
  | PreconditionSuccessResult
  | PreconditionFailureResult;

const successResult: PreconditionSuccessResult = Object.freeze({
  success: true,
});

export function createPreconditionSuccess(): PreconditionSuccessResult {
  return successResult;
}

export function createPreconditionFailure(
  preconditionName: string,
  options: PreconditionFailureOptions,
): PreconditionFailureResult {
  const context = options.context
    ? Object.freeze({ ...options.context })
    : undefined;
  const failure = Object.freeze({
    context,
    identifier: options.identifier,
    message: options.message,
    preconditionName,
  });

  return Object.freeze({
    failure,
    success: false,
  });
}
