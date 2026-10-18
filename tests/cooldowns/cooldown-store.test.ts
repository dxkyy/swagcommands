import { describe, expect, it } from "vitest";

import { MemoryCooldownStore } from "../../src/cooldowns/MemoryCooldownStore";

describe("MemoryCooldownStore", () => {
  it("stores, replaces, and deletes expiration timestamps", () => {
    const store = new MemoryCooldownStore();

    expect(store.getCooldown("command:user")).toBeUndefined();

    store.setCooldown("command:user", 1_000);
    expect(store.getCooldown("command:user")).toBe(1_000);

    store.setCooldown("command:user", 2_000);
    expect(store.getCooldown("command:user")).toBe(2_000);

    store.deleteCooldown("command:user");
    expect(store.getCooldown("command:user")).toBeUndefined();
  });

  it("atomically allows only the first active claim", async () => {
    const store = new MemoryCooldownStore();

    const claims = await Promise.all([
      Promise.resolve(store.claimCooldown("command:user", 2_000, 1_000)),
      Promise.resolve(store.claimCooldown("command:user", 2_000, 1_000)),
    ]);

    expect(claims).toEqual([
      { acquired: true, expiresAt: 2_000 },
      { acquired: false, expiresAt: 2_000 },
    ]);
    expect(store.claimCooldown("command:user", 4_000, 2_000)).toEqual({
      acquired: true,
      expiresAt: 4_000,
    });
  });
});
