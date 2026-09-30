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

vi.mock("../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

import CommandExecutor from "../src/execution/CommandExecutor";
import { Precondition } from "../src/preconditions/Precondition";
import { PreconditionStore } from "../src/preconditions/PreconditionStore";
import SubcommandHandler from "../src/subcommand-handler/SubcommandHandler";
import CommandType from "../src/util/CommandType";

class TestPrecondition extends Precondition {
  public messageRun() {
    return this.ok();
  }

  public chatInputRun() {
    return this.ok();
  }
}

const createInstance = () => {
  const instance = {
    defaultPrefix: "!",
    preconditions: new PreconditionStore(),
    prefixStore: {
      getPrefix: vi.fn(),
      setPrefix: vi.fn(),
    },
    validations: {},
  };
  instance.preconditions.register(
    new TestPrecondition(instance as never, "RootGuard"),
  );
  instance.preconditions.register(
    new TestPrecondition(instance as never, "LeafGuard"),
  );
  return instance;
};

describe("subcommand precondition loading", () => {
  beforeEach(() => {
    loading.files.clear();
  });

  it("preserves the root command and resolves root and leaf containers", async () => {
    const initializationOrder: string[] = [];
    loading.files.set("/subcommands", [
      {
        fileContents: {},
        filePath: "/subcommands/admin",
      },
    ]);
    loading.files.set("/subcommands/admin", [
      {
        fileContents: {
          description: "Administration",
          deferReply: false,
          init: async () => {
            initializationOrder.push("root");
          },
          preconditions: ["RootGuard"],
          reply: true,
          type: CommandType.SLASH,
        },
        filePath: "/subcommands/admin/index.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          description: "Ban a user",
          deferReply: { ephemeral: true },
          init: async () => {
            initializationOrder.push("leaf");
          },
          preconditions: ["LeafGuard"],
          reply: false,
        },
        filePath: "/subcommands/admin/ban.ts",
      },
    ]);
    const instance = createInstance();
    const handler = new SubcommandHandler(
      instance as never,
      "/subcommands",
      {} as CommandExecutor,
    );

    await handler.load();

    const command = handler.commands.get("admin");
    const option = command?.options[0];
    expect(command?.preconditions.entries[0]).toMatchObject({
      name: "RootGuard",
    });
    expect(option?.preconditions.entries[0]).toMatchObject({
      name: "LeafGuard",
    });
    expect(command?.commandObject).toMatchObject({
      deferReply: false,
      reply: true,
      type: CommandType.SLASH,
    });
    expect(option?.optionObject).toMatchObject({
      deferReply: { ephemeral: true },
      reply: false,
    });
    expect(initializationOrder).toEqual(["root", "leaf"]);
    expect(option?.parent).toBe(command);
    expect(`${option?.parent.commandName}/${option?.commandName}`).toBe(
      "admin/ban",
    );
  });

  it("indexes legacy root and leaf aliases without exposing them as slash names", async () => {
    loading.files.set("/subcommands", [
      {
        fileContents: {},
        filePath: "/subcommands/admin",
      },
    ]);
    loading.files.set("/subcommands/admin", [
      {
        fileContents: {
          aliases: ["mod"],
          type: CommandType.LEGACY,
        },
        filePath: "/subcommands/admin/index.ts",
      },
      {
        fileContents: {
          aliases: ["b"],
          callback: vi.fn(),
        },
        filePath: "/subcommands/admin/ban.ts",
      },
    ]);
    const handler = new SubcommandHandler(
      createInstance() as never,
      "/subcommands",
      {} as CommandExecutor,
    );

    await handler.load();

    const command = handler.commands.get("admin")!;
    const option = command.options[0];
    expect(handler.commands.has("mod")).toBe(false);
    expect(handler.legacyCommands.get("admin")).toBe(command);
    expect(handler.legacyCommands.get("mod")).toBe(command);
    expect(handler.getLegacyOptions(command)?.get("ban")).toBe(option);
    expect(handler.getLegacyOptions(command)?.get("b")).toBe(option);
  });

  it("requires exactly one index definition for every root", async () => {
    loading.files.set("/subcommands", [
      {
        fileContents: {},
        filePath: "/subcommands/admin",
      },
    ]);
    loading.files.set("/subcommands/admin", [
      {
        fileContents: { callback: vi.fn() },
        filePath: "/subcommands/admin/ban.ts",
      },
    ]);
    const handler = new SubcommandHandler(
      createInstance() as never,
      "/subcommands",
      {} as CommandExecutor,
    );

    await expect(handler.load()).rejects.toMatchObject({
      code: "SWAG_COMMAND_DEFINITION_INVALID",
      context: {
        commandName: "admin",
        filePath: "/subcommands/admin",
      },
      message: "A subcommand root must define exactly one index file.",
    });
  });

  it("rejects duplicate leaf aliases within a root", async () => {
    loading.files.set("/subcommands", [
      {
        fileContents: {},
        filePath: "/subcommands/admin",
      },
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
          aliases: ["remove"],
          callback: vi.fn(),
          description: "Ban a user",
        },
        filePath: "/subcommands/admin/ban.ts",
      },
      {
        fileContents: {
          aliases: ["remove"],
          callback: vi.fn(),
          description: "Kick a user",
        },
        filePath: "/subcommands/admin/kick.ts",
      },
    ]);
    const handler = new SubcommandHandler(
      createInstance() as never,
      "/subcommands",
      {} as CommandExecutor,
    );

    await expect(handler.load()).rejects.toMatchObject({
      code: "SWAG_COMMAND_DEFINITION_INVALID",
      context: {
        commandName: "admin",
        filePath: "/subcommands/admin/kick.ts",
        subcommandName: "kick",
      },
      message: 'Subcommand name or alias "remove" is defined more than once.',
    });
  });

  it("reports the complete identity for invalid leaf preconditions", async () => {
    loading.files.set("/subcommands", [
      {
        fileContents: {},
        filePath: "/subcommands/admin",
      },
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
          description: "Ban a user",
          preconditions: ["Missing"],
        },
        filePath: "/subcommands/admin/ban.ts",
      },
    ]);
    const handler = new SubcommandHandler(
      createInstance() as never,
      "/subcommands",
      {} as CommandExecutor,
    );

    await expect(handler.load()).rejects.toMatchObject({
      context: {
        commandName: "admin",
        filePath: "/subcommands/admin/ban.ts",
        subcommandName: "ban",
      },
      message: expect.stringContaining('Command "admin/ban"'),
    });
  });
});
