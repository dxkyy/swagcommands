import {
  ApplicationCommandOptionType,
  Client,
  CommandInteraction,
} from "discord.js";
import path from "path";

import getAllFiles from "../util/get-all-files";
import Subcommand from "./Subcommand";
import SubcommandOption from "./SubcommandOption";
import SubSlashCommands from "./SubSlashCommand";
import SWAG, {
  SubcommandObject,
  SubcommandOptionObject,
} from "../../typings";
import CommandExecutor from "../execution/CommandExecutor";
import { resolveChatInputPreconditions } from "../preconditions/resolve-command-preconditions";

class CommandHandler {
  // <commandName, instance of the Command class>
  private _subCommands: Map<string, Subcommand> = new Map();
  private _instance: SWAG;
  private _client: Client;
  private _commandsDir: string;
  private _slashCommands: SubSlashCommands;
  private _loading: Promise<void> | undefined;
  private _executor: CommandExecutor;

  constructor(
    instance: SWAG,
    commandsDir: string,
    client: Client,
    executor: CommandExecutor,
  ) {
    this._instance = instance;
    this._commandsDir = commandsDir;
    this._slashCommands = new SubSlashCommands(client);
    this._client = client;
    this._executor = executor;
  }

  public get commands() {
    return this._subCommands;
  }

  public get slashCommands() {
    return this._slashCommands;
  }

  public load(): Promise<void> {
    this._loading ??= this.readFiles();
    return this._loading;
  }

  private async readFiles() {
    const files = getAllFiles(this._commandsDir, true);
    const validations = [
      ...this.getValidations(path.join(__dirname, "validations", "syntax")),
      ...this.getValidations(this._instance.validations?.syntax),
    ];

    for (let fileData of [...files]) {
      const { filePath } = fileData;
      const split = filePath.split(/[\/\\]/);
      let commandName = split.pop()!;

      const options = getAllFiles(filePath);
      let optionDatas: SubcommandOption[] = [];
      let index = null;

      for (let option of options) {
        const { filePath } = option;
        const split = filePath.split(/[\/\\]/);
        let optionName = split.pop()!;
        optionName = optionName.split(".")[0];

        if (optionName === "index") {
          index = option;
          continue;
        }

        const optionObject: SubcommandOptionObject = option.fileContents;
        const preconditions = resolveChatInputPreconditions(
          this._instance.preconditions,
          optionObject.preconditions,
          {
            commandName,
            filePath,
            subcommandName: optionName,
          },
        );

        const subCommandOption = new SubcommandOption(
          this._instance,
          optionName,
          optionObject,
          preconditions,
        );
        optionDatas.push(subCommandOption);
      }

      const commandObject: SubcommandObject =
        index?.fileContents ?? require(filePath).default;
      const preconditions = resolveChatInputPreconditions(
        this._instance.preconditions,
        commandObject.preconditions,
        {
          commandName,
          filePath: index?.filePath ?? filePath,
        },
      );

      const command = new Subcommand(
        this._instance,
        commandName,
        commandObject,
        optionDatas,
        preconditions,
      );

      const { delete: del } = commandObject;

      if (del) {
        continue;
      }

      if (!index)
        for (const validation of validations) {
          validation(command);
        }

      const names = [command.commandName];

      for (const name of names) {
        this._subCommands.set(name, command);
      }
    }
  }

  public async runCommand(
    command: SubcommandOption,
    args: string[],
    interaction: CommandInteraction,
  ): Promise<void> {
    await this._executor.executeSubcommand(command, args, interaction);
  }

  private getValidations(folder?: string) {
    if (!folder) {
      return [];
    }

    return getAllFiles(folder).map((fileData) => fileData.fileContents);
  }
}

export default CommandHandler;
