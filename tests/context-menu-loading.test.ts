import { ApplicationCommandType } from "discord.js";
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

import ContextMenuCommandHandler from "../src/context-menu-handler/ContextMenuCommandHandler";
import { Precondition } from "../src/preconditions/Precondition";
import { PreconditionStore } from "../src/preconditions/PreconditionStore";

class ContextGuard extends Precondition {
  public contextMenuRun() {
    return this.ok();
  }
}

const createInstance = () => {
  const instance = {
    client: {},
    preconditions: new PreconditionStore(),
    validations: {},
  };
  instance.preconditions.register(
    new ContextGuard(instance as never, "ContextGuard"),
  );
  return instance;
};

describe("context-menu command loading", () => {
  beforeEach(() => {
    loading.files.clear();
  });

  it("loads typed user and message definitions without normalizing their names", async () => {
    const initializationOrder: string[] = [];
    loading.files.set("/context-menus", [
      {
        fileContents: {
          callback: vi.fn(),
          init: () => initializationOrder.push("user"),
          preconditions: ["ContextGuard"],
          type: ApplicationCommandType.User,
        },
        filePath: "/context-menus/User Information.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          init: () => initializationOrder.push("message"),
          type: ApplicationCommandType.Message,
        },
        filePath: "/context-menus/Report Message.ts",
      },
    ]);
    const handler = new ContextMenuCommandHandler(
      createInstance() as never,
      "/context-menus",
      {} as never,
    );

    await handler.load();

    const user = handler.getCommand(
      "User Information",
      ApplicationCommandType.User,
    );
    const message = handler.getCommand(
      "Report Message",
      ApplicationCommandType.Message,
    );
    expect(user?.commandName).toBe("User Information");
    expect(user?.preconditions.entries[0]).toMatchObject({
      name: "ContextGuard",
    });
    expect(message?.commandObject.type).toBe(ApplicationCommandType.Message);
    expect(initializationOrder).toEqual(["user", "message"]);
  });

  it("allows the same command name for different context-menu types", async () => {
    loading.files.set("/context-menus", [
      {
        fileContents: {
          callback: vi.fn(),
          type: ApplicationCommandType.User,
        },
        filePath: "/context-menus/Inspect.ts",
      },
      {
        fileContents: {
          callback: vi.fn(),
          type: ApplicationCommandType.Message,
        },
        filePath: "/context-menus/Inspect.js",
      },
    ]);
    const handler = new ContextMenuCommandHandler(
      createInstance() as never,
      "/context-menus",
      {} as never,
    );

    await handler.load();

    expect(handler.commands.size).toBe(2);
    expect(
      handler.getCommand("Inspect", ApplicationCommandType.User),
    ).toBeDefined();
    expect(
      handler.getCommand("Inspect", ApplicationCommandType.Message),
    ).toBeDefined();
  });

  it.each([
    [{ callback: vi.fn(), type: ApplicationCommandType.ChatInput }, /must use/],
    [{ type: ApplicationCommandType.User }, /callback function/],
    [
      {
        callback: vi.fn(),
        deferReply: { ephemeral: "yes" },
        type: ApplicationCommandType.User,
      },
      /deferReply/,
    ],
  ])("rejects invalid definitions", async (definition, error) => {
    loading.files.set("/context-menus", [
      {
        fileContents: definition,
        filePath: "/context-menus/Invalid.ts",
      },
    ]);
    const handler = new ContextMenuCommandHandler(
      createInstance() as never,
      "/context-menus",
      {} as never,
    );

    await expect(handler.load()).rejects.toThrowError(error);
  });
});
