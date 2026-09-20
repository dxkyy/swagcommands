import { Client } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import Command from "../../src/command-handler/Command";
import {
  CommandDeployer,
  CommandDeploymentTargetError,
} from "../../src/deployment/CommandDeployer";
import { PreconditionContainerArray } from "../../src/preconditions/containers/PreconditionContainerArray";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";
import CommandType from "../../src/util/CommandType";
import SWAG from "../../typings";

const instance = {} as SWAG;

const createCommand = (name: string, testOnly = false) =>
  new Command(
    instance,
    name,
    {
      callback: vi.fn(),
      description: `${name} description`,
      testOnly,
      type: CommandType.SLASH,
    },
    new PreconditionContainerArray(new PreconditionStore()),
  );

const createClient = (set = vi.fn().mockResolvedValue(new Map())) =>
  ({
    application: {
      commands: { set },
    },
    isReady: vi.fn(() => true),
  }) as unknown as Client;

describe("command deployment synchronization", () => {
  it("synchronizes global commands before sorted, unique test guilds", async () => {
    const set = vi.fn().mockResolvedValue(new Map());
    const deployer = new CommandDeployer(
      createClient(set),
      () => ({
        commands: [createCommand("ping"), createCommand("preview", true)],
      }),
      ["guild-b", "guild-a", "guild-b"],
    );

    const result = await deployer.deploy();

    expect(set).toHaveBeenCalledTimes(3);
    expect(set.mock.calls[0]).toEqual([
      [
        {
          name: "ping",
          description: "ping description",
          options: [],
        },
      ],
    ]);
    expect(set.mock.calls[1]).toEqual([
      [
        {
          name: "preview",
          description: "preview description",
          options: [],
        },
      ],
      "guild-a",
    ]);
    expect(set.mock.calls[2]?.[1]).toBe("guild-b");
    expect(result).toEqual({
      targets: [
        { scope: "global", commandNames: ["ping"] },
        {
          scope: "guild",
          guildId: "guild-a",
          commandNames: ["preview"],
        },
        {
          scope: "guild",
          guildId: "guild-b",
          commandNames: ["preview"],
        },
      ],
    });
  });

  it("supports targeting only global or test scopes", async () => {
    const globalSet = vi.fn().mockResolvedValue(new Map());
    const globalDeployer = new CommandDeployer(
      createClient(globalSet),
      () => ({ commands: [createCommand("ping")] }),
      ["guild-a"],
    );

    await globalDeployer.deploy({ scope: "global" });
    expect(globalSet).toHaveBeenCalledOnce();
    expect(globalSet.mock.calls[0]).toHaveLength(1);

    const testSet = vi.fn().mockResolvedValue(new Map());
    const testDeployer = new CommandDeployer(
      createClient(testSet),
      () => ({ commands: [createCommand("preview", true)] }),
      ["default-guild"],
    );

    await testDeployer.deploy({
      scope: "test",
      testGuildIds: ["override-guild"],
    });
    expect(testSet).toHaveBeenCalledWith(
      expect.any(Array),
      "override-guild",
    );
  });

  it("sends empty manifests so stale commands are removed", async () => {
    const set = vi.fn().mockResolvedValue(new Map());
    const deployer = new CommandDeployer(createClient(set), () => ({}), [
      "guild-a",
    ]);

    await deployer.deploy();

    expect(set).toHaveBeenNthCalledWith(1, []);
    expect(set).toHaveBeenNthCalledWith(2, [], "guild-a");
  });

  it("clears exactly the requested command scope", async () => {
    const set = vi.fn().mockResolvedValue(new Map());
    const deployer = new CommandDeployer(createClient(set), () => ({}));

    await deployer.clear({ scope: "global" });
    await deployer.clear({ scope: "guild", guildId: "old-guild" });

    expect(set).toHaveBeenNthCalledWith(1, []);
    expect(set).toHaveBeenNthCalledWith(2, [], "old-guild");
  });

  it("requires a ready Discord client before synchronizing", async () => {
    const set = vi.fn();
    const client = {
      application: { commands: { set } },
      isReady: vi.fn(() => false),
    } as unknown as Client;
    const deployer = new CommandDeployer(client, () => ({}));

    await expect(deployer.deploy()).rejects.toThrowError(
      /must be logged in and ready/,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("reports the failed target and previously completed targets", async () => {
    const failure = new Error("Discord rejected the request");
    const set = vi
      .fn()
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(new Map())
      .mockRejectedValueOnce(failure);
    const deployer = new CommandDeployer(
      createClient(set),
      () => ({
        commands: [createCommand("ping"), createCommand("preview", true)],
      }),
      ["guild-a", "guild-b", "guild-c"],
    );

    const error = await deployer.deploy().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(CommandDeploymentTargetError);
    expect(error).toMatchObject({
      cause: failure,
      target: { scope: "guild", guildId: "guild-b" },
      completedTargets: [
        { scope: "global", commandNames: ["ping"] },
        {
          scope: "guild",
          guildId: "guild-a",
          commandNames: ["preview"],
        },
      ],
    });
    expect(set).toHaveBeenCalledTimes(3);
  });

  it("serializes overlapping synchronization calls", async () => {
    let finishFirst!: () => void;
    const firstRequest = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const set = vi
      .fn()
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce(new Map());
    const deployer = new CommandDeployer(
      createClient(set),
      () => ({ commands: [createCommand("ping")] }),
    );

    const first = deployer.deploy({ scope: "global" });
    const second = deployer.deploy({ scope: "global" });

    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1));
    finishFirst();
    await first;
    await second;

    expect(set).toHaveBeenCalledTimes(2);
  });

  it("builds manifests before making the first remote mutation", async () => {
    const set = vi.fn().mockResolvedValue(new Map());
    const duplicate = createCommand("duplicate");
    const deployer = new CommandDeployer(createClient(set), () => ({
      commands: [duplicate],
      subcommands: [
        {
          commandName: "duplicate",
          commandObject: { description: "Duplicate" },
          options: [],
        },
      ] as never,
    }));

    await expect(deployer.deploy()).rejects.toThrowError(
      /defined more than once/,
    );
    expect(set).not.toHaveBeenCalled();
  });
});
