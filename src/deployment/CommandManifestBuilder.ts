import {
  ApplicationCommandOptionData,
  ApplicationCommandOptionType,
  ApplicationCommandStringOptionData,
  ApplicationCommandSubCommandData,
  ChatInputApplicationCommandData,
} from "discord.js";

import Command from "../command-handler/Command";
import { CommandDefinitionError } from "../errors/CommandDefinitionError";
import Subcommand from "../subcommand-handler/Subcommand";
import SubcommandOption from "../subcommand-handler/SubcommandOption";
import CommandType from "../util/CommandType";
import { CommandObject } from "../../typings";

export interface CommandManifestSources {
  commands?: Iterable<Command>;
  subcommands?: Iterable<Subcommand>;
}

export interface CommandManifests {
  global: readonly ChatInputApplicationCommandData[];
  test: readonly ChatInputApplicationCommandData[];
}

type ManifestScope = keyof CommandManifests;

export function buildCommandManifests({
  commands = [],
  subcommands = [],
}: CommandManifestSources): CommandManifests {
  const manifests: Record<ManifestScope, ChatInputApplicationCommandData[]> = {
    global: [],
    test: [],
  };
  const names: Record<ManifestScope, Set<string>> = {
    global: new Set(),
    test: new Set(),
  };
  const visitedCommands = new Set<Command>();

  for (const command of commands) {
    if (visitedCommands.has(command)) {
      continue;
    }
    visitedCommands.add(command);

    if (
      command.commandObject.type !== CommandType.SLASH &&
      command.commandObject.type !== CommandType.BOTH
    ) {
      continue;
    }

    const scope = getScope(command.commandObject.testOnly);
    addToManifest(
      manifests,
      names,
      scope,
      buildCommandData(command),
    );
  }

  for (const command of subcommands) {
    const scope = getScope(command.commandObject.testOnly);
    addToManifest(
      manifests,
      names,
      scope,
      buildSubcommandData(command),
    );
  }

  return {
    global: Object.freeze(sortCommands(manifests.global)),
    test: Object.freeze(sortCommands(manifests.test)),
  };
}

function getScope(testOnly?: boolean): ManifestScope {
  return testOnly ? "test" : "global";
}

function addToManifest(
  manifests: Record<ManifestScope, ChatInputApplicationCommandData[]>,
  names: Record<ManifestScope, Set<string>>,
  scope: ManifestScope,
  command: ChatInputApplicationCommandData,
): void {
  if (names[scope].has(command.name)) {
    throw new CommandDefinitionError(
      `Application command "${command.name}" is defined more than once in the ${scope} deployment scope.`,
      { commandName: command.name },
    );
  }

  names[scope].add(command.name);
  manifests[scope].push(command);
}

function buildCommandData(command: Command): ChatInputApplicationCommandData {
  const { commandName, commandObject } = command;
  const description = requireDescription(
    commandName,
    commandObject.description,
  );
  const options =
    commandObject.options ?? createExpectedArgumentOptions(commandObject);

  return {
    name: commandName,
    description,
    options,
  };
}

function buildSubcommandData(
  command: Subcommand,
): ChatInputApplicationCommandData {
  const { commandName, commandObject } = command;

  return {
    name: commandName,
    description: requireDescription(commandName, commandObject.description),
    options: command.options.map((option) =>
      buildSubcommandOption(commandName, option),
    ),
  };
}

function buildSubcommandOption(
  rootName: string,
  option: SubcommandOption,
): ApplicationCommandOptionData {
  const { optionObject } = option;
  const name = optionObject.name || option.commandName;
  const description = requireDescription(
    `${rootName}/${name}`,
    optionObject.description,
  );
  const options = optionObject.options ?? [];

  if (options.some(isSubcommandOption)) {
    if (!options.every(isSubcommandOption)) {
      throw new CommandDefinitionError(
        `Subcommand group "${rootName}/${name}" mixes subcommands with argument options.`,
        { commandName: rootName, subcommandName: name },
      );
    }

    return {
      name,
      description,
      type: ApplicationCommandOptionType.SubcommandGroup,
      options,
    };
  }

  if (!options.every(isArgumentOption)) {
    throw new CommandDefinitionError(
      `Subcommand "${rootName}/${name}" contains a nested subcommand group.`,
      { commandName: rootName, subcommandName: name },
    );
  }

  return {
    name,
    description,
    type: ApplicationCommandOptionType.Subcommand,
    options,
  };
}

function createExpectedArgumentOptions(
  command: CommandObject,
): ApplicationCommandStringOptionData[] {
  const { expectedArgs = "", minArgs = 0 } = command;
  if (!expectedArgs) {
    return [];
  }

  return expectedArgs
    .substring(1, expectedArgs.length - 1)
    .split(/[>\]] [<\[]/)
    .map((argument, index) => ({
      name: argument.toLowerCase().replace(/\s+/g, "-"),
      description: argument,
      type: ApplicationCommandOptionType.String,
      required: index < minArgs,
    }));
}

function requireDescription(name: string, description?: string): string {
  if (!description) {
    throw new CommandDefinitionError(
      `Application command "${name}" does not have a description.`,
      { commandName: name },
    );
  }

  return description;
}

function isSubcommandOption(
  option: ApplicationCommandOptionData,
): option is ApplicationCommandSubCommandData {
  return option.type === ApplicationCommandOptionType.Subcommand;
}

function isArgumentOption(
  option: ApplicationCommandOptionData,
): option is Exclude<
  ApplicationCommandOptionData,
  { type: ApplicationCommandOptionType.Subcommand } | {
    type: ApplicationCommandOptionType.SubcommandGroup;
  }
> {
  return (
    option.type !== ApplicationCommandOptionType.Subcommand &&
    option.type !== ApplicationCommandOptionType.SubcommandGroup
  );
}

function sortCommands(
  commands: ChatInputApplicationCommandData[],
): ChatInputApplicationCommandData[] {
  return commands.sort((left, right) => left.name.localeCompare(right.name));
}
