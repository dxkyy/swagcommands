import { beforeEach, describe, expect, it, vi } from "vitest";

const loading = vi.hoisted(() => {
  const files = new Map<
    string,
    Array<{
      fileContents: unknown;
      filePath: string;
    }>
  >();

  return {
    files,
    getAllFiles: vi.fn((directory: string) => files.get(directory) ?? []),
  };
});

vi.mock("../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

import CommandHandler from "../src/command-handler/CommandHandler";
import CommandExecutor from "../src/execution/CommandExecutor";
import EventHandler from "../src/event-handler/EventHandler";
import FeaturesHandler from "../src/util/FeaturesHandler";

const createInstance = () => ({
  defaultPrefix: "!",
  prefixStore: {
    getPrefix: vi.fn(),
    setPrefix: vi.fn(),
  },
  testServers: [],
  validations: {},
});

describe("explicit handler loading", () => {
  beforeEach(() => {
    loading.files.clear();
  });

  it("does not load or initialize commands in the constructor", async () => {
    let finishInitialization!: () => void;
    const init = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishInitialization = resolve;
        }),
    );
    loading.files.set("/commands", [
      {
        fileContents: {
          callback: vi.fn(),
          init,
          type: "LEGACY",
        },
        filePath: "/commands/hello.ts",
      },
    ]);

    const handler = new CommandHandler(
      createInstance() as never,
      "/commands",
      {} as never,
      {} as CommandExecutor,
    );

    expect(loading.getAllFiles).not.toHaveBeenCalled();
    expect(init).not.toHaveBeenCalled();

    const firstLoad = handler.load();
    const secondLoad = handler.load();

    expect(firstLoad).toBe(secondLoad);
    await vi.waitFor(() => {
      expect(init).toHaveBeenCalledOnce();
    });
    expect(handler.commands.has("hello")).toBe(false);

    finishInitialization();
    await firstLoad;

    expect(handler.commands.has("hello")).toBe(true);
    await handler.load();
    expect(init).toHaveBeenCalledOnce();
  });

  it("awaits feature initialization and only loads once", async () => {
    let finishFeature!: () => void;
    const feature = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishFeature = resolve;
        }),
    );
    loading.files.set("/features", [
      {
        fileContents: feature,
        filePath: "/features/feature.ts",
      },
    ]);

    const handler = new FeaturesHandler(
      createInstance() as never,
      "/features",
      {} as never,
    );

    expect(loading.getAllFiles).not.toHaveBeenCalled();
    expect(feature).not.toHaveBeenCalled();

    const firstLoad = handler.load();
    const secondLoad = handler.load();

    expect(firstLoad).toBe(secondLoad);
    await vi.waitFor(() => {
      expect(feature).toHaveBeenCalledOnce();
    });

    finishFeature();
    await firstLoad;
    await handler.load();

    expect(feature).toHaveBeenCalledOnce();
  });

  it("does not deploy slash commands while loading command definitions", async () => {
    loading.files.set("/commands", [
      {
        fileContents: {
          callback: vi.fn(),
          description: "A test command",
          type: "SLASH",
        },
        filePath: "/commands/test.ts",
      },
    ]);
    const applicationCommands = {
      cache: {
        find: vi.fn(),
      },
      create: vi.fn(),
      fetch: vi.fn(),
    };
    const client = {
      application: {
        commands: applicationCommands,
      },
    };
    const handler = new CommandHandler(
      createInstance() as never,
      "/commands",
      client as never,
      {} as CommandExecutor,
    );

    await handler.load();

    expect(handler.commands.has("test")).toBe(true);
    expect(applicationCommands.fetch).not.toHaveBeenCalled();
    expect(applicationCommands.create).not.toHaveBeenCalled();
    expect(applicationCommands.cache.find).not.toHaveBeenCalled();
  });

  it("loads event definitions before registering listeners", async () => {
    const client = {
      on: vi.fn(),
    };
    const handler = new EventHandler(
      createInstance() as never,
      { dir: "/events" },
      client as never,
    );

    expect(loading.getAllFiles).not.toHaveBeenCalled();
    expect(client.on).not.toHaveBeenCalled();

    const firstLoad = handler.load();
    const secondLoad = handler.load();
    expect(firstLoad).toBe(secondLoad);
    await firstLoad;

    expect(client.on).not.toHaveBeenCalled();

    handler.registerEvents();
    handler.registerEvents();

    expect(client.on).not.toHaveBeenCalled();
    expect(loading.getAllFiles).toHaveBeenCalled();
  });
});
