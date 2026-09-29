import { describe, expect, it } from "vitest";
import { FeaturePhase } from "../src/index";
import type { Feature, FeatureFunction } from "../src/index";

const startup = (async ({ client, instance, signal }) => {
  client.isReady();
  instance.isReady();
  signal.aborted;
}) satisfies FeatureFunction;

const beforeCommands = {
  phase: FeaturePhase.BeforeCommands,
  run: async ({ instance }) => {
    instance.preconditions;
  },
} satisfies Feature;

const recurring = {
  phase: FeaturePhase.ClientReady,
  everyMs: 30_000,
  runOnStart: true,
  run: async ({ client }) => {
    client.isReady();
  },
} satisfies Feature;

// @ts-expect-error The interval must be a number.
const invalidInterval: Feature = { everyMs: "30s", run: () => {} };

// @ts-expect-error The phase must be a FeaturePhase enum member.
const invalidPhase: Feature = { phase: "beforeCommands", run: () => {} };

// @ts-expect-error runOnStart only applies to recurring features.
const invalidRunOnStart: Feature = { runOnStart: true, run: () => {} };

describe("feature declaration types", () => {
  it("supports one-time functions and phased feature objects", () => {
    expect(startup).toBeTypeOf("function");
    expect(beforeCommands.phase).toBe(FeaturePhase.BeforeCommands);
    expect(recurring.everyMs).toBe(30_000);
    expect(invalidInterval).toBeDefined();
    expect(invalidPhase).toBeDefined();
    expect(invalidRunOnStart).toBeDefined();
  });
});
