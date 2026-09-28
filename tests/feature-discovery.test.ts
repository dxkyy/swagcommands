import { beforeEach, describe, expect, it, vi } from "vitest";

const loading = vi.hoisted(() => ({
  files: [] as Array<{ filePath: string; fileContents: unknown }>,
  getAllFiles: vi.fn(),
}));

vi.mock("../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

import { FeatureDefinitionError, FeaturePhase } from "../src/index";
import { discoverFeatures } from "../src/features/discover-features";

const addFile = (filePath: string, fileContents: unknown) => {
  loading.files.push({ filePath, fileContents });
};

describe("feature discovery", () => {
  beforeEach(() => {
    loading.files = [];
    loading.getAllFiles.mockImplementation(() => loading.files);
  });

  it("sorts files and normalizes function and object definitions", () => {
    const recurring = vi.fn();
    const once = vi.fn();
    addFile("/features/nested/job.ts", {
      everyMs: 30_000,
      phase: FeaturePhase.AfterCommands,
      run: recurring,
      runOnStart: true,
    });
    addFile("/features/analytics.js", once);

    expect(discoverFeatures("/features")).toEqual([
      {
        filePath: "/features/analytics.js",
        kind: "once",
        name: "analytics",
        phase: FeaturePhase.ClientReady,
        run: once,
      },
      {
        everyMs: 30_000,
        filePath: "/features/nested/job.ts",
        kind: "recurring",
        name: "nested/job",
        phase: FeaturePhase.AfterCommands,
        run: recurring,
        runOnStart: true,
      },
    ]);
    expect(loading.getAllFiles).toHaveBeenCalledWith("/features");
  });

  it("defaults object definitions to a one-time client-ready run", () => {
    const run = vi.fn();
    addFile("/features/setup.ts", { name: " setup ", run });

    expect(discoverFeatures("/features")).toEqual([
      {
        filePath: "/features/setup.ts",
        kind: "once",
        name: "setup",
        phase: FeaturePhase.ClientReady,
        run,
      },
    ]);
  });

  it("rejects an invalid export with its file path", () => {
    addFile("/features/broken.ts", { name: "broken" });

    expect(() => discoverFeatures("/features")).toThrowError(
      expect.objectContaining({
        code: "SWAG_FEATURE_DEFINITION_INVALID",
        context: { filePath: "/features/broken.ts" },
      }) as FeatureDefinitionError,
    );
  });

  it.each([
    [{ run: () => {}, phase: "early" }, "invalid phase"],
    [{ run: () => {}, everyMs: 0 }, "positive finite number"],
    [{ run: () => {}, everyMs: Infinity }, "positive finite number"],
    [{ run: () => {}, runOnStart: true }, "without everyMs"],
    [{ run: () => {}, everyMs: 1000, runOnStart: "yes" }, "boolean"],
    [{ run: () => {}, name: "  " }, "invalid name"],
  ])("rejects malformed definitions: %s", (definition, message) => {
    addFile("/features/broken.ts", definition);

    expect(() => discoverFeatures("/features")).toThrow(message);
  });

  it("rejects duplicate names across paths", () => {
    addFile("/features/first.ts", { name: "shared", run: () => {} });
    addFile("/features/second.ts", { name: "shared", run: () => {} });

    try {
      discoverFeatures("/features");
      expect.fail("Expected duplicate names to be rejected.");
    } catch (error) {
      expect(error).toBeInstanceOf(FeatureDefinitionError);
      expect(error).toMatchObject({
        context: {
          featureName: "shared",
          filePath: "/features/second.ts",
        },
      });
      expect((error as Error).message).toContain("/features/first.ts");
    }
  });
});
