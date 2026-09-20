import { describe, expect, it } from "vitest";

import type { PreconditionArrayResolvable } from "../../typings";

declare module "../../typings" {
  interface Preconditions {
    MinimumLevel: {
      level: number;
    };
    OwnerOnly: never;
  }
}

const validPreconditions: PreconditionArrayResolvable = [
  "OwnerOnly",
  { name: "MinimumLevel", context: { level: 3 } },
  ["OwnerOnly", { name: "MinimumLevel", context: { level: 5 } }],
];

// @ts-expect-error Preconditions with context cannot use the string shorthand.
const missingContext: PreconditionArrayResolvable = ["MinimumLevel"];

const unexpectedContext: PreconditionArrayResolvable = [
  // @ts-expect-error A context-free precondition cannot receive context.
  { name: "OwnerOnly", context: {} },
];

const invalidContext: PreconditionArrayResolvable = [
  // @ts-expect-error Context values are checked through module augmentation.
  { name: "MinimumLevel", context: { level: "three" } },
];

describe("precondition declaration types", () => {
  it("supports typed entries and nested expressions", () => {
    expect(validPreconditions).toHaveLength(3);
    expect(missingContext).toBeDefined();
    expect(unexpectedContext).toBeDefined();
    expect(invalidContext).toBeDefined();
  });
});
