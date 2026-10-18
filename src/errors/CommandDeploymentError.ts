import type { CommandDeploymentTargetResult } from "../deployment/CommandDeployer";
import {
  ErrorContext,
  getErrorMessage,
  SwagError,
} from "./SwagError";

export interface CommandDeploymentErrorOptions {
  completedTargets?: readonly CommandDeploymentTargetResult[];
  context?: ErrorContext;
}

export class CommandDeploymentError extends SwagError {
  public readonly completedTargets: readonly CommandDeploymentTargetResult[];

  public constructor(
    cause: unknown,
    options: CommandDeploymentErrorOptions = {},
  ) {
    super(`Failed to deploy application commands: ${getErrorMessage(cause)}`, {
      cause,
      code: "SWAG_COMMAND_DEPLOYMENT_FAILED",
      context: options.context,
      phase: "deployment",
    });
    this.completedTargets = Object.freeze([
      ...(options.completedTargets ?? []),
    ]);
  }
}
