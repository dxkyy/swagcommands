import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  Client,
} from "discord.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loading = vi.hoisted(() => {
  const files = new Map<
    string,
    Array<{ fileContents: unknown; filePath: string }>
  >();

  return {
    files,
    getAllFiles: vi.fn((directory: string) => files.get(directory) ?? []),
  };
});

vi.mock("../../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

vi.mock("../../src/event-handler/EventHandler", () => ({
  default: class EventHandler {
    public async load() {}
    public registerEvents() {}
  },
}));

import SWAG from "../../src/SWAG";
import CommandType from "../../src/util/CommandType";
import { CommandObject } from "../../typings";

const createClient = (set: ReturnType<typeof vi.fn>) =>
  ({
    application: {
      commands: { set },
    },
    isReady: vi.fn(() => true),
    on: vi.fn(),
  }) as unknown as Client;

const createInstance = (set: ReturnType<typeof vi.fn>) =>
  SWAG.create({
    botOwners: ["owner-id"],
    client: createClient(set),
    commandsDir: "/commands",
    contextMenusDir: "/context-menus",
    subcommandsDir: "/subcommands",
    testServers: ["guild-b", "guild-a"],
  });

describe("end-to-end command synchronization", () => {
  beforeEach(() => {
    loading.files.clear();
    loading.getAllFiles.mockClear();
  });

  it("synchronizes chat-input, user, and message commands by scope", async () => {
    loading.files.set("/commands", [
      {
        fileContents: {
          callback: vi.fn(),
          description: "Check latency",
          options: [
            {
              description: "Include gateway latency",
              name: "gateway",
              type: ApplicationCommandOptionType.Boolean,
            },
          ],
          type: CommandType.SLASH,
        },
        filePath: "/commands/ping.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          description: "Preview a feature",
          testOnly: true,
          type: CommandType.BOTH,
        },
        filePath: "/commands/preview.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          type: CommandType.LEGACY,
        },
        filePath: "/commands/message-only.ts",
      },
    ]);
    loading.files.set("/subcommands", [
      { fileContents: {}, filePath: "/subcommands/admin" },
      { fileContents: {}, filePath: "/subcommands/sandbox" },
    ]);
    loading.files.set("/subcommands/admin", [
      {
        fileContents: {
          description: "Administration",
          type: CommandType.SLASH,
        },
        filePath: "/subcommands/admin/index.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          description: "Ban a member",
          name: "ban",
          options: [
            {
              description: "Member to ban",
              name: "member",
              type: ApplicationCommandOptionType.User,
            },
          ],
        },
        filePath: "/subcommands/admin/ban.ts",
      },
    ]);
    loading.files.set("/subcommands/sandbox", [
      {
        fileContents: {
          description: "Experimental commands",
          testOnly: true,
          type: CommandType.SLASH,
        },
        filePath: "/subcommands/sandbox/index.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          description: "Try an experiment",
          name: "try",
        },
        filePath: "/subcommands/sandbox/try.ts",
      },
    ]);
    loading.files.set("/context-menus", [
      {
        fileContents: {
          callback: vi.fn(),
          type: ApplicationCommandType.User,
        },
        filePath: "/context-menus/Inspect User.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          testOnly: true,
          type: ApplicationCommandType.Message,
        },
        filePath: "/context-menus/Report Message.ts",
      },
    ]);
    const set = vi.fn().mockResolvedValue(new Map());
    const instance = await createInstance(set);

    const result = await instance.deployCommands();

    expect(set).toHaveBeenCalledTimes(3);
    const globalManifest = set.mock.calls[0]?.[0];
    const firstGuildManifest = set.mock.calls[1]?.[0];
    expect(globalManifest.map((command: { name: string }) => command.name)).toEqual([
      "admin",
      "Inspect User",
      "ping",
    ]);
    expect(globalManifest).toContainEqual({
      description: "Administration",
      name: "admin",
      options: [
        {
          description: "Ban a member",
          name: "ban",
          options: [
            {
              description: "Member to ban",
              name: "member",
              type: ApplicationCommandOptionType.User,
            },
          ],
          type: ApplicationCommandOptionType.Subcommand,
        },
      ],
    });
    expect(firstGuildManifest.map(
      (command: { name: string }) => command.name,
    )).toEqual(["preview", "Report Message", "sandbox"]);
    expect(globalManifest).toContainEqual({
      name: "Inspect User",
      type: ApplicationCommandType.User,
    });
    expect(firstGuildManifest).toContainEqual({
      name: "Report Message",
      type: ApplicationCommandType.Message,
    });
    expect(set.mock.calls[1]?.[1]).toBe("guild-a");
    expect(set.mock.calls[2]?.[1]).toBe("guild-b");
    expect(result.targets).toEqual([
      {
        scope: "global",
        commands: [
          { name: "admin", type: ApplicationCommandType.ChatInput },
          { name: "Inspect User", type: ApplicationCommandType.User },
          { name: "ping", type: ApplicationCommandType.ChatInput },
        ],
      },
      {
        scope: "guild",
        guildId: "guild-a",
        commands: [
          { name: "preview", type: ApplicationCommandType.ChatInput },
          {
            name: "Report Message",
            type: ApplicationCommandType.Message,
          },
          { name: "sandbox", type: ApplicationCommandType.ChatInput },
        ],
      },
      {
        scope: "guild",
        guildId: "guild-b",
        commands: [
          { name: "preview", type: ApplicationCommandType.ChatInput },
          {
            name: "Report Message",
            type: ApplicationCommandType.Message,
          },
          { name: "sandbox", type: ApplicationCommandType.ChatInput },
        ],
      },
    ]);
  });

  it("synchronizes both affected scopes when a command moves between them", async () => {
    const definition: CommandObject = {
      callback: vi.fn(),
      description: "Check latency",
      type: CommandType.SLASH,
    };
    loading.files.set("/commands", [
      {
        fileContents: definition,
        filePath: "/commands/ping.ts",
      },
    ]);
    loading.files.set("/subcommands", []);
    const set = vi.fn().mockResolvedValue(new Map());

    const globalInstance = await createInstance(set);
    await globalInstance.deployCommands();

    definition.testOnly = true;
    const testInstance = await createInstance(set);
    await testInstance.deployCommands();

    definition.testOnly = false;
    const restoredInstance = await createInstance(set);
    await restoredInstance.deployCommands();

    expect(set).toHaveBeenCalledTimes(9);
    expect(set.mock.calls[0]?.[0]).toMatchObject([{ name: "ping" }]);
    expect(set.mock.calls[1]).toEqual([[], "guild-a"]);
    expect(set.mock.calls[2]).toEqual([[], "guild-b"]);

    expect(set.mock.calls[3]).toEqual([[]]);
    expect(set.mock.calls[4]?.[0]).toMatchObject([{ name: "ping" }]);
    expect(set.mock.calls[5]?.[0]).toMatchObject([{ name: "ping" }]);

    expect(set.mock.calls[6]?.[0]).toMatchObject([{ name: "ping" }]);
    expect(set.mock.calls[7]).toEqual([[], "guild-a"]);
    expect(set.mock.calls[8]).toEqual([[], "guild-b"]);
  });
});
