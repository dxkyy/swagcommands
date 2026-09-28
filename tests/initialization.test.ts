import { Events as DiscordEvents, MessageFlags } from "discord.js";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({
  commandLoad: vi.fn<() => Promise<void>>(),
  contextMenuLoad: vi.fn<() => Promise<void>>(),
  eventLoad: vi.fn<() => Promise<void>>(),
  eventRegister: vi.fn<() => void>(),
  featureLoad: vi.fn<() => Promise<void>>(),
  featureHasPhase: vi.fn<(_phase: string) => boolean>(),
  featureRunPhase: vi.fn<(_phase: string) => Promise<void>>(),
  preconditionLoad: vi.fn<() => Promise<void>>(),
  subcommandLoad: vi.fn<() => Promise<void>>(),
}));

vi.mock("../src/command-handler/CommandHandler", () => ({
  default: class CommandHandler {
    commands = new Map();

    async load() {
      await lifecycle.commandLoad();
    }
  },
}));

vi.mock("../src/context-menu-handler/ContextMenuCommandHandler", () => ({
  default: class ContextMenuCommandHandler {
    commands = new Map();

    async load() {
      await lifecycle.contextMenuLoad();
    }
  },
}));

vi.mock("../src/subcommand-handler/SubcommandHandler", () => ({
  default: class SubcommandHandler {
    legacyCommands = new Map();

    async load() {
      await lifecycle.subcommandLoad();
    }
  },
}));

vi.mock("../src/util/FeaturesHandler", () => ({
  default: class FeaturesHandler {
    async load() {
      await lifecycle.featureLoad();
    }

    async runPhase(phase: string) {
      await lifecycle.featureRunPhase(phase);
    }

    hasPhase(phase: string) {
      return lifecycle.featureHasPhase(phase);
    }
  },
}));

vi.mock("../src/preconditions/PreconditionHandler", () => ({
  PreconditionHandler: class PreconditionHandler {
    async load() {
      await lifecycle.preconditionLoad();
    }
  },
}));

vi.mock("../src/event-handler/EventHandler", () => ({
  default: class EventHandler {
    async load() {
      await lifecycle.eventLoad();
    }

    registerEvents() {
      lifecycle.eventRegister();
    }
  },
}));

import SWAG from "../src/SWAG";
import { InitializationError } from "../src/errors/InitializationError";
import { FeaturePhase } from "../src/features/FeaturePhase";
import { FeatureExecutionError } from "../src/errors/FeatureExecutionError";

type AsyncSWAGConstructor = typeof SWAG & {
  create(options: Record<string, unknown>): Promise<SWAG>;
};

const createClient = () => ({
  application: {
    fetch: vi.fn().mockResolvedValue(undefined),
    owner: {
      id: "application-owner",
    },
  },
});

const createSWAG = (options: Record<string, unknown>) => {
  const constructor = SWAG as AsyncSWAGConstructor;
  expect(constructor.create).toBeTypeOf("function");
  return constructor.create(options);
};

describe("SWAG initialization", () => {
  beforeEach(() => {
    lifecycle.commandLoad.mockResolvedValue(undefined);
    lifecycle.contextMenuLoad.mockResolvedValue(undefined);
    lifecycle.eventLoad.mockResolvedValue(undefined);
    lifecycle.featureLoad.mockResolvedValue(undefined);
    lifecycle.featureHasPhase.mockReturnValue(true);
    lifecycle.featureRunPhase.mockResolvedValue(undefined);
    lifecycle.preconditionLoad.mockResolvedValue(undefined);
    lifecycle.subcommandLoad.mockResolvedValue(undefined);
  });

  it("returns an initialized instance through the async factory", async () => {
    const instance = await createSWAG({
      client: createClient(),
      commandsDir: "/commands",
      contextMenusDir: "/context-menus",
      events: { dir: "/events" },
      featuresDir: "/features",
      preconditionsDir: "/preconditions",
      subcommandsDir: "/subcommands",
    });

    expect(instance).toBeInstanceOf(SWAG);
    expect(instance.state).toBe("ready");
    expect(instance.isReady()).toBe(true);
    expect(lifecycle.commandLoad).toHaveBeenCalledOnce();
    expect(lifecycle.contextMenuLoad).toHaveBeenCalledOnce();
    expect(lifecycle.subcommandLoad).toHaveBeenCalledOnce();
    expect(lifecycle.featureLoad).toHaveBeenCalledOnce();
    expect(lifecycle.featureRunPhase.mock.calls).toEqual([
      [FeaturePhase.BeforeCommands],
      [FeaturePhase.AfterCommands],
    ]);
    expect(lifecycle.preconditionLoad).toHaveBeenCalledOnce();
    expect(lifecycle.eventLoad).toHaveBeenCalledOnce();
    expect(lifecycle.eventRegister).toHaveBeenCalledOnce();
  });

  it("uses an injected cooldown store", async () => {
    const cooldownStore = {
      claimCooldown: vi.fn(),
      deleteCooldown: vi.fn(),
      getCooldown: vi.fn(),
      setCooldown: vi.fn(),
    };

    const instance = await createSWAG({
      client: createClient(),
      cooldownStore,
    });

    expect(instance.cooldownStore).toBe(cooldownStore);
  });

  it("responds with built-in failure messages by default", async () => {
    const instance = await createSWAG({ client: createClient() });
    const failure = {
      identifier: "GUILD_ONLY",
      message: "This command can only be used in a server.",
      preconditionName: "GuildOnly",
    };

    await expect(
      instance.handlePreconditionFailure({
        command: {} as never,
        failure,
        usage: { interaction: {} } as never,
      }),
    ).resolves.toEqual({
      content: failure.message,
      flags: MessageFlags.Ephemeral,
    });
    await expect(
      instance.handlePreconditionFailure({
        command: {} as never,
        failure,
        usage: { interaction: null } as never,
      }),
    ).resolves.toBe(failure.message);
  });

  it("allows an explicit failure hook to opt into silence", async () => {
    const instance = await createSWAG({
      client: createClient(),
      onPreconditionFailure: () => undefined,
    });

    await expect(
      instance.handlePreconditionFailure({
        command: {} as never,
        failure: {
          identifier: "DENIED",
          message: "Visible by default",
          preconditionName: "Guard",
        },
        usage: { interaction: {} } as never,
      }),
    ).resolves.toBeUndefined();
  });

  it("loads preconditions before command definitions", async () => {
    const order: string[] = [];
    lifecycle.preconditionLoad.mockImplementation(async () => {
      order.push("preconditions");
    });
    lifecycle.commandLoad.mockImplementation(async () => {
      order.push("commands");
    });

    const instance = await createSWAG({
      client: createClient(),
      commandsDir: "/commands",
      preconditionsDir: "/preconditions",
    });

    expect(order).toEqual(["preconditions", "commands"]);
    expect(instance.preconditions).toBeDefined();
  });

  it("runs feature phases around command loading", async () => {
    const order: string[] = [];
    lifecycle.preconditionLoad.mockImplementation(async () => {
      order.push("preconditions");
    });
    lifecycle.featureLoad.mockImplementation(async () => {
      order.push("discover features");
    });
    lifecycle.featureRunPhase.mockImplementation(async (phase) => {
      order.push(phase);
    });
    lifecycle.commandLoad.mockImplementation(async () => {
      order.push("commands");
    });
    lifecycle.contextMenuLoad.mockImplementation(async () => {
      order.push("context menus");
    });
    lifecycle.subcommandLoad.mockImplementation(async () => {
      order.push("subcommands");
    });
    lifecycle.eventRegister.mockImplementation(() => {
      order.push("register events");
    });

    await createSWAG({
      client: createClient(),
      commandsDir: "/commands",
      contextMenusDir: "/context-menus",
      featuresDir: "/features",
      preconditionsDir: "/preconditions",
      subcommandsDir: "/subcommands",
    });

    expect(order).toEqual([
      "preconditions",
      "discover features",
      FeaturePhase.BeforeCommands,
      "commands",
      "context menus",
      "subcommands",
      FeaturePhase.AfterCommands,
      "register events",
    ]);
  });

  it("preserves feature context when an initialization phase fails", async () => {
    const failure = new Error("setup failed");
    lifecycle.featureRunPhase.mockRejectedValueOnce(
      new FeatureExecutionError(failure, {
        featureName: "setup",
        filePath: "/features/setup.ts",
      }),
    );

    await expect(createSWAG({
      client: createClient(),
      featuresDir: "/features",
    })).rejects.toMatchObject({
      code: "SWAG_INITIALIZATION_FAILED",
      context: {
        featureName: "setup",
        filePath: "/features/setup.ts",
      },
    } satisfies Partial<InitializationError>);
    expect(lifecycle.commandLoad).not.toHaveBeenCalled();
  });

  it("starts client-ready features once when the client is already ready", async () => {
    const client = {
      ...createClient(),
      isReady: vi.fn(() => true),
    };
    const instance = await createSWAG({ client, featuresDir: "/features" });
    const firstStart = instance.startFeatures();
    const secondStart = instance.startFeatures();

    expect(firstStart).toBe(secondStart);
    await firstStart;
    await instance.startFeatures();
    expect(lifecycle.featureRunPhase.mock.calls).toEqual([
      [FeaturePhase.BeforeCommands],
      [FeaturePhase.AfterCommands],
      [FeaturePhase.ClientReady],
    ]);
  });

  it("waits for client readiness before running client-ready features", async () => {
    let ready = false;
    const client = Object.assign(new EventEmitter(), createClient(), {
      isReady: vi.fn(() => ready),
    });
    const instance = await createSWAG({ client, featuresDir: "/features" });
    const starting = instance.startFeatures();

    expect(lifecycle.featureRunPhase).not.toHaveBeenCalledWith(FeaturePhase.ClientReady);
    ready = true;
    client.emit(DiscordEvents.ClientReady, client);
    await starting;

    expect(lifecycle.featureRunPhase).toHaveBeenCalledWith(FeaturePhase.ClientReady);
    expect(client.listenerCount(DiscordEvents.ClientReady)).toBe(0);
  });

  it("propagates client-ready feature failures and does not rerun them", async () => {
    const failure = new FeatureExecutionError(new Error("analytics failed"), {
      featureName: "analytics",
      filePath: "/features/analytics.ts",
    });
    lifecycle.featureRunPhase.mockImplementation(async (phase) => {
      if (phase === FeaturePhase.ClientReady) {
        throw failure;
      }
    });
    const instance = await createSWAG({
      client: { ...createClient(), isReady: () => true },
      featuresDir: "/features",
    });

    await expect(instance.startFeatures()).rejects.toBe(failure);
    await expect(instance.startFeatures()).rejects.toBe(failure);
    expect(lifecycle.featureRunPhase.mock.calls.filter(([phase]) =>
      phase === FeaturePhase.ClientReady,
    )).toHaveLength(1);
  });

  it("does not wait for client readiness without client-ready features", async () => {
    lifecycle.featureHasPhase.mockReturnValue(false);
    const instance = await createSWAG({
      client: createClient(),
      featuresDir: "/features",
    });

    await expect(instance.startFeatures()).resolves.toBeUndefined();
    expect(lifecycle.featureRunPhase).not.toHaveBeenCalledWith(FeaturePhase.ClientReady);
  });

  it("rejects initialization when no Discord client is provided", async () => {
    await expect(createSWAG({})).rejects.toThrow("A client is required.");

    expect(lifecycle.commandLoad).not.toHaveBeenCalled();
    expect(lifecycle.eventRegister).not.toHaveBeenCalled();
  });

  it("does not resolve until asynchronous handler loading completes", async () => {
    let finishLoading!: () => void;
    lifecycle.commandLoad.mockReturnValue(
      new Promise<void>((resolve) => {
        finishLoading = resolve;
      }),
    );

    let initialized = false;
    const initialization = createSWAG({
      client: createClient(),
      commandsDir: "/commands",
    }).then((instance) => {
      initialized = true;
      return instance;
    });

    await vi.waitFor(() => {
      expect(lifecycle.commandLoad).toHaveBeenCalledOnce();
    });
    expect(initialized).toBe(false);

    finishLoading();
    await initialization;

    expect(initialized).toBe(true);
  });

  it("rejects initialization and does not register events after loading fails", async () => {
    const failure = new Error("command loading failed");
    lifecycle.commandLoad.mockRejectedValue(failure);

    await expect(
      createSWAG({
        client: createClient(),
        commandsDir: "/commands",
      }),
    ).rejects.toMatchObject({
      cause: failure,
      code: "SWAG_INITIALIZATION_FAILED",
      message: expect.stringContaining("command loading failed"),
      phase: "initialization",
    } satisfies Partial<InitializationError>);

    expect(lifecycle.eventRegister).not.toHaveBeenCalled();
  });

  it("does not mutate caller-owned configuration arrays", async () => {
    const botOwners: string[] = [];
    const testServers = ["test-guild"];

    await createSWAG({
      botOwners,
      client: createClient(),
      testServers,
    });

    expect(botOwners).toEqual([]);
    expect(testServers).toEqual(["test-guild"]);
  });
});
