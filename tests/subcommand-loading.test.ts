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

class ChatInputPrecondition extends Precondition {
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
    new ChatInputPrecondition(instance as never, "RootGuard"),
  );
  instance.preconditions.register(
    new ChatInputPrecondition(instance as never, "LeafGuard"),
  );
  return instance;
};

describe("subcommand precondition loading", () => {
  beforeEach(() => {
    loading.files.clear();
  });

  it("preserves the root command and resolves root and leaf containers", async () => {
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
          preconditions: ["RootGuard"],
        },
        filePath: "/subcommands/admin/index.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          description: "Ban a user",
          name: "ban",
          preconditions: ["LeafGuard"],
        },
        filePath: "/subcommands/admin/ban.ts",
      },
    ]);
    const instance = createInstance();
    const handler = new SubcommandHandler(
      instance as never,
      "/subcommands",
      {} as never,
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
    expect(option?.parent).toBe(command);
    expect(`${option?.parent.commandName}/${option?.commandName}`).toBe(
      "admin/ban",
    );
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
        fileContents: { description: "Administration" },
        filePath: "/subcommands/admin/index.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          name: "ban",
          preconditions: ["Missing"],
        },
        filePath: "/subcommands/admin/ban.ts",
      },
    ]);
    const handler = new SubcommandHandler(
      createInstance() as never,
      "/subcommands",
      {} as never,
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
