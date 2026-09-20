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
});
