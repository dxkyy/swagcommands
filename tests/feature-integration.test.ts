import { beforeEach, describe, expect, it, vi } from "vitest";

const loading = vi.hoisted(() => ({
  files: new Map<string, Array<{ filePath: string; fileContents: unknown }>>(),
  getAllFiles: vi.fn(),
}));

vi.mock("../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

import SWAG from "../src/SWAG";
import { FeaturePhase } from "../src/features/FeaturePhase";

const createClient = () => ({
  isReady: vi.fn(() => true),
  on: vi.fn(),
});

describe("feature startup integration", () => {
  beforeEach(() => {
    loading.files.clear();
    loading.getAllFiles.mockImplementation(
      (directory: string) => loading.files.get(directory) ?? [],
    );
  });

  it("runs each phase around real command loading and only starts ready features explicitly", async () => {
    const order: string[] = [];
    const client = createClient();
    loading.files.set("/features", [
      {
        filePath: "/features/ready.ts",
        fileContents: () => { order.push("client ready"); },
      },
      {
        filePath: "/features/after.ts",
        fileContents: {
          phase: FeaturePhase.AfterCommands,
          run: ({ instance }: { instance: SWAG }) => {
            expect(instance.listCommands().map((command) => command.name)).toEqual(["hello"]);
            order.push("after commands");
          },
        },
      },
      {
        filePath: "/features/before.ts",
        fileContents: {
          phase: FeaturePhase.BeforeCommands,
          run: ({ instance }: { instance: SWAG }) => {
            expect(instance.commandHandler).toBeUndefined();
            order.push("before commands");
          },
        },
      },
    ]);
    loading.files.set("/commands", [
      {
        filePath: "/commands/hello.ts",
        fileContents: {
          type: "LEGACY",
          callback: () => undefined,
          init: () => { order.push("command init"); },
        },
      },
    ]);

    const swag = await SWAG.create({
      botOwners: ["owner"],
      client: client as never,
      commandsDir: "/commands",
      featuresDir: "/features",
    });
    expect(order).toEqual(["before commands", "command init", "after commands"]);

    await swag.startFeatures();
    await swag.startFeatures();
    expect(order).toEqual([
      "before commands", "command init", "after commands", "client ready",
    ]);
    await swag.stopFeatures();
  });

  it("cleans up an earlier phase if a later phase fails", async () => {
    const cleanup = vi.fn();
    const failure = new Error("later setup failed");
    loading.files.set("/features", [
      {
        filePath: "/features/before.ts",
        fileContents: {
          phase: FeaturePhase.BeforeCommands,
          run: () => cleanup,
        },
      },
      {
        filePath: "/features/after.ts",
        fileContents: {
          phase: FeaturePhase.AfterCommands,
          run: () => { throw failure; },
        },
      },
    ]);

    await expect(SWAG.create({
      botOwners: ["owner"],
      client: createClient() as never,
      featuresDir: "/features",
    })).rejects.toMatchObject({
      code: "SWAG_INITIALIZATION_FAILED",
      context: { featureName: "after", filePath: "/features/after.ts" },
    });
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
