import {
  Client,
  CommandInteraction,
  GuildMember,
  Message,
  TextChannel,
} from "discord.js";

import SWAG, { CommandUsage, SubCommandUsage } from "../../typings";
import Command from "../command-handler/Command";
import PrefixHandler from "../command-handler/PrefixHandler";
import CommandType from "../util/CommandType";
import { CommandExecutionError } from "../errors/CommandExecutionError";
import SubcommandOption from "../subcommand-handler/SubcommandOption";
import {
  InteractionResponse,
  MessageResponse,
} from "./ResponseHandler";

type Validation = (
  command: Command | SubcommandOption,
  usage: CommandUsage | SubCommandUsage,
  prefix: string,
) => boolean | Promise<boolean>;

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
    validations: Validation[],
    prefixes: PrefixHandler,
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

    const usage = this.createCommandUsage(command, args, message, interaction);

    try {
      const prefix = await prefixes.get(usage.guild?.id);
      for (const validation of validations) {
        if (!(await validation(command, usage, prefix))) {
          return;
        }
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
      await this._instance.reportError(new CommandExecutionError(error, context));
    }
  }

  public async executeSubcommand(
    command: SubcommandOption,
    args: string[],
    interaction: CommandInteraction,
    validations: Validation[],
    prefixes: PrefixHandler,
  ): Promise<void> {
    const { callback, deferReply } = command.optionObject;
    const context = {
      commandName: interaction.commandName,
      invocationKind: "interaction" as const,
      subcommandName: command.commandName,
    };

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

    const usage = this.createSubcommandUsage(command, args, interaction);

    try {
      const prefix = await prefixes.get(usage.guild?.id);
      for (const validation of validations) {
        if (!(await validation(command, usage, prefix))) {
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
      await this._instance.reportError(new CommandExecutionError(error, context));
    }
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
