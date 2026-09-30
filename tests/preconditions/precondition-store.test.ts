import { describe, expect, it } from "vitest";

import { Precondition } from "../../src/preconditions/Precondition";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";

describe("PreconditionStore", () => {
  it("registers and retrieves preconditions by name", () => {
    const store = new PreconditionStore();
    const precondition = new Precondition({} as never, "OwnerOnly");

    expect(store.register(precondition)).toBe(store);
    expect(store.get("OwnerOnly")).toBe(precondition);
    expect(store.has("OwnerOnly")).toBe(true);
    expect(store.size).toBe(1);
    expect([...store]).toEqual([["OwnerOnly", precondition]]);
  });

  it("rejects duplicate registered names", () => {
    const store = new PreconditionStore();
    store.register(new Precondition({} as never, "OwnerOnly"));

    expect(() =>
      store.register(new Precondition({} as never, "OwnerOnly")),
    ).toThrow('A precondition named "OwnerOnly" is already registered.');
  });

  it("supports deletion and clearing", () => {
    const store = new PreconditionStore();
    store.register(new Precondition({} as never, "First"));
    store.register(new Precondition({} as never, "Second"));

    expect(store.delete("First")).toBe(true);
    expect([...store.values()].map(({ name }) => name)).toEqual(["Second"]);

    store.clear();
    expect(store.size).toBe(0);
  });
});
