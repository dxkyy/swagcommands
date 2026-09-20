import { describe, expect, it } from "vitest";

import {
  AllFlowsPrecondition,
  Precondition,
} from "../../src/preconditions/Precondition";

describe("Precondition", () => {
  it("returns a shared immutable success result", () => {
    const precondition = new Precondition({} as never, "Allowed");

    const first = precondition.ok();
    const second = precondition.ok();

    expect(first).toBe(second);
    expect(first).toEqual({ success: true });
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("creates an immutable failure containing its registered name", () => {
    const precondition = new Precondition({} as never, "OwnerOnly");
    const sourceContext = { ownerId: "123" };

    const result = precondition.error({
      context: sourceContext,
      identifier: "OWNER_ONLY",
      message: "Only the owner can use this command.",
    });

    expect(result).toEqual({
      failure: {
        context: { ownerId: "123" },
        identifier: "OWNER_ONLY",
        message: "Only the owner can use this command.",
        preconditionName: "OwnerOnly",
      },
      success: false,
    });

    expect(Object.isFrozen(result)).toBe(true);
    if (result.success) {
      throw new Error("Expected a failure result.");
    }
    expect(Object.isFrozen(result.failure)).toBe(true);
    expect(Object.isFrozen(result.failure.context)).toBe(true);
    expect(result.failure.context).not.toBe(sourceContext);
  });

  it("exposes the SWAG instance and registered name to subclasses", () => {
    const instance = { botOwners: ["123"] };
    const precondition = new Precondition(instance as never, "OwnerOnly");

    expect(precondition.instance).toBe(instance);
    expect(precondition.name).toBe("OwnerOnly");
  });

  it("allows an all-flows precondition to share its check", async () => {
    class Always extends AllFlowsPrecondition {
      public messageRun() {
        return this.check();
      }

      public chatInputRun() {
        return this.check();
      }

      private check() {
        return this.ok();
      }
    }

    const precondition = new Always({} as never, "Always");
    const allFlowsPrecondition: AllFlowsPrecondition = precondition;

    expect(
      await allFlowsPrecondition.messageRun({} as never, {} as never, {}),
    ).toEqual({ success: true });
    expect(
      await allFlowsPrecondition.chatInputRun({} as never, {} as never, {}),
    ).toEqual({ success: true });
  });
});
