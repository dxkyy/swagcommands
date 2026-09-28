import { describe, expect, it } from "vitest";

import { CommandType } from "../src/index";
import type { CommandObject, SubcommandOptionObject } from "../src/index";

const messageCommand = {
  type: CommandType.LEGACY,
  callback: (usage) => {
    usage.message.author;
    // @ts-expect-error Message commands have no interaction.
    usage.interaction.options;
    return "message response";
  },
} satisfies CommandObject;

const slashCommand = {
  type: CommandType.SLASH,
  callback: (usage) => {
    usage.interaction.options;
    // @ts-expect-error Slash commands have no message.
    usage.message.author;
    return "slash response";
  },
  autocomplete: (command, focusedOption, interaction) => {
    command.commandName;
    interaction.options;
    return [focusedOption];
  },
} satisfies CommandObject;

const bothCommand = {
  type: CommandType.BOTH,
  callback: (usage) => {
    if (usage.message) {
      return usage.message.author.username;
    }
    return usage.interaction.commandName;
  },
} satisfies CommandObject;

const subcommandOption = {
  callback: () => undefined,
  autocomplete: (command, focusedOption) => {
    command.options;
    return [focusedOption];
  },
} satisfies SubcommandOptionObject;

const invalidAutocomplete: CommandObject = {
  type: CommandType.SLASH,
  callback: () => undefined,
  // @ts-expect-error Autocomplete callbacks must return strings.
  autocomplete: () => [42],
};

describe("command declaration types", () => {
  it("reflects command invocation modes and autocomplete results", () => {
    expect(messageCommand.type).toBe(CommandType.LEGACY);
    expect(slashCommand.type).toBe(CommandType.SLASH);
    expect(bothCommand.type).toBe(CommandType.BOTH);
    expect(subcommandOption.autocomplete).toBeTypeOf("function");
    expect(invalidAutocomplete).toBeDefined();
  });
});
