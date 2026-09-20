import type { CommandInteraction, Message } from "discord.js";

import type SWAG from "../../typings";
import type { CommandUsage, SubCommandUsage } from "../../typings";
import type Command from "../command-handler/Command";
import type SubcommandOption from "../subcommand-handler/SubcommandOption";
import {
  createPreconditionFailure,
  createPreconditionSuccess,
  PreconditionFailureOptions,
  PreconditionResult,
} from "./PreconditionResult";

export type Awaitable<T> = T | Promise<T>;

export type PreconditionContext = Readonly<Record<PropertyKey, unknown>>;

export type PreconditionCommand = Command | SubcommandOption;

export type MessageCommandUsage = CommandUsage & {
  interaction?: null;
  message: Message;
};

export type ChatInputCommandUsage =
  | (CommandUsage & {
      interaction: CommandInteraction;
      message?: null;
    })
  | (SubCommandUsage & {
      interaction: CommandInteraction;
    });

export class Precondition {
  public readonly instance: SWAG;
  public readonly name: string;

  public constructor(instance: SWAG, name: string) {
    this.instance = instance;
    this.name = name;
  }

  public messageRun?(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public chatInputRun?(
    usage: ChatInputCommandUsage,
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
    command: Command,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;

  public abstract override chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Awaitable<PreconditionResult>;
}
