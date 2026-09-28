import type SWAG from "../SWAG";
import type {
  ChatInputCommandUsage,
  ContextMenuCommandUsage,
  MessageCommandUsage,
  PreconditionFactoryEntry,
} from "../types";
import type ContextMenuCommand from "../context-menu-handler/ContextMenuCommand";
import type SubcommandOption from "../subcommand-handler/SubcommandOption";
import type Subcommand from "../subcommand-handler/Subcommand";
import type Command from "../command-handler/Command";
import {
  createPreconditionFailure,
  createPreconditionSuccess,
  PreconditionFailureOptions,
  PreconditionResult,
} from "./PreconditionResult";

export type Awaitable<T> = T | Promise<T>;

export type PreconditionContext = Readonly<Record<PropertyKey, unknown>>;

export type PreconditionCommand =
  | Command
  | ContextMenuCommand
  | Subcommand
  | SubcommandOption;

export type {
  ChatInputCommandUsage,
  ContextMenuCommandUsage,
  MessageCommandUsage,
} from "../types";

export class Precondition {
  public readonly instance: SWAG;
  public readonly name: string;

  public constructor(instance: SWAG, name: string) {
    this.instance = instance;
    this.name = name;
  }

  public messageRun?(
    usage: MessageCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public chatInputRun?(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public contextMenuRun?(
    usage: ContextMenuCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public messageCommit?(
    usage: MessageCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public chatInputCommit?(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public contextMenuCommit?(
    usage: ContextMenuCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public ok(): PreconditionResult {
    return createPreconditionSuccess();
  }

  public error(options: PreconditionFailureOptions): PreconditionResult {
    return createPreconditionFailure(this.name, options);
  }
}

export abstract class AllFlowsPrecondition extends Precondition {
  public abstract override messageRun(
    usage: MessageCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public abstract override chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public abstract override contextMenuRun(
    usage: ContextMenuCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;
}

export interface NamedPreconditionClass {
  readonly preconditionName: string;
}

export function createPreconditionFactory<Context extends PreconditionContext>(
  precondition: string | NamedPreconditionClass,
): (context: Context) => PreconditionFactoryEntry<Context> {
  const name = typeof precondition === "string"
    ? precondition
    : precondition.preconditionName;

  return (context) => ({ name, context }) as PreconditionFactoryEntry<Context>;
}

export function preconditionOk(): PreconditionResult {
  return createPreconditionSuccess();
}

export function preconditionError(
  identifier: string,
  message?: string,
  context?: Readonly<Record<PropertyKey, unknown>>,
): PreconditionResult {
  return createPreconditionFailure("InlinePrecondition", {
    context,
    identifier,
    message,
  });
}
