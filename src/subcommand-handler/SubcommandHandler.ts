import { CommandInteraction } from "discord.js";
import path from "path";

import SWAG, {
  DeferSetting,
  SubcommandObject,
  SubcommandOptionObject,
} from "../../typings";
import CommandExecutor from "../execution/CommandExecutor";
import { CommandDefinitionError } from "../errors/CommandDefinitionError";
import { compileCommandPreconditions } from "../preconditions/compile-command-preconditions";
import { resolveCommandPreconditions } from "../preconditions/resolve-command-preconditions";
import CommandType from "../util/CommandType";
import getAllFiles from "../util/get-all-files";
import Subcommand from "./Subcommand";
import SubcommandOption from "./SubcommandOption";

class SubcommandHandler {
  private readonly _subCommands = new Map<string, Subcommand>();
  private readonly _legacyCommands = new Map<string, Subcommand>();
  private readonly _legacyOptions = new Map<
    Subcommand,
    Map<string, SubcommandOption>
  >();
  private readonly _instance: SWAG;
  private readonly _commandsDir: string;
  private readonly _executor: CommandExecutor;
  private _loading: Promise<void> | undefined;

  public constructor(
    instance: SWAG,
    commandsDir: string,
    executor: CommandExecutor,
  ) {
    this._instance = instance;
    this._commandsDir = commandsDir;
    this._executor = executor;
  }

  public get commands() {
    return this._subCommands;
  }

  public get legacyCommands() {
    return this._legacyCommands;
  }

  public getLegacyOptions(command: Subcommand) {
    return this._legacyOptions.get(command);
  }

  public load(): Promise<void> {
    this._loading ??= this.readFiles();
    return this._loading;
  }

  private async readFiles(): Promise<void> {
    const folders = getAllFiles(this._commandsDir, true);
    const customValidations = this.getValidations(
      this._instance.validations?.syntax,
    );

    for (const { filePath: folderPath } of folders) {
      const commandName = path.basename(folderPath).toLowerCase();
      const files = getAllFiles(folderPath);
      const indexFiles = files.filter(
        ({ filePath }) => path.basename(filePath).split(".")[0] === "index",
      );

      if (indexFiles.length !== 1) {
        throw this.definitionError(
          commandName,
          indexFiles.length === 0
            ? "A subcommand root must define exactly one index file."
            : "A subcommand root cannot define more than one index file.",
          folderPath,
        );
      }

      const index = indexFiles[0];
      const commandObject = index.fileContents as SubcommandObject;
      this.validateRoot(commandName, commandObject, index.filePath);

      const rootPreconditions = resolveCommandPreconditions(
        this._instance.preconditions,
        compileCommandPreconditions(commandObject),
        {
          commandName,
          commandType: commandObject.type,
          filePath: index.filePath,
        },
      );
      const options = this.createOptions(
        commandName,
        commandObject,
        files.filter((file) => file !== index),
      );
      const command = new Subcommand(
        this._instance,
        commandName,
        commandObject,
        options,
        rootPreconditions,
      );

      for (const validation of customValidations) {
        validation(command);
        for (const option of options) {
          validation(option);
        }
      }

      await commandObject.init?.(this._instance.client, this._instance);
      for (const option of options) {
        await option.optionObject.init?.(this._instance.client, this._instance);
      }

      this.registerRoot(command, index.filePath);
    }
  }

  private createOptions(
    commandName: string,
    commandObject: SubcommandObject,
    files: ReturnType<typeof getAllFiles>,
  ): SubcommandOption[] {
    const options: SubcommandOption[] = [];
    const names = new Set<string>();

    for (const { fileContents, filePath } of files) {
      const optionName = path.basename(filePath).split(".")[0].toLowerCase();
      const optionObject = fileContents as SubcommandOptionObject;
      this.validateOption(
        commandName,
        optionName,
        commandObject.type,
        optionObject,
        filePath,
      );

      for (const name of [optionName, ...(optionObject.aliases ?? [])]) {
        const normalizedName = this.normalizeName(
          name,
          commandName,
          filePath,
          optionName,
        );
        if (names.has(normalizedName)) {
          throw this.definitionError(
            commandName,
            `Subcommand name or alias "${normalizedName}" is defined more than once.`,
            filePath,
            optionName,
          );
        }
        names.add(normalizedName);
      }

      const preconditions = resolveCommandPreconditions(
        this._instance.preconditions,
        compileCommandPreconditions(optionObject),
        {
          commandName,
          commandType: commandObject.type,
          filePath,
          subcommandName: optionName,
        },
      );
      options.push(
        new SubcommandOption(
          this._instance,
          optionName,
          optionObject,
          preconditions,
        ),
      );
    }

    return options;
  }

  private registerRoot(command: Subcommand, filePath: string): void {
    if (this._subCommands.has(command.commandName)) {
      throw this.definitionError(
        command.commandName,
        `Subcommand root "${command.commandName}" is defined more than once.`,
        filePath,
      );
    }
    this._subCommands.set(command.commandName, command);

    if (!supportsMessageCommands(command.commandObject.type)) {
      return;
    }

    for (const name of [
      command.commandName,
      ...(command.commandObject.aliases ?? []),
    ]) {
      const normalizedName = this.normalizeName(
        name,
        command.commandName,
        filePath,
      );
      if (this._legacyCommands.has(normalizedName)) {
        throw this.definitionError(
          command.commandName,
          `Subcommand root name or alias "${normalizedName}" is defined more than once.`,
          filePath,
        );
      }
      this._legacyCommands.set(normalizedName, command);
    }

    const legacyOptions = new Map<string, SubcommandOption>();
    for (const option of command.options) {
      for (const name of [
        option.commandName,
        ...(option.optionObject.aliases ?? []),
      ]) {
        legacyOptions.set(name.toLowerCase(), option);
      }
    }
    this._legacyOptions.set(command, legacyOptions);
  }

  private validateRoot(
    commandName: string,
    definition: SubcommandObject,
    filePath: string,
  ): void {
    if (!Object.values(CommandType).includes(definition?.type)) {
      throw this.definitionError(
        commandName,
        "A subcommand root must define a valid CommandType.",
        filePath,
      );
    }
    if (supportsChatInputCommands(definition.type) && !definition.description) {
      throw this.definitionError(
        commandName,
        "A slash-capable subcommand root must define a description.",
        filePath,
      );
    }
    this.validateSharedDefinition(commandName, definition, filePath);
  }

  private validateOption(
    commandName: string,
    optionName: string,
    commandType: CommandType,
    definition: SubcommandOptionObject,
    filePath: string,
  ): void {
    if (typeof definition?.callback !== "function") {
      throw this.definitionError(
        commandName,
        "A subcommand must define a callback function.",
        filePath,
        optionName,
      );
    }
    if (supportsChatInputCommands(commandType) && !definition.description) {
      throw this.definitionError(
        commandName,
        "A slash-capable subcommand must define a description.",
        filePath,
        optionName,
      );
    }
    this.validateSharedDefinition(
      commandName,
      definition,
      filePath,
      optionName,
    );
  }

  private validateSharedDefinition(
    commandName: string,
    definition: SubcommandObject | SubcommandOptionObject,
    filePath: string,
    optionName?: string,
  ): void {
    if (definition.init !== undefined && typeof definition.init !== "function") {
      throw this.definitionError(
        commandName,
        "The init property must be a function.",
        filePath,
        optionName,
      );
    }
    if (definition.reply !== undefined && typeof definition.reply !== "boolean") {
      throw this.definitionError(
        commandName,
        "The reply property must be a boolean.",
        filePath,
        optionName,
      );
    }
    if (!isValidDeferSetting(definition.deferReply)) {
      throw this.definitionError(
        commandName,
        "The deferReply property must be a boolean or an options object with an optional boolean ephemeral property.",
        filePath,
        optionName,
      );
    }
    if (
      definition.aliases !== undefined &&
      (!Array.isArray(definition.aliases) ||
        definition.aliases.some(
          (alias) => typeof alias !== "string" || alias.trim().length === 0,
        ))
    ) {
      throw this.definitionError(
        commandName,
        "Aliases must be non-empty strings.",
        filePath,
        optionName,
      );
    }
  }

  private normalizeName(
    name: string,
    commandName: string,
    filePath: string,
    optionName?: string,
  ): string {
    const normalizedName = name.trim().toLowerCase();
    if (!normalizedName || /\s/.test(normalizedName)) {
      throw this.definitionError(
        commandName,
        "Legacy command names and aliases cannot be empty or contain whitespace.",
        filePath,
        optionName,
      );
    }
    return normalizedName;
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

  private definitionError(
    commandName: string,
    message: string,
    filePath: string,
    subcommandName?: string,
  ): CommandDefinitionError {
    return new CommandDefinitionError(message, {
      commandName,
      filePath,
      subcommandName,
    });
  }
}

function supportsMessageCommands(type: CommandType): boolean {
  return type === CommandType.LEGACY || type === CommandType.BOTH;
}

function supportsChatInputCommands(type: CommandType): boolean {
  return type === CommandType.SLASH || type === CommandType.BOTH;
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

export default SubcommandHandler;
