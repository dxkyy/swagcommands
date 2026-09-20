import type Command from "../../command-handler/Command";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
  PreconditionContext,
} from "../Precondition";
import type { PreconditionResult } from "../PreconditionResult";

export interface PreconditionSingleResolvableDetails {
  name: string;
  context?: PreconditionContext;
}

export type PreconditionSingleResolvable =
  | string
  | PreconditionSingleResolvableDetails;

export type PreconditionEntryResolvable =
  | PreconditionSingleResolvable
  | readonly PreconditionEntryResolvable[];

export type PreconditionArrayResolvable = readonly PreconditionEntryResolvable[];

export interface PreconditionContainer {
  messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;

  chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionResult>;
}

export function isPreconditionSingleResolvable(
  entry: PreconditionEntryResolvable,
): entry is PreconditionSingleResolvable {
  const details = entry as PreconditionSingleResolvableDetails;

  return (
    typeof entry === "string" ||
    (!Array.isArray(entry) &&
      typeof entry === "object" &&
      entry !== null &&
      typeof details.name === "string")
  );
}
