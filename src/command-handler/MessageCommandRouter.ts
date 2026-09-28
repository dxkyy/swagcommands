import {
  ApplicationCommandOptionType,
  Message,
} from "discord.js";

import SWAG from "../../typings";
import { CommandDefinitionError } from "../errors/CommandDefinitionError";
import Subcommand from "../subcommand-handler/Subcommand";
import SubcommandHandler from "../subcommand-handler/SubcommandHandler";
import SubcommandOption from "../subcommand-handler/SubcommandOption";
import CommandType from "../util/CommandType";
import CommandHandler from "./CommandHandler";
import PrefixHandler from "./PrefixHandler";

interface ResolvedLegacySubcommand {
  args: string[];
  command: SubcommandOption;
  subcommandGroup?: string;
  subcommandName: string;
}

export default class MessageCommandRouter {
  private readonly prefixHandler: PrefixHandler;

  public constructor(private readonly instance: SWAG) {
    this.prefixHandler = new PrefixHandler(instance);
    this.validateCommandNames(
      instance.commandHandler,
      instance.subcommandHandler,
    );
  }

  public async execute(message: Message): Promise<void> {
    if (!message.channel.isSendable()) {
      return;
    }

    const prefix = await this.prefixHandler.get(message.guild?.id);
    if (!message.content.startsWith(prefix)) {
      return;
    }

    const tokens = message.content
      .slice(prefix.length)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const commandName = tokens.shift()?.toLowerCase();
    if (!commandName) {
      return;
    }

    const command = this.instance.commandHandler?.commands.get(commandName);
    if (command && command.commandObject.type !== CommandType.SLASH) {
      await this.instance.commandHandler!.runCommand(
        command,
        tokens,
        message,
        null,
      );
      return;
    }

    const subcommandHandler = this.instance.subcommandHandler;
    const root = subcommandHandler?.legacyCommands.get(commandName);
    if (!subcommandHandler || !root) {
      return;
    }

    const resolved = this.resolveSubcommand(
      subcommandHandler,
      root,
      tokens,
    );
    if (!resolved) {
      return;
    }

    await subcommandHandler.runCommand(
      resolved.command,
      resolved.args,
      message,
      null,
      {
        subcommandGroup: resolved.subcommandGroup,
        subcommandName: resolved.subcommandName,
      },
    );
  }

  private resolveSubcommand(
    handler: SubcommandHandler,
    root: Subcommand,
    args: string[],
  ): ResolvedLegacySubcommand | undefined {
    const optionName = args.shift()?.toLowerCase();
    if (!optionName) {
      return;
    }

    const command = handler.getLegacyOptions(root)?.get(optionName);
    if (!command) {
      return;
    }

    const nestedOptions = (command.optionObject.options ?? []).filter(
      (option) => option.type === ApplicationCommandOptionType.Subcommand,
    );
    if (nestedOptions.length === 0) {
      return {
        args,
        command,
        subcommandName: command.commandName,
      };
    }

    const nestedName = args.shift()?.toLowerCase();
    const nested = nestedOptions.find(
      (option) => option.name.toLowerCase() === nestedName,
    );
    if (!nested) {
      return;
    }

    return {
      args,
      command,
      subcommandGroup: command.commandName,
      subcommandName: nested.name,
    };
  }

  private validateCommandNames(
    commandHandler?: CommandHandler,
    subcommandHandler?: SubcommandHandler,
  ): void {
    if (!commandHandler || !subcommandHandler) {
      return;
    }

    for (const [name, command] of commandHandler.commands) {
      if (
        command.commandObject.type !== CommandType.SLASH &&
        subcommandHandler.legacyCommands.has(name)
      ) {
        throw new CommandDefinitionError(
          `Legacy command name or alias "${name}" is shared by a normal command and a subcommand root.`,
          { commandName: name },
        );
      }
    }
  }
}
