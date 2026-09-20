import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({
  commandLoad: vi.fn<() => Promise<void>>(),
  eventLoad: vi.fn<() => Promise<void>>(),
  eventRegister: vi.fn<() => void>(),
  featureLoad: vi.fn<() => Promise<void>>(),
  preconditionLoad: vi.fn<() => Promise<void>>(),
  subcommandLoad: vi.fn<() => Promise<void>>(),
}));

vi.mock("../src/command-handler/CommandHandler", () => ({
  default: class CommandHandler {
    async load() {
      await lifecycle.commandLoad();
    }
  },
}));

vi.mock("../src/subcommand-handler/SubcommandHandler", () => ({
  default: class SubcommandHandler {
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
    lifecycle.eventLoad.mockResolvedValue(undefined);
    lifecycle.featureLoad.mockResolvedValue(undefined);
    lifecycle.preconditionLoad.mockResolvedValue(undefined);
    lifecycle.subcommandLoad.mockResolvedValue(undefined);
  });

  it("returns an initialized instance through the async factory", async () => {
    const instance = await createSWAG({
      client: createClient(),
      commandsDir: "/commands",
      events: { dir: "/events" },
      featuresDir: "/features",
      preconditionsDir: "/preconditions",
      subcommandsDir: "/subcommands",
    });

    expect(instance).toBeInstanceOf(SWAG);
    expect(instance.state).toBe("ready");
    expect(instance.isReady()).toBe(true);
    expect(lifecycle.commandLoad).toHaveBeenCalledOnce();
    expect(lifecycle.subcommandLoad).toHaveBeenCalledOnce();
    expect(lifecycle.featureLoad).toHaveBeenCalledOnce();
    expect(lifecycle.preconditionLoad).toHaveBeenCalledOnce();
    expect(lifecycle.eventLoad).toHaveBeenCalledOnce();
    expect(lifecycle.eventRegister).toHaveBeenCalledOnce();
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
