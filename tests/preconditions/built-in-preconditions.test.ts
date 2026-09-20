import { PermissionFlagsBits } from "discord.js";
import { describe, expect, it, vi } from "vitest";

import {
  registerBuiltInPreconditions,
} from "../../src/preconditions/built-ins/BuiltInPreconditions";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";

const createInstance = () => ({
  botOwners: ["owner"],
  commandHandler: {
    prefixHandler: {
      get: vi.fn().mockResolvedValue("?"),
    },
  },
  testServers: ["test-guild"],
});

const createUsage = (overrides: Record<string, unknown> = {}) => ({
  args: [],
  guild: { id: "test-guild" },
  member: {
    permissions: {
      has: vi.fn().mockReturnValue(true),
    },
  },
  message: {},
  user: { id: "owner" },
  ...overrides,
});

describe("built-in preconditions", () => {
  it("registers every built-in under its public name", () => {
    const store = new PreconditionStore();
    registerBuiltInPreconditions(createInstance() as never, store);

    expect([...store].map(([name]) => name)).toEqual([
      "ArgumentCount",
      "GuildOnly",
      "HasPermissions",
      "OwnerOnly",
      "TestOnly",
    ]);
  });

  it("returns structured failures for built-in guards", async () => {
    const store = new PreconditionStore();
    registerBuiltInPreconditions(createInstance() as never, store);
    const command = { commandName: "secure" };

    await expect(
      await store.get("GuildOnly")!.messageRun!(
        createUsage({ guild: null }) as never,
        command as never,
        {},
      ),
    ).toMatchObject({
      failure: { identifier: "GUILD_ONLY" },
      success: false,
    });
    await expect(
      await store.get("OwnerOnly")!.messageRun!(
        createUsage({ user: { id: "someone-else" } }) as never,
        command as never,
        {},
      ),
    ).toMatchObject({
      failure: { identifier: "OWNER_ONLY" },
      success: false,
    });
    await expect(
      await store.get("TestOnly")!.messageRun!(
        createUsage({ guild: { id: "production" } }) as never,
        command as never,
        {},
      ),
    ).toMatchObject({
      failure: { identifier: "TEST_ONLY" },
      success: false,
    });
  });

  it("includes missing permissions and syntax details in failures", async () => {
    const instance = createInstance();
    const store = new PreconditionStore();
    registerBuiltInPreconditions(instance as never, store);
    const usage = createUsage({
      args: [],
      member: {
        permissions: { has: vi.fn().mockReturnValue(false) },
      },
    });
    const command = { commandName: "secure" };

    await expect(
      await store.get("HasPermissions")!.messageRun!(
        usage as never,
        command as never,
        { permissions: [PermissionFlagsBits.ManageGuild] },
      ),
    ).toMatchObject({
      failure: {
        context: { missingPermissions: [PermissionFlagsBits.ManageGuild] },
        identifier: "MISSING_PERMISSIONS",
      },
      success: false,
    });
    await expect(
      await store.get("ArgumentCount")!.messageRun!(
        usage as never,
        command as never,
        { expectedArgs: "<target>", minArgs: 1 },
      ),
    ).toMatchObject({
      failure: {
        identifier: "ARGUMENT_COUNT",
        message: "Incorrect syntax. Please use `?secure <target>`.",
      },
      success: false,
    });
  });
});
