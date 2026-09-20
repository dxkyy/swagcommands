import {
  Client,
  CommandInteraction,
  Message,
} from "discord.js";
import path from "path";

import getAllFiles from "../util/get-all-files";
import Command from "./Command";
import PrefixHandler from "./PrefixHandler";
import SWAG, { CommandObject } from "../../typings";
import CommandExecutor from "../execution/CommandExecutor";
import { resolveCommandPreconditions } from "../preconditions/resolve-command-preconditions";
import { compileCommandPreconditions } from "../preconditions/compile-command-preconditions";

class CommandHandler {
  // <commandName, instance of the Command class>
  private _commands: Map<string, Command> = new Map();
  private _instance: SWAG;
  private _client: Client;
  private _commandsDir: string;
  private _prefixes: PrefixHandler;
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
    this._client = client;
    this._prefixes = new PrefixHandler(instance);
    this._executor = executor;
  }

  public get commands() {
    return this._commands;
  }

  public get prefixHandler() {
    return this._prefixes;
  }

  public load(): Promise<void> {
    this._loading ??= this.readFiles();
    return this._loading;
  }

  private async readFiles() {
    const files = getAllFiles(this._commandsDir);
    const validations = [
      ...this.getValidations(path.join(__dirname, "validations", "syntax")),
      ...this.getValidations(this._instance.validations?.syntax),
    ];

    for (let fileData of [...files]) {
      const { filePath } = fileData;
      const commandObject: CommandObject = fileData.fileContents;

      const split = filePath.split(/[\/\\]/);
      let commandName = split.pop()!;
      commandName = commandName.split(".")[0];

      const preconditions = resolveCommandPreconditions(
        this._instance.preconditions,
        compileCommandPreconditions(commandObject),
        {
          commandName,
          commandType: commandObject.type,
          filePath,
        },
      );
      const command = new Command(
        this._instance,
        commandName,
        commandObject,
        preconditions,
      );

      const { aliases = [], init = () => {} } = commandObject;

      for (const validation of validations) {
        validation(command);
      }

      await init(this._client, this._instance);

      const names = [command.commandName, ...aliases];

      for (const name of names) {
        this._commands.set(name, command);
      }
    }
  }

  public async runCommand(
    command: Command,
    args: string[],
    message: Message | null,
    interaction: CommandInteraction | null,
  ): Promise<void> {
    await this._executor.executeCommand(command, args, message, interaction);
  }

  private getValidations(folder?: string) {
    if (!folder) {
      return [];
    }

    return getAllFiles(folder).map((fileData) => fileData.fileContents);
  }
}

export default CommandHandler;
