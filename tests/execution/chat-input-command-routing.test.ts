import { ApplicationCommandOptionType } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import handleSlashCommand from "../../src/event-handler/events/interactionCreate/isChatInputCommand/slash-commands";
import handleSubcommand from "../../src/event-handler/events/interactionCreate/isChatInputCommand/sub-command";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";
import Subcommand from "../../src/subcommand-handler/Subcommand";
import SubcommandHandler from "../../src/subcommand-handler/SubcommandHandler";
import SubcommandOption from "../../src/subcommand-handler/SubcommandOption";
import CommandType from "../../src/util/CommandType";

const emptyContainer = () =>
  new PreconditionContainerArray(new PreconditionStore());

const createInteraction = (data: unknown[], isChatInputCommand = true) => ({
  commandName: "admin",
  isChatInputCommand: vi.fn(() => isChatInputCommand),
  options: { data },
});

describe("chat-input command routing", () => {
  it("dispatches normal chat-input commands with only supplied argument values", async () => {
    const command = {};
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const interaction = createInteraction([
      {
        name: "target",
        type: ApplicationCommandOptionType.String,
        value: "user-id",
      },
      {
        name: "reason",
        type: ApplicationCommandOptionType.String,
      },
      {
        name: "days",
        type: ApplicationCommandOptionType.Integer,
        value: 7,
      },
    ]);

    await handleSlashCommand(interaction as never, {
      commandHandler: {
        commands: new Map([["admin", command]]),
        runCommand,
      },
    } as never);

    expect(runCommand).toHaveBeenCalledWith(
      command,
      ["user-id", "7"],
      null,
      interaction,
    );
  });

  it("dispatches direct subcommands with their normalized selection", async () => {
    const callback = vi.fn();
    const option = new SubcommandOption(
      {} as never,
      "ban",
      { callback },
      emptyContainer(),
    );
    const root = new Subcommand(
      {} as never,
      "admin",
      { type: CommandType.SLASH },
      [option],
      emptyContainer(),
    );
    const executeSubcommand = vi.fn().mockResolvedValue(undefined);
    const handler = new SubcommandHandler(
      {} as never,
      "/unused",
      { executeSubcommand } as never,
    );
    handler.commands.set("admin", root);
    const interaction = createInteraction([
      {
        name: "ban",
        options: [
          {
            name: "target",
            type: ApplicationCommandOptionType.User,
            value: "user-id",
          },
        ],
        type: ApplicationCommandOptionType.Subcommand,
      },
    ]);

    await handleSubcommand(interaction as never, {
      subcommandHandler: handler,
    } as never);

    expect(executeSubcommand).toHaveBeenCalledWith(
      option,
      ["user-id"],
      null,
      interaction,
      {
        subcommandGroup: undefined,
        subcommandName: "ban",
      },
    );
  });

  it("dispatches grouped subcommands with the group and nested names", async () => {
    const option = new SubcommandOption(
      {} as never,
      "moderation",
      {
        callback: vi.fn(),
        options: [
          {
            description: "Ban a user",
            name: "ban",
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
      emptyContainer(),
    );
    const root = new Subcommand(
      {} as never,
      "admin",
      { type: CommandType.BOTH },
      [option],
      emptyContainer(),
    );
    const executeSubcommand = vi.fn().mockResolvedValue(undefined);
    const handler = new SubcommandHandler(
      {} as never,
      "/unused",
      { executeSubcommand } as never,
    );
    handler.commands.set("admin", root);
    const interaction = createInteraction([
      {
        name: "moderation",
        options: [
          {
            name: "ban",
            options: [
              {
                name: "target",
                type: ApplicationCommandOptionType.User,
                value: "user-id",
              },
              {
                name: "reason",
                type: ApplicationCommandOptionType.String,
              },
            ],
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
        type: ApplicationCommandOptionType.SubcommandGroup,
      },
    ]);

    await handleSubcommand(interaction as never, {
      subcommandHandler: handler,
    } as never);

    expect(executeSubcommand).toHaveBeenCalledWith(
      option,
      ["user-id"],
      null,
      interaction,
      {
        subcommandGroup: "moderation",
        subcommandName: "ban",
      },
    );
  });

  it("does not route context-menu interactions through chat-input handlers", async () => {
    const commandRun = vi.fn();
    const subcommandRun = vi.fn();
    const interaction = createInteraction([], false);
    const instance = {
      commandHandler: {
        commands: new Map([["admin", {}]]),
        runCommand: commandRun,
      },
      subcommandHandler: {
        resolveChatInputCommand: vi.fn(),
        runCommand: subcommandRun,
      },
    };

    await handleSlashCommand(interaction as never, instance as never);
    await handleSubcommand(interaction as never, instance as never);

    expect(commandRun).not.toHaveBeenCalled();
    expect(instance.subcommandHandler.resolveChatInputCommand).not.toHaveBeenCalled();
    expect(subcommandRun).not.toHaveBeenCalled();
  });

  it("ignores unknown and malformed subcommand selections", async () => {
    const root = new Subcommand(
      {} as never,
      "admin",
      { type: CommandType.SLASH },
      [],
      emptyContainer(),
    );
    const executeSubcommand = vi.fn();
    const handler = new SubcommandHandler(
      {} as never,
      "/unused",
      { executeSubcommand } as never,
    );
    handler.commands.set("admin", root);

    await handleSubcommand(
      createInteraction([
        {
          name: "unknown",
          type: ApplicationCommandOptionType.Subcommand,
        },
      ]) as never,
      { subcommandHandler: handler } as never,
    );
    await handleSubcommand(
      createInteraction([
        {
          name: "moderation",
          options: [],
          type: ApplicationCommandOptionType.SubcommandGroup,
        },
      ]) as never,
      { subcommandHandler: handler } as never,
    );

    expect(executeSubcommand).not.toHaveBeenCalled();
  });
});
