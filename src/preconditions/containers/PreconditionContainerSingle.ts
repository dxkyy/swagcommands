import type Command from "../../command-handler/Command";
import { PreconditionExecutionError } from "../../errors/PreconditionExecutionError";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  Precondition,
  PreconditionCommand,
  PreconditionContext,
} from "../Precondition";
import {
  createPreconditionFailure,
  createPreconditionSuccess,
  PreconditionResult,
} from "../PreconditionResult";
import type { PreconditionLookup } from "../PreconditionStore";
import type {
  PreconditionContainer,
  PreconditionCheckResult,
  InlinePrecondition,
  PreconditionSingleResolvable,
  PreconditionSingleResolvableDetails,
} from "./PreconditionContainer";

export class PreconditionContainerSingle implements PreconditionContainer {
  public readonly context: PreconditionContext;
  public readonly name: string;
  private readonly inline?: InlinePrecondition;

  public constructor(
    private readonly store: PreconditionLookup,
    data: PreconditionSingleResolvable,
  ) {
    if (typeof data === "function") {
      this.name = data.name || "InlinePrecondition";
      this.context = Object.freeze({});
      this.inline = data;
    } else if (typeof data === "string") {
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
    if (this.inline) {
      return this.runInline(usage, command);
    }
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

  public async messageCheck(
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext = {},
  ): Promise<PreconditionCheckResult> {
    const result = await this.messageRun(usage, command, context);
    if (!result.success) return result;

    const precondition = this.inline ? undefined : this.store.get(this.name);
    const mergedContext = this.mergeContext(context);
    return {
      commits: precondition?.messageCommit
        ? [() => this.runMessageCommit(precondition, usage, command, mergedContext)]
        : [],
      success: true,
    };
  }

  public async chatInputRun(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext = {},
  ) {
    if (this.inline) {
      return this.runInline(usage, command);
    }
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

  public async chatInputCheck(
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext = {},
  ): Promise<PreconditionCheckResult> {
    const result = await this.chatInputRun(usage, command, context);
    if (!result.success) return result;

    const precondition = this.inline ? undefined : this.store.get(this.name);
    const mergedContext = this.mergeContext(context);
    return {
      commits: precondition?.chatInputCommit
        ? [() => this.runChatInputCommit(precondition, usage, command, mergedContext)]
        : [],
      success: true,
    };
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

  private async runInline(
    usage: MessageCommandUsage | ChatInputCommandUsage,
    command: PreconditionCommand,
  ): Promise<PreconditionResult> {
    try {
      const result = await this.inline!(usage, command);
      return typeof result === "boolean"
        ? result
          ? createPreconditionSuccess()
          : createPreconditionFailure(this.name, {
              identifier: "INLINE_PRECONDITION_FAILED",
            })
        : result;
    } catch (error) {
      const isSubcommandOption = "parent" in command;
      throw new PreconditionExecutionError(error, this.name, {
        commandName: isSubcommandOption
          ? command.parent.commandName
          : command.commandName,
        invocationKind: "message" in usage && usage.message
          ? "message"
          : "interaction",
        subcommandName: isSubcommandOption ? command.commandName : undefined,
      });
    }
  }

  private async runMessageCommit(
    precondition: Precondition,
    usage: MessageCommandUsage,
    command: Command,
    context: PreconditionContext,
  ): Promise<PreconditionResult> {
    try {
      return await precondition.messageCommit!(usage, command, context);
    } catch (error) {
      throw new PreconditionExecutionError(error, precondition.name, {
        commandName: command.commandName,
        invocationKind: "message",
      });
    }
  }

  private async runChatInputCommit(
    precondition: Precondition,
    usage: ChatInputCommandUsage,
    command: PreconditionCommand,
    context: PreconditionContext,
  ): Promise<PreconditionResult> {
    try {
      return await precondition.chatInputCommit!(usage, command, context);
    } catch (error) {
      const isSubcommandOption = "parent" in command;
      throw new PreconditionExecutionError(error, precondition.name, {
        commandName: isSubcommandOption
          ? command.parent.commandName
          : command.commandName,
        invocationKind: "interaction",
        subcommandName: isSubcommandOption ? command.commandName : undefined,
      });
    }
  }
}
