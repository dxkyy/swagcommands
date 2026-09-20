import type Command from "../../command-handler/Command";
import { PreconditionExecutionError } from "../../errors/PreconditionExecutionError";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
  PreconditionContext,
} from "../Precondition";
import { createPreconditionFailure } from "../PreconditionResult";
import type { PreconditionLookup } from "../PreconditionStore";
import type {
  PreconditionContainer,
  PreconditionSingleResolvable,
} from "./PreconditionContainer";

export class PreconditionContainerSingle implements PreconditionContainer {
  public readonly context: PreconditionContext;
  public readonly name: string;

  public constructor(
    private readonly store: PreconditionLookup,
    data: PreconditionSingleResolvable,
  ) {
    if (typeof data === "string") {
      this.name = data;
      this.context = Object.freeze({});
    } else {
      this.name = data.name;
      this.context = Object.freeze({ ...(data.context ?? {}) });
    }

    if (!this.name) {
      throw new TypeError("A precondition name cannot be empty.");
    }
  }

  public async messageRun(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext = {},
  ) {
    const precondition = this.store.get(this.name);
    if (!precondition) {
      return this.unavailable();
    }

    if (!precondition.messageRun) {
      return createPreconditionFailure(precondition.name, {
        identifier: "PRECONDITION_MISSING_MESSAGE_HANDLER",
        message: `The precondition "${precondition.name}" cannot run for message commands.`,
      });
    }

    try {
      return await precondition.messageRun(
        usage,
        command,
        this.mergeContext(context),
      );
    } catch (error) {
      throw new PreconditionExecutionError(error, precondition.name, {
        commandName: command.commandName,
        invocationKind: "message",
      });
    }
  }

  public async chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext = {},
  ) {
    const precondition = this.store.get(this.name);
    if (!precondition) {
      return this.unavailable();
    }

    if (!precondition.chatInputRun) {
      return createPreconditionFailure(precondition.name, {
        identifier: "PRECONDITION_MISSING_CHAT_INPUT_HANDLER",
        message: `The precondition "${precondition.name}" cannot run for chat-input commands.`,
      });
    }

    try {
      return await precondition.chatInputRun(
        usage,
        command,
        this.mergeContext(context),
      );
    } catch (error) {
      const isSubcommandOption = "parent" in command;
      throw new PreconditionExecutionError(error, precondition.name, {
        commandName: isSubcommandOption
          ? command.parent.commandName
          : command.commandName,
        invocationKind: "interaction",
        subcommandName: isSubcommandOption
          ? command.commandName
          : undefined,
      });
    }
  }

  private mergeContext(context: PreconditionContext): PreconditionContext {
    return Object.freeze({ ...context, ...this.context });
  }

  private unavailable() {
    return createPreconditionFailure(this.name, {
      identifier: "PRECONDITION_UNAVAILABLE",
      message: `The precondition "${this.name}" is not registered.`,
    });
  }
}
