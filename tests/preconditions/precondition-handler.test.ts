import { beforeEach, describe, expect, it, vi } from "vitest";

const loading = vi.hoisted(() => ({
  files: [] as Array<{ fileContents: unknown; filePath: string }>,
  getAllFiles: vi.fn(),
}));

vi.mock("../../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

import { Precondition } from "../../src/preconditions/Precondition";
import { PreconditionHandler } from "../../src/preconditions/PreconditionHandler";
import { PreconditionStore } from "../../src/preconditions/PreconditionStore";

describe("PreconditionHandler", () => {
  beforeEach(() => {
    loading.files.length = 0;
    loading.getAllFiles.mockImplementation(() => [...loading.files]);
  });

  it("loads each precondition once and derives its name from the filename", async () => {
    const instance = { botOwners: ["123"] };
    class OwnerOnly extends Precondition {}
    loading.files.push({
      fileContents: OwnerOnly,
      filePath: "/preconditions/OwnerOnly.ts",
    });
    const store = new PreconditionStore();
    const handler = new PreconditionHandler(
      instance as never,
      "/preconditions",
      store,
    );

    expect(loading.getAllFiles).not.toHaveBeenCalled();

    const firstLoad = handler.load();
    const secondLoad = handler.load();
    expect(firstLoad).toBe(secondLoad);
    await firstLoad;

    expect(loading.getAllFiles).toHaveBeenCalledOnce();
    expect(loading.getAllFiles).toHaveBeenCalledWith("/preconditions");
    expect(store.get("OwnerOnly")).toBeInstanceOf(OwnerOnly);
    expect(store.get("OwnerOnly")?.instance).toBe(instance);
    await handler.load();
    expect(loading.getAllFiles).toHaveBeenCalledOnce();
  });

  it("rejects files that do not export a Precondition subclass", async () => {
    loading.files.push({
      fileContents: () => true,
      filePath: "/preconditions/invalid.ts",
    });
    const handler = new PreconditionHandler(
      {} as never,
      "/preconditions",
      new PreconditionStore(),
    );

    await expect(handler.load()).rejects.toThrow(
      'Precondition file "/preconditions/invalid.ts" must default-export a class extending Precondition.',
    );
  });

  it("uses an explicit class name instead of coupling identity to the filename", async () => {
    class RenamedFile extends Precondition {
      public static readonly preconditionName = "MinimumLevel";
    }
    loading.files.push({
      fileContents: RenamedFile,
      filePath: "/preconditions/check-level.ts",
    });
    const store = new PreconditionStore();

    await new PreconditionHandler(
      {} as never,
      "/preconditions",
      store,
    ).load();

    expect(store.get("MinimumLevel")).toBeInstanceOf(RenamedFile);
    expect(store.has("check-level")).toBe(false);
  });

  it("rejects duplicate names even when they come from different folders", async () => {
    class First extends Precondition {}
    class Second extends Precondition {}
    loading.files.push(
      {
        fileContents: First,
        filePath: "/preconditions/first/Shared.ts",
      },
      {
        fileContents: Second,
        filePath: "/preconditions/second/Shared.ts",
      },
    );
    const handler = new PreconditionHandler(
      {} as never,
      "/preconditions",
      new PreconditionStore(),
    );

    await expect(handler.load()).rejects.toThrow(
      'A precondition named "Shared" is already registered.',
    );
  });
});
