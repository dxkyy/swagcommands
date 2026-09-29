import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loading = vi.hoisted(() => ({
  files: [] as Array<{ filePath: string; fileContents: unknown }>,
  getAllFiles: vi.fn(),
}));

vi.mock("../src/util/get-all-files", () => ({
  default: loading.getAllFiles,
}));

import { FeaturePhase } from "../src/features/FeaturePhase";
import FeaturesHandler from "../src/util/FeaturesHandler";

const addFeature = (definition: unknown) => {
  loading.files.push({
    fileContents: definition,
    filePath: "/features/job.ts",
  });
};

const createHandler = (reportError = vi.fn()) => {
  const instance = { reportError };
  const handler = new FeaturesHandler(instance as never, "/features", {} as never);
  return { handler, reportError };
};

describe("recurring features", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loading.files = [];
    loading.getAllFiles.mockImplementation(() => loading.files);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits one interval before the first run by default", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    addFeature({ everyMs: 1000, run });
    const { handler } = createHandler();

    await handler.runPhase(FeaturePhase.ClientReady);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs immediately when requested and never overlaps itself", async () => {
    let finishFirst!: () => void;
    const run = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishFirst = resolve;
      }))
      .mockResolvedValue(undefined);
    addFeature({ everyMs: 1000, run, runOnStart: true });
    const { handler } = createHandler();

    await handler.runPhase(FeaturePhase.ClientReady);
    expect(run).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledOnce();

    finishFirst();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(999);
    expect(run).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reports run failures with feature context and schedules the next run", async () => {
    const failure = new Error("database unavailable");
    const run = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(undefined);
    addFeature({ everyMs: 1000, run, runOnStart: true });
    const { handler, reportError } = createHandler();

    await handler.runPhase(FeaturePhase.ClientReady);
    await vi.advanceTimersByTimeAsync(0);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({
      cause: failure,
      code: "SWAG_FEATURE_EXECUTION_FAILED",
      context: {
        featureName: "job",
        filePath: "/features/job.ts",
      },
    }));

    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
