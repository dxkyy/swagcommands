import type Command from "../../command-handler/Command";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
  PreconditionContext,
} from "../Precondition";
import type { PreconditionResult } from "../PreconditionResult";

export type PreconditionCommit = () => Promise<PreconditionResult>;

export type PreconditionCheckResult =
  | {
      readonly success: true;
      readonly commits: readonly PreconditionCommit[];
    }
  | Extract<PreconditionResult, { success: false }>;

export interface PreconditionSingleResolvableDetails {
  name: string;
  context?: PreconditionContext;
}

export type InlinePrecondition = (
  usage: MessageCommandUsage | ChatInputCommandUsage,
  command: PreconditionCommand,
) => boolean | PreconditionResult | Promise<boolean | PreconditionResult>;

export interface PreconditionAnyResolvable {
  any: PreconditionArrayResolvable;
}

export interface PreconditionAllResolvable {
  all: PreconditionArrayResolvable;
}

export type PreconditionSingleResolvable =
  | string
  | PreconditionSingleResolvableDetails
  | InlinePrecondition;

export type PreconditionEntryResolvable =
  | PreconditionSingleResolvable
  | PreconditionAnyResolvable
  | PreconditionAllResolvable;

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

  messageCheck(
    usage: MessageCommandUsage,
    command: Command,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;

  chatInputCheck(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context?: PreconditionContext,
  ): Promise<PreconditionCheckResult>;
}

export function isPreconditionSingleResolvable(
  entry: PreconditionEntryResolvable,
): entry is PreconditionSingleResolvable {
  const details = entry as PreconditionSingleResolvableDetails;

  return (
    typeof entry === "string" ||
    typeof entry === "function" ||
    (!Array.isArray(entry) &&
      typeof entry === "object" &&
      entry !== null &&
      typeof details.name === "string")
  );
}

export function isPreconditionGroupResolvable(
  entry: PreconditionEntryResolvable,
): entry is PreconditionAnyResolvable | PreconditionAllResolvable {
  return (
    typeof entry === "object" &&
    entry !== null &&
    (("any" in entry && Array.isArray(entry.any)) ||
      ("all" in entry && Array.isArray(entry.all)))
  );
}
