import { ApplicationCommandOptionType } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import MessageCommandRouter from "../../src/command-handler/MessageCommandRouter";
import CommandType from "../../src/util/CommandType";

const createMessage = (content: string) => ({
  author: { id: "user-id" },
  channel: {
    isSendable: vi.fn(() => true),
  },
  content,
  guild: { id: "guild-id" },
});

const createInstance = (overrides: Record<string, unknown> = {}) => ({
  commandHandler: undefined,
  defaultPrefix: "!",
  prefixStore: {
    getPrefix: vi.fn(),
    setPrefix: vi.fn(),
  },
  subcommandHandler: undefined,
  ...overrides,
});

describe("message command routing", () => {
  it("dispatches root and leaf aliases with prefixes that contain spaces", async () => {
    const option = {
      commandName: "ban",
      optionObject: { aliases: ["b"] },
    };
    const root = {
      commandName: "admin",
      commandObject: {
        aliases: ["mod"],
        type: CommandType.BOTH,
      },
      options: [option],
    };
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const subcommandHandler = {
      getLegacyOptions: vi.fn(() =>
        new Map([
          ["ban", option],
          ["b", option],
        ]),
      ),
      legacyCommands: new Map([
        ["admin", root],
        ["mod", root],
      ]),
      runCommand,
    };
    const router = new MessageCommandRouter(
      createInstance({
        defaultPrefix: "! bot ",
        subcommandHandler,
      }) as never,
    );
    const message = createMessage("! bot mod b user-id spam");

    await router.execute(message as never);

    expect(runCommand).toHaveBeenCalledWith(
      option,
      ["user-id", "spam"],
      message,
      null,
      {
        subcommandGroup: undefined,
        subcommandName: "ban",
      },
    );
  });

  it("resolves the nested name for grouped legacy subcommands", async () => {
    const option = {
      commandName: "moderation",
      optionObject: {
        options: [
          {
            description: "Ban a user",
            name: "ban",
            type: ApplicationCommandOptionType.Subcommand,
          },
        ],
      },
    };
    const root = {
      commandName: "admin",
      commandObject: { type: CommandType.LEGACY },
      options: [option],
    };
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const subcommandHandler = {
      getLegacyOptions: vi.fn(() => new Map([["moderation", option]])),
      legacyCommands: new Map([["admin", root]]),
      runCommand,
    };
    const router = new MessageCommandRouter(
      createInstance({ subcommandHandler }) as never,
    );
    const message = createMessage("!admin moderation ban user-id");

    await router.execute(message as never);

    expect(runCommand).toHaveBeenCalledWith(
      option,
      ["user-id"],
      message,
      null,
      {
        subcommandGroup: "moderation",
        subcommandName: "ban",
      },
    );
  });

  it("continues to dispatch normal legacy commands", async () => {
    const command = {
      commandObject: { type: CommandType.BOTH },
    };
    const runCommand = vi.fn().mockResolvedValue(undefined);
    const commandHandler = {
      commands: new Map([["ping", command]]),
      runCommand,
    };
    const router = new MessageCommandRouter(
      createInstance({ commandHandler }) as never,
    );
    const message = createMessage("!ping one two");

    await router.execute(message as never);

    expect(runCommand).toHaveBeenCalledWith(
      command,
      ["one", "two"],
      message,
      null,
    );
  });

  it("ignores incomplete and unknown subcommand paths", async () => {
    const root = {
      commandName: "admin",
      commandObject: { type: CommandType.LEGACY },
      options: [],
    };
    const runCommand = vi.fn();
    const subcommandHandler = {
      getLegacyOptions: vi.fn(() => new Map()),
      legacyCommands: new Map([["admin", root]]),
      runCommand,
    };
    const router = new MessageCommandRouter(
      createInstance({ subcommandHandler }) as never,
    );

    await router.execute(createMessage("!admin") as never);
    await router.execute(createMessage("!admin unknown") as never);

    expect(runCommand).not.toHaveBeenCalled();
  });

  it("rejects overlapping normal and subcommand legacy names", () => {
    const command = {
      commandObject: { type: CommandType.LEGACY },
    };
    const root = {
      commandName: "admin",
      commandObject: { type: CommandType.LEGACY },
    };

    expect(
      () =>
        new MessageCommandRouter(
          createInstance({
            commandHandler: {
              commands: new Map([["admin", command]]),
            },
            subcommandHandler: {
              legacyCommands: new Map([["admin", root]]),
            },
          }) as never,
        ),
    ).toThrowError(
      'Legacy command name or alias "admin" is shared by a normal command and a subcommand root.',
    );
  });
});
