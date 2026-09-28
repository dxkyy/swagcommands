import {
  ApplicationCommandType,
  ContextMenuCommandInteraction,
} from "discord.js";
import path from "path";

import type SWAG from "../SWAG";
import type {
  ContextMenuCommandObject,
  DeferSetting,
} from "../types";
import { CommandDefinitionError } from "../errors/CommandDefinitionError";
import CommandExecutor from "../execution/CommandExecutor";
import { compileCommandPreconditions } from "../preconditions/compile-command-preconditions";
import { resolveContextMenuPreconditions } from "../preconditions/resolve-command-preconditions";
import getAllFiles from "../util/get-all-files";
import ContextMenuCommand from "./ContextMenuCommand";

type ContextMenuType =
  | ApplicationCommandType.Message
  | ApplicationCommandType.User;

class ContextMenuCommandHandler {
  private readonly _commands = new Map<string, ContextMenuCommand>();
  private _loading: Promise<void> | undefined;

  public constructor(
    private readonly _instance: SWAG,
    private readonly _commandsDir: string,
    private readonly _executor: CommandExecutor,
  ) {}

  public get commands() {
    return this._commands;
  }

  public getCommand(name: string, type: ContextMenuType) {
    return this._commands.get(createCommandKey(name, type));
  }

  public load(): Promise<void> {
    this._loading ??= this.readFiles();
    return this._loading;
  }

  public async runCommand(
    command: ContextMenuCommand,
    interaction: ContextMenuCommandInteraction,
  ): Promise<void> {
    await this._executor.executeContextMenuCommand(command, interaction);
  }

  private async readFiles(): Promise<void> {
    const files = getAllFiles(this._commandsDir);
    const validations = this.getValidations(this._instance.validations?.syntax);

    for (const { fileContents, filePath } of files) {
      const commandName = path.basename(filePath).split(".")[0];
      const commandObject = fileContents as ContextMenuCommandObject;
      this.validateDefinition(commandName, commandObject, filePath);

      const command = new ContextMenuCommand(
        this._instance,
        commandName,
        commandObject,
        resolveContextMenuPreconditions(
          this._instance.preconditions,
          compileCommandPreconditions(commandObject),
          { commandName, filePath },
        ),
      );
      const key = createCommandKey(commandName, commandObject.type);
      if (this._commands.has(key)) {
        throw this.definitionError(
          commandName,
          "A context-menu command with this name and type is already defined.",
          filePath,
        );
      }

      for (const validation of validations) {
        validation(command);
      }
      await commandObject.init?.(this._instance.client, this._instance);
      this._commands.set(key, command);
    }
  }

  private validateDefinition(
    commandName: string,
    definition: ContextMenuCommandObject,
    filePath: string,
  ): void {
    if (commandName.length === 0 || commandName.length > 32) {
      throw this.definitionError(
        commandName,
        "The command name must contain between 1 and 32 characters.",
        filePath,
      );
    }
    if (
      definition?.type !== ApplicationCommandType.User &&
      definition?.type !== ApplicationCommandType.Message
    ) {
      throw this.definitionError(
        commandName,
        "A context-menu command must use ApplicationCommandType.User or ApplicationCommandType.Message.",
        filePath,
      );
    }
    if (typeof definition.callback !== "function") {
      throw this.definitionError(
        commandName,
        "A context-menu command must define a callback function.",
        filePath,
      );
    }
    if (definition.init !== undefined && typeof definition.init !== "function") {
      throw this.definitionError(
        commandName,
        "The init property must be a function.",
        filePath,
      );
    }
    if (!isValidDeferSetting(definition.deferReply)) {
      throw this.definitionError(
        commandName,
        "The deferReply property must be a boolean or an options object with an optional boolean ephemeral property.",
        filePath,
      );
    }
  }

  private getValidations(folder?: string): Array<(command: ContextMenuCommand) => void> {
    if (!folder) {
      return [];
    }
    return getAllFiles(folder).map(({ fileContents, filePath }) => {
      if (typeof fileContents !== "function") {
        throw new TypeError(`Validation file "${filePath}" must export a function.`);
      }
      return fileContents as (command: ContextMenuCommand) => void;
    });
  }

  private definitionError(
    commandName: string,
    message: string,
    filePath: string,
  ) {
    return new CommandDefinitionError(
      `Context-menu command "${commandName}" is invalid: ${message}`,
      { commandName, filePath },
    );
  }
}

function createCommandKey(name: string, type: ContextMenuType): string {
  return `${type}:${name}`;
}

function isValidDeferSetting(setting?: DeferSetting): boolean {
  return (
    setting === undefined ||
    typeof setting === "boolean" ||
    (typeof setting === "object" &&
      setting !== null &&
      (setting.ephemeral === undefined ||
        typeof setting.ephemeral === "boolean"))
  );
}

export default ContextMenuCommandHandler;
