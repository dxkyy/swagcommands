import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CooldownPrecondition,
  CooldownScope,
  createCooldownId,
} from "../../src/cooldowns/CooldownPrecondition";
import { MemoryCooldownStore } from "../../src/cooldowns/MemoryCooldownStore";

const createUsage = (overrides: Record<string, unknown> = {}) => ({
  args: [],
  channel: { id: "channel-id" },
  guild: { id: "guild-id" },
  interaction: {},
  user: { id: "user-id" },
  ...overrides,
});

const command = { commandName: "ping" };

describe("CooldownPrecondition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks without side effects and claims only during commit", async () => {
    const cooldownStore = new MemoryCooldownStore();
    const precondition = new CooldownPrecondition(
      { cooldownStore } as never,
      "Cooldown",
    );
    const usage = createUsage();
    const context = { duration: 5_000 };

    await expect(
      precondition.chatInputRun(usage as never, command as never, context),
    ).resolves.toEqual({ success: true });
    expect(cooldownStore.getCooldown("cooldown:ping:user:user-id")).toBeUndefined();
    await expect(
      precondition.chatInputCommit!(usage as never, command as never, context),
    ).resolves.toEqual({ success: true });
    await expect(
      precondition.chatInputRun(usage as never, command as never, context),
    ).resolves.toMatchObject({
      failure: {
        context: {
          cooldownId: "cooldown:ping:user:user-id",
          remaining: 5_000,
          scope: CooldownScope.User,
        },
        identifier: "COOLDOWN_ACTIVE",
      },
      success: false,
    });

    vi.advanceTimersByTime(5_000);
    await expect(
      precondition.chatInputRun(usage as never, command as never, context),
    ).resolves.toEqual({ success: true });
  });

  it("creates separate IDs for each scope and supports shared custom IDs", () => {
    const usage = createUsage();

    expect(
      createCooldownId(
        command as never,
        usage as never,
        CooldownScope.Channel,
      ),
    ).toBe("cooldown:ping:channel:channel-id");
    expect(
      createCooldownId(
        command as never,
        usage as never,
        CooldownScope.Guild,
      ),
    ).toBe("cooldown:ping:guild:guild-id");
    expect(
      createCooldownId(
        command as never,
        usage as never,
        CooldownScope.Global,
        "shared commands",
      ),
    ).toBe("cooldown:shared%20commands:global:global");
  });

  it("includes the root command in subcommand IDs", () => {
    const root = { commandName: "admin" };
    const option = { commandName: "ban", parent: root };

    expect(createCooldownId(option as never, createUsage() as never)).toBe(
      "cooldown:admin%2Fban:user:user-id",
    );
  });

  it("fails when a requested scope is unavailable", async () => {
    const precondition = new CooldownPrecondition(
      { cooldownStore: new MemoryCooldownStore() } as never,
      "Cooldown",
    );

    await expect(
      precondition.chatInputRun(
        createUsage({ guild: null }) as never,
        command as never,
        { duration: 1_000, scope: CooldownScope.Guild },
      ),
    ).resolves.toMatchObject({
      failure: { identifier: "COOLDOWN_SCOPE_UNAVAILABLE" },
      success: false,
    });
  });
});
