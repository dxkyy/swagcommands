import {
  ApplicationCommandType,
  Client,
  ChatInputCommandInteraction,
  CommandInteraction,
  ContextMenuCommandInteraction,
  GuildMember,
  Message,
  TextChannel,
} from "discord.js";

import type SWAG from "../SWAG";
import type {
  CommandUsage,
  ContextMenuCommandUsage,
  MessageContextMenuCommandUsage,
  SubcommandUsage,
  UserContextMenuCommandUsage,
} from "../types";
import Command from "../command-handler/Command";
import ContextMenuCommand from "../context-menu-handler/ContextMenuCommand";
import CommandType from "../util/CommandType";
import { CommandExecutionError } from "../errors/CommandExecutionError";
import { PreconditionExecutionError } from "../errors/PreconditionExecutionError";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
} from "../preconditions/Precondition";
import type { PreconditionResult } from "../preconditions/PreconditionResult";
import type {
  PreconditionCheckResult,
  PreconditionCommit,
} from "../preconditions/containers/PreconditionContainer";
import SubcommandOption from "../subcommand-handler/SubcommandOption";
import {
  InteractionResponse,
  MessageResponse,
} from "./ResponseHandler";

class CommandExecutor {
  private readonly _instance: SWAG;

  public constructor(instance: SWAG) {
    this._instance = instance;
  }

  public async executeCommand(
    command: Command,
    args: string[],
    message: Message | null,
    interaction: ChatInputCommandInteraction | null,
  ): Promise<void> {
    const definition = command.commandObject;
    const { deferReply, reply, type } = definition;

    if (
      (message && type === CommandType.SLASH) ||
      (interaction && type === CommandType.LEGACY)
    ) {
      return;
    }

    const context = {
      commandName: command.commandName,
      invocationKind: (message ? "message" : "interaction") as
        | "message"
        | "interaction",
    };

    const usage = this.createCommandUsage(command, args, message, interaction);

    try {
      const preconditionResult = message
        ? await command.preconditions.messageCheck(
            usage as MessageCommandUsage,
            command,
          )
        : await command.preconditions.chatInputCheck(
            usage as ChatInputCommandUsage,
            command,
          );
      if (
        !(await this.handlePreconditionResult(
          preconditionResult,
          usage as MessageCommandUsage | ChatInputCommandUsage,
          command,
          message,
          interaction,
          reply === true,
          context,
        ))
      ) {
        return;
      }

      if (
        !(await this.runPreconditionCommits(
          preconditionResult,
          usage as MessageCommandUsage | ChatInputCommandUsage,
          command,
          message,
          interaction,
          reply === true,
          context,
        ))
      ) {
        return;
      }

      if (interaction && deferReply) {
        const deferred = await this._instance.responseHandler.defer(
          interaction,
          deferReply,
          context,
        );
        if (!deferred) {
          return;
        }
      } else if (message && deferReply) {
        await this._instance.responseHandler.indicateTyping(message, context);
      }

      const response = type === CommandType.LEGACY
        ? await definition.callback(usage as MessageCommandUsage)
        : type === CommandType.SLASH
          ? await definition.callback(usage as ChatInputCommandUsage)
          : await definition.callback(
              usage as MessageCommandUsage | ChatInputCommandUsage,
            );
      if (response === undefined) {
        return;
      }

      if (interaction) {
        await this._instance.responseHandler.respondToInteraction(
          interaction,
          response as InteractionResponse,
          context,
        );
      } else if (message) {
        await this._instance.responseHandler.respondToMessage(
          message,
          response as MessageResponse,
          reply === true,
          context,
        );
      }
    } catch (error) {
      await this.reportExecutionError(error, context);
    }
  }

  public async executeSubcommand(
    command: SubcommandOption,
    args: string[],
    message: Message | null,
    interaction: ChatInputCommandInteraction | null,
    selection: {
      subcommandGroup?: string;
      subcommandName?: string;
    } = {},
  ): Promise<void> {
    if ((!message && !interaction) || (message && interaction)) {
      return;
    }

    const { callback } = command.optionObject;
    const { type } = command.parent.commandObject;
    if (
      (message && type === CommandType.SLASH) ||
      (interaction && type === CommandType.LEGACY)
    ) {
      return;
    }

    const deferReply =
      command.optionObject.deferReply ??
      command.parent.commandObject.deferReply ??
      false;
    const reply =
      command.optionObject.reply ?? command.parent.commandObject.reply ?? false;
    const context = {
      commandName: command.parent.commandName,
      invocationKind: (message ? "message" : "interaction") as
        | "message"
        | "interaction",
      subcommandName: command.commandName,
    };

    const usage = this.createSubcommandUsage(
      command,
      args,
      message,
      interaction,
      selection,
    );

    try {
      const rootResult = message
        ? await command.parent.preconditions.messageCheck(
            usage as MessageCommandUsage,
            command.parent,
          )
        : await command.parent.preconditions.chatInputCheck(
            usage as ChatInputCommandUsage,
            command.parent,
          );
      if (
        !(await this.handlePreconditionResult(
          rootResult,
          usage,
          command.parent,
          message,
          interaction,
          reply,
          context,
        ))
      ) {
        return;
      }

      const optionResult = message
        ? await command.preconditions.messageCheck(
            usage as MessageCommandUsage,
            command,
          )
        : await command.preconditions.chatInputCheck(
            usage as ChatInputCommandUsage,
            command,
          );
      if (
        !(await this.handlePreconditionResult(
          optionResult,
          usage,
          command,
          message,
          interaction,
          reply,
          context,
        ))
      ) {
        return;
      }

      if (
        !(await this.runPreconditionCommits(
          rootResult,
          usage,
          command.parent,
          message,
          interaction,
          reply,
          context,
        )) ||
        !(await this.runPreconditionCommits(
          optionResult,
          usage,
          command,
          message,
          interaction,
          reply,
          context,
        ))
      ) {
        return;
      }

      if (interaction && deferReply) {
        const deferred = await this._instance.responseHandler.defer(
          interaction,
          deferReply,
          context,
        );
        if (!deferred) {
          return;
        }
      } else if (message && deferReply) {
        await this._instance.responseHandler.indicateTyping(message, context);
      }

      const response = await callback(usage);
      if (response === undefined) {
        return;
      }

      if (interaction) {
        await this._instance.responseHandler.respondToInteraction(
          interaction,
          response as InteractionResponse,
          context,
        );
      } else if (message) {
        await this._instance.responseHandler.respondToMessage(
          message,
          response as MessageResponse,
          reply,
          context,
        );
      }
    } catch (error) {
      await this.reportExecutionError(error, context);
    }
  }

  public async executeContextMenuCommand(
    command: ContextMenuCommand,
    interaction: ContextMenuCommandInteraction,
  ): Promise<void> {
    const { callback, deferReply, type } = command.commandObject;
    if (
      (type === ApplicationCommandType.User &&
        !interaction.isUserContextMenuCommand()) ||
      (type === ApplicationCommandType.Message &&
        !interaction.isMessageContextMenuCommand())
    ) {
      return;
    }

    const context = {
      commandName: command.commandName,
      invocationKind: "interaction" as const,
    };
    const usage = this.createContextMenuCommandUsage(command, interaction);

    try {
      const preconditionResult = await command.preconditions.contextMenuCheck(
        usage,
        command,
      );
      if (
        !(await this.handlePreconditionResult(
          preconditionResult,
          usage,
          command,
          null,
          interaction,
          false,
          context,
        ))
      ) {
        return;
      }
      if (
        !(await this.runPreconditionCommits(
          preconditionResult,
          usage,
          command,
          null,
          interaction,
          false,
          context,
        ))
      ) {
        return;
      }

      if (deferReply) {
        const deferred = await this._instance.responseHandler.defer(
          interaction,
          deferReply,
          context,
        );
        if (!deferred) {
          return;
        }
      }

      const response = type === ApplicationCommandType.User
        ? await callback(usage as UserContextMenuCommandUsage)
        : await callback(usage as MessageContextMenuCommandUsage);
      if (response !== undefined) {
        await this._instance.responseHandler.respondToInteraction(
          interaction,
          response,
          context,
        );
      }
    } catch (error) {
      await this.reportExecutionError(error, context);
    }
  }

  private async handlePreconditionResult(
    result: PreconditionResult,
    usage:
      | MessageCommandUsage
      | ChatInputCommandUsage
      | ContextMenuCommandUsage,
    command: PreconditionCommand,
    message: Message | null,
    interaction: CommandInteraction | null,
    reply: boolean,
    context: {
      commandName: string;
      invocationKind: "message" | "interaction";
      subcommandName?: string;
    },
  ): Promise<boolean> {
    if (result.success) {
      return true;
    }

    const response = await this._instance.handlePreconditionFailure({
      command,
      failure: result.failure,
      usage,
    });
    if (response === undefined) {
      return false;
    }

    if (interaction) {
      await this._instance.responseHandler.respondToInteraction(
        interaction,
        response as InteractionResponse,
        context,
      );
    } else if (message) {
      await this._instance.responseHandler.respondToMessage(
        message,
        response as MessageResponse,
        reply,
        context,
      );
    }

    return false;
  }

  private async runPreconditionCommits(
    check: PreconditionCheckResult,
    usage:
      | MessageCommandUsage
      | ChatInputCommandUsage
      | ContextMenuCommandUsage,
    command: PreconditionCommand,
    message: Message | null,
    interaction: CommandInteraction | null,
    reply: boolean,
    context: {
      commandName: string;
      invocationKind: "message" | "interaction";
      subcommandName?: string;
    },
  ): Promise<boolean> {
    if (!check.success) return false;

    for (const commit of check.commits as readonly PreconditionCommit[]) {
      const result = await commit();
      if (
        !(await this.handlePreconditionResult(
          result,
          usage,
          command,
          message,
          interaction,
          reply,
          context,
        ))
      ) {
        return false;
      }
    }
    return true;
  }

  private async reportExecutionError(
    error: unknown,
    context: {
      commandName: string;
      invocationKind: "message" | "interaction";
      subcommandName?: string;
    },
  ): Promise<void> {
    await this._instance.reportError(
      error instanceof PreconditionExecutionError
        ? error
        : new CommandExecutionError(error, context),
    );
  }

  private createCommandUsage(
    command: Command,
    args: string[],
    message: Message | null,
    interaction: ChatInputCommandInteraction | null,
  ): CommandUsage {
    const guild = message ? message.guild : interaction?.guild;
    const member = (
      message ? message.member : interaction?.member
    ) as GuildMember;
    const user = message ? message.author : interaction?.user;
    const channel = (
      message ? message.channel : interaction?.channel
    ) as TextChannel;

    return {
      args,
      channel,
      client: command.instance.client as Client,
      guild,
      instance: command.instance,
      interaction,
      member,
      message,
      text: args.join(" "),
      user: user!,
    };
  }

  private createContextMenuCommandUsage(
    command: ContextMenuCommand,
    interaction: ContextMenuCommandInteraction,
  ): ContextMenuCommandUsage {
    const base = {
      args: [],
      channel: interaction.channel as TextChannel,
      client: command.instance.client as Client,
      guild: interaction.guild,
      instance: command.instance,
      member: interaction.member as GuildMember,
      message: null as null,
      text: "",
      user: interaction.user,
    };

    if (interaction.isUserContextMenuCommand()) {
      return {
        ...base,
        interaction,
        targetMember: interaction.targetMember,
        targetUser: interaction.targetUser,
      };
    }

    if (interaction.isMessageContextMenuCommand()) {
      return {
        ...base,
        interaction,
        targetMessage: interaction.targetMessage,
      };
    }

    throw new TypeError("Expected a user or message context-menu interaction.");
  }

  private createSubcommandUsage(
    command: SubcommandOption,
    args: string[],
    message: Message | null,
    interaction: ChatInputCommandInteraction | null,
    selection: {
      subcommandGroup?: string;
      subcommandName?: string;
    },
  ): SubcommandUsage {
    const identity = {
      commandName: command.parent.commandName,
      subcommandGroup: selection.subcommandGroup,
      subcommandName: selection.subcommandName ?? command.commandName,
    };
    if (message) {
      return {
        args,
        channel: message.channel as TextChannel,
        client: command.instance.client as Client,
        guild: message.guild,
        instance: command.instance,
        interaction: null,
        member: message.member as GuildMember,
        message,
        ...identity,
        text: args.join(" "),
        user: message.author,
      };
    }

    return {
      args,
      channel: interaction!.channel as TextChannel,
      client: command.instance.client as Client,
      guild: interaction!.guild,
      instance: command.instance,
      interaction: interaction!,
      member: interaction!.member as GuildMember,
      message: null,
      ...identity,
      text: args.join(" "),
      user: interaction!.user,
    };
  }
}

export default CommandExecutor;
