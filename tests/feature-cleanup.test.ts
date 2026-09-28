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

const addFeature = (name: string, definition: unknown) => {
  loading.files.push({
    fileContents: definition,
    filePath: `/features/${name}.ts`,
  });
};

const createHandler = () =>
  new FeaturesHandler({ reportError: vi.fn() } as never, "/features", {} as never);

describe("feature cleanup", () => {
  beforeEach(() => {
    loading.files = [];
    loading.getAllFiles.mockImplementation(() => loading.files);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts the signal and runs one-time cleanups in reverse order", async () => {
    const order: string[] = [];
    addFeature("first", {
      phase: FeaturePhase.BeforeCommands,
      run: ({ signal }: { signal: AbortSignal }) => {
        expect(signal.aborted).toBe(false);
        return () => { order.push("first"); };
      },
    });
    addFeature("second", {
      phase: FeaturePhase.AfterCommands,
      run: () => () => { order.push("second"); },
    });
    const handler = createHandler();

    await handler.runPhase(FeaturePhase.BeforeCommands);
    await handler.runPhase(FeaturePhase.AfterCommands);
    const firstStop = handler.stop();
    const secondStop = handler.stop();

    expect(firstStop).toBe(secondStop);
    expect(handler.signal.aborted).toBe(true);
    await firstStop;
    expect(order).toEqual(["second", "first"]);
  });

  it("waits for a running feature before calling its cleanup", async () => {
    let finish!: (cleanup: () => void) => void;
    const cleanup = vi.fn();
    addFeature("slow", {
      run: () => new Promise<() => void>((resolve) => { finish = resolve; }),
    });
    const handler = createHandler();
    const running = handler.runPhase(FeaturePhase.ClientReady);
    await Promise.resolve();
    await Promise.resolve();

    let stopped = false;
    const stopping = handler.stop().then(() => { stopped = true; });
    expect(stopped).toBe(false);
    finish(cleanup);
    await running;
    await stopping;

    expect(cleanup).toHaveBeenCalledOnce();
    expect(stopped).toBe(true);
  });

  it("runs remaining cleanups when one fails", async () => {
    const failure = new Error("close failed");
    const otherCleanup = vi.fn();
    addFeature("first", { run: () => otherCleanup });
    addFeature("second", { run: () => () => { throw failure; } });
    const handler = createHandler();
    await handler.runPhase(FeaturePhase.ClientReady);

    await expect(handler.stop()).rejects.toMatchObject({
      cause: failure,
      code: "SWAG_FEATURE_CLEANUP_FAILED",
      context: {
        featureName: "second",
        filePath: "/features/second.ts",
      },
    });
    expect(otherCleanup).toHaveBeenCalledOnce();
  });

  it("clears pending timers and waits for an active recurring run", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    addFeature("job", { everyMs: 1000, run, runOnStart: true });
    const handler = createHandler();
    await handler.runPhase(FeaturePhase.ClientReady);

    let stopped = false;
    const stopping = handler.stop().then(() => { stopped = true; });
    expect(handler.signal.aborted).toBe(true);
    expect(stopped).toBe(false);
    finish();
    await stopping;
    await vi.advanceTimersByTimeAsync(5000);

    expect(stopped).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a recurring run that has not started yet", async () => {
    vi.useFakeTimers();
    const run = vi.fn();
    addFeature("job", { everyMs: 1000, run });
    const handler = createHandler();
    await handler.runPhase(FeaturePhase.ClientReady);

    expect(vi.getTimerCount()).toBe(1);
    await handler.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
