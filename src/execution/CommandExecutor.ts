import {
  Client,
  CommandInteraction,
  GuildMember,
  Message,
  TextChannel,
} from "discord.js";

import SWAG, { CommandUsage, SubCommandUsage } from "../../typings";
import Command from "../command-handler/Command";
import CommandType from "../util/CommandType";
import { CommandExecutionError } from "../errors/CommandExecutionError";
import { PreconditionExecutionError } from "../errors/PreconditionExecutionError";
import type {
  ChatInputCommandUsage,
  MessageCommandUsage,
  PreconditionCommand,
} from "../preconditions/Precondition";
import type { PreconditionResult } from "../preconditions/PreconditionResult";
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
    interaction: CommandInteraction | null,
  ): Promise<void> {
    const { callback, deferReply, reply, type } = command.commandObject;

    if (message && type === CommandType.SLASH) {
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
        ? await command.preconditions.messageRun(
            usage as MessageCommandUsage,
            command,
          )
        : await command.preconditions.chatInputRun(
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
    interaction: CommandInteraction,
  ): Promise<void> {
    const { callback, deferReply } = command.optionObject;
    const context = {
      commandName: command.parent.commandName,
      invocationKind: "interaction" as const,
      subcommandName: command.commandName,
    };

    const usage = this.createSubcommandUsage(command, args, interaction);

    try {
      const rootResult = await command.parent.preconditions.chatInputRun(
        usage as ChatInputCommandUsage,
        command.parent,
      );
      if (
        !(await this.handlePreconditionResult(
          rootResult,
          usage as ChatInputCommandUsage,
          command.parent,
          null,
          interaction,
          false,
          context,
        ))
      ) {
        return;
      }

      const optionResult = await command.preconditions.chatInputRun(
        usage as ChatInputCommandUsage,
        command,
      );
      if (
        !(await this.handlePreconditionResult(
          optionResult,
          usage as ChatInputCommandUsage,
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

      const response = await callback(usage);
      if (response === undefined) {
        return;
      }

      await this._instance.responseHandler.respondToInteraction(
        interaction,
        response as InteractionResponse,
        context,
      );
    } catch (error) {
      await this.reportExecutionError(error, context);
    }
  }

  private async handlePreconditionResult(
    result: PreconditionResult,
    usage: MessageCommandUsage | ChatInputCommandUsage,
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
    interaction: CommandInteraction | null,
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

  private createSubcommandUsage(
    command: SubcommandOption,
    args: string[],
    interaction: CommandInteraction,
  ): SubCommandUsage {
    return {
      args,
      channel: interaction.channel as TextChannel,
      client: command.instance.client,
      guild: interaction.guild,
      instance: command.instance,
      interaction,
      member: interaction.member as GuildMember,
      text: args.join(" "),
      user: interaction.user,
    };
  }
}

export default CommandExecutor;
