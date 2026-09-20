import { Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/event-handler/EventHandler", () => ({
  default: class EventHandler {
    public async load() {}
    public registerEvents() {}
  },
}));

import SWAG from "../../src/SWAG";
import { CommandDeploymentError } from "../../src/errors/CommandDeploymentError";

const createClient = (
  set = vi.fn().mockResolvedValue(new Map()),
  ready = true,
) =>
  ({
    application: {
      commands: { set },
    },
    isReady: vi.fn(() => ready),
    on: vi.fn(),
  }) as unknown as Client;

const createInstance = (client: Client) =>
  SWAG.create({
    botOwners: ["owner-id"],
    client,
  });

describe("public command deployment API", () => {
  it("exposes explicit synchronization and clearing after initialization", async () => {
    const set = vi.fn().mockResolvedValue(new Map());
    const instance = await createInstance(createClient(set));

    await expect(
      instance.deployCommands({ scope: "global" }),
    ).resolves.toEqual({
      targets: [{ scope: "global", commandNames: [] }],
    });
    await instance.clearCommands({ scope: "guild", guildId: "old-guild" });

    expect(set).toHaveBeenNthCalledWith(1, []);
    expect(set).toHaveBeenNthCalledWith(2, [], "old-guild");
    expect(instance.state).toBe("ready");
  });

  it("rejects readiness failures as structured deployment errors", async () => {
    const set = vi.fn();
    const instance = await createInstance(createClient(set, false));

    const error = await instance
      .deployCommands({ scope: "global" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(CommandDeploymentError);
    expect(error).toMatchObject({
      code: "SWAG_COMMAND_DEPLOYMENT_FAILED",
      completedTargets: [],
      context: {},
      phase: "deployment",
    });
    if (!(error instanceof CommandDeploymentError)) {
      throw new Error("Expected a CommandDeploymentError.");
    }
    expect(error.message).toContain("must be logged in and ready");
    expect(instance.state).toBe("ready");
    expect(set).not.toHaveBeenCalled();
  });

  it("preserves failed-target context and completed targets", async () => {
    const failure = new Error("Discord rejected the guild deployment");
    const set = vi
      .fn()
      .mockResolvedValueOnce(new Map())
      .mockRejectedValueOnce(failure);
    const instance = await SWAG.create({
      botOwners: ["owner-id"],
      client: createClient(set),
      testServers: ["test-guild"],
    });

    const error = await instance.deployCommands().catch((reason) => reason);

    expect(error).toBeInstanceOf(CommandDeploymentError);
    expect(error).toMatchObject({
      cause: failure,
      completedTargets: [
        { scope: "global", commandNames: [] },
      ],
      context: {
        deploymentScope: "guild",
        guildId: "test-guild",
      },
      phase: "deployment",
    });
    expect(instance.state).toBe("ready");
  });
});
